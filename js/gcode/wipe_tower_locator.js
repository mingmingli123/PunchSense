export function createWipeTowerLocator(deps) {
  const {
    selectWipeTowerRect,
    unionBounds,
    pointInPolygon,
    clamp,
    referenceBounds,
  } = deps;

  let cachedWipeTower = null;

  function wipeTowerRect(c) {
    const cacheKey = JSON.stringify({
      bed: [c.bedWidth, c.bedDepth],
      polygons: c.polygons.map((polygon) => polygon.map((point) => [
        Number(point.x.toFixed(3)),
        Number(point.y.toFixed(3)),
      ])),
    });
    if (cachedWipeTower?.key === cacheKey) return cachedWipeTower.rect;
    const rect = selectWipeTowerRect(c, {
      unionBounds,
      pointInPolygon,
      clamp,
      referenceBounds,
    });
    cachedWipeTower = { key: cacheKey, rect };
    return rect;
  }

  return {
    wipeTowerRect,
  };
}
