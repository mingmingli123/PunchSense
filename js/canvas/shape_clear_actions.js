export function createShapeClearActions(deps) {
  const {
    state,
    svgImportStatus,
    draw,
    pushUndoSnapshot,
    setSelectedShapes,
  } = deps;

  function clearShapes() {
    if (state.shapes.length > 0 || state.path.length > 0 || state.frame.w > 0 || state.frame.h > 0) {
      pushUndoSnapshot();
    }
    state.shapeMode = "empty";
    state.frame = { x: 0, y: 0, w: 0, h: 0 };
    state.path = [];
    state.shapes = [];
    state.regionMaterialOverrides.clear();
    state.selectedRegionKey = null;
    state.selectedRegionPoint = null;
    state.polylineClosed = false;
    state.activeVertexIndex = -1;
    setSelectedShapes([]);
    state.activeShapeHandle = null;
    state.activeShapeMove = null;
    state.pendingShape = null;
    state.draftShape = null;
    clearTpuSnake(false);
    draw();
  }

  function clearTpuSnake(redraw = true) {
    state.tpuSnake.endpoints = [];
    state.tpuSnake.connections = [];
    state.tpuSnake.picking = false;
    state.tpuSnake.editingConnectionIndex = -1;
    state.tpuSnake.selectedConnectionIndex = -1;
    state.tpuSnake.conflict = null;
    const picker = document.getElementById("pickTpuSnakeEndpoints");
    if (picker) picker.textContent = "新增 TPU 蛇形线";
    if (redraw) draw();
  }

  function setSvgImportStatus(message) {
    if (svgImportStatus) svgImportStatus.textContent = `SVG 导入：${message}`;
  }

  return {
    clearShapes,
    clearTpuSnake,
    setSvgImportStatus,
  };
}
