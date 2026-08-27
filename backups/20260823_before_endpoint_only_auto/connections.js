import { pathLength } from "./stats.js?v=auto-workflow-segment-guides-v3-20260823";
import {
  firstBlockedSnakePoint,
  firstSharedSnakePoint,
  firstSnakeClearanceConflict,
  mergeSnakeBuckets,
  pointKey,
  snakeGridPoints,
  usedSnakeBucket,
} from "./conflicts.js?v=auto-workflow-segment-guides-v3-20260823";
import {
  effectiveGuidePointsForEndpoints,
  resolveEndpointOnBoundaryGrid,
  withCurrentLeadLength,
} from "./endpoints.js?v=auto-workflow-segment-guides-v3-20260823";
import { buildTpuSnakePath } from "./candidates.js?v=auto-workflow-segment-guides-v3-20260823";

export function normalizedSnakeConnections(c, deps) {
  const saved = Array.isArray(deps.snakeConnections) ? deps.snakeConnections : [];
  if (saved.length > 0) {
    return saved
      .filter((connection) => connection?.endpoints?.length >= 2)
      .map((connection, index) => ({
        ...connection,
        id: connection.id ?? String(index + 1),
        targetLength: Number(connection.targetLength ?? c.tpuSnakeTargetLength ?? 0),
        normalLeadLength: connectionHasPcbPinEndpoint(connection) ? 0 : Number(connection.normalLeadLength ?? c.tpuSnakeNormalLeadLength ?? 0),
        endpoints: connection.endpoints.slice(0, 2).map((endpoint) => normalizeConnectionEndpoint(endpoint, c, deps)),
        guidePoints: Array.isArray(connection.guidePoints) ? connection.guidePoints : null,
      }));
  }
  return deps.endpoints.length >= 2
    ? [{
      id: "1",
      targetLength: Number(c.tpuSnakeTargetLength ?? 0),
      normalLeadLength: Number(c.tpuSnakeNormalLeadLength ?? 0),
      endpoints: deps.endpoints.slice(0, 2).map((endpoint) => normalizeConnectionEndpoint(endpoint, c, deps)),
    }]
    : [];
}

function normalizeConnectionEndpoint(endpoint, c, deps) {
  if (!endpoint) return endpoint;
  if (endpoint.source !== "pcb-pin") return endpoint;
  const resolved = deps.pcbPinGridEndpoint?.(c, endpoint) ?? null;
  if (resolved?.point) {
    return {
      ...endpoint,
      ...resolved.point,
      normal: resolved.normal ?? endpoint.normal ?? null,
      boundaryPoint: resolved.boundaryPoint ?? resolved.point,
      contactPoint: resolved.contactPoint ?? endpoint.contactPoint ?? { x: endpoint.x, y: endpoint.y },
      selectedEdge: resolved.selectedEdge ?? endpoint.selectedEdge ?? null,
      pinLabel: resolved.pinLabel ?? endpoint.pinLabel ?? null,
      pinName: resolved.pinName ?? endpoint.pinName ?? null,
      gpio: resolved.gpio ?? endpoint.gpio ?? null,
      role: resolved.role ?? endpoint.role ?? null,
      resolvedPcbGridEndpoint: true,
      disableNormalLead: true,
      normalLeadLength: 0,
    };
  }
  if (!deps.nearestEpiGridPoint) return endpoint;
  const original = endpoint.boundaryPoint ?? endpoint;
  const snapped = deps.nearestEpiGridPoint(original, c);
  const offset = {
    x: snapped.x - Number(original.x ?? snapped.x),
    y: snapped.y - Number(original.y ?? snapped.y),
  };
  return {
    ...endpoint,
    x: snapped.x,
    y: snapped.y,
    boundaryPoint: { x: snapped.x, y: snapped.y },
    contactPoint: endpoint.contactPoint ?? { x: endpoint.x, y: endpoint.y },
    selectedEdge: translateSelectedEdge(endpoint.selectedEdge, offset),
    disableNormalLead: true,
    normalLeadLength: 0,
  };
}

function connectionHasPcbPinEndpoint(connection) {
  return (connection?.endpoints ?? []).some((endpoint) => endpoint?.source === "pcb-pin");
}

