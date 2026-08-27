import {
  distance,
  interpolatePoint,
  pointInPolygon,
  samePoint,
} from "../core/geometry.js";
import {
  distancePointToSegment,
} from "../shape_editing.js";

export function visibleUnionEdgePaths(polygons, segmentLength) {
  return chainSegments(visibleUnionEdgeSegments(polygons, segmentLength));
}

function visibleUnionEdgeSegments(polygons, segmentLength) {
  const result = [];
  for (let polygonIndex = 0; polygonIndex < polygons.length; polygonIndex += 1) {
    const polygon = polygons[polygonIndex];
    for (let i = 0; i < polygon.length; i += 1) {
      const a = polygon[i];
      const b = polygon[(i + 1) % polygon.length];
      const length = distance(a, b);
      const steps = Math.max(1, Math.ceil(length / segmentLength));
      let runStart = null;
      for (let s = 0; s < steps; s += 1) {
        const t0 = s / steps;
        const t1 = (s + 1) / steps;
        const mid = interpolatePoint(a, b, (t0 + t1) / 2);
        const hidden = polygons.some((other, otherIndex) => (
          otherIndex !== polygonIndex && pointCoveredByPolygonForUnionEdge(mid, other)
        ));
        if (!hidden && runStart === null) runStart = t0;
        if ((hidden || s === steps - 1) && runStart !== null) {
          const runEnd = hidden ? t0 : t1;
          if (runEnd > runStart) {
            result.push({
              start: interpolatePoint(a, b, runStart),
              end: interpolatePoint(a, b, runEnd),
            });
          }
          runStart = null;
        }
      }
    }
  }
  return result;
}

function pointCoveredByPolygonForUnionEdge(point, polygon) {
  return pointInPolygon(point, polygon) || pointOnPolygonBoundary(point, polygon, 0.02);
}

function pointOnPolygonBoundary(point, polygon, epsilon = 0.001) {
  for (let i = 0; i < polygon.length; i += 1) {
    if (distancePointToSegment(point, polygon[i], polygon[(i + 1) % polygon.length]) <= epsilon) return true;
  }
  return false;
}

function chainSegments(segments) {
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
