import { pointInPolygon } from "../core/geometry.js";
import { shapeToPolygon } from "../shape_geometry.js";

export function createMaterialRegionQueryModel(deps) {
  const {
    state,
    controls,
    firstLayerMaterial,
    layerPrintsT0Block,
  } = deps;

  function regionKeyIds(key) {
    return key ? key.split("|").filter(Boolean) : [];
  }

  function regionKeyForPoint(point) {
    const ids = [];
    for (const shape of state.shapes) {
      if (pointInPolygon(point, shapeToPolygon(shape))) ids.push(shape.id);
    }
    return ids.length > 0 ? ids.sort().join("|") : null;
  }

  function regionKeyForPointFromRegions(point, regions) {
    const ids = [];
    for (const region of regions) {
      if (region.source === "shape" && region.shapeId && pointInPolygon(point, region.polygon)) ids.push(region.shapeId);
    }
    return ids.length > 0 ? ids.sort().join("|") : null;
  }

  function materialForPoint(point, regions, ownerRegion = null) {
    const key = regionKeyForPointFromRegions(point, regions);
    if (key && state.regionMaterialOverrides.has(key)) return state.regionMaterialOverrides.get(key);
    const owner = ownerRegion ?? topMaterialRegionAtPoint(point, regions);
    return owner ? owner.material : controls.tool.value;
  }

  function explicitMaterialForPoint(point, regions, ownerRegion = null) {
    const key = regionKeyForPointFromRegions(point, regions);
    if (key && state.regionMaterialOverrides.has(key)) return state.regionMaterialOverrides.get(key);
    const owner = ownerRegion ?? topMaterialRegionAtPoint(point, regions);
    return owner ? owner.material : undefined;
  }

  function effectiveMaterialForPoint(c, layerIndex) {
    return (point, regions) => {
      const material = materialForPoint(point, regions);
      if (c.printMode === "wrapped" && Number(material) === 0 && !layerPrintsT0Block(c, layerIndex)) {
        return Number(c.tpuSnakeRemainderMaterial ?? firstLayerMaterial);
      }
      return material;
    };
  }

  function topMaterialRegionAtPoint(point, regions) {
    let best = null;
    for (const region of regions) {
      if (!pointInPolygon(point, region.polygon)) continue;
      if (!best || region.area < best.area || (Math.abs(region.area - best.area) < 0.001 && region.order > best.order)) {
        best = region;
      }
    }
    return best;
  }

  return {
    effectiveMaterialForPoint,
    explicitMaterialForPoint,
    materialForPoint,
    regionKeyIds,
    regionKeyForPoint,
    regionKeyForPointFromRegions,
    topMaterialRegionAtPoint,
  };
}
