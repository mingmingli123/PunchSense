export const materialColors = ["#111111", "#f7f2e8", "#ffffff", "#d64f2f"];

export const toolProfiles = {
  0: { label: "Black TPU", type: "TPU", color: "#161616", density: 1.24, temp: 250, firstLayerTemp: 250, standbyTemp: 100, printSpeed: 6, fan: 0, auxFan: 0, retractLength: 1.0, retractSpeed: 20, deretractSpeed: 20 },
  1: { label: "Unused T1", type: "TPU", color: "#F7F2E8", density: 1.24, temp: 210, firstLayerTemp: 210, standbyTemp: 60, printSpeed: 43.75, fan: 0, auxFan: 0, retractLength: 1.5, retractSpeed: 20, deretractSpeed: 20 },
  2: { label: "White TPU", type: "TPU", color: "#FFFFFF", density: 1.24, temp: 210, firstLayerTemp: 210, standbyTemp: 60, printSpeed: 43.75, fan: 0, auxFan: 0, retractLength: 1.5, retractSpeed: 20, deretractSpeed: 20 },
  3: { label: "PLA Frame", type: "PLA", color: "#D64F2F", density: 1.24, temp: 220, firstLayerTemp: 220, standbyTemp: 60, printSpeed: 50, fan: 255, auxFan: 0, retractLength: 1.5, retractSpeed: 30, deretractSpeed: 30 },
};

export const FRAME_MATERIAL = 3;
export const FIRST_LAYER_MATERIAL = 2;

export function toolForMaterial(material) {
  return Math.max(0, Math.min(3, Math.round(Number(material))));
}

export function toolProfile(tool, c) {
  const normalizedTool = toolForMaterial(tool);
  const fallbackTemp = Math.round(c.extruderTemp);
  if (normalizedTool === 0 && toolProfiles[0]) {
    return {
      ...toolProfiles[0],
      temp: fallbackTemp,
      firstLayerTemp: fallbackTemp,
    };
  }
  return toolProfiles[normalizedTool] ?? {
    label: `Tool ${normalizedTool}`,
    type: "PLA",
    color: materialColors[normalizedTool] ?? "#888888",
    temp: fallbackTemp,
    firstLayerTemp: fallbackTemp,
    standbyTemp: Math.max(0, fallbackTemp - 150),
    printSpeed: 200,
  };
}

export function toolTemp(tool, c, firstLayer = false) {
  const profile = toolProfile(toolForMaterial(tool), c);
  return Math.round(firstLayer ? profile.firstLayerTemp : profile.temp);
}

export function toolStandbyTemp(tool, c) {
  return Math.round(toolProfile(toolForMaterial(tool), c).standbyTemp);
}

export function toolPrintSpeed(tool, c) {
  return Number(toolProfile(toolForMaterial(tool), c).printSpeed ?? 200);
}

export function toolFanSpeed(tool, c) {
  return Math.round(toolProfile(toolForMaterial(tool), c).fan ?? 0);
}

export function toolAuxFanSpeed(tool, c) {
  return Math.round(toolProfile(toolForMaterial(tool), c).auxFan ?? 0);
}

export function toolRetractLength(tool, c) {
  return Number(toolProfile(toolForMaterial(tool), c).retractLength ?? 1.5);
}

export function toolRetractSpeed(tool, c) {
  return Number(toolProfile(toolForMaterial(tool), c).retractSpeed ?? 20);
}

export function toolDeretractSpeed(tool, c) {
  return Number(toolProfile(toolForMaterial(tool), c).deretractSpeed ?? 20);
}
