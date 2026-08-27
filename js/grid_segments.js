import {
  polygonBounds,
  unionBounds,
} from "./core/geometry.js";

export function strandOffsets(c) {
  const offsets = [];
  const center = (c.gridLineCount - 1) / 2;
  for (let i = 0; i < c.gridLineCount; i += 1) offsets.push((i - center) * c.beadWidth);
  return offsets;
}

export function tpuSnakeEffectiveWidth(c) {
  return Math.max(Number(c.beadWidth ?? 0.4), Number(c.gridLineWidth ?? c.beadWidth ?? 0.4));
}

export function lineSegmentKey(segment, direction) {
  return direction === "horizontal"
    ? `h:${segment.y.toFixed(3)}:${segment.x0.toFixed(3)}:${segment.x1.toFixed(3)}`
    : `v:${segment.x.toFixed(3)}:${segment.y0.toFixed(3)}:${segment.y1.toFixed(3)}`;
}

export function materialSegmentBucket(result, material) {
  const key = Number(material);
  if (!result.has(key)) result.set(key, { horizontal: [], vertical: [], paths: [], solidPaths: [] });
  return result.get(key);
}

export function appendFramePathsWithBoundaryOwnership(bucket, paths, target = "paths", source = null) {
  if (!bucket || !Array.isArray(paths) || paths.length === 0) return;
  const cleanPaths = paths.map(cleanFramePath).filter((path) => path.length >= 2);
  if (cleanPaths.length === 0) return;
  trimBucketSegmentsByFramePaths(bucket, cleanPaths);
  const list = bucket[target] ?? [];
  const existing = new Set(list.map(canonicalPathSegmentKey));
  for (const path of cleanPaths) {
    const cloned = path.map((point) => ({ ...point }));
    if (source) cloned.source = source;
    const key = canonicalPathSegmentKey(cloned);
    if (existing.has(key)) continue;
    existing.add(key);
    list.push(cloned);
  }
  bucket[target] = list;
}

export function trimBucketSegmentsByFramePaths(bucket, paths) {
  const removals = framePathAxisRemovals(paths);
  if (removals.horizontal.length) bucket.horizontal = subtractMatchingAxisSpans(bucket.horizontal ?? [], removals.horizontal, "horizontal");
  if (removals.vertical.length) bucket.vertical = subtractMatchingAxisSpans(bucket.vertical ?? [], removals.vertical, "vertical");
}

function cleanFramePath(path) {
  const cleaned = [];
  for (const point of path ?? []) {
    if (!point || !Number.isFinite(Number(point.x)) || !Number.isFinite(Number(point.y))) continue;
    const normalized = { x: Number(point.x), y: Number(point.y) };
    const prev = cleaned[cleaned.length - 1];
    if (!prev || Math.abs(prev.x - normalized.x) > 0.001 || Math.abs(prev.y - normalized.y) > 0.001) cleaned.push(normalized);
  }
  return cleaned;
}

function framePathAxisRemovals(paths) {
  const horizontal = [];
  const vertical = [];
  for (const path of paths) {
    for (let i = 0; i < path.length - 1; i += 1) {
      const a = path[i];
      const b = path[i + 1];
      if (Math.abs(a.y - b.y) <= 0.001 && Math.abs(a.x - b.x) > 0.001) {
        horizontal.push({ coord: snapKey(a.y), start: Math.min(a.x, b.x), end: Math.max(a.x, b.x) });
      } else if (Math.abs(a.x - b.x) <= 0.001 && Math.abs(a.y - b.y) > 0.001) {
        vertical.push({ coord: snapKey(a.x), start: Math.min(a.y, b.y), end: Math.max(a.y, b.y) });
      }
    }
  }
  return { horizontal: mergeAxisRemovals(horizontal), vertical: mergeAxisRemovals(vertical) };
}

function mergeAxisRemovals(removals) {
  const byLine = new Map();
  for (const removal of removals) {
    if (!byLine.has(removal.coord)) byLine.set(removal.coord, []);
    byLine.get(removal.coord).push([removal.start, removal.end]);
  }
  const merged = [];
  for (const [coord, spans] of byLine) {
    for (const [start, end] of mergeSpans(spans)) merged.push({ coord, start, end });
  }
  return merged;
}

