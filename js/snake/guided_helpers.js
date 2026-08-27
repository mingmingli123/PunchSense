import { hasRepeatedGridEdge } from "./candidate_validation.js?v=auto-workflow-pin-endpoint-final-v1-20260827";
import {
  appendGeneratedSnakePoint,
  intervalsOverlap,
  nearestValue,
  orthogonalEndpointConnector,
  pointOnGridLine,
  removeConsecutiveDuplicatePoints,
  uniqueSortedNumbers,
} from "./row_utils.js?v=auto-workflow-pin-endpoint-final-v1-20260827";

export function createGuidedPathHelpers({ guidedSerpentineFromPolyline }) {
  return {
    anchorGuidedPathEndpoints,
    guidedSerpentineFromPolyline,
    hasRepeatedGridEdge,
    intervalsOverlap,
    nearestValue,
    orthogonalizeGuidePoints,
    orthogonalizePolylineSegments,
    uniqueSortedNumbers,
  };
}

function anchorGuidedPathEndpoints(points, endpoints, deps) {
  if (!Array.isArray(points) || points.length < 2 || !Array.isArray(endpoints) || endpoints.length < 2) return points;
  let result = points.slice();
  const start = endpoints[0];
  const end = endpoints[1];
  if (!deps.samePoint(result[0], start, 0.001)) {
    result = [...orthogonalEndpointConnector(start, result[0]), ...result.slice(1)];
  } else {
    result[0] = { x: start.x, y: start.y };
  }
  if (!deps.samePoint(result[result.length - 1], end, 0.001)) {
    result = [...result.slice(0, -1), ...orthogonalEndpointConnector(result[result.length - 1], end)];
  } else {
    result[result.length - 1] = { x: end.x, y: end.y };
  }
  return removeConsecutiveDuplicatePoints(result, deps);
}

function orthogonalizeGuidePoints(points, sourceBucket, deps) {
  if (points.length < 2) return points;
  const result = [points[0]];
  for (let i = 1; i < points.length; i += 1) {
    const a = result[result.length - 1];
    const b = points[i];
    if (deps.samePoint(a, b, 0.001)) continue;
    if (Math.abs(a.x - b.x) <= 0.001 || Math.abs(a.y - b.y) <= 0.001) {
      result.push(b);
      continue;
    }
    const xyCorner = { x: b.x, y: a.y };
    const yxCorner = { x: a.x, y: b.y };
    const xyOk = pointOnGridLine(a, xyCorner, sourceBucket) && pointOnGridLine(xyCorner, b, sourceBucket);
    const yxOk = pointOnGridLine(a, yxCorner, sourceBucket) && pointOnGridLine(yxCorner, b, sourceBucket);
    if (xyOk || !yxOk) result.push(xyCorner, b);
    else result.push(yxCorner, b);
  }
  return result;
}

function orthogonalizePolylineSegments(points, deps) {
  const cleaned = removeConsecutiveDuplicatePoints(points, deps);
  if (cleaned.length < 2) return cleaned;
  const result = [];
  appendGeneratedSnakePoint(result, cleaned[0], deps);
  for (let i = 1; i < cleaned.length; i += 1) {
    const a = result[result.length - 1];
    const b = cleaned[i];
    if (deps.samePoint(a, b, 0.001)) continue;
    const sameX = Math.abs(a.x - b.x) <= 0.001;
    const sameY = Math.abs(a.y - b.y) <= 0.001;
    if (sameX || sameY) {
      result.push(b);
      continue;
    }
    const previous = result.length >= 2 ? result[result.length - 2] : null;
    const continueHorizontal = previous && Math.abs(previous.y - a.y) <= 0.001;
    const continueVertical = previous && Math.abs(previous.x - a.x) <= 0.001;
    const corner = continueHorizontal
      ? { x: b.x, y: a.y }
      : continueVertical
        ? { x: a.x, y: b.y }
        : Math.abs(b.x - a.x) >= Math.abs(b.y - a.y)
          ? { x: b.x, y: a.y }
          : { x: a.x, y: b.y };
    appendGeneratedSnakePoint(result, corner, deps);
    appendGeneratedSnakePoint(result, b, deps);
  }
  return removeConsecutiveDuplicatePoints(result, deps);
}
