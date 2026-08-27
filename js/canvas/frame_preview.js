export function createFramePreviewRenderer(deps) {
  const {
    ctx,
    state,
    drawOpenPath,
    drawPolygonPath,
    hexToRgba,
    materialColor,
    materialRegions,
    selectedShapeIndices,
    shapeToPolygon,
    whiteTpuOuterFramePaths,
    drawPolylineEditState,
    firstLayerMaterial,
  } = deps;

  function drawFrame(c, f, mode) {
    if (c.polygons.length === 0) return;
    ctx.save();
    if (mode === "design") drawDesignRegionOutlines(c, f);
    else drawPrintableOuterFramePreview(c, f);
    if (c.shapeMode === "polyline" && !state.polylineClosed) drawPolylineEditState(f);
    ctx.restore();
  }

  function drawPrintableOuterFramePreview(c, f) {
    if (c.frameLoops <= 0) return;
    const framePaths = whiteTpuOuterFramePaths(c);
    if (framePaths.length === 0) return;
    ctx.save();
    ctx.setLineDash([]);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = hexToRgba(materialColor(firstLayerMaterial), 0.58);
    ctx.lineWidth = Math.max(1.6, c.beadWidth * f.scale);
    for (const path of framePaths) drawOpenPath(path, f);
    ctx.restore();
  }

  function drawDesignRegionOutlines(c, f) {
    ctx.save();
    ctx.lineWidth = 1.8;
    const regions = materialRegions(c);
    for (const region of regions) {
      ctx.strokeStyle = materialColor(region.material);
      drawPolygonPath(region.polygon, f);
      ctx.stroke();
    }
    const selected = selectedShapeIndices();
    for (const index of selected) {
      const shape = state.shapes[index];
      if (!shape) continue;
      ctx.strokeStyle = index === state.selectedShapeIndex ? "#20252b" : "#6b7480";
      ctx.lineWidth = index === state.selectedShapeIndex ? 2.8 : 2;
      drawPolygonPath(shapeToPolygon(shape), f);
      ctx.stroke();
    }
    ctx.restore();
  }

  return {
    drawFrame,
  };
}
