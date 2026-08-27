import {
  FRAME_MATERIAL,
  FIRST_LAYER_MATERIAL,
  materialColors,
  toolAuxFanSpeed,
  toolDeretractSpeed,
  toolFanSpeed,
  toolForMaterial,
  toolProfile,
  toolPrintSpeed,
  toolRetractLength,
  toolRetractSpeed,
  toolStandbyTemp,
  toolTemp,
} from "./js/materials/profiles.js?v=auto-workflow-shape-size-editor-v1-20260826";
import {
  CONTROL_IDS,
  PRINT_CONSTANTS,
} from "./js/core/constants.js?v=auto-workflow-shape-size-editor-v1-20260826";
import {
  createDomRefs,
} from "./js/app/dom_refs.js?v=auto-workflow-shape-size-editor-v1-20260826";
import {
  createWorkflowController,
} from "./js/app/workflow.js?v=auto-workflow-shape-size-editor-v1-20260826";
import {
  createInitialAppState,
} from "./js/app/state.js?v=auto-workflow-shape-size-editor-v1-20260826";
import {
  createViewport,
} from "./js/app/viewport.js?v=auto-workflow-shape-size-editor-v1-20260826";
import {
  createScrollLockController,
} from "./js/app/scroll_lock.js?v=auto-workflow-shape-size-editor-v1-20260826";
import {
  createUndoController,
} from "./js/app/undo.js?v=auto-workflow-shape-size-editor-v1-20260826";
import {
  createSelectionController,
} from "./js/app/selection.js?v=auto-workflow-shape-size-editor-v1-20260826";
import {
  startPunchPrintApp,
} from "./js/app/startup.js?v=auto-workflow-shape-size-editor-v1-20260826";
import {
  createShapeStateController,
} from "./js/app/shape_state.js?v=auto-workflow-shape-size-editor-v1-20260826";
import {
  clamp,
  distance,
  interpolatePoint,
  layerCountForThickness,
  layerPrintHeight,
  layerZ,
  normalizeFrame,
  pointInAnyPolygon,
  pointInPolygon,
  polygonArea,
  polygonBounds,
  polygonCentroid,
  removeDuplicateClosingPoint,
  rectPolygon,
  samePoint,
  unionBounds,
} from "./js/core/geometry.js";
import {
  applyTpuSnakeToMaterialSegments,
  mergeAllMaterialBuckets,
  snakePathStats,
  subtractSnakeHorizontalFromSegments,
  subtractSnakeVerticalFromSegments,
  tpuSnakePlanningCorridors,
} from "./js/snake/path.js?v=auto-workflow-shape-size-editor-v1-20260826";
import {
  REFERENCE_WIPE_TOWER_BODY_PATHS,
  REFERENCE_WIPE_TOWER_BRIM_PATHS,
  REFERENCE_WIPE_TOWER_BOUNDS,
} from "./js/wipe_tower_reference.js";
import {
  polygonSides,
  shapeHandles,
  shapeToPolygon,
} from "./js/shape_geometry.js";
import {
  extractSvgGeometry,
  fitSvgGeometryToBed,
  fitSvgPolygonsToBed,
} from "./js/svg_import.js?v=auto-workflow-shape-size-editor-v1-20260826";
import {
  normalizeProjectData,
} from "./js/project/state.js?v=auto-workflow-shape-size-editor-v1-20260826";
import {
  createProjectIo,
} from "./js/project/io.js";
import {
  downloadTextFile,
  formatParam,
  gcodeFilename,
  projectFilename,
} from "./js/project/file_exports.js?v=auto-workflow-shape-size-editor-v1-20260826";
import {
  cloneShape,
  cloneSnakeConnection,
  cloneSnakeEndpoint,
  cloneSnakePath,
} from "./js/project/state_clone.js";
import {
  extrusion,
  materialFeedrate,
  materialFlow,
  polylineLength,
} from "./js/gcode_primitives.js";
import {
  createDrawHelpers,
  createMaterialColorHelpers,
  hexToRgba,
} from "./js/canvas/draw_helpers.js?v=auto-workflow-shape-size-editor-v1-20260826";
import {
  createSnakeUi,
} from "./js/snake/ui.js?v=auto-workflow-shape-size-editor-v1-20260826";
import {
  createShapeEditing,
  distancePointToSegment,
  duplicateShapeWithNewId,
  groupBoundsHandles,
  keepShapeOnBed,
  moveShape,
  scaleShapeFromBounds,
} from "./js/shape_editing.js";
import {
  createMaterialRegionModel,
} from "./js/materials/regions.js?v=auto-workflow-shape-size-editor-v1-20260826";
import {
  boundedScanValue,
  boundaryOverlapWinner,
  clippedHorizontalSegments,
  clippedHorizontalSegmentsUnion,
  clippedVerticalSegments,
  clippedVerticalSegmentsUnion,
  gridAxisPositions,
  gridHorizontalSegmentsForPolygon,
  gridLinePositions,
  gridVerticalSegmentsForPolygon,
  lineSegmentKey,
  materialSegmentBucket,
  mergeMaterialLineSegments,
  mergeNumericIntervals,
  normalizeMaterialLineSegments,
  removedSpansBetweenKept,
  scanlineIntersections,
  segmentLengthAlongDirection,
  segmentsAt,
  simplifyPath,
  strandOffsets,
  tpuSnakeEffectiveWidth,
  trimHorizontalSegmentToGrid,
  trimHorizontalSegmentToGridWithRemoved,
  trimVerticalSegmentToGrid,
  trimVerticalSegmentToGridWithRemoved,
  uniqueSortedBreaks,
} from "./js/grid_segments.js?v=auto-workflow-shape-size-editor-v1-20260826";
import {
  createMaterialGridModel,
  roundMaybe,
} from "./js/materials/grid.js?v=auto-workflow-shape-size-editor-v1-20260826";
import {
  createMaterialPostprocess,
} from "./js/materials/postprocess.js?v=auto-workflow-shape-size-editor-v1-20260826";
import {
  createSnapmakerGcode,
  loadSnapmakerTemplate,
} from "./js/snapmaker_gcode.js";
import {
  orthogonalizePrintablePolyline,
  printableTpuSnakePaths,
  roundedPrintablePolyline,
} from "./js/gcode_path_helpers.js?v=auto-workflow-shape-size-editor-v1-20260826";
import {
  createTpuSnakeTransform,
} from "./js/snake/transform.js";
import {
  createMoveSnapModel,
} from "./js/canvas/move_snap.js";
import {
  createTpuSnakeModel,
} from "./js/snake/model.js?v=auto-workflow-shape-size-editor-v1-20260826";
import {
  createTpuLayerModel,
} from "./js/snake/layer_model.js?v=auto-workflow-shape-size-editor-v1-20260826";
import {
  bindInteractionEvents,
} from "./js/canvas/interaction_bindings.js?v=auto-workflow-shape-size-editor-v1-20260826";
import {
  createImportHandlers,
} from "./js/project/import_handlers.js?v=auto-workflow-shape-size-editor-v1-20260826";
import {
  createConfigModel,
} from "./js/core/config_model.js";
import {
  createShapeTools,
} from "./js/canvas/shape_tools.js";
import {
  createShapeInteractions,
} from "./js/canvas/shape_interactions.js?v=auto-workflow-shape-size-editor-v1-20260826";
import {
  createShapeSizeEditor,
} from "./js/canvas/shape_size_editor.js?v=auto-workflow-shape-size-editor-v1-20260826";
import {
  createCanvasRenderer,
  visibleUnionEdgePaths,
} from "./js/canvas/renderer.js?v=auto-workflow-shape-size-editor-v1-20260826";
import {
  offsetFramePath,
} from "./js/frame_geometry.js";
import {
  createGcodeGenerator,
} from "./js/gcode_generator.js?v=auto-workflow-shape-size-editor-v1-20260826";
import {
  addAlignedPcbCutoutFramePaths,
  addPcbPinContactGridSegments,
  createPcbCutoutShape,
  isPcbCutoutShape,
  nearestPcbBoundaryEndpoint,
  pcbPinGridEndpointForRef,
  nearestPcbPinEndpoint,
  pcbNonT0PinContactBlockingBucket,
  pcbPinHoleVoidRegions,
  pcbPinMarkers,
  pcbPinContactRegions,
  pointInPcbEndpointSelectionZone,
} from "./js/pcb_cutout.js?v=auto-workflow-shape-size-editor-v1-20260826";

