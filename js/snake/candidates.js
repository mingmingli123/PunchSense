import { pathLength } from "./stats.js?v=auto-workflow-pin-endpoint-final-v1-20260827";
import {
  transposePoint,
  transposeSnakeBucket,
  transposeSnakeDeps,
} from "./orientation.js?v=auto-workflow-pin-endpoint-final-v1-20260827";

export function buildTpuSnakePath(tpuBucket, c, deps, buildInOrientation) {
  const horizontal = {
    ...buildInOrientation(tpuBucket, c, deps),
    sweepDirection: "horizontal",
  };
  const vertical = buildInOrientation(transposeSnakeBucket(tpuBucket), c, transposeSnakeDeps(deps));
  const verticalPath = {
    ...vertical,
    points: vertical.points.map(transposePoint),
    sweepDirection: "vertical",
  };
  return betterSnakePath(horizontal, verticalPath, c, deps);
}

function betterSnakePath(a, b, c, deps) {
  if (!a?.points?.length) return b;
  if (!b?.points?.length) return a;
  const target = Number(c.tpuSnakeTargetLength ?? 0);
  const aLength = pathLength(a.points, deps);
  const bLength = pathLength(b.points, deps);
  const aScore = target > 0 ? Math.abs(aLength - target) : aLength;
  const bScore = target > 0 ? Math.abs(bLength - target) : bLength;
  return bScore < aScore ? b : a;
}