function subtractMatchingAxisSpans(segments, removals, direction) {
  const result = [];
  for (const segment of segments) {
    const coord = direction === "horizontal" ? snapKey(segment.y) : snapKey(segment.x);
    const start = direction === "horizontal" ? Math.min(segment.x0, segment.x1) : Math.min(segment.y0, segment.y1);
    const end = direction === "horizontal" ? Math.max(segment.x0, segment.x1) : Math.max(segment.y0, segment.y1);
    const matching = removals
      .filter((removal) => removal.coord === coord && removal.end > start + 0.001 && removal.start < end - 0.001)
      .map((removal) => [Math.max(start, removal.start), Math.min(end, removal.end)]);
    const kept = subtractIntervals([[start, end]], matching);
    for (const [keptStart, keptEnd] of kept) {
      if (keptEnd - keptStart <= 0.1) continue;
      result.push(direction === "horizontal"
        ? { ...segment, x0: keptStart, x1: keptEnd }
        : { ...segment, y0: keptStart, y1: keptEnd });
    }
  }
  return result;
}

function subtractIntervals(intervals, removals) {
  let parts = intervals.map(([start, end]) => [Math.min(start, end), Math.max(start, end)]);
  for (const [rawStart, rawEnd] of mergeSpans(removals)) {
    const cutStart = Math.min(rawStart, rawEnd);
    const cutEnd = Math.max(rawStart, rawEnd);
    const next = [];
    for (const [start, end] of parts) {
      if (cutEnd <= start + 0.001 || cutStart >= end - 0.001) {
        next.push([start, end]);
        continue;
      }
      if (cutStart > start + 0.001) next.push([start, Math.min(cutStart, end)]);
      if (cutEnd < end - 0.001) next.push([Math.max(cutEnd, start), end]);
    }
    parts = next;
    if (parts.length === 0) break;
  }
  return parts;
}

function canonicalPathSegmentKey(path) {
  const segments = [];
  for (let i = 0; i < path.length - 1; i += 1) {
    const a = `${snapKey(path[i].x)},${snapKey(path[i].y)}`;
    const b = `${snapKey(path[i + 1].x)},${snapKey(path[i + 1].y)}`;
    segments.push(a < b ? `${a}|${b}` : `${b}|${a}`);
  }
  return segments.sort().join(";");
}

function snapKey(value) {
  return Number(value).toFixed(3);
}

export function materialSegmentsAt(regions, value, direction, c, layerIndex = 1, materialResolver, outputValue = value) {
  const regionSpans = [];
  const breaks = [];
  for (const region of regions) {
    const hits = scanlineIntersections(region.polygon, value, direction).sort((a, b) => a - b);
    for (let i = 0; i < hits.length - 1; i += 2) {
      const a = hits[i];
      const b = hits[i + 1];
      if (b - a <= 0.1) continue;
      regionSpans.push({ a, b, region });
      breaks.push(a, b);
    }
  }
  if (breaks.length < 2) return [];
  const sortedBreaks = uniqueSortedBreaks(breaks);
  const rawSegments = [];
  for (let i = 0; i < sortedBreaks.length - 1; i += 1) {
    const a = sortedBreaks[i];
    const b = sortedBreaks[i + 1];
    if (b - a <= 0.1) continue;
    const mid = (a + b) / 2;
    const owner = topRegionAtSpan(regionSpans, mid);
    if (!owner) continue;
    const point = direction === "horizontal" ? { x: mid, y: value } : { x: value, y: mid };
    const material = materialResolver(point, regions, owner);
    rawSegments.push(direction === "horizontal"
      ? { y: outputValue, x0: a, x1: b, material }
      : { x: outputValue, y0: a, y1: b, material });
  }
  return mergeMaterialLineSegments(applyLayerBoundaryOverlap(rawSegments, direction, c, layerIndex), direction);
}