const {
  canvas,
  ctx,
  readout,
  svgImport,
  projectImport,
  svgImportStatus,
  tpuSnakeStatus,
  tpuSnakeList,
  snakeManager,
  shapeSizeEditor,
  controls,
} = createDomRefs(CONTROL_IDS);
const {
  RETRACT_Z_HOP_MM,
  SNAP_GUIDE_SCREEN_PX,
  NUMERIC_DRAW_DELAY_MS,
  SNAKE_TARGET_DRAW_DELAY_MS,
} = PRINT_CONSTANTS;

let canvasRenderer = null;
let workflowController = null;
let undoController = null;
let selectionController = null;

const state = createInitialAppState(controls);


const {
  config,
  currentPolygons,
} = createConfigModel({
  state,
  controls,
  normalizeFrame,
  rectPolygon,
  shapeToPolygon,
});

const {
  fit,
  mmToPx,
  pxToMm,
} = createViewport({
  canvas,
  ctx,
  snakeManager,
  config,
});

const {
  lockCanvasDrag,
  unlockCanvasDrag,
  preventPageScrollDuringCanvasDrag,
} = createScrollLockController({ state });

const {
  armShapePlacement,
  shapeLabel,
} = createShapeStateController({ state });

const {
  drawOpenPath,
  drawPolygonPath,
  drawRectRegion,
} = createDrawHelpers(ctx, mmToPx);

