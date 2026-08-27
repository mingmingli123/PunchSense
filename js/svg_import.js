import {
  pointInPolygon,
  polygonArea,
  removeDuplicateClosingPoint,
  samePoint,
} from "./core/geometry.js";
import {
  isRedGuideElement,
  svgElementMaterialHint,
} from "./svg/material_hints.js?v=auto-workflow-pin-endpoint-final-v1-20260827";
export {
  fitSvgGeometryToBed,
  fitSvgPolygonsToBed,
} from "./svg/fit.js?v=auto-workflow-pin-endpoint-final-v1-20260827";

export function extractSvgGeometry(svgText, options = {}) {
  const {
    simplifyGuidePoints = (points) => points,
  } = options;
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, "image/svg+xml");
  const error = doc.querySelector("parsererror");
  if (error) throw new Error("SVG 文件无法解析。");
  const svg = doc.querySelector("svg");
  if (!svg) throw new Error("文件里没有 svg 根元素。");
  svg.querySelectorAll("script, foreignObject").forEach((node) => node.remove());

  const host = document.createElement("div");
  host.style.cssText = "position:absolute;left:-10000px;top:-10000px;width:0;height:0;overflow:hidden;";
  host.appendChild(document.importNode(svg, true));
  document.body.appendChild(host);
  const mountedSvg = host.querySelector("svg");

  const polygons = [];
  const polygonMaterials = [];
  const guidePaths = [];
  let skipped = 0;
  for (const element of mountedSvg.querySelectorAll("rect,circle,ellipse,polygon,polyline,line,path")) {
    if (isRedGuideElement(element)) {
      const guide = svgElementToOpenPoints(element);
      if (guide.length >= 2) {
        guidePaths.push(simplifyGuidePoints(guide));
        continue;
      }
    }
    const materialHint = svgElementMaterialHint(element);
    const points = svgElementToClosedPoints(element);
    if (points.length >= 3 && polygonArea(points) > 0.01) {
      polygons.push(removeDuplicateClosingPoint(points));
      polygonMaterials.push(materialHint);
    }
    else skipped += 1;
  }
  host.remove();
  return { polygons, polygonMaterials, guidePaths, skipped };
}

function svgElementToClosedPoints(element) {
  const tag = element.tagName.toLowerCase();
  if (tag === "rect") return rectElementPoints(element);
  if (tag === "circle") return ellipseElementPoints(element, true);
  if (tag === "ellipse") return ellipseElementPoints(element, false);
  if (tag === "polygon") return pointListElementPoints(element, true);
  if (tag === "polyline") return pointListElementPoints(element, false);
  if (tag === "path") return pathElementPoints(element);
  return [];
}

function rectElementPoints(element) {
  const x = svgNumber(element, "x", 0);
  const y = svgNumber(element, "y", 0);
  const w = svgNumber(element, "width", 0);
  const h = svgNumber(element, "height", 0);
  if (w <= 0 || h <= 0) return [];
  return [
    svgPoint(element, x, y),
    svgPoint(element, x + w, y),
    svgPoint(element, x + w, y + h),
    svgPoint(element, x, y + h),
  ];
}

function ellipseElementPoints(element, isCircle) {
  const cx = svgNumber(element, "cx", 0);
  const cy = svgNumber(element, "cy", 0);
  const rx = isCircle ? svgNumber(element, "r", 0) : svgNumber(element, "rx", 0);
  const ry = isCircle ? rx : svgNumber(element, "ry", 0);
  if (rx <= 0 || ry <= 0) return [];
  const points = [];
  for (let i = 0; i < 96; i += 1) {
    const a = (Math.PI * 2 * i) / 96;
    points.push(svgPoint(element, cx + Math.cos(a) * rx, cy + Math.sin(a) * ry));
  }
  return points;
}

function pointListElementPoints(element, alwaysClosed) {
  const raw = Array.from(element.points ?? []).map((point) => svgPoint(element, point.x, point.y));
  if (raw.length < 3) return [];
  const closed = alwaysClosed || samePoint(raw[0], raw[raw.length - 1], 0.01);
  return closed ? raw : [];
}