export function applyLayerBoundaryOverlap(segments, direction, c, layerIndex) {
  if (segments.length < 2 || c.materialOverlapWidth <= 0) return segments;
  const adjusted = segments.map((segment) => ({ ...segment }));
  for (let i = 0; i < adjusted.length - 1; i += 1) {
    const left = adjusted[i];
    const right = adjusted[i + 1];
    if (Number(left.material) === Number(right.material)) continue;
    if (Number(left.material) < 0 || Number(right.material) < 0) continue;
    const boundary = direction === "horizontal" ? left.x1 : left.y1;
    const winner = boundaryOverlapWinner(left.material, right.material, layerIndex);
    if (winner === Number(left.material)) {
      const amount = clampedOverlapAmount(right, direction, c.materialOverlapWidth);
      if (direction === "horizontal") {
        left.x1 = boundary + amount;
        right.x0 = boundary + amount;
      } else {
        left.y1 = boundary + amount;
        right.y0 = boundary + amount;
      }
    } else {
      const amount = clampedOverlapAmount(left, direction, c.materialOverlapWidth);
      if (direction === "horizontal") {
        left.x1 = boundary - amount;
        right.x0 = boundary - amount;
      } else {
        left.y1 = boundary - amount;
        right.y0 = boundary - amount;
      }
    }
  }
  return adjusted.filter((segment) => segmentLengthAlongDirection(segment, direction) > 0.1);
}

export function boundaryOverlapWinner(materialA, materialB, layerIndex) {
  const a = Number(materialA);
  const b = Number(materialB);
  const low = Math.min(a, b);
  const high = Math.max(a, b);
  return layerIndex % 2 === 1 ? low : high;
}

export function segmentLengthAlongDirection(segment, direction) {
  return direction === "horizontal" ? segment.x1 - segment.x0 : segment.y1 - segment.y0;
}

export function mergeMaterialLineSegments(segments, direction) {
  if (segments.length === 0) return [];
  const merged = [{ ...segments[0] }];
  for (const segment of segments.slice(1)) {
    const last = merged[merged.length - 1];
    const sameOwner = sameSegmentOwner(last, segment);
    if (direction === "horizontal" && sameOwner && Math.abs(last.x1 - segment.x0) <= 0.001) {
      last.x1 = segment.x1;
    } else if (direction === "vertical" && sameOwner && Math.abs(last.y1 - segment.y0) <= 0.001) {
      last.y1 = segment.y1;
    } else {
      merged.push({ ...segment });
    }
  }
  return merged;
}

export function normalizeMaterialLineSegments(segments, direction) {
  const sorted = segments
    .map((segment) => direction === "horizontal"
      ? { ...segment, x0: Math.min(segment.x0, segment.x1), x1: Math.max(segment.x0, segment.x1) }
      : { ...segment, y0: Math.min(segment.y0, segment.y1), y1: Math.max(segment.y0, segment.y1) })
    .filter((segment) => segmentLengthAlongDirection(segment, direction) > 0.1)
    .sort((a, b) => {
      if (direction === "horizontal") return (a.y - b.y) || (Number(a.material) - Number(b.material)) || (a.x0 - b.x0) || (a.x1 - b.x1);
      return (a.x - b.x) || (Number(a.material) - Number(b.material)) || (a.y0 - b.y0) || (a.y1 - b.y1);
    });
  const merged = [];
  for (const segment of sorted) {
    const last = merged[merged.length - 1];
    const sameOwner = last && sameSegmentOwner(last, segment);
    if (direction === "horizontal") {
      const sameLine = last && sameOwner && Math.abs(last.y - segment.y) <= 0.001;
      if (sameLine && segment.x0 <= last.x1 + 0.001) last.x1 = Math.max(last.x1, segment.x1);
      else merged.push({ ...segment });
    } else {
      const sameLine = last && sameOwner && Math.abs(last.x - segment.x) <= 0.001;
      if (sameLine && segment.y0 <= last.y1 + 0.001) last.y1 = Math.max(last.y1, segment.y1);
      else merged.push({ ...segment });
    }
  }
  return merged;
}

