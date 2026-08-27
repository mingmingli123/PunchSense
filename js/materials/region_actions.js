export function createMaterialRegionActions(deps) {
  const {
    state,
    controls,
    selectedShapeIndices,
    drawSelectionPreview,
    pushUndoSnapshot,
    draw,
  } = deps;

  function assignMaterialToSelectedRegion(material) {
    if (!state.selectedRegionKey) return false;
    pushUndoSnapshot();
    state.regionMaterialOverrides.set(state.selectedRegionKey, material);
    controls.shapeMaterial.value = String(material);
    draw();
    return true;
  }

  function assignTpuFillModeToSelection(fillMode) {
    const indices = selectedShapeIndices()
      .filter((index) => Number(state.shapes[index]?.material ?? controls.tool.value) === 0);
    if (indices.length === 0) return false;
    pushUndoSnapshot();
    for (const index of indices) state.shapes[index].tpuFillMode = fillMode;
    controls.tpuFillMode.value = fillMode;
    draw();
    return true;
  }

  function assignTpuFillModeToSelectionOrAllT0(fillMode) {
    if (state.selectedRegionKey) {
      controls.tpuFillMode.value = state.defaultTpuFillMode;
      drawSelectionPreview();
      return true;
    }
    const selected = selectedShapeIndices();
    const selectedT0 = selected
      .filter((index) => Number(state.shapes[index]?.material ?? controls.tool.value) === 0);
    if (selected.length > 0 && selectedT0.length === 0) {
      controls.tpuFillMode.value = state.defaultTpuFillMode;
      drawSelectionPreview();
      return true;
    }
    const targetIndices = selectedT0.length > 0
      ? selectedT0
      : state.shapes
        .map((shape, index) => ({ shape, index }))
        .filter(({ shape }) => Number(shape?.material ?? controls.tool.value) === 0)
        .map(({ index }) => index);
    if (targetIndices.length === 0) {
      state.defaultTpuFillMode = fillMode;
      return false;
    }
    pushUndoSnapshot();
    if (selectedT0.length === 0) state.defaultTpuFillMode = fillMode;
    for (const index of targetIndices) state.shapes[index].tpuFillMode = fillMode;
    controls.tpuFillMode.value = fillMode;
    state.gridRasterCache.clear();
    draw({ deferSnakeStats: true });
    return true;
  }

  return {
    assignMaterialToSelectedRegion,
    assignTpuFillModeToSelection,
    assignTpuFillModeToSelectionOrAllT0,
  };
}
