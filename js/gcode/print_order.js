import {
  activeMaterialsForGcode,
  materialToolsForLayer as selectMaterialToolsForLayer,
} from "./material_selection.js?v=auto-workflow-pin-endpoint-final-v1-20260827";

export function createGcodePrintOrder(deps) {
  const {
    state,
    materialRegions,
    materialGridSegments,
    firstLayerMaterial,
    toolForMaterial,
    toolProfile,
    toolTemp,
  } = deps;

  function activeMaterials(c) {
    return activeMaterialsForGcode({
      c,
      state,
      firstLayerMaterial,
      materialRegions,
      toolForMaterial,
    });
  }

  function materialToolsForLayer(c, layerIndex) {
    return selectMaterialToolsForLayer({
      c,
      layerIndex,
      materialGridSegments,
      toolForMaterial,
    });
  }

  function materialPrintOrderForLayer(materialSegments, c) {
    const materials = [...materialSegments.keys()].filter((material) => Number(material) >= 0).sort((a, b) => a - b);
    const t0Bucket = materialSegments.get(0);
    const hasT0Serpentine = (t0Bucket?.paths?.length ?? 0) > 0;
    if (!hasT0Serpentine) return materials;
    if (c.tpuSnakeMaterialOrder === "t0-first") return [0, ...materials.filter((material) => Number(material) !== 0)];
    return [...materials.filter((material) => Number(material) !== 0), 0];
  }

  function preheatUpcomingTool(lines, c, material, layerIndex, currentTool) {
    if (material === undefined || material === null) return;
    if (Number(material) < 0) return;
    const tool = toolForMaterial(material);
    if (tool === toolForMaterial(currentTool)) return;
    lines.push(`M104 S${toolTemp(tool, c, layerIndex === 1)} T${tool} ; preheat next ${toolProfile(tool, c).label}`);
  }

  return {
    activeMaterials,
    materialToolsForLayer,
    materialPrintOrderForLayer,
    preheatUpcomingTool,
  };
}
