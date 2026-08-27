export function createProjectIo(deps) {
  const {
    state,
    controls,
    config,
    normalizeProjectData,
    cloneShape,
    cloneSnakeEndpoint,
    cloneSnakeConnection,
    toolProfile,
    frameGridOverlapWidth,
    pushUndoSnapshot,
    setSelectedShapes,
    draw,
  } = deps;

  function exportConfig() {
    const c = config();
    return {
      units: "mm",
      bed: { width: c.bedWidth, depth: c.bedDepth },
      frame: c.frame,
      shape_mode: c.shapeMode,
      polyline_closed: state.polylineClosed,
      polygon: c.polygon,
      polygons: c.polygons,
      shapes: state.shapes,
      region_material_overrides: [...state.regionMaterialOverrides.entries()].map(([key, material]) => ({ key, material })),
      printer: {
        nozzle_diameter: c.nozzleDiameter,
        bead_width: c.beadWidth,
        layer_height: c.layerHeight,
        first_layer_height: c.firstLayerHeight,
        base_layer_count: c.baseLayerCount,
        bottom_layer_count: c.bottomLayerCount,
        derived_base_thickness: c.baseThickness,
        extrusion_flow: c.extrusionFlow,
        tool_profiles: Object.fromEntries([0, 1, 2, 3].map((tool) => [`T${tool}`, toolProfile(tool, c)])),
      },
      epi: c.epi,
      pitch: c.pitch,
      opening: c.opening,
      grid_line_count: c.gridLineCount,
      grid_line_width: c.gridLineWidth,
      t0_fill_mode_default: c.tpuFillMode,
      pcb_pin_contacts: {
        enabled: c.pcbPinContactsEnabled,
        epi: c.pcbPinContactEpi,
        width: c.pcbPinContactWidth,
      },
      frame_loops: c.frameLoops,
      frame_spacing: c.frameSpacing,
      frame_grid_overlap_width: frameGridOverlapWidth(c),
      material_overlap_width: c.materialOverlapWidth,
      material_boundary_frames: c.materialBoundaryFrames,
      tpu_snake: {
        enabled: c.tpuSnakeEnabled,
        mode: c.printMode,
        exposed_mode: c.exposedSnakeMode,
        endpoints: state.tpuSnake.endpoints,
        connections: state.tpuSnake.connections,
        remainder_material: c.tpuSnakeRemainderMaterial,
        material_order: c.tpuSnakeMaterialOrder,
        corner_relief: c.tpuSnakeCornerRelief,
        allow_crossings: c.tpuSnakeAllowCrossings,
        target_length_mm: c.tpuSnakeTargetLength,
        normal_lead_length_mm: c.tpuSnakeNormalLeadLength,
        layer_count: c.tpuSnakeLayerCount,
        t0_block_layer_count: c.t0BlockLayerCount,
      },
      tool: c.tool,
      extruder_temp: c.extruderTemp,
      bed_temp: c.bedTemp,
    };
  }

  function exportProject() {
    const c = config();
    return {
      format: "punchprint-ui-project",
      version: 1,
      units: "mm",
      saved_at: new Date().toISOString(),
      note: "Shapes are stored in bed millimeter coordinates. Loading this file does not refit or rescale them.",
      controls: {
        workflowMode: controls.workflowMode.value,
        drawMode: controls.drawMode.value,
        bedWidth: c.bedWidth,
        bedDepth: c.bedDepth,
        nozzleDiameter: c.nozzleDiameter,
        beadWidth: c.beadWidth,
        layerHeight: c.layerHeight,
        firstLayerHeight: c.firstLayerHeight,
        baseLayerCount: c.baseLayerCount,
        bottomLayerCount: c.bottomLayerCount,
        extrusionFlow: c.extrusionFlow,
        epi: c.epi,
        gridLineCount: c.gridLineCount,
        tpuFillMode: c.tpuFillMode,
        pcbPinContactsEnabled: c.pcbPinContactsEnabled,
        pcbPinContactEpi: c.pcbPinContactEpi,
        pcbPinContactWidth: c.pcbPinContactWidth,
        frameLoops: c.frameLoops,
        frameSpacing: c.frameSpacing,
        materialOverlapWidth: c.materialOverlapWidth,
        materialBoundaryFrames: c.materialBoundaryFrames,
        tpuSnakeEnabled: c.tpuSnakeEnabled,
        printMode: c.printMode,
        exposedSnakeMode: c.exposedSnakeMode,
        tpuSnakeLayerCount: c.tpuSnakeLayerCount,
        t0BlockLayerCount: c.t0BlockLayerCount,
        tpuSnakeRemainderMaterial: c.tpuSnakeRemainderMaterial,
        tpuSnakeMaterialOrder: c.tpuSnakeMaterialOrder,
        tpuSnakeCornerRelief: c.tpuSnakeCornerRelief,
        tpuSnakeAllowCrossings: c.tpuSnakeAllowCrossings,
        tpuSnakeTargetLength: c.tpuSnakeTargetLength,
        tpuSnakeNormalLeadLength: c.tpuSnakeNormalLeadLength,
        tool: c.tool,
        extruderTemp: c.extruderTemp,
        bedTemp: c.bedTemp,
        shapeMaterial: Number(controls.shapeMaterial.value),
        regionSelectMode: controls.regionSelectMode.checked,
      },
      geometry: {
        shapeMode: state.shapeMode,
        frame: { ...state.frame },
        path: state.path.map((point) => ({ x: point.x, y: point.y })),
        polylineClosed: state.polylineClosed,
        shapes: state.shapes.map(cloneShape),
        regionMaterialOverrides: [...state.regionMaterialOverrides.entries()].map(([key, material]) => ({ key, material })),
      },
      tpuSnake: {
        endpoints: state.tpuSnake.endpoints.map((endpoint) => cloneSnakeEndpoint(endpoint)),
        connections: state.tpuSnake.connections.map((connection) => cloneSnakeConnection(connection)),
      },
    };
  }
  function applyProjectData(data) {
    if (!data || typeof data !== "object") throw new Error("JSON 内容为空或格式不正确。");
    const normalized = normalizeProjectData(data, {
      fallbackDrawMode: controls.drawMode.value,
      fallbackMaterial: Number(controls.shapeMaterial.value),
      fallbackTargetLength: Number(controls.tpuSnakeTargetLength.value || 200),
      fallbackNormalLeadLength: Number(controls.tpuSnakeNormalLeadLength.value || 0),
    });
    if (normalized.shapes.length === 0 && normalized.path.length === 0 && normalized.frame.w <= 0 && normalized.frame.h <= 0) {
      throw new Error("文件里没有可加载的图形。");
    }

    pushUndoSnapshot();
    applyProjectControls(normalized.controls);
    state.shapeMode = normalized.shapeMode;
    controls.drawMode.value = normalized.drawMode;
    state.frame = normalized.frame;
    state.path = normalized.path;
    state.polylineClosed = normalized.polylineClosed;
    state.shapes = normalized.shapes;
    state.regionMaterialOverrides = new Map(normalized.regionMaterialOverrides);
    state.selectedRegionKey = null;
    state.selectedRegionPoint = null;
    state.activeVertexIndex = -1;
    state.activeShapeHandle = null;
    state.activeShapeMove = null;
    state.pendingShape = null;
    state.draftShape = null;
    state.dragging = false;
    state.tpuSnake.endpoints = normalized.tpuSnake.endpoints;
    state.tpuSnake.connections = normalized.tpuSnake.connections;
    state.tpuSnake.picking = false;
    state.tpuSnake.editingConnectionIndex = -1;
    state.tpuSnake.selectedConnectionIndex = normalized.tpuSnake.connections.length > 0 ? 0 : -1;
    state.tpuSnake.conflict = null;
    setSelectedShapes(state.shapes.length > 0 ? [0] : [], state.shapes.length > 0 ? 0 : -1);
    draw();
    return { shapeCount: state.shapes.length };
  }

  function applyProjectControls(values) {
    if (values.tpuFillMode === "solid" || values.tpuFillMode === "grid") {
      state.defaultTpuFillMode = values.tpuFillMode;
    }
    const numericFields = [
      "bedWidth", "bedDepth", "nozzleDiameter", "beadWidth", "layerHeight", "firstLayerHeight", "baseLayerCount", "bottomLayerCount", "extrusionFlow",
      "epi", "gridLineCount", "pcbPinContactEpi", "pcbPinContactWidth", "frameLoops", "frameSpacing", "materialOverlapWidth", "previewLayer",
      "tpuSnakeLayerCount", "t0BlockLayerCount", "tpuSnakeRemainderMaterial", "tpuSnakeTargetLength", "tpuSnakeNormalLeadLength",
      "tool", "extruderTemp", "bedTemp", "shapeMaterial",
    ];
    for (const field of numericFields) {
      if (values[field] === undefined || !controls[field]) continue;
      controls[field].value = String(values[field]);
    }
    const selectFields = ["workflowMode", "drawMode", "tpuFillMode", "printMode", "tpuSnakeMaterialOrder"];
    for (const field of selectFields) {
      if (values[field] === undefined || !controls[field]) continue;
      controls[field].value = String(values[field]);
    }
    const boolFields = ["materialBoundaryFrames", "pcbPinContactsEnabled", "tpuSnakeEnabled", "exposedSnakeMode", "tpuSnakeCornerRelief", "tpuSnakeAllowCrossings", "regionSelectMode"];
    for (const field of boolFields) {
      if (values[field] === undefined || !controls[field]) continue;
      controls[field].checked = Boolean(values[field]);
    }
  }

  return {
    exportConfig,
    exportProject,
    applyProjectData,
  };
}
