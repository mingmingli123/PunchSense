import {
  toolForMaterial,
  toolPrintSpeed,
} from "./materials/profiles.js";

export function extrusion(length, lineWidth, layerHeight, flow = 1) {
  const filamentDiameter = 1.75;
  const h = Math.max(0, Math.min(lineWidth, layerHeight));
  const beadArea = lineWidth * layerHeight - (1 - Math.PI / 4) * h * h;
  const filamentArea = Math.PI * (filamentDiameter / 2) ** 2;
  return length * beadArea / filamentArea * flow;
}

export function materialFlow(c, material, localFlow = 1) {
  const tool = toolForMaterial(material ?? c.tool);
  return localFlow * (tool === 0 ? c.extrusionFlow : 1);
}

export function materialFeedrate(c, material) {
  return toolPrintSpeed(toolForMaterial(material ?? c.tool), c) * 60;
}

export function polylineLength(points) {
  let length = 0;
  for (let i = 1; i < points.length; i += 1) {
    length += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return length;
}
