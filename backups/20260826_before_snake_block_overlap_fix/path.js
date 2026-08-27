import { pathLength, snakePathStats } from "./stats.js?v=auto-workflow-xiao-d2-pin-order-v1-20260826";
import {
  pointsBounds,
} from "./geometry_helpers.js?v=auto-workflow-xiao-d2-pin-order-v1-20260826";
import {
  clipHorizontalSegmentsToRect,
  clipVerticalSegmentsToRect,
  subtractBlockedHorizontalSegments,
  subtractBlockedVerticalSegments,
  tpuConnectorCorridorRect,
} from "./corridor.js?v=auto-workflow-xiao-d2-pin-order-v1-20260826";
import {
  subtractSnakeHorizontalCrossingsFromVerticalSegments,
  subtractSnakeHorizontalFromSegments,
  subtractSnakeVerticalCrossingsFromHorizontalSegments,
  subtractSnakeVerticalFromSegments,
} from "./segment_subtract.js?v=auto-workflow-xiao-d2-pin-order-v1-20260826";
import {
  firstSnakeClearanceConflict,
  firstSnakeOccupancyConflict,
  mergeSnakeBuckets,
} from "./conflicts.js?v=auto-workflow-xiao-d2-pin-order-v1-20260826";
import {
  addEndpointLeadSegments,
  endpointGridLeadLength,
  pathConnectsEndpoints,
  resolveEndpointOnBoundaryGrid,
  withCurrentLeadLength,
} from "./endpoints.js?v=auto-workflow-xiao-d2-pin-order-v1-20260826";
import {
  buildConnectionSnakePaths,
  normalizedSnakeConnections,
} from "./connections.js?v=auto-workflow-xiao-d2-pin-order-v1-20260826";
import { buildTpuSnakePath } from "./candidates.js?v=auto-workflow-xiao-d2-pin-order-v1-20260826";
import { buildGuidedSnakePath } from "./guided_path.js?v=auto-workflow-xiao-d2-pin-order-v1-20260826";
import {
  betterParametricCandidate,
  endpointDirectionPenalty,
  hasImmediateBacktracking,
  hasRepeatedGridEdge,
  normalLeadAnchor,
  serpentineUniformityPenalty,
  unitNormal,
} from "./candidate_validation.js?v=auto-workflow-xiao-d2-pin-order-v1-20260826";
import {
  appendGeneratedSnakePath,
  appendGeneratedSnakePoint,
  commonRowSpan,
  mergeBucketLineSegments,
  nearestValue,
  orthogonalEndpointConnector,
  removeConsecutiveDuplicatePoints,
  representativeSnakeRows,
  serpentinePathFromRows,
  uniqueSortedNumbers,
} from "./row_utils.js?v=auto-workflow-xiao-d2-pin-order-v1-20260826";
import {
  createGuidedSerpentineBuilder,
} from "./guided_builder.js?v=auto-workflow-xiao-d2-pin-order-v1-20260826";
import {
  createGuidedPathHelpers,
} from "./guided_helpers.js?v=auto-workflow-xiao-d2-pin-order-v1-20260826";
const ENABLE_GLOBAL_SNAKE_FALLBACK = false;

export function tpuSnakePlanningCorridors(c, deps, connections = null) {
  const activeConnections = Array.isArray(connections)
    ? connections
    : normalizedSnakeConnections(c, deps);
  return activeConnections
    .map((connection) => ({
      connection,
      local: tpuConnectorCorridorRect(c, deps, connection),
    }))
    .filter((item) => item.local);
}

export function applyTpuSnakeToMaterialSegments(result, c, layerIndex, deps) {
  if (!c.tpuSnakeEnabled) return result;
  if (layerIndex === 1) return result;
  const snakeLayerCount = Math.max(0, Number(c.tpuSnakeLayerCount ?? 0));
  const firstSnakeLayer = Math.max(2, Number(c.bottomLayerCount ?? 1) + 1);
  if (snakeLayerCount <= 0 || layerIndex < firstSnakeLayer) return result;
  const tpuBucket = result.get(0);
  deps.setSnakeConflict?.(null);
  const connections = normalizedSnakeConnections(c, deps);
  if (connections.length === 0 || !tpuBucket) return result;
  const snakes = buildConnectionSnakePaths(c, deps, connections, result, layerIndex, snakePathPlanners());
  const snakePaths = snakes.map((snake) => snake.points).filter((path) => path.length >= 2);
  if (snakePaths.length === 0) return result;
  const printableSnakePaths = snakePaths
    .flatMap((path) => deps.printableTpuSnakePaths ? deps.printableTpuSnakePaths(path, c) : [path])
    .filter((path) => path.length >= 2);
  const snakeWidth = Math.max(Number(c.beadWidth ?? 0.4), Number(c.gridLineWidth ?? c.beadWidth ?? 0.4));
  const contactOverlap = Math.max(Number(c.materialOverlapWidth ?? 0), snakeWidth * 0.5);
  const cornerRelief = Boolean(c.tpuSnakeCornerRelief)
    ? Math.max(Number(c.beadWidth ?? 0.4) * 1.5, Math.min(Number(c.pitch ?? 2), Number(c.beadWidth ?? 0.4) * 3))
    : 0;
  const topSnakeLayer = Math.min(
    Math.max(1, Number(c.baseLayerCount ?? 1)),
    firstSnakeLayer + snakeLayerCount - 1
  );
  if (layerIndex > topSnakeLayer) return result;
  for (const [material, bucket] of result) {
    if (Number(material) === 0) continue;
    for (const path of printableSnakePaths) {
      bucket.horizontal = subtractSnakeHorizontalFromSegments(bucket.horizontal, path, contactOverlap, cornerRelief);
      bucket.vertical = subtractSnakeVerticalFromSegments(bucket.vertical, path, contactOverlap, cornerRelief);
      if (!c.tpuSnakeAllowCrossings) {
        bucket.horizontal = subtractSnakeVerticalCrossingsFromHorizontalSegments(bucket.horizontal, path, contactOverlap);
        bucket.vertical = subtractSnakeHorizontalCrossingsFromVerticalSegments(bucket.vertical, path, contactOverlap);
      }
    }
  }
  deps.materialSegmentBucket(result, 0).paths = snakePaths;
  mergeAllMaterialBuckets(result, deps);
  return result;
}

