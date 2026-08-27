import {
  strandOffsets,
} from "./grid_segments.js";

export function printableTpuSnakePaths(points, c) {
  const offsets = strandOffsets(c);
  if (offsets.length <= 1) return [points];
  return offsets
    .map((offset) => offsetOrthogonalPolyline(points, offset))
    .map((path) => orthogonalizePrintablePolyline(path))
    .map((path) => roundedPrintablePolyline(path))
    .map((path) => copySnakePathMetadata(points, path))
    .filter((path) => path.length >= 2);
}

function copySnakePathMetadata(source, path) {
  for (const key of ["sourceConnectionIndex", "sourceConnectionLabel"]) {
    if (source?.[key] !== undefined) path[key] = source[key];
  }
  return path;
}

export function roundedPrintablePolyline(points) {
  const result = [];
  for (const point of points ?? []) {
    const rounded = {
      x: Number(point.x.toFixed(3)),
      y: Number(point.y.toFixed(3)),
    };
    const last = result[result.length - 1];
    if (!last || Math.abs(last.x - rounded.x) > 0.0001 || Math.abs(last.y - rounded.y) > 0.0001) {
      result.push(rounded);
    }
  }
  return result;
}

export function offsetOrthogonalPolyline(points, offset) {
  if (Math.abs(offset) <= 0.0001 || points.length < 2) return points.map((point) => ({ ...point }));
  const result = [];
  for (let i = 0; i < points.length; i += 1) {
    const current = points[i];
    const prev = i > 0 ? points[i - 1] : null;
    const next = i < points.length - 1 ? points[i + 1] : null;
    let shifted = null;
    if (prev && next) shifted = offsetOrthogonalVertex(prev, current, next, offset);
    else if (next) shifted = offsetOrthogonalEndpoint(current, next, offset);
    else if (prev) shifted = offsetOrthogonalEndpoint(prev, current, offset, true);
    if (shifted) result.push(shifted);
  }
  return result;
}

export function orthogonalizePrintablePolyline(points) {
  if (!Array.isArray(points) || points.length < 2) return Array.isArray(points) ? points : [];
  const cleaned = [];
  for (const point of points) {
    const last = cleaned[cleaned.length - 1];
    if (!last || Math.hypot(point.x - last.x, point.y - last.y) > 0.001) cleaned.push(point);
  }
  if (cleaned.length < 2) return cleaned;
  const result = [cleaned[0]];
  for (let i = 1; i < cleaned.length; i += 1) {
    const a = result[result.length - 1];
    const b = cleaned[i];
    if (Math.hypot(a.x - b.x, a.y - b.y) <= 0.001) continue;
    if (Math.abs(a.x - b.x) <= 0.001 || Math.abs(a.y - b.y) <= 0.001) {
      result.push(b);
      continue;
    }
    const previous = result.length >= 2 ? result[result.length - 2] : null;
    const continueHorizontal = previous && Math.abs(previous.y - a.y) <= 0.001;
    const continueVertical = previous && Math.abs(previous.x - a.x) <= 0.001;
    const corner = continueHorizontal
      ? { x: b.x, y: a.y }
      : continueVertical
        ? { x: a.x, y: b.y }
        : Math.abs(b.x - a.x) >= Math.abs(b.y - a.y)
          ? { x: b.x, y: a.y }
          : { x: a.x, y: b.y };
    if (Math.hypot(corner.x - a.x, corner.y - a.y) > 0.001) result.push(corner);
    result.push(b);
  }
  return result;
}

function offsetOrthogonalEndpoint(a, b, offset, useEnd = false) {
  const normal = segmentLeftNormal(a, b);
  if (!normal) return useEnd ? { ...b } : { ...a };
  const point = useEnd ? b : a;
  return { x: point.x + normal.x * offset, y: point.y + normal.y * offset };
}

function offsetOrthogonalVertex(prev, current, next, offset) {
  const n0 = segmentLeftNormal(prev, current);
  const n1 = segmentLeftNormal(current, next);
  if (!n0 && !n1) return { ...current };
  if (!n0) return { x: current.x + n1.x * offset, y: current.y + n1.y * offset };
  if (!n1) return { x: current.x + n0.x * offset, y: current.y + n0.y * offset };
  const a0 = { x: prev.x + n0.x * offset, y: prev.y + n0.y * offset };
  const b0 = { x: current.x + n0.x * offset, y: current.y + n0.y * offset };
  const a1 = { x: current.x + n1.x * offset, y: current.y + n1.y * offset };
  const b1 = { x: next.x + n1.x * offset, y: next.y + n1.y * offset };
  return snakePrintLineIntersection(a0, b0, a1, b1) ?? {
    x: current.x + (n0.x + n1.x) * offset,
    y: current.y + (n0.y + n1.y) * offset,
  };
}

function segmentLeftNormal(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len <= 0.001) return null;
  return { x: -dy / len, y: dx / len };
}

function snakePrintLineIntersection(a, b, c, d) {
  const r = { x: b.x - a.x, y: b.y - a.y };
  const s = { x: d.x - c.x, y: d.y - c.y };
  const denom = r.x * s.y - r.y * s.x;
  if (Math.abs(denom) <= 1e-9) return null;
  const t = ((c.x - a.x) * s.y - (c.y - a.y) * s.x) / denom;
  return { x: a.x + t * r.x, y: a.y + t * r.y };
}
