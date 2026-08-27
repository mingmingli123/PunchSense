export function createFrameWriter({
  frameMaterial,
  visibleUnionEdgePaths,
  offsetFramePath,
  addPolyline,
  materialFlow,
}) {
  function addBoundaryPathsForMaterial(lines, c, layerIndex, material) {
    if (!c.materialBoundaryFrames) return;
    lines.push(`; Layer ${layerIndex} material T${material} raw SVG boundary frames skipped; printable boundaries are derived from snapped grid geometry.`);
  }

  function addFrame(lines, c, z, flow, name, printHeight = c.layerHeight, material = frameMaterial) {
    lines.push(`; Begin ${name} loops at Z${z.toFixed(3)}, flow ${materialFlow(c, material, flow).toFixed(3)}`);
    lines.push(";TYPE:Outer wall");
    lines.push(`;WIDTH:${c.beadWidth.toFixed(3)}`);
    const usePolygonFrames = c.shapeMode === "free"
      || c.shapeMode === "polyline"
      || c.polygons.length !== 1
      || c.frame.w <= 0
      || c.frame.h <= 0;
    if (!usePolygonFrames && c.frameLoops > 0) {
      const continuous = [];
      for (let i = 0; i < c.frameLoops; i += 1) {
        const pts = rectFramePoints(c, i * c.frameSpacing);
        if (i === 0) continuous.push(...pts);
        else continuous.push(pts[0], ...pts.slice(1));
      }
      addPolyline(lines, c, continuous, z, flow, printHeight, material);
      return;
    }
    for (let i = 0; i < c.frameLoops; i += 1) {
      if (usePolygonFrames) {
        const off = i * c.frameSpacing;
        for (const path of visibleUnionEdgePaths(c.polygons, 0.8)) {
          addPolyline(lines, c, offsetFramePath(path, c.polygons, off), z, flow, printHeight, material);
        }
      }
    }
  }

  return { addBoundaryPathsForMaterial, addFrame };
}

function rectFramePoints(c, off) {
  const x0 = c.frame.x - off;
  const y0 = c.frame.y - off;
  const x1 = c.frame.x + c.frame.w + off;
  const y1 = c.frame.y + c.frame.h + off;
  return [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }, { x: x0, y: y0 }];
}
