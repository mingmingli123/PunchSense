export function createTpuSnakeModel(deps) {
  const {
    state,
    controls,
    draw,
    updateWorkflowSections,
    toolForMaterial,
    materialRegions,
    materialSegmentBucket,
    mergeMaterialLineSegments,
    unionBounds,
    polygonBounds,
    pointInPolygon,
    distancePointToSegment,
    distance,
    lineSegmentKey,
    polylineLength,
    samePoint,
    clamp,
    uniqueSortedBreaks,
    printableTpuSnakePaths,
    tpuSnakePreviewLayer,
    getMaterialGridSegments,
    getBaseMaterialGridSegments,
    getGridHorizontalSegmentsUnion,
    getGridVerticalSegmentsUnion,
    getUpdateTpuSnakeStatus,
    nearestPcbPinEndpoint,
    pcbPinGridEndpoint,
    nearestPcbBoundaryEndpoint,
    pointInPcbEndpointSelectionZone,
    pcbNonT0PinContactBlockingBucket,
  } = deps;

  function pickTpuSnakeEndpoint(point, c) {
    const pcbPinSnap = nearestPcbPinEndpoint?.(point, c) ?? null;
    const pcbOnly = Boolean(pointInPcbEndpointSelectionZone?.(point, c));
    const pcbSnap = pcbOnly ? null : nearestPcbBoundaryEndpoint?.(point, c) ?? null;
    const tpuSnap = pcbOnly ? null : nearestTpuSnakeGridEndpoint(point, c);
    const rawSnap = pcbOnly ? pcbPinSnap : nearestEndpointCandidate(pcbPinSnap, pcbSnap, tpuSnap);
    const snap = normalizePickedEndpointSnap(rawSnap, c);
    if (!snap) {
      getUpdateTpuSnakeStatus()(c);
      return false;
    }
    state.tpuSnake.endpoints.push({
      ...snap.point,
      normal: snap.normal ?? null,
      boundaryPoint: snap.boundaryPoint ?? null,
      resolvedEndpointFinal: true,
      source: snap.source ?? null,
      pcbShapeId: snap.pcbShapeId ?? null,
      pinId: snap.pinId ?? null,
      pinLabel: snap.pinLabel ?? null,
      pinName: snap.pinName ?? null,
      gpio: snap.gpio ?? null,
      role: snap.role ?? null,
      selectedEdge: snap.selectedEdge ?? null,
      clickedEdgePoint: snap.clickedEdgePoint ?? null,
      contactPoint: snap.contactPoint ?? null,
      contactGridPoint: snap.contactGridPoint ?? null,
      frameGridPoint: snap.frameGridPoint ?? null,
      disableNormalLead: snap.disableNormalLead || snap.source === "pcb-pin",
      normalLeadLength: snap.disableNormalLead || snap.source === "pcb-pin" ? 0 : c.tpuSnakeNormalLeadLength,
    });
    if (state.tpuSnake.endpoints.length >= 2) {
      const endpoints = state.tpuSnake.endpoints.slice(0, 2);
      if (state.tpuSnake.editingConnectionIndex >= 0 && state.tpuSnake.connections[state.tpuSnake.editingConnectionIndex]) {
        const index = state.tpuSnake.editingConnectionIndex;
        const previous = state.tpuSnake.connections[index];
        state.tpuSnake.connections[index] = {
          ...previous,
          endpoints,
          normalLeadLength: connectionUsesDisabledLead(endpoints) ? 0 : Math.max(0, Number(c.tpuSnakeNormalLeadLength || previous.normalLeadLength || 0)),
        };
        state.tpuSnake.selectedConnectionIndex = index;
      } else {
        state.tpuSnake.connections.push(createTpuSnakeConnection(endpoints, c));
        state.tpuSnake.selectedConnectionIndex = state.tpuSnake.connections.length - 1;
      }
      state.tpuSnake.endpoints = [];
      state.tpuSnake.picking = false;
      state.tpuSnake.editingConnectionIndex = -1;
      document.getElementById("pickTpuSnakeEndpoints").textContent = "新增 TPU 蛇形线";
    }
    getUpdateTpuSnakeStatus()(c);
    draw();
    return true;
  }

  function nearestEndpointCandidate(...candidates) {
    return candidates
      .filter(Boolean)
      .filter((candidate) => candidate.source !== "pcb-cutout")
      .sort((a, b) => Number(a.distance ?? Infinity) - Number(b.distance ?? Infinity))[0] ?? null;
  }

  function normalizePickedEndpointSnap(snap, c) {
    if (!snap || snap.source !== "pcb-pin") return snap;
    const resolved = pcbPinGridEndpoint?.(c, snap) ?? null;
    if (resolved?.point) {
      return {
        ...snap,
        ...resolved,
        point: resolved.point,
        boundaryPoint: resolved.boundaryPoint ?? resolved.point,
        contactPoint: resolved.contactPoint ?? snap.contactPoint ?? snap.point,
        clickedEdgePoint: snap.clickedEdgePoint ?? resolved.contactPoint ?? resolved.point,
        distance: distance(snap.clickedEdgePoint ?? snap.point, resolved.point),
        boundaryDistance: distance(snap.clickedEdgePoint ?? snap.point, resolved.point),
      };
    }
    const contactPoint = snap.contactPoint ?? snap.point;
    const gridPoint = nearestEpiGridPoint(snap.point, c);
    return {
      ...snap,
      point: gridPoint,
      boundaryPoint: gridPoint,
      contactPoint,
      selectedEdge: translateSelectedEdgeToPoint(snap.selectedEdge, snap.point, gridPoint),
      clickedEdgePoint: snap.clickedEdgePoint ?? contactPoint,
      distance: distance(contactPoint, gridPoint),
      boundaryDistance: distance(contactPoint, gridPoint),
    };
  }

  function translateSelectedEdgeToPoint(edge, from, to) {
    if (!edge || !from || !to) return edge ?? null;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const x0 = Number(edge.x0);
    const y0 = Number(edge.y0);
    const x1 = Number(edge.x1);
    const y1 = Number(edge.y1);
    if (![x0, y0, x1, y1].every(Number.isFinite)) return edge;
    return { ...edge, x0: x0 + dx, y0: y0 + dy, x1: x1 + dx, y1: y1 + dy };
  }

  function startTpuSnakeEndpointPicking(index = -1) {
    controls.tpuSnakeEnabled.checked = true;
    setWorkflowMode("grid");
    state.tpuSnake.endpoints = [];
    state.tpuSnake.conflict = null;
    state.tpuSnake.picking = true;
    state.tpuSnake.editingConnectionIndex = index;
    state.tpuSnake.selectedConnectionIndex = index;
    const picker = document.getElementById("pickTpuSnakeEndpoints");
    if (picker) picker.textContent = index >= 0 ? `正在重画路径 ${index + 1}...` : "正在选择端点...";
    draw();
  }

  function setWorkflowMode(mode) {
    if (controls.workflowMode.value !== mode) controls.workflowMode.value = mode;
    updateWorkflowSections();
  }

  function createTpuSnakeConnection(endpoints, c) {
    const index = state.tpuSnake.connections.length + 1;
    return {
      id: String(Date.now()) + "_" + index,
      label: String(index),
      endpoints,
      targetLength: Math.max(0, Number(c.tpuSnakeTargetLength || 200)),
      normalLeadLength: connectionUsesDisabledLead(endpoints) ? 0 : Math.max(0, Number(c.tpuSnakeNormalLeadLength || 0)),
    };
  }

  function createGuidedTpuSnakeConnection(points, guideIndex, c, importGroupId = null, endpointResolver = null) {
    const cleaned = removeConsecutiveDuplicateMmPoints(points);
    if (cleaned.length < 2) return null;
    const start = resolveSvgGuideEndpoint(cleaned[0], c, endpointResolver);
    const end = resolveSvgGuideEndpoint(cleaned[cleaned.length - 1], c, endpointResolver);
    if (!start || !end) return null;
    const resolvedGuidePoints = cleaned.map((point, index) => {
      if (index === 0) return { ...start.point };
      if (index === cleaned.length - 1) return { ...end.point };
      return point;
    });
    const endpoints = [start, end].map((resolved) => ({
      ...resolved.point,
      normal: resolved.normal,
      boundaryPoint: resolved.boundaryPoint,
      resolvedEndpointFinal: true,
      rawPoint: resolved.rawPoint,
      source: resolved.source ?? null,
      pcbShapeId: resolved.pcbShapeId ?? null,
      pinId: resolved.pinId ?? null,
      pinLabel: resolved.pinLabel ?? null,
      pinName: resolved.pinName ?? null,
      gpio: resolved.gpio ?? null,
      role: resolved.role ?? null,
      selectedEdge: resolved.selectedEdge ?? null,
      clickedEdgePoint: resolved.clickedEdgePoint ?? null,
      contactPoint: resolved.contactPoint ?? null,
      disableNormalLead: resolved.disableNormalLead || resolved.source === "pcb-pin",
      normalLeadLength: 0,
    }));
    const index = state.tpuSnake.connections.length + guideIndex + 1;
    return {
      id: `svg_guide_${Date.now()}_${guideIndex + 1}`,
      label: `SVG${guideIndex + 1}`,
      endpoints,
      guidePoints: removeConsecutiveDuplicateMmPoints(resolvedGuidePoints),
      rawGuidePoints: cleaned,
      importGroupId,
      targetLength: polylineLength(resolvedGuidePoints),
      normalLeadLength: connectionUsesDisabledLead(endpoints) ? 0 : Math.max(0, Number(c.tpuSnakeNormalLeadLength || 0)),
    };
  }

  function resolveSvgGuideEndpoint(point, c, endpointResolver = null) {
    const rawSnap = endpointResolver ? endpointResolver(point) : nearestTpuSnakeGridEndpoint(point, c);
    const snap = normalizePickedEndpointSnap(rawSnap, c);
    const pitch = Math.max(0.001, Number(c.pitch ?? 1));
    const maxSnapDistance = endpointResolver
      ? Infinity
      : Math.max(pitch * 2.5, Number(c.gridLineWidth ?? 0.42) * 6);
    if (!snap || snap.distance > maxSnapDistance) {
      return null;
    }
    return {
      point: { ...snap.point },
      normal: snap.normal ? { ...snap.normal } : null,
      boundaryPoint: snap.boundaryPoint ? { ...snap.boundaryPoint } : { ...snap.point },
      resolvedEndpointFinal: true,
      rawPoint: { ...point },
      source: snap.source ?? null,
      pcbShapeId: snap.pcbShapeId ?? null,
      pinId: snap.pinId ?? null,
      pinLabel: snap.pinLabel ?? null,
      pinName: snap.pinName ?? null,
      gpio: snap.gpio ?? null,
      role: snap.role ?? null,
      selectedEdge: snap.selectedEdge ?? null,
      clickedEdgePoint: snap.clickedEdgePoint ?? null,
      contactPoint: snap.contactPoint ?? null,
      contactGridPoint: snap.contactGridPoint ?? null,
      frameGridPoint: snap.frameGridPoint ?? null,
      disableNormalLead: snap.disableNormalLead || snap.source === "pcb-pin",
    };
  }

  function connectionUsesDisabledLead(endpoints) {
    return (endpoints ?? []).some((endpoint) => endpoint?.disableNormalLead || endpoint?.source === "pcb-pin");
  }

  function removeConsecutiveDuplicateMmPoints(points) {
    const result = [];
    for (const point of points ?? []) {
      if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
      const last = result[result.length - 1];
      if (!last || distance(last, point) > 0.001) result.push({ x: point.x, y: point.y });
    }
    return result;
  }

  function nearestTpuSnakeGridEndpoint(point, c, cachedBucket = null, cachedEdges = null, options = {}) {
    const bucket = cachedBucket ?? getBaseMaterialGridSegments()(c, tpuSnakePreviewLayer(c)).get(0);
    if (!bucket || (bucket.horizontal.length === 0 && bucket.vertical.length === 0)) return null;
    const edge = nearestTpuBoundaryEdge(point, bucket, c, cachedEdges, options);
    if (!edge) return null;
    return {
      point: edge.gridPoint,
      distance: edge.distance,
      normal: edge.normal,
      boundaryPoint: edge.gridPoint,
      selectedEdge: edge.segment,
      clickedEdgePoint: edge.projected,
      boundaryDistance: edge.distance,
    };
  }

  function nearestTpuRegionGuideEndpoint(point, c) {
    const regions = materialRegions(c).filter((region) => Number(region.material) === 0 && region.polygon?.length >= 3);
    if (regions.length === 0) return null;
    let best = null;
    for (const region of regions) {
      const polygon = region.polygon;
      for (let i = 0; i < polygon.length; i += 1) {
        const a = polygon[i];
        const b = polygon[(i + 1) % polygon.length];
        const projected = closestPointOnSegment(point, a, b);
        const d = distance(point, projected);
        if (!best || d < best.distance) best = { region, a, b, projected, distance: d };
      }
    }
    if (!best) return null;
    const pointOnGrid = nearestEpiGridPoint(best.projected, c);
    const normal = outwardNormalForPolygonEdge(best.region.polygon, best.a, best.b, best.projected, c);
    return {
      point: pointOnGrid,
      distance: best.distance,
      normal,
      boundaryPoint: pointOnGrid,
      selectedEdge: { x0: best.a.x, y0: best.a.y, x1: best.b.x, y1: best.b.y },
      clickedEdgePoint: best.projected,
      boundaryDistance: best.distance,
    };
  }

  function tpuBoundaryEdges(bucket, c) {
    return [
      ...bucket.horizontal.map((segment) => ({
        direction: "horizontal",
        segment,
        start: { x: segment.x0, y: segment.y },
        end: { x: segment.x1, y: segment.y },
      })),
      ...bucket.vertical.map((segment) => ({
        direction: "vertical",
        segment,
        start: { x: segment.x, y: segment.y0 },
        end: { x: segment.x, y: segment.y1 },
      })),
    ].map((edge) => ({
      ...edge,
      normal: tpuGridEdgeNormal(edge, bucket, c),
    })).filter((edge) => edge.normal && edge.segment?.source !== "pcb-pin-contact");
  }

  function nearestTpuBoundaryEdge(point, bucket, c, cachedEdges = null, options = {}) {
    const edges = cachedEdges ?? tpuBoundaryEdges(bucket, c);
    let best = null;
    for (const edge of edges) {
      const projected = closestPointOnSegment(point, edge.start, edge.end);
      const d = distance(point, projected);
      if (!best || d < best.distance) best = { ...edge, projected, distance: d };
    }
    const threshold = options.maxDistance === Infinity || Number.isFinite(options.maxDistance)
      ? options.maxDistance
      : Math.max(2.5, c.pitch * 0.45, c.beadWidth * 6);
    if (!best || best.distance > threshold) return null;
    const gridPoint = nearestGridPointOnTpuEdge(best, bucket);
    return {
      ...best,
      gridPoint,
      normal: best.normal,
    };
  }

  function nearestGridPointOnTpuEdge(edge, bucket) {
    const candidates = edge.direction === "horizontal"
      ? bucket.vertical
        .filter((segment) => (
          segment.x >= edge.segment.x0 - 0.001
          && segment.x <= edge.segment.x1 + 0.001
          && edge.segment.y >= segment.y0 - 0.001
          && edge.segment.y <= segment.y1 + 0.001
        ))
        .map((segment) => ({ x: segment.x, y: edge.segment.y }))
      : bucket.horizontal
        .filter((segment) => (
          segment.y >= edge.segment.y0 - 0.001
          && segment.y <= edge.segment.y1 + 0.001
          && edge.segment.x >= segment.x0 - 0.001
          && edge.segment.x <= segment.x1 + 0.001
        ))
        .map((segment) => ({ x: edge.segment.x, y: segment.y }));
    const fallback = edge.direction === "horizontal"
      ? [{ x: edge.segment.x0, y: edge.segment.y }, { x: edge.segment.x1, y: edge.segment.y }]
      : [{ x: edge.segment.x, y: edge.segment.y0 }, { x: edge.segment.x, y: edge.segment.y1 }];
    return (candidates.length > 0 ? candidates : fallback)
      .reduce((best, candidate) => (
        distance(edge.projected, candidate) < distance(edge.projected, best) ? candidate : best
      ));
  }

  function tpuGridEdgeNormal(edge, bucket, c) {
    const directions = edge.direction === "horizontal"
      ? [{ x: 0, y: -1 }, { x: 0, y: 1 }]
      : [{ x: -1, y: 0 }, { x: 1, y: 0 }];
    const exposed = directions.filter((direction) => !hasAdjacentTpuGridLine(edge, bucket, direction, c));
    if (exposed.length === 1) return exposed[0];
    if (exposed.length === 0) return null;
    const center = tpuBucketCenter(bucket);
    const midpoint = {
      x: (edge.start.x + edge.end.x) / 2,
      y: (edge.start.y + edge.end.y) / 2,
    };
    return exposed
      .map((direction) => ({
        direction,
        score: direction.x * (midpoint.x - center.x) + direction.y * (midpoint.y - center.y),
      }))
      .sort((a, b) => b.score - a.score)[0]?.direction ?? exposed[0];
  }

  function hasAdjacentTpuGridLine(edge, bucket, direction, c) {
    const pitch = Math.max(Number(c.pitch ?? 0), 0.001);
    const tolerance = Math.max(0.001, pitch * 0.25);
    if (edge.direction === "horizontal") {
      const y = edge.segment.y + direction.y * pitch;
      return bucket.horizontal.some((segment) => (
        Math.abs(segment.y - y) <= tolerance
        && rangesOverlap(segment.x0, segment.x1, edge.segment.x0, edge.segment.x1, c.beadWidth * 0.5)
      ));
    }
    const x = edge.segment.x + direction.x * pitch;
    return bucket.vertical.some((segment) => (
      Math.abs(segment.x - x) <= tolerance
      && rangesOverlap(segment.y0, segment.y1, edge.segment.y0, edge.segment.y1, c.beadWidth * 0.5)
    ));
  }

  function rangesOverlap(a0, a1, b0, b1, minOverlap = 0.001) {
    return Math.min(a1, b1) - Math.max(a0, b0) >= minOverlap;
  }

  function tpuBucketCenter(bucket) {
    const xs = [];
    const ys = [];
    for (const segment of bucket.horizontal) {
      xs.push(segment.x0, segment.x1);
      ys.push(segment.y);
    }
    for (const segment of bucket.vertical) {
      xs.push(segment.x);
      ys.push(segment.y0, segment.y1);
    }
    return {
      x: xs.length ? xs.reduce((sum, value) => sum + value, 0) / xs.length : 0,
      y: ys.length ? ys.reduce((sum, value) => sum + value, 0) / ys.length : 0,
    };
  }

  function gridIntersectionCandidates(bucket) {
    const candidates = [];
    const seen = new Set();
    for (const h of bucket.horizontal) {
      for (const v of bucket.vertical) {
        if (v.x < h.x0 - 0.001 || v.x > h.x1 + 0.001) continue;
        if (h.y < v.y0 - 0.001 || h.y > v.y1 + 0.001) continue;
        const point = { x: v.x, y: h.y };
        const key = `${point.x.toFixed(3)}:${point.y.toFixed(3)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        candidates.push(point);
      }
    }
    return candidates;
  }

  function closestPointOnSegment(point, a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSquared = dx * dx + dy * dy;
    if (lengthSquared <= 1e-9) return { ...a };
    const t = clamp(((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared, 0, 1);
    return { x: a.x + dx * t, y: a.y + dy * t };
  }

  function outwardNormalForPolygonEdge(polygon, a, b, projected, c) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.hypot(dx, dy);
    if (length <= 0.001) return null;
    const candidates = [
      { x: -dy / length, y: dx / length },
      { x: dy / length, y: -dx / length },
    ];
    const step = Math.max(0.2, Number(c.beadWidth ?? 0.4), Number(c.pitch ?? 1) * 0.15);
    const outside = candidates.find((normal) => !pointInPolygon({
      x: projected.x + normal.x * step,
      y: projected.y + normal.y * step,
    }, polygon));
    if (outside) return axisAlignedNormal(outside);
    const center = polygonCenter(polygon);
    return axisAlignedNormal({
      x: projected.x - center.x,
      y: projected.y - center.y,
    });
  }

  function axisAlignedNormal(normal) {
    if (!normal) return null;
    return Math.abs(normal.x) >= Math.abs(normal.y)
      ? { x: Math.sign(normal.x) || 1, y: 0 }
      : { x: 0, y: Math.sign(normal.y) || 1 };
  }

  function polygonCenter(polygon) {
    const sum = polygon.reduce((acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }), { x: 0, y: 0 });
    return {
      x: sum.x / Math.max(1, polygon.length),
      y: sum.y / Math.max(1, polygon.length),
    };
  }

  function tpuPathDeps() {
    return {
      endpoints: state.tpuSnake.endpoints,
      snakeConnections: state.tpuSnake.connections,
      setSnakeConflict(message) {
        state.tpuSnake.conflict = message;
      },
      gridHorizontalSegmentsUnion(c) {
        return getGridHorizontalSegmentsUnion()(tpuSnakePlanningGridConfig(c));
      },
      gridVerticalSegmentsUnion(c) {
        return getGridVerticalSegmentsUnion()(tpuSnakePlanningGridConfig(c));
      },
      materialRegions,
      materialSegmentBucket,
      mergeMaterialLineSegments,
      toolForMaterial,
      expandRect,
      unionBounds,
      polygonBounds,
      pointInPolygon,
      distancePointToSegment,
      distance,
      lineSegmentKey,
      samePoint,
      clamp,
      uniqueSortedBreaks,
      printableTpuSnakePaths,
      nearestEpiGridPoint,
      nearestTpuSnakeGridEndpoint,
      pcbPinGridEndpoint,
      planningT0Bucket(c, layerIndex) {
        const embeddedConfig = tpuSnakePlanningGridConfig({ ...c, exposedSnakeMode: false });
        return getBaseMaterialGridSegments()(embeddedConfig, Math.max(2, layerIndex)).get(0) ?? null;
      },
      planningNonT0BlockedBucket(c) {
        return pcbNonT0PinContactBlockingBucket?.(c) ?? null;
      },
    };
  }

  function nearestEpiGridPoint(point, c) {
    const polygons = c.polygons?.length ? c.polygons : materialRegions(c).map((region) => region.polygon);
    if (!polygons.length) return { ...point };
    const bounds = unionBounds(polygons);
    const xs = pureEpiLinePositions(bounds.x, bounds.x + bounds.w, c);
    const ys = pureEpiLinePositions(bounds.y, bounds.y + bounds.h, c);
    return {
      x: nearestNumericValue(xs, point.x),
      y: nearestNumericValue(ys, point.y),
    };
  }

  function pureEpiLinePositions(start, end, c) {
    const pitch = Math.max(0.001, Number(c.pitch ?? 1));
    const positions = [];
    for (let value = start; value <= end + 0.001; value += pitch) {
      positions.push(Number(value.toFixed(6)));
    }
    if (positions.length === 0) positions.push(start);
    return positions;
  }

  function nearestNumericValue(values, target) {
    if (!values?.length) return target;
    return values.reduce((best, value) => (
      Math.abs(value - target) < Math.abs(best - target) ? value : best
    ), values[0]);
  }

  function tpuSnakePlanningGridConfig(c) {
    return {
      ...c,
      gridLineCount: 1,
      gridLineWidth: Number(c.beadWidth ?? 0.4),
      opening: Math.max(0, Number(c.pitch ?? 0) - Number(c.beadWidth ?? 0.4)),
    };
  }

  function expandRect(rect, amount) {
    return { x: rect.x - amount, y: rect.y - amount, w: rect.w + amount * 2, h: rect.h + amount * 2 };
  }

  return {
    pickTpuSnakeEndpoint,
    startTpuSnakeEndpointPicking,
    createTpuSnakeConnection,
    createGuidedTpuSnakeConnection,
    resolveSvgGuideEndpoint,
    removeConsecutiveDuplicateMmPoints,
    nearestTpuSnakeGridEndpoint,
    nearestTpuRegionGuideEndpoint,
    tpuBoundaryEdges,
    nearestTpuBoundaryEdge,
    nearestGridPointOnTpuEdge,
    tpuGridEdgeNormal,
    tpuPathDeps,
    nearestEpiGridPoint,
    pureEpiLinePositions,
    nearestNumericValue,
    tpuSnakePlanningGridConfig,
  };
}
