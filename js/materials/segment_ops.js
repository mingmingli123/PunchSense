export function pathBoundsRect(path) {
  if (!Array.isArray(path) || path.length === 0) return null;
  const xs = path.map((point) => point.x);
  const ys = path.map((point) => point.y);
  const x0 = Math.min(...xs);
  const y0 = Math.min(...ys);
  const x1 = Math.max(...xs);
  const y1 = Math.max(...ys);
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

export function subtractPathVerticalCrossingsFromHorizontalSegments(segments, path, c) {
  const halfGap = Math.max(0.001, Number(c.beadWidth ?? 0.4) * 0.55);
  const cuts = [];
  for (let i = 1; i < path.length; i += 1) {
    const a = path[i - 1];
    const b = path[i];
    if (Math.abs(a.x - b.x) > 0.001 || Math.abs(a.y - b.y) <= 0.001) continue;
    cuts.push({ x: a.x, y0: Math.min(a.y, b.y), y1: Math.max(a.y, b.y) });
  }
  if (cuts.length === 0) return segments;
  return segments.flatMap((segment) => {
    let spans = [[segment.x0, segment.x1]];
    for (const cut of cuts) {
      if (segment.y < cut.y0 - 0.001 || segment.y > cut.y1 + 0.001) continue;
      spans = subtractIntervals(spans, [[cut.x - halfGap, cut.x + halfGap]]);
      if (spans.length === 0) break;
    }
    return spans.map(([x0, x1]) => ({ ...segment, x0, x1 })).filter((item) => item.x1 - item.x0 > 0.1);
  });
}

export function subtractPathHorizontalCrossingsFromVerticalSegments(segments, path, c) {
  const halfGap = Math.max(0.001, Number(c.beadWidth ?? 0.4) * 0.55);
  const cuts = [];
  for (let i = 1; i < path.length; i += 1) {
    const a = path[i - 1];
    const b = path[i];
    if (Math.abs(a.y - b.y) > 0.001 || Math.abs(a.x - b.x) <= 0.001) continue;
    cuts.push({ y: a.y, x0: Math.min(a.x, b.x), x1: Math.max(a.x, b.x) });
  }
  if (cuts.length === 0) return segments;
  return segments.flatMap((segment) => {
    let spans = [[segment.y0, segment.y1]];
    for (const cut of cuts) {
      if (segment.x < cut.x0 - 0.001 || segment.x > cut.x1 + 0.001) continue;
      spans = subtractIntervals(spans, [[cut.y - halfGap, cut.y + halfGap]]);
      if (spans.length === 0) break;
    }
    return spans.map(([y0, y1]) => ({ ...segment, y0, y1 })).filter((item) => item.y1 - item.y0 > 0.1);
  });
}

export function subtractCellRectsFromSegments(segments, direction, rects, c, mergeNumericIntervals) {
  const margin = Math.max(0.01, Number(c.beadWidth ?? 0.4) * 0.45);
  return segments.flatMap((segment) => {
    const blocked = [];
    for (const rect of rects) {
      if (direction === "horizontal") {
        if (segment.y < rect.y - margin || segment.y > rect.y + rect.h + margin) continue;
        blocked.push([rect.x - margin, rect.x + rect.w + margin]);
      } else {
        if (segment.x < rect.x - margin || segment.x > rect.x + rect.w + margin) continue;
        blocked.push([rect.y - margin, rect.y + rect.h + margin]);
      }
    }
    const source = direction === "horizontal" ? [[segment.x0, segment.x1]] : [[segment.y0, segment.y1]];
    return subtractIntervals(source, mergeNumericIntervals(blocked))
      .filter(([a, b]) => b - a > 0.1)
      .map(([a, b]) => direction === "horizontal"
        ? { ...segment, x0: a, x1: b }
        : { ...segment, y0: a, y1: b });
  });
}

export function subtractOverlappingLineSegments(segments, blockers, direction, c, mergeNumericIntervals) {
  const margin = Math.max(0.01, Number(c.beadWidth ?? 0.4) * 0.5);
  return segments.flatMap((segment) => {
    const sameLineBlockers = blockers
      .filter((blocker) => sameGridLine(segment, blocker, direction))
      .map((blocker) => direction === "horizontal"
        ? [blocker.x0 - margin, blocker.x1 + margin]
        : [blocker.y0 - margin, blocker.y1 + margin]);
    if (sameLineBlockers.length === 0) return [segment];
    const source = direction === "horizontal"
      ? [[segment.x0, segment.x1]]
      : [[segment.y0, segment.y1]];
    return subtractIntervals(source, mergeNumericIntervals(sameLineBlockers))
      .filter(([a, b]) => b - a > 0.1)
      .map(([a, b]) => direction === "horizontal"
        ? { ...segment, x0: a, x1: b }
        : { ...segment, y0: a, y1: b });
  });
}

export function subtractSameLineSegments(sourceSegments, occupiedSegments, direction, material, mergeNumericIntervals, removedSpansBetweenKept) {
  const removed = [];
  for (const source of sourceSegments) {
    const overlaps = occupiedSegments
      .filter((segment) => sameGridLine(source, segment, direction))
      .map((segment) => direction === "horizontal" ? [segment.x0, segment.x1] : [segment.y0, segment.y1]);
    const sourceStart = direction === "horizontal" ? source.x0 : source.y0;
    const sourceEnd = direction === "horizontal" ? source.x1 : source.y1;
    for (const [a, b] of removedSpansBetweenKept(sourceStart, sourceEnd, mergeNumericIntervals(overlaps))) {
      removed.push(direction === "horizontal"
        ? { ...source, x0: a, x1: b, material }
        : { ...source, y0: a, y1: b, material });
    }
  }
  return removed;
}

export function subtractIntervals(spans, blocked) {
  let result = spans;
  for (const [blockA, blockB] of blocked) {
    const next = [];
    const a = Math.min(blockA, blockB);
    const b = Math.max(blockA, blockB);
    for (const [s0, s1] of result) {
      if (b <= s0 + 0.001 || a >= s1 - 0.001) {
        next.push([s0, s1]);
      } else {
        if (a - s0 > 0.1) next.push([s0, a]);
        if (s1 - b > 0.1) next.push([b, s1]);
      }
    }
    result = next;
    if (result.length === 0) break;
  }
  return result;
}

export function sameGridLine(a, b, direction) {
  return direction === "horizontal" ? Math.abs(a.y - b.y) <= 0.001 : Math.abs(a.x - b.x) <= 0.001;
}

export function rectsOverlap(a, b) {
  if (!a || !b) return false;
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