function sameSegmentOwner(a, b) {
  return Number(a.material) === Number(b.material)
    && ownerValue(a.source) === ownerValue(b.source)
    && ownerValue(a.parentShapeId) === ownerValue(b.parentShapeId)
    && ownerValue(a.shapeId) === ownerValue(b.shapeId)
    && ownerValue(a.pinId) === ownerValue(b.pinId)
    && ownerValue(a.rowId) === ownerValue(b.rowId);
}

function ownerValue(value) {
  return value === undefined ? null : value;
}

export function gridHorizontalSegmentsForPolygon(polygon, c) {
  const bounds = polygonBounds(polygon);
  const offsets = strandOffsets(c);
  const segments = [];
  for (let y = bounds.y; y <= bounds.y + bounds.h + 1e-6; y += c.pitch) {
    for (const offset of offsets) segments.push(...segmentsAt([polygon], y + offset, "horizontal"));
  }
  return segments;
}

export function gridVerticalSegmentsForPolygon(polygon, c) {
  const bounds = polygonBounds(polygon);
  const offsets = strandOffsets(c);
  const segments = [];
  for (let x = bounds.x; x <= bounds.x + bounds.w + 1e-6; x += c.pitch) {
    for (const offset of offsets) segments.push(...segmentsAt([polygon], x + offset, "vertical"));
  }
  return segments;
}

export function segmentsAt(polygons, value, direction, outputValue = value) {
  const spans = [];
  for (const polygon of polygons) {
    const hits = scanlineIntersections(polygon, value, direction).sort((a, b) => a - b);
    for (let i = 0; i < hits.length - 1; i += 2) spans.push([hits[i], hits[i + 1]]);
  }
  return mergeSpans(spans)
    .filter(([a, b]) => b - a > 0.1)
    .map(([a, b]) => direction === "horizontal" ? { y: outputValue, x0: a, x1: b } : { x: outputValue, y0: a, y1: b });
}

export function boundedScanValue(value, minValue, maxValue) {
  const epsilon = 1e-5;
  if (value >= maxValue - epsilon) return maxValue - epsilon;
  if (value <= minValue + epsilon) return minValue + epsilon;
  return value;
}

export function clippedHorizontalSegments(polygon, pitch) {
  const bounds = polygonBounds(polygon);
  const segments = [];
  for (let y = bounds.y; y <= bounds.y + bounds.h + 1e-6; y += pitch) {
    const xs = scanlineIntersections(polygon, y, "horizontal").sort((a, b) => a - b);
    for (let i = 0; i < xs.length - 1; i += 2) {
      if (xs[i + 1] - xs[i] > 0.1) segments.push({ y, x0: xs[i], x1: xs[i + 1] });
    }
  }
  return segments;
}

export function clippedHorizontalSegmentsUnion(polygons, pitch) {
  const bounds = unionBounds(polygons);
  const segments = [];
  for (let y = bounds.y; y <= bounds.y + bounds.h + 1e-6; y += pitch) {
    const spans = [];
    for (const polygon of polygons) {
      const xs = scanlineIntersections(polygon, y, "horizontal").sort((a, b) => a - b);
      for (let i = 0; i < xs.length - 1; i += 2) spans.push([xs[i], xs[i + 1]]);
    }
    for (const [x0, x1] of mergeSpans(spans)) {
      if (x1 - x0 > 0.1) segments.push({ y, x0, x1 });
    }
  }
  return segments;
}

export function clippedVerticalSegments(polygon, pitch) {
  const bounds = polygonBounds(polygon);
  const segments = [];
  for (let x = bounds.x; x <= bounds.x + bounds.w + 1e-6; x += pitch) {
    const ys = scanlineIntersections(polygon, x, "vertical").sort((a, b) => a - b);
    for (let i = 0; i < ys.length - 1; i += 2) {
      if (ys[i + 1] - ys[i] > 0.1) segments.push({ x, y0: ys[i], y1: ys[i + 1] });
    }
  }
  return segments;
}

