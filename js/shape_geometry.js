import {
  polygonBounds,
  rectPolygon,
} from "./core/geometry.js";

export function shapeToPolygon(shape) {
  if (shape.type === "rect") return rectPolygon(shape);
  if (shape.type === "polygon") return shape.points.map((point) => ({ x: point.x, y: point.y }));
  if (shape.type === "circle") {
    const pts = [];
    for (let i = 0; i < 64; i += 1) {
      const a = (Math.PI * 2 * i) / 64;
      pts.push({ x: shape.x + Math.cos(a) * shape.r, y: shape.y + Math.sin(a) * shape.r });
    }
    return pts;
  }
  if (shape.type === "triangle") return regularPolygon(shape.x, shape.y, shape.r, 3, shape.rotation ?? -Math.PI / 2);
  if (shape.type === "hexagon") return regularPolygon(shape.x, shape.y, shape.r, 6, shape.rotation ?? Math.PI / 6);
  return [];
}

export function regularPolygon(x, y, r, sides, rotation) {
  const pts = [];
  for (let i = 0; i < sides; i += 1) {
    const a = rotation + (Math.PI * 2 * i) / sides;
    pts.push({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r });
  }
  return pts;
}

export function shapeHandles(shape) {
  if (shape.type === "rect") {
    return rectPolygon(shape).map((point, index) => ({ ...point, type: "corner", index }));
  }
  if (shape.type === "polygon") {
    const points = shapeToPolygon(shape);
    if (points.length <= 48) return points.map((point, index) => ({ ...point, type: "polygonVertex", index }));
    return rectPolygon(polygonBounds(points)).map((point, index) => ({ ...point, type: "bounds", index }));
  }
  if (shape.type === "circle") return [{ type: "radius", x: shape.x + shape.r, y: shape.y }];
  if (shape.type === "triangle" || shape.type === "hexagon") {
    return shapeToPolygon(shape).map((point, index) => ({ ...point, type: "vertex", index }));
  }
  return [];
}

export function polygonSides(type) {
  if (type === "triangle") return 3;
  if (type === "hexagon") return 6;
  return 64;
}
