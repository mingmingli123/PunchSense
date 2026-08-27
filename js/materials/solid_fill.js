export function solidCellConcentricFillPaths(solidCells, c) {
  const paths = [];
  const spacing = Math.max(0.05, Number(c.beadWidth ?? 0.42));
  for (const rect of mergedSolidCellRects(solidCells)) {
    const maxInset = Math.min(rect.w, rect.h) / 2;
    for (let inset = 0, loop = 0; inset <= maxInset - spacing * 0.35 && loop < 240; inset += spacing, loop += 1) {
      const x0 = rect.x + inset;
      const y0 = rect.y + inset;
      const x1 = rect.x + rect.w - inset;
      const y1 = rect.y + rect.h - inset;
      if (x1 - x0 < spacing * 0.7 || y1 - y0 < spacing * 0.7) break;
      paths.push([
        { x: x0, y: y0 },
        { x: x1, y: y0 },
        { x: x1, y: y1 },
        { x: x0, y: y1 },
        { x: x0, y: y0 },
      ]);
    }
  }
  return paths;
}

function mergedSolidCellRects(solidCells) {
  const xs = solidCells.xs ?? [];
  const ys = solidCells.ys ?? [];
  const rows = new Map();
  for (const rect of solidCells.rects ?? []) {
    if (!rows.has(rect.yi)) rows.set(rect.yi, []);
    rows.get(rect.yi).push(rect.xi);
  }
  const active = new Map();
  const completed = [];
  let lastYi = null;
  for (const yi of [...rows.keys()].sort((a, b) => a - b)) {
    if (lastYi !== null && yi > lastYi + 1) {
      completed.push(...active.values());
      active.clear();
    }
    const rowRuns = contiguousIndexRuns(rows.get(yi));
    const nextActive = new Map();
    for (const [xi0, xi1] of rowRuns) {
      const key = `${xi0}:${xi1}`;
      const previous = active.get(key);
      if (previous && previous.yi1 === yi - 1) {
        nextActive.set(key, { ...previous, yi1: yi });
      } else {
        if (previous) completed.push(previous);
        nextActive.set(key, { xi0, xi1, yi0: yi, yi1: yi });
      }
    }
    for (const [key, run] of active) {
      if (!nextActive.has(key)) completed.push(run);
    }
    active.clear();
    for (const [key, run] of nextActive) active.set(key, run);
    lastYi = yi;
  }
  completed.push(...active.values());
  return completed
    .map((run) => ({
      x: xs[run.xi0],
      y: ys[run.yi0],
      w: xs[run.xi1 + 1] - xs[run.xi0],
      h: ys[run.yi1 + 1] - ys[run.yi0],
    }))
    .filter((rect) => rect.w > 0.1 && rect.h > 0.1);
}

function contiguousIndexRuns(indices) {
  const sorted = [...new Set(indices)].sort((a, b) => a - b);
  const runs = [];
  let start = null;
  let previous = null;
  for (const index of sorted) {
    if (start === null) {
      start = index;
      previous = index;
      continue;
    }
    if (index === previous + 1) {
      previous = index;
      continue;
    }
    runs.push([start, previous]);
    start = index;
    previous = index;
  }
  if (start !== null) runs.push([start, previous]);
  return runs;
}