const {
  materialColor,
  materialPreviewStrokeColor,
} = createMaterialColorHelpers(materialColors, () => controls.tool.value);

const {
  cloneTpuSnakeState,
  moveTpuSnake,
  restoreTpuSnakeState,
  scaleTpuSnakeFromBounds,
} = createTpuSnakeTransform({
  state,
  cloneSnakeConnection,
  cloneSnakeEndpoint,
});

const {
  hitShape,
  nearestShapeEdge,
  nearestShapeHandle,
  selectedShapesBounds,
} = createShapeEditing({
  state,
  cloneShape,
  cloneTpuSnakeState,
  selectedShapeIndices,
});

const {
  addBasicShapeAt,
  createImportedPolygonShape,
  createBasicShape,
  createRectShapeFromDrag,
  createRectShape,
  updateRectFromCorner,
  updateRectFromCornerProportional,
  proportionalCornerPoint,
  updatePolygonFromBoundsCorner,
  createBasicShapeFromEdgeDrag,
  defaultShapeRadius,
} = createShapeTools({
  state,
  controls,
  config,
  pushUndoSnapshot,
  normalizeFrame,
  rectPolygon,
  polygonBounds,
  polygonSides,
  distance,
});

function placePcbCutout() {
  pushUndoSnapshot();
  const shape = createPcbCutoutShape(config());
  state.shapes.push(shape);
  selectSingleShape(state.shapes.length - 1);
  controls.shapeMaterial.value = "-1";
  draw();
}

function rotatePcbCutout() {
  const selected = selectedShapeIndices().filter((index) => isPcbCutoutShape(state.shapes[index]));
  const fallbackIndex = [...state.shapes.keys()].reverse().find((index) => isPcbCutoutShape(state.shapes[index]));
  const indices = selected.length > 0 ? selected : (fallbackIndex !== undefined ? [fallbackIndex] : []);
  if (indices.length === 0) return;
  pushUndoSnapshot();
  const c = config();
  for (const index of indices) rotatePcbRectShape90(state.shapes[index], c);
  setSelectedShapes(indices, indices[indices.length - 1]);
  controls.shapeMaterial.value = "-1";
  draw();
}

function rotatePcbRectShape90(shape, c) {
  if (!shape || shape.type !== "rect") return;
  const cx = shape.x + shape.w / 2;
  const cy = shape.y + shape.h / 2;
  shape.rotation = normalizePcbRotation((Number(shape.rotation) || 0) + Math.PI / 2);
  const nextW = shape.h;
  const nextH = shape.w;
  shape.x = clamp(cx - nextW / 2, 0, Math.max(0, Number(c.bedWidth || 0) - nextW));
  shape.y = clamp(cy - nextH / 2, 0, Math.max(0, Number(c.bedDepth || 0) - nextH));
  shape.w = nextW;
  shape.h = nextH;
  shape.material = -1;
  shape.lockedMaterial = true;
}

function normalizePcbRotation(rotation) {
  const quarter = ((Math.round(Number(rotation) / (Math.PI / 2)) % 4) + 4) % 4;
  return quarter * Math.PI / 2;
}

function autoPlacePcbAndGuides() {
  const c = config();
  const touchpoints = t0TouchpointCenters();
  if (touchpoints.length === 0) {
    setSvgImportStatus("自动连接：没有找到材料 1 / T0 触点。请先绘制或导入黑色 TPU 触点。");
    return;
  }
  pushUndoSnapshot();
  const pcbShape = ensureAutoWorkflowPcb(c, touchpoints);
  const guideConnections = buildAutoWorkflowGuideConnections(c, pcbShape, touchpoints);
  if (guideConnections.length === 0) {
    setSvgImportStatus("自动连接：未能生成 guide。请检查 PCB 与触点位置。");
    draw();
    return;
  }
  controls.tpuSnakeEnabled.checked = true;
  controls.workflowMode.value = "grid";
  state.tpuSnake.connections.push(...guideConnections);
  state.tpuSnake.selectedConnectionIndex = state.tpuSnake.connections.length - guideConnections.length;
  state.tpuSnake.picking = false;
  state.tpuSnake.endpoints = [];
  state.tpuSnake.conflict = null;
  updateWorkflowSections();
  setSvgImportStatus(`自动连接：已生成 ${guideConnections.length} 条端点连接段，拓扑为 D2 -> ${touchpoints.length} 个触点 -> D7。`);
  draw();
}

function t0TouchpointCenters() {
  return state.shapes
    .map((shape, index) => ({ shape, index }))
    .filter(({ shape }) => !isPcbCutoutShape(shape) && Number(shape.material) === 0)
    .map(({ shape, index }) => {
      const polygon = shapeToPolygon(shape);
      const bounds = polygonBounds(polygon);
      const center = polygon.length >= 3 ? polygonCentroid(polygon) : {
        x: bounds.x + bounds.w / 2,
        y: bounds.y + bounds.h / 2,
      };
      return { index, shape, polygon, bounds, point: center };
    })
    .filter((entry) => Number.isFinite(entry.point.x) && Number.isFinite(entry.point.y))
    .sort((a, b) => (b.point.y - a.point.y) || (a.point.x - b.point.x));
}

