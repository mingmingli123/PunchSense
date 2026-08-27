export function wipeTowerRect(c, {
  unionBounds,
  pointInPolygon,
  clamp,
  referenceBounds,
}) {
  const towerW = 35;
  const towerH = 12;
  const margin = 16;
  const keepout = c.polygons.length > 0 ? expandRect(unionBounds(c.polygons), 8) : null;
  const towerFootprint = (rect) => ({
    x: rect.x + referenceBounds.minX,
    y: rect.y + referenceBounds.minY,
    w: referenceBounds.maxX - referenceBounds.minX,
    h: referenceBounds.maxY - referenceBounds.minY,
  });
  const isSafe = (rect) => (
    towerFootprint(rect).x >= 0
    && towerFootprint(rect).y >= 0
    && towerFootprint(rect).x + towerFootprint(rect).w <= c.bedWidth
    && towerFootprint(rect).y + towerFootprint(rect).h <= c.bedDepth
    && !towerTouchesPrintedPolygons(towerFootprint(rect), c.polygons, pointInPolygon)
  );
  if (keepout) {
    const objectCenterY = keepout.y + keepout.h / 2;
    const objectCenterX = keepout.x + keepout.w / 2;
    const clearance = 10;
    const adjacentCandidates = [
      { x: keepout.x - margin - towerW, y: clamp(objectCenterY - towerH / 2, margin, c.bedDepth - margin - towerH), w: towerW, h: towerH },
      { x: keepout.x + keepout.w + margin, y: clamp(objectCenterY - towerH / 2, margin, c.bedDepth - margin - towerH), w: towerW, h: towerH },
      { x: clamp(objectCenterX - towerW / 2, margin, c.bedWidth - margin - towerW), y: keepout.y - clearance - towerH, w: towerW, h: towerH },
      { x: clamp(objectCenterX - towerW / 2, margin, c.bedWidth - margin - towerW), y: keepout.y + keepout.h + clearance, w: towerW, h: towerH },
    ];
    const adjacent = adjacentCandidates.find(isSafe);
    if (adjacent) return adjacent;
  }
  const candidates = [
    { x: margin, y: margin, w: towerW, h: towerH },
    { x: c.bedWidth - margin - towerW, y: margin, w: towerW, h: towerH },
    { x: margin, y: c.bedDepth - margin - towerH, w: towerW, h: towerH },
    { x: c.bedWidth - margin - towerW, y: c.bedDepth - margin - towerH, w: towerW, h: towerH },
  ];
  const safe = candidates.find(isSafe);
  if (safe) return safe;
  const scanned = scanSafeWipeTowerPosition(c, towerW, towerH, margin, isSafe, keepout, towerFootprint);
  if (scanned) return scanned;
  const bounds = keepout ?? { x: 0, y: 0, w: 0, h: 0 };
  const right = { x: Math.min(c.bedWidth - margin - towerW, bounds.x + bounds.w + margin), y: clamp(bounds.y, margin, c.bedDepth - margin - towerH), w: towerW, h: towerH };
  if (right.x >= margin && isSafe(right)) return right;
  return { x: Math.max(margin, bounds.x - margin - towerW), y: clamp(bounds.y, margin, c.bedDepth - margin - towerH), w: towerW, h: towerH };
}

export function roundedWipeTowerPath(tower, inset, radius = 1, removeDuplicatePolylinePoints) {
  const x0 = tower.x + inset;
  const y0 = tower.y + inset;
  const x1 = tower.x + tower.w - inset;
  const y1 = tower.y + tower.h - inset;
  const r = Math.max(0, Math.min(radius, (x1 - x0) / 2, (y1 - y0) / 2));
  if (r <= 0.001) {
    return [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }, { x: x0, y: y0 }];
  }
  const points = [];
  const addArc = (cx, cy, start, end) => {
    const steps = 5;
    for (let i = 0; i <= steps; i += 1) {
      const a = start + ((end - start) * i) / steps;
      points.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
    }
  };
  points.push({ x: x0 + r, y: y0 });
  points.push({ x: x1 - r, y: y0 });
  addArc(x1 - r, y0 + r, -Math.PI / 2, 0);
  points.push({ x: x1, y: y1 - r });
  addArc(x1 - r, y1 - r, 0, Math.PI / 2);
  points.push({ x: x0 + r, y: y1 });
  addArc(x0 + r, y1 - r, Math.PI / 2, Math.PI);
  points.push({ x: x0, y: y0 + r });
  addArc(x0 + r, y0 + r, Math.PI, Math.PI * 1.5);
  points.push({ x: x0 + r, y: y0 });
  return removeDuplicatePolylinePoints(points);
}

function expandRect(rect, amount) {
  return { x: rect.x - amount, y: rect.y - amount, w: rect.w + amount * 2, h: rect.h + amount * 2 };
}

function scanSafeWipeTowerPosition(c, towerW, towerH, margin, isSafe, keepout, towerFootprint) {
  const step = 4;
  const candidates = [];
  for (let y = margin; y <= c.bedDepth - margin - towerH + 0.001; y += step) {
    for (let x = margin; x <= c.bedWidth - margin - towerW + 0.001; x += step) {
      const rect = { x, y, w: towerW, h: towerH };
      if (!isSafe(rect)) continue;
      const footprint = towerFootprint(rect);
      const score = keepout ? distanceRectToRect(footprint, keepout) : 0;
      candidates.push({ rect, score });
    }
  }
  candidates.sort((a, b) => b.score - a.score || a.rect.y - b.rect.y || a.rect.x - b.rect.x);
  return candidates[0]?.rect ?? null;
}

function towerTouchesPrintedPolygons(rect, polygons, pointInPolygon) {
  if (!pointInPolygon || !Array.isArray(polygons) || polygons.length === 0) return false;
  const inset = 0.6;
  const xs = [
    rect.x + inset,
    rect.x + rect.w / 2,
    rect.x + rect.w - inset,
  ];
  const ys = [
    rect.y + inset,
    rect.y + rect.h / 2,
    rect.y + rect.h - inset,
  ];
  for (const polygon of polygons) {
    for (const x of xs) {
      for (const y of ys) {
        if (pointInPolygon({ x, y }, polygon)) return true;
      }
    }
  }
  return false;
}

function distanceRectToRect(a, b) {
  if (!a || !b) return 0;
  const dx = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w), 0);
  const dy = Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h), 0);
  return Math.hypot(dx, dy);
}