function translateSelectedEdge(edge, offset) {
  if (!edge || (!offset.x && !offset.y)) return edge;
  if (Number.isFinite(Number(edge.x0)) && Number.isFinite(Number(edge.y0)) && Number.isFinite(Number(edge.x1)) && Number.isFinite(Number(edge.y1))) {
    return {
      ...edge,
      x0: edge.x0 + offset.x,
      y0: edge.y0 + offset.y,
      x1: edge.x1 + offset.x,
      y1: edge.y1 + offset.y,
    };
  }
  return {
    ...edge,
    a: edge.a ? { x: edge.a.x + offset.x, y: edge.a.y + offset.y } : edge.a,
    b: edge.b ? { x: edge.b.x + offset.x, y: edge.b.y + offset.y } : edge.b,
  };
}

export function buildConnectionSnakePaths(c, deps, connections, materialResult, layerIndex, planners) {
  const used = new Map();
  const snakes = Array(connections.length).fill(null);
  const planningBlockedBucket = deps.planningT0Bucket?.(c, layerIndex)
    ?? materialResult.get(0)
    ?? { horizontal: [], vertical: [] };
  const nonT0BlockedBucket = deps.planningNonT0BlockedBucket?.(c, layerIndex)
    ?? { horizontal: [], vertical: [], paths: [] };
  const hardBlockedBucket = nonT0BlockedBucket;
  const planningOrder = connections
    .map((connection, index) => ({ connection, index }))
    .sort((a, b) => a.index - b.index);
  for (const { connection, index } of planningOrder) {
    const connectionPlanningBlockedBucket = blockedBucketForConnection(planningBlockedBucket, connection);
    const connectionHardBlockedBucket = blockedBucketForConnection(hardBlockedBucket, connection);
    const connectionBlockedBucket = mergeSnakeBuckets(connectionPlanningBlockedBucket, connectionHardBlockedBucket);
    let sourceBucket = planners.unionSnakeBucket(c, deps, connection, connectionBlockedBucket);
    if (!sourceBucket || (sourceBucket.horizontal.length === 0 && sourceBucket.vertical.length === 0)) {
      if (connection.guidePoints?.length >= 2) sourceBucket = planners.unionSnakeBucket(c, deps, connection, connectionHardBlockedBucket);
      if (!sourceBucket || (sourceBucket.horizontal.length === 0 && sourceBucket.vertical.length === 0)) continue;
    }
    const effectiveConnection = resolveSnakeConnectionEndpoints(connection, sourceBucket, c, deps, planners);
    const connectionEndpoints = effectiveConnection.endpoints;
    const effectiveHardBlockedBucket = blockedBucketForConnection(hardBlockedBucket, effectiveConnection);
    const effectivePlanningBlockedBucket = blockedBucketForConnection(planningBlockedBucket, effectiveConnection);
    const effectiveConflictBlockedBucket = mergeSnakeBuckets(effectivePlanningBlockedBucket, effectiveHardBlockedBucket);
    const localConfig = {
      ...c,
      tpuSnakeTargetLength: effectiveConnection.targetLength,
      tpuSnakeNormalLeadLength: effectiveConnection.normalLeadLength,
    };
    const usedBucket = usedSnakeBucket(used);
    const isSvgGuideConnection = effectiveConnection.guidePoints?.length >= 2;
    const avoidT0Blocks = Boolean(effectiveConnection.avoidT0Blocks || effectiveConnection.autoWorkflow);
    const localBlockedBucket = mergeSnakeBuckets(effectiveConflictBlockedBucket, usedBucket);
    const localHardBlockedBucket = mergeSnakeBuckets(effectiveHardBlockedBucket, usedBucket);
    const localDeps = {
      ...deps,
      endpoints: connectionEndpoints,
      blockedSnakeBucket: effectiveConflictBlockedBucket,
      occupiedSnakeBucket: usedBucket,
    };
    const candidateDeps = isSvgGuideConnection
      ? {
        ...localDeps,
        blockedSnakeBucket: usedBucket,
        occupiedSnakeBucket: usedBucket,
      }
      : localDeps;
    const guidedDeps = {
      ...candidateDeps,
      blockedSnakeBucket: isSvgGuideConnection && !avoidT0Blocks ? usedBucket : localBlockedBucket,
    };
    const useGuidedPolyline = effectiveConnection.guidePoints?.length > 2;
    let snake = useGuidedPolyline
      ? planners.buildGuidedSnakePath(effectiveConnection.guidePoints, sourceBucket, localConfig, guidedDeps)
      : buildTpuSnakePath(sourceBucket, localConfig, candidateDeps, planners.buildTpuSnakePathInOrientation);
    if (!avoidT0Blocks && !snake.points?.length && planningBlockedBucket) {
      const relaxedSourceBucket = planners.unionSnakeBucket(c, deps, effectiveConnection, effectiveHardBlockedBucket);
      const relaxedSnake = relaxedSourceBucket && (relaxedSourceBucket.horizontal.length || relaxedSourceBucket.vertical.length)
        ? useGuidedPolyline
          ? planners.buildGuidedSnakePath(effectiveConnection.guidePoints, relaxedSourceBucket, localConfig, guidedDeps)
          : buildTpuSnakePath(relaxedSourceBucket, localConfig, candidateDeps, planners.buildTpuSnakePathInOrientation)
        : { points: [] };
      if (relaxedSnake.points?.length) {
        sourceBucket = relaxedSourceBucket;
        snake = relaxedSnake;
      }
    }
    if (!avoidT0Blocks && planners.enableGlobalFallback && shouldTryGlobalSnakeFallback(snake, localConfig, localDeps)) {
      const globalSourceBucket = planners.unionSnakeBucket(c, deps, effectiveConnection, effectiveHardBlockedBucket, { fullPrintable: true });
      const globalDeps = { ...localDeps, occupiedSnakeBucket: null };
      const globalSnake = globalSourceBucket && (globalSourceBucket.horizontal.length || globalSourceBucket.vertical.length)
        ? useGuidedPolyline
          ? planners.buildGuidedSnakePath(effectiveConnection.guidePoints, globalSourceBucket, localConfig, guidedDeps)
          : buildTpuSnakePath(globalSourceBucket, localConfig, globalDeps, planners.buildTpuSnakePathInOrientation)
        : { points: [] };
      const validationConnection = { ...effectiveConnection, endpoints: connectionEndpoints };
      const globalConflict = firstSharedSnakePoint(globalSnake.points ?? [], globalSourceBucket, used, validationConnection);
      if (!globalConflict && betterCandidateForTarget(globalSnake, snake, localConfig, localDeps)) {
        sourceBucket = globalSourceBucket;
        snake = globalSnake;
      }
    }
    if (!snake.points?.length) {
      const reason = used.size > 0
        ? "无法在避开黑色 TPU 和已有蛇形线的空闲网格上连接两端点"
        : "无法在不穿过黑色 TPU 且连接两端点的网格上生成路径";
      deps.setSnakeConflict?.(`蛇形线 ${connectionLabel(connection)} ${reason}`);
      continue;
    }
    const validationEndpoints = useGuidedPolyline && snake.points?.length >= 2
      ? [
        { ...connectionEndpoints[0], x: snake.points[0].x, y: snake.points[0].y },
        { ...connectionEndpoints[1], x: snake.points[snake.points.length - 1].x, y: snake.points[snake.points.length - 1].y },
      ]
      : connectionEndpoints;
    const validationConnection = { ...effectiveConnection, endpoints: validationEndpoints };
    const blockedConflictBucket = isSvgGuideConnection && !avoidT0Blocks ? localHardBlockedBucket : localBlockedBucket;
    const blockedConflict = firstBlockedSnakePoint(snake.points, sourceBucket, blockedConflictBucket, validationConnection, localConfig);
    if (blockedConflict) {
      deps.setSnakeConflict?.(`蛇形线 ${connectionLabel(connection)} 与已占用网格重合 (${blockedConflict.x.toFixed(1)}, ${blockedConflict.y.toFixed(1)})`);
      continue;
    }
    const clearanceConflict = isSvgGuideConnection
      ? null
      : firstSnakeClearanceConflict(snake.points, sourceBucket, effectiveConflictBlockedBucket, localConfig, validationEndpoints, deps);
    if (clearanceConflict) {
      deps.setSnakeConflict?.(`蛇形线 ${connectionLabel(connection)} 距离黑色 TPU 网格不足两格 (${clearanceConflict.x.toFixed(1)}, ${clearanceConflict.y.toFixed(1)})`);
      continue;
    }
    const conflict = firstSharedSnakePoint(snake.points, sourceBucket, used, validationConnection);
    if (conflict) {
      deps.setSnakeConflict?.(`蛇形线 ${connectionLabel(connection)} 与蛇形线 ${connectionLabel(conflict.owner)} 共用网格点 (${conflict.point.x.toFixed(1)}, ${conflict.point.y.toFixed(1)})`);
      continue;
    }
    for (const point of snakeGridPoints(snake.points, sourceBucket)) used.set(pointKey(point), { connection: validationConnection, point });
    snake.sourceConnectionIndex = index;
    snake.sourceConnectionLabel = connectionLabel(connection);
    snake.points.sourceConnectionIndex = index;
    snake.points.sourceConnectionLabel = connectionLabel(connection);
    snakes[index] = snake;
  }
  return snakes.filter(Boolean);
}

