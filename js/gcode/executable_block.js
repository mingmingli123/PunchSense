import { buildGcodeHeaderLines } from "./header.js?v=auto-workflow-pin-endpoint-final-v1-20260827";
import { buildMachineEndLines } from "./machine_end.js";
import { buildMachineStartLines } from "./machine_start.js";

export function createExecutableBlockGenerator(deps) {
  const {
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
    firstLayerMaterial,
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
  } = deps;

  function snakeTargetSummary(c) {
    if (!state.tpuSnake.connections.length) return `${c.tpuSnakeTargetLength.toFixed(1)} mm`;
    return state.tpuSnake.connections
      .map((connection, index) => `${index + 1}:${Number(connection.targetLength ?? c.tpuSnakeTargetLength).toFixed(1)}mm`)
      .join(", ");
  }

  function generateExecutableBlock(c) {
    const previousGcodeConfig = setActiveGcodeConfig(c);
    try {
      resetExtrusionState();
      if (c.polygons.length === 0) {
        return "; PunchPrint UI generated G-code\n; Empty canvas: no printable geometry.\n";
      }
      const materials = activeMaterials(c);
      const totalLayers = generatedLayerCount(c);
      const snakeHeaderStats = c.tpuSnakeEnabled ? currentTpuSnakeStats(c) : null;
      const firstLayerTools = materialToolsForLayer(c, 1);
      const firstTool = firstLayerTools[0] ?? materials[0] ?? toolForMaterial(c.tool);
      const multiMaterial = materials.length > 1;
      const lines = [
        ...buildGcodeHeaderLines({
          c,
          state,
          materials,
          totalLayers,
          snakeHeaderStats,
          firstLayerMaterial,
          toolProfile,
          toolTemp,
          toolPrintSpeed,
          t0BlockFirstLayer,
          t0BlockTopLayer,
          tpuSnakeFirstLayer,
          tpuSnakeTopLayer,
          layerSpanCount,
          tpuSnakeEffectiveWidth,
          frameGridOverlapWidth,
          snakeTargetSummary,
          constants: printConstants,
        }),
        ...buildMachineStartLines({
          c,
          materials,
          firstTool,
          toolTemp,
          toolProfile,
          toolFanSpeed,
          toolAuxFanSpeed,
          g1,
          totalLayers,
        }),
      ];

      const activeToolState = { tool: firstTool, initialTool: firstTool };
      for (let layerIndex = 1; layerIndex <= totalLayers; layerIndex += 1) {
        if (multiMaterial) addMultiMaterialGridLayer(lines, c, layerIndex, activeToolState);
        else addSegmentedSingleToolGridLayer(lines, c, layerIndex, activeToolState);
      }
      lines.push(...buildMachineEndLines({ g1 }));
      return `${lines.join("\n")}\n`;
    } finally {
      restoreActiveGcodeConfig(previousGcodeConfig);
    }
  }

  return generateExecutableBlock;
}
