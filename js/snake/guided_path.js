export function buildGuidedSnakePath(guidePoints, sourceBucket, c, deps, helpers) {
  const xs = helpers.uniqueSortedNumbers([
    ...(sourceBucket.vertical ?? []).map((segment) => segment.x),
    ...(sourceBucket.horizontal ?? []).flatMap((segment) => [segment.x0, segment.x1]),
  ]);
  const ys = helpers.uniqueSortedNumbers([
    ...(sourceBucket.horizontal ?? []).map((segment) => segment.y),
    ...(sourceBucket.vertical ?? []).flatMap((segment) => [segment.y0, segment.y1]),
  ]);
  if (xs.length === 0 || ys.length === 0) return { points: [], usedHorizontalKeys: [] };
  const snapped = guidePoints
    .map((point) => ({ x: helpers.nearestValue(xs, point.x), y: helpers.nearestValue(ys, point.y) }))
    .map((point) => deps.nearestEpiGridPoint ? deps.nearestEpiGridPoint(point, c) : point)
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
  const orthogonal = helpers.orthogonalizeGuidePoints(snapped, sourceBucket, deps);
  const points = helpers.anchorGuidedPathEndpoints(
    helpers.orthogonalizePolylineSegments(helpers.guidedSerpentineFromPolyline(orthogonal, sourceBucket, c, deps), deps),
    deps.endpoints ?? [],
    deps,
  );
  if (points.length < 2) return { points: [], usedHorizontalKeys: [] };
  if (helpers.hasRepeatedGridEdge(points)) return { points: [], usedHorizontalKeys: [] };
  const usedHorizontalKeys = [];
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    if (Math.abs(a.y - b.y) <= 0.001) {
      usedHorizontalKeys.push(...(sourceBucket.horizontal ?? [])
        .filter((segment) => Math.abs(segment.y - a.y) <= 0.001)
        .filter((segment) => helpers.intervalsOverlap(segment.x0, segment.x1, a.x, b.x))
        .map((segment) => deps.lineSegmentKey(segment, "horizontal")));
    }
  }
  return { points, usedHorizontalKeys };
}
