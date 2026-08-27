export function effectiveGuidePointsForEndpoints(guidePoints, endpoints) {
  if (!Array.isArray(guidePoints) || guidePoints.length < 2 || endpoints.length < 2) return guidePoints;
  return guidePoints.map((point, index) => {
    if (index === 0) return { x: endpoints[0].x, y: endpoints[0].y };
    if (index === guidePoints.length - 1) return { x: endpoints[1].x, y: endpoints[1].y };
    return point;
  });
}

export function pathConnectsEndpoints(path, endpoints, deps, c) {
  if (!path?.length || endpoints.length < 2) return false;
  const first = boundaryEndpointPoint(path, endpoints[0], deps, 1, c);
  const last = boundaryEndpointPoint(path, endpoints[1], deps, -1, c);
  return (
    sameEndpointPoint(first, endpoints[0], deps) && sameEndpointPoint(last, endpoints[1], deps)
  ) || (
    sameEndpointPoint(first, endpoints[1], deps) && sameEndpointPoint(last, endpoints[0], deps)
  );
}

export function boundaryEndpointPoint(path, endpoint, deps, direction, c) {
  const anchor = endpointInteriorAnchor(endpoint, c);
  if (!anchor) return direction > 0 ? path[0] : path[path.length - 1];
  const start = direction > 0 ? 0 : path.length - 1;
  for (let step = 0; step < path.length; step += 1) {
    const index = direction > 0 ? step : path.length - 1 - step;
    if (!deps.samePoint(path[index], anchor, 0.001)) return path[index];
  }
  return path[start];
}

export function sameEndpointPoint(a, b, deps) {
  return deps.samePoint ? deps.samePoint(a, b, 0.01) : Math.hypot(a.x - b.x, a.y - b.y) <= 0.01;
}

export function withCurrentLeadLength(endpoint, c) {
  if (endpoint?.disableNormalLead || endpoint?.source === "pcb-pin") {
    return {
      ...endpoint,
      normalLeadLength: 0,
      disableNormalLead: true,
    };
  }
  return {
    ...endpoint,
    normalLeadLength: Math.max(0, Number(c.tpuSnakeNormalLeadLength ?? endpoint.normalLeadLength ?? 0)),
  };
}

export function resolveEndpointOnBoundaryGrid(endpoint, rows, deps, c) {
  const normal = unitNormal(endpoint?.normal);
  if (!rows?.length) return endpoint;
  if (endpoint?.resolvedEndpointFinal) {
    const point = deps.nearestEpiGridPoint ? deps.nearestEpiGridPoint(endpoint.boundaryPoint ?? endpoint, c) : (endpoint.boundaryPoint ?? endpoint);
    return {
      ...endpoint,
      x: point.x,
      y: point.y,
      boundaryPoint: { x: point.x, y: point.y },
    };
  }
  if (!normal) return resolveEndpointToNearestSourceGrid(endpoint, rows, deps);
  const boundary = endpoint.boundaryPoint ?? endpoint;
  const pitch = Math.max(0.001, Number(c?.pitch ?? 1));
  const isPcbPin = endpoint?.source === "pcb-pin";
  if (isPcbPin && endpoint.resolvedPcbGridEndpoint) {
    return {
      ...endpoint,
      x: boundary.x,
      y: boundary.y,
      boundaryPoint: { x: boundary.x, y: boundary.y },
    };
  }
  if (isPcbPin) return resolvePcbPinEndpointOnGrid(endpoint, rows, deps, c, normal);
  const maxSnap = Math.max(pitch * 0.85, Number(c?.gridLineWidth ?? 0.4) * 2);
  const maxAlongDrift = pitch * 1.25;
  const horizontalNormal = Math.abs(normal.x) >= Math.abs(normal.y);
  let best = null;

  rows.forEach((row) => {
    if (!row.gridXs?.length) return;
    if (horizontalNormal) {
      const x = nearestValue(row.gridXs, boundary.x);
      const candidate = { x, y: row.y };
      const edgeDrift = Math.abs(x - boundary.x);
      const alongDrift = Math.abs(row.y - endpoint.y);
      const distance = deps.distance(candidate, endpoint);
      if (edgeDrift > maxSnap || alongDrift > maxAlongDrift) return;
      const score = edgeDrift * 4 + alongDrift + distance * 0.2;
      if (!best || score < best.score) best = { candidate, score };
    } else {
      const rowDrift = Math.abs(row.y - boundary.y);
      if (rowDrift > maxSnap) return;
      const x = nearestValue(row.gridXs, endpoint.x);
      const candidate = { x, y: row.y };
      const alongDrift = Math.abs(x - endpoint.x);
      if (alongDrift > maxAlongDrift) return;
      const distance = deps.distance(candidate, endpoint);
      const score = rowDrift * 4 + alongDrift + distance * 0.2;
      if (!best || score < best.score) best = { candidate, score };
    }
  });

  if (!best) return resolveEndpointToNearestSourceGrid(endpoint, rows, deps, normal);
  const snappedCandidate = deps.nearestEpiGridPoint
    ? deps.nearestEpiGridPoint(best.candidate, c)
    : best.candidate;
  const resolvedNormal = horizontalNormal
    ? { x: Math.sign(normal.x || 1), y: 0 }
    : { x: 0, y: Math.sign(normal.y || 1) };
  return {
    ...endpoint,
    x: snappedCandidate.x,
    y: snappedCandidate.y,
    normal: resolvedNormal,
    boundaryPoint: { x: snappedCandidate.x, y: snappedCandidate.y },
    resolvedFrom: endpoint,
  };
}