export function mergeAllMaterialBuckets(result, deps) {
  for (const bucket of result.values()) {
    bucket.horizontal = mergeBucketLineSegments(bucket.horizontal, "horizontal", deps);
    bucket.vertical = mergeBucketLineSegments(bucket.vertical, "vertical", deps);
  }
}

export { snakePathStats };

function snakePathPlanners() {
  return {
    buildGuidedSnakePath: buildGuidedSnakePathWithHelpers,
    buildTpuSnakePathInOrientation,
    enableGlobalFallback: ENABLE_GLOBAL_SNAKE_FALLBACK,
    representativeSnakeRows,
    unionSnakeBucket,
  };
}

function buildGuidedSnakePathWithHelpers(guidePoints, sourceBucket, c, deps) {
  const { guidedSerpentineFromPolyline } = createGuidedSerpentineBuilder({
    buildTpuSnakePath,
    buildTpuSnakePathInOrientation,
    parametricRowSets,
    parametricSerpentinePath,
  });
  return buildGuidedSnakePath(guidePoints, sourceBucket, c, deps, createGuidedPathHelpers({
    guidedSerpentineFromPolyline,
  }));
}

function unionSnakeBucket(c, deps, connection = null, blockedBucket = null, options = {}) {
  const corridor = options.fullPrintable
    ? deps.unionBounds(c.polygons)
    : tpuConnectorCorridorRect(c, deps, connection);
  const horizontal = clipHorizontalSegmentsToRect(deps.gridHorizontalSegmentsUnion(c), corridor)
    .map((segment) => ({ ...segment, material: 0 }));
  const vertical = clipVerticalSegmentsToRect(deps.gridVerticalSegmentsUnion(c), corridor)
    .map((segment) => ({ ...segment, material: 0 }));
  return {
    horizontal: blockedBucket ? subtractBlockedHorizontalSegments(horizontal, blockedBucket.horizontal ?? []) : horizontal,
    vertical: blockedBucket ? subtractBlockedVerticalSegments(vertical, blockedBucket.vertical ?? []) : vertical,
    paths: [],
  };
}

export { subtractSnakeHorizontalFromSegments, subtractSnakeVerticalFromSegments };

function buildTpuSnakePathInOrientation(tpuBucket, c, deps) {
  const rows = representativeSnakeRows(tpuBucket.horizontal, tpuBucket.vertical);
  if (rows.length === 0) return { points: [], usedHorizontalKeys: [] };
  const strictEndpoints = Array.isArray(deps.endpoints) && deps.endpoints.length >= 2;
  const endpoints = normalizedSnakeEndpoints(c, rows, deps);
  const candidate = bestSerpentineCandidate(rows, tpuBucket, c, deps);
  if (strictEndpoints && (!candidate || !pathConnectsEndpoints(candidate.path, endpoints, deps, c))) {
    return { points: [], usedHorizontalKeys: [] };
  }
  const path = candidate?.path ?? serpentinePathFromRows(rows, deps);
  const usedRows = candidate?.rows ?? rows;
  const points = finalizeSnakePath(path, endpoints, deps, c);
  if (points.length < 2) return { points: [], usedHorizontalKeys: [] };
  return {
    points,
    usedHorizontalKeys: usedRows.map((row) => deps.lineSegmentKey(row, "horizontal")),
  };
}

function finalizeSnakePath(path, endpoints, deps, c) {
  const cleanPath = removeConsecutiveDuplicatePoints(path, deps);
  const orientedPath = orientPathToStrictEndpoints(cleanPath, endpoints, deps);
  const withLeads = addEndpointLeadSegments(orientedPath, endpoints, deps, c);
  const clean = removeConsecutiveDuplicatePoints(withLeads, deps);
  if (hasImmediateBacktracking(clean)) return [];
  if (hasRepeatedGridEdge(clean)) return [];
  return clean;
}

function orientPathToStrictEndpoints(path, endpoints, deps) {
  if (!path?.length || !Array.isArray(endpoints) || endpoints.length < 2) return path;
  const first = path[0];
  const last = path[path.length - 1];
  const direct = deps.distance(first, endpoints[0]) + deps.distance(last, endpoints[1]);
  const reversed = deps.distance(first, endpoints[1]) + deps.distance(last, endpoints[0]);
  return reversed + 0.001 < direct ? path.slice().reverse() : path;
}

function bestSerpentineCandidate(rows, sourceBucket, c, deps) {
  const target = c.tpuSnakeTargetLength;
  const endpoints = normalizedSnakeEndpoints(c, rows, deps);
  const strictEndpoints = Array.isArray(deps.endpoints) && deps.endpoints.length >= 2;
  if (strictEndpoints) {
    const parametric = bestParametricSerpentineCandidate(rows, sourceBucket, c, endpoints, target, deps);
    if (parametric && pathConnectsEndpoints(parametric.path, endpoints, deps, c)) return parametric;
    return null;
  }
  if (endpoints.length >= 2) {
    const parametric = bestParametricSerpentineCandidate(rows, sourceBucket, c, endpoints, target, deps);
    if (parametric) return parametric;
    return null;
  }
  if (target <= 0) {
    const path = orientPathToEndpoint(serpentinePathFromRows(rows, deps), endpoints[0], deps);
    if (firstSnakeOccupancyConflict(path, sourceBucket, deps.occupiedSnakeBucket, { endpoints }, c)) return null;
    if (firstSnakeClearanceConflict(path, sourceBucket, deps.blockedSnakeBucket, c, endpoints, deps)) return null;
    return { rows, path, length: pathLength(path, deps) };
  }
  let best = null;
  for (let start = 0; start < rows.length; start += 1) {
    for (let end = start; end < rows.length; end += 1) {
      const slice = rows.slice(start, end + 1);
      for (const variantRows of [slice, slice.slice().reverse()]) {
        const candidatePaths = serpentineCandidatePathsForRows(variantRows, c, endpoints, deps);
        for (const path of candidatePaths) {
          if (firstSnakeOccupancyConflict(path, sourceBucket, deps.occupiedSnakeBucket, { endpoints }, c)) continue;
          if (firstSnakeClearanceConflict(path, sourceBucket, deps.blockedSnakeBucket, c, endpoints, deps)) continue;
          const length = pathLength(path, deps);
          const endpointCost = endpoints.length >= 2
            ? Math.min(
              deps.distance(path[0], endpoints[0]) + deps.distance(path[path.length - 1], endpoints[1]),
              deps.distance(path[0], endpoints[1]) + deps.distance(path[path.length - 1], endpoints[0]),
            )
            : endpoints[0]
              ? Math.min(deps.distance(path[0], endpoints[0]), deps.distance(path[path.length - 1], endpoints[0]))
              : 0;
          const score = Math.abs(length - target)
            + endpointCost * 0.15
            + endpointDirectionPenalty(path, endpoints, deps);
          if (!best || score < best.score) best = { rows: variantRows, path, length, score };
        }
      }
    }
  }
  return best;
}

