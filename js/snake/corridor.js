import { distancePointToPolygon, intersectRects, pointsBounds, unionRect } from "./geometry_helpers.js";

export function tpuConnectorCorridorRect(c, deps, connection = null) {
  const endpoints = connection?.endpoints?.length ? connection.endpoints : allConnectionEndpoints(deps);
  const pitch = Math.max(0.001, Number(c.pitch ?? 1));
  const margin = Math.max(pitch * 2, Number(c.gridLineWidth ?? 0.4) * 4, 6);
  if (endpoints.length < 2) return deps.expandRect(deps.unionBounds(c.polygons), margin);
  if (connection) {
    const guide = connection.guidePoints?.length >= 2 ? connection.guidePoints : endpoints;
    const base = pointsBounds(guide);
    const horizontalish = base.w >= base.h;
    const alongMargin = Math.max(margin, pitch * 2);
    const perpendicularMargin = Math.max(margin, pitch * 6, 14);
    const local = horizontalish
      ? {
        x: base.x - alongMargin,
        y: base.y - perpendicularMargin,
        w: base.w + alongMargin * 2,
        h: Math.max(pitch, base.h) + perpendicularMargin * 2,
      }
      : {
        x: base.x - perpendicularMargin,
        y: base.y - alongMargin,
        w: Math.max(pitch, base.w) + perpendicularMargin * 2,
        h: base.h + alongMargin * 2,
      };
    const printable = deps.unionBounds(c.polygons);
    return intersectRects(local, printable) ?? printable;
  }
  const tpuRegions = deps.materialRegions(c)
    .filter((region) => Number(region.material) === 0)
    .map((region) => ({ ...region, bounds: deps.polygonBounds(region.polygon) }));
  const endpointRegions = endpoints.map((point) => {
    let best = null;
    for (const region of tpuRegions) {
      const d = deps.pointInPolygon(point, region.polygon) ? 0 : distancePointToPolygon(point, region.polygon, deps);
      if (!best || d < best.distance) best = { region, distance: d };
    }
    return best?.region ?? null;
  }).filter(Boolean);
  const base = endpointRegions.length > 0
    ? unionRect(endpointRegions.map((region) => region.bounds))
    : pointsBounds(endpoints);
  const printable = deps.unionBounds(c.polygons);
  return intersectRects(deps.expandRect(base, margin), printable) ?? printable;
}

function allConnectionEndpoints(deps) {
  const connections = Array.isArray(deps.snakeConnections) ? deps.snakeConnections : [];
  const endpoints = connections.flatMap((connection) => connection.endpoints ?? []);
  return endpoints.length > 0 ? endpoints : deps.endpoints;
}

export function subtractBlockedHorizontalSegments(segments, blocked) {
  const blockedByY = new Map();
  for (const segment of blocked) {
    const key = segment.y.toFixed(3);
    if (!blockedByY.has(key)) blockedByY.set(key, []);
    blockedByY.get(key).push([segment.x0, segment.x1]);
  }
  return subtractBlockedSpans(segments, "horizontal", blockedByY);
}

export function subtractBlockedVerticalSegments(segments, blocked) {
  const blockedByX = new Map();
  for (const segment of blocked) {
    const key = segment.x.toFixed(3);
    if (!blockedByX.has(key)) blockedByX.set(key, []);
    blockedByX.get(key).push([segment.y0, segment.y1]);
  }
  return subtractBlockedSpans(segments, "vertical", blockedByX);
}

function subtractBlockedSpans(segments, direction, blockedGroups) {
  const result = [];
  for (const segment of segments) {
    const key = direction === "horizontal" ? segment.y.toFixed(3) : segment.x.toFixed(3);
    let spans = direction === "horizontal" ? [[segment.x0, segment.x1]] : [[segment.y0, segment.y1]];
    for (const [blockA, blockB] of blockedGroups.get(key) ?? []) {
      const a = Math.min(blockA, blockB);
      const b = Math.max(blockA, blockB);
      const next = [];
      for (const [s0, s1] of spans) {
        if (b <= s0 + 0.001 || a >= s1 - 0.001) next.push([s0, s1]);
        else {
          if (a - s0 > 0.1) next.push([s0, a]);
          if (s1 - b > 0.1) next.push([b, s1]);
        }
      }
      spans = next;
    }
    for (const [s0, s1] of spans) {
      if (direction === "horizontal") result.push({ ...segment, x0: s0, x1: s1 });
      else result.push({ ...segment, y0: s0, y1: s1 });
    }
  }
  return result;
}

export function clipHorizontalSegmentsToRect(segments, rect) {
  return segments.flatMap((segment) => {
    if (!rect || segment.y < rect.y - 0.001 || segment.y > rect.y + rect.h + 0.001) return [];
    const x0 = Math.max(segment.x0, rect.x);
    const x1 = Math.min(segment.x1, rect.x + rect.w);
    return x1 - x0 > 0.1 ? [{ ...segment, x0, x1 }] : [];
  });
}

export function clipVerticalSegmentsToRect(segments, rect) {
  return segments.flatMap((segment) => {
    if (!rect || segment.x < rect.x - 0.001 || segment.x > rect.x + rect.w + 0.001) return [];
    const y0 = Math.max(segment.y0, rect.y);
    const y1 = Math.min(segment.y1, rect.y + rect.h);
    return y1 - y0 > 0.1 ? [{ ...segment, y0, y1 }] : [];
  });
}
