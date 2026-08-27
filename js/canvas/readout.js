import {
  unionBounds,
} from "../core/geometry.js";

export function createCanvasReadout({
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
}) {
  function updateReadout(c, options = {}) {
    const quality = printQualityMessage(c);
    const workflowMode = controls.workflowMode.value;
    if (c.polygons.length === 0) {
      readout.textContent = [
        "画板: 空",
        `阶段: ${workflowMode === "design" ? "材料区域" : "网格预览"}`,
        `Pitch: ${c.pitch.toFixed(3)} mm, 网格线宽 ${c.gridLineWidth.toFixed(3)} mm`,
        `模式 ${printModeLabel(c)}, 层高 ${c.layerHeight.toFixed(2)} mm, 总 ${c.baseLayerCount} 层, 底部 ${c.bottomLayerCount} 层, 蛇形线 ${c.tpuSnakeLayerCount} 层`,
        `线段: 横 0 / 竖 0, 方孔约 ${Math.max(0, c.opening).toFixed(3)} mm`,
      ].join("\n");
      return;
    }
    const bounds = unionBounds(c.polygons);
    if (workflowMode === "design") {
      const regionCount = options.fastDesign
        ? Math.max(0, state.shapes.length + (state.draftShape ? 1 : 0) + currentBasePolygonCount())
        : materialRegions(c).length;
      readout.textContent = [
        "画板: 已绘制",
        `阶段: 材料区域  区域 ${regionCount} 个`,
        `范围: X${bounds.x.toFixed(1)} Y${bounds.y.toFixed(1)}  ${bounds.w.toFixed(1)} x ${bounds.h.toFixed(1)} mm`,
        state.selectedRegionKey
          ? `当前材料: ${materialReadoutLabel(controls.shapeMaterial.value)}  已选区域 ${regionKeyIds(state.selectedRegionKey).length} 层重叠`
          : `当前材料: ${materialReadoutLabel(controls.shapeMaterial.value)}  已选 ${selectedShapeIndices().length} 个`,
        `网格预览已隐藏, ${quality}`,
      ].join("\n");
      return;
    }
    const horizontal = gridHorizontalSegmentsUnion(c).length;
    const vertical = gridVerticalSegmentsUnion(c).length;
    readout.textContent = [
      "画板: 已绘制",
      `${shapeLabel(c.shapeMode)}  X${bounds.x.toFixed(1)} Y${bounds.y.toFixed(1)}  ${bounds.w.toFixed(1)} x ${bounds.h.toFixed(1)} mm`,
      `Pitch: ${c.pitch.toFixed(3)} mm, 网格线宽 ${c.gridLineWidth.toFixed(3)} mm`,
      `模式 ${printModeLabel(c)}, 层高 ${c.layerHeight.toFixed(2)} mm, 总 ${c.baseLayerCount} 层, 底部 ${c.bottomLayerCount} 层, 蛇形线 ${c.tpuSnakeLayerCount} 层`,
      `线段: 横 ${horizontal} / 竖 ${vertical}  预览层 ${c.previewLayer}  黑色TPU ${tpuFillModeLabel(c)}  材料重叠 ${c.materialOverlapWidth.toFixed(1)} mm  外框咬合 ${frameGridOverlapWidth(c).toFixed(2)} mm`,
    ].join("\n");
  }

  return { updateReadout };
}

function printQualityMessage(c) {
  const min = c.nozzleDiameter * 0.75;
  const max = c.nozzleDiameter * 1.5;
  if (c.beadWidth < c.layerHeight) return "线宽小于层高";
  if (c.beadWidth < min || c.beadWidth > max) return "线宽超出建议范围";
  return "线宽在建议范围";
}

function tpuFillModeLabel(c) {
  return c.tpuFillMode === "solid" ? "实心" : "网格";
}

function materialReadoutLabel(material) {
  return Number(material) < 0 ? "镂空" : `T${material}`;
}

function printModeLabel(c) {
  if (c.printMode === "exposed") return "裸露";
  if (c.printMode === "wrapped") return "包裹";
  return "交叉";
}
