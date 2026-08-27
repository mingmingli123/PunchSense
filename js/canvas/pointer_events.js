import { createPointerHelpers } from "./pointer_helpers.js";
import { bindCanvasScrollLockEvents } from "./scroll_lock_bindings.js";

export function bindCanvasPointerEvents(deps) {
  const {
    canvas,
    controls,
    state,
    config,
    fit,
    pxToMm,
    polygonBounds,
    normalizeFrame,
    pointInAnyPolygon,
    simplifyPath,
    distancePointToSegment,
    clamp,
    currentTpuSnakePreviewPaths,
    draw,
    drawSelectionPreview,
    scheduleSelectionPreview,
    cancelScheduledSelectionPreview,
    lockCanvasDrag,
    unlockCanvasDrag,
    preventPageScrollDuringCanvasDrag,
    pushUndoSnapshot,
    setSelectedShapes,
    selectSingleShape,
    toggleSelectedShape,
    selectedShapeIndices,
    selectRegionAtPoint,
    nearestShapeHandle,
    hitShape,
    nearestVertex,
    pickTpuSnakeEndpoint,
    startTpuSnakeEndpointPicking,
    openShapeSizeEditor,
    clearShapes,
    createRectShapeFromDrag,
    createBasicShapeFromEdgeDrag,
    updateShapeFromHandle,
    moveShapeByPointer,
  } = deps;
  const {
    canvasPoint,
    clampPoint,
    hitTpuSnakePath,
  } = createPointerHelpers({
    canvas,
    controls,
    clamp,
    distancePointToSegment,
    currentTpuSnakePreviewPaths,
  });

  canvas.addEventListener("pointerdown", (event) => {
    if (event.button === 2) return;
    event.preventDefault();
    if (document.activeElement && document.activeElement !== document.body) {
      document.activeElement.blur();
    }
    const f = fit();
    const p = canvasPoint(event);
    const mm = pxToMm(p.x, p.y, f);
    const c = config();
    const point = clampPoint(mm, c);
    const mode = controls.drawMode.value;
    state.undoSavedForDrag = false;

    if (state.tpuSnake.picking) {
      pickTpuSnakeEndpoint(point, c);
      return;
    }

    if (state.pendingShape) {
      pushUndoSnapshot();
      state.undoSavedForDrag = true;
      state.draftShape = createBasicShapeFromEdgeDrag(state.pendingShape, point, point);
      state.dragging = true;
      lockCanvasDrag();
      state.dragStart = point;
      selectSingleShape(-1);
      canvas.setPointerCapture(event.pointerId);
      drawSelectionPreview();
      return;
    }

    if (controls.regionSelectMode.checked && !event.shiftKey) {
      if (selectRegionAtPoint(point, c)) return;
      state.selectedRegionKey = null;
      state.selectedRegionPoint = null;
      setSelectedShapes([]);
      drawSelectionPreview();
      return;
    }

    const handle = nearestShapeHandle(point, c);
    if (handle) {
      if (handle.type === "groupBounds") {
        pushUndoSnapshot();
        state.undoSavedForDrag = true;
        state.activeShapeHandle = handle;
        state.dragging = true;
        lockCanvasDrag();
        canvas.setPointerCapture(event.pointerId);
        drawSelectionPreview();
        return;
      }
      if (event.shiftKey) {
        toggleSelectedShape(handle.shapeIndex);
        drawSelectionPreview();
        return;
      }
      pushUndoSnapshot();
      state.undoSavedForDrag = true;
      selectSingleShape(handle.shapeIndex);
      state.activeShapeHandle = handle;
      state.dragging = true;
      lockCanvasDrag();
      canvas.setPointerCapture(event.pointerId);
      drawSelectionPreview();
      return;
    }

    const shapeIndex = hitShape(point, c);
    if (shapeIndex >= 0) {
      if (event.shiftKey) {
        toggleSelectedShape(shapeIndex);
        drawSelectionPreview();
        return;
      }
      const selected = selectedShapeIndices();
      const moveIndices = selected.length > 1 && selected.includes(shapeIndex) ? selected : [shapeIndex];
      if (moveIndices.length === 1) selectSingleShape(shapeIndex);
      pushUndoSnapshot();
      state.undoSavedForDrag = true;
      state.activeShapeMove = { shapeIndices: moveIndices, lastPoint: point };
      state.dragging = true;
      lockCanvasDrag();
      canvas.setPointerCapture(event.pointerId);
      drawSelectionPreview();
      return;
    }
    if (!event.shiftKey) selectSingleShape(-1);

    if (mode === "polyline") {
      state.shapeMode = "polyline";
      if (state.polylineClosed) {
        const vertex = nearestVertex(point, c);
        if (vertex.index >= 0) {
          pushUndoSnapshot();
          state.undoSavedForDrag = true;
          state.activeVertexIndex = vertex.index;
          state.dragging = true;
          lockCanvasDrag();
          canvas.setPointerCapture(event.pointerId);
        }
      } else if (state.path.length === 0) {
        pushUndoSnapshot();
        state.undoSavedForDrag = true;
        state.path = [point];
        state.polylineClosed = false;
      } else {
        pushUndoSnapshot();
        state.path.push(point);
        if (state.path.length >= 3) state.frame = polygonBounds(state.path);
      }
      draw({ deferSnakeStats: true });
      return;
    }

    state.dragging = true;
    pushUndoSnapshot();
    state.undoSavedForDrag = true;
    lockCanvasDrag();
    state.dragStart = mm;
    state.shapeMode = mode;
    if (state.shapeMode === "free") {
      state.path = [point];
      state.polylineClosed = false;
    } else if (state.shapeMode === "rect") {
      state.path = [];
      state.polylineClosed = false;
      state.frame = { x: 0, y: 0, w: 0, h: 0 };
      state.draftShape = createRectShapeFromDrag(point, point);
    } else {
      state.path = [];
      state.polylineClosed = false;
      state.frame = { x: mm.x, y: mm.y, w: 0, h: 0 };
    }
    canvas.setPointerCapture(event.pointerId);
    draw();
  }, { passive: false });

  canvas.addEventListener("pointermove", (event) => {
    if (!state.dragging) return;
    event.preventDefault();
    const f = fit();
    const p = canvasPoint(event);
    const mm = pxToMm(p.x, p.y, f);
    const c = config();
    const point = clampPoint(mm, c);
    if (state.activeShapeHandle) {
      updateShapeFromHandle(state.activeShapeHandle, point, event.shiftKey);
    } else if (state.activeShapeMove) {
      moveShapeByPointer(state.activeShapeMove, point, c, { disableSnap: event.altKey });
    } else if (state.draftShape?.type === "rect") {
      state.draftShape = createRectShapeFromDrag(state.dragStart, point);
    } else if (state.draftShape) {
      state.draftShape = createBasicShapeFromEdgeDrag(state.draftShape.type, state.dragStart, point);
    } else if (state.shapeMode === "free") {
      const last = state.path[state.path.length - 1];
      if (!last || Math.hypot(point.x - last.x, point.y - last.y) > 0.8) {
        state.path.push(point);
        state.frame = polygonBounds(state.path);
      }
    } else if (state.shapeMode === "polyline") {
      if (state.polylineClosed && state.activeVertexIndex >= 0) {
        state.path[state.activeVertexIndex] = point;
        state.frame = polygonBounds(state.path);
        scheduleSelectionPreview();
      }
      return;
    } else {
      state.frame = {
        x: state.dragStart.x,
        y: state.dragStart.y,
        w: point.x - state.dragStart.x,
        h: point.y - state.dragStart.y,
      };
    }
    scheduleSelectionPreview();
  }, { passive: false });

  canvas.addEventListener("pointerup", (event) => {
    event.preventDefault();
    cancelScheduledSelectionPreview();
    state.dragging = false;
    unlockCanvasDrag();
    if (state.activeShapeHandle) {
      state.activeShapeHandle = null;
    } else if (state.activeShapeMove) {
      state.activeShapeMove = null;
      state.snapGuides = [];
    } else if (state.draftShape) {
      if (state.draftShape.type !== "rect") state.draftShape.r = Math.max(4, state.draftShape.r);
      if (state.draftShape.type !== "rect" || (state.draftShape.w >= 1 && state.draftShape.h >= 1)) {
        state.shapes.push(state.draftShape);
        selectSingleShape(state.shapes.length - 1);
      }
      state.draftShape = null;
      state.pendingShape = null;
    } else if (state.shapeMode === "free") {
      state.path = simplifyPath(state.path, 0.7);
      if (state.path.length >= 3) state.frame = polygonBounds(state.path);
    } else if (state.shapeMode === "polyline") {
      state.activeVertexIndex = -1;
      return;
    } else {
      state.frame = normalizeFrame(state.frame);
    }
    canvas.releasePointerCapture(event.pointerId);
    state.undoSavedForDrag = false;
    draw();
  }, { passive: false });

  canvas.addEventListener("pointercancel", () => {
    cancelScheduledSelectionPreview();
    state.dragging = false;
    state.undoSavedForDrag = false;
    state.snapGuides = [];
    unlockCanvasDrag();
  });

  bindCanvasScrollLockEvents({
    state,
    preventPageScrollDuringCanvasDrag,
  });

  canvas.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    if (controls.drawMode.value === "polyline" && state.path.length >= 3) {
      state.shapeMode = "polyline";
      state.polylineClosed = true;
      state.frame = polygonBounds(state.path);
      draw();
    }
  });

  canvas.addEventListener("dblclick", (event) => {
    event.preventDefault();
    const f = fit();
    const p = canvasPoint(event);
    const mm = pxToMm(p.x, p.y, f);
    const c = config();
    if (controls.workflowMode.value === "design") {
      const shapeIndex = hitShape(mm, c);
      if (shapeIndex >= 0 && openShapeSizeEditor?.(shapeIndex)) return;
    }
    const snakeIndex = hitTpuSnakePath(mm, c);
    if (snakeIndex >= 0) {
      startTpuSnakeEndpointPicking(snakeIndex);
      return;
    }
    if (!pointInAnyPolygon(mm, c.polygons)) {
      clearShapes();
    }
  });
}
