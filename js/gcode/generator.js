import { offsetFramePath as computeOffsetFramePath } from "../frame_geometry.js";
import { createExecutableBlockGenerator } from "./executable_block.js?v=auto-workflow-pin-endpoint-final-v1-20260827";
import { addExposedWhiteTpuReferenceFirstLayer as writeExposedWhiteTpuReferenceFirstLayer } from "./exposed_first_layer.js";
import { createFrameWriter } from "./frame_writer.js";
import { createGridLayerWriter } from "./grid_layer_writer.js?v=auto-workflow-pin-endpoint-final-v1-20260827";
import { createMaterialSegmentWriter } from "./material_segment_writer.js";
import { createMotionWriter } from "./motion_writer.js";
import { createGcodePrintOrder } from "./print_order.js?v=auto-workflow-pin-endpoint-final-v1-20260827";
import { wipeTowerRect as selectWipeTowerRect } from "./wipe_tower_geometry.js";
import { createWipeTowerLocator } from "./wipe_tower_locator.js";
import { createWipeTowerWriter } from "./wipe_tower_writer.js";

export function createGcodeGenerator(deps) {
  const {
    state,
    loadSnapmakerTemplate,
    wrapWithSnapmakerTemplate,
    wrapSnapmakerOrcaGcode,
    toolForMaterial,
    toolProfile,
    toolTemp,
    toolPrintSpeed,
    toolFanSpeed,
    toolAuxFanSpeed,
    toolStandbyTemp,
    toolRetractLength,
    toolRetractSpeed,
    toolDeretractSpeed,
    materialFeedrate,
    materialFlow,
    extrusion,
    polylineLength,
    distance,
    unionBounds,
    pointInPolygon,
    clamp,
    layerZ,
    layerPrintHeight,
    generatedLayerCount,
    currentTpuSnakeStats,
    materialRegions,
    gridHorizontalSegmentsUnion,
    gridVerticalSegmentsUnion,
    materialGridSegments,
    visibleUnionEdgePaths,
    extendSegmentIntoFrame,
    frameGridOverlapWidth,
    tpuSnakeEffectiveWidth,
    tpuSnakeFirstLayer,
    tpuSnakeTopLayer,
    t0BlockFirstLayer,
    t0BlockTopLayer,
    layerSpanCount,
    printableTpuSnakePaths,
    roundedPrintablePolyline,
    orthogonalizePrintablePolyline,
    firstLayerMaterial,
    frameMaterial,
    referenceWipeTowerBodyPaths,
    referenceWipeTowerBrimPaths,
    referenceWipeTowerBounds,
    printConstants,
  } = deps;

  const FIRST_LAYER_MATERIAL = firstLayerMaterial;
  const FRAME_MATERIAL = frameMaterial;
  const REFERENCE_WIPE_TOWER_BODY_PATHS = referenceWipeTowerBodyPaths;
  const REFERENCE_WIPE_TOWER_BRIM_PATHS = referenceWipeTowerBrimPaths;
  const REFERENCE_WIPE_TOWER_BOUNDS = referenceWipeTowerBounds;
  const { wipeTowerRect } = createWipeTowerLocator({
    selectWipeTowerRect,
    unionBounds,
    pointInPolygon,
    clamp,
    referenceBounds: REFERENCE_WIPE_TOWER_BOUNDS,
  });
  const {
    setActiveGcodeConfig,
    restoreActiveGcodeConfig,
    resetExtrusionState,
    markExtrusionRetracted,
    markExtrusionUnretracted,
    g1,
    addLine,
    addT0GridLine,
    addPolyline,
    addT0SerpentinePolyline,
    addRetract,
    addRetractForTravel,
    consumePrimeAmount,
    primeAtStart,
    rememberExtrusionSegment,
  } = createMotionWriter({
    toolForMaterial,
    toolRetractLength,
    toolRetractSpeed,
    toolDeretractSpeed,
    materialFeedrate,
    materialFlow,
    extrusion,
    polylineLength,
    distance,
    wipeTowerRect,
    roundedPrintablePolyline,
    orthogonalizePrintablePolyline,
    printableTpuSnakePaths,
    constants: printConstants,
  });

  function addExposedWhiteTpuReferenceFirstLayer(lines, c, z) {
    writeExposedWhiteTpuReferenceFirstLayer({
      lines,
      c,
      z,
      firstLayerMaterial: FIRST_LAYER_MATERIAL,
      constants: printConstants,
      toolProfile,
      unionBounds,
      distance,
      clamp,
      g1,
      addRetractForTravel,
      addRetract,
      consumePrimeAmount,
      primeAtStart,
      rememberExtrusionSegment,
    });
  }

  const { addToolChange, addWipeTowerShell } = createWipeTowerWriter({
    wipeTowerRect,
    referenceBodyPaths: REFERENCE_WIPE_TOWER_BODY_PATHS,
    referenceBrimPaths: REFERENCE_WIPE_TOWER_BRIM_PATHS,
    toolForMaterial,
    toolProfile,
    toolTemp,
    toolFanSpeed,
    toolAuxFanSpeed,
    toolStandbyTemp,
    toolRetractSpeed,
    toolDeretractSpeed,
    materialFlow,
    extrusion,
    distance,
    g1,
    addLine,
    addRetractForTravel,
    consumePrimeAmount,
    rememberExtrusionSegment,
    markExtrusionRetracted,
    markExtrusionUnretracted,
    constants: printConstants,
  });

  const { addBoundaryPathsForMaterial } = createFrameWriter({
    frameMaterial: FRAME_MATERIAL,
    visibleUnionEdgePaths,
    offsetFramePath: computeOffsetFramePath,
    addPolyline,
    materialFlow,
  });

  const {
    activeMaterials,
    materialToolsForLayer,
    materialPrintOrderForLayer,
    preheatUpcomingTool,
  } = createGcodePrintOrder({
    state,
    materialRegions,
    materialGridSegments,
    firstLayerMaterial: FIRST_LAYER_MATERIAL,
    toolForMaterial,
    toolProfile,
    toolTemp,
  });

  const { addMaterialSegmentGroup } = createMaterialSegmentWriter({
    firstLayerMaterial: FIRST_LAYER_MATERIAL,
    toolForMaterial,
    materialFlow,
    distance,
    addExposedWhiteTpuReferenceFirstLayer,
    addPolyline,
    addLine,
    addT0GridLine,
    addT0SerpentinePolyline,
  });
  const { addGridLayer, addMultiMaterialGridLayer, addSegmentedSingleToolGridLayer } = createGridLayerWriter({
    generatedLayerCount,
    layerZ,
    layerPrintHeight,
    materialGridSegments,
    materialFlow,
    toolForMaterial,
    addLine,
    addRetract,
    addToolChange,
    addWipeTowerShell,
    addMaterialSegmentGroup,
    addBoundaryPathsForMaterial,
    materialPrintOrderForLayer,
    preheatUpcomingTool,
  });

  const generateExecutableBlock = createExecutableBlockGenerator({
    state,
    toolForMaterial,
    toolProfile,
    toolTemp,
    toolPrintSpeed,
    toolFanSpeed,
    toolAuxFanSpeed,
    generatedLayerCount,
    currentTpuSnakeStats,
    gridHorizontalSegmentsUnion,
    gridVerticalSegmentsUnion,
    extendSegmentIntoFrame,
    frameGridOverlapWidth,
    tpuSnakeEffectiveWidth,
    tpuSnakeFirstLayer,
    tpuSnakeTopLayer,
    t0BlockFirstLayer,
    t0BlockTopLayer,
    layerSpanCount,
    firstLayerMaterial: FIRST_LAYER_MATERIAL,
    printConstants,
    g1,
    setActiveGcodeConfig,
    restoreActiveGcodeConfig,
    resetExtrusionState,
    activeMaterials,
    materialToolsForLayer,
    addGridLayer,
    addMultiMaterialGridLayer,
    addSegmentedSingleToolGridLayer,
  });

  async function generateGcode(c) {
    const executableBlock = generateExecutableBlock(c);
    const template = await loadSnapmakerTemplate();
    if (template) return wrapWithSnapmakerTemplate(template, executableBlock, c);
    return wrapSnapmakerOrcaGcode(c, executableBlock);
  }

  return generateGcode;
}
