export function subtractSnakeHorizontalFromSegments(segments, path, overlap = 0, cornerRelief = 0) {
  const snakeByY = new Map();
  for (let i = 1; i < path.length; i += 1) {
    const a = path[i - 1];
    const b = path[i];
    if (Math.abs(a.y - b.y) > 0.001 || Math.abs(a.x - b.x) <= 0.001) continue;
    const key = a.y.toFixed(3);
    if (!snakeByY.has(key)) snakeByY.set(key, []);
    snakeByY.get(key).push([Math.min(a.x, b.x), Math.max(a.x, b.x)]);
  }
  for (const corner of snakeTurnPoints(path)) {
    const key = corner.y.toFixed(3);
    if (!snakeByY.has(key)) snakeByY.set(key, []);
    snakeByY.get(key).push([corner.x - cornerRelief, corner.x + cornerRelief]);
  }
  const result = [];
  for (const segment of segments) {
    let spans = [[segment.x0, segment.x1]];
    for (const [rawA, rawB] of snakeByY.get(segment.y.toFixed(3)) ?? []) {
      const a = Math.min(rawB, rawA + overlap);
      const b = Math.max(rawA, rawB - overlap);
      if (b <= a + 0.001) continue;
      const next = [];
      for (const [x0, x1] of spans) {
        if (b <= x0 + 0.001 || a >= x1 - 0.001) next.push([x0, x1]);
        else {
          if (a - x0 > 0.1) next.push([x0, a]);
          if (x1 - b > 0.1) next.push([b, x1]);
        }
      }
      spans = next;
    }
    for (const [x0, x1] of spans) result.push({ ...segment, x0, x1 });
  }
  return result;
}

export function subtractSnakeVerticalFromSegments(segments, path, overlap = 0, cornerRelief = 0) {
  const snakeByX = new Map();
  for (let i = 1; i < path.length; i += 1) {
    const a = path[i - 1];
    const b = path[i];
    if (Math.abs(a.x - b.x) > 0.001 || Math.abs(a.y - b.y) <= 0.001) continue;
    const key = a.x.toFixed(3);
    if (!snakeByX.has(key)) snakeByX.set(key, []);
    snakeByX.get(key).push([Math.min(a.y, b.y), Math.max(a.y, b.y)]);
  }
  for (const corner of snakeTurnPoints(path)) {
    const key = corner.x.toFixed(3);
    if (!snakeByX.has(key)) snakeByX.set(key, []);
    snakeByX.get(key).push([corner.y - cornerRelief, corner.y + cornerRelief]);
  }
  const result = [];
  for (const segment of segments) {
    let spans = [[segment.y0, segment.y1]];
    for (const [rawA, rawB] of snakeByX.get(segment.x.toFixed(3)) ?? []) {
      const a = Math.min(rawB, rawA + overlap);
      const b = Math.max(rawA, rawB - overlap);
      if (b <= a + 0.001) continue;
      const next = [];
      for (const [y0, y1] of spans) {
        if (b <= y0 + 0.001 || a >= y1 - 0.001) next.push([y0, y1]);
        else {
          if (a - y0 > 0.1) next.push([y0, a]);
          if (y1 - b > 0.1) next.push([b, y1]);
        }
      }
      spans = next;
    }
    for (const [y0, y1] of spans) result.push({ ...segment, y0, y1 });
  }
  return result;
}

export function subtractSnakeVerticalCrossingsFromHorizontalSegments(segments, path, overlap = 0) {
  const cuts = [];
  const gap = Math.max(0.001, overlap);
  for (let i = 1; i < path.length; i += 1) {
    const a = path[i - 1];
    const b = path[i];
    if (Math.abs(a.x - b.x) > 0.001 || Math.abs(a.y - b.y) <= 0.001) continue;
    cuts.push({ x: a.x, y0: Math.min(a.y, b.y), y1: Math.max(a.y, b.y) });
  }
  const result = [];
  for (const segment of segments) {
    let spans = [[segment.x0, segment.x1]];
    for (const cut of cuts) {
      if (segment.y < cut.y0 - 0.001 || segment.y > cut.y1 + 0.001) continue;
      const a = cut.x - gap;
      const b = cut.x + gap;
      spans = subtractLineSpans(spans, a, b);
    }
    for (const [x0, x1] of spans) result.push({ ...segment, x0, x1 });
  }
  return result;
}

export function subtractSnakeHorizontalCrossingsFromVerticalSegments(segments, path, overlap = 0) {
  const cuts = [];
  const gap = Math.max(0.001, overlap);
  for (let i = 1; i < path.length; i += 1) {
    const a = path[i - 1];
    const b = path[i];
    if (Math.abs(a.y - b.y) > 0.001 || Math.abs(a.x - b.x) <= 0.001) continue;
    cuts.push({ y: a.y, x0: Math.min(a.x, b.x), x1: Math.max(a.x, b.x) });
  }
  const result = [];
  for (const segment of segments) {
    let spans = [[segment.y0, segment.y1]];
    for (const cut of cuts) {
      if (segment.x < cut.x0 - 0.001 || segment.x > cut.x1 + 0.001) continue;
      const a = cut.y - gap;
      const b = cut.y + gap;
      spans = subtractLineSpans(spans, a, b);
    }
    for (const [y0, y1] of spans) result.push({ ...segment, y0, y1 });
  }
  return result;
}

function subtractLineSpans(spans, a, b) {
  const result = [];
  for (const [s0, s1] of spans) {
    if (b <= s0 + 0.001 || a >= s1 - 0.001) {
      result.push([s0, s1]);
      continue;
    }
    if (a - s0 > 0.1) result.push([s0, a]);
    if (s1 - b > 0.1) result.push([b, s1]);
  }
  return result;
}

function snakeTurnPoints(path) {
  const points = [];
  for (let i = 1; i < path.length - 1; i += 1) {
    const prev = path[i - 1];
    const point = path[i];
    const next = path[i + 1];
    const prevHorizontal = Math.abs(prev.y - point.y) <= 0.001 && Math.abs(prev.x - point.x) > 0.001;
    const prevVertical = Math.abs(prev.x - point.x) <= 0.001 && Math.abs(prev.y - point.y) > 0.001;
    const nextHorizontal = Math.abs(next.y - point.y) <= 0.001 && Math.abs(next.x - point.x) > 0.001;
    const nextVertical = Math.abs(next.x - point.x) <= 0.001 && Math.abs(next.y - point.y) > 0.001;
    if ((prevHorizontal && nextVertical) || (prevVertical && nextHorizontal)) points.push(point);
  }
  return points;
}