function bestParametricSerpentineCandidate(rows, sourceBucket, c, endpoints, target, deps) {
  const startLead = leadPointForEndpoint(endpoints[0], rows, c, deps);
  const endLead = leadPointForEndpoint(endpoints[1], rows, c, deps);
  if (!startLead || !endLead) return null;
  const first = Math.min(startLead.rowIndex, endLead.rowIndex);
  const last = Math.max(startLead.rowIndex, endLead.rowIndex);
  const rowSlice = rows.slice(first, last + 1);
  const start = { ...startLead.point, normal: endpoints[0].normal, boundaryPoint: endpoints[0].boundaryPoint };
  const end = { ...endLead.point, normal: endpoints[1].normal, boundaryPoint: endpoints[1].boundaryPoint };
  let best = null;

  best = betterParametricCandidate(
    best,
    evaluateUniformTemplateRowWindow(rowSlice, startLead, endLead, start, end, endpoints, sourceBucket, c, deps),
  );
  if (!parametricCandidateNeedsExpansion(best, target, c, deps)) return best;
  for (const rowWindow of expandedLocalRowWindows(rows, first, last, target, c)) {
    best = betterParametricCandidate(
      best,
      evaluateUniformTemplateRowWindow(rowWindow, startLead, endLead, start, end, endpoints, sourceBucket, c, deps),
    );
  }
  return best;
}

function evaluateUniformTemplateRowWindow(rowWindow, startLead, endLead, start, end, endpoints, sourceBucket, c, deps) {
  if (rowWindow.length < 3) return null;
  const target = Number(c.tpuSnakeTargetLength ?? 0);
  const pitch = Math.max(0.001, Number(c.pitch ?? 1));
  const orderedBase = startLead.rowIndex <= endLead.rowIndex ? rowWindow : rowWindow.slice().reverse();
  const fullSpan = commonRowSpan(orderedBase);
  if (!fullSpan || fullSpan.gridXs.length < 2) return null;
  let best = null;
  const stepLimit = Math.min(8, Math.max(1, orderedBase.length - 1));
  for (let rowStep = 1; rowStep <= stepLimit; rowStep += 1) {
    const rows = evenlySampleRows(orderedBase, rowStep);
    if (rows.length < 3) continue;
    const span = commonRowSpan(rows);
    if (!span || span.gridXs.length < 2) continue;
    if (start.x < span.x0 - 0.001 || start.x > span.x1 + 0.001) continue;
    if (end.x < span.x0 - 0.001 || end.x > span.x1 + 0.001) continue;
    const verticalLength = Math.abs(rows[rows.length - 1].y - rows[0].y);
    const desiredWidth = target > 0
      ? Math.max(pitch, (target - verticalLength) / Math.max(1, rows.length))
      : Math.max(pitch, Math.abs(end.x - start.x));
    best = betterParametricCandidate(
      best,
      evaluateProjectedBodyRectCandidate(rows, start, end, endpoints, sourceBucket, c, deps, desiredWidth, orderedBase),
    );
    for (const [left, right] of uniformTemplateSpanPairs(span, start, end, desiredWidth, c)) {
      for (const firstSide of [left, right]) {
        const path = parametricSerpentinePath(rows, start, end, left, right, firstSide, endpoints, deps);
        if (path.length < 2) continue;
        if (hasImmediateBacktracking(path)) continue;
        if (hasRepeatedGridEdge(path)) continue;
        if (firstSnakeOccupancyConflict(path, sourceBucket, deps.occupiedSnakeBucket, { endpoints }, c)) continue;
        if (firstSnakeClearanceConflict(path, sourceBucket, deps.blockedSnakeBucket, c, endpoints, deps)) continue;
        const length = pathLength(path, deps);
        const lengthError = target > 0 ? Math.abs(length - target) : length;
        const tailPenalty = endpointTailPenalty(path, endpoints, c, deps);
        const coveragePenalty = uniformCoveragePenalty(path, rows, orderedBase, c);
        const centerPenalty = uniformCenterPenalty(left, right, start, end);
        const score = lengthError + tailPenalty * 0.75 + coveragePenalty * 0.35 + centerPenalty * 0.5;
        best = betterParametricCandidate(best, { rows, path, length, score, uniformTemplate: true });
      }
    }
  }
  return best;
}

function evenlySampleRows(rows, step) {
  if (step <= 1) return rows;
  const sampled = [];
  for (let i = 0; i < rows.length; i += step) sampled.push(rows[i]);
  if (sampled[sampled.length - 1] !== rows[rows.length - 1]) sampled.push(rows[rows.length - 1]);
  return sampled;
}

