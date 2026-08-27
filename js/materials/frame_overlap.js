export function createFrameOverlapPostprocess(deps) {
  const { clamp, pointInAnyPolygon } = deps;

  function extendMaterialSegmentsIntoFrame(result, c) {
    if (frameGridOverlapWidth(c) <= 0 || c.frameLoops <= 0 || c.polygons.length === 0) return result;
    for (const bucket of result.values()) {
      bucket.horizontal = bucket.horizontal.map((segment) => extendSegmentIntoFrame(segment, "horizontal", c));
      bucket.vertical = bucket.vertical.map((segment) => extendSegmentIntoFrame(segment, "vertical", c));
    }
    return result;
  }

  function extendSegmentIntoFrame(segment, direction, c) {
    const overlap = frameGridOverlapWidth(c);
    if (direction === "horizontal") {
      let x0 = segment.x0;
      let x1 = segment.x1;
      if (isOuterBoundaryEndpoint({ x: x0, y: segment.y }, { x: -1, y: 0 }, c)) x0 -= overlap;
      if (isOuterBoundaryEndpoint({ x: x1, y: segment.y }, { x: 1, y: 0 }, c)) x1 += overlap;
      return { ...segment, x0: clamp(x0, 0, c.bedWidth), x1: clamp(x1, 0, c.bedWidth) };
    }
    let y0 = segment.y0;
    let y1 = segment.y1;
    if (isOuterBoundaryEndpoint({ x: segment.x, y: y0 }, { x: 0, y: -1 }, c)) y0 -= overlap;
    if (isOuterBoundaryEndpoint({ x: segment.x, y: y1 }, { x: 0, y: 1 }, c)) y1 += overlap;
    return { ...segment, y0: clamp(y0, 0, c.bedDepth), y1: clamp(y1, 0, c.bedDepth) };
  }

  function isOuterBoundaryEndpoint(point, outwardDirection, c) {
    const probe = 0.05;
    const sample = {
      x: point.x + outwardDirection.x * probe,
      y: point.y + outwardDirection.y * probe,
    };
    return !pointInAnyPolygon(sample, c.polygons);
  }

  function frameGridOverlapWidth(c) {
    return 0;
  }

  return {
    extendMaterialSegmentsIntoFrame,
    extendSegmentIntoFrame,
    frameGridOverlapWidth,
  };
}
