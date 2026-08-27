import {
  intervalsOverlap,
} from "./row_utils.js?v=auto-workflow-pin-endpoint-final-v1-20260827";

export function bestGuideDetourRow(rows, mainY, remainingExtra) {
  if (rows.length === 0 || remainingExtra <= 0.001) return null;
  const idealOffset = remainingExtra / 2;
  return rows
    .filter((y) => Math.abs(y - mainY) * 2 <= remainingExtra + Math.max(0.001, idealOffset * 0.35))
    .sort((a, b) => Math.abs(Math.abs(b - mainY) - idealOffset) - Math.abs(Math.abs(a - mainY) - idealOffset))
    .pop() ?? rows[0];
}

export function guideDetourClearOfBlockedGrid(xa, xb, mainY, detourY, blockedBucket) {
  if (!blockedBucket) return true;
  const x0 = Math.min(xa, xb);
  const x1 = Math.max(xa, xb);
  const y0 = Math.min(mainY, detourY);
  const y1 = Math.max(mainY, detourY);
  if (!guideRowClearOfBlockedGrid(detourY, x0, x1, blockedBucket)) return false;
  return guideColumnClearOfBlockedGrid(xa, y0, y1, blockedBucket)
    && guideColumnClearOfBlockedGrid(xb, y0, y1, blockedBucket);
}

export function guideRowClearOfBlockedGrid(y, x0, x1, blockedBucket) {
  if (!blockedBucket) return true;
  for (const segment of blockedBucket.horizontal ?? []) {
    if (Math.abs(segment.y - y) > 0.001) continue;
    if (intervalsOverlap(segment.x0, segment.x1, x0, x1)) return false;
  }
  for (const segment of blockedBucket.vertical ?? []) {
    if (segment.x < x0 - 0.001 || segment.x > x1 + 0.001) continue;
    if (y >= segment.y0 - 0.001 && y <= segment.y1 + 0.001) return false;
  }
  return true;
}

function guideColumnClearOfBlockedGrid(x, y0, y1, blockedBucket) {
  for (const segment of blockedBucket.vertical ?? []) {
    if (Math.abs(segment.x - x) > 0.001) continue;
    if (intervalsOverlap(segment.y0, segment.y1, y0, y1)) return false;
  }
  for (const segment of blockedBucket.horizontal ?? []) {
    if (segment.y < y0 - 0.001 || segment.y > y1 + 0.001) continue;
    if (x >= segment.x0 - 0.001 && x <= segment.x1 + 0.001) return false;
  }
  return true;
}