function evaluateProjectedBodyRectCandidate(rows, start, end, endpoints, sourceBucket, c, deps, desiredWidth, orderedBase) {
  const bodyRows = detachedInteriorRows(rows, c);
  if (bodyRows.length < 3) return null;
  const cleanRows = bodyRows.slice().sort((a, b) => a.y - b.y);
  const startToFirst = Math.abs(start.y - cleanRows[0].y);
  const startToLast = Math.abs(start.y - cleanRows[cleanRows.length - 1].y);
  const orderedRows = startToFirst <= startToLast ? cleanRows : cleanRows.slice().reverse();
  const span = commonRowSpan(orderedRows);
  if (!span || span.gridXs.length < 2) return null;
  if (start.x < span.x0 - 0.001 || start.x > span.x1 + 0.001) return null;
  if (end.x < span.x0 - 0.001 || end.x > span.x1 + 0.001) return null;
  const entry = { ...start, x: nearestValue(span.gridXs, start.x), y: orderedRows[0].y };
  const exit = { ...end, x: nearestValue(span.gridXs, end.x), y: orderedRows[orderedRows.length - 1].y };
  let best = null;
  for (const [left, right] of projectedBodySpanPairs(span, entry, exit, desiredWidth, c)) {
    for (const firstSide of [left, right]) {
      const path = parametricSerpentinePath(orderedRows, entry, exit, left, right, firstSide, endpoints, deps);
      if (path.length < 2) continue;
      if (hasImmediateBacktracking(path)) continue;
      if (hasRepeatedGridEdge(path)) continue;
      if (firstSnakeOccupancyConflict(path, sourceBucket, deps.occupiedSnakeBucket, { endpoints }, c)) continue;
      if (firstSnakeClearanceConflict(path, sourceBucket, deps.blockedSnakeBucket, c, endpoints, deps)) continue;
      const length = pathLength(path, deps);
      const target = Number(c.tpuSnakeTargetLength ?? 0);
      const lengthError = target > 0 ? Math.abs(length - target) : length;
      const verticalConnectorPenalty = Math.abs(entry.y - start.y) + Math.abs(exit.y - end.y);
      const coveragePenalty = uniformCoveragePenalty(path, orderedRows, orderedBase, c);
      const centerPenalty = uniformCenterPenalty(left, right, entry, exit);
      const score = lengthError + verticalConnectorPenalty * 0.02 + coveragePenalty * 0.35 + centerPenalty * 0.25;
      best = betterParametricCandidate(best, { rows: orderedRows, path, length, score, projectedBody: true, uniformTemplate: true });
    }
  }
  return best;
}

function projectedBodySpanPairs(span, start, end, desiredWidth, c) {
  const xs = span.gridXs ?? [];
  const pitch = Math.max(0.001, Number(c.pitch ?? 1));
  const minRequired = Math.max(Math.abs(end.x - start.x), pitch);
  const centerLine = (start.x + end.x) / 2;
  const usableWidth = Math.max(pitch, span.x1 - span.x0);
  const widths = uniqueSortedNumbers([
    desiredWidth * 0.75,
    desiredWidth,
    desiredWidth * 1.25,
    minRequired + pitch * 2,
    usableWidth * 0.5,
    usableWidth * 0.75,
    usableWidth,
  ].map((width) => Math.max(minRequired, Math.min(usableWidth, width))));
  const centers = uniqueSortedNumbers([
    centerLine,
    nearestValue(xs, centerLine),
    span.x0 + usableWidth / 2,
    span.x0 + usableWidth * 0.33,
    span.x0 + usableWidth * 0.67,
  ]);
  const pairs = [];
  const seen = new Set();
  const add = (left, right) => {
    const l = nearestValue(xs, Math.max(span.x0, Math.min(left, right)));
    const r = nearestValue(xs, Math.min(span.x1, Math.max(left, right)));
    if (r - l < pitch * 0.8) return;
    if (start.x < l - 0.001 || start.x > r + 0.001) return;
    if (end.x < l - 0.001 || end.x > r + 0.001) return;
    const key = `${l.toFixed(3)}:${r.toFixed(3)}`;
    if (seen.has(key)) return;
    seen.add(key);
    pairs.push([l, r]);
  };
  for (const center of centers) {
    for (const width of widths) add(center - width / 2, center + width / 2);
  }
  add(span.x0, span.x1);
  return pairs.slice(0, 36);
}

function uniformTemplateSpanPairs(span, start, end, desiredWidth, c) {
  const xs = span.gridXs ?? [];
  const pitch = Math.max(0.001, Number(c.pitch ?? 1));
  const minRequired = Math.max(Math.abs(end.x - start.x), pitch);
  const centerLine = (start.x + end.x) / 2;
  const maxBalancedHalfWidth = Math.max(
    pitch * 0.5,
    Math.min(centerLine - span.x0, span.x1 - centerLine)
  );
  const widths = uniqueSortedNumbers([
    desiredWidth * 0.75,
    desiredWidth,
    desiredWidth * 1.25,
    maxBalancedHalfWidth * 2,
    Math.min(maxBalancedHalfWidth * 2, desiredWidth + pitch * 2),
    minRequired,
    Math.min(span.x1 - span.x0, desiredWidth + pitch * 2),
  ].map((width) => Math.max(minRequired, Math.min(span.x1 - span.x0, width))));
  const centers = uniqueSortedNumbers([
    centerLine,
    nearestValue(xs, centerLine),
    start.x,
    end.x,
    span.x0 + (span.x1 - span.x0) / 2,
  ]);
  const pairs = [];
  const seen = new Set();
  const add = (left, right) => {
    const l = nearestValue(xs, Math.max(span.x0, Math.min(left, right)));
    const r = nearestValue(xs, Math.min(span.x1, Math.max(left, right)));
    if (r - l < pitch * 0.8) return;
    if (start.x < l - 0.001 || start.x > r + 0.001) return;
    if (end.x < l - 0.001 || end.x > r + 0.001) return;
    const key = `${l.toFixed(3)}:${r.toFixed(3)}`;
    if (seen.has(key)) return;
    seen.add(key);
    pairs.push([l, r]);
  };
  for (const width of widths) {
    const balancedWidth = Math.min(width, maxBalancedHalfWidth * 2);
    if (balancedWidth >= minRequired - 0.001) add(centerLine - balancedWidth / 2, centerLine + balancedWidth / 2);
  }
  for (const center of centers) {
    for (const width of widths) add(center - width / 2, center + width / 2);
  }
  add(span.x0, span.x1);
  return pairs.slice(0, 24);
}

