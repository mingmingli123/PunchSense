import { pathLength, snakePathStats } from "./stats.js?v=auto-workflow-pin-endpoint-final-v1-20260827";
import { pointsBounds } from "./geometry_helpers.js?v=auto-workflow-pin-endpoint-final-v1-20260827";
import {
  transposePoint,
  transposeSnakeBucket,
  transposeSnakeDeps,
} from "./orientation.js?v=auto-workflow-pin-endpoint-final-v1-20260827";
import {
  serpentineUniformityPenalty,
} from "./candidate_validation.js?v=auto-workflow-pin-endpoint-final-v1-20260827";
import {
  bestGuideDetourRow,
  guideDetourClearOfBlockedGrid,
  guideRowClearOfBlockedGrid,
} from "./guided_blocking.js?v=auto-workflow-pin-endpoint-final-v1-20260827";
import {
  appendGeneratedSnakePath,
  commonRowSpan,
  intervalsOverlap,
  nearestValue,
  removeConsecutiveDuplicatePoints,
  representativeSnakeRows,
  uniqueSortedNumbers,
} from "./row_utils.js?v=auto-workflow-pin-endpoint-final-v1-20260827";

export function createGuidedSerpentineBuilder({
  buildTpuSnakePath,
  buildTpuSnakePathInOrientation,
  parametricRowSets,
  parametricSerpentinePath,
}) {
  function guidedSerpentineFromPolyline(points, sourceBucket, c, deps) {
    const anchors = removeConsecutiveDuplicatePoints(points, deps);
    if (anchors.length < 2) return anchors;
    const baseLength = pathLength(anchors, deps);
    const target = Math.max(baseLength, Number(c.tpuSnakeTargetLength ?? baseLength));
    const extra = Math.max(0, target - baseLength);
    if (extra <= Math.max(0.5, Number(c.pitch ?? 1) * 0.25)) return anchors;
    const segments = [];
    for (let i = 1; i < anchors.length; i += 1) {
      const a = anchors[i - 1];
      const b = anchors[i];
      const length = deps.distance(a, b);
      if (length > 0.001) segments.push({ a, b, length });
    }
    const result = [];
    segments.forEach((segment) => {
      const segTarget = segment.length + extra * (segment.length / Math.max(baseLength, 0.001));
      const segmentPath = uniformTemplatePathBetweenPoints(segment.a, segment.b, segTarget, sourceBucket, c, deps);
      const cleaned = removeConsecutiveDuplicatePoints(segmentPath, deps);
      if (cleaned.length === 0) return;
      appendGeneratedSnakePath(result, result.length === 0 ? cleaned : cleaned.slice(deps.samePoint(result[result.length - 1], cleaned[0], 0.001) ? 1 : 0), deps);
    });
    return removeConsecutiveDuplicatePoints(result, deps);
  }

  function uniformTemplatePathBetweenPoints(a, b, target, sourceBucket, c, deps) {
    const endpoints = [
      { ...a, normal: null, boundaryPoint: { ...a }, normalLeadLength: 0 },
      { ...b, normal: null, boundaryPoint: { ...b }, normalLeadLength: 0 },
    ];
    const localDeps = { ...deps, endpoints };
    const snake = buildTpuSnakePath(sourceBucket, { ...c, tpuSnakeTargetLength: target, tpuSnakeNormalLeadLength: 0 }, localDeps, buildTpuSnakePathInOrientation);
    return snake.points ?? [];
  }

  function guidedChannelSerpentine(points, sourceBucket, c, deps) {
    const anchors = removeConsecutiveDuplicatePoints(points, deps);
    if (anchors.length < 2) return [];
    const guide = snakePathStats(anchors, deps);
    const horizontalDominant = guide.horizontal >= guide.vertical;
    const orientedBucket = horizontalDominant ? sourceBucket : transposeSnakeBucket(sourceBucket);
    const orientedDeps = horizontalDominant ? deps : transposeSnakeDeps(deps);
    const orientedPoints = horizontalDominant ? anchors : anchors.map(transposePoint);
    const path = guidedChannelSerpentineHorizontal(orientedPoints, orientedBucket, c, orientedDeps);
    return horizontalDominant ? path : path.map(transposePoint);
  }

  function guidedChannelSerpentineHorizontal(points, sourceBucket, c, deps) {
    const bounds = pointsBounds(points);
    const pitch = Math.max(0.001, Number(c.pitch ?? 1));
    const margin = Math.max(pitch * 1.25, Number(c.gridLineWidth ?? 0.4) * 3);
    const x0 = bounds.x - margin;
    const x1 = bounds.x + bounds.w + margin;
    const y0 = bounds.y - margin;
    const y1 = bounds.y + bounds.h + margin;
    const rows = representativeSnakeRows(
      (sourceBucket.horizontal ?? []).filter((segment) => (
        segment.y >= y0 - 0.001 && segment.y <= y1 + 0.001 && intervalsOverlap(segment.x0, segment.x1, x0, x1)
      )).map((segment) => ({
        ...segment,
        x0: Math.max(segment.x0, x0),
        x1: Math.min(segment.x1, x1),
      })),
      sourceBucket.vertical ?? [],
    ).filter((row) => row.x1 - row.x0 > pitch * 0.8);
    if (rows.length < 1) return [];
    const start = nearestPointOnRows(points[0], rows, deps);
    const end = nearestPointOnRows(points[points.length - 1], rows, deps);
    if (!start || !end) return [];
    const first = Math.min(start.rowIndex, end.rowIndex);
    const last = Math.max(start.rowIndex, end.rowIndex);
    const selectedRows = expandRowsForTarget(rows, first, last, start.point, end.point, c, deps);
    if (selectedRows.length < 1) return [];
    const orderedRows = start.rowIndex <= end.rowIndex ? selectedRows : selectedRows.slice().reverse();
    const orderedStart = start.rowIndex <= end.rowIndex ? start.point : end.point;
    const orderedEnd = start.rowIndex <= end.rowIndex ? end.point : start.point;
    const span = commonRowSpan(orderedRows);
    if (!span) return [];
    const path = parametricSerpentinePath(
      orderedRows,
      orderedStart,
      orderedEnd,
      span.x0,
      span.x1,
      chooseFirstSideForGuidedRows(orderedRows, orderedStart, deps),
      [{ ...orderedStart, normal: null, boundaryPoint: orderedStart }, { ...orderedEnd, normal: null, boundaryPoint: orderedEnd }],
      deps,
    );
    const oriented = start.rowIndex <= end.rowIndex ? path : path.slice().reverse();
    return removeConsecutiveDuplicatePoints(oriented, deps);
  }

  function nearestPointOnRows(point, rows, deps) {
    let best = null;
    rows.forEach((row, rowIndex) => {
      for (const x of row.gridXs ?? [row.x0, row.x1]) {
        if (x < row.x0 - 0.001 || x > row.x1 + 0.001) continue;
        const candidate = { x, y: row.y };
        const score = deps.distance(point, candidate);
        if (!best || score < best.score) best = { point: candidate, rowIndex, score };
      }
    });
    return best;
  }

  function expandRowsForTarget(rows, first, last, start, end, c, deps) {
    const target = Number(c.tpuSnakeTargetLength ?? 0);
    const baseCount = Math.max(1, last - first + 1);
    const pitch = Math.max(0.001, Number(c.pitch ?? 1));
    const roughWidth = Math.max(pitch, Math.min(...rows.slice(first, last + 1).map((row) => row.x1 - row.x0).filter((value) => value > 0.001)));
    const roughRows = target > 0 ? Math.max(baseCount, Math.round(target / Math.max(pitch, roughWidth + pitch))) : baseCount;
    const counts = uniqueSortedNumbers([baseCount, roughRows - 2, roughRows - 1, roughRows, roughRows + 1, roughRows + 2]
      .map((count) => Math.max(baseCount, Math.min(rows.length, count))));
    let best = null;
    for (const count of counts) {
      const minTop = Math.max(0, last - count + 1);
      const maxTop = Math.min(first, rows.length - count);
      const centeredTop = Math.round((first + last - count + 1) / 2);
      const topCandidates = uniqueSortedNumbers([minTop, maxTop, clampNumber(centeredTop, minTop, maxTop)]);
      for (const top of topCandidates) {
        const bottom = top + count - 1;
        const slice = rows.slice(top, bottom + 1);
        for (const sampled of parametricRowSets(slice)) {
          const span = commonRowSpan(sampled);
          if (!span || span.gridXs.length < 2) continue;
          if (start.x < span.x0 - 0.001 || start.x > span.x1 + 0.001) continue;
          if (end.x < span.x0 - 0.001 || end.x > span.x1 + 0.001) continue;
          const candidatePath = parametricSerpentinePath(
            first <= last ? sampled : sampled.slice().reverse(),
            start,
            end,
            span.x0,
            span.x1,
            chooseFirstSideForGuidedRows(sampled, start, deps),
            [{ ...start, normal: null, boundaryPoint: start }, { ...end, normal: null, boundaryPoint: end }],
            deps,
          );
          const length = pathLength(candidatePath, deps);
          const score = (target > 0 ? Math.abs(length - target) : Math.abs(sampled.length - (last - first + 1)))
            + serpentineUniformityPenalty(candidatePath, sampled, span, c) * 0.18;
          if (!best || score < best.score) best = { rows: sampled, score, length };
        }
      }
    }
    return best?.rows ?? rows.slice(first, last + 1);
  }

  function chooseFirstSideForGuidedRows(rows, start, deps) {
    const span = commonRowSpan(rows);
    if (!span) return start.x;
    return deps.distance(start, { x: span.x0, y: start.y }) <= deps.distance(start, { x: span.x1, y: start.y })
      ? span.x1
      : span.x0;
  }

  return {
    guidedChannelSerpentine,
    guidedSerpentineFromPolyline,
  };
}

