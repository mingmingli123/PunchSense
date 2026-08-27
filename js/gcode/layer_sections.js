const OBJECT_NAME = "PunchPrint_base_id_0_copy_0";

export function writeLayerStart(lines, c, layerIndex, zBase, printHeight, totalLayerCount) {
  lines.push(";LAYER_CHANGE");
  lines.push(`;Z:${zBase.toFixed(3)}`);
  lines.push(`;HEIGHT:${printHeight.toFixed(3)}`);
  lines.push(";BEFORE_LAYER_CHANGE");
  lines.push(`;${zBase.toFixed(3)}`);
  lines.push("G92 E0");
  lines.push("; TIMELAPSE_TAKE_FRAME omitted: avoid pausing over the printed body");
  lines.push("; DEFECT_DETECTION_DETECT omitted: avoid pausing over the printed body");
  lines.push(";AFTER_LAYER_CHANGE");
  lines.push(`;${zBase.toFixed(3)}`);
  lines.push(`SET_PRINT_STATS_INFO TOTAL_LAYER=${totalLayerCount} CURRENT_LAYER=${layerIndex}`);
  lines.push(";_SET_FAN_SPEED_CHANGING_LAYER");
  lines.push(`SET_VELOCITY_LIMIT ACCEL=${layerIndex === 1 ? 500 : 10000}`);
  lines.push("; printing object PunchPrint base id:0 copy 0");
  lines.push(`EXCLUDE_OBJECT_START NAME=${OBJECT_NAME}`);
}

export function writeLayerEnd(lines) {
  lines.push("; layer end pressure relief before layer-change pause");
  lines.push("; stop printing object PunchPrint base id:0 copy 0");
  lines.push(`EXCLUDE_OBJECT_END NAME=${OBJECT_NAME}`);
}
