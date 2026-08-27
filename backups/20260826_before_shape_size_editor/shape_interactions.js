import { createShapeClearActions } from "./shape_clear_actions.js";
import { createShapeClipboardActions } from "./shape_clipboard.js";
import { createShapeGroupHelpers } from "./shape_group_helpers.js";

export function createShapeInteractions(deps) {
  const {
    state,
    controls,
    config,
    svgImportStatus,
    draw,
    pushUndoSnapshot,
    setSelectedShapes,
    selectedShapeIndices,
    cleanupRegionOverrides,
    selectedShapesBounds,
    restoreTpuSnakeState,
    scaleTpuSnakeFromBounds,
    moveTpuSnake,
    moveShape,
    computeMoveSnap,
    fit,
    snapGuideScreenPx,
    updateRectFromCorner,
    updateRectFromCornerProportional,
    updatePolygonFromBoundsCorner,
    proportionalCornerPoint,
    polygonSides,
    distance,
    rectPolygon,
    normalizeFrame,
    scaleShapeFromBounds,
    cloneShape,
    duplicateShapeWithNewId,
    regionKeyIds,
  } = deps;
  const {
    clearShapes,
    clearTpuSnake,
    setSvgImportStatus,
  } = createShapeClearActions({
    state,
    svgImportStatus,
    draw,
    pushUndoSnapshot,
    setSelectedShapes,
  });
  const {
    selectionCoversAllShapes,
    completeImportGroupsForIndices,
  } = createShapeGroupHelpers({
    state,
  });

  function updateShapeFromHandle(handle, point, proportional = false) {
    if (handle.type === "groupBounds") {
      updateSelectedShapesFromGroupHandle(handle, point, proportional);
      return;
    }
    const shape = state.shapes[handle.shapeIndex];
    if (!shape) return;
    if (shape.type === "rect") {
      if (proportional) updateRectFromCornerProportional(shape, handle.index, point);
      else updateRectFromCorner(shape, handle.index, point);
      return;
    }
    if (shape.type === "polygon") {
      if (handle.type === "polygonVertex") {
        shape.points[handle.index] = { x: point.x, y: point.y };
      } else {
        updatePolygonFromBoundsCorner(shape, handle.index, point, proportional);
      }
      return;
    }
    shape.r = Math.max(4, Math.min(120, distance(shape, point)));
    if (shape.type === "triangle" || shape.type === "hexagon") {
      shape.rotation = Math.atan2(point.y - shape.y, point.x - shape.x) - (Math.PI * 2 * handle.index) / polygonSides(shape.type);
    }
  }

  function updateSelectedShapesFromGroupHandle(handle, point, proportional = false) {
    const bounds = handle.startBounds;
    if (!bounds || bounds.w <= 0.001 || bounds.h <= 0.001) return;
    const opposite = rectPolygon(bounds)[(handle.index + 2) % 4];
    const adjusted = proportional ? proportionalCornerPoint(bounds, handle.index, point) : point;
    const next = normalizeFrame({ x: opposite.x, y: opposite.y, w: adjusted.x - opposite.x, h: adjusted.y - opposite.y });
    if (next.w < 0.5 || next.h < 0.5) return;
    const sx = next.w / bounds.w;
    const sy = next.h / bounds.h;
    handle.shapeIndices.forEach((shapeIndex, i) => {
      const original = handle.startShapes[i];
      if (!original || !state.shapes[shapeIndex]) return;
      state.shapes[shapeIndex] = scaleShapeFromBounds(original, bounds, next, sx, sy);
    });
    const importGroupIds = completeImportGroupsForIndices(handle.shapeIndices);
    const transformAllSnakes = selectionCoversAllShapes(handle.shapeIndices);
    if (transformAllSnakes || importGroupIds.size > 0) {
      restoreTpuSnakeState(handle.startTpuSnake);
      scaleTpuSnakeFromBounds(bounds, next, sx, sy, transformAllSnakes ? null : importGroupIds);
    }
  }

  function moveShapeByPointer(moveState, point, c, options = {}) {
    const dx = point.x - moveState.lastPoint.x;
    const dy = point.y - moveState.lastPoint.y;
    const indices = moveState.shapeIndices ?? [moveState.shapeIndex];
    moveShapes(indices, dx, dy, c);
    state.snapGuides = [];
    if (!options.disableSnap) {
      const thresholdMm = Math.max(0.4, snapGuideScreenPx / fit().scale);
      const snap = computeMoveSnap(indices, c, thresholdMm);
      if (snap.dx !== 0 || snap.dy !== 0) moveShapes(indices, snap.dx, snap.dy, c);
      state.snapGuides = snap.guides;
    }
    moveState.lastPoint = point;
  }

  function moveShapes(indices, dx, dy, c) {
    const shapes = indices.map((index) => state.shapes[index]).filter(Boolean);
    if (shapes.length === 0) return;
    const importGroupIds = completeImportGroupsForIndices(indices);
    const moveAllSnakes = selectionCoversAllShapes(indices);
    for (const shape of shapes) moveShape(shape, dx, dy);
    if (moveAllSnakes || importGroupIds.size > 0) moveTpuSnake(dx, dy, moveAllSnakes ? null : importGroupIds);
    const bounds = selectedShapesBounds(indices);
    let fixX = 0;
    let fixY = 0;
    if (bounds.x < 0) fixX = -bounds.x;
    if (bounds.y < 0) fixY = -bounds.y;
    if (bounds.x + bounds.w > c.bedWidth) fixX = c.bedWidth - (bounds.x + bounds.w);
    if (bounds.y + bounds.h > c.bedDepth) fixY = c.bedDepth - (bounds.y + bounds.h);
    if (fixX !== 0 || fixY !== 0) {
      for (const shape of shapes) moveShape(shape, fixX, fixY);
      if (moveAllSnakes || importGroupIds.size > 0) moveTpuSnake(fixX, fixY, moveAllSnakes ? null : importGroupIds);
    }
  }

  function nearestVertex(point, c) {
    let best = { index: -1, distance: Infinity };
    state.path.forEach((vertex, index) => {
      const d = distance(point, vertex);
      if (d < best.distance) best = { index, distance: d };
    });
    return best.distance <= closeThresholdMm(c) ? best : { index: -1, distance: Infinity };
  }

  function closeThresholdMm(c) {
    return Math.max(3, c.pitch * 1.5);
  }
  const {
    copySelectedShapes,
    pasteCopiedShapes,
  } = createShapeClipboardActions({
    state,
    config,
    pushUndoSnapshot,
    selectedShapeIndices,
    setSelectedShapes,
    cleanupRegionOverrides,
    cloneShape,
    duplicateShapeWithNewId,
    regionKeyIds,
    moveShapes,
    setSvgImportStatus,
    draw,
  });

  return {
    updateShapeFromHandle,
    updateSelectedShapesFromGroupHandle,
    selectionCoversAllShapes,
    completeImportGroupsForIndices,
    moveShapeByPointer,
    moveShapes,
    nearestVertex,
    clearShapes,
    clearTpuSnake,
    setSvgImportStatus,
    copySelectedShapes,
    pasteCopiedShapes,
  };
}
