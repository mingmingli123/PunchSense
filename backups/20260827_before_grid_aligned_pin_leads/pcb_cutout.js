import {
  pcbProfileById,
} from "./pcb_profiles.js";
import {
  pointInPolygon,
} from "./core/geometry.js";
import {
  appendFramePathsWithBoundaryOwnership,
} from "./grid_segments.js";

export const DEFAULT_PCB_PROFILE_ID = "xiaoEsp32c3";
export const PCB_CUTOUT_KIND = "pcb-cutout";

export function isPcbCutoutShape(shape) {
  return shape?.kind === PCB_CUTOUT_KIND
    || shape?.kind === "pcb"
    || Boolean(shape?.pcbProfileId)
    || isXiaoSizedVoidRect(shape);
}

export function createPcbCutoutShape(c, profileId = DEFAULT_PCB_PROFILE_ID) {
  const profile = pcbProfileById(profileId);
  if (!profile) throw new Error(`未知 PCB profile: ${profileId}`);
  const width = Number(profile.board?.width || 20);
  const height = Number(profile.board?.height || 18);
  return {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    type: "rect",
    kind: PCB_CUTOUT_KIND,
    pcbProfileId: profileId,
    label: profile.name,
    x: Math.max(0, (Number(c.bedWidth || width) - width) / 2),
    y: Math.max(0, (Number(c.bedDepth || height) - height) / 2),
    w: width,
    h: height,
    rotation: 0,
    material: -1,
    lockedMaterial: true,
  };
}

export function pcbPinContactRegions(c, shapes, connections = [], ordinaryMaterial = 2) {
  if (!c.pcbPinContactsEnabled) return [];
  const width = Math.max(0.2, Number(c.pcbPinContactWidth ?? 1.6));
  const selectedPins = connectedPcbPinRefs(connections);
  const regions = [];
  for (const shape of pcbEndpointShapes(c, shapes)) {
    const profile = pcbProfileById(shape.pcbProfileId ?? DEFAULT_PCB_PROFILE_ID);
    if (profileUsesFixedEndpointPins(profile)) {
      for (const hole of profile?.selectableHoles ?? []) {
        const material = conductivePcbPin(hole) ? 0 : ordinaryMaterial;
        const contactWidth = individualPinContactWidth(profile, hole, width);
        const polygons = pinContactRingPolygons(shape, profile, hole, contactWidth);
        for (const [ringIndex, polygon] of polygons.entries()) {
          if (polygon.length < 3) continue;
          regions.push({
            polygon,
            material,
            fillMode: "grid",
            source: "pcb-pin-contact",
            shapeId: `${shape.id}:pin:${hole.id}:ring:${ringIndex}`,
            parentShapeId: shape.id,
            pinId: hole.id,
            pinLabel: hole.label ?? hole.id,
          });
        }
      }
    } else {
      const rows = pcbHoleRows(profile);
      for (const row of rows) {
        const polygon = contactStripPolygon(shape, profile, row, width);
        if (polygon.length >= 3) {
          regions.push({
            polygon,
            material: 0,
            fillMode: "grid",
            source: "pcb-pin-contact",
            shapeId: `${shape.id}:pin:${row.id}`,
            parentShapeId: shape.id,
            rowId: row.id,
          });
        }
      }
    }
  }
  return regions;
}

export function pcbPinHoleVoidRegions(c, shapes) {
  if (!c.pcbPinContactsEnabled) return [];
  const width = Math.max(0.2, Number(c.pcbPinContactWidth ?? 1.6));
  const regions = [];
  for (const shape of pcbEndpointShapes(c, shapes)) {
    const profile = pcbProfileById(shape.pcbProfileId ?? DEFAULT_PCB_PROFILE_ID);
    const board = profile?.board;
    if (!board) continue;
    for (const hole of profile?.selectableHoles ?? []) {
      const polygon = pinHoleVoidPolygon(shape, profile, hole, individualPinContactWidth(profile, hole, width));
      if (polygon.length < 3) continue;
      regions.push({
        polygon,
        material: -1,
        fillMode: "grid",
        source: "pcb-pin-hole",
        shapeId: `${shape.id}:pin:${hole.id}:hole`,
        parentShapeId: shape.id,
        pinId: hole.id,
        pinLabel: hole.label ?? hole.id,
      });
    }
  }
  return regions;
}

export function connectedPcbPinRefs(connections = []) {
  const refs = new Set();
  for (const connection of connections ?? []) {
    for (const endpoint of connection?.endpoints ?? []) {
      if (endpoint?.source !== "pcb-pin") continue;
      if (!endpoint.pcbShapeId || !endpoint.pinId) continue;
      refs.add(pcbPinRefKey(endpoint.pcbShapeId, endpoint.pinId));
    }
  }
  return refs;
}

export function pcbCutoutCount(shapes) {
  return (shapes ?? []).filter(isPcbCutoutShape).length;
}

export function addAlignedPcbCutoutFramePaths(result, c, shapes, materialSegmentBucket, firstLayerMaterial, layerIndex, layerPrintsT0Block, connections = []) {
  const framePaths = pcbCutoutFramePaths(shapes);
  if (framePaths.length === 0) return;
  const printsT0Frame = Boolean(layerPrintsT0Block?.(c, layerIndex));
  const t0FramePaths = printsT0Frame ? pcbPinContactFramePaths(c, shapes, connections) : [];
  const whiteFramePaths = t0FramePaths.length > 0 ? subtractFramePathOverlaps(framePaths, t0FramePaths) : framePaths;
  const whiteBucket = materialSegmentBucket(result, firstLayerMaterial);
  appendFramePathsWithBoundaryOwnership(whiteBucket, whiteFramePaths, "solidPaths", "pcb-white-frame");
  if (printsT0Frame) {
    if (t0FramePaths.length === 0) return;
    const t0Bucket = materialSegmentBucket(result, 0);
    appendFramePathsWithBoundaryOwnership(t0Bucket, t0FramePaths, "solidPaths", "pcb-t0-pin-frame");
  }
}

export function pcbCutoutFramePaths(shapes) {
  return (shapes ?? [])
    .filter((shape) => isPcbCutoutShape(shape) && shape.type === "rect")
    .map((shape) => {
      const x0 = Math.min(shape.x, shape.x + shape.w);
      const x1 = Math.max(shape.x, shape.x + shape.w);
      const y0 = Math.min(shape.y, shape.y + shape.h);
      const y1 = Math.max(shape.y, shape.y + shape.h);
      return [
        { x: x0, y: y0 },
        { x: x1, y: y0 },
        { x: x1, y: y1 },
        { x: x0, y: y1 },
        { x: x0, y: y0 },
      ];
    });
}

export function pcbPinContactFramePaths(c, shapes, connections = []) {
  const pinContactPaths = pcbPinContactRegions(c, shapes, connections)
    .filter((region) => Number(region.material) === 0)
    .map((region) => closePolygonPath(region.polygon))
    .filter((path) => path.length >= 4);
  return [
    ...pinContactPaths,
    ...conductivePcbFrameEdgePaths(c, shapes, connections),
  ];
}

