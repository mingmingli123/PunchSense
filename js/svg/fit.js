import { unionBounds } from "../core/geometry.js";

export function fitSvgGeometryToBed(geometry, c, options = {}) {
  const {
    simplifyGuidePoints = (points) => points,
  } = options;
  const polygons = geometry.polygons ?? [];
  const guidePaths = geometry.guidePaths ?? [];
  const bounds = unionBounds(polygons);
  const margin = Math.min(15, Math.max(4, Math.min(c.bedWidth, c.bedDepth) * 0.06));
  const availableW = Math.max(1, c.bedWidth - margin * 2);
  const availableH = Math.max(1, c.bedDepth - margin * 2);
  const scale = Math.min(availableW / Math.max(bounds.w, 0.001), availableH / Math.max(bounds.h, 0.001));
  const dx = (c.bedWidth - bounds.w * scale) / 2 - bounds.x * scale;
  const dy = (c.bedDepth - bounds.h * scale) / 2 - bounds.y * scale;
  const transform = (point) => ({
    x: point.x * scale + dx,
    y: point.y * scale + dy,
  });
  return {
    polygons: polygons.map((polygon) => polygon.map(transform)),
    polygonMaterials: geometry.polygonMaterials ?? [],
    guidePaths: guidePaths
      .map((path) => simplifyGuidePoints(path.map(transform)))
      .filter((path) => path.length >= 2),
  };
}

export function fitSvgPolygonsToBed(polygons, c) {
  return fitSvgGeometryToBed({ polygons, guidePaths: [] }, c).polygons;
}
