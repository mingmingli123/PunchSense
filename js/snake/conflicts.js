const blockedGridPointCache = new WeakMap();
const blockedGridIndexCache = new WeakMap();

export function firstBlockedSnakePoint(path, sourceBucket, blockedBucket, connection, c) {
  const blocked = new Set([
    ...blockedSnakeGridPoints(blockedBucket).map(pointKey),
  ]);
  for (const point of snakeGridPoints(path, sourceBucket)) {
    if (
      isConnectionEndpoint(point, connection)
      || pointInEndpointBlockedAllowance(point, connection.endpoints, { distance: euclideanDistance, samePoint: samePointFallback })
    ) continue;
    if (blocked.has(pointKey(point))) return point;
  }
  return firstBlockedSnakeSegmentOverlap(path, blockedBucket, connection);
}

export function usedSnakeBucket(used) {
  const points = [...used.values()].map((entry) => entry.point);
  return {
    horizontal: points.map((point) => ({ y: point.y, x0: point.x, x1: point.x, material: 0 })),
    vertical: points.map((point) => ({ x: point.x, y0: point.y, y1: point.y, material: 0 })),
    paths: [],
  };
}

export function mergeSnakeBuckets(...buckets) {
  return {
    horizontal: buckets.flatMap((bucket) => bucket?.horizontal ?? []),
    vertical: buckets.flatMap((bucket) => bucket?.vertical ?? []),
    paths: buckets.flatMap((bucket) => bucket?.paths ?? []),
  };
}

export function firstSnakeClearanceConflict(path, sourceBucket, blockedBucket, c, endpoints, deps) {
  const clearance = Math.max(0, Number(c.pitch ?? 0) * 2);
  if (clearance <= 0.001 || !blockedBucket) return null;
  const blockedIndex = blockedSnakeGridIndex(blockedBucket, Math.max(clearance, Number(c.pitch ?? 1)));
  if (blockedIndex.points.length === 0) return null;
  for (const point of snakeGridPoints(path, sourceBucket)) {
    if (pointInEndpointTransitionZone(point, endpoints, deps, c)) continue;
    for (const blockedPoint of nearbyBlockedPoints(blockedIndex, point, clearance)) {
      if (deps.distance(point, blockedPoint) < clearance - 0.001) return point;
    }
  }
  return null;
}

export function firstSnakeOccupancyConflict(path, sourceBucket, occupiedBucket, connection, c) {
  if (!occupiedBucket) return null;
  return firstBlockedSnakePoint(path, sourceBucket, occupiedBucket, connection, c);
}

function pointInEndpointTransitionZone(point, endpoints, deps, c) {
  if (pointOnEndpointLead(point, endpoints, deps)) return true;
  const pitch = Math.max(0, Number(c?.pitch ?? 0));
  const clearance = pitch * 2;
  return (endpoints ?? []).some((endpoint) => {
    const lead = Math.max(0, Number(endpoint?.normalLeadLength ?? c?.tpuSnakeNormalLeadLength ?? 0));
    const radius = Math.max(lead + pitch * 0.75, clearance + pitch * 0.25);
    return radius > 0.001 && deps.distance(point, endpoint) <= radius + 0.001;
  });
}

function pointInEndpointBlockedAllowance(point, endpoints, deps) {
  return pointOnEndpointLead(point, endpoints, deps);
}

function pointOnEndpointLead(point, endpoints, deps) {
  return (endpoints ?? []).some((endpoint) => {
    const leadPoints = endpointLeadPoints(endpoint);
    return leadPoints.some((leadPoint) => pointOnSegment(point, endpoint, leadPoint, deps, 0.001));
  });
}