function conductivePcbFrameEdgePaths(c, shapes, connections = []) {
  const paths = [];
  const width = Math.max(0.2, Number(c.pcbPinContactWidth ?? 1.6));
  const pitch = Math.max(0.001, Number(c.pitch ?? 1));
  const bead = Math.max(0.001, Number(c.beadWidth ?? 0.42));
  const span = Math.max(width * 1.35, pitch * 1.05, bead * 4);
  for (const shape of pcbEndpointShapes(c, shapes)) {
    const profile = pcbProfileById(shape.pcbProfileId ?? DEFAULT_PCB_PROFILE_ID);
    const board = profile?.board;
    if (!board) continue;
    for (const hole of profile?.selectableHoles ?? []) {
      const conductive = conductivePcbPin(hole) || connectionUsesPin(connections, shape.id, hole.id);
      if (!conductive) continue;
      const edgeAnchor = pcbHoleBoardEdgeAnchor(shape, board, hole);
      const edge = nearestRectEdge(edgeAnchor, shape);
      if (!edge) continue;
      const path = centeredFrameEdgeSegment(edge, edgeAnchor, span);
      if (path.length >= 2) paths.push(path);
    }
  }
  return dedupePaths(paths);
}

function centeredFrameEdgeSegment(edge, center, span) {
  const dx = edge.end.x - edge.start.x;
  const dy = edge.end.y - edge.start.y;
  const length = Math.hypot(dx, dy);
  if (length <= 0.001) return [];
  const ux = dx / length;
  const uy = dy / length;
  const half = Math.min(length / 2, Math.max(0.1, span / 2));
  const projected = closestPointOnSegment(center, edge.start, edge.end);
  const start = clampPointOnEdge({ x: projected.x - ux * half, y: projected.y - uy * half }, edge);
  const end = clampPointOnEdge({ x: projected.x + ux * half, y: projected.y + uy * half }, edge);
  return distance(start, end) > 0.1 ? [start, end] : [];
}

function clampPointOnEdge(point, edge) {
  return closestPointOnSegment(point, edge.start, edge.end);
}

function dedupePaths(paths) {
  const seen = new Set();
  const result = [];
  for (const path of paths) {
    const key = pathKey(path);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(path);
  }
  return result;
}

function subtractFramePathOverlaps(paths, blockers) {
  const removals = axisRemovalsFromPaths(blockers);
  const result = [];
  for (const path of paths) {
    for (let i = 0; i < path.length - 1; i += 1) {
      const a = path[i];
      const b = path[i + 1];
      const pieces = subtractAxisEdge(a, b, removals);
      for (const piece of pieces) {
        if (distance(piece[0], piece[1]) > 0.1) result.push(piece);
      }
    }
  }
  return result;
}