function pathElementPoints(element) {
  const d = element.getAttribute("d") ?? "";
  if (!/[zZ]/.test(d) || typeof element.getTotalLength !== "function") return [];
  let length = 0;
  try {
    length = element.getTotalLength();
  } catch {
    return [];
  }
  if (!Number.isFinite(length) || length <= 0) return [];
  const steps = Math.max(48, Math.min(240, Math.ceil(length / 2)));
  const points = [];
  for (let i = 0; i < steps; i += 1) {
    const p = element.getPointAtLength((length * i) / steps);
    points.push(svgPoint(element, p.x, p.y));
  }
  return points;
}

function svgElementToOpenPoints(element) {
  const tag = element.tagName.toLowerCase();
  if (tag === "line") {
    return [
      svgPoint(element, svgNumber(element, "x1", 0), svgNumber(element, "y1", 0)),
      svgPoint(element, svgNumber(element, "x2", 0), svgNumber(element, "y2", 0)),
    ];
  }
  if (tag === "polyline") {
    return Array.from(element.points ?? []).map((point) => svgPoint(element, point.x, point.y));
  }
  if (tag === "path") return pathElementOpenPoints(element);
  return [];
}

function pathElementOpenPoints(element) {
  const d = element.getAttribute("d") ?? "";
  const linePoints = parseSimpleMoveLinePath(d);
  if (linePoints.length >= 2) return linePoints.map((point) => svgPoint(element, point.x, point.y));
  if (typeof element.getTotalLength !== "function") return [];
  let length = 0;
  try {
    length = element.getTotalLength();
  } catch {
    return [];
  }
  if (!Number.isFinite(length) || length <= 0) return [];
  const steps = Math.max(2, Math.min(160, Math.ceil(length / 2)));
  const points = [];
  for (let i = 0; i <= steps; i += 1) {
    const p = element.getPointAtLength((length * i) / steps);
    points.push(svgPoint(element, p.x, p.y));
  }
  return points;
}

function parseSimpleMoveLinePath(d) {
  const tokens = String(d).match(/[MLHVZmlhvz]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? [];
  const points = [];
  let i = 0;
  let cmd = null;
  let current = { x: 0, y: 0 };
  while (i < tokens.length) {
    if (/^[MLHVZ]$/i.test(tokens[i])) cmd = tokens[i++];
    if (!cmd || /^Z$/i.test(cmd)) break;
    const relative = cmd === cmd.toLowerCase();
    if (/^[ML]$/i.test(cmd)) {
      if (i + 1 >= tokens.length || Number.isNaN(Number(tokens[i])) || Number.isNaN(Number(tokens[i + 1]))) break;
      const x = Number(tokens[i++]);
      const y = Number(tokens[i++]);
      current = relative ? { x: current.x + x, y: current.y + y } : { x, y };
      points.push({ ...current });
    } else if (/^H$/i.test(cmd)) {
      if (i >= tokens.length || Number.isNaN(Number(tokens[i]))) break;
      const x = Number(tokens[i++]);
      current = { x: relative ? current.x + x : x, y: current.y };
      points.push({ ...current });
    } else if (/^V$/i.test(cmd)) {
      if (i >= tokens.length || Number.isNaN(Number(tokens[i]))) break;
      const y = Number(tokens[i++]);
      current = { x: current.x, y: relative ? current.y + y : y };
      points.push({ ...current });
    } else {
      break;
    }
  }
  return removeConsecutiveDuplicatePoints(points);
}

function removeConsecutiveDuplicatePoints(points) {
  return points.filter((point, index) => index === 0 || !samePoint(point, points[index - 1], 0.001));
}

function svgPoint(element, x, y) {
  const matrix = element.getCTM?.();
  if (!matrix) return { x, y };
  const point = new DOMPoint(x, y).matrixTransform(matrix);
  return { x: point.x, y: point.y };
}

function svgNumber(element, attr, fallback) {
  const value = Number.parseFloat(element.getAttribute(attr) ?? "");
  return Number.isFinite(value) ? value : fallback;
}

export function svgClosedPathContainsPoint(path, point) {
  return pointInPolygon(point, path);
}