function endpointLeadPoints(endpoint) {
  if (endpoint?.source === "pcb-pin") {
    const boundary = endpoint?.boundaryPoint;
    if (boundary && Number.isFinite(Number(boundary.x)) && Number.isFinite(Number(boundary.y))) {
      return [{ x: Number(boundary.x), y: Number(boundary.y) }];
    }
    return [];
  }
  const normal = unitNormal(endpoint?.normal);
  const lead = Math.max(0, Number(endpoint?.normalLeadLength ?? 0));
  if (!normal || lead <= 0) return [];
  return [
    {
      x: endpoint.x + normal.x * lead,
      y: endpoint.y + normal.y * lead,
    },
    {
      x: endpoint.x - normal.x * lead,
      y: endpoint.y - normal.y * lead,
    },
  ];
}

function firstBlockedSnakeSegmentOverlap(path, blockedBucket, connection) {
  if (!path?.length || !blockedBucket) return null;
  for (let i = 1; i < path.length; i += 1) {
    const a = path[i - 1];
    const b = path[i];
    if (samePointFallback(a, b)) continue;
    if (Math.abs(a.y - b.y) <= 0.001) {
      const overlap = firstHorizontalOverlap(a, b, blockedBucket.horizontal ?? [], connection);
      if (overlap) return overlap;
    } else if (Math.abs(a.x - b.x) <= 0.001) {
      const overlap = firstVerticalOverlap(a, b, blockedBucket.vertical ?? [], connection);
      if (overlap) return overlap;
    }
  }
  return null;
}

function firstHorizontalOverlap(a, b, blockedSegments, connection) {
  const y = a.y;
  const x0 = Math.min(a.x, b.x);
  const x1 = Math.max(a.x, b.x);
  for (const segment of blockedSegments) {
    if (Math.abs(Number(segment.y) - y) > 0.001) continue;
    const overlap0 = Math.max(x0, Math.min(Number(segment.x0), Number(segment.x1)));
    const overlap1 = Math.min(x1, Math.max(Number(segment.x0), Number(segment.x1)));
    if (overlap1 - overlap0 <= 0.001) continue;
    const midpoint = { x: (overlap0 + overlap1) / 2, y };
    if (overlapFullyInsideEndpointAllowance([{ x: overlap0, y }, midpoint, { x: overlap1, y }], connection.endpoints)) continue;
    return midpoint;
  }
  return null;
}

function firstVerticalOverlap(a, b, blockedSegments, connection) {
  const x = a.x;
  const y0 = Math.min(a.y, b.y);
  const y1 = Math.max(a.y, b.y);
  for (const segment of blockedSegments) {
    if (Math.abs(Number(segment.x) - x) > 0.001) continue;
    const overlap0 = Math.max(y0, Math.min(Number(segment.y0), Number(segment.y1)));
    const overlap1 = Math.min(y1, Math.max(Number(segment.y0), Number(segment.y1)));
    if (overlap1 - overlap0 <= 0.001) continue;
    const midpoint = { x, y: (overlap0 + overlap1) / 2 };
    if (overlapFullyInsideEndpointAllowance([{ x, y: overlap0 }, midpoint, { x, y: overlap1 }], connection.endpoints)) continue;
    return midpoint;
  }
  return null;
}

function overlapFullyInsideEndpointAllowance(points, endpoints) {
  const deps = { distance: euclideanDistance, samePoint: samePointFallback };
  return points.every((point) => pointInEndpointBlockedAllowance(point, endpoints, deps));
}

function pointOnSegment(point, a, b, deps, epsilon = 0.001) {
  const length = deps.distance(a, b);
  if (length <= epsilon) return deps.samePoint(point, a, epsilon);
  const d = deps.distance(a, point) + deps.distance(point, b);
  return Math.abs(d - length) <= Math.max(epsilon, length * 1e-4);
}

function euclideanDistance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function samePointFallback(a, b, epsilon = 0.001) {
  return euclideanDistance(a, b) <= epsilon;
}

function blockedSnakeGridPoints(bucket) {
  if (!bucket || typeof bucket !== "object") return [];
  const cached = blockedGridPointCache.get(bucket);
  if (cached) return cached;
  const points = snakeGridPointsFromBucket(bucket);
  blockedGridPointCache.set(bucket, points);
  return points;
}

