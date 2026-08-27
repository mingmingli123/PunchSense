export function transposeSnakeBucket(bucket) {
  return {
    horizontal: (bucket.vertical ?? []).map((segment) => ({
      y: segment.x,
      x0: segment.y0,
      x1: segment.y1,
      material: segment.material,
    })),
    vertical: (bucket.horizontal ?? []).map((segment) => ({
      x: segment.y,
      y0: segment.x0,
      y1: segment.x1,
      material: segment.material,
    })),
    paths: [],
  };
}

export function transposeSnakeDeps(deps) {
  return {
    ...deps,
    endpoints: (deps.endpoints ?? []).map(transposeEndpoint),
    blockedSnakeBucket: deps.blockedSnakeBucket ? transposeSnakeBucket(deps.blockedSnakeBucket) : null,
    distance(a, b) {
      return deps.distance(transposePoint(a), transposePoint(b));
    },
    samePoint(a, b, epsilon) {
      return deps.samePoint(transposePoint(a), transposePoint(b), epsilon);
    },
    lineSegmentKey(segment, direction) {
      const original = direction === "horizontal"
        ? { x: segment.y, y0: segment.x0, y1: segment.x1 }
        : { y: segment.x, x0: segment.y0, x1: segment.y1 };
      return deps.lineSegmentKey(original, direction === "horizontal" ? "vertical" : "horizontal");
    },
  };
}

export function transposeEndpoint(point) {
  return {
    ...transposePoint(point),
    normal: point.normal ? transposePoint(point.normal) : null,
    boundaryPoint: point.boundaryPoint ? transposePoint(point.boundaryPoint) : null,
    contactPoint: point.contactPoint ? transposePoint(point.contactPoint) : null,
    normalLeadLength: point.normalLeadLength,
    disableNormalLead: point.disableNormalLead,
  };
}

export function transposePoint(point) {
  return { x: point.y, y: point.x };
}
