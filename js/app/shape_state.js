export function createShapeStateController(deps) {
  const { state } = deps;

  function shapeLabel(mode) {
    if (mode === "free") return "自由线";
    if (mode === "polyline") return state.polylineClosed ? "多边形" : "多边形编辑中";
    return "矩形";
  }

  function armShapePlacement(type) {
    state.pendingShape = type;
    state.draftShape = null;
  }

  return {
    armShapePlacement,
    shapeLabel,
  };
}
