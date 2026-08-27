export function createMaterialRegionPreviewRenderer(deps) {
  const {
    canvas,
    ctx,
    state,
    mmToPx,
    drawPolygonPath,
    hexToRgba,
    materialColor,
    displayMaterialRegions,
    materialRegions,
    regionKeyIds,
    shapeToPolygon,
    drawShrunkTpuMaterialPreview,
  } = deps;

  function drawMaterialRegions(c, f, mode, options = {}) {
    if (c.polygons.length === 0) return;
    if (mode === "design" && options.fastDesign) {
      drawSimpleMaterialRegions(c, f);
      drawSelectedRegion(f);
      return;
    }
    ctx.save();
    for (const region of displayMaterialRegions(c)) {
      if (mode === "grid" && Number(region.material) === 0) continue;
      const gridSnakeRemainderPreview = mode === "grid" && c.tpuSnakeEnabled && Number(region.material) === 0;
      const fillMaterial = gridSnakeRemainderPreview ? c.tpuSnakeRemainderMaterial : region.material;
      const alpha = Number(fillMaterial) < 0 ? 0.82 : mode === "design" ? 0.72 : gridSnakeRemainderPreview ? 0.07 : 0.12;
      ctx.fillStyle = hexToRgba(materialColor(fillMaterial), alpha);
      drawPolygonPath(region.polygon, f);
      ctx.fill();
    }
    ctx.restore();
    if (mode === "grid") drawShrunkTpuMaterialPreview(c, f);
    drawRegionMaterialOverrides(f, mode);
    drawSelectedRegion(f);
  }

  function drawSimpleMaterialRegions(c, f) {
    ctx.save();
    for (const region of materialRegions(c)) {
      ctx.fillStyle = hexToRgba(materialColor(region.material), Number(region.material) < 0 ? 0.82 : 0.62);
      drawPolygonPath(region.polygon, f);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawRegionMaterialOverrides(f, mode) {
    if (state.regionMaterialOverrides.size === 0) return;
    for (const [key, material] of state.regionMaterialOverrides) {
      const mask = regionMaskCanvas(key, f, hexToRgba(materialColor(material), mode === "design" ? 0.82 : 0.22));
      if (mask) {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(mask, 0, 0);
        ctx.restore();
      }
    }
  }

  function drawSelectedRegion(f) {
    if (!state.selectedRegionKey) return;
    if (state.selectedRegionPoint) {
      const p = mmToPx(state.selectedRegionPoint.x, state.selectedRegionPoint.y, f);
      ctx.save();
      ctx.fillStyle = "#20252b";
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  function regionMaskCanvas(key, f, fillStyle) {
    const ids = regionKeyIds(key);
    if (ids.length === 0) return null;
    const included = state.shapes.filter((shape) => ids.includes(shape.id));
    if (included.length !== ids.length) return null;
    const excluded = state.shapes.filter((shape) => !ids.includes(shape.id));
    const dpr = window.devicePixelRatio || 1;
    const mask = document.createElement("canvas");
    mask.width = canvas.width;
    mask.height = canvas.height;
    const mctx = mask.getContext("2d");
    mctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    mctx.fillStyle = fillStyle;
    fillShapeOnContext(mctx, included[0], f);
    for (const shape of included.slice(1)) {
      mctx.globalCompositeOperation = "source-in";
      fillShapeOnContext(mctx, shape, f);
    }
    mctx.globalCompositeOperation = "destination-out";
    for (const shape of excluded) fillShapeOnContext(mctx, shape, f);
    return mask;
  }

  function fillShapeOnContext(targetCtx, shape, f) {
    const polygon = shapeToPolygon(shape);
    if (polygon.length < 3) return;
    const first = mmToPx(polygon[0].x, polygon[0].y, f);
    targetCtx.beginPath();
    targetCtx.moveTo(first.x, first.y);
    for (const point of polygon.slice(1)) {
      const p = mmToPx(point.x, point.y, f);
      targetCtx.lineTo(p.x, p.y);
    }
    targetCtx.closePath();
    targetCtx.fill();
  }

  return {
    drawMaterialRegions,
  };
}