function uniformCenterPenalty(left, right, start, end) {
  const spanCenter = (left + right) / 2;
  const lineCenter = (start.x + end.x) / 2;
  return Math.abs(spanCenter - lineCenter);
}

function endpointTailPenalty(path, endpoints, c, deps) {
  if (path.length < 3 || endpoints.length < 2) return 0;
  const pitch = Math.max(0.001, Number(c.pitch ?? 1));
  const startTail = deps.distance(path[0], path[1] ?? path[0]);
  const endTail = deps.distance(path[path.length - 2] ?? path[path.length - 1], path[path.length - 1]);
  return Math.max(0, startTail - pitch * 4) + Math.max(0, endTail - pitch * 4);
}

function uniformCoveragePenalty(path, sampledRows, allRows, c) {
  if (!path?.length || sampledRows.length < 2 || allRows.length < 2) return 0;
  const pitch = Math.max(0.001, Number(c.pitch ?? 1));
  const bounds = pointsBounds(path);
  const y0 = Math.min(allRows[0].y, allRows[allRows.length - 1].y);
  const y1 = Math.max(allRows[0].y, allRows[allRows.length - 1].y);
  const requiredHeight = Math.max(pitch, (y1 - y0) * 0.78);
  const heightPenalty = Math.max(0, requiredHeight - bounds.h);
  const rowGaps = [];
  const sorted = sampledRows.slice().sort((a, b) => a.y - b.y);
  for (let i = 1; i < sorted.length; i += 1) rowGaps.push(sorted[i].y - sorted[i - 1].y);
  const mean = rowGaps.reduce((sum, gap) => sum + gap, 0) / Math.max(1, rowGaps.length);
  const gapPenalty = rowGaps.reduce((sum, gap) => sum + Math.abs(gap - mean), 0);
  return heightPenalty + gapPenalty * 0.5;
}

function evaluateParametricRowWindow(rowWindow, startLead, endLead, start, end, endpoints, sourceBucket, c, deps) {
  let best = null;
  for (const sampledRows of parametricRowSets(rowWindow)) {
    const orderedRows = startLead.rowIndex <= endLead.rowIndex ? sampledRows : sampledRows.slice().reverse();
    const span = commonRowSpan(orderedRows);
    if (!span || span.gridXs.length < 2) continue;
    const xs = span.gridXs.filter((x) => (
      x <= Math.min(start.x, end.x) + 0.001 || x >= Math.max(start.x, end.x) - 0.001
    ));
    const candidateXs = xs.length >= 2 ? xs : span.gridXs;
    for (let leftIndex = 0; leftIndex < candidateXs.length - 1; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < candidateXs.length; rightIndex += 1) {
        const left = candidateXs[leftIndex];
        const right = candidateXs[rightIndex];
        if (start.x < left - 0.001 || start.x > right + 0.001) continue;
        if (end.x < left - 0.001 || end.x > right + 0.001) continue;
        for (const firstSide of [left, right]) {
          const path = parametricSerpentinePath(orderedRows, start, end, left, right, firstSide, endpoints, deps);
          if (path.length < 2) continue;
          if (hasImmediateBacktracking(path)) continue;
          if (hasRepeatedGridEdge(path)) continue;
          if (firstSnakeOccupancyConflict(path, sourceBucket, deps.occupiedSnakeBucket, { endpoints }, c)) continue;
          if (firstSnakeClearanceConflict(path, sourceBucket, deps.blockedSnakeBucket, c, endpoints, deps)) continue;
          const length = pathLength(path, deps);
          const target = Number(c.tpuSnakeTargetLength ?? 0);
          const score = (target > 0 ? Math.abs(length - target) : length)
            + serpentineUniformityPenalty(path, orderedRows, { x0: left, x1: right, gridXs: candidateXs }, c) * 0.18;
          best = betterParametricCandidate(best, { rows: orderedRows, path, length, score });
        }
      }
    }
  }
  return best;
}

function evaluateDetachedRectRowWindow(rowWindow, startLead, endLead, start, end, endpoints, sourceBucket, c, deps) {
  let best = null;
  const interiorWindow = detachedInteriorRows(rowWindow, c);
  for (const sampledRows of detachedRectRowSets(interiorWindow, c)) {
    const orderedRows = startLead.rowIndex <= endLead.rowIndex ? sampledRows : sampledRows.slice().reverse();
    const span = commonRowSpan(orderedRows);
    if (!span || span.gridXs.length < 2) continue;
    for (const [left, right] of detachedRectSpanCandidates(span, start, end, c)) {
      for (const entrySide of [left, right]) {
        const path = detachedRectSerpentinePath(orderedRows, left, right, entrySide, endpoints, c, deps);
        if (path.length < 2) continue;
        if (hasImmediateBacktracking(path)) continue;
        if (hasRepeatedGridEdge(path)) continue;
        if (firstSnakeOccupancyConflict(path, sourceBucket, deps.occupiedSnakeBucket, { endpoints }, c)) continue;
        if (firstSnakeClearanceConflict(path, sourceBucket, deps.blockedSnakeBucket, c, endpoints, deps)) continue;
        const length = pathLength(path, deps);
        const target = Number(c.tpuSnakeTargetLength ?? 0);
        const connectorCost = deps.distance(endpoints[0], path[1] ?? path[0]) + deps.distance(endpoints[1], path[path.length - 2] ?? path[path.length - 1]);
        const score = (target > 0 ? Math.abs(length - target) : length)
          + connectorCost * 0.03
          + serpentineUniformityPenalty(path, orderedRows, { x0: left, x1: right, gridXs: span.gridXs }, c) * 0.18;
        best = betterParametricCandidate(best, { rows: orderedRows, path, length, score });
      }
    }
  }
  return best;
}

