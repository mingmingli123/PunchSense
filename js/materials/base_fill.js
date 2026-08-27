export function plaSolidBasePaths(c, deps) {
  const {
    frameMaterial,
    offsetFramePath,
    pointInPolygon,
    polygonArea,
    polygonBounds,
    polygonCentroid,
    removeDuplicateClosingPoint,
  } = deps;

  const paths = [];
  const polygons = c.polygons
    .map((polygon) => removeDuplicateClosingPoint(polygon))
    .filter((polygon) => polygon.length >= 3 && polygonArea(polygon) > 0.05);
  for (const polygon of polygons) {
    paths.push([...polygon, polygon[0]]);
  }
  const regions = polygons.map((polygon) => ({ material: frameMaterial, polygon }));
  const spacing = Math.max(0.05, c.beadWidth);
  const maxLoops = 180;
  for (const region of regions) {
    const polygon = region.polygon;
    const bounds = polygonBounds(polygon);
    const limit = Math.min(bounds.w, bounds.h) / 2;
    let previousArea = polygonArea(polygon);
    for (let offset = spacing, loop = 0; offset <= limit + 0.001 && loop < maxLoops; offset += spacing, loop += 1) {
      const path = offsetFramePath([...polygon, polygon[0]], [polygon], -offset);
      const clean = removeDuplicateClosingPoint(path);
      const area = polygonArea(clean);
      if (clean.length < 3 || area < c.beadWidth * c.beadWidth || area >= previousArea - 0.001) break;
      const center = polygonCentroid(clean);
      if (!pointInPolygon(center, polygon)) break;
      paths.push([...clean, clean[0]]);
      previousArea = area;
    }
  }
  return paths;
}
