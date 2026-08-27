export function createShapeTools(deps) {
  const {
    state,
    controls,
    config,
    pushUndoSnapshot,
    normalizeFrame,
    rectPolygon,
    polygonBounds,
    polygonSides,
    distance,
  } = deps;

  function addBasicShapeAt(type, point) {
    pushUndoSnapshot();
    state.shapes.push(createBasicShape(type, point, defaultShapeRadius()));
  }

  function createImportedPolygonShape(points, material, importGroupId = null) {
    return {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      type: "polygon",
      points,
      material,
      importGroupId,
    };
  }

  function createBasicShape(type, point, radius, rotation = null) {
    return {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      type,
      x: point.x,
      y: point.y,
      r: radius,
      rotation,
      material: Number(controls.shapeMaterial.value),
    };
  }

  function createRectShapeFromDrag(start, point) {
    const frame = normalizeFrame({ x: start.x, y: start.y, w: point.x - start.x, h: point.y - start.y });
    return createRectShape(frame);
  }

  function createRectShape(frame) {
    return {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      type: "rect",
      x: frame.x,
      y: frame.y,
      w: Math.max(0.1, frame.w),
      h: Math.max(0.1, frame.h),
      material: Number(controls.shapeMaterial.value),
    };
  }

  function updateRectFromCorner(shape, cornerIndex, point) {
    const opposite = rectPolygon(shape)[(cornerIndex + 2) % 4];
    const frame = normalizeFrame({ x: opposite.x, y: opposite.y, w: point.x - opposite.x, h: point.y - opposite.y });
    shape.x = frame.x;
    shape.y = frame.y;
    shape.w = Math.max(0.1, frame.w);
    shape.h = Math.max(0.1, frame.h);
  }

  function updateRectFromCornerProportional(shape, cornerIndex, point) {
    const bounds = normalizeFrame(shape);
    updateRectFromCorner(shape, cornerIndex, proportionalCornerPoint(bounds, cornerIndex, point));
  }

  function proportionalCornerPoint(bounds, cornerIndex, point) {
    const opposite = rectPolygon(bounds)[(cornerIndex + 2) % 4];
    const corner = rectPolygon(bounds)[cornerIndex];
    const signX = Math.sign(corner.x - opposite.x) || 1;
    const signY = Math.sign(corner.y - opposite.y) || 1;
    const sx = Math.abs((point.x - opposite.x) / Math.max(bounds.w, 0.001));
    const sy = Math.abs((point.y - opposite.y) / Math.max(bounds.h, 0.001));
    const scale = Math.max(0.01, Math.min(sx, sy));
    return {
      x: opposite.x + signX * bounds.w * scale,
      y: opposite.y + signY * bounds.h * scale,
    };
  }

  function updatePolygonFromBoundsCorner(shape, cornerIndex, point, proportional = false) {
    const oldBounds = polygonBounds(shape.points);
    const opposite = rectPolygon(oldBounds)[(cornerIndex + 2) % 4];
    const adjusted = proportional ? proportionalCornerPoint(oldBounds, cornerIndex, point) : point;
    const nextBounds = normalizeFrame({ x: opposite.x, y: opposite.y, w: adjusted.x - opposite.x, h: adjusted.y - opposite.y });
    if (nextBounds.w < 0.1 || nextBounds.h < 0.1 || oldBounds.w < 0.1 || oldBounds.h < 0.1) return;
    shape.points = shape.points.map((p) => ({
      x: nextBounds.x + ((p.x - oldBounds.x) / oldBounds.w) * nextBounds.w,
      y: nextBounds.y + ((p.y - oldBounds.y) / oldBounds.h) * nextBounds.h,
    }));
  }

  function createBasicShapeFromEdgeDrag(type, start, point) {
    const r = Math.max(4, Math.min(120, distance(start, point) / 2));
    const center = distance(start, point) > 0
      ? { x: (start.x + point.x) / 2, y: (start.y + point.y) / 2 }
      : { x: start.x, y: start.y };
    return createBasicShape(type, center, r);
  }

  function defaultShapeRadius() {
    const c = config();
    return Math.min(28, Math.max(12, Math.min(c.bedWidth, c.bedDepth) * 0.08));
  }

  return {
    addBasicShapeAt,
    createImportedPolygonShape,
    createBasicShape,
    createRectShapeFromDrag,
    createRectShape,
    updateRectFromCorner,
    updateRectFromCornerProportional,
    proportionalCornerPoint,
    updatePolygonFromBoundsCorner,
    createBasicShapeFromEdgeDrag,
    defaultShapeRadius,
  };
}