function detachedRectRowSets(rows, c) {
  if (rows.length < 2) return [];
  const target = Number(c.tpuSnakeTargetLength ?? 0);
  const pitch = Math.max(0.001, Number(c.pitch ?? 1));
  const widths = rows.map((row) => Math.max(0, row.x1 - row.x0)).filter((width) => width > pitch);
  const typicalWidth = widths.length
    ? widths.slice().sort((a, b) => a - b)[Math.floor(widths.length / 2)]
    : pitch;
  const estimatedCount = target > 0
    ? Math.max(2, Math.min(rows.length, Math.round(target / Math.max(pitch, typicalWidth + pitch))))
    : rows.length;
  const counts = uniqueSortedNumbers([
    2,
    3,
    estimatedCount - 1,
    estimatedCount,
    estimatedCount + 1,
    rows.length,
  ].map((count) => Math.max(2, Math.min(rows.length, count))));
  const result = [];
  const seen = new Set();
  const add = (start, count) => {
    const top = Math.max(0, Math.min(rows.length - count, start));
    const key = `${top}:${count}`;
    if (seen.has(key)) return;
    seen.add(key);
    result.push(rows.slice(top, top + count));
  };
  for (const count of counts) {
    add(0, count);
    add(rows.length - count, count);
    add(Math.round((rows.length - count) / 2), count);
  }
  return result;
}

function detachedInteriorRows(rows, c) {
  if (rows.length <= 3) return rows;
  const pitch = Math.max(0.001, Number(c.pitch ?? 1));
  const firstY = rows[0].y;
  const lastY = rows[rows.length - 1].y;
  const interior = rows.filter((row) => (
    Math.abs(row.y - firstY) >= pitch * 0.75
    && Math.abs(row.y - lastY) >= pitch * 0.75
  ));
  return interior.length >= 2 ? interior : rows;
}

function detachedRectSpanCandidates(span, start, end, c) {
  const xs = span.gridXs;
  const target = Number(c.tpuSnakeTargetLength ?? 0);
  const pitch = Math.max(0.001, Number(c.pitch ?? 1));
  const desiredWidth = target > 0 ? Math.max(pitch, target / 4) : Math.max(pitch, Math.abs(end.x - start.x));
  const centerHints = uniqueSortedNumbers([
    (start.x + end.x) / 2,
    start.x,
    end.x,
    span.x0 + (span.x1 - span.x0) * 0.33,
    span.x0 + (span.x1 - span.x0) * 0.67,
  ]);
  const widthHints = uniqueSortedNumbers([
    Math.abs(end.x - start.x),
    desiredWidth * 0.6,
    desiredWidth,
    desiredWidth * 1.4,
    span.x1 - span.x0,
  ].map((width) => Math.max(pitch, Math.min(span.x1 - span.x0, width))));
  const candidates = [];
  const seen = new Set();
  const add = (left, right) => {
    const l = nearestValue(xs, Math.max(span.x0, Math.min(left, right)));
    const r = nearestValue(xs, Math.min(span.x1, Math.max(left, right)));
    if (r - l < pitch * 0.8) return;
    const key = `${l.toFixed(3)}:${r.toFixed(3)}`;
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push([l, r]);
  };
  for (const center of centerHints) {
    for (const width of widthHints) add(center - width / 2, center + width / 2);
  }
  add(span.x0, span.x1);
  return candidates
    .sort((a, b) => (b[1] - b[0]) - (a[1] - a[0]))
    .slice(0, 36);
}

function detachedRectSerpentinePath(rows, left, right, entrySide, endpoints, c, deps) {
  if (rows.length < 2) return [];
  const cleanRows = rows.slice().sort((a, b) => a.y - b.y);
  const startAnchor = nearestRectEntryPoint(endpoints[0], cleanRows, left, right, entrySide);
  const exitSide = cleanRows.length % 2 === 0 ? entrySide : oppositeSide(entrySide, left, right);
  const endAnchor = nearestRectEntryPoint(endpoints[1], cleanRows, left, right, exitSide);
  const orderedRows = startAnchor.rowIndex <= endAnchor.rowIndex ? cleanRows : cleanRows.slice().reverse();
  const entry = { x: entrySide, y: orderedRows[0].y };
  const points = [];
  appendGeneratedSnakePath(points, orthogonalEndpointConnector(endpoints[0], entry), deps);
  let side = entrySide;
  for (let i = 0; i < orderedRows.length; i += 1) {
    const row = orderedRows[i];
    const nextSide = oppositeSide(side, left, right);
    appendGeneratedSnakePoint(points, { x: nextSide, y: row.y }, deps);
    if (i < orderedRows.length - 1) appendGeneratedSnakePoint(points, { x: nextSide, y: orderedRows[i + 1].y }, deps);
    side = nextSide;
  }
  const actualExit = points[points.length - 1];
  const exit = { x: actualExit.x, y: actualExit.y };
  appendGeneratedSnakePath(points, orthogonalEndpointConnector(exit, endpoints[1]).slice(1), deps);
  return removeConsecutiveDuplicatePoints(points, deps);
}

function nearestRectEntryPoint(point, rows, left, right, side) {
  let best = { rowIndex: 0, distance: Infinity };
  rows.forEach((row, rowIndex) => {
    const distance = Math.hypot(point.x - side, point.y - row.y);
    if (distance < best.distance) best = { rowIndex, distance };
  });
  return best;
}

function oppositeSide(side, left, right) {
  return Math.abs(side - left) <= 0.001 ? right : left;
}

function parametricCandidateNeedsExpansion(candidate, target, c, deps) {
  const desired = Number(target ?? 0);
  if (desired <= 0) return false;
  if (!candidate?.path?.length) return true;
  const length = pathLength(candidate.path, deps);
  return length < desired * 0.82 || Math.abs(length - desired) > Math.max(Number(c.pitch ?? 1) * 4, desired * 0.18);
}