function ensureAutoWorkflowPcb(c, touchpoints) {
  const existing = [...state.shapes].reverse().find((shape) => isPcbCutoutShape(shape));
  if (existing) return existing;
  const pcb = createPcbCutoutShape(c);
  const bounds = unionBounds(touchpoints.map((entry) => entry.bounds));
  const margin = Math.max(8, Number(c.pitch ?? 2.5) * 4);
  const rightX = bounds.x + bounds.w + margin;
  const leftX = bounds.x - pcb.w - margin;
  pcb.x = rightX + pcb.w <= c.bedWidth ? rightX : Math.max(0, leftX);
  pcb.y = clamp(bounds.y + bounds.h / 2 - pcb.h / 2, 0, Math.max(0, c.bedDepth - pcb.h));
  pcb.material = -1;
  pcb.lockedMaterial = true;
  state.shapes.push(pcb);
  return pcb;
}

function buildAutoWorkflowGuideConnections(c, pcbShape, touchpoints) {
  const d2 = pcbPinEndpointForAutoWorkflow(c, pcbShape, "bottom_5");
  const d7 = pcbPinEndpointForAutoWorkflow(c, pcbShape, "top_1");
  if (!d2 || !d7) return [];
  const nodes = [
    { kind: "pin", ...d2 },
    ...touchpoints.map((entry, index) => ({
      kind: "touch",
      touchpoint: entry,
      point: entry.point,
      ref: { type: "touch", index: entry.index, label: `T${index + 1}` },
    })),
    { kind: "pin", ...d7 },
  ];
  const connections = [];
  for (let i = 1; i < nodes.length; i += 1) {
    const start = autoWorkflowNodeEndpoint(nodes[i - 1], nodes[i].point, c);
    const end = autoWorkflowNodeEndpoint(nodes[i], nodes[i - 1].point, c);
    if (!start || !end) continue;
    const connection = createAutoWorkflowEndpointConnection(start, end, connections.length, c);
    connection.label = `AUTO${connections.length + 1}`;
    connection.autoWorkflow = true;
    connection.avoidT0Blocks = true;
    connection.autoRefs = [start.ref, end.ref];
    connection.targetLength = Math.max(Number(c.tpuSnakeTargetLength || 200), distance(start.point, end.point));
    connections.push(connection);
  }
  return connections;
}

function createAutoWorkflowEndpointConnection(start, end, index, c) {
  const endpoints = [start, end].map((entry) => {
    const snap = entry.snap ?? {};
    return {
      ...entry.point,
      normal: snap.normal ?? null,
      boundaryPoint: snap.boundaryPoint ? { ...snap.boundaryPoint } : { ...entry.point },
      rawPoint: snap.rawPoint ? { ...snap.rawPoint } : { ...entry.point },
      source: snap.source ?? null,
      pcbShapeId: snap.pcbShapeId ?? null,
      pinId: snap.pinId ?? null,
      pinLabel: snap.pinLabel ?? null,
      pinName: snap.pinName ?? null,
      gpio: snap.gpio ?? null,
      role: snap.role ?? null,
      selectedEdge: snap.selectedEdge ?? null,
      clickedEdgePoint: snap.clickedEdgePoint ?? null,
      contactPoint: snap.contactPoint ?? null,
      disableNormalLead: snap.disableNormalLead || snap.source === "pcb-pin",
      normalLeadLength: snap.disableNormalLead || snap.source === "pcb-pin" ? 0 : Math.max(0, Number(c.tpuSnakeNormalLeadLength || 0)),
    };
  });
  return {
    id: `auto_endpoint_${Date.now()}_${index + 1}`,
    label: `AUTO${index + 1}`,
    endpoints,
    importGroupId: "auto_workflow",
    targetLength: Math.max(0, Number(c.tpuSnakeTargetLength || 200)),
    normalLeadLength: endpoints.some((endpoint) => endpoint.disableNormalLead) ? 0 : Math.max(0, Number(c.tpuSnakeNormalLeadLength || 0)),
  };
}

function autoWorkflowNodeEndpoint(node, toward, c) {
  if (!node) return null;
  if (node.kind === "pin") return node;
  if (!node.touchpoint?.polygon?.length) return null;
  const boundary = polygonBoundaryPointToward(node.touchpoint.point, toward, node.touchpoint.polygon);
  const snap = nearestTpuRegionGuideEndpoint(boundary, c)
    ?? nearestTpuSnakeGridEndpoint(boundary, c);
  const point = snap?.point ? { ...snap.point } : boundary;
  return {
    point,
    ref: node.ref,
    snap: snap
      ? {
        ...snap,
        point,
        boundaryPoint: snap.boundaryPoint ? { ...snap.boundaryPoint } : point,
        source: snap.source ?? "tpu-touchpoint",
      }
      : {
        point,
        distance: 0,
        boundaryPoint: point,
        normal: null,
        source: "tpu-touchpoint",
      },
  };
}

