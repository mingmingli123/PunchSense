function editableShapeType(shape) {
  if (!shape || shape.lockedMaterial || shape.kind === "pcb-cutout" || shape.kind === "pcb" || shape.pcbProfileId) return "";
  return shape.type === "rect" || shape.type === "circle" ? shape.type : "";
}

function setFieldVisible(field, visible) {
  if (field) field.hidden = !visible;
}

function setControlValue(control, value) {
  if (!control) return;
  control.value = Number.isFinite(value) ? value.toFixed(1) : "";
}

export function createShapeSizeEditor(deps) {
  const {
    doc = document,
    state,
    controls,
    shapeSizeEditor,
    selectSingleShape,
    pushUndoSnapshot,
    draw,
  } = deps;

  const fields = {
    width: doc.getElementById("shapeWidthField"),
    height: doc.getElementById("shapeHeightField"),
    radius: doc.getElementById("shapeRadiusField"),
    diameter: doc.getElementById("shapeDiameterField"),
  };
  let editingShapeIndex = -1;
  let undoStarted = false;
  let syncing = false;

  function shape() {
    return state.shapes[editingShapeIndex] ?? null;
  }

  function closeShapeSizeEditor() {
    editingShapeIndex = -1;
    undoStarted = false;
    if (shapeSizeEditor) shapeSizeEditor.hidden = true;
  }

  function refreshShapeSizeEditor() {
    const current = shape();
    const type = editableShapeType(current);
    if (!type || !shapeSizeEditor) {
      closeShapeSizeEditor();
      return;
    }
    syncing = true;
    shapeSizeEditor.hidden = false;
    setFieldVisible(fields.width, type === "rect");
    setFieldVisible(fields.height, type === "rect");
    setFieldVisible(fields.radius, type === "circle");
    setFieldVisible(fields.diameter, type === "circle");
    if (type === "rect") {
      setControlValue(controls.shapeEditWidth, Math.abs(Number(current.w ?? 0)));
      setControlValue(controls.shapeEditHeight, Math.abs(Number(current.h ?? 0)));
    } else {
      const radius = Math.abs(Number(current.r ?? 0));
      setControlValue(controls.shapeEditRadius, radius);
      setControlValue(controls.shapeEditDiameter, radius * 2);
    }
    syncing = false;
  }

  function openShapeSizeEditor(shapeIndex) {
    const current = state.shapes[shapeIndex];
    if (!editableShapeType(current)) return false;
    editingShapeIndex = shapeIndex;
    undoStarted = false;
    selectSingleShape(shapeIndex);
    refreshShapeSizeEditor();
    return true;
  }

  function beginSizeUndo() {
    if (undoStarted) return;
    pushUndoSnapshot();
    undoStarted = true;
  }

  function endSizeUndo() {
    undoStarted = false;
  }

  function applyRectSize(width, height) {
    const current = shape();
    if (editableShapeType(current) !== "rect") return;
    const w = Math.max(0.1, Number(width));
    const h = Math.max(0.1, Number(height));
    if (!Number.isFinite(w) || !Number.isFinite(h)) return;
    beginSizeUndo();
    const cx = Number(current.x ?? 0) + Number(current.w ?? 0) / 2;
    const cy = Number(current.y ?? 0) + Number(current.h ?? 0) / 2;
    current.x = cx - w / 2;
    current.y = cy - h / 2;
    current.w = w;
    current.h = h;
    draw({ deferSnakeStats: true });
  }

  function applyCircleRadius(radius, source = "radius") {
    const current = shape();
    if (editableShapeType(current) !== "circle") return;
    const r = Math.max(0.1, Number(radius));
    if (!Number.isFinite(r)) return;
    beginSizeUndo();
    current.r = r;
    syncing = true;
    if (source !== "radius") setControlValue(controls.shapeEditRadius, r);
    if (source !== "diameter") setControlValue(controls.shapeEditDiameter, r * 2);
    syncing = false;
    draw({ deferSnakeStats: true });
  }

  controls.shapeEditWidth?.addEventListener("input", () => {
    if (syncing) return;
    applyRectSize(controls.shapeEditWidth.value, controls.shapeEditHeight.value);
  });
  controls.shapeEditHeight?.addEventListener("input", () => {
    if (syncing) return;
    applyRectSize(controls.shapeEditWidth.value, controls.shapeEditHeight.value);
  });
  controls.shapeEditRadius?.addEventListener("input", () => {
    if (syncing) return;
    applyCircleRadius(controls.shapeEditRadius.value, "radius");
  });
  controls.shapeEditDiameter?.addEventListener("input", () => {
    if (syncing) return;
    applyCircleRadius(Number(controls.shapeEditDiameter.value) / 2, "diameter");
  });
  for (const input of [controls.shapeEditWidth, controls.shapeEditHeight, controls.shapeEditRadius, controls.shapeEditDiameter]) {
    input?.addEventListener("change", endSizeUndo);
    input?.addEventListener("blur", endSizeUndo);
  }

  closeShapeSizeEditor();

  return {
    closeShapeSizeEditor,
    openShapeSizeEditor,
    refreshShapeSizeEditor,
  };
}