export function clippedVerticalSegmentsUnion(polygons, pitch) {
  const bounds = unionBounds(polygons);
  const segments = [];
  for (let x = bounds.x; x <= bounds.x + bounds.w + 1e-6; x += pitch) {
    const spans = [];
    for (const polygon of polygons) {
      const ys = scanlineIntersections(polygon, x, "vertical").sort((a, b) => a - b);
      for (let i = 0; i < ys.length - 1; i += 2) spans.push([ys[i], ys[i + 1]]);
    }
    for (const [y0, y1] of mergeSpans(spans)) {
      if (y1 - y0 > 0.1) segments.push({ x, y0, y1 });
    }
  }
  return segments;
}

export function mergeSpans(spans) {
  if (spans.length === 0) return [];
  spans.sort((a, b) => a[0] - b[0]);
  const merged = [spans[0]];
  for (const span of spans.slice(1)) {
    const last = merged[merged.length - 1];
    if (span[0] <= last[1] + 0.01) last[1] = Math.max(last[1], span[1]);
    else merged.push(span);
  }
  return merged;
}

export function scanlineIntersections(polygon, value, direction) {
  const hits = [];
  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    if (direction === "horizontal") {
      if ((a.y <= value && b.y > value) || (b.y <= value && a.y > value)) {
        const t = (value - a.y) / (b.y - a.y);
        hits.push(a.x + t * (b.x - a.x));
      }
    } else if ((a.x <= value && b.x > value) || (b.x <= value && a.x > value)) {
      const t = (value - a.x) / (b.x - a.x);
      hits.push(a.y + t * (b.y - a.y));
    }
  }
  return hits;
}

export function gridAxisPositions(bounds, c, axis) {
  const start = axis === "x" ? bounds.x : bounds.y;
  const end = start + (axis === "x" ? bounds.w : bounds.h);
  return gridLinePositions(start, end, c);
}

export function gridLinePositions(start, end, c) {
  const positions = [];
  for (let base = start; base <= end + 1e-6; base += c.pitch) {
    for (const offset of strandOffsets(c)) positions.push(base + offset);
  }
  positions.push(start, end);
  return uniqueSortedBreaks(positions).filter((value) => value >= start - 0.001 && value <= end + 0.001);
}

export function trimHorizontalSegmentToGrid(segment, xs, c = null) {
  return trimHorizontalSegmentToGridWithRemoved(segment, xs, segment.material, c).kept;
}

export function trimVerticalSegmentToGrid(segment, ys, c = null) {
  return trimVerticalSegmentToGridWithRemoved(segment, ys, segment.material, c).kept;
}

export function trimHorizontalSegmentToGridWithRemoved(segment, xs, fillMaterial, c = null) {
  const intervals = completeGridIntervalsInRange(segment.x0, segment.x1, xs, c);
  if (intervals.length === 0) {
    return { kept: [], removed: [{ ...segment, material: fillMaterial }] };
  }
  const kept = intervals.map(([x0, x1]) => ({ ...segment, x0, x1 })).filter((item) => item.x1 - item.x0 > 0.1);
  const removed = removedSpansBetweenKept(segment.x0, segment.x1, intervals)
    .map(([x0, x1]) => ({ ...segment, x0, x1, material: fillMaterial }));
  return { kept, removed };
}

export function trimVerticalSegmentToGridWithRemoved(segment, ys, fillMaterial, c = null) {
  const intervals = completeGridIntervalsInRange(segment.y0, segment.y1, ys, c);
  if (intervals.length === 0) {
    return { kept: [], removed: [{ ...segment, material: fillMaterial }] };
  }
  const kept = intervals.map(([y0, y1]) => ({ ...segment, y0, y1 })).filter((item) => item.y1 - item.y0 > 0.1);
  const removed = removedSpansBetweenKept(segment.y0, segment.y1, intervals)
    .map(([y0, y1]) => ({ ...segment, y0, y1, material: fillMaterial }));
  return { kept, removed };
}