function expandedLocalRowWindows(rows, first, last, target, c) {
  const baseCount = Math.max(1, last - first + 1);
  const pitch = Math.max(0.001, Number(c.pitch ?? 1));
  const widths = rows.map((row) => Math.max(0, row.x1 - row.x0)).filter((width) => width > pitch);
  const typicalWidth = widths.length
    ? widths.slice().sort((a, b) => a - b)[Math.floor(widths.length / 2)]
    : pitch;
  const estimated = target > 0
    ? Math.max(baseCount + 1, Math.round(target / Math.max(pitch, typicalWidth + pitch)))
    : baseCount + 1;
  const counts = uniqueSortedNumbers([
    baseCount + 1,
    baseCount + 2,
    estimated - 1,
    estimated,
    estimated + 1,
    estimated + 2,
    Math.min(rows.length, baseCount + 6),
  ].map((count) => Math.max(baseCount + 1, Math.min(rows.length, count))));
  const windows = [];
  const seen = new Set();
  const add = (top, count) => {
    const clampedTop = Math.max(0, Math.min(rows.length - count, top));
    const bottom = clampedTop + count - 1;
    if (clampedTop > first || bottom < last) return;
    const key = `${clampedTop}:${bottom}`;
    if (seen.has(key)) return;
    seen.add(key);
    windows.push(rows.slice(clampedTop, bottom + 1));
  };
  for (const count of counts) {
    const minTop = Math.max(0, last - count + 1);
    const maxTop = Math.min(first, rows.length - count);
    const centered = Math.round((first + last - count + 1) / 2);
    [centered, centered - 1, centered + 1, minTop, maxTop].forEach((top) => {
      if (top >= minTop && top <= maxTop) add(top, count);
    });
  }
  return windows;
}

function parametricRowSets(rows) {
  if (rows.length <= 2) return [rows];
  const sets = [];
  const seen = new Set();
  const add = (sampled) => {
    if (sampled.length < 2) return;
    const key = sampled.map((row) => row.y.toFixed(3)).join("|");
    if (seen.has(key)) return;
    seen.add(key);
    sets.push(sampled);
  };
  add(rows);
  add([rows[0], rows[rows.length - 1]]);
  for (let step = 2; step < rows.length; step += 1) {
    const sampled = [];
    for (let i = 0; i < rows.length; i += step) sampled.push(rows[i]);
    if (sampled[sampled.length - 1] !== rows[rows.length - 1]) sampled.push(rows[rows.length - 1]);
    add(sampled);
  }
  return sets.sort((a, b) => a.length - b.length);
}

function leadPointForEndpoint(endpoint, rows, c, deps) {
  const normal = unitNormal(endpoint.normal);
  const lead = endpointGridLeadLength(endpoint, c);
  if (!normal) return nearestRowLeadPoint(endpoint, rows, deps);
  const horizontalNormal = Math.abs(normal.x) >= Math.abs(normal.y);
  let best = null;
  rows.forEach((row, rowIndex) => {
    const gridXs = row.gridXs ?? [];
    if (horizontalNormal) {
      if (Math.abs(row.y - endpoint.y) > Math.max(0.001, c.pitch * 0.35)) return;
      for (const x of gridXs) {
        const projection = (x - endpoint.x) * Math.sign(normal.x || 1);
        if (projection < lead - 0.001) continue;
        const score = projection - lead;
        if (!best || score < best.score) best = { point: { x, y: row.y }, rowIndex, score };
      }
    } else {
      if (!gridXs.some((x) => Math.abs(x - endpoint.x) <= 0.001)) return;
      const projection = (row.y - endpoint.y) * Math.sign(normal.y || 1);
      if (projection < lead - 0.001) return;
      const score = projection - lead;
      const x = nearestValue(gridXs, endpoint.x);
      if (!best || score < best.score) best = { point: { x, y: row.y }, rowIndex, score };
    }
  });
  return best ?? nearestRowLeadPoint(endpoint, rows, deps);
}

function nearestRowLeadPoint(endpoint, rows, deps) {
  let best = null;
  rows.forEach((row, rowIndex) => {
    if (!row.gridXs?.length) return;
    const x = nearestValue(row.gridXs, endpoint.x);
    const point = { x, y: row.y };
    const score = deps.distance(endpoint, point);
    if (!best || score < best.score) best = { point, rowIndex, score };
  });
  return best;
}

function parametricSerpentinePath(rows, start, end, left, right, firstSide, endpoints, deps) {
  const points = [];
  appendGeneratedSnakePath(points, orthogonalEndpointConnector(endpoints[0], start), deps);
  let side = firstSide;
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    if (i === rows.length - 1) {
      appendGeneratedSnakePoint(points, { x: end.x, y: row.y }, deps);
      break;
    }
    appendGeneratedSnakePoint(points, { x: side, y: row.y }, deps);
    appendGeneratedSnakePoint(points, { x: side, y: rows[i + 1].y }, deps);
    side = Math.abs(side - left) < 0.001 ? right : left;
  }
  appendGeneratedSnakePath(points, orthogonalEndpointConnector(end, endpoints[1]).slice(1), deps);
  return removeConsecutiveDuplicatePoints(points, deps);
}

function bestAnchoredSerpentineCandidate(rows, c, endpoints, target, deps) {
  const startIndex = nearestRowIndex(rows, endpoints[0]);
  const endIndex = nearestRowIndex(rows, endpoints[1]);
  if (startIndex < 0 || endIndex < 0) return null;
  const first = Math.min(startIndex, endIndex);
  const last = Math.max(startIndex, endIndex);
  const rowSlice = rows.slice(first, last + 1);
  let best = null;
  for (const sampledRows of scanlineRowCandidates(rowSlice, c, target)) {
    const orderedRows = startIndex <= endIndex ? sampledRows : sampledRows.slice().reverse();
    const start = snapPointToRowSpan(endpoints[0], orderedRows[0], deps);
    const end = snapPointToRowSpan(endpoints[1], orderedRows[orderedRows.length - 1], deps);
    const candidates = anchoredSerpentinePathsForRows(orderedRows, start, end, c, deps);
    for (const path of candidates) {
      const length = pathLength(path, deps);
      const score = (target > 0 ? Math.abs(length - target) : length)
        + endpointDirectionPenalty(path, endpoints, deps);
      if (!best || score < best.score) best = { rows: orderedRows, path, length, score };
    }
  }
  return best;
}

