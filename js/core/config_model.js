export function createConfigModel(deps) {
  const {
    state,
    controls,
    normalizeFrame,
    rectPolygon,
    shapeToPolygon,
  } = deps;

  function num(id) {
    return Number(controls[id].value);
  }

  function config() {
    const epi = num("epi");
    const beadWidth = num("beadWidth");
    const gridLineCount = Math.max(1, Math.round(num("gridLineCount")));
    const gridLineWidth = beadWidth * gridLineCount;
    const pitch = 25.4 / epi;
    const opening = pitch - gridLineWidth;
    const frame = normalizeFrame(state.frame);
    const shapeMode = controls.drawMode.value;
    const polygons = currentPolygons(shapeMode, frame);
    const polygon = polygons[0] ?? [];
    const layerHeight = num("layerHeight");
    const firstLayerHeight = num("firstLayerHeight");
    const baseLayerCount = Math.max(1, Math.round(num("baseLayerCount")));
    const baseThickness = firstLayerHeight + Math.max(0, baseLayerCount - 1) * layerHeight;
    const printMode = controls.printMode?.value === "exposed" || controls.printMode?.value === "wrapped"
      ? controls.printMode.value
      : "crossing";
    const exposedSnakeMode = printMode === "exposed";
    if (controls.exposedSnakeMode) controls.exposedSnakeMode.checked = exposedSnakeMode;
    const bottomLayerCount = Math.min(baseLayerCount, Math.max(1, Math.round(num("bottomLayerCount"))));
    const maxBodyLayers = Math.max(0, baseLayerCount - bottomLayerCount);
    const maxSnakeLayers = maxBodyLayers;
    const maxT0BlockLayers = printMode === "wrapped" ? Math.max(0, baseLayerCount - 1) : maxBodyLayers;
    return {
      bedWidth: num("bedWidth"),
      bedDepth: num("bedDepth"),
      nozzleDiameter: num("nozzleDiameter"),
      beadWidth,
      gridLineCount,
      gridLineWidth,
      tpuFillMode: state.defaultTpuFillMode,
      pcbPinContactsEnabled: Boolean(controls.pcbPinContactsEnabled?.checked),
      pcbPinContactEpi: Math.max(4, num("pcbPinContactEpi")),
      pcbPinContactWidth: Math.max(0, num("pcbPinContactWidth")),
      pcbPinExtraLayerCount: Math.max(0, Math.round(num("pcbPinExtraLayerCount"))),
      hasPcbPinContactShapes: state.shapes.some((shape) => shape?.kind === "pcb-cutout" || shape?.kind === "pcb" || shape?.pcbProfileId),
      epi,
      pitch,
      opening,
      layerHeight,
      firstLayerHeight,
      baseThickness,
      baseLayerCount,
      previewLayer: Math.max(1, Math.round(num("previewLayer"))),
      extrusionFlow: num("extrusionFlow"),
      frameLoops: Math.max(0, Math.round(num("frameLoops"))),
      frameSpacing: num("frameSpacing"),
      materialOverlapWidth: Math.max(0, num("materialOverlapWidth")),
      materialBoundaryFrames: controls.materialBoundaryFrames.checked,
      tpuSnakeEnabled: controls.tpuSnakeEnabled.checked,
      printMode,
      exposedSnakeMode,
      bottomLayerCount,
      tpuSnakeLayerCount: Math.min(maxSnakeLayers, Math.max(0, Math.round(num("tpuSnakeLayerCount")))),
      t0BlockLayerCount: Math.min(maxT0BlockLayers, Math.max(0, Math.round(num("t0BlockLayerCount")))),
      tpuSnakeRemainderMaterial: Number(controls.tpuSnakeRemainderMaterial.value),
      tpuSnakeMaterialOrder: controls.tpuSnakeMaterialOrder.value === "t0-first" ? "t0-first" : "remainder-first",
      tpuSnakeCornerRelief: Boolean(controls.tpuSnakeCornerRelief?.checked),
      tpuSnakeAllowCrossings: controls.tpuSnakeAllowCrossings ? Boolean(controls.tpuSnakeAllowCrossings.checked) : true,
      tpuSnakeTargetLength: Math.max(0, num("tpuSnakeTargetLength")),
      tpuSnakeNormalLeadLength: Math.max(0, num("tpuSnakeNormalLeadLength")),
      tool: Number(controls.tool.value),
      extruderTemp: num("extruderTemp"),
      bedTemp: num("bedTemp"),
      frame,
      shapeMode,
      polygon,
      polygons,
    };
  }

  function currentPolygons(shapeMode, frame) {
    if (state.shapeMode === "empty" && state.path.length === 0 && state.shapes.length === 0 && !state.draftShape) return [];
    const basePolygon = (shapeMode === "free" || shapeMode === "polyline") && state.path.length >= 3
      ? state.path.map((p) => ({ x: p.x, y: p.y }))
      : shapeMode === "rect" && frame.w > 0 && frame.h > 0
        ? rectPolygon(frame)
        : null;
    const draft = state.draftShape ? [shapeToPolygon(state.draftShape)] : [];
    return [...(basePolygon ? [basePolygon] : []), ...state.shapes.map(shapeToPolygon), ...draft];
  }

  return {
    config,
    currentPolygons,
  };
}
