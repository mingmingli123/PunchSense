import { createEditOverlayRenderer } from "./edit_overlay.js";
import { createBedPreviewRenderer } from "./bed_preview.js";
import { createMaterialRegionPreviewRenderer } from "./material_region_preview.js?v=auto-workflow-pin-endpoint-final-v1-20260827";
import { createFramePreviewRenderer } from "./frame_preview.js";
import { createCanvasReadout } from "./readout.js?v=auto-workflow-pin-endpoint-final-v1-20260827";
import { createGridPreviewRenderer } from "./grid_preview.js?v=auto-workflow-pin-endpoint-final-v1-20260827";
import { createSnakeOverlayRenderer } from "./snake_overlay.js?v=auto-workflow-pin-endpoint-final-v1-20260827";
export { visibleUnionEdgePaths } from "./union_edges.js";

export function createCanvasRenderer(deps) {
  const {
    canvas,
    ctx,
    readout,
    controls,
    state,
    config,
    fit,
    mmToPx,
    drawOpenPath,
    drawPolygonPath,
    drawRectRegion,
    updateWorkflowSections,
    materialGridSegments,
    tpuSnakePreviewLayer,
    materialPreviewStrokeColor,
    hexToRgba,
    materialColor,
    currentTpuSnakeStats,
    updateTpuSnakeStatus,
    renderTpuSnakeManager,
    tpuSnakePlanningCorridors,
    tpuPathDeps,
    displayMaterialRegions,
    materialRegions,
    currentBasePolygonCount,
    regionKeyIds,
    selectedShapeIndices,
    gridHorizontalSegmentsUnion,
    gridVerticalSegmentsUnion,
    frameGridOverlapWidth,
    tpuGridEdgeNormal,
    shapeToPolygon,
    shapeHandles,
    selectedShapesBounds,
    groupBoundsHandles,
    whiteTpuOuterFramePaths,
    currentTpuSnakePreviewPaths,
    pcbPinMarkers,
    shapeLabel,
    firstLayerMaterial,
  } = deps;

  let pendingPreviewFrame = 0;
  let pendingPreviewOptions = null;
  const { updateReadout } = createCanvasReadout({
    readout,
    controls,
    state,
    materialRegions,
    currentBasePolygonCount,
    regionKeyIds,
    selectedShapeIndices,
    gridHorizontalSegmentsUnion,
    gridVerticalSegmentsUnion,
    frameGridOverlapWidth,
    shapeLabel,
  });
  const {
    drawGridPathOverlays,
    drawImportedGuideLines,
    drawPcbPinMarkers,
    drawTpuSnakeEndpoints,
    drawTpuSnakePlanningRegions,
  } = createSnakeOverlayRenderer({
    ctx,
    state,
    mmToPx,
    drawOpenPath,
    drawRectRegion,
    tpuSnakePlanningCorridors,
    tpuPathDeps,
    currentTpuSnakePreviewPaths,
    pcbPinMarkers,
  });
  const {
    drawPunchGrid,
    drawShrunkTpuMaterialPreview,
  } = createGridPreviewRenderer({
    ctx,
    state,
    mmToPx,
    drawOpenPath,
    materialGridSegments,
    tpuSnakePreviewLayer,
    materialPreviewStrokeColor,
    hexToRgba,
    materialColor,
    tpuGridEdgeNormal,
    drawGridPathOverlays,
    drawTpuSnakePlanningRegions,
    drawTpuSnakeEndpoints,
  });
  const {
    drawMaterialRegions,
  } = createMaterialRegionPreviewRenderer({
    canvas,
    ctx,
    state,
    mmToPx,
    drawPolygonPath,
    hexToRgba,
    materialColor,
    displayMaterialRegions,
    materialRegions,
    regionKeyIds,
    shapeToPolygon,
    drawShrunkTpuMaterialPreview,
  });
  const {
    drawEditHandles,
    drawPolylineEditState,
    drawSnapGuides,
  } = createEditOverlayRenderer({
    ctx,
    state,
    mmToPx,
    materialColor,
    selectedShapeIndices,
    shapeHandles,
    selectedShapesBounds,
    groupBoundsHandles,
  });
  const { drawBed } = createBedPreviewRenderer({
    canvas,
    ctx,
    mmToPx,
  });
  const { drawFrame } = createFramePreviewRenderer({
    ctx,
    state,
    drawOpenPath,
    drawPolygonPath,
    hexToRgba,
    materialColor,
    materialRegions,
    selectedShapeIndices,
    shapeToPolygon,
    whiteTpuOuterFramePaths,
    drawPolylineEditState,
    firstLayerMaterial,
  });

  function draw(options = {}) {
    updateWorkflowSections();
    const c = config();
    const f = fit();
    const mode = controls.workflowMode.value;
    drawBed(c, f);
    drawMaterialRegions(c, f, mode, options);
    if (mode === "design") drawImportedGuideLines(c, f);
    if (mode === "grid") drawPunchGrid(c, f);
    drawFrame(c, f, mode);
    drawSnapGuides(c, f);
    drawEditHandles(f);
    drawPcbPinMarkers(c, f);
    updateReadout(c, options);
    const snakeStats = mode === "grid" && c.tpuSnakeEnabled && state.tpuSnake.connections.length > 0 && !options.deferSnakeStats
      ? currentTpuSnakeStats(c)
      : null;
    updateTpuSnakeStatus(c, snakeStats, { deferStats: options.deferSnakeStats });
    if (!options.skipSnakeManager) renderTpuSnakeManager(c, snakeStats, { deferStats: options.deferSnakeStats });
  }

  function drawSelectionPreview() {
    draw({ deferSnakeStats: true, skipSnakeManager: true, fastDesign: true });
  }

  function scheduleSelectionPreview() {
    pendingPreviewOptions = { deferSnakeStats: true, skipSnakeManager: true, fastDesign: true };
    if (pendingPreviewFrame) return;
    pendingPreviewFrame = requestAnimationFrame(() => {
      pendingPreviewFrame = 0;
      const options = pendingPreviewOptions ?? { deferSnakeStats: true, skipSnakeManager: true, fastDesign: true };
      pendingPreviewOptions = null;
      draw(options);
    });
  }

  function cancelScheduledSelectionPreview() {
    if (pendingPreviewFrame) cancelAnimationFrame(pendingPreviewFrame);
    pendingPreviewFrame = 0;
    pendingPreviewOptions = null;
  }

  return {
    draw,
    drawSelectionPreview,
    scheduleSelectionPreview,
    cancelScheduledSelectionPreview,
  };
}
