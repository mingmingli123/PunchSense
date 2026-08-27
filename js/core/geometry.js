export function layerCountForThickness(thickness, firstLayerHeight, layerHeight) {
  if (thickness <= firstLayerHeight) return 1;
  return 1 + Math.ceil((thickness - firstLayerHeight) / layerHeight);
}

export function layerZ(c, layerIndex) {
  return c.firstLayerHeight + (layerIndex - 1) * c.layerHeight;
}

export function layerPrintHeight(c, layerIndex) {
  return layerIndex === 1 ? c.firstLayerHeight : c.layerHeight;
}

export function normalizeFrame(frame) {
  const x0 = Math.min(frame.x, frame.x + frame.w);
  const y0 = Math.min(frame.y, frame.y + frame.h);
  const x1 = Math.max(frame.x, frame.x + frame.w);
  const y1 = Math.max(frame.y, frame.y + frame.h);
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

export function rectPolygon(frame) {
  return [
    { x: frame.x, y: frame.y },
    { x: frame.x + frame.w, y: frame.y },
    { x: frame.x + frame.w, y: frame.y + frame.h },
    { x: frame.x, y: frame.y + frame.h },
  ];
}

export function samePoint(a, b, epsilon = 0.001) {
  return Math.abs(a.x - b.x) <= epsilon && Math.abs(a.y - b.y) <= epsilon;
}

export function interpolatePoint(a, b, t) {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

export function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function polygonBounds(points) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

export function unionBounds(polygons) {
  return polygonBounds(polygons.flat());
}

export function pointInPolygon(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const pi = polygon[i];
    const pj = polygon[j];
    const crosses = (pi.y > point.y) !== (pj.y > point.y);
    if (crosses) {
      const x = ((pj.x - pi.x) * (point.y - pi.y)) / (pj.y - pi.y) + pi.x;
      if (point.x < x) inside = !inside;
    }
  }
  return inside;
}

export function pointInAnyPolygon(point, polygons) {
  return polygons.some((polygon) => pointInPolygon(point, polygon));
}

export function removeDuplicateClosingPoint(points) {
  if (points.length > 1 && samePoint(points[0], points[points.length - 1], 0.01)) return points.slice(0, -1);
  return points;
}

export function polygonArea(points) {
  let area = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    area += a.x * b.y - b.x * a.y;
  }
  return Math.abs(area) / 2;
}

export function polygonCentroid(points) {
  let area2 = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const cross = a.x * b.y - b.x * a.y;
    area2 += cross;
    cx += (a.x + b.x) * cross;
    cy += (a.y + b.y) * cross;
  }
  if (Math.abs(area2) <= 1e-6) {
    return points.reduce((sum, point) => ({
      x: sum.x + point.x / points.length,
      y: sum.y + point.y / points.length,
    }), { x: 0, y: 0 });
  }
  return { x: cx / (3 * area2), y: cy / (3 * area2) };
}