function resolveSnakeConnectionEndpoints(connection, sourceBucket, c, deps, planners) {
  const rows = planners.representativeSnakeRows(sourceBucket?.horizontal ?? [], sourceBucket?.vertical ?? []);
  const endpoints = (connection.endpoints ?? []).slice(0, 2).map((endpoint) => {
    const rawPoint = endpoint.rawPoint ?? { x: endpoint.x, y: endpoint.y };
    const withLead = withCurrentLeadLength({ ...endpoint, rawPoint }, c);
    return resolveEndpointOnBoundaryGrid(withLead, rows, deps, c);
  });
  const guidePoints = effectiveGuidePointsForEndpoints(connection.guidePoints, endpoints);
  return {
    ...connection,
    endpoints,
    guidePoints,
    targetLength: Number(connection.targetLength ?? c.tpuSnakeTargetLength ?? 0),
    normalLeadLength: connectionHasPcbPinEndpoint(connection) ? 0 : Number(connection.normalLeadLength ?? c.tpuSnakeNormalLeadLength ?? 0),
  };
}

function blockedBucketForConnection(bucket, connection) {
  const ownPinEndpoints = (connection?.endpoints ?? [])
    .filter((endpoint) => endpoint?.source === "pcb-pin" && endpoint.pcbShapeId && endpoint.pinId);
  const ownPins = new Set(ownPinEndpoints.map((endpoint) => `${endpoint.pcbShapeId}:${endpoint.pinId}`));
  if (ownPins.size === 0) return bucket;
  const keepSegment = (segment) => {
    if (!["pcb-pin-contact-blocker", "pcb-pin-contact", "pcb-pin-escape"].includes(segment?.source)) return true;
    return !ownPins.has(`${segment.parentShapeId}:${segment.pinId}`);
  };
  const keepPlanningSegment = (segment, direction) => {
    if (!keepSegment(segment)) return false;
    if (Number(segment?.material) !== 0) return true;
    return !ownPinEndpoints.some((endpoint) => segmentTouchesOwnPinEndpoint(segment, direction, endpoint));
  };
  return {
    horizontal: (bucket?.horizontal ?? []).filter((segment) => keepPlanningSegment(segment, "horizontal")),
    vertical: (bucket?.vertical ?? []).filter((segment) => keepPlanningSegment(segment, "vertical")),
    paths: (bucket?.paths ?? []).filter(keepSegment),
  };
}

