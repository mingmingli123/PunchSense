export function snakePathExportLabel(path, fallbackIndex) {
  if (path?.sourceConnectionLabel) return `path ${path.sourceConnectionLabel}`;
  if (path?.sourceConnectionIndex !== undefined) return `path ${Number(path.sourceConnectionIndex) + 1}`;
  return `path ${fallbackIndex + 1}`;
}

export function takeNearestItems(items, anchor, count, centerFn, distance) {
  if (!items.length || count <= 0) return [];
  const ranked = items
    .map((item, index) => ({ item, index, distance: distance(centerFn(item), anchor) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, Math.min(count, items.length));
  const taken = new Set(ranked.map((entry) => entry.index));
  const selected = ranked.map((entry) => entry.item);
  for (let i = items.length - 1; i >= 0; i -= 1) {
    if (taken.has(i)) items.splice(i, 1);
  }
  return selected;
}

export function pathCenter(path) {
  if (!path?.length) return { x: 0, y: 0 };
  const sum = path.reduce((acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }), { x: 0, y: 0 });
  return { x: sum.x / path.length, y: sum.y / path.length };
}

export function horizontalSegmentCenter(segment) {
  return { x: (segment.x0 + segment.x1) / 2, y: segment.y };
}

export function verticalSegmentCenter(segment) {
  return { x: segment.x, y: (segment.y0 + segment.y1) / 2 };
}

export function removeDuplicatePolylinePoints(points, distance) {
  const result = [];
  for (const point of points) {
    const last = result[result.length - 1];
    if (!last || distance(last, point) > 0.001) result.push(point);
  }
  return result;
}
