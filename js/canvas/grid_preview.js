export function createGridPreviewRenderer(deps) {
  const {
    ctx,
    state,
    mmToPx,
    drawOpenPath,
    materialGridSegments,
    tpuSnakePreviewLayer,
    materialPreviewStrokeColor,
    hexToRgba,
    materialColor,
    tpuGridEdgeNormal,
    drawGridPathOverlays,
    drawTpuSnakePlanningRegions,
    drawTpuSnakeEndpoints,
  } = deps;

  function drawPunchGrid(c, f) {
    if (c.polygons.length === 0) return;
    const previewLayer = tpuSnakePreviewLayer(c);
    const segmentsByMaterial = materialGridSegments(c, previewLayer);
    const pathOverlays = [];
    ctx.save();
    ctx.lineWidth = Math.max(1, c.beadWidth * f.scale);
    for (const [material, segments] of segmentsByMaterial) {
      const color = materialPreviewStrokeColor(material);
      const isT0Preview = Number(material) === 0;
      ctx.strokeStyle = hexToRgba(color, isT0Preview ? 0.62 : 0.18);
      for (const segment of segments.horizontal) {
        const a = mmToPx(segment.x0, segment.y, f);
        const b = mmToPx(segment.x1, segment.y, f);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      ctx.strokeStyle = hexToRgba(color, isT0Preview ? 0.82 : 0.24);
      for (const segment of segments.vertical) {
        const a = mmToPx(segment.x, segment.y0, f);
        const b = mmToPx(segment.x, segment.y1, f);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      if (segments.paths?.length) segments.paths.forEach((path, pathIndex) => pathOverlays.push({ material, color, path, pathIndex }));
      if (segments.solidPaths?.length) segments.solidPaths.forEach((path, pathIndex) => pathOverlays.push({ material, color, path, pathIndex, solid: true }));
    }
    drawGridPathOverlays(pathOverlays, c, f);
    ctx.restore();
    drawTpuSnakePlanningRegions(c, f);
    drawTpuSnakeEndpoints(c, f);
  }

  function drawShrunkTpuMaterialPreview(c, f) {
    const bucket = materialGridSegments(c, tpuSnakePreviewLayer(c)).get(0);
    if (!bucket) return;
    ctx.save();
    ctx.lineCap = "square";
    ctx.lineJoin = "miter";
    ctx.strokeStyle = hexToRgba(materialColor(0), 0.16);
    ctx.lineWidth = Math.max(1, c.gridLineWidth * f.scale);
    for (const segment of bucket.horizontal) {
      const a = mmToPx(segment.x0, segment.y, f);
      const b = mmToPx(segment.x1, segment.y, f);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    for (const segment of bucket.vertical) {
      const a = mmToPx(segment.x, segment.y0, f);
      const b = mmToPx(segment.x, segment.y1, f);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    if (bucket.paths?.length) {
      ctx.strokeStyle = hexToRgba(materialColor(0), 0.22);
      for (const path of bucket.paths) drawOpenPath(path, f);
    }
    ctx.restore();
    drawTpuGridBoundary(c, f, bucket);
    if (state.tpuSnake.picking) drawTpuSelectableBoundary(c, f, bucket);
  }

  function tpuGridBoundaryEdges(bucket, c, options = {}) {
    return [
      ...bucket.horizontal.map((segment) => ({
        direction: "horizontal",
        segment,
        start: { x: segment.x0, y: segment.y },
        end: { x: segment.x1, y: segment.y },
      })),
      ...bucket.vertical.map((segment) => ({
        direction: "vertical",
        segment,
        start: { x: segment.x, y: segment.y0 },
        end: { x: segment.x, y: segment.y1 },
      })),
    ].filter((edge) => {
      if (options.excludePcbPinContact && edge.segment?.source === "pcb-pin-contact") return false;
      return tpuGridEdgeNormal(edge, bucket, c);
    });
  }

  function drawTpuGridBoundary(c, f, bucket) {
    const edges = tpuGridBoundaryEdges(bucket, c);
    if (edges.length === 0) return;
    ctx.save();
    ctx.setLineDash([]);
    ctx.lineCap = "square";
    ctx.lineJoin = "miter";
    ctx.strokeStyle = hexToRgba(materialColor(0), 0.46);
    ctx.lineWidth = Math.max(1.4, c.beadWidth * f.scale + 0.6);
    for (const edge of edges) {
      const a = mmToPx(edge.start.x, edge.start.y, f);
      const b = mmToPx(edge.end.x, edge.end.y, f);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawTpuSelectableBoundary(c, f, bucket) {
    const edges = tpuGridBoundaryEdges(bucket, c, { excludePcbPinContact: true });
    if (edges.length === 0) return;
    ctx.save();
    ctx.setLineDash([]);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#f08a24";
    ctx.lineWidth = Math.max(3, c.gridLineWidth * f.scale + 2);
    for (const edge of edges) {
      const a = mmToPx(edge.start.x, edge.start.y, f);
      const b = mmToPx(edge.end.x, edge.end.y, f);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  return {
    drawPunchGrid,
    drawShrunkTpuMaterialPreview,
  };
}
