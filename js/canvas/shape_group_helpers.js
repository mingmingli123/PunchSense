export function createShapeGroupHelpers(deps) {
  const {
    state,
  } = deps;

  function selectionCoversAllShapes(indices) {
    const selected = new Set(indices ?? []);
    return state.shapes.length > 0 && selected.size === state.shapes.length;
  }

  function completeImportGroupsForIndices(indices) {
    const selected = new Set(indices ?? []);
    const groups = new Map();
    for (let i = 0; i < state.shapes.length; i += 1) {
      const groupId = state.shapes[i]?.importGroupId;
      if (typeof groupId !== "string" || !groupId) continue;
      if (!groups.has(groupId)) groups.set(groupId, { total: 0, selected: 0 });
      const group = groups.get(groupId);
      group.total += 1;
      if (selected.has(i)) group.selected += 1;
    }
    return new Set(
      [...groups.entries()]
        .filter(([, group]) => group.total > 0 && group.total === group.selected)
        .map(([groupId]) => groupId),
    );
  }

  return {
    selectionCoversAllShapes,
    completeImportGroupsForIndices,
  };
}