function blockedSnakeGridIndex(bucket, cellSize) {
  if (!bucket || typeof bucket !== "object") return { cellSize, points: [], cells: new Map() };
  const normalizedCellSize = Math.max(0.001, Number(cellSize) || 1);
  const cached = blockedGridIndexCache.get(bucket);
  if (cached && Math.abs(cached.cellSize - normalizedCellSize) <= 0.001) return cached;
  const points = blockedSnakeGridPoints(bucket);
  const cells = new Map();
  for (const point of points) {
    const key = gridCellKey(point, normalizedCellSize);
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key).push(point);
  }
  const index = { cellSize: normalizedCellSize, points, cells };
  blockedGridIndexCache.set(bucket, index);
  return index;
}

function nearbyBlockedPoints(index, point, clearance) {
  const radius = Math.ceil(clearance / index.cellSize) + 1;
  const cx = Math.floor(point.x / index.cellSize);
  const cy = Math.floor(point.y / index.cellSize);
  const result = [];
  for (let ix = cx - radius; ix <= cx + radius; ix += 1) {
    for (let iy = cy - radius; iy <= cy + radius; iy += 1) {
      const points = index.cells.get(`${ix}:${iy}`);
      if (points) result.push(...points);
    }
  }
  return result;
}

function gridCellKey(point, cellSize) {
  return `${Math.floor(point.x / cellSize)}:${Math.floor(point.y / cellSize)}`;
}

function snakeGridPointsFromBucket(bucket) {
  const points = [];
  for (const h of bucket.horizontal ?? []) {
    for (const v of bucket.vertical ?? []) {
      if (v.x < h.x0 - 0.001 || v.x > h.x1 + 0.001) continue;
      if (h.y < v.y0 - 0.001 || h.y > v.y1 + 0.001) continue;
      points.push({ x: v.x, y: h.y });
    }
  }
  return points;
}

function isConnectionEndpoint(point, connection) {
  return (connection.endpoints ?? []).some((endpoint) => (
    Math.abs(endpoint.x - point.x) <= 0.001 && Math.abs(endpoint.y - point.y) <= 0.001
  ));
}

export function firstSharedSnakePoint(path, bucket, used, connection) {
  for (const point of snakeGridPoints(path, bucket)) {
    const hit = used.get(pointKey(point));
    if (hit) return { owner: hit.connection, point, connection };
  }
  return null;
}

export function snakeGridPoints(path, bucket) {
  const points = [];
  for (const point of path) points.push(point);
  for (let i = 1; i < path.length; i += 1) {
    const a = path[i - 1];
    const b = path[i];
    if (Math.abs(a.y - b.y) <= 0.001) {
      const x0 = Math.min(a.x, b.x);
      const x1 = Math.max(a.x, b.x);
      for (const segment of bucket.vertical ?? []) {
        if (segment.x < x0 - 0.001 || segment.x > x1 + 0.001) continue;
        if (a.y < segment.y0 - 0.001 || a.y > segment.y1 + 0.001) continue;
        points.push({ x: segment.x, y: a.y });
      }
    } else if (Math.abs(a.x - b.x) <= 0.001) {
      const y0 = Math.min(a.y, b.y);
      const y1 = Math.max(a.y, b.y);
      for (const segment of bucket.horizontal ?? []) {
        if (segment.y < y0 - 0.001 || segment.y > y1 + 0.001) continue;
        if (a.x < segment.x0 - 0.001 || a.x > segment.x1 + 0.001) continue;
        points.push({ x: a.x, y: segment.y });
      }
    }
  }
  return points;
}

export function pointKey(point) {
  return `${point.x.toFixed(3)}:${point.y.toFixed(3)}`;
}

function unitNormal(normal) {
  if (!normal) return null;
  const length = Math.hypot(normal.x, normal.y);
  if (length <= 1e-9) return null;
  return { x: normal.x / length, y: normal.y / length };
}