function polygonBoundaryPointToward(center, toward, polygon) {
  const direction = { x: toward.x - center.x, y: toward.y - center.y };
  const length = Math.hypot(direction.x, direction.y);
  if (length <= 0.001) return closestPolygonBoundaryPoint(center, polygon);
  const ray = { x: direction.x / length, y: direction.y / length };
  let best = null;
  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    const hit = raySegmentIntersection(center, ray, a, b);
    if (hit && hit.t >= -0.001 && (!best || hit.t < best.t)) best = hit;
  }
  return best?.point ?? closestPolygonBoundaryPoint(toward, polygon);
}

function raySegmentIntersection(origin, ray, a, b) {
  const sx = b.x - a.x;
  const sy = b.y - a.y;
  const det = cross(ray.x, ray.y, sx, sy);
  if (Math.abs(det) <= 1e-9) return null;
  const ax = a.x - origin.x;
  const ay = a.y - origin.y;
  const t = cross(ax, ay, sx, sy) / det;
  const u = cross(ax, ay, ray.x, ray.y) / det;
  if (t < -0.001 || u < -0.001 || u > 1.001) return null;
  return {
    t,
    point: {
      x: origin.x + ray.x * t,
      y: origin.y + ray.y * t,
    },
  };
}

function cross(ax, ay, bx, by) {
  return ax * by - ay * bx;
}

function closestPolygonBoundaryPoint(point, polygon) {
  let best = null;
  for (let i = 0; i < polygon.length; i += 1) {
    const projected = closestPointOnSegmentLocal(point, polygon[i], polygon[(i + 1) % polygon.length]);
    const d = distance(point, projected);
    if (!best || d < best.distance) best = { point: projected, distance: d };
  }
  return best?.point ?? { ...point };
}

