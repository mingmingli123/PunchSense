export function bindCanvasControlEvents(deps) {
  const {
    controls,
    draw,
    assignMaterialToSelection,
    assignTpuFillModeToSelectionOrAllT0,
    numericDrawDelayMs,
  } = deps;

  let scheduledNumericDraw = 0;
  let scheduledNumericDrawOptions = {};

  function scheduleNumericDraw(options = {}, delayMs = numericDrawDelayMs) {
    scheduledNumericDrawOptions = { ...scheduledNumericDrawOptions, ...options };
    window.clearTimeout(scheduledNumericDraw);
    scheduledNumericDraw = window.setTimeout(() => {
      const optionsToUse = scheduledNumericDrawOptions;
      scheduledNumericDraw = 0;
      scheduledNumericDrawOptions = {};
      draw(optionsToUse);
    }, delayMs);
  }

  function cancelScheduledNumericDraw() {
    if (!scheduledNumericDraw) return;
    window.clearTimeout(scheduledNumericDraw);
    scheduledNumericDraw = 0;
    scheduledNumericDrawOptions = {};
  }

  for (const [id, input] of Object.entries(controls)) {
    if (!input) continue;
    if (id === "tpuFillMode") continue;
    if (input?.type === "number") {
      input.addEventListener("input", () => scheduleNumericDraw());
      input.addEventListener("change", () => {
        cancelScheduledNumericDraw();
        draw();
      });
    } else {
      input.addEventListener("input", draw);
      input.addEventListener("change", draw);
    }
  }

  controls.shapeMaterial.addEventListener("input", () => {
    assignMaterialToSelection(Number(controls.shapeMaterial.value)) || draw();
  });

  controls.tpuFillMode.addEventListener("input", () => {
    const fillMode = controls.tpuFillMode.value;
    if (assignTpuFillModeToSelectionOrAllT0(fillMode)) return;
    draw({ deferSnakeStats: true, skipSnakeManager: true });
  });

  return {
    scheduleNumericDraw,
    cancelScheduledNumericDraw,
  };
}
