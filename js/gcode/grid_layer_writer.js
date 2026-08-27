import { writeLayerEnd, writeLayerStart } from "./layer_sections.js";

export function createGridLayerWriter(deps) {
  const {
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
  } = deps;

  function addGridLayer(lines, c, layerIndex, horizontalSegments, verticalSegments, material = toolForMaterial(c.tool)) {
    const zBase = layerZ(c, layerIndex);
    const printHeight = layerPrintHeight(c, layerIndex);
    writeLayerStart(lines, c, layerIndex, zBase, printHeight, generatedLayerCount(c));

    lines.push(`; Begin layer ${layerIndex} horizontal lines at Z${zBase.toFixed(3)}, flow ${materialFlow(c, material, 1.0).toFixed(3)}`);
    lines.push(layerIndex === 1 ? ";TYPE:Bottom surface" : ";TYPE:Internal solid infill");
    lines.push(`;WIDTH:${c.beadWidth.toFixed(3)}`);
    horizontalSegments.forEach((segment, i) => {
      const reverse = (layerIndex + i) % 2 === 1;
      const start = reverse ? { x: segment.x1, y: segment.y } : { x: segment.x0, y: segment.y };
      const end = reverse ? { x: segment.x0, y: segment.y } : { x: segment.x1, y: segment.y };
      addLine(lines, c, start, end, zBase, 1.0, printHeight, material);
    });

    lines.push(`; Begin layer ${layerIndex} vertical lines at Z${zBase.toFixed(3)}, flow ${materialFlow(c, material, 1.2).toFixed(3)}`);
    lines.push(layerIndex === 1 ? ";TYPE:Bottom surface" : ";TYPE:Internal solid infill");
    lines.push(`;WIDTH:${c.beadWidth.toFixed(3)}`);
    verticalSegments.forEach((segment, i) => {
      const reverse = (layerIndex + i) % 2 === 1;
      const start = reverse ? { x: segment.x, y: segment.y1 } : { x: segment.x, y: segment.y0 };
      const end = reverse ? { x: segment.x, y: segment.y0 } : { x: segment.x, y: segment.y1 };
      addLine(lines, c, start, end, zBase, 1.2, printHeight, material);
    });
    addRetract(lines, c, material);
    writeLayerEnd(lines);
  }

  function addMultiMaterialGridLayer(lines, c, layerIndex, activeToolState) {
    const zBase = layerZ(c, layerIndex);
    const printHeight = layerPrintHeight(c, layerIndex);
    const materialSegments = materialGridSegments(c, layerIndex);
    writeLayerStart(lines, c, layerIndex, zBase, printHeight, generatedLayerCount(c));
    lines.push(`; Conservative material overlap layer ${layerIndex}: ${c.materialOverlapWidth.toFixed(3)} mm`);

    const materials = materialPrintOrderForLayer(materialSegments, c);
    let towerShellPrinted = false;
    const ensureWipeTowerShell = (material) => {
      if (towerShellPrinted) return;
      addWipeTowerShell(lines, c, zBase, printHeight, material, layerIndex, {
        includeBrim: layerIndex === 1,
      });
      towerShellPrinted = true;
    };
    if (materials.length > 0) {
      activeToolState.tool = addToolChange(lines, c, materials[0], zBase, activeToolState.tool, printHeight, layerIndex, activeToolState.initialTool);
      ensureWipeTowerShell(materials[0]);
    }
    for (let materialIndex = 0; materialIndex < materials.length; materialIndex += 1) {
      const material = materials[materialIndex];
      const segments = materialSegments.get(material);
      if (!segments || (segments.horizontal.length === 0 && segments.vertical.length === 0 && (!segments.paths || segments.paths.length === 0) && (!segments.solidPaths || segments.solidPaths.length === 0))) continue;
      activeToolState.tool = addToolChange(lines, c, material, zBase, activeToolState.tool, printHeight, layerIndex, activeToolState.initialTool);
      preheatUpcomingTool(lines, c, materials[materialIndex + 1], layerIndex, activeToolState.tool);
      ensureWipeTowerShell(material);
      addMaterialSegmentGroup(lines, c, layerIndex, material, segments, zBase, printHeight);
      addBoundaryPathsForMaterial(lines, c, layerIndex, material, zBase, printHeight);
    }
    addRetract(lines, c, activeToolState.tool);
    writeLayerEnd(lines);
  }

  function addSegmentedSingleToolGridLayer(lines, c, layerIndex, activeToolState) {
    const zBase = layerZ(c, layerIndex);
    const printHeight = layerPrintHeight(c, layerIndex);
    const materialSegments = materialGridSegments(c, layerIndex);
    writeLayerStart(lines, c, layerIndex, zBase, printHeight, generatedLayerCount(c));
    lines.push(`; Segmented single-tool material layer ${layerIndex}`);

    for (const material of materialPrintOrderForLayer(materialSegments, c)) {
      const segments = materialSegments.get(material);
      if (!segments || (segments.horizontal.length === 0 && segments.vertical.length === 0 && (!segments.paths || segments.paths.length === 0) && (!segments.solidPaths || segments.solidPaths.length === 0))) continue;
      activeToolState.tool = toolForMaterial(material);
      addMaterialSegmentGroup(lines, c, layerIndex, material, segments, zBase, printHeight);
      addBoundaryPathsForMaterial(lines, c, layerIndex, material, zBase, printHeight);
    }
    addRetract(lines, c, activeToolState.tool);
    writeLayerEnd(lines);
  }

  return {
    addGridLayer,
    addMultiMaterialGridLayer,
    addSegmentedSingleToolGridLayer,
  };
}