export function guidedSerpentineForSegment(a, b, target, bucket, c, deps) {
  if (Math.abs(a.y - b.y) <= 0.001) {
    return guidedHorizontalSerpentine(a, b, target, bucket, c, deps);
  }
  if (Math.abs(a.x - b.x) <= 0.001) {
    const transposed = guidedHorizontalSerpentine(
      transposePoint(a),
      transposePoint(b),
      target,
      transposeSnakeBucket(bucket),
      c,
      transposeSnakeDeps(deps),
    );
    return transposed.map(transposePoint);
  }
  return [a, b];
}

function guidedHorizontalSerpentine(a, b, target, bucket, c, deps) {
  const x0 = Math.min(a.x, b.x);
  const x1 = Math.max(a.x, b.x);
  const span = x1 - x0;
  if (span <= 0.001) return [a, b];
  const extra = Math.max(0, target - span);
  if (extra <= 0.001) return [a, b];
  const mainY = a.y;
  const detourRows = uniqueSortedNumbers((bucket.horizontal ?? [])
    .filter((segment) => segment.x0 <= x0 + 0.001 && segment.x1 >= x1 - 0.001)
    .map((segment) => segment.y))
    .filter((y) => Math.abs(y - mainY) > 0.001)
    .filter((y) => guideRowClearOfBlockedGrid(y, x0, x1, deps.blockedSnakeBucket))
    .sort((yA, yB) => Math.abs(yA - mainY) - Math.abs(yB - mainY) || yA - yB);
  if (detourRows.length === 0) return [a, b];
  const detour = bestGuideDetourRow(detourRows, mainY, extra);
  if (!detour || !guideDetourClearOfBlockedGrid(x0, x1, mainY, detour, deps.blockedSnakeBucket)) return [a, b];
  const fence = guidedHorizontalFenceSerpentine(a, b, detour, target, bucket, deps);
  if (fence.length >= 2 && Math.abs(pathLength(fence, deps) - target) < Math.abs((span + Math.abs(detour - mainY) * 2) - target)) {
    return fence;
  }
  return removeConsecutiveDuplicatePoints([
    { ...a },
    { x: a.x, y: detour },
    { x: b.x, y: detour },
    { ...b },
  ], deps);
}

