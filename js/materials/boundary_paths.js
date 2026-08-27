import {
  distance,
  interpolatePoint,
  samePoint,
} from "../core/geometry.js";

export function createMaterialBoundaryPathModel(deps) {
  const {
    boundaryOverlapWinner,
    materialForPoint,
    materialRegions,
    polygonArea,
    topMaterialRegionAtPoint,
  } = deps;

  function materialBoundaryPaths(c) {
    return materialBoundaryPathsForLayer(c, c.previewLayer)
      .filter((path) => !path.touchesTpu)
      .map((path) => path.points);
  }

  function materialBoundaryPathsForLayer(c, layerIndex) {
    const regions = materialRegions(c).map((region, index) => ({
      ...region,
      area: polygonArea(region.polygon),
      order: index,
    }));
    const segments = [];
    const sampleDistance = Math.max(0.08, c.beadWidth * 0.35);
    for (const region of regions) {
      const polygon = region.polygon;
      for (let i = 0; i < polygon.length; i += 1) {
        const a = polygon[i];
        const b = polygon[(i + 1) % polygon.length];
        const length = distance(a, b);
        if (length <= 0.1) continue;
        const steps = Math.max(1, Math.ceil(length / 1.2));
        let runStart = null;
        for (let step = 0; step < steps; step += 1) {
          const t0 = step / steps;
          const t1 = (step + 1) / steps;
          const mid = interpolatePoint(a, b, (t0 + t1) / 2);
          const boundary = materialBoundaryMaterialAtEdge(mid, a, b, regions, sampleDistance, layerIndex);
          const boundaryMaterial = boundary?.material ?? null;
          if (boundaryMaterial !== null && runStart === null) runStart = { t: t0, material: boundaryMaterial, touchesTpu: boundary.touchesTpu };
          if ((boundaryMaterial === null || boundaryMaterial !== runStart?.material || boundary.touchesTpu !== runStart?.touchesTpu || step === steps - 1) && runStart !== null) {
            const runEnd = boundaryMaterial !== null && boundaryMaterial === runStart.material && boundary.touchesTpu === runStart.touchesTpu && step === steps - 1 ? t1 : t0;
            if (runEnd > runStart.t) {
              segments.push({
                start: interpolatePoint(a, b, runStart.t),
                end: interpolatePoint(a, b, runEnd),
                material: runStart.material,
                touchesTpu: runStart.touchesTpu,
              });
            }
            runStart = boundaryMaterial !== null ? { t: t0, material: boundaryMaterial, touchesTpu: boundary.touchesTpu } : null;
          }
        }
      }
    }
    return chainMaterialSegments(dedupeSegments(segments)).map((path) => ({
      material: path.material,
      touchesTpu: path.touchesTpu,
      points: path.points,
    }));
  }

  function materialBoundaryMaterialAtEdge(mid, a, b, regions, sampleDistance, layerIndex) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.hypot(dx, dy);
    if (length <= 1e-9) return null;
    const nx = -dy / length;
    const ny = dx / length;
    const pointA = { x: mid.x + nx * sampleDistance, y: mid.y + ny * sampleDistance };
    const pointB = { x: mid.x - nx * sampleDistance, y: mid.y - ny * sampleDistance };
    const ownerA = topMaterialRegionAtPoint(pointA, regions);
    const ownerB = topMaterialRegionAtPoint(pointB, regions);
    if (!ownerA || !ownerB) return null;
    const materialA = materialForPoint(pointA, regions);
    const materialB = materialForPoint(pointB, regions);
    if (Number(materialA) === Number(materialB)) return null;
    return {
      material: boundaryOverlapWinner(materialA, materialB, layerIndex),
      touchesTpu: Number(materialA) === 0 || Number(materialB) === 0,
    };
  }

  return {
    materialBoundaryPaths,
    materialBoundaryPathsForLayer,
  };
}

function dedupeSegments(segments) {
  const seen = new Set();
  const result = [];
  for (const segment of segments) {
    const key = `${Number(segment.material)}:${segment.touchesTpu ? 1 : 0}:${segmentKey(segment.start, segment.end)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(segment);
  }
  return result;
}

function chainMaterialSegments(segments) {
  const unused = segments.map((segment) => ({
    start: { ...segment.start },
    end: { ...segment.end },
    material: Number(segment.material),
    touchesTpu: Boolean(segment.touchesTpu),
  }));
  const paths = [];
  while (unused.length > 0) {
    const segment = unused.shift();
    const path = { material: segment.material, touchesTpu: segment.touchesTpu, points: [segment.start, segment.end] };
    let extended = true;
    while (extended) {
      extended = false;
      for (let i = 0; i < unused.length; i += 1) {
        const candidate = unused[i];
        if (candidate.material !== path.material || candidate.touchesTpu !== path.touchesTpu) continue;
        const first = path.points[0];
        const last = path.points[path.points.length - 1];
        if (samePoint(last, candidate.start)) {
          path.points.push(candidate.end);
        } else if (samePoint(last, candidate.end)) {
          path.points.push(candidate.start);
        } else if (samePoint(first, candidate.end)) {
          path.points.unshift(candidate.start);
        } else if (samePoint(first, candidate.start)) {
          path.points.unshift(candidate.end);
        } else {
          continue;
        }
        unused.splice(i, 1);
        extended = true;
        break;
      }
    }
    if (path.points.length >= 2) paths.push(path);
  }
  return paths;
}

function segmentKey(a, b) {
  const p0 = `${a.x.toFixed(3)},${a.y.toFixed(3)}`;
  const p1 = `${b.x.toFixed(3)},${b.y.toFixed(3)}`;
  return p0 < p1 ? `${p0}|${p1}` : `${p1}|${p0}`;
}