function scanlineRowCandidates(rows, c, target) {
  if (rows.length <= 2) return [rows];
  const candidates = [rows];
  const maxStep = Math.min(rows.length - 1, Math.max(2, Math.ceil(rows.length / 2)));
  const stepCandidates = new Set([2, 3, 4, maxStep]);
  if (target > 0) {
    const avgRowLen = rows.reduce((sum, row) => sum + (row.x1 - row.x0), 0) / rows.length;
    const estimatedRows = Math.max(2, Math.min(rows.length, Math.round(target / Math.max(avgRowLen, c.pitch))));
    stepCandidates.add(Math.max(2, Math.round((rows.length - 1) / Math.max(1, estimatedRows - 1))));
  }
  for (const step of [...stepCandidates].filter((value) => value >= 2)) {
    const sampled = [];
    for (let i = 0; i < rows.length; i += step) sampled.push(rows[i]);
    if (sampled[sampled.length - 1] !== rows[rows.length - 1]) sampled.push(rows[rows.length - 1]);
    if (sampled.length >= 2) candidates.push(sampled);
  }
  return uniqueRowCandidateSets(candidates);
}

function uniqueRowCandidateSets(candidates) {
  const seen = new Set();
  const result = [];
  for (const rows of candidates) {
    const key = rows.map((row) => row.y.toFixed(3)).join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(rows);
  }
  return result;
}

function nearestRowIndex(rows, point) {
  const anchor = normalLeadAnchor(point);
  let best = { index: -1, distance: Infinity };
  rows.forEach((row, index) => {
    const d = Math.abs(row.y - anchor.y);
    if (d < best.distance) best = { index, distance: d };
  });
  return best.index;
}

function snapPointToRowSpan(point, row, deps) {
  const anchor = normalLeadAnchor(point);
  const x = row.gridXs?.length
    ? nearestValue(row.gridXs, anchor.x)
    : deps.clamp(anchor.x, row.x0, row.x1);
  return {
    x,
    y: row.y,
    normal: point.normal ?? null,
    boundaryPoint: point.boundaryPoint ?? null,
  };
}

function anchoredSerpentinePathsForRows(rows, start, end, c, deps) {
  if (rows.length === 0) return [];
  if (rows.length === 1) return [[start, end]];
  const span = commonRowSpan(rows);
  if (!span) return [];
  const xCandidates = snakeTurnXCandidates(span, start, end, c, deps);
  const transitions = rows.length - 1;
  const paths = [];
  const maxEnumerated = 4096;

  function addPath(turns) {
    const points = [];
    appendGeneratedSnakePoint(points, start, deps);
    for (let i = 0; i < transitions; i += 1) {
      const x = turns[i];
      const y0 = rows[i].y;
      const y1 = rows[i + 1].y;
      appendGeneratedSnakePoint(points, { x, y: y0 }, deps);
      appendGeneratedSnakePoint(points, { x, y: y1 }, deps);
    }
    appendGeneratedSnakePoint(points, end, deps);
    paths.push(removeConsecutiveDuplicatePoints(points, deps));
  }

  for (const x of xCandidates) addPath(Array(transitions).fill(x));
  for (const left of xCandidates) {
    for (const right of xCandidates) {
      if (Math.abs(left - right) < 0.001) continue;
      addPath(Array.from({ length: transitions }, (_, i) => (i % 2 === 0 ? right : left)));
      addPath(Array.from({ length: transitions }, (_, i) => (i % 2 === 0 ? left : right)));
    }
  }

  if (transitions <= 6) {
    const turns = [];
    function walk(depth) {
      if (paths.length >= maxEnumerated) return;
      if (depth === transitions) {
        addPath(turns);
        return;
      }
      for (const x of xCandidates) {
        turns.push(x);
        walk(depth + 1);
        turns.pop();
      }
    }
    walk(0);
  }
  return paths;
}

function snakeTurnXCandidates(span, start, end, c, deps) {
  const xs = span.gridXs?.length ? span.gridXs : [span.x0, span.x1];
  return deps.uniqueSortedBreaks(xs.concat([start.x, end.x])
    .filter((x) => x >= span.x0 - 0.001 && x <= span.x1 + 0.001));
}

function normalizedSnakeEndpoints(c, rows, deps) {
  if (deps.endpoints.length >= 2) {
    return deps.endpoints.slice(0, 2)
      .map((endpoint) => resolveEndpointOnBoundaryGrid(withCurrentLeadLength(endpoint, c), rows, deps, c));
  }
  const first = rows[0];
  const last = rows[rows.length - 1];
  if (!first || !last) return [];
  return [
    { x: first.x0, y: first.y },
    { x: rows.length % 2 === 1 ? last.x1 : last.x0, y: last.y },
  ];
}

function orientPathToEndpoint(path, endpoint, deps) {
  if (!endpoint || path.length < 2) return path;
  return deps.distance(endpoint, path[path.length - 1]) < deps.distance(endpoint, path[0])
    ? path.slice().reverse()
    : path;
}

function serpentineCandidatePathsForRows(rows, c, endpoints, deps) {
  const paths = [];
  const fullPath = serpentinePathFromRows(rows, deps);
  paths.push(fullPath, fullPath.slice().reverse());
  const span = commonRowSpan(rows);
  if (!span || span.gridXs.length < 2) return paths;
  const xs = span.gridXs;
  const maxPairs = 240;
  let pairCount = 0;
  for (let leftIndex = 0; leftIndex < xs.length - 1; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < xs.length; rightIndex += 1) {
      if (pairCount >= maxPairs) return paths;
      pairCount += 1;
      const left = xs[leftIndex];
      const right = xs[rightIndex];
      const path = serpentinePathFromRows(rows.map((row) => ({
        ...row,
        x0: left,
        x1: right,
        gridXs: row.gridXs.filter((x) => x >= left - 0.001 && x <= right + 0.001),
      })), deps);
      if (path.length >= 2) paths.push(path, path.slice().reverse());
    }
  }
  return paths;
}

function preferredSnakeCenters(span, endpoints, deps) {
  const centers = [(span.x0 + span.x1) / 2];
  for (const endpoint of endpoints) {
    if (endpoint?.x >= span.x0 && endpoint.x <= span.x1) centers.push(endpoint.x);
  }
  centers.push(span.x0 + (span.x1 - span.x0) * 0.33, span.x0 + (span.x1 - span.x0) * 0.67);
  return deps.uniqueSortedBreaks(centers);
}
