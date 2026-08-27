export function createMaterialExclusivityPostprocess(deps) {
  const {
    mergeAllMaterialBuckets,
    tpuPathDeps,
    subtractSnakeHorizontalFromSegments,
    subtractSnakeVerticalFromSegments,
    pathBoundsRect,
    subtractCellRectsFromSegments,
    subtractOverlappingLineSegments,
    subtractPathHorizontalCrossingsFromVerticalSegments,
    subtractPathVerticalCrossingsFromHorizontalSegments,
    mergeNumericIntervals,
  } = deps;

  function enforceFinalMaterialExclusivity(result, c) {
    const t0Bucket = result.get(0);
    if (!t0Bucket) return result;
    subtractT0GridFromNonT0Materials(result, c);
    subtractT0PathsFromNonT0Materials(result, c);
    subtractT0SolidPathsFromNonT0Materials(result, c);
    mergeAllMaterialBuckets(result, tpuPathDeps());
    return result;
  }

  function subtractT0PathsFromNonT0Materials(result, c) {
    const t0Bucket = result.get(0);
    const paths = t0Bucket?.paths ?? [];
    if (paths.length === 0) return;
    const cornerRelief = Boolean(c.tpuSnakeCornerRelief)
      ? Math.max(Number(c.beadWidth ?? 0.4) * 1.5, Math.min(Number(c.pitch ?? 2), Number(c.beadWidth ?? 0.4) * 3))
      : 0;
    for (const [material, bucket] of result) {
      if (Number(material) === 0) continue;
      for (const path of paths) {
        bucket.horizontal = subtractSnakeHorizontalFromSegments(bucket.horizontal, path, 0, cornerRelief);
        bucket.vertical = subtractSnakeVerticalFromSegments(bucket.vertical, path, 0, cornerRelief);
        if (!c.tpuSnakeAllowCrossings) {
          bucket.horizontal = subtractPathVerticalCrossingsFromHorizontalSegments(bucket.horizontal, path, c);
          bucket.vertical = subtractPathHorizontalCrossingsFromVerticalSegments(bucket.vertical, path, c);
        }
      }
    }
  }

  function subtractT0SolidPathsFromNonT0Materials(result, c) {
    const t0Bucket = result.get(0);
    const paths = t0Bucket?.solidPaths ?? [];
    if (paths.length === 0) return;
    const rects = paths
      .map((path) => pathBoundsRect(path))
      .filter((rect) => rect && rect.w > 0.1 && rect.h > 0.1);
    if (rects.length === 0) return;
    for (const [material, bucket] of result) {
      if (Number(material) === 0) continue;
      bucket.horizontal = subtractCellRectsFromSegments(bucket.horizontal, "horizontal", rects, c, mergeNumericIntervals);
      bucket.vertical = subtractCellRectsFromSegments(bucket.vertical, "vertical", rects, c, mergeNumericIntervals);
    }
  }

  function subtractT0GridFromNonT0Materials(result, c) {
    const t0Bucket = result.get(0);
    if (!t0Bucket) return;
    for (const [material, bucket] of result) {
      if (Number(material) === 0) continue;
      bucket.horizontal = subtractOverlappingLineSegments(bucket.horizontal, t0Bucket.horizontal, "horizontal", c, mergeNumericIntervals);
      bucket.vertical = subtractOverlappingLineSegments(bucket.vertical, t0Bucket.vertical, "vertical", c, mergeNumericIntervals);
    }
  }

  return {
    enforceFinalMaterialExclusivity,
    subtractT0GridFromNonT0Materials,
  };
}
