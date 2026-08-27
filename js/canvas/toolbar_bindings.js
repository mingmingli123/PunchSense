export function bindToolbarEvents(deps) {
  const {
    svgImport,
    projectImport,
    controls,
    state,
    config,
    downloadTextFile,
    gcodeFilename,
    projectFilename,
    currentTpuSnakeStats,
    generateGcode,
    exportConfig,
    exportProject,
    importProjectFile,
    importSvgFile,
    draw,
    pushUndoSnapshot,
    selectSingleShape,
    clearShapes,
    clearTpuSnake,
    setSvgImportStatus,
    createRectShape,
    armShapePlacement,
    placePcbCutout,
    rotatePcbCutout,
  } = deps;

  document.getElementById("centerFrame").addEventListener("click", () => {
    pushUndoSnapshot();
    const c = config();
    state.shapeMode = "rect";
    controls.drawMode.value = "rect";
    state.path = [];
    state.shapes = [];
    state.regionMaterialOverrides.clear();
    state.selectedRegionKey = null;
    state.polylineClosed = false;
    state.activeVertexIndex = -1;
    clearTpuSnake(false);
    state.frame = { x: 0, y: 0, w: 0, h: 0 };
    state.shapes.push(createRectShape({ x: (c.bedWidth - 102.4) / 2, y: (c.bedDepth - 62.2) / 2, w: 102.4, h: 62.2 }));
    selectSingleShape(0);
    draw();
  });

  document.getElementById("resetFrame").addEventListener("click", () => {
    pushUndoSnapshot();
    state.shapeMode = "rect";
    controls.drawMode.value = "rect";
    state.path = [];
    state.shapes = [];
    state.regionMaterialOverrides.clear();
    state.selectedRegionKey = null;
    state.polylineClosed = false;
    state.activeVertexIndex = -1;
    clearTpuSnake(false);
    state.frame = { x: 0, y: 0, w: 0, h: 0 };
    state.shapes.push(createRectShape({ x: 84.3, y: 104.9, w: 102.4, h: 62.2 }));
    selectSingleShape(0);
    draw();
  });

  document.getElementById("clearCanvas").addEventListener("click", clearShapes);

  document.getElementById("downloadJson").addEventListener("click", () => {
    downloadTextFile("punchprint_ui_config.json", JSON.stringify(exportConfig(), null, 2));
  });

  document.getElementById("saveProjectButton")?.addEventListener("click", () => {
    const c = config();
    const name = projectFilename(c);
    downloadTextFile(name, JSON.stringify(exportProject(), null, 2), "application/json");
    setSvgImportStatus(`已保存 ${state.shapes.length} 个图形到 ${name}；下次用“加载保存图形”恢复，尺寸不会重新缩放。`);
  });

  document.getElementById("loadProjectButton")?.addEventListener("click", () => projectImport?.click());
  projectImport?.addEventListener("change", () => importProjectFile(projectImport.files?.[0]));

  document.getElementById("downloadGcode").addEventListener("click", async () => {
    const c = config();
    try {
      const gcode = await generateGcode(c);
      downloadTextFile(gcodeFilename(c, currentTpuSnakeStats(c)), gcode);
    } catch (error) {
      alert(error.message);
    }
  });

  document.getElementById("addCircle").addEventListener("click", () => armShapePlacement("circle"));
  document.getElementById("addTriangle").addEventListener("click", () => armShapePlacement("triangle"));
  document.getElementById("addHexagon").addEventListener("click", () => armShapePlacement("hexagon"));
  document.getElementById("addPcbCutout")?.addEventListener("click", () => placePcbCutout?.());
  document.getElementById("rotatePcbCutout")?.addEventListener("click", () => rotatePcbCutout?.());
  document.getElementById("importSvgButton").addEventListener("click", () => svgImport.click());
  svgImport.addEventListener("change", () => importSvgFile(svgImport.files?.[0]));
}