function resolveEndpointToNearestSourceGrid(endpoint, rows, deps, normal = null) {
  let best = null;
  const target = endpoint?.boundaryPoint ?? endpoint;
  if (!target) return endpoint;
  rows.forEach((row) => {
    for (const x of row.gridXs ?? []) {
      const candidate = { x, y: row.y };
      const score = deps.distance ? deps.distance(candidate, target) : Math.hypot(candidate.x - target.x, candidate.y - target.y);
      if (!best || score < best.score) best = { candidate, score };
    }
  });
  if (!best) return endpoint;
  const resolvedNormal = normal
    ? (Math.abs(normal.x) >= Math.abs(normal.y)
      ? { x: Math.sign(normal.x || 1), y: 0 }
      : { x: 0, y: Math.sign(normal.y || 1) })
    : endpoint.normal ?? null;
  return {
    ...endpoint,
    x: best.candidate.x,
    y: best.candidate.y,
    normal: resolvedNormal,
    boundaryPoint: { x: best.candidate.x, y: best.candidate.y },
    resolvedFrom: endpoint,
    resolvedByNearestSourceGrid: true,
  };
}

function resolvePcbPinEndpointOnGrid(endpoint, rows, deps, c, normal) {
  const rough = deps.nearestEpiGridPoint ? deps.nearestEpiGridPoint(endpoint, c) : { x: endpoint.x, y: endpoint.y };
  const pitch = Math.max(0.001, Number(c?.pitch ?? 1));
  const maxRowDrift = Math.max(pitch * 2.25, Number(c?.pcbPinContactWidth ?? 1.6));
  let best = null;
  rows.forEach((row) => {
    if (!row.gridXs?.length) return;
    const rowDrift = Math.abs(row.y - rough.y);
    if (rowDrift > maxRowDrift) return;
    const x = nearestValue(row.gridXs, rough.x);
    const candidate = { x, y: row.y };
    const score = rowDrift * 4 + Math.abs(x - rough.x) + deps.distance(candidate, rough) * 0.15;
    if (!best || score < best.score) best = { candidate, score };
  });
  const snapped = best?.candidate ?? rough;
  const horizontalNormal = Math.abs(normal.x) >= Math.abs(normal.y);
  const resolvedNormal = horizontalNormal
    ? { x: Math.sign(normal.x || 1), y: 0 }
    : { x: 0, y: Math.sign(normal.y || 1) };
  return {
    ...endpoint,
    x: snapped.x,
    y: snapped.y,
    normal: resolvedNormal,
    boundaryPoint: { x: snapped.x, y: snapped.y },
    resolvedFrom: endpoint,
  };
}

export function addEndpointLeadSegments(path, endpoints, deps, c) {
  if (path.length < 2 || endpoints.length < 2) return path;
  const result = path.slice();
  prependEndpointLead(result, endpoints[0], deps, c);
  appendEndpointLead(result, endpoints[1], deps, c);
  return removeConsecutiveDuplicatePoints(result, deps);
}

function prependEndpointLead(result, endpoint, deps, c) {
  const lead = endpointLeadChain(endpoint, c);
  for (let i = lead.length - 1; i >= 0; i -= 1) {
    if (!deps.samePoint(lead[i], result[0], 0.001)) result.unshift(lead[i]);
  }
}

function appendEndpointLead(result, endpoint, deps, c) {
  const lead = endpointLeadChain(endpoint, c).slice().reverse();
  for (const point of lead) {
    if (!deps.samePoint(point, result[result.length - 1], 0.001)) result.push(point);
  }
}

function endpointLeadChain(endpoint, c) {
  if (endpoint?.source === "pcb-pin") {
    return [];
  }
  const anchor = endpointInteriorAnchor(endpoint, c);
  return anchor ? [anchor] : [];
}

export function endpointInteriorAnchor(endpoint, c) {
  if (endpoint?.source === "pcb-pin") return pcbPinInteriorAnchor(endpoint);
  if (endpoint?.disableNormalLead) return null;
  const normal = unitNormal(endpoint?.normal);
  const lead = endpointGridLeadLength(endpoint, c);
  if (!normal || lead <= 0) return null;
  return {
    x: endpoint.x - normal.x * lead,
    y: endpoint.y - normal.y * lead,
  };
}

function pcbPinInteriorAnchor(endpoint) {
  const contact = endpoint?.contactPoint;
  if (!contact || !Number.isFinite(Number(contact.x)) || !Number.isFinite(Number(contact.y))) return null;
  const boundary = endpoint.boundaryPoint ?? endpoint;
  const normal = unitNormal(endpoint?.normal);
  if (!normal) return { x: Number(contact.x), y: Number(contact.y) };
  const horizontalNormal = Math.abs(normal.x) >= Math.abs(normal.y);
  return horizontalNormal
    ? { x: Number(contact.x), y: Number(boundary.y) }
    : { x: Number(boundary.x), y: Number(contact.y) };
}

export function endpointGridLeadLength(endpoint, c) {
  const lead = Math.max(0, Number(endpoint?.normalLeadLength ?? c?.tpuSnakeNormalLeadLength ?? 0));
  const pitch = Math.max(0, Number(c?.pitch ?? 0));
  if (lead <= 0 || pitch <= 0.001) return lead;
  return Math.max(1, Math.round(lead / pitch)) * pitch;
}

function removeConsecutiveDuplicatePoints(points, deps) {
  const result = [];
  for (const point of points) {
    const last = result[result.length - 1];
    if (!last || !deps.samePoint(last, point)) result.push(point);
  }
  return result;
}

function unitNormal(normal) {
  if (!normal) return null;
  const length = Math.hypot(normal.x, normal.y);
  if (length <= 1e-9) return null;
  return { x: normal.x / length, y: normal.y / length };
}

function nearestValue(values, target) {
  return values.reduce((best, value) => (
    Math.abs(value - target) < Math.abs(best - target) ? value : best
  ), values[0]);
}
