export function createSelectionController(deps) {
  const {
    state,
    controls,
    assignMaterialToSelectedRegion,
    pushUndoSnapshot,
    draw,
  } = deps;

  function setSelectedShapes(indices, primaryIndex = null, keepRegion = false) {
    if (!keepRegion) {
      state.selectedRegionKey = null;
      state.selectedRegionPoint = null;
    }
    const valid = indices.filter((index) => index >= 0 && state.shapes[index]);
    state.selectedShapeIndices = new Set(valid);
    state.selectedShapeIndex = primaryIndex !== null && valid.includes(primaryIndex)
      ? primaryIndex
      : valid[valid.length - 1] ?? -1;
    syncMaterialSelectToPrimary();
  }

  function selectSingleShape(index) {
    setSelectedShapes(index >= 0 ? [index] : [], index);
  }

  function toggleSelectedShape(index) {
    const next = new Set(state.selectedShapeIndices);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    setSelectedShapes([...next], index);
  }

  function selectedShapeIndices() {
    if (state.selectedShapeIndices.size > 0) {
      return [...state.selectedShapeIndices].filter((index) => state.shapes[index]);
    }
    return state.selectedShapeIndex >= 0 && state.shapes[state.selectedShapeIndex]
      ? [state.selectedShapeIndex]
      : [];
  }

  function syncMaterialSelectToPrimary() {
    if (state.selectedShapeIndex >= 0 && state.shapes[state.selectedShapeIndex]) {
      const shape = state.shapes[state.selectedShapeIndex];
      controls.shapeMaterial.value = String(shape.material ?? controls.tool.value);
      if (Number(shape.material ?? controls.tool.value) === 0) {
        controls.tpuFillMode.value = shape.tpuFillMode ?? state.defaultTpuFillMode;
      }
    } else {
      controls.tpuFillMode.value = state.defaultTpuFillMode;
    }
  }

  function assignMaterialToSelection(material) {
    if (assignMaterialToSelectedRegion(material)) return true;
    const indices = selectedShapeIndices();
    if (indices.length === 0) return false;
    pushUndoSnapshot();
    let changed = false;
    for (const index of indices) {
      if (state.shapes[index]?.lockedMaterial) continue;
      state.shapes[index].material = material;
      changed = true;
    }
    controls.shapeMaterial.value = changed ? String(material) : "-1";
    draw();
    return true;
  }

  return {
    assignMaterialToSelection,
    selectSingleShape,
    selectedShapeIndices,
    setSelectedShapes,
    syncMaterialSelectToPrimary,
    toggleSelectedShape,
  };
}
