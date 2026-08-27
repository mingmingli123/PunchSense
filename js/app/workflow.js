export function createWorkflowController(deps) {
  const {
    canvas,
    controls,
    readout,
    generateGcode,
    config,
    draw,
    doc = document,
  } = deps;

  function updateWorkflowSections() {
    const mode = controls.workflowMode.value;
    for (const section of doc.querySelectorAll("[data-stage]")) {
      const stage = section.dataset.stage;
      section.hidden = stage !== "all" && stage !== mode;
    }
  }

  async function selfCheck() {
    const errors = [];
    const currentConfig = config();
    if (doc.body.dataset.punchprintReady !== "true") errors.push("body ready flag is not true");
    if (!canvas) errors.push("canvas missing");
    if (!readout || readout.textContent.trim() === "-") errors.push("readout did not render");
    const missingControls = Object.entries(controls)
      .filter(([, input]) => !input)
      .map(([id]) => id);
    if (missingControls.length) errors.push(`missing controls: ${missingControls.join(", ")}`);

    const originalMode = controls.workflowMode.value;
    controls.workflowMode.value = "design";
    updateWorkflowSections();
    const designOk = [...doc.querySelectorAll('[data-stage="design"]')].every((section) => !section.hidden)
      && [...doc.querySelectorAll('[data-stage="grid"]')].every((section) => section.hidden);
    if (!designOk) errors.push("design stage visibility is wrong");

    controls.workflowMode.value = "grid";
    updateWorkflowSections();
    const gridOk = [...doc.querySelectorAll('[data-stage="grid"]')].every((section) => !section.hidden)
      && [...doc.querySelectorAll('[data-stage="design"]')].every((section) => section.hidden);
    if (!gridOk) errors.push("grid stage visibility is wrong");

    const gcode = await generateGcode(currentConfig);
    if (!String(gcode).includes("PunchPrint")) errors.push("G-code generation did not return expected PunchPrint output");

    controls.workflowMode.value = originalMode;
    updateWorkflowSections();
    draw();
    return {
      ok: errors.length === 0,
      errors,
      readout: readout?.textContent ?? "",
      workflowMode: controls.workflowMode.value,
    };
  }

  return {
    selfCheck,
    updateWorkflowSections,
  };
}
