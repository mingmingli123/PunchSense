import {
  distance,
  pointInAnyPolygon,
  removeDuplicateClosingPoint,
  samePoint,
} from "./core/geometry.js";

export function offsetFramePath(path, polygons, amount) {
  if (Math.abs(amount) <= 1e-6 || path.length === 0) return path;
  const closed = samePoint(path[0], path[path.length - 1], 0.01);
  const points = removeDuplicateClosingPoint(path);
  if (points.length < 2) return path;
  const offset = closed
    ? offsetClosedFramePath(points, polygons, amount)
    : offsetOpenFramePath(points, polygons, amount);
  if (closed && offset.length > 0) offset.push({ ...offset[0] });
  return offset;
}

function offsetClosedFramePath(points, polygons, amount) {
  const count = points.length;
  const edges = [];
  for (let i = 0; i < count; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % count];
    const dir = { x: b.x - a.x, y: b.y - a.y };
    const len = Math.hypot(dir.x, dir.y);
    if (len <= 0.001) continue;
    const unit = { x: dir.x / len, y: dir.y / len };
    const normal = outwardSegmentNormal(a, b, polygons);
    edges.push({ a, b, unit, normal });
  }
  if (edges.length < 2) return offsetOpenFramePath(points, polygons, amount);

  const result = [];
  const absAmount = Math.abs(amount);
  const miterLimit = Math.max(absAmount * 5, absAmount + 2);
  for (let i = 0; i < edges.length; i += 1) {
    const prev = edges[(i - 1 + edges.length) % edges.length];
    const curr = edges[i];
    const vertex = curr.a;
    const prevPoint = {
      x: prev.a.x + prev.normal.x * amount,
      y: prev.a.y + prev.normal.y * amount,
    };
    const currPoint = {
      x: curr.a.x + curr.normal.x * amount,
      y: curr.a.y + curr.normal.y * amount,
    };
    const hit = lineIntersection(prevPoint, prev.unit, currPoint, curr.unit);
    const fallback = {
      x: vertex.x + ((prev.normal.x + curr.normal.x) / 2) * amount,
      y: vertex.y + ((prev.normal.y + curr.normal.y) / 2) * amount,
    };
    const point = hit && distance(hit, vertex) <= miterLimit ? hit : fallback;
    result.push(point);
  }
  return result;
}

function offsetOpenFramePath(points, polygons, amount) {
  return points.map((point, index) => {
    const prev = index > 0 ? points[index - 1] : null;
    const next = index < points.length - 1 ? points[index + 1] : null;
    const normals = [];
    if (prev) normals.push(outwardSegmentNormal(prev, point, polygons));
    if (next) normals.push(outwardSegmentNormal(point, next, polygons));
    const normal = averageNormals(normals);
    return { x: point.x + normal.x * amount, y: point.y + normal.y * amount };
  });
}

function outwardSegmentNormal(a, b, polygons) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len <= 0.001) return { x: 0, y: 0 };
  const candidates = [
    { x: -dy / len, y: dx / len },
    { x: dy / len, y: -dx / len },
  ];
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const probe = 0.2;
  for (const normal of candidates) {
    const sample = { x: mid.x + normal.x * probe, y: mid.y + normal.y * probe };
    if (!pointInAnyPolygon(sample, polygons)) return normal;
  }
  return candidates[0];
}

function averageNormals(normals) {
  if (normals.length === 0) return { x: 0, y: 0 };
  const sum = normals.reduce((acc, normal) => ({
    x: acc.x + normal.x,
    y: acc.y + normal.y,
  }), { x: 0, y: 0 });
  const len = Math.hypot(sum.x, sum.y);
  if (len <= 0.001) return normals[0];
  return { x: sum.x / len, y: sum.y / len };
}

function lineIntersection(pointA, dirA, pointB, dirB) {
  const cross = dirA.x * dirB.y - dirA.y * dirB.x;
  if (Math.abs(cross) <= 1e-6) return null;
  const dx = pointB.x - pointA.x;
  const dy = pointB.y - pointA.y;
  const t = (dx * dirB.y - dy * dirB.x) / cross;
  return { x: pointA.x + dirA.x * t, y: pointA.y + dirA.y * t };
}
