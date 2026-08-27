export function bindKeyboardShortcuts(deps) {
  const {
    state,
    undoLastOperation,
    copySelectedShapes,
    pasteCopiedShapes,
    assignMaterialToSelection,
    assignTpuFillModeToSelection,
    cleanupRegionOverrides,
    setSelectedShapes,
    selectedShapeIndices,
    pushUndoSnapshot,
    draw,
  } = deps;

  window.addEventListener("keydown", (event) => {
    const active = document.activeElement;
    const tag = active?.tagName;
    const inputType = active?.getAttribute?.("type");
    const editingInput = tag === "TEXTAREA" || tag === "SELECT" || (tag === "INPUT" && inputType !== "checkbox" && inputType !== "radio");
    if (editingInput) return;
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
      event.preventDefault();
      undoLastOperation();
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "c") {
      if (copySelectedShapes()) event.preventDefault();
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "v") {
      if (pasteCopiedShapes()) event.preventDefault();
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "a") {
      if (state.shapes.length === 0) return;
      event.preventDefault();
      setSelectedShapes(state.shapes.map((_, index) => index), 0);
      draw();
      return;
    }
    const materialKey = materialKeyFromEvent(event);
    if (materialKey !== null) {
      if (assignMaterialToSelection(materialKey)) event.preventDefault();
      return;
    }
    const fillModeKey = tpuFillModeKeyFromEvent(event);
    if (fillModeKey) {
      if (assignTpuFillModeToSelection(fillModeKey)) event.preventDefault();
      return;
    }
    if (event.key !== "Delete" && event.key !== "Backspace") return;
    const indices = selectedShapeIndices().sort((a, b) => b - a);
    if (indices.length === 0) return;
    event.preventDefault();
    pushUndoSnapshot();
    for (const index of indices) state.shapes.splice(index, 1);
    cleanupRegionOverrides();
    setSelectedShapes([]);
    state.activeShapeHandle = null;
    state.activeShapeMove = null;
    draw();
  });
}

function materialKeyFromEvent(event) {
  if (event.metaKey || event.ctrlKey || event.altKey) return null;
  if (/^[1-5]$/.test(event.key)) return materialValueForDigit(Number(event.key));
  if (/^Digit[1-5]$/.test(event.code)) return materialValueForDigit(Number(event.code.replace("Digit", "")));
  if (/^Numpad[1-5]$/.test(event.code)) return materialValueForDigit(Number(event.code.replace("Numpad", "")));
  return null;
}

function materialValueForDigit(digit) {
  return digit === 5 ? -1 : digit - 1;
}

function tpuFillModeKeyFromEvent(event) {
  if (event.metaKey || event.ctrlKey || event.altKey) return null;
  const key = event.key.toLowerCase();
  if (key === "s") return "solid";
  if (key === "g") return "grid";
  return null;
}
