export function createUndoController(deps) {
  const {
    state,
    cloneShape,
    cloneSnakeEndpoint,
    cloneSnakeConnection,
    unlockCanvasDrag,
    syncMaterialSelectToPrimary,
    draw,
  } = deps;

  function pushUndoSnapshot() {
    state.undoStack.push({
      shapeMode: state.shapeMode,
      defaultTpuFillMode: state.defaultTpuFillMode,
      frame: { ...state.frame },
      path: state.path.map((point) => ({ ...point })),
      shapes: state.shapes.map(cloneShape),
      polylineClosed: state.polylineClosed,
      selectedShapeIndex: state.selectedShapeIndex,
      selectedShapeIndices: [...state.selectedShapeIndices],
      regionMaterialOverrides: [...state.regionMaterialOverrides.entries()],
      selectedRegionKey: state.selectedRegionKey,
      selectedRegionPoint: state.selectedRegionPoint ? { ...state.selectedRegionPoint } : null,
      tpuSnake: {
        endpoints: state.tpuSnake.endpoints.map((endpoint) => cloneSnakeEndpoint(endpoint)),
        connections: state.tpuSnake.connections.map((connection) => cloneSnakeConnection(connection)),
        selectedConnectionIndex: state.tpuSnake.selectedConnectionIndex,
      },
    });
    if (state.undoStack.length > 60) state.undoStack.shift();
  }

  function undoLastOperation() {
    const snapshot = state.undoStack.pop();
    if (!snapshot) return false;
    state.shapeMode = snapshot.shapeMode;
    state.defaultTpuFillMode = snapshot.defaultTpuFillMode ?? state.defaultTpuFillMode;
    state.frame = { ...snapshot.frame };
    state.path = snapshot.path.map((point) => ({ ...point }));
    state.shapes = snapshot.shapes.map(cloneShape);
    state.polylineClosed = snapshot.polylineClosed;
    state.selectedShapeIndex = snapshot.selectedShapeIndex;
    state.selectedShapeIndices = new Set(snapshot.selectedShapeIndices);
    state.regionMaterialOverrides = new Map(snapshot.regionMaterialOverrides);
    state.selectedRegionKey = snapshot.selectedRegionKey;
    state.selectedRegionPoint = snapshot.selectedRegionPoint ? { ...snapshot.selectedRegionPoint } : null;
    if (snapshot.tpuSnake) {
      state.tpuSnake.endpoints = snapshot.tpuSnake.endpoints.map(cloneSnakeEndpoint);
      state.tpuSnake.connections = snapshot.tpuSnake.connections.map(cloneSnakeConnection);
      state.tpuSnake.selectedConnectionIndex = snapshot.tpuSnake.selectedConnectionIndex ?? -1;
      state.tpuSnake.picking = false;
      state.tpuSnake.editingConnectionIndex = -1;
      state.tpuSnake.conflict = null;
    }
    state.activeShapeHandle = null;
    state.activeShapeMove = null;
    state.draftShape = null;
    state.pendingShape = null;
    state.dragging = false;
    unlockCanvasDrag();
    syncMaterialSelectToPrimary();
    draw();
    return true;
  }

  return {
    pushUndoSnapshot,
    undoLastOperation,
  };
}
