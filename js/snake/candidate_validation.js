import { pointsBounds } from "./geometry_helpers.js?v=auto-workflow-pin-endpoint-final-v1-20260827";

export function betterParametricCandidate(a, b) {
  if (!b) return a;
  if (!a || b.score < a.score) return b;
  return a;
}

export function serpentineUniformityPenalty(path, rows, span, c) {
  if (!path?.length || !rows?.length || !span) return 0;
  const pitch = Math.max(0.001, Number(c.pitch ?? 1));
  const bounds = pointsBounds(path);
  const spanWidth = Math.max(pitch, span.x1 - span.x0);
  const edgeUnderuse = Math.max(0, bounds.x - span.x0) + Math.max(0, span.x1 - (bounds.x + bounds.w));
  const rowGaps = [];
  const sortedRows = rows.slice().sort((a, b) => a.y - b.y);
  for (let i = 1; i < sortedRows.length; i += 1) {
    const gap = sortedRows[i].y - sortedRows[i - 1].y;
    if (gap > 0.001) rowGaps.push(gap);
  }
  const meanGap = rowGaps.length
    ? rowGaps.reduce((sum, gap) => sum + gap, 0) / rowGaps.length
    : pitch;
  const gapVariance = rowGaps.length
    ? rowGaps.reduce((sum, gap) => sum + Math.abs(gap - meanGap), 0) / rowGaps.length
    : 0;
  const excessiveSparseRows = rowGaps.reduce((sum, gap) => sum + Math.max(0, gap - pitch * 4), 0);
  const widthUsePenalty = Math.max(0, spanWidth * 0.72 - bounds.w);
  return edgeUnderuse * 0.65 + widthUsePenalty * 0.45 + gapVariance * 1.2 + excessiveSparseRows * 0.35;
}

export function hasImmediateBacktracking(path) {
  for (let i = 2; i < path.length; i += 1) {
    if (segmentsBacktrack(path[i - 2], path[i - 1], path[i])) return true;
  }
  return false;
}

export function hasRepeatedGridEdge(path) {
  const horizontal = [];
  const vertical = [];
  for (let i = 1; i < path.length; i += 1) {
    const a = path[i - 1];
    const b = path[i];
    if (Math.hypot(b.x - a.x, b.y - a.y) <= 0.001) continue;
    if (Math.abs(a.y - b.y) <= 0.001) {
      const segment = { y: a.y, a: Math.min(a.x, b.x), b: Math.max(a.x, b.x) };
      if (horizontal.some((other) => Math.abs(other.y - segment.y) <= 0.001 && intervalsOverlapByLength(other.a, other.b, segment.a, segment.b, 0.001))) return true;
      horizontal.push(segment);
    } else if (Math.abs(a.x - b.x) <= 0.001) {
      const segment = { x: a.x, a: Math.min(a.y, b.y), b: Math.max(a.y, b.y) };
      if (vertical.some((other) => Math.abs(other.x - segment.x) <= 0.001 && intervalsOverlapByLength(other.a, other.b, segment.a, segment.b, 0.001))) return true;
      vertical.push(segment);
    } else {
      return true;
    }
  }
  return false;
}

export function segmentsBacktrack(a, b, c) {
  const epsilon = 0.001;
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const bcx = c.x - b.x;
  const bcy = c.y - b.y;
  if (Math.hypot(abx, aby) <= epsilon || Math.hypot(bcx, bcy) <= epsilon) return false;
  const horizontal = Math.abs(aby) <= epsilon && Math.abs(bcy) <= epsilon;
  const vertical = Math.abs(abx) <= epsilon && Math.abs(bcx) <= epsilon;
  if (!horizontal && !vertical) return false;
  const dot = abx * bcx + aby * bcy;
  if (dot >= -epsilon) return false;
  return horizontal
    ? intervalsOverlapByLength(a.x, b.x, b.x, c.x, epsilon)
    : intervalsOverlapByLength(a.y, b.y, b.y, c.y, epsilon);
}

export function intervalsOverlapByLength(a0, a1, b0, b1, epsilon = 0.001) {
  const left = Math.max(Math.min(a0, a1), Math.min(b0, b1));
  const right = Math.min(Math.max(a0, a1), Math.max(b0, b1));
  return right - left > epsilon;
}

export function endpointDirectionPenalty(path, endpoints, deps) {
  if (path.length < 2 || endpoints.length < 2) return 0;
  const first = firstSegmentVector(path, 0, 1, deps);
  const last = firstSegmentVector(path, path.length - 1, -1, deps);
  const startPenalty = directionPenalty(first, endpoints[0]?.normal, 1);
  const endPenalty = directionPenalty(last, endpoints[1]?.normal, 1);
  const leadPenalty = normalLeadPenalty(path, endpoints);
  return (startPenalty + endPenalty) * 10000 + leadPenalty * 10000;
}

export function normalLeadAnchor(point) {
  return point;
}

export function normalLeadPenalty(path, endpoints) {
  return endpoints.reduce((sum, endpoint, index) => {
    const lead = Math.max(0, Number(endpoint?.normalLeadLength ?? 0));
    const normal = unitNormal(endpoint?.normal);
    const boundary = endpoint?.boundaryPoint;
    const point = index === 0 ? firstLeadPoint(path, 0, 1) : firstLeadPoint(path, path.length - 1, -1);
    if (!normal || !boundary || !point || lead <= 0) return sum;
    const projection = (point.x - boundary.x) * normal.x + (point.y - boundary.y) * normal.y;
    return sum + Math.max(0, lead - projection);
  }, 0);
}

export function firstLeadPoint(path, index, step) {
  const origin = path[index];
  for (let i = index + step; i >= 0 && i < path.length; i += step) {
    const candidate = path[i];
    if (Math.hypot(candidate.x - origin.x, candidate.y - origin.y) > 0.001) return candidate;
  }
  return null;
}

export function firstSegmentVector(path, index, step, deps) {
  const origin = path[index];
  for (let i = index + step; i >= 0 && i < path.length; i += step) {
    const candidate = path[i];
    const length = deps.distance(origin, candidate);
    if (length > 0.001) {
      return {
        x: (candidate.x - origin.x) / length,
        y: (candidate.y - origin.y) / length,
      };
    }
  }
  return null;
}

export function directionPenalty(vector, normal, sign) {
  const unit = unitNormal(normal);
  if (!vector || !unit) return 0;
  const alignment = vector.x * unit.x * sign + vector.y * unit.y * sign;
  return Math.max(0, 1 - alignment);
}

export function unitNormal(normal) {
  if (!normal) return null;
  const length = Math.hypot(normal.x, normal.y);
  if (length <= 1e-9) return null;
  return { x: normal.x / length, y: normal.y / length };
}
