export function snakePathStats(path, deps) {
  let horizontal = 0;
  let vertical = 0;
  let length = 0;
  for (let i = 1; i < path.length; i += 1) {
    const a = path[i - 1];
    const b = path[i];
    const segmentLength = deps.distance(a, b);
    if (segmentLength <= 0.001) continue;
    length += segmentLength;
    if (Math.abs(a.y - b.y) <= Math.abs(a.x - b.x)) horizontal += 1;
    else vertical += 1;
  }
  return { horizontal, vertical, length };
}

export function pathLength(path, deps) {
  let total = 0;
  for (let i = 1; i < path.length; i += 1) total += deps.distance(path[i - 1], path[i]);
  return total;
}