function axisRemovalsFromPaths(paths) {
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

function subtractAxisEdge(a, b, removals) {
  if (Math.abs(a.y - b.y) <= 0.001 && Math.abs(a.x - b.x) > 0.001) {
    return subtractOrderedEdge(a, b, removals.horizontal.filter((removal) => removal.coord === snapKey(a.y)), "x");
  }
  if (Math.abs(a.x - b.x) <= 0.001 && Math.abs(a.y - b.y) > 0.001) {
    return subtractOrderedEdge(a, b, removals.vertical.filter((removal) => removal.coord === snapKey(a.x)), "y");
  }
  return [[{ ...a }, { ...b }]];
}

function subtractOrderedEdge(a, b, removals, axis) {
  const start = a[axis];
  const end = b[axis];
  const low = Math.min(start, end);
  const high = Math.max(start, end);
  const cuts = removals
    .filter((removal) => removal.end > low + 0.001 && removal.start < high - 0.001)
    .map((removal) => [Math.max(low, removal.start), Math.min(high, removal.end)]);
  const kept = subtractIntervals([[low, high]], cuts);
  const ordered = start <= end ? kept : kept.map(([s, e]) => [s, e]).reverse();
  return ordered.map(([s, e]) => {
    const p0 = axis === "x" ? { x: s, y: a.y } : { x: a.x, y: s };
    const p1 = axis === "x" ? { x: e, y: a.y } : { x: a.x, y: e };
    return start <= end ? [p0, p1] : [p1, p0];
  });
}

function mergeAxisRemovals(removals) {
  const byLine = new Map();
  for (const removal of removals) {
    if (!byLine.has(removal.coord)) byLine.set(removal.coord, []);
    byLine.get(removal.coord).push([removal.start, removal.end]);
  }
  const merged = [];
  for (const [coord, spans] of byLine) {
    for (const [start, end] of mergeIntervals(spans)) merged.push({ coord, start, end });
  }
  return merged;
}

function subtractIntervals(intervals, cuts) {
  let parts = intervals.map(([start, end]) => [Math.min(start, end), Math.max(start, end)]);
  for (const [cutStart, cutEnd] of mergeIntervals(cuts)) {
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

function mergeIntervals(intervals) {
  if (!intervals.length) return [];
  const sorted = intervals.map(([a, b]) => [Math.min(a, b), Math.max(a, b)]).sort((a, b) => a[0] - b[0]);
  const merged = [sorted[0]];
  for (const interval of sorted.slice(1)) {
    const last = merged[merged.length - 1];
    if (interval[0] <= last[1] + 0.001) last[1] = Math.max(last[1], interval[1]);
    else merged.push(interval);
  }
  return merged;
}

function snapKey(value) {
  return Number(value).toFixed(3);
}

export function addPcbPinContactGridSegments(result, c, shapes, materialSegmentBucket, segmentsAt, connections = [], ordinaryMaterial = 2) {
  if (!c.pcbPinContactsEnabled || !c.pcbPinContactEpi || !Number.isFinite(Number(c.pcbPinContactEpi))) return;
  const regions = pcbPinContactRegions(c, shapes, connections, ordinaryMaterial);
  if (regions.length === 0) return;
  for (const region of regions) {
    const bucket = materialSegmentBucket(result, region.material);
    appendPinContactRingPaths(bucket, region.polygon, Number(c.beadWidth ?? 0.42));
  }
  appendConductivePinEndpointLeads(result, c, shapes, materialSegmentBucket, connections);
}

export function pcbNonT0PinContactBlockingBucket(c, shapes, connections = [], ordinaryMaterial = 2) {
  const bucket = { horizontal: [], vertical: [], paths: [] };
  const pinContactRegions = pcbPinContactRegions(c, shapes, connections, ordinaryMaterial)
    .filter((region) => region.polygon?.length >= 3);
  const escapeRegions = pcbPinEscapeRegions(c, shapes, connections, ordinaryMaterial)
    .filter((region) => region.polygon?.length >= 3);
  appendPcbCutoutVoidBlockers(bucket, c, shapes, [...pinContactRegions, ...escapeRegions]);
  if (!c.pcbPinContactsEnabled) return bucket;
  const regions = [...pinContactRegions, ...escapeRegions]
    .filter((region) => Number(region.material) !== 0 && region.polygon?.length >= 3);
  const spacing = Number(c.beadWidth ?? 0.42);
  const gridOrigin = printableGridOrigin(c, regions);
  const pitch = Math.max(0.001, Number(c.pitch ?? 1));
  for (const region of regions) {
    appendMainGridBlockedPadArea(bucket, region, gridOrigin, pitch);
    for (const path of concentricRectPaths(region.polygon, spacing)) {
      appendPathSegmentsToBucket(bucket, path, region);
    }
  }
  return bucket;
}

function pcbPinEscapeRegions(c, shapes, connections = [], ordinaryMaterial = 2) {
  const width = Math.max(0.2, Number(c.pcbPinContactWidth ?? 1.6));
  return pcbEndpointShapes(c, shapes).flatMap((shape) => {
    const profile = pcbProfileById(shape.pcbProfileId ?? DEFAULT_PCB_PROFILE_ID);
    const board = profile?.board;
    if (!board) return [];
    return (profile.selectableHoles ?? []).flatMap((hole) => {
      const isConductiveEndpoint = conductivePcbPin(hole) || connectionUsesPin(connections, shape.id, hole.id);
      if (!isConductiveEndpoint) return [];
      return {
        polygon: gridAlignedPcbPinEscapePolygon(c, shape, profile, hole, individualPinContactWidth(profile, hole, width)),
        material: 0,
        parentShapeId: shape.id,
        pinId: hole.id,
        source: "pcb-pin-escape",
      };
    });
  });
}

function appendPcbCutoutVoidBlockers(bucket, c, shapes, allowedRegions = []) {
  const cutouts = pcbEndpointShapes(c, shapes).filter((shape) => shape?.type === "rect");
  if (cutouts.length === 0) return;
  const origin = printableGridOrigin(c, cutouts.map((shape) => ({ polygon: rectShapePolygon(shape) })));
  const pitch = Math.max(0.001, Number(c.pitch ?? 1));
  for (const shape of cutouts) {
    const bounds = normalizedRectBounds(shape);
    const allowed = allowedRegions
      .filter((region) => region.parentShapeId === shape.id)
      .map((region) => polygonBounds(region.polygon));
    for (const y of gridValuesInRange(bounds.y, bounds.y + bounds.h, origin.y, pitch)) {
      for (const [x0, x1] of subtractAllowedIntervals([[bounds.x, bounds.x + bounds.w]], allowedIntervalsAtY(allowed, y))) {
        if (x1 - x0 > 0.1) {
          bucket.horizontal.push({
            y,
            x0,
            x1,
            material: -1,
            source: "pcb-cutout-blocker",
            parentShapeId: shape.id,
          });
        }
      }
    }
    for (const x of gridValuesInRange(bounds.x, bounds.x + bounds.w, origin.x, pitch)) {
      for (const [y0, y1] of subtractAllowedIntervals([[bounds.y, bounds.y + bounds.h]], allowedIntervalsAtX(allowed, x))) {
        if (y1 - y0 > 0.1) {
          bucket.vertical.push({
            x,
            y0,
            y1,
            material: -1,
            source: "pcb-cutout-blocker",
            parentShapeId: shape.id,
          });
        }
      }
    }
  }
}

function allowedIntervalsAtY(boundsList, y) {
  return boundsList
    .filter((bounds) => y >= bounds.y - 0.001 && y <= bounds.y + bounds.h + 0.001)
    .map((bounds) => [bounds.x, bounds.x + bounds.w]);
}

function allowedIntervalsAtX(boundsList, x) {
  return boundsList
    .filter((bounds) => x >= bounds.x - 0.001 && x <= bounds.x + bounds.w + 0.001)
    .map((bounds) => [bounds.y, bounds.y + bounds.h]);
}

function subtractAllowedIntervals(intervals, allowed) {
  return subtractIntervals(intervals, allowed);
}

function normalizedRectBounds(shape) {
  const x0 = Math.min(Number(shape.x), Number(shape.x) + Number(shape.w));
  const x1 = Math.max(Number(shape.x), Number(shape.x) + Number(shape.w));
  const y0 = Math.min(Number(shape.y), Number(shape.y) + Number(shape.h));
  const y1 = Math.max(Number(shape.y), Number(shape.y) + Number(shape.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

function rectShapePolygon(shape) {
  const bounds = normalizedRectBounds(shape);
  return [
    { x: bounds.x, y: bounds.y },
    { x: bounds.x + bounds.w, y: bounds.y },
    { x: bounds.x + bounds.w, y: bounds.y + bounds.h },
    { x: bounds.x, y: bounds.y + bounds.h },
  ];
}

function appendMainGridBlockedPadArea(bucket, region, origin, pitch) {
  const bounds = polygonBounds(region.polygon);
  for (const y of gridValuesInRange(bounds.y, bounds.y + bounds.h, origin.y, pitch)) {
    bucket.horizontal.push({
      y,
      x0: bounds.x,
      x1: bounds.x + bounds.w,
      material: region.material,
      source: "pcb-pin-contact-blocker",
      parentShapeId: region.parentShapeId,
      pinId: region.pinId ?? null,
    });
  }
  for (const x of gridValuesInRange(bounds.x, bounds.x + bounds.w, origin.x, pitch)) {
    bucket.vertical.push({
      x,
      y0: bounds.y,
      y1: bounds.y + bounds.h,
      material: region.material,
      source: "pcb-pin-contact-blocker",
      parentShapeId: region.parentShapeId,
      pinId: region.pinId ?? null,
    });
  }
}

function printableGridOrigin(c, fallbackRegions) {
  const polygons = c?.polygons?.length ? c.polygons : fallbackRegions.map((region) => region.polygon);
  const points = polygons.flatMap((polygon) => polygon ?? []);
  if (points.length === 0) return { x: 0, y: 0 };
  return {
    x: Math.min(...points.map((point) => Number(point.x)).filter(Number.isFinite)),
    y: Math.min(...points.map((point) => Number(point.y)).filter(Number.isFinite)),
  };
}

function gridValuesInRange(start, end, origin, pitch) {
  const values = [];
  const first = origin + Math.ceil((start - origin - 0.001) / pitch) * pitch;
  for (let value = first; value <= end + 0.001; value += pitch) values.push(Number(value.toFixed(6)));
  return values;
}

function appendPathSegmentsToBucket(bucket, path, region) {
  for (let i = 1; i < path.length; i += 1) {
    const a = path[i - 1];
    const b = path[i];
    if (Math.abs(a.y - b.y) <= 0.001) {
      bucket.horizontal.push({
        y: a.y,
        x0: Math.min(a.x, b.x),
        x1: Math.max(a.x, b.x),
        material: region.material,
        source: "pcb-pin-contact-blocker",
        parentShapeId: region.parentShapeId,
        pinId: region.pinId ?? null,
      });
    } else if (Math.abs(a.x - b.x) <= 0.001) {
      bucket.vertical.push({
        x: a.x,
        y0: Math.min(a.y, b.y),
        y1: Math.max(a.y, b.y),
        material: region.material,
        source: "pcb-pin-contact-blocker",
        parentShapeId: region.parentShapeId,
        pinId: region.pinId ?? null,
      });
    }
  }
}

function appendPinContactRingPaths(bucket, polygon, spacing) {
  const list = bucket.solidPaths ?? [];
  const existing = new Set(list.map(pathKey));
  for (const path of concentricRectPaths(polygon, spacing)) {
    const key = pathKey(path);
    if (existing.has(key)) continue;
    existing.add(key);
    list.push(path);
  }
  bucket.solidPaths = list;
}

function pathKey(path) {
  return path.map((point) => `${snapKey(point.x)},${snapKey(point.y)}`).join("|");
}

function concentricRectPaths(polygon, spacing) {
  if (!polygon?.length) return [];
  const xs = polygon.map((point) => Number(point.x)).filter(Number.isFinite);
  const ys = polygon.map((point) => Number(point.y)).filter(Number.isFinite);
  if (xs.length < 4 || ys.length < 4) return [];
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const y0 = Math.min(...ys);
  const y1 = Math.max(...ys);
  const step = Math.max(0.18, Number(spacing) || 0.42);
  const paths = [];
  for (let inset = 0; inset <= Math.min(x1 - x0, y1 - y0) / 2 - 0.05; inset += step) {
    const ax = x0 + inset;
    const bx = x1 - inset;
    const ay = y0 + inset;
    const by = y1 - inset;
    if (bx - ax <= 0.1 || by - ay <= 0.1) break;
    paths.push(closePolygonPath([
      { x: ax, y: ay },
      { x: bx, y: ay },
      { x: bx, y: by },
      { x: ax, y: by },
    ]));
  }
  return paths;
}

export function pcbPinMarkers(c, shapes) {
  const markers = [];
  for (const shape of pcbEndpointShapes(c, shapes)) {
    const profile = pcbProfileById(shape.pcbProfileId ?? DEFAULT_PCB_PROFILE_ID);
    const board = profile?.board;
    if (!board) continue;
    for (const hole of profile?.selectableHoles ?? []) {
      markers.push({
        source: "pcb-pin",
        pcbShapeId: shape.id,
        pinId: hole.id,
        pinLabel: hole.label ?? hole.id,
        pinName: hole.pinName ?? null,
        gpio: hole.gpio ?? null,
        role: hole.role ?? null,
        point: localPcbPointToWorld({ x: Number(hole.x), y: Number(hole.y) }, shape, board),
      });
    }
  }
  return markers;
}

function conductivePcbPin(hole) {
  if (hole.role === "send" || hole.role === "receive" || hole.role === "ground") return true;
  return false;
}

function connectionUsesPin(connections, shapeId, pinId) {
  return (connections ?? []).some((connection) => (connection.endpoints ?? []).some((endpoint) => (
    endpoint?.source === "pcb-pin"
    && endpoint.pcbShapeId === shapeId
    && endpoint.pinId === pinId
  )));
}

export function pointInPcbEndpointSelectionZone(point, c, shapes) {
  const width = Math.max(0.2, Number(c.pcbPinContactWidth ?? 1.6));
  const pinMargin = pcbPinHitMargin(c);
  for (const shape of pcbEndpointShapes(c, shapes)) {
    const profile = pcbProfileById(shape.pcbProfileId ?? DEFAULT_PCB_PROFILE_ID);
    if (!profileUsesFixedEndpointPins(profile)) continue;
    const board = profile?.board;
    if (!board) continue;
    for (const hole of selectableEndpointHoles(profile)) {
      const polygon = pinContactPolygon(shape, profile, hole, individualPinContactWidth(profile, hole, width));
      if (polygon.length >= 3 && pointInExpandedBounds(point, polygonBounds(polygon), pinMargin)) return true;
      const edgeAnchor = pcbHoleBoardEdgeAnchor(shape, board, hole);
      const anchorEdge = nearestRectEdge(edgeAnchor, shape);
      if (!anchorEdge) continue;
      const pinEndpoint = pcbPinContactEndpointPoint(shape, board, hole, anchorEdge.normal, individualPinContactWidth(profile, hole, width));
      const selectedEdge = shortPcbPinSelectedEdge(pinEndpoint, anchorEdge.normal, c, shape.id, hole.id);
      const projected = closestPointOnSegment(point, { x: selectedEdge.x0, y: selectedEdge.y0 }, { x: selectedEdge.x1, y: selectedEdge.y1 });
      if (distance(point, projected) <= pcbEdgeTriggerDistance(c, width)) return true;
    }
  }
  return false;
}

export function nearestPcbPinEndpoint(point, c, shapes) {
  const width = Math.max(0.2, Number(c.pcbPinContactWidth ?? 1.6));
  const pinHit = nearestPcbPinContactEndpoint(point, c, shapes, width);
  if (pinHit) return pinHit;
  let best = null;
  for (const shape of pcbEndpointShapes(c, shapes)) {
    const profile = pcbProfileById(shape.pcbProfileId ?? DEFAULT_PCB_PROFILE_ID);
    const board = profile?.board;
    if (!board) continue;
    const boardEdge = nearestRectEdge(point, shape);
    if (!boardEdge) continue;
    const holes = selectableEndpointHoles(profile);
    for (const hole of holes) {
      const edgeAnchor = pcbHoleBoardEdgeAnchor(shape, board, hole);
      const anchorEdge = nearestRectEdge(edgeAnchor, shape);
      if (!anchorEdge || anchorEdge.edge !== boardEdge.edge) continue;
      const anchorDistance = distance(boardEdge.projected, edgeAnchor);
      const polygon = pinContactPolygon(shape, profile, hole, individualPinContactWidth(profile, hole, width));
      if (polygon.length < 3) continue;
      const bounds = polygonBounds(polygon);
      const rect = { x: bounds.x, y: bounds.y, w: bounds.w, h: bounds.h };
      if (anchorDistance > pcbPinEdgeSpan(c, width)) continue;
      if (!best || boardEdge.distance < best.edgeDistance - 0.001 || (Math.abs(boardEdge.distance - best.edgeDistance) <= 0.001 && anchorDistance < best.anchorDistance)) {
        best = { ...boardEdge, shape, profile, board, hole, rect, edgeAnchor, edgeDistance: boardEdge.distance, anchorDistance };
      }
    }
  }
  const threshold = pcbEdgeTriggerDistance(c, width);
  if (!best || best.edgeDistance > threshold) return null;
  const endpoint = pcbPinGridEndpointForShape(c, best.shape, best.profile, best.board, best.hole, best.normal, width);
  if (!endpoint) return null;
  return {
    ...endpoint,
    distance: distance(point, endpoint.point),
    clickedEdgePoint: best.projected,
    boundaryDistance: distance(point, endpoint.point),
  };
}

function nearestPcbPinContactEndpoint(point, c, shapes, width) {
  const margin = pcbPinHitMargin(c);
  let best = null;
  for (const shape of pcbEndpointShapes(c, shapes)) {
    const profile = pcbProfileById(shape.pcbProfileId ?? DEFAULT_PCB_PROFILE_ID);
    const board = profile?.board;
    if (!board) continue;
    for (const hole of selectableEndpointHoles(profile)) {
      const polygon = pinContactPolygon(shape, profile, hole, individualPinContactWidth(profile, hole, width));
      if (polygon.length < 3) continue;
      const bounds = polygonBounds(polygon);
      if (!pointInExpandedBounds(point, bounds, margin)) continue;
      const center = localPcbPointToWorld({ x: Number(hole.x), y: Number(hole.y) }, shape, board);
      const d = distance(point, center);
      if (!best || d < best.distance) best = { shape, profile, board, hole, bounds, distance: d };
    }
  }
  if (!best) return null;
  const edgeAnchor = pcbHoleBoardEdgeAnchor(best.shape, best.board, best.hole);
  const anchorEdge = nearestRectEdge(edgeAnchor, best.shape);
  if (!anchorEdge) return null;
  const endpoint = pcbPinGridEndpointForShape(c, best.shape, best.profile, best.board, best.hole, anchorEdge.normal, width);
  if (!endpoint) return null;
  return {
    ...endpoint,
    distance: best.distance,
    clickedEdgePoint: point,
    boundaryDistance: best.distance,
  };
}

export function pcbPinGridEndpointForRef(c, shapes, ref) {
  if (!ref?.pcbShapeId || !ref?.pinId) return null;
  const shape = (shapes ?? []).find((candidate) => candidate.id === ref.pcbShapeId);
  if (!shape) return null;
  const profile = pcbProfileById(shape.pcbProfileId ?? DEFAULT_PCB_PROFILE_ID);
  const board = profile?.board;
  const hole = (profile?.selectableHoles ?? []).find((candidate) => candidate.id === ref.pinId);
  if (!board || !hole) return null;
  const edgeAnchor = pcbHoleBoardEdgeAnchor(shape, board, hole);
  const anchorEdge = nearestRectEdge(edgeAnchor, shape);
  if (!anchorEdge) return null;
  const width = Math.max(0.2, Number(c.pcbPinContactWidth ?? 1.6));
  return pcbPinGridEndpointForShape(c, shape, profile, board, hole, anchorEdge.normal, width);
}

function pcbPinGridEndpointForShape(c, shape, profile, board, hole, normal, requestedWidth) {
  const width = individualPinContactWidth(profile, hole, requestedWidth);
  const edgeAnchor = pcbHoleBoardEdgeAnchor(shape, board, hole);
  const escapePolygon = gridAlignedPcbPinEscapePolygon(c, shape, profile, hole, width);
  const contactPoint = pcbPinContactEndpointPoint(shape, board, hole, normal, width);
  const gridPoint = outerPcbPinGridPoint(c, [escapePolygon], edgeAnchor, normal)
    ?? bestPinContactGridPoint(c, pinContactRingPolygons(shape, profile, hole, width), contactPoint, normal);
  const point = gridPoint ?? snapToMainGrid(edgeAnchor, c);
  return {
    point,
    normal,
    boundaryPoint: point,
    contactPoint,
    selectedEdge: shortPcbPinSelectedEdge(point, normal, c, shape.id, hole.id),
    source: "pcb-pin",
    pcbShapeId: shape.id,
    pinId: hole.id,
    pinLabel: hole.label ?? hole.id,
    pinName: hole.pinName ?? null,
    gpio: hole.gpio ?? null,
    role: hole.role ?? null,
    resolvedPcbGridEndpoint: true,
    disableNormalLead: true,
    normalLeadLength: 0,
  };
}

function appendConductivePinEndpointLeads(result, c, shapes, materialSegmentBucket, connections = []) {
  const width = Math.max(0.2, Number(c.pcbPinContactWidth ?? 1.6));
  for (const shape of pcbEndpointShapes(c, shapes)) {
    const profile = pcbProfileById(shape.pcbProfileId ?? DEFAULT_PCB_PROFILE_ID);
    const board = profile?.board;
    if (!board) continue;
    for (const hole of profile?.selectableHoles ?? []) {
      const isConductiveEndpoint = conductivePcbPin(hole) || connectionUsesPin(connections, shape.id, hole.id);
      if (!isConductiveEndpoint) continue;
      const edgeAnchor = pcbHoleBoardEdgeAnchor(shape, board, hole);
      const anchorEdge = nearestRectEdge(edgeAnchor, shape);
      if (!anchorEdge) continue;
      const endpoint = pcbPinGridEndpointForShape(c, shape, profile, board, hole, anchorEdge.normal, width);
      const path = pcbPinEndpointLeadPath(endpoint);
      if (path.length < 2) continue;
      const bucket = materialSegmentBucket(result, 0);
      const list = bucket.solidPaths ?? [];
      const key = pathKey(path);
      if (!list.some((candidate) => pathKey(candidate) === key)) list.push(path);
      bucket.solidPaths = list;
    }
  }
}

function pcbPinEndpointLeadPath(endpoint) {
  const contact = endpoint?.contactPoint;
  const point = endpoint?.boundaryPoint ?? endpoint?.point;
  if (!contact || !point) return [];
  const a = { x: Number(contact.x), y: Number(contact.y) };
  const b = { x: Number(point.x), y: Number(point.y) };
  if (![a.x, a.y, b.x, b.y].every(Number.isFinite)) return [];
  if (distance(a, b) <= 0.001) return [];
  const normal = unitNormal(endpoint?.normal);
  if (!normal || Math.abs(a.x - b.x) <= 0.001 || Math.abs(a.y - b.y) <= 0.001) return [a, b];
  const elbow = Math.abs(normal.x) >= Math.abs(normal.y)
    ? { x: b.x, y: a.y }
    : { x: a.x, y: b.y };
  return [a, elbow, b].filter((point, index, list) => (
    index === 0 || distance(point, list[index - 1]) > 0.001
  ));
}

function bestPinContactGridPoint(c, polygons, contactPoint, normal) {
  const validPolygons = (polygons ?? []).filter((polygon) => polygon.length >= 3);
  if (validPolygons.length === 0) return null;
  const bounds = unionPolygonBounds(validPolygons);
  const pitch = Math.max(0.001, Number(c.pitch ?? 1));
  const origin = printableGridOrigin(c, validPolygons.map((polygon) => ({ polygon })));
  const xs = gridValuesInRange(bounds.x - pitch, bounds.x + bounds.w + pitch, origin.x, pitch);
  const ys = gridValuesInRange(bounds.y - pitch, bounds.y + bounds.h + pitch, origin.y, pitch);
  const unit = unitNormal(normal);
  let best = null;
  for (const x of xs) {
    for (const y of ys) {
      const candidate = { x, y };
      const inside = validPolygons.some((polygon) => pointInPolygon(candidate, polygon));
      const near = inside || validPolygons.some((polygon) => pointInExpandedBounds(candidate, polygonBounds(polygon), Number(c.beadWidth ?? 0.42) * 1.25));
      if (!near) continue;
      const outward = unit ? (candidate.x - contactPoint.x) * unit.x + (candidate.y - contactPoint.y) * unit.y : 0;
      const score = distance(candidate, contactPoint) - Math.max(0, outward) * 0.35 + (inside ? 0 : 2);
      if (!best || score < best.score) best = { point: candidate, score };
    }
  }
  return best?.point ?? null;
}

function outerPcbPinGridPoint(c, polygons, contactPoint, inwardNormal) {
  const validPolygons = (polygons ?? []).filter((polygon) => polygon.length >= 3);
  if (validPolygons.length === 0) return null;
  const bounds = unionPolygonBounds(validPolygons);
  const pitch = Math.max(0.001, Number(c.pitch ?? 1));
  const origin = printableGridOrigin(c, validPolygons.map((polygon) => ({ polygon })));
  const xs = gridValuesInRange(bounds.x - pitch, bounds.x + bounds.w + pitch, origin.x, pitch);
  const ys = gridValuesInRange(bounds.y - pitch, bounds.y + bounds.h + pitch, origin.y, pitch);
  const inward = unitNormal(inwardNormal);
  const outward = inward ? { x: -inward.x, y: -inward.y } : null;
  let best = null;
  for (const x of xs) {
    for (const y of ys) {
      const candidate = { x, y };
      const near = validPolygons.some((polygon) => pointInExpandedBounds(candidate, polygonBounds(polygon), Number(c.beadWidth ?? 0.42) * 1.25));
      if (!near) continue;
      const outwardDistance = outward ? (candidate.x - contactPoint.x) * outward.x + (candidate.y - contactPoint.y) * outward.y : 0;
      const perpendicular = outward
        ? Math.abs((candidate.x - contactPoint.x) * outward.y - (candidate.y - contactPoint.y) * outward.x)
        : distance(candidate, contactPoint);
      const score = -outwardDistance * 10 + perpendicular + distance(candidate, contactPoint) * 0.05;
      if (!best || score < best.score) best = { point: candidate, score };
    }
  }
  return best?.point ?? null;
}

function snapToMainGrid(point, c) {
  const origin = printableGridOrigin(c, []);
  const pitch = Math.max(0.001, Number(c.pitch ?? 1));
  return {
    x: roundToGrid(point.x, origin.x, pitch),
    y: roundToGrid(point.y, origin.y, pitch),
  };
}

function unionPolygonBounds(polygons) {
  const boundsList = polygons.map(polygonBounds);
  const x0 = Math.min(...boundsList.map((bounds) => bounds.x));
  const y0 = Math.min(...boundsList.map((bounds) => bounds.y));
  const x1 = Math.max(...boundsList.map((bounds) => bounds.x + bounds.w));
  const y1 = Math.max(...boundsList.map((bounds) => bounds.y + bounds.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

function shortPcbPinSelectedEdge(point, normal, c, shapeId, pinId) {
  const nx = Number(normal?.x ?? 0);
  const ny = Number(normal?.y ?? 0);
  const horizontalEdge = Math.abs(ny) >= Math.abs(nx);
  const length = Math.max(
    Number(c?.pcbPinContactWidth ?? 1.6),
    Number(c?.pitch ?? 1) * 0.75,
    Number(c?.beadWidth ?? 0.42) * 3,
  );
  const half = length / 2;
  return {
    x0: point.x - (horizontalEdge ? half : 0),
    y0: point.y - (horizontalEdge ? 0 : half),
    x1: point.x + (horizontalEdge ? half : 0),
    y1: point.y + (horizontalEdge ? 0 : half),
    source: "pcb-pin",
    shapeId,
    pinId,
  };
}

export function nearestPcbBoundaryEndpoint(point, c, shapes) {
  let best = null;
  for (const shape of pcbEndpointShapes(c, shapes)) {
    const profile = pcbProfileById(shape.pcbProfileId ?? DEFAULT_PCB_PROFILE_ID);
    if (profileUsesFixedEndpointPins(profile)) continue;
    const edge = nearestRectEdge(point, shape);
    if (!edge) continue;
    if (!best || edge.distance < best.distance) best = { ...edge, shape };
  }
  const threshold = Math.max(2.5, Number(c.pitch ?? 1) * 0.65, Number(c.beadWidth ?? 0.42) * 6);
  if (!best || best.distance > threshold) return null;
  const pointOnEdge = snapAlongRectEdge(best.projected, best.edge, best.shape, c);
  return {
    point: pointOnEdge,
    distance: best.distance,
    normal: best.normal,
    boundaryPoint: pointOnEdge,
    selectedEdge: {
      x0: best.start.x,
      y0: best.start.y,
      x1: best.end.x,
      y1: best.end.y,
      source: "pcb-cutout",
      shapeId: best.shape.id,
    },
    clickedEdgePoint: best.projected,
    boundaryDistance: best.distance,
    source: "pcb-cutout",
    pcbShapeId: best.shape.id,
  };
}

function nearestRectEdge(point, rect) {
  const x0 = Math.min(rect.x, rect.x + rect.w);
  const x1 = Math.max(rect.x, rect.x + rect.w);
  const y0 = Math.min(rect.y, rect.y + rect.h);
  const y1 = Math.max(rect.y, rect.y + rect.h);
  const edges = [
    { edge: "left", start: { x: x0, y: y0 }, end: { x: x0, y: y1 }, normal: { x: 1, y: 0 } },
    { edge: "right", start: { x: x1, y: y0 }, end: { x: x1, y: y1 }, normal: { x: -1, y: 0 } },
    { edge: "top", start: { x: x0, y: y0 }, end: { x: x1, y: y0 }, normal: { x: 0, y: 1 } },
    { edge: "bottom", start: { x: x0, y: y1 }, end: { x: x1, y: y1 }, normal: { x: 0, y: -1 } },
  ];
  return edges
    .map((edge) => {
      const projected = closestPointOnSegment(point, edge.start, edge.end);
      return {
        ...edge,
        projected,
        distance: distance(point, projected),
      };
    })
    .sort((a, b) => a.distance - b.distance)[0] ?? null;
}

function closePolygonPath(polygon) {
  const path = (polygon ?? [])
    .filter((point) => point && Number.isFinite(Number(point.x)) && Number.isFinite(Number(point.y)))
    .map((point) => ({ x: Number(point.x), y: Number(point.y) }));
  if (path.length === 0) return [];
  const first = path[0];
  const last = path[path.length - 1];
  if (Math.abs(first.x - last.x) > 0.001 || Math.abs(first.y - last.y) > 0.001) path.push({ ...first });
  return path;
}

function isXiaoSizedVoidRect(shape) {
  if (!shape || shape.type !== "rect" || Number(shape.material) >= 0) return false;
  const profile = pcbProfileById(DEFAULT_PCB_PROFILE_ID);
  const bw = Number(profile?.board?.width);
  const bh = Number(profile?.board?.height);
  if (!Number.isFinite(bw) || !Number.isFinite(bh)) return false;
  const w = Math.abs(Number(shape.w ?? 0));
  const h = Math.abs(Number(shape.h ?? 0));
  const tolerance = 3;
  const direct = Math.abs(w - bw) <= tolerance && Math.abs(h - bh) <= tolerance;
  const rotated = Math.abs(w - bh) <= tolerance && Math.abs(h - bw) <= tolerance;
  return direct || rotated;
}

function selectableEndpointHoles(profile) {
  const holes = profile?.selectableHoles ?? [];
  const roleHoles = holes.filter(conductivePcbPin);
  return roleHoles.length > 0 ? roleHoles : holes;
}

function pcbEndpointShapes(c, shapes) {
  const rects = (shapes ?? []).filter((shape) => shape?.type === "rect");
  const explicit = rects.filter(isPcbCutoutShape);
  if (explicit.length > 0) return explicit;
  if (!c?.pcbPinContactsEnabled) return [];
  const voidRects = rects.filter((shape) => Number(shape.material) < 0);
  if (voidRects.length === 1) return voidRects;
  return voidRects.filter(isXiaoSizedVoidRect);
}

function profileUsesFixedEndpointPins(profile) {
  return (profile?.selectableHoles ?? []).some(conductivePcbPin);
}

function pcbPinTriggerRadius(c, width) {
  return Math.max(2.4, Math.min(4.0, Number(c.pitch ?? 1) * 1.35, Number(width) * 0.9));
}

function pcbPinHitMargin(c) {
  return Math.max(0.8, Number(c?.beadWidth ?? 0.42) * 2, Number(c?.pitch ?? 1) * 0.25);
}

function pcbEdgeTriggerDistance(c, width) {
  return Math.max(2.4, Math.min(6.0, Number(c.pitch ?? 1) * 1.4, Number(width) * 1.2));
}

function pcbPinEdgeSpan(c, width) {
  return Math.max(Number(width) * 1.2, Number(c?.pitch ?? 1) * 0.8, Number(c?.beadWidth ?? 0.42) * 4);
}

function pointInExpandedBounds(point, bounds, margin = 0) {
  return point.x >= bounds.x - margin
    && point.x <= bounds.x + bounds.w + margin
    && point.y >= bounds.y - margin
    && point.y <= bounds.y + bounds.h + margin;
}

function pcbPinContactEndpointPoint(shape, board, hole, normal, width) {
  const center = localPcbPointToWorld({ x: Number(hole.x), y: Number(hole.y) }, shape, board);
  const nx = Number(normal?.x ?? 0);
  const ny = Number(normal?.y ?? 0);
  const length = Math.hypot(nx, ny);
  if (length <= 1e-9) return center;
  const holeRadius = Math.max(Number(hole.diameter ?? 0.85) / 2, 0.25);
  const outerHalf = Math.max(Number(width) / 2, holeRadius + 0.45);
  const innerHalf = Math.max(0.25, holeRadius + 0.12);
  const ringMidline = (innerHalf + outerHalf) / 2;
  return {
    x: center.x + (nx / length) * ringMidline,
    y: center.y + (ny / length) * ringMidline,
  };
}

function pcbHoleBoardEdgeAnchor(shape, board, hole) {
  const bw = Number(board.width);
  const bh = Number(board.height);
  const x = Number(hole.x);
  const y = Number(hole.y);
  const distances = [
    { side: "left", distance: x, point: { x: 0, y } },
    { side: "right", distance: bw - x, point: { x: bw, y } },
    { side: "top", distance: bh - y, point: { x, y: bh } },
    { side: "bottom", distance: y, point: { x, y: 0 } },
  ];
  const nearest = distances.sort((a, b) => a.distance - b.distance)[0];
  return localPcbPointToWorld(nearest.point, shape, board);
}

function pcbHoleRows(profile) {
  const holes = profile?.selectableHoles ?? [];
  if (holes.length === 0) return [];
  const groups = new Map();
  for (const hole of holes) {
    const key = hole.id?.startsWith("top") ? "top" : hole.id?.startsWith("bottom") ? "bottom" : String(Math.round(hole.y * 10));
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(hole);
  }
  return [...groups.entries()].map(([id, rowHoles]) => {
    const xs = rowHoles.map((hole) => Number(hole.x));
    const ys = rowHoles.map((hole) => Number(hole.y));
    return {
      id,
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      y: ys.reduce((sum, value) => sum + value, 0) / Math.max(1, ys.length),
      holeDiameter: Math.max(...rowHoles.map((hole) => Number(hole.diameter ?? 0.85))),
    };
  });
}

function contactStripPolygon(shape, profile, row, width) {
  const board = profile?.board;
  if (!board || !Number.isFinite(Number(board.width)) || !Number.isFinite(Number(board.height))) return [];
  const margin = Math.max(width * 0.55, row.holeDiameter * 0.9);
  const bw = Number(board.width);
  const bh = Number(board.height);
  const localRect = {
    x0: clamp(row.minX - margin, 0, bw),
    x1: clamp(row.maxX + margin, 0, bw),
    y0: clamp(row.y - width / 2, 0, bh),
    y1: clamp(row.y + width / 2, 0, bh),
  };
  return [
    { x: localRect.x0, y: localRect.y0 },
    { x: localRect.x1, y: localRect.y0 },
    { x: localRect.x1, y: localRect.y1 },
    { x: localRect.x0, y: localRect.y1 },
  ].map((point) => localPcbPointToWorld(point, shape, board));
}

function pinContactPolygon(shape, profile, hole, width) {
  const board = profile?.board;
  if (!board || !Number.isFinite(Number(board.width)) || !Number.isFinite(Number(board.height))) return [];
  const bw = Number(board.width);
  const bh = Number(board.height);
  const half = Math.max(width / 2, Number(hole.diameter ?? 0.85) * 0.65);
  const localRect = {
    x0: clamp(Number(hole.x) - half, 0, bw),
    x1: clamp(Number(hole.x) + half, 0, bw),
    y0: clamp(Number(hole.y) - half, 0, bh),
    y1: clamp(Number(hole.y) + half, 0, bh),
  };
  return [
    { x: localRect.x0, y: localRect.y0 },
    { x: localRect.x1, y: localRect.y0 },
    { x: localRect.x1, y: localRect.y1 },
    { x: localRect.x0, y: localRect.y1 },
  ].map((localPoint) => localPcbPointToWorld(localPoint, shape, board));
}

function pinContactEscapePolygon(shape, profile, hole, width) {
  const board = profile?.board;
  if (!board || !Number.isFinite(Number(board.width)) || !Number.isFinite(Number(board.height))) return [];
  const bw = Number(board.width);
  const bh = Number(board.height);
  const half = Math.max(width / 2, Number(hole.diameter ?? 0.85) * 0.65);
  const cx = Number(hole.x);
  const cy = Number(hole.y);
  const distances = [
    { side: "left", distance: cx },
    { side: "right", distance: bw - cx },
    { side: "top", distance: bh - cy },
    { side: "bottom", distance: cy },
  ];
  const nearest = distances.sort((a, b) => a.distance - b.distance)[0]?.side;
  let rect = null;
  if (nearest === "left") {
    rect = { x0: 0, x1: Math.min(bw, cx + half), y0: clamp(cy - half, 0, bh), y1: clamp(cy + half, 0, bh) };
  } else if (nearest === "right") {
    rect = { x0: Math.max(0, cx - half), x1: bw, y0: clamp(cy - half, 0, bh), y1: clamp(cy + half, 0, bh) };
  } else if (nearest === "top") {
    rect = { x0: clamp(cx - half, 0, bw), x1: clamp(cx + half, 0, bw), y0: Math.max(0, cy - half), y1: bh };
  } else {
    rect = { x0: clamp(cx - half, 0, bw), x1: clamp(cx + half, 0, bw), y0: 0, y1: Math.min(bh, cy + half) };
  }
  if (!rect || rect.x1 - rect.x0 <= 0.05 || rect.y1 - rect.y0 <= 0.05) return [];
  return rectToWorldPolygon(rect, shape, board);
}

function gridAlignedPcbPinEscapePolygon(c, shape, profile, hole, width) {
  const polygon = pinContactEscapePolygon(shape, profile, hole, width);
  if (polygon.length < 3) return polygon;
  const bounds = polygonBounds(polygon);
  const origin = printableGridOrigin(c, []);
  const pitch = Math.max(0.001, Number(c?.pitch ?? 1));
  let x0 = floorToGrid(bounds.x, origin.x, pitch);
  let x1 = ceilToGrid(bounds.x + bounds.w, origin.x, pitch);
  let y0 = floorToGrid(bounds.y, origin.y, pitch);
  let y1 = ceilToGrid(bounds.y + bounds.h, origin.y, pitch);
  if (x1 - x0 < pitch * 0.95) {
    const mid = roundToGrid(bounds.x + bounds.w / 2, origin.x, pitch);
    x0 = mid - pitch / 2;
    x1 = mid + pitch / 2;
  }
  if (y1 - y0 < pitch * 0.95) {
    const mid = roundToGrid(bounds.y + bounds.h / 2, origin.y, pitch);
    y0 = mid - pitch / 2;
    y1 = mid + pitch / 2;
  }
  return [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ];
}

function pinContactRingPolygons(shape, profile, hole, width) {
  const board = profile?.board;
  if (!board || !Number.isFinite(Number(board.width)) || !Number.isFinite(Number(board.height))) return [];
  const bw = Number(board.width);
  const bh = Number(board.height);
  const holeRadius = Math.max(Number(hole.diameter ?? 0.85) / 2, 0.25);
  const outerHalf = Math.max(width / 2, holeRadius + 0.45);
  const innerHalf = pinHoleInnerHalf(hole, width);
  const cx = Number(hole.x);
  const cy = Number(hole.y);
  const outer = {
    x0: clamp(cx - outerHalf, 0, bw),
    x1: clamp(cx + outerHalf, 0, bw),
    y0: clamp(cy - outerHalf, 0, bh),
    y1: clamp(cy + outerHalf, 0, bh),
  };
  const inner = {
    x0: clamp(cx - innerHalf, outer.x0, outer.x1),
    x1: clamp(cx + innerHalf, outer.x0, outer.x1),
    y0: clamp(cy - innerHalf, outer.y0, outer.y1),
    y1: clamp(cy + innerHalf, outer.y0, outer.y1),
  };
  const rects = [
    { x0: outer.x0, x1: outer.x1, y0: outer.y0, y1: inner.y0 },
    { x0: outer.x0, x1: outer.x1, y0: inner.y1, y1: outer.y1 },
    { x0: outer.x0, x1: inner.x0, y0: inner.y0, y1: inner.y1 },
    { x0: inner.x1, x1: outer.x1, y0: inner.y0, y1: inner.y1 },
  ];
  return rects
    .filter((rect) => rect.x1 - rect.x0 > 0.05 && rect.y1 - rect.y0 > 0.05)
    .map((rect) => rectToWorldPolygon(rect, shape, board));
}

function pinHoleVoidPolygon(shape, profile, hole, width) {
  const board = profile?.board;
  if (!board || !Number.isFinite(Number(board.width)) || !Number.isFinite(Number(board.height))) return [];
  const bw = Number(board.width);
  const bh = Number(board.height);
  const half = pinHoleInnerHalf(hole, width);
  const cx = Number(hole.x);
  const cy = Number(hole.y);
  return rectToWorldPolygon({
    x0: clamp(cx - half, 0, bw),
    x1: clamp(cx + half, 0, bw),
    y0: clamp(cy - half, 0, bh),
    y1: clamp(cy + half, 0, bh),
  }, shape, board);
}

function pinHoleInnerHalf(hole, width) {
  const holeRadius = Math.max(Number(hole.diameter ?? 0.85) / 2, 0.25);
  return Math.max(0.25, holeRadius + 0.27, Number(width) * 0.45);
}

function rectToWorldPolygon(rect, shape, board) {
  return [
    { x: rect.x0, y: rect.y0 },
    { x: rect.x1, y: rect.y0 },
    { x: rect.x1, y: rect.y1 },
    { x: rect.x0, y: rect.y1 },
  ].map((localPoint) => localPcbPointToWorld(localPoint, shape, board));
}

function individualPinContactWidth(profile, hole, requestedWidth) {
  const rowHoles = (profile?.selectableHoles ?? [])
    .filter((candidate) => Math.abs(Number(candidate.y) - Number(hole.y)) <= 0.01)
    .map((candidate) => Number(candidate.x))
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  let nearestSpacing = Infinity;
  for (let i = 1; i < rowHoles.length; i += 1) {
    nearestSpacing = Math.min(nearestSpacing, Math.abs(rowHoles[i] - rowHoles[i - 1]));
  }
  const maxWidth = Number.isFinite(nearestSpacing) ? nearestSpacing * 0.82 : requestedWidth;
  return Math.max(0.2, Math.min(Number(requestedWidth), maxWidth));
}

function pcbPinRefKey(shapeId, pinId) {
  return `${shapeId}:${pinId}`;
}

function localPcbPointToWorld(point, shape, board) {
  const bw = Number(board.width);
  const bh = Number(board.height);
  const cx = shape.x + shape.w / 2;
  const cy = shape.y + shape.h / 2;
  const localX = point.x - bw / 2;
  const localY = point.y - bh / 2;
  const quarter = pcbRotationQuarter(shape, bw, bh);
  if (quarter === 1) {
    return { x: cx + localY, y: cy - localX };
  }
  if (quarter === 2) {
    return { x: cx - localX, y: cy - localY };
  }
  if (quarter === 3) {
    return { x: cx - localY, y: cy + localX };
  }
  return {
    x: cx + localX,
    y: cy + localY,
  };
}

function pcbRotationQuarter(shape, boardWidth, boardHeight) {
  const rawRotation = Number(shape.rotation);
  if (Number.isFinite(rawRotation)) {
    return ((Math.round(rawRotation / (Math.PI / 2)) % 4) + 4) % 4;
  }
  return Math.abs(shape.w - boardHeight) < Math.abs(shape.w - boardWidth) ? 1 : 0;
}

function polygonBounds(polygon) {
  const xs = polygon.map((point) => point.x);
  const ys = polygon.map((point) => point.y);
  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    w: Math.max(...xs) - Math.min(...xs),
    h: Math.max(...ys) - Math.min(...ys),
  };
}

function snapAlongRectEdge(point, edge, rect, c) {
  const pitch = Math.max(0.001, Number(c.pitch ?? 1));
  if (edge === "left" || edge === "right") {
    return {
      x: point.x,
      y: clamp(roundToGrid(point.y, rect.y, pitch), Math.min(rect.y, rect.y + rect.h), Math.max(rect.y, rect.y + rect.h)),
    };
  }
  return {
    x: clamp(roundToGrid(point.x, rect.x, pitch), Math.min(rect.x, rect.x + rect.w), Math.max(rect.x, rect.x + rect.w)),
    y: point.y,
  };
}

function roundToGrid(value, origin, pitch) {
  return origin + Math.round((value - origin) / pitch) * pitch;
}

function floorToGrid(value, origin, pitch) {
  return origin + Math.floor((value - origin + 0.001) / pitch) * pitch;
}

function ceilToGrid(value, origin, pitch) {
  return origin + Math.ceil((value - origin - 0.001) / pitch) * pitch;
}

function closestPointOnSegment(point, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= 1e-9) return { ...a };
  const t = clamp(((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared, 0, 1);
  return { x: a.x + dx * t, y: a.y + dy * t };
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function unitNormal(normal) {
  const x = Number(normal?.x ?? 0);
  const y = Number(normal?.y ?? 0);
  const length = Math.hypot(x, y);
  if (length <= 1e-9) return null;
  return { x: x / length, y: y / length };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
