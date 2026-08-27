import { segmentsBacktrack, unitNormal } from "./candidate_validation.js?v=auto-workflow-pin-endpoint-final-v1-20260827";

export function appendGeneratedSnakePath(points, nextPoints, deps) {
  for (const point of nextPoints) appendGeneratedSnakePoint(points, point, deps);
}

export function appendGeneratedSnakePoint(points, point, deps) {
  if (!point) return;
  if (points.length > 0 && deps.samePoint(points[points.length - 1], point, 0.001)) return;
  while (points.length >= 2 && segmentsBacktrack(points[points.length - 2], points[points.length - 1], point)) {
    points.pop();
    if (points.length > 0 && deps.samePoint(points[points.length - 1], point, 0.001)) return;
  }
  points.push({ x: point.x, y: point.y });
}

export function commonRowSpan(rows) {
  const x0 = Math.max(...rows.map((row) => row.x0));
  const x1 = Math.min(...rows.map((row) => row.x1));
  if (x1 <= x0) return null;
  const gridXs = commonGridXs(rows).filter((x) => x >= x0 - 0.001 && x <= x1 + 0.001);
  return gridXs.length >= 2 ? { x0: gridXs[0], x1: gridXs[gridXs.length - 1], gridXs } : null;
}

export function intervalsOverlap(a0, a1, b0, b1) {
  const a = Math.min(a0, a1);
  const b = Math.max(a0, a1);
  const c = Math.min(b0, b1);
  const d = Math.max(b0, b1);
  return Math.min(b, d) - Math.max(a, c) > 0.001;
}

export function mergeBucketLineSegments(segments, direction, deps) {
  const groups = new Map();
  for (const segment of segments) {
    const key = direction === "horizontal" ? segment.y.toFixed(3) : segment.x.toFixed(3);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(segment);
  }
  const merged = [];
  for (const group of groups.values()) {
    const sorted = group.slice().sort((a, b) => (
      direction === "horizontal" ? a.x0 - b.x0 : a.y0 - b.y0
    ));
    merged.push(...deps.mergeMaterialLineSegments(sorted, direction));
  }
  return merged.sort((a, b) => (
    direction === "horizontal"
      ? a.y - b.y || a.x0 - b.x0
      : a.x - b.x || a.y0 - b.y0
  ));
}

export function nearestValue(values, target) {
  return values.reduce((best, value) => (
    Math.abs(value - target) < Math.abs(best - target) ? value : best
  ), values[0]);
}

export function orthogonalEndpointConnector(from, to) {
  if (!from || !to) return [];
  const points = [{ x: from.x, y: from.y }];
  if (Math.abs(from.x - to.x) <= 0.001 || Math.abs(from.y - to.y) <= 0.001) {
    points.push({ x: to.x, y: to.y });
    return points;
  }
  const normal = unitNormal(from.normal ?? to.normal);
  const firstAlongX = normal
    ? Math.abs(normal.x) >= Math.abs(normal.y)
    : Math.abs(from.x - to.x) <= Math.abs(from.y - to.y);
  points.push(firstAlongX ? { x: to.x, y: from.y } : { x: from.x, y: to.y });
  points.push({ x: to.x, y: to.y });
  return points;
}

export function pointOnGridLine(a, b, bucket) {
  if (Math.abs(a.y - b.y) <= 0.001) {
    const x0 = Math.min(a.x, b.x);
    const x1 = Math.max(a.x, b.x);
    return (bucket.horizontal ?? []).some((segment) => (
      Math.abs(segment.y - a.y) <= 0.001 && segment.x0 <= x0 + 0.001 && segment.x1 >= x1 - 0.001
    ));
  }
  if (Math.abs(a.x - b.x) <= 0.001) {
    const y0 = Math.min(a.y, b.y);
    const y1 = Math.max(a.y, b.y);
    return (bucket.vertical ?? []).some((segment) => (
      Math.abs(segment.x - a.x) <= 0.001 && segment.y0 <= y0 + 0.001 && segment.y1 >= y1 - 0.001
    ));
  }
  return false;
}

export function removeConsecutiveDuplicatePoints(points, deps) {
  const result = [];
  for (const point of points) {
    const last = result[result.length - 1];
    if (!last || !deps.samePoint(last, point)) result.push(point);
  }
  return result;
}

export function representativeSnakeRows(horizontalSegments, verticalSegments) {
  const groups = new Map();
  for (const segment of horizontalSegments) {
    const key = segment.y.toFixed(3);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(segment);
  }
  return [...groups.values()]
    .map((segments) => {
      const row = segments.slice().sort((a, b) => (b.x1 - b.x0) - (a.x1 - a.x0))[0];
      const gridXs = rowGridXs(row, verticalSegments);
      if (gridXs.length < 2) return null;
      return { ...row, x0: gridXs[0], x1: gridXs[gridXs.length - 1], gridXs };
    })
    .filter((segment) => segment && segment.x1 - segment.x0 > 0.5)
    .sort((a, b) => a.y - b.y);
}

export function serpentinePathFromRows(rows, deps) {
  const points = [];
  rows.forEach((row, index) => {
    const left = { x: row.x0, y: row.y };
    const right = { x: row.x1, y: row.y };
    const start = index % 2 === 0 ? left : right;
    const end = index % 2 === 0 ? right : left;
    if (points.length > 0) {
      const last = points[points.length - 1];
      if (!deps.samePoint(last, start)) {
        const jog = { x: last.x, y: start.y };
        if (!deps.samePoint(last, jog) && !deps.samePoint(jog, start)) points.push(jog);
        points.push(start);
      }
    } else {
      points.push(start);
    }
    points.push(end);
  });
  return points;
}

export function uniqueNumbers(values) {
  return [...new Map(values
    .sort((a, b) => a - b)
    .map((value) => [value.toFixed(3), value])).values()];
}

export function uniqueSortedNumbers(values) {
  return [...new Set(values
    .filter(Number.isFinite)
    .map((value) => value.toFixed(3)))]
    .map(Number)
    .sort((a, b) => a - b);
}

function commonGridXs(rows) {
  if (rows.length === 0) return [];
  const counts = new Map();
  for (const row of rows) {
    for (const x of row.gridXs ?? []) {
      const key = x.toFixed(3);
      counts.set(key, { x, count: (counts.get(key)?.count ?? 0) + 1 });
    }
  }
  return [...counts.values()]
    .filter((entry) => entry.count === rows.length)
    .map((entry) => entry.x)
    .sort((a, b) => a - b);
}

function rowGridXs(row, verticalSegments) {
  const xs = [];
  for (const segment of verticalSegments) {
    if (segment.x < row.x0 - 0.001 || segment.x > row.x1 + 0.001) continue;
    if (row.y < segment.y0 - 0.001 || row.y > segment.y1 + 0.001) continue;
    xs.push(segment.x);
  }
  return uniqueNumbers(xs);
}