function segmentTouchesOwnPinEndpoint(segment, direction, endpoint) {
  const point = endpoint?.boundaryPoint ?? endpoint;
  if (!point || !Number.isFinite(Number(point.x)) || !Number.isFinite(Number(point.y))) return false;
  const pitch = estimateEndpointPitch(endpoint);
  const tolerance = Math.max(0.01, pitch * 0.02);
  const span = Math.max(pitch * 1.2, 2.5);
  if (direction === "horizontal") {
    if (Math.abs(Number(segment.y) - Number(point.y)) > tolerance) return false;
    return Number(segment.x0) <= Number(point.x) + span && Number(segment.x1) >= Number(point.x) - span;
  }
  if (Math.abs(Number(segment.x) - Number(point.x)) > tolerance) return false;
  return Number(segment.y0) <= Number(point.y) + span && Number(segment.y1) >= Number(point.y) - span;
}

function estimateEndpointPitch(endpoint) {
  const edge = endpoint?.selectedEdge;
  if (edge && Number.isFinite(Number(edge.x0)) && Number.isFinite(Number(edge.x1))) {
    const length = Math.hypot(Number(edge.x1) - Number(edge.x0), Number(edge.y1) - Number(edge.y0));
    if (length > 0.001) return Math.max(0.5, length);
  }
  return 2.5;
}

function shouldTryGlobalSnakeFallback(snake, c, deps) {
  const target = Number(c.tpuSnakeTargetLength ?? 0);
  if (!snake?.points?.length) return true;
  if (target <= 0) return false;
  const length = pathLength(snake.points, deps);
  return length < target * 0.82 || Math.abs(length - target) > Math.max(Number(c.pitch ?? 1) * 5, target * 0.18);
}

function betterCandidateForTarget(candidate, current, c, deps) {
  if (!candidate?.points?.length) return false;
  if (!current?.points?.length) return true;
  const target = Number(c.tpuSnakeTargetLength ?? 0);
  if (target <= 0) return false;
  const candidateScore = Math.abs(pathLength(candidate.points, deps) - target);
  const currentScore = Math.abs(pathLength(current.points, deps) - target);
  return candidateScore + 0.001 < currentScore;
}

function connectionLabel(connection) {
  return connection.label ?? connection.id ?? "?";
}