function guidedHorizontalFenceSerpentine(a, b, detourY, target, bucket, deps) {
  const x0 = Math.min(a.x, b.x);
  const x1 = Math.max(a.x, b.x);
  const mainY = a.y;
  const verticalXs = uniqueSortedNumbers([
    a.x,
    b.x,
    ...(bucket.vertical ?? [])
      .filter((segment) => segment.x >= x0 - 0.001 && segment.x <= x1 + 0.001)
      .filter((segment) => segment.y0 <= Math.min(mainY, detourY) + 0.001)
      .filter((segment) => segment.y1 >= Math.max(mainY, detourY) - 0.001)
      .map((segment) => segment.x),
  ]);
  if (verticalXs.length < 3) return [];
  const direction = b.x >= a.x ? 1 : -1;
  const ordered = direction > 0 ? verticalXs : verticalXs.slice().reverse();
  const startIndex = ordered.findIndex((x) => Math.abs(x - a.x) <= 0.001);
  const endIndex = ordered.findIndex((x) => Math.abs(x - b.x) <= 0.001);
  if (startIndex < 0 || endIndex < 0 || startIndex === endIndex) return [];
  const step = startIndex < endIndex ? 1 : -1;
  const usable = [];
  for (let i = startIndex; step > 0 ? i <= endIndex : i >= endIndex; i += step) usable.push(ordered[i]);
  if (usable.length < 3) return [];
  let best = null;
  const minCount = Math.min(3, usable.length);
  for (let count = minCount; count <= usable.length; count += 1) {
    const xs = usable.slice(0, count);
    if (Math.abs(xs[xs.length - 1] - b.x) > 0.001) xs.push(b.x);
    const path = [{ ...a }];
    let y = mainY;
    for (let i = 0; i < xs.length; i += 1) {
      const x = xs[i];
      path.push({ x, y });
      const nextY = Math.abs(y - mainY) <= 0.001 ? detourY : mainY;
      path.push({ x, y: nextY });
      y = nextY;
      if (i + 1 < xs.length) path.push({ x: xs[i + 1], y });
    }
    path.push({ x: b.x, y });
    if (Math.abs(y - b.y) > 0.001) path.push({ ...b });
    const cleaned = removeConsecutiveDuplicatePoints(path, deps);
    const length = pathLength(cleaned, deps);
    const score = Math.abs(length - target);
    if (!best || score < best.score) best = { path: cleaned, score };
  }
  return best?.path ?? [];
}

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