function closestPointOnSegmentLocal(point, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq <= 1e-9) return { ...a };
  const t = clamp(((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSq, 0, 1);
  return {
    x: a.x + dx * t,
    y: a.y + dy * t,
  };
}

function pcbPinEndpointForAutoWorkflow(c, pcbShape, pinId) {
  const resolved = pcbPinGridEndpointForRef(c, state.shapes, {
    pcbShapeId: pcbShape.id,
    pinId,
  });
  if (!resolved?.point) return null;
  return {
    point: resolved.point,
    ref: {
      type: "pcb-pin",
      pcbShapeId: pcbShape.id,
      pinId,
      label: resolved.pinLabel ?? pinId,
    },
    snap: resolved,
  };
}

function autoWorkflowEndpointResolver(point, c, start, end) {
  if (distance(point, start.point) <= 0.001 && start.snap) return start.snap;
  if (distance(point, end.point) <= 0.001 && end.snap) return end.snap;
  return nearestTpuRegionGuideEndpoint(point, c)
    ?? nearestTpuSnakeGridEndpoint(point, c)
    ?? null;
}

function orthogonalGuideBetween(start, end) {
  const a = { x: start.x, y: start.y };
  const b = { x: end.x, y: end.y };
  if (Math.abs(a.x - b.x) <= 0.001 || Math.abs(a.y - b.y) <= 0.001) return [a, b];
  const midA = { x: b.x, y: a.y };
  const midB = { x: a.x, y: b.y };
  const guide = distance(a, midA) + distance(midA, b) <= distance(a, midB) + distance(midB, b)
    ? [a, midA, b]
    : [a, midB, b];
  return removeConsecutiveDuplicateMmPoints(guide);
}

const {
  computeMoveSnap,
} = createMoveSnapModel({
  state,
  selectedShapesBounds,
});

const {
  currentTpuSnakePreviewPaths,
  currentTpuSnakePreviewPath,
  currentTpuSnakeStats,
  tpuSnakePreviewLayer,
  tpuSnakeStatsLayer,
  tpuSnakeFirstLayer,
  tpuSnakeTopLayer,
  t0BlockFirstLayer,
  t0BlockTopLayer,
  layerSpanCount,
  layerPrintsT0Block,
  generatedLayerCount,
} = createTpuLayerModel({
  state,
  snakePathStats,
  getMaterialGridSegments: () => materialGridSegments,
  getTpuPathDeps: () => tpuPathDeps,
});

const {
  assignMaterialToSelectedRegion: assignMaterialToSelectedRegionFromModel,
  assignTpuFillModeToSelection,
  assignTpuFillModeToSelectionOrAllT0,
  cleanupRegionOverrides,
  currentBasePolygonCount,
  displayMaterialRegions,
  effectiveMaterialForPoint,
  explicitMaterialForPoint,
  materialBoundaryPaths,
  materialBoundaryPathsForLayer,
  materialForPoint,
  materialRegions,
  originalBoundaryColor,
  regionKeyIds,
  regionKeyForPointFromRegions,
  selectRegionAtPoint,
  topMaterialRegionAtPoint,
} = createMaterialRegionModel({
  state,
  controls,
  config,
  firstLayerMaterial: FIRST_LAYER_MATERIAL,
  materialColor,
  boundaryOverlapWinner,
  layerPrintsT0Block,
  setSelectedShapes,
  selectedShapeIndices,
  drawSelectionPreview,
  pushUndoSnapshot,
  draw,
  pcbPinContactRegions: (c, shapes) => [
    ...pcbPinContactRegions(c, shapes, state.tpuSnake.connections, FIRST_LAYER_MATERIAL),
    ...pcbPinHoleVoidRegions(c, shapes),
  ],
});

selectionController = createSelectionController({
  state,
  controls,
  assignMaterialToSelectedRegion: assignMaterialToSelectedRegionFromModel,
  pushUndoSnapshot,
  draw,
});

const {
  pickTpuSnakeEndpoint,
  startTpuSnakeEndpointPicking,
  createGuidedTpuSnakeConnection,
  removeConsecutiveDuplicateMmPoints,
  nearestTpuSnakeGridEndpoint,
  nearestTpuRegionGuideEndpoint,
  tpuBoundaryEdges,
  tpuGridEdgeNormal,
  tpuPathDeps,
  nearestEpiGridPoint,
} = createTpuSnakeModel({
  state,
  controls,
  draw,
  updateWorkflowSections,
  toolForMaterial,
  materialRegions,
  materialSegmentBucket,
  mergeMaterialLineSegments,
  unionBounds,
  polygonBounds,
  pointInPolygon,
  distancePointToSegment,
  distance,
  lineSegmentKey,
  polylineLength,
  samePoint,
  clamp,
  uniqueSortedBreaks,
  printableTpuSnakePaths,
  tpuSnakePreviewLayer,
  getMaterialGridSegments: () => materialGridSegments,
  getBaseMaterialGridSegments: () => baseMaterialGridSegments,
  getGridHorizontalSegmentsUnion: () => gridHorizontalSegmentsUnion,
  getGridVerticalSegmentsUnion: () => gridVerticalSegmentsUnion,
  getUpdateTpuSnakeStatus: () => updateTpuSnakeStatus,
  nearestPcbPinEndpoint: (point, c) => nearestPcbPinEndpoint(point, c, state.shapes),
  pcbPinGridEndpoint: (c, endpoint) => pcbPinGridEndpointForRef(c, state.shapes, endpoint),
  nearestPcbBoundaryEndpoint: (point, c) => nearestPcbBoundaryEndpoint(point, c, state.shapes),
  pointInPcbEndpointSelectionZone: (point, c) => pointInPcbEndpointSelectionZone(point, c, state.shapes),
  pcbNonT0PinContactBlockingBucket: (c) => pcbNonT0PinContactBlockingBucket(c, state.shapes, state.tpuSnake.connections, FIRST_LAYER_MATERIAL),
});

const {
  addWhiteTpuOuterFrameToSegments,
  whiteTpuOuterFramePaths,
  applyTpuSolidFillMode,
  enforceFinalMaterialExclusivity,
  extendMaterialSegmentsIntoFrame,
  extendSegmentIntoFrame,
  frameGridOverlapWidth,
  shrinkTpuMaterialToCompleteGrid,
  rasterizedT0GridSegments,
  plaSolidBasePaths,
} = createMaterialPostprocess({
  state,
  firstLayerMaterial: FIRST_LAYER_MATERIAL,
  frameMaterial: FRAME_MATERIAL,
  materialRegions,
  explicitMaterialForPoint,
  topMaterialRegionAtPoint,
  materialSegmentBucket,
  mergeAllMaterialBuckets,
  tpuPathDeps,
  visibleUnionEdgePaths,
  offsetFramePath,
  toolForMaterial,
  layerPrintsT0Block,
  subtractSnakeHorizontalFromSegments,
  subtractSnakeVerticalFromSegments,
  gridAxisPositions,
  pointInAnyPolygon,
  samePoint,
  removeDuplicateClosingPoint,
  polygonArea,
  polygonBounds,
  unionBounds,
  polygonCentroid,
  pointInPolygon,
  clamp,
  trimHorizontalSegmentToGridWithRemoved,
  trimVerticalSegmentToGridWithRemoved,
  normalizeMaterialLineSegments,
  mergeNumericIntervals,
  removedSpansBetweenKept,
  strandOffsets,
  roundMaybe,
  boundaryOverlapWinner,
});

const {
  baseMaterialGridSegments,
  cloneMaterialSegmentsMap,
  gridHorizontalSegmentsUnion,
  gridVerticalSegmentsUnion,
  materialGridSegments,
} = createMaterialGridModel({
  state,
  firstLayerMaterial: FIRST_LAYER_MATERIAL,
  applyTpuSnakeToMaterialSegments,
  tpuPathDeps,
  applyTpuSolidFillMode,
  enforceFinalMaterialExclusivity,
  addWhiteTpuOuterFrameToSegments,
  extendMaterialSegmentsIntoFrame,
  generatedLayerCount,
  tpuSnakeTopLayer,
  t0BlockTopLayer,
  layerPrintsT0Block,
  materialRegions,
  effectiveMaterialForPoint,
  explicitMaterialForPoint,
  rasterizedT0GridSegments,
  mergeAllMaterialBuckets,
  shrinkTpuMaterialToCompleteGrid,
  cloneSnakePath,
  plaSolidBasePaths,
  addPcbPinContactGridSegments: (result, c) => addPcbPinContactGridSegments(result, c, state.shapes, materialSegmentBucket, segmentsAt, state.tpuSnake.connections, FIRST_LAYER_MATERIAL),
  addAlignedPcbCutoutFramePaths: (result, c, layerIndex) => addAlignedPcbCutoutFramePaths(result, c, state.shapes, materialSegmentBucket, FIRST_LAYER_MATERIAL, layerIndex, layerPrintsT0Block, state.tpuSnake.connections),
});

const {
  wrapSnapmakerOrcaGcode,
  wrapWithSnapmakerTemplate,
} = createSnapmakerGcode({
  generatedLayerCount,
  layerZ,
  retractZHopMm: RETRACT_Z_HOP_MM,
  toolDeretractSpeed,
  toolProfile,
  toolRetractLength,
  toolRetractSpeed,
  toolTemp,
});

const {
  exportConfig,
  exportProject,
  applyProjectData,
} = createProjectIo({
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
});

const generateGcode = createGcodeGenerator({
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
  materialBoundaryPathsForLayer,
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
  subtractSnakeHorizontalFromSegments,
  subtractSnakeVerticalFromSegments,
  mergeAllMaterialBuckets,
  materialSegmentBucket,
  mergeMaterialLineSegments,
  normalizeMaterialLineSegments,
  plaSolidBasePaths,
  tpuPathDeps,
  firstLayerMaterial: FIRST_LAYER_MATERIAL,
  frameMaterial: FRAME_MATERIAL,
  referenceWipeTowerBodyPaths: REFERENCE_WIPE_TOWER_BODY_PATHS,
  referenceWipeTowerBrimPaths: REFERENCE_WIPE_TOWER_BRIM_PATHS,
  referenceWipeTowerBounds: REFERENCE_WIPE_TOWER_BOUNDS,
  printConstants: PRINT_CONSTANTS,
});

workflowController = createWorkflowController({
  canvas,
  controls,
  readout,
  config,
  draw,
  generateGcode,
});

function draw(options = {}) {
  return canvasRenderer.draw(options);
}

function drawSelectionPreview() {
  return canvasRenderer.drawSelectionPreview();
}

function scheduleSelectionPreview() {
  return canvasRenderer.scheduleSelectionPreview();
}

function cancelScheduledSelectionPreview() {
  return canvasRenderer.cancelScheduledSelectionPreview();
}

const {
  renderTpuSnakeManager,
  updateTpuSnakeStatus,
} = createSnakeUi({
  state,
  statusEl: tpuSnakeStatus,
  listEl: tpuSnakeList,
  getStats: currentTpuSnakeStats,
  firstLayerMaterial: FIRST_LAYER_MATERIAL,
  toolProfile,
  tpuSnakeFirstLayer,
  tpuSnakeTopLayer,
  t0BlockFirstLayer,
  t0BlockTopLayer,
});

canvasRenderer = createCanvasRenderer({
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
  materialBoundaryPathsForLayer,
  offsetFramePath,
  currentTpuSnakePreviewPaths,
  pcbPinMarkers: (c) => pcbPinMarkers(c, state.shapes),
  distancePointToSegment,
  shapeLabel,
  firstLayerMaterial: FIRST_LAYER_MATERIAL,
  frameMaterial: FRAME_MATERIAL,
});

function updateWorkflowSections() {
  return workflowController.updateWorkflowSections();
}

function setSelectedShapes(indices, primaryIndex = null, keepRegion = false) {
  return selectionController.setSelectedShapes(indices, primaryIndex, keepRegion);
}

function selectSingleShape(index) {
  return selectionController.selectSingleShape(index);
}

function toggleSelectedShape(index) {
  return selectionController.toggleSelectedShape(index);
}

function selectedShapeIndices() {
  return selectionController.selectedShapeIndices();
}

function syncMaterialSelectToPrimary() {
  return selectionController.syncMaterialSelectToPrimary();
}

function assignMaterialToSelection(material) {
  return selectionController.assignMaterialToSelection(material);
}

function pushUndoSnapshot() {
  return undoController.pushUndoSnapshot();
}

function undoLastOperation() {
  return undoController.undoLastOperation();
}

undoController = createUndoController({
  state,
  cloneShape,
  cloneSnakeEndpoint,
  cloneSnakeConnection,
  unlockCanvasDrag,
  syncMaterialSelectToPrimary,
  draw,
});

const {
  updateShapeFromHandle,
  moveShapeByPointer,
  moveShapes,
  nearestVertex,
  clearShapes,
  clearTpuSnake,
  setSvgImportStatus,
  copySelectedShapes,
  pasteCopiedShapes,
} = createShapeInteractions({
  state,
  controls,
  config,
  svgImportStatus,
  draw,
  pushUndoSnapshot,
  setSelectedShapes,
  selectedShapeIndices,
  cleanupRegionOverrides,
  selectedShapesBounds,
  restoreTpuSnakeState,
  scaleTpuSnakeFromBounds,
  moveTpuSnake,
  moveShape,
  computeMoveSnap,
  fit,
  snapGuideScreenPx: SNAP_GUIDE_SCREEN_PX,
  updateRectFromCorner,
  updateRectFromCornerProportional,
  updatePolygonFromBoundsCorner,
  proportionalCornerPoint,
  polygonSides,
  distance,
  rectPolygon,
  normalizeFrame,
  scaleShapeFromBounds,
  cloneShape,
  duplicateShapeWithNewId,
  regionKeyIds,
});

const {
  openShapeSizeEditor,
} = createShapeSizeEditor({
  state,
  controls,
  shapeSizeEditor,
  selectSingleShape,
  pushUndoSnapshot,
  draw,
});

const {
  importSvgFile,
  importProjectFile,
  importProjectData,
  simplifyOrthogonalGuidePoints,
} = createImportHandlers({
  state,
  controls,
  svgImport,
  projectImport,
  config,
  extractSvgGeometry,
  fitSvgGeometryToBed,
  normalizeProjectData,
  applyProjectData,
  createImportedPolygonShape,
  pushUndoSnapshot,
  setSelectedShapes,
  setSvgImportStatus,
  draw,
  updateWorkflowSections,
  baseMaterialGridSegments,
  tpuSnakePreviewLayer,
  tpuBoundaryEdges,
  nearestTpuSnakeGridEndpoint,
  nearestTpuRegionGuideEndpoint,
  createGuidedTpuSnakeConnection,
  removeConsecutiveDuplicateMmPoints,
  polygonArea,
  firstLayerMaterial: FIRST_LAYER_MATERIAL,
});

window.__punchprintDebug = {
  ...(window.__punchprintDebug ?? {}),
  importProjectData,
  config,
  state,
  currentTpuSnakeStats,
  currentTpuSnakePreviewPaths,
  materialGridSegments,
  baseMaterialGridSegments,
  materialRegions,
  tpuPathDeps: () => tpuPathDeps(),
};

bindInteractionEvents({
  canvas,
  svgImport,
  projectImport,
  tpuSnakeList,
  controls,
  state,
  config,
  fit,
  pxToMm,
  polygonBounds,
  normalizeFrame,
  pointInAnyPolygon,
  simplifyPath,
  distancePointToSegment,
  clamp,
  downloadTextFile,
  gcodeFilename,
  projectFilename,
  currentTpuSnakeStats,
  currentTpuSnakePreviewPaths,
  generateGcode,
  exportConfig,
  exportProject,
  importProjectFile,
  importSvgFile,
  draw,
  drawSelectionPreview,
  scheduleSelectionPreview,
  cancelScheduledSelectionPreview,
  lockCanvasDrag,
  unlockCanvasDrag,
  preventPageScrollDuringCanvasDrag,
  pushUndoSnapshot,
  undoLastOperation,
  copySelectedShapes,
  pasteCopiedShapes,
  assignMaterialToSelection,
  assignTpuFillModeToSelection,
  assignTpuFillModeToSelectionOrAllT0,
  cleanupRegionOverrides,
  setSelectedShapes,
  selectSingleShape,
  toggleSelectedShape,
  selectedShapeIndices,
  syncMaterialSelectToPrimary,
  selectRegionAtPoint,
  nearestShapeHandle,
  hitShape,
  nearestVertex,
  pickTpuSnakeEndpoint,
  startTpuSnakeEndpointPicking,
  openShapeSizeEditor,
  clearShapes,
  clearTpuSnake,
  setSvgImportStatus,
  createRectShape,
  createRectShapeFromDrag,
  createBasicShapeFromEdgeDrag,
  updateShapeFromHandle,
  moveShapeByPointer,
  armShapePlacement,
  placePcbCutout,
  rotatePcbCutout,
  snakeTargetDrawDelayMs: SNAKE_TARGET_DRAW_DELAY_MS,
  numericDrawDelayMs: NUMERIC_DRAW_DELAY_MS,
});

document.getElementById("autoPlacePcbAndGuides")?.addEventListener("click", autoPlacePcbAndGuides);

async function selfCheck() {
  return workflowController.selfCheck();
}

startPunchPrintApp({
  config,
  exportConfig,
  generateGcode,
  selfCheck,
  draw,
});