export function completeGridIntervalsInRange(start, end, axes, c = null) {
  const length = end - start;
  if (length <= 0.1 || axes.length < 2) return [];
  const pitch = Math.max(0.1, Number(c?.pitch ?? medianAxisPitch(axes) ?? 1));
  const tolerance = Math.max(Number(c?.beadWidth ?? 0.4), pitch * 0.25);
  const minOverlap = Math.min(pitch * 0.75, Math.max(0.1, length * 0.8));
  const raw = [];
  for (let i = 0; i < axes.length - 1; i += 1) {
    const a = axes[i];
    const b = axes[i + 1];
    if (b - a <= 0.1) continue;
    if (a < start - tolerance || b > end + tolerance) continue;
    const overlap = Math.min(b, end) - Math.max(a, start);
    const center = (a + b) / 2;
    if (overlap < minOverlap) continue;
    if (center < start - tolerance * 0.5 || center > end + tolerance * 0.5) continue;
    raw.push([a, b]);
  }
  return mergeNumericIntervals(raw);
}

export function medianAxisPitch(axes) {
  const deltas = [];
  for (let i = 1; i < axes.length; i += 1) {
    const d = axes[i] - axes[i - 1];
    if (d > 0.1) deltas.push(d);
  }
  if (deltas.length === 0) return null;
  deltas.sort((a, b) => a - b);
  return deltas[Math.floor(deltas.length / 2)];
}

export function mergeNumericIntervals(intervals) {
  if (intervals.length <= 1) return intervals;
  const sorted = intervals.slice().sort((a, b) => a[0] - b[0]);
  const merged = [sorted[0].slice()];
  for (const [a, b] of sorted.slice(1)) {
    const last = merged[merged.length - 1];
    if (a <= last[1] + 0.001) last[1] = Math.max(last[1], b);
    else merged.push([a, b]);
  }
  return merged;
}

export function removedSpansBetweenKept(start, end, keptIntervals) {
  const removed = [];
  let cursor = start;
  for (const [rawA, rawB] of keptIntervals) {
    const a = Math.max(start, rawA);
    const b = Math.min(end, rawB);
    if (a - cursor > 0.05) removed.push([cursor, a]);
    cursor = Math.max(cursor, b);
  }
  if (end - cursor > 0.1) removed.push([cursor, end]);
  return removed;
}

export function nearestEpiGridPoint(point, c) {
  const polygons = c.polygons?.length ? c.polygons : [];
  const bounds = polygons.length ? unionBounds(polygons) : { x: 0, y: 0, w: c.bedWidth, h: c.bedDepth };
  const xs = pureEpiLinePositions(bounds.x, bounds.x + bounds.w, c);
  const ys = pureEpiLinePositions(bounds.y, bounds.y + bounds.h, c);
  return {
    x: nearestNumericValue(xs, point.x),
    y: nearestNumericValue(ys, point.y),
  };
}

export function pureEpiLinePositions(start, end, c) {
  const positions = [];
  for (let value = start; value <= end + 1e-6; value += c.pitch) {
    positions.push(Number(value.toFixed(6)));
  }
  return positions;
}

export function nearestNumericValue(values, target) {
  if (!values.length) return target;
  let best = values[0];
  let bestDistance = Math.abs(best - target);
  for (const value of values.slice(1)) {
    const d = Math.abs(value - target);
    if (d < bestDistance) {
      best = value;
      bestDistance = d;
    }
  }
  return best;
}

export function simplifyPath(points, minDistance) {
  const result = [];
  for (const point of points) {
    const last = result[result.length - 1];
    if (!last || Math.hypot(point.x - last.x, point.y - last.y) >= minDistance) {
      result.push(point);
    }
  }
  return result;
}

function clampedOverlapAmount(segment, direction, requested) {
  const length = segmentLengthAlongDirection(segment, direction);
  return Math.max(0, Math.min(requested, Math.max(0, length * 0.5 - 0.05)));
}

export function uniqueSortedBreaks(values) {
  const sorted = values.slice().sort((a, b) => a - b);
  const result = [];
  for (const value of sorted) {
    const last = result[result.length - 1];
    if (last === undefined || Math.abs(value - last) > 0.001) result.push(value);
  }
  return result;
}

function topRegionAtSpan(regionSpans, value) {
  let best = null;
  for (const span of regionSpans) {
    if (value < span.a - 0.001 || value > span.b + 0.001) continue;
    const region = span.region;
    if (!best || region.area < best.area || (Math.abs(region.area - best.area) < 0.001 && region.order > best.order)) {
      best = region;
    }
  }
  return best;
}
