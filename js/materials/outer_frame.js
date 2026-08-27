import {
  appendFramePathsWithBoundaryOwnership,
} from "../grid_segments.js";

export function createWhiteTpuOuterFramePostprocess({
  firstLayerMaterial,
  materialRegions,
  materialSegmentBucket,
  mergeAllMaterialBuckets,
  tpuPathDeps,
  visibleUnionEdgePaths,
  offsetFramePath,
  toolForMaterial,
  gridAxisPositions,
  pointInAnyPolygon,
  samePoint,
  removeDuplicateClosingPoint,
  polygonArea,
  unionBounds,
}) {
  function addWhiteTpuOuterFrameToSegments(result, c) {
    if (c.frameLoops <= 0 || whiteTpuOuterFrameSourcePolygons(c).length === 0) return result;
    const bucket = materialSegmentBucket(result, firstLayerMaterial);
    appendFramePathsWithBoundaryOwnership(bucket, whiteTpuOuterFramePaths(c), "paths");
    mergeAllMaterialBuckets(result, tpuPathDeps());
    return result;
  }

  function whiteTpuOuterFramePaths(c) {
    const paths = [];
    const framePolygons = whiteTpuOuterFrameSourcePolygons(c);
    if (framePolygons.length === 0) return paths;
    const basePaths = whiteTpuOuterCellOutlinePaths(c, framePolygons);
    const sourcePaths = basePaths.length > 0 ? basePaths : visibleUnionEdgePaths(framePolygons, 0.8);
    for (let i = 0; i < c.frameLoops; i += 1) {
      const off = -i * c.frameSpacing;
      for (const path of sourcePaths) {
        const framedPath = offsetFramePath(path, framePolygons, off);
        const cleanPath = cleanFramePath(framedPath);
        if (cleanPath.length >= 2) paths.push(cleanPath);
      }
    }
    return paths;
  }

  function whiteTpuOuterCellOutlinePaths(c, framePolygons) {
    const bounds = unionBounds(framePolygons);
    const xs = gridAxisPositions(bounds, c, "x");
    const ys = gridAxisPositions(bounds, c, "y");
    if (xs.length < 2 || ys.length < 2) return [];
    const occupied = new Set();
    for (let xi = 0; xi < xs.length - 1; xi += 1) {
      const x0 = xs[xi];
      const x1 = xs[xi + 1];
      if (x1 - x0 <= 0.1) continue;
      for (let yi = 0; yi < ys.length - 1; yi += 1) {
        const y0 = ys[yi];
        const y1 = ys[yi + 1];
        if (y1 - y0 <= 0.1) continue;
        if (whiteTpuFrameCellOccupied(x0, x1, y0, y1, framePolygons)) occupied.add(`${xi},${yi}`);
      }
    }
    if (occupied.size === 0) return [];
    const hasCell = (xi, yi) => occupied.has(`${xi},${yi}`);
    const segments = [];
    for (const key of occupied) {
      const [xi, yi] = key.split(",").map(Number);
      const x0 = xs[xi];
      const x1 = xs[xi + 1];
      const y0 = ys[yi];
      const y1 = ys[yi + 1];
      if (!hasCell(xi, yi - 1)) segments.push({ start: { x: x0, y: y0 }, end: { x: x1, y: y0 } });
      if (!hasCell(xi + 1, yi)) segments.push({ start: { x: x1, y: y0 }, end: { x: x1, y: y1 } });
      if (!hasCell(xi, yi + 1)) segments.push({ start: { x: x1, y: y1 }, end: { x: x0, y: y1 } });
      if (!hasCell(xi - 1, yi)) segments.push({ start: { x: x0, y: y1 }, end: { x: x0, y: y0 } });
    }
    return chainSegments(segments, samePoint)
      .map((path) => simplifyCollinearFramePath(closeFramePath(path)))
      .filter((path) => path.length >= 2);
  }

  function whiteTpuFrameCellOccupied(x0, x1, y0, y1, framePolygons) {
    const insetX = (x1 - x0) * 0.22;
    const insetY = (y1 - y0) * 0.22;
    const samples = [
      { x: (x0 + x1) / 2, y: (y0 + y1) / 2 },
      { x: x0 + insetX, y: y0 + insetY },
      { x: x1 - insetX, y: y0 + insetY },
      { x: x0 + insetX, y: y1 - insetY },
      { x: x1 - insetX, y: y1 - insetY },
    ];
    return samples.filter((point) => pointInAnyPolygon(point, framePolygons)).length >= 2;
  }

  function closeFramePath(path) {
    if (path.length < 2 || samePoint(path[0], path[path.length - 1], 0.001)) return path;
    return [...path, { ...path[0] }];
  }

  function simplifyCollinearFramePath(path) {
    const closed = path.length > 2 && samePoint(path[0], path[path.length - 1], 0.001);
    const points = closed ? removeDuplicateClosingPoint(path) : path.slice();
    if (points.length < 3) return path;
    const simplified = [];
    for (let i = 0; i < points.length; i += 1) {
      const prev = points[(i - 1 + points.length) % points.length];
      const point = points[i];
      const next = points[(i + 1) % points.length];
      const cross = (point.x - prev.x) * (next.y - point.y) - (point.y - prev.y) * (next.x - point.x);
      if (Math.abs(cross) <= 0.0001) continue;
      simplified.push(point);
    }
    if (!closed) return simplified;
    if (simplified.length > 0) simplified.push({ ...simplified[0] });
    return simplified;
  }

  function whiteTpuOuterFrameSourcePolygons(c) {
    return materialRegions(c)
      .filter((region) => Number(region.material) >= 0)
      .map((region) => removeDuplicateClosingPoint(region.polygon))
      .filter((polygon) => polygon.length >= 3 && Math.abs(polygonArea(polygon)) > 0.05);
  }

  function cleanFramePath(path) {
    if (!Array.isArray(path) || path.length < 2) return [];
    const cleaned = path.filter((point, index) => index === 0 || !samePoint(point, path[index - 1], 0.001));
    if (cleaned.length < 2) return [];
    return cleaned;
  }

  return {
    addWhiteTpuOuterFrameToSegments,
    whiteTpuOuterFramePaths,
  };
}

function chainSegments(segments, samePoint) {
  const unused = segments.map((segment) => ({
    start: { ...segment.start },
    end: { ...segment.end },
  }));
  const paths = [];
  while (unused.length > 0) {
    const segment = unused.shift();
    const path = [segment.start, segment.end];
    let extended = true;
    while (extended) {
      extended = false;
      for (let i = 0; i < unused.length; i += 1) {
        const candidate = unused[i];
        const first = path[0];
        const last = path[path.length - 1];
        if (samePoint(last, candidate.start)) {
          path.push(candidate.end);
        } else if (samePoint(last, candidate.end)) {
          path.push(candidate.start);
        } else if (samePoint(first, candidate.end)) {
          path.unshift(candidate.start);
        } else if (samePoint(first, candidate.start)) {
          path.unshift(candidate.end);
        } else {
          continue;
        }
        unused.splice(i, 1);
        extended = true;
        break;
      }
    }
    if (path.length >= 2) paths.push(path);
  }
  return paths;
}
