import {
  clamp,
  distance,
  pointInPolygon,
  polygonArea,
  polygonBounds,
  rectPolygon,
  unionBounds,
} from "./core/geometry.js";
import {
  shapeHandles,
  shapeToPolygon,
} from "./shape_geometry.js";

export function createShapeEditing({
  state,
  cloneShape,
  cloneTpuSnakeState,
  selectedShapeIndices,
}) {
  function hitShape(point, c) {
    const edgeHit = nearestShapeEdge(point, c);
    if (edgeHit) return edgeHit.shapeIndex;

    let best = null;
    for (let i = state.shapes.length - 1; i >= 0; i -= 1) {
      const polygon = shapeToPolygon(state.shapes[i]);
      if (!pointInPolygon(point, polygon)) continue;
      const area = polygonArea(polygon);
      if (!best || area < best.area || (Math.abs(area - best.area) < 0.001 && i > best.shapeIndex)) {
        best = { shapeIndex: i, area };
      }
    }
    return best ? best.shapeIndex : -1;
  }

  function nearestShapeEdge(point, c) {
    const threshold = Math.max(2.5, c.beadWidth * 4);
    let best = null;
    for (let shapeIndex = state.shapes.length - 1; shapeIndex >= 0; shapeIndex -= 1) {
      const polygon = shapeToPolygon(state.shapes[shapeIndex]);
      for (let i = 0; i < polygon.length; i += 1) {
        const a = polygon[i];
        const b = polygon[(i + 1) % polygon.length];
        const d = distancePointToSegment(point, a, b);
        if (d <= threshold && (!best || d < best.distance)) {
          best = { shapeIndex, edgeIndex: i, distance: d };
        }
      }
    }
    return best;
  }

  function nearestShapeHandle(point, c) {
    const threshold = Math.max(3, c.beadWidth * 4);
    const selected = selectedShapeIndices();
    if (selected.length > 1) {
      const bounds = selectedShapesBounds(selected);
      for (const handle of groupBoundsHandles(bounds)) {
        const d = distance(point, handle);
        if (d <= threshold) {
          return {
            ...handle,
            type: "groupBounds",
            shapeIndices: selected,
            startBounds: bounds,
            startShapes: selected.map((index) => cloneShape(state.shapes[index])),
            startTpuSnake: cloneTpuSnakeState(),
            distance: d,
          };
        }
      }
    }
    let best = null;
    for (let shapeIndex = state.shapes.length - 1; shapeIndex >= 0; shapeIndex -= 1) {
      for (const handle of shapeHandles(state.shapes[shapeIndex])) {
        const d = distance(point, handle);
        if (d <= threshold && (!best || d < best.distance)) {
          best = { ...handle, shapeIndex, distance: d };
        }
      }
    }
    return best;
  }

  function selectedShapesBounds(indices = selectedShapeIndices()) {
    const polygons = indices
      .map((index) => state.shapes[index])
      .filter(Boolean)
      .map(shapeToPolygon);
    return polygons.length ? unionBounds(polygons) : { x: 0, y: 0, w: 0, h: 0 };
  }

  return {
    hitShape,
    nearestShapeEdge,
    nearestShapeHandle,
    selectedShapesBounds,
  };
}

export function distancePointToSegment(point, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= 1e-9) return distance(point, a);
  const t = clamp(((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared, 0, 1);
  return distance(point, { x: a.x + dx * t, y: a.y + dy * t });
}

export function groupBoundsHandles(bounds) {
  return rectPolygon(bounds).map((point, index) => ({ ...point, type: "groupBounds", index }));
}

export function scaleShapeFromBounds(shape, oldBounds, nextBounds, sx, sy) {
  const mapPoint = (point) => ({
    x: nextBounds.x + (point.x - oldBounds.x) * sx,
    y: nextBounds.y + (point.y - oldBounds.y) * sy,
  });
  if (shape.type === "polygon") {
    return {
      ...shape,
      points: shape.points.map(mapPoint),
    };
  }
  if (shape.type === "rect") {
    const a = mapPoint({ x: shape.x, y: shape.y });
    const b = mapPoint({ x: shape.x + shape.w, y: shape.y + shape.h });
    return {
      ...shape,
      x: Math.min(a.x, b.x),
      y: Math.min(a.y, b.y),
      w: Math.max(0.1, Math.abs(b.x - a.x)),
      h: Math.max(0.1, Math.abs(b.y - a.y)),
    };
  }
  const center = mapPoint(shape);
  const scale = Math.max(0.01, (Math.abs(sx) + Math.abs(sy)) / 2);
  return {
    ...shape,
    x: center.x,
    y: center.y,
    r: Math.max(0.1, shape.r * scale),
  };
}

export function duplicateShapeWithNewId(shape, cloneShape, idMap = new Map()) {
  const copy = cloneShape(shape);
  const nextId = createId();
  if (shape.id) idMap.set(shape.id, nextId);
  copy.id = nextId;
  if (shape.importGroupId) {
    const groupKey = `group:${shape.importGroupId}`;
    if (!idMap.has(groupKey)) idMap.set(groupKey, `copy_${createId()}`);
    copy.importGroupId = idMap.get(groupKey);
  }
  return copy;
}

export function moveShape(shape, dx, dy) {
  if (shape.type === "polygon") {
    shape.points = shape.points.map((point) => ({ x: point.x + dx, y: point.y + dy }));
    return;
  }
  shape.x += dx;
  shape.y += dy;
}

export function keepShapeOnBed(shape, c) {
  const bounds = polygonBounds(shapeToPolygon(shape));
  let dx = 0;
  let dy = 0;
  if (bounds.x < 0) dx = -bounds.x;
  if (bounds.y < 0) dy = -bounds.y;
  if (bounds.x + bounds.w > c.bedWidth) dx = c.bedWidth - (bounds.x + bounds.w);
  if (bounds.y + bounds.h > c.bedDepth) dy = c.bedDepth - (bounds.y + bounds.h);
  if (dx !== 0 || dy !== 0) moveShape(shape, dx, dy);
}

function createId() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2)}`;
}
