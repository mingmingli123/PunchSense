export function createShapeClipboardActions(deps) {
  const {
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
  } = deps;

  function copySelectedShapes() {
    const indices = selectedShapeIndices().sort((a, b) => a - b);
    if (indices.length === 0) return false;
    const selectedIds = new Set(indices.map((index) => state.shapes[index]?.id).filter(Boolean));
    state.clipboard = {
      shapes: indices.map((index) => cloneShape(state.shapes[index])),
      regionMaterialOverrides: [...state.regionMaterialOverrides.entries()]
        .filter(([key]) => regionKeyIds(key).every((id) => selectedIds.has(id)))
        .map(([key, material]) => [key, material]),
      pasteCount: 0,
    };
    setSvgImportStatus(`已复制 ${indices.length} 个图形；按 Ctrl/Cmd+V 粘贴。`);
    return true;
  }

  function pasteCopiedShapes() {
    if (!state.clipboard.shapes || state.clipboard.shapes.length === 0) return false;
    pushUndoSnapshot();
    state.clipboard.pasteCount += 1;
    const offset = Math.min(20, 5 * state.clipboard.pasteCount);
    const idMap = new Map();
    const pasted = state.clipboard.shapes.map((shape) => duplicateShapeWithNewId(shape, cloneShape, idMap));
    const firstIndex = state.shapes.length;
    state.shapes.push(...pasted);
    const pastedIndices = pasted.map((_, index) => firstIndex + index);
    moveShapes(pastedIndices, offset, offset, config());
    for (const [key, material] of state.clipboard.regionMaterialOverrides) {
      const sourceIds = regionKeyIds(key);
      const nextIds = sourceIds.map((id) => idMap.get(id)).filter(Boolean);
      if (nextIds.length === sourceIds.length) {
        state.regionMaterialOverrides.set(nextIds.sort().join("|"), material);
      }
    }
    setSelectedShapes(pastedIndices, pastedIndices[0] ?? -1);
    cleanupRegionOverrides();
    draw();
    setSvgImportStatus(`已粘贴 ${pasted.length} 个图形；位置已偏移 ${offset.toFixed(1)} mm。`);
    return true;
  }

  return {
    copySelectedShapes,
    pasteCopiedShapes,
  };
}
