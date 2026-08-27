import { polygonArea } from "../core/geometry.js";
import {
  shapeToPolygon,
} from "../shape_geometry.js";
import { createMaterialRegionActions } from "./region_actions.js?v=auto-workflow-pin-endpoint-final-v1-20260827";
import { createMaterialBoundaryPathModel } from "./boundary_paths.js?v=auto-workflow-pin-endpoint-final-v1-20260827";
import { createMaterialRegionQueryModel } from "./region_query.js?v=auto-workflow-pin-endpoint-final-v1-20260827";

export function createMaterialRegionModel({
  state,
  controls,
  config,
  firstLayerMaterial,
  materialColor,
  boundaryOverlapWinner,
  layerPrintsT0Block,
  setSelectedShapes,
  selectedShapeIndices,
  drawSelectionPreview,
  pushUndoSnapshot,
  draw,
  pcbPinContactRegions,
}) {
  function materialRegions(c) {
    const regions = [];
    const baseCount = currentBasePolygonCount();
    if (baseCount > 0) regions.push({ polygon: c.polygons[0], material: Number(controls.shapeMaterial.value), fillMode: c.tpuFillMode, source: "base" });
    for (let i = 0; i < state.shapes.length; i += 1) {
      if (isPcbReferenceShape(state.shapes[i])) continue;
      const polygon = shapeToPolygon(state.shapes[i]);
      if (polygon.length >= 3) {
        regions.push({
          polygon,
          material: state.shapes[i].material ?? c.tool,
          fillMode: state.shapes[i].tpuFillMode ?? c.tpuFillMode,
          source: "shape",
          shapeIndex: i,
          shapeId: state.shapes[i].id,
        });
      }
    }
    if (state.draftShape) {
      const polygon = shapeToPolygon(state.draftShape);
      if (polygon.length >= 3) regions.push({ polygon, material: state.draftShape.material ?? Number(controls.shapeMaterial.value), fillMode: c.tpuFillMode, source: "draft" });
    }
    regions.push(...(pcbPinContactRegions?.(c, state.shapes) ?? []));
    return regions;
  }

  function selectRegionAtPoint(point, c) {
    const key = regionKeyForPoint(point);
    if (!key) return false;
    state.selectedRegionKey = key;
    state.selectedRegionPoint = { x: point.x, y: point.y };
    setSelectedShapes([], null, true);
    const regions = materialRegions(c).map((region, index) => ({ ...region, area: polygonArea(region.polygon), order: index }));
    controls.shapeMaterial.value = String(state.regionMaterialOverrides.get(key) ?? materialForPoint(point, regions));
    drawSelectionPreview();
    return true;
  }

  function cleanupRegionOverrides() {
    const validIds = new Set(state.shapes.map((shape) => shape.id));
    for (const key of [...state.regionMaterialOverrides.keys()]) {
      if (regionKeyIds(key).some((id) => !validIds.has(id))) state.regionMaterialOverrides.delete(key);
    }
    if (state.selectedRegionKey && regionKeyIds(state.selectedRegionKey).some((id) => !validIds.has(id))) {
      state.selectedRegionKey = null;
      state.selectedRegionPoint = null;
    }
  }

  function displayMaterialRegions(c) {
    return materialRegions(c).slice().sort((a, b) => polygonArea(b.polygon) - polygonArea(a.polygon));
  }

  function originalBoundaryColor(polygonIndex) {
    const baseCount = currentBasePolygonCount();
    const shapeIndex = polygonIndex - baseCount;
    if (shapeIndex >= 0 && state.shapes[shapeIndex]) return `${materialColor(state.shapes[shapeIndex].material)}88`;
    return "rgba(141, 79, 157, 0.42)";
  }

  function currentBasePolygonCount() {
    const c = config();
    const hasFreeBase = (c.shapeMode === "free" || c.shapeMode === "polyline") && state.path.length >= 3;
    const hasRectBase = c.shapeMode === "rect" && state.frame.w > 0 && state.frame.h > 0;
    return hasFreeBase || hasRectBase ? 1 : 0;
  }

  const {
    assignMaterialToSelectedRegion,
    assignTpuFillModeToSelection,
    assignTpuFillModeToSelectionOrAllT0,
  } = createMaterialRegionActions({
    state,
    controls,
    selectedShapeIndices,
    drawSelectionPreview,
    pushUndoSnapshot,
    draw,
  });

  const {
    effectiveMaterialForPoint,
    explicitMaterialForPoint,
    materialForPoint,
    regionKeyIds,
    regionKeyForPoint,
    regionKeyForPointFromRegions,
    topMaterialRegionAtPoint,
  } = createMaterialRegionQueryModel({
    state,
    controls,
    firstLayerMaterial,
    layerPrintsT0Block,
  });

  const {
    materialBoundaryPaths,
    materialBoundaryPathsForLayer,
  } = createMaterialBoundaryPathModel({
    boundaryOverlapWinner,
    materialForPoint,
    materialRegions,
    polygonArea,
    topMaterialRegionAtPoint,
  });

  return {
    assignMaterialToSelectedRegion,
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
    regionKeyForPoint,
    regionKeyForPointFromRegions,
    selectRegionAtPoint,
    topMaterialRegionAtPoint,
  };
}

function isPcbReferenceShape(shape) {
  return shape?.kind === "pcb-cutout"
    || shape?.kind === "pcb"
    || Boolean(shape?.pcbProfileId);
}
