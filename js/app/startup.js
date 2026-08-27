export function startPunchPrintApp(deps) {
  const {
    config,
    draw,
    exportConfig,
    generateGcode,
    selfCheck,
    doc = document,
    win = window,
  } = deps;

  win.PunchPrintUI = {
    config,
    exportConfig,
    generateGcode: () => generateGcode(config()),
    selfCheck,
  };
  doc.body.dataset.punchprintReady = "true";
  draw();
  selfCheck()
    .then((result) => {
      doc.body.dataset.punchprintSelfCheck = JSON.stringify(result);
    })
    .catch((error) => {
      doc.body.dataset.punchprintSelfCheck = JSON.stringify({
        ok: false,
        errors: [String(error?.message ?? error)],
      });
    });
}
