export function createT0RasterModel(deps) {
  const {
    state,
    materialRegions,
    explicitMaterialForPoint,
    topMaterialRegionAtPoint,
    gridAxisPositions,
    normalizeMaterialLineSegments,
    pointInPolygon,
    polygonBounds,
    rectsOverlap,
    roundMaybe,
    strandOffsets,
    tpuRegionFillMode,
  } = deps;

  function rasterizedT0SolidCells(c, bounds, regions) {
    const xs = gridAxisPositions(bounds, c, "x");
    const ys = gridAxisPositions(bounds, c, "y");
    const rects = [];
    if (xs.length < 2 || ys.length < 2) return { xs, ys, rects };
    for (const cell of rasterizedT0Cells(xs, ys, regions, c).values()) {
      if (!cell.solid) continue;
      rects.push({ xi: cell.xi, yi: cell.yi, x: cell.x, y: cell.y, w: cell.w, h: cell.h });
    }
    return { xs, ys, rects };
  }

  function rasterizedT0Cells(xs, ys, regions, c) {
    const cells = new Map();
    const genericRegions = regions.filter((region) => !isSnappedRectT0Region(region));
    for (let xi = 0; xi < xs.length - 1; xi += 1) {
      const x0 = xs[xi];
      const x1 = xs[xi + 1];
      if (x1 - x0 <= 0.1) continue;
      for (let yi = 0; yi < ys.length - 1; yi += 1) {
        const y0 = ys[yi];
        const y1 = ys[yi + 1];
        if (y1 - y0 <= 0.1) continue;
        const classified = classifyT0GridCell(x0, x1, y0, y1, genericRegions, c);
        if (!classified.occupied) continue;
        cells.set(`${xi},${yi}`, {
          xi,
          yi,
          x: x0,
          y: y0,
          w: x1 - x0,
          h: y1 - y0,
          solid: classified.solid,
        });
      }
    }
    addSnappedRectT0Cells(cells, xs, ys, regions, c);
    return cells;
  }

  function isSnappedRectT0Region(region) {
    if (Number(region.material) !== 0) return false;
    if (region.source !== "shape" || region.shapeIndex === undefined) return false;
    return state.shapes[region.shapeIndex]?.type === "rect";
  }

  function addSnappedRectT0Cells(cells, xs, ys, regions, c) {
    const rectRegions = regions.filter(isSnappedRectT0Region);
    if (rectRegions.length === 0) return;
    for (const region of rectRegions) {
      const bounds = region.bounds ?? polygonBounds(region.polygon);
      const xRun = bestSnappedCellRun(xs, bounds.x, bounds.x + bounds.w);
      const yRun = bestSnappedCellRun(ys, bounds.y, bounds.y + bounds.h);
      if (!xRun || !yRun) continue;
      const solid = tpuRegionFillMode(region, c) === "solid";
      for (let xi = xRun.start; xi < xRun.start + xRun.count; xi += 1) {
        for (let yi = yRun.start; yi < yRun.start + yRun.count; yi += 1) {
          const x0 = xs[xi];
          const x1 = xs[xi + 1];
          const y0 = ys[yi];
          const y1 = ys[yi + 1];
          if (x1 - x0 <= 0.1 || y1 - y0 <= 0.1) continue;
          cells.set(`${xi},${yi}`, {
            xi,
            yi,
            x: x0,
            y: y0,
            w: x1 - x0,
            h: y1 - y0,
            solid,
          });
        }
      }
    }
  }

  function bestSnappedCellRun(axisPositions, minValue, maxValue) {
    const intervals = [];
    for (let i = 0; i < axisPositions.length - 1; i += 1) {
      const a = axisPositions[i];
      const b = axisPositions[i + 1];
      if (b - a > 0.1) intervals.push({ index: i, a, b, center: (a + b) / 2, length: b - a });
    }
    if (intervals.length === 0 || maxValue <= minValue) return null;
    const targetLength = maxValue - minValue;
    const averageLength = intervals.reduce((sum, item) => sum + item.length, 0) / intervals.length;
    const estimatedCount = targetLength / Math.max(0.001, averageLength);
    const minCount = Math.max(1, Math.floor(estimatedCount) - 1);
    const maxCount = Math.min(intervals.length, Math.ceil(estimatedCount) + 2);
    const targetCenter = (minValue + maxValue) / 2;
    let best = null;
    for (let count = minCount; count <= maxCount; count += 1) {
      for (let start = 0; start <= intervals.length - count; start += 1) {
        const run = intervals.slice(start, start + count);
        const runStart = run[0].a;
        const runEnd = run[run.length - 1].b;
        const overlap = run.reduce((sum, interval) => sum + numericOverlap(interval.a, interval.b, minValue, maxValue), 0);
        if (overlap <= 0.001) continue;
        const union = Math.max(0.001, (runEnd - runStart) + targetLength - overlap);
        const iou = overlap / union;
        const runCenter = (runStart + runEnd) / 2;
        const centerDistance = Math.abs(runCenter - targetCenter);
        if (
          !best ||
          iou > best.iou + 0.0005 ||
          (Math.abs(iou - best.iou) <= 0.0005 && overlap > best.overlap + 0.001) ||
          (Math.abs(iou - best.iou) <= 0.0005 && Math.abs(overlap - best.overlap) <= 0.001 && centerDistance < best.centerDistance)
        ) {
          best = {
            start: run[0].index,
            count,
            overlap,
            iou,
            centerDistance,
          };
        }
      }
    }
    return best;
  }

  function numericOverlap(a0, a1, b0, b1) {
    return Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
  }

  function classifyT0GridCell(x0, x1, y0, y1, regions, c) {
    const cell = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    const candidates = regions.filter((region) => rectsOverlap(cell, region.bounds ?? polygonBounds(region.polygon)));
    if (candidates.length === 0) return { occupied: false, solid: false };
    const cellArea = Math.max(0.001, (x1 - x0) * (y1 - y0));
    let t0Area = 0;
    let solidArea = 0;
    for (const region of candidates) {
      if (Number(region.material) !== 0) continue;
      const area = polygonRectIntersectionArea(region.polygon, x0, x1, y0, y1);
      if (area <= 0.0001) continue;
      t0Area += area;
      if (tpuRegionFillMode(region, c) === "solid") solidArea += area;
    }
    t0Area = Math.min(t0Area, cellArea);
    solidArea = Math.min(solidArea, t0Area);
    const coverage = t0Area / cellArea;
    const center = classifyT0Sample({ x: (x0 + x1) / 2, y: (y0 + y1) / 2 }, candidates, c);
    const threshold = center.t0 ? 0.12 : 0.22;
    if (coverage < threshold) return { occupied: false, solid: false };
    return { occupied: true, solid: solidArea >= t0Area * 0.5 };
  }

  function polygonRectIntersectionArea(polygon, x0, x1, y0, y1) {
    const clipped = clipPolygonToRect(polygon, x0, x1, y0, y1);
    if (clipped.length < 3) return 0;
    return Math.abs(polygonSignedArea(clipped));
  }

  function clipPolygonToRect(polygon, x0, x1, y0, y1) {
    return [
      (point) => point.x >= x0,
      (point) => point.x <= x1,
      (point) => point.y >= y0,
      (point) => point.y <= y1,
    ].reduce((points, inside, edgeIndex) => {
      if (points.length === 0) return points;
      return clipPolygonByRectEdge(points, inside, (a, b) => rectEdgeIntersection(a, b, edgeIndex, x0, x1, y0, y1));
    }, polygon.map((point) => ({ x: point.x, y: point.y })));
  }

  function clipPolygonByRectEdge(points, inside, intersect) {
    const output = [];
    for (let i = 0; i < points.length; i += 1) {
      const current = points[i];
      const previous = points[(i + points.length - 1) % points.length];
      const currentInside = inside(current);
      const previousInside = inside(previous);
      if (currentInside) {
        if (!previousInside) output.push(intersect(previous, current));
        output.push(current);
      } else if (previousInside) {
        output.push(intersect(previous, current));
      }
    }
    return output.filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
  }

  function rectEdgeIntersection(a, b, edgeIndex, x0, x1, y0, y1) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    if (edgeIndex === 0 || edgeIndex === 1) {
      const x = edgeIndex === 0 ? x0 : x1;
      const t = Math.abs(dx) <= 1e-9 ? 0 : (x - a.x) / dx;
      return { x, y: a.y + dy * t };
    }
    const y = edgeIndex === 2 ? y0 : y1;
    const t = Math.abs(dy) <= 1e-9 ? 0 : (y - a.y) / dy;
    return { x: a.x + dx * t, y };
  }

  function polygonSignedArea(polygon) {
    let area = 0;
    for (let i = 0; i < polygon.length; i += 1) {
      const a = polygon[i];
      const b = polygon[(i + 1) % polygon.length];
      area += a.x * b.y - b.x * a.y;
    }
    return area / 2;
  }

  function classifyT0Sample(point, regions, c) {
    const material = explicitMaterialForPoint(point, regions);
    if (material === undefined || Number(material) !== 0) return { t0: false, solid: false };
    const owner = topMaterialRegionAtPoint(point, regions);
    const solid = owner ? tpuRegionFillMode(owner, c) === "solid" : c.tpuFillMode === "solid";
    return { t0: true, solid };
  }

  function rasterizedT0GridSegments(c, bounds) {
    const cacheKey = t0RasterCacheKey(c, bounds);
    const cached = state.gridRasterCache.get(cacheKey);
    if (cached) return cloneSegmentBucket(cached);
    const regions = materialRegions(c).map((region, index) => ({
      ...region,
      order: index,
      bounds: polygonBounds(region.polygon),
    }));
    const horizontal = [];
    const vertical = [];
    if (!regions.some((region) => Number(region.material) === 0) && ![...state.regionMaterialOverrides.values()].some((material) => Number(material) === 0)) {
      return { horizontal, vertical };
    }
    const xs = gridAxisPositions(bounds, c, "x");
    const ys = gridAxisPositions(bounds, c, "y");
    if (xs.length < 2 || ys.length < 2) return { horizontal, vertical };
    for (const cell of rasterizedT0Cells(xs, ys, regions, c).values()) {
      const x0 = cell.x;
      const x1 = cell.x + cell.w;
      const y0 = cell.y;
      const y1 = cell.y + cell.h;
      horizontal.push({ y: y0, x0, x1, material: 0 });
      horizontal.push({ y: y1, x0, x1, material: 0 });
      vertical.push({ x: x0, y0, y1, material: 0 });
      vertical.push({ x: x1, y0, y1, material: 0 });
    }
    const result = {
      horizontal: normalizeMaterialLineSegments(horizontal, "horizontal"),
      vertical: normalizeMaterialLineSegments(vertical, "vertical"),
    };
    state.gridRasterCache.set(cacheKey, cloneSegmentBucket(result));
    if (state.gridRasterCache.size > 8) state.gridRasterCache.delete(state.gridRasterCache.keys().next().value);
    return result;
  }

  function t0RasterCacheKey(c, bounds) {
    return JSON.stringify({
      bounds: [bounds.x, bounds.y, bounds.w, bounds.h].map((value) => Number(value.toFixed(3))),
      rasterVersion: 3,
      pitch: Number(c.pitch.toFixed(4)),
      offsets: strandOffsets(c).map((value) => Number(value.toFixed(4))),
      shapeMode: c.shapeMode,
      path: state.path.map((point) => [roundMaybe(point.x), roundMaybe(point.y)]),
      draftShape: state.draftShape ? {
        type: state.draftShape.type,
        material: state.draftShape.material,
        x: roundMaybe(state.draftShape.x),
        y: roundMaybe(state.draftShape.y),
        w: roundMaybe(state.draftShape.w),
        h: roundMaybe(state.draftShape.h),
        r: roundMaybe(state.draftShape.r),
        rotation: roundMaybe(state.draftShape.rotation),
        points: state.draftShape.points?.map((point) => [roundMaybe(point.x), roundMaybe(point.y)]),
      } : null,
      shapes: state.shapes.map((shape) => ({
        id: shape.id,
        type: shape.type,
        material: shape.material,
        fillMode: shape.tpuFillMode,
        x: roundMaybe(shape.x),
        y: roundMaybe(shape.y),
        w: roundMaybe(shape.w),
        h: roundMaybe(shape.h),
        r: roundMaybe(shape.r),
        rotation: roundMaybe(shape.rotation),
        points: shape.points?.map((point) => [roundMaybe(point.x), roundMaybe(point.y)]),
      })),
      overrides: [...state.regionMaterialOverrides.entries()].sort(),
      defaultTpuFillMode: state.defaultTpuFillMode,
    });
  }

  function cloneSegmentBucket(bucket) {
    return {
      horizontal: bucket.horizontal.map((segment) => ({ ...segment })),
      vertical: bucket.vertical.map((segment) => ({ ...segment })),
    };
  }

  function addT0CompleteGridBoundaryEdges(bucket, c, bounds) {
    const regions = materialRegions(c).filter((region) => Number(region.material) === 0);
    if (regions.length === 0) return;
    const xs = gridAxisPositions(bounds, c, "x");
    const ys = gridAxisPositions(bounds, c, "y");
    if (xs.length < 2 || ys.length < 2) return;
    const occupied = new Set();
    for (let xi = 0; xi < xs.length - 1; xi += 1) {
      const x0 = xs[xi];
      const x1 = xs[xi + 1];
      if (x1 - x0 <= 0.1) continue;
      for (let yi = 0; yi < ys.length - 1; yi += 1) {
        const y0 = ys[yi];
        const y1 = ys[yi + 1];
        if (y1 - y0 <= 0.1) continue;
        if (t0GridCellOccupied(x0, x1, y0, y1, regions)) occupied.add(`${xi},${yi}`);
      }
    }
    if (occupied.size === 0) return;
    const hasCell = (xi, yi) => occupied.has(`${xi},${yi}`);
    for (const key of occupied) {
      const [xi, yi] = key.split(",").map(Number);
      const x0 = xs[xi];
      const x1 = xs[xi + 1];
      const y0 = ys[yi];
      const y1 = ys[yi + 1];
      if (!hasCell(xi, yi - 1)) bucket.horizontal.push({ y: y0, x0, x1, material: 0 });
      if (!hasCell(xi, yi + 1)) bucket.horizontal.push({ y: y1, x0, x1, material: 0 });
      if (!hasCell(xi - 1, yi)) bucket.vertical.push({ x: x0, y0, y1, material: 0 });
      if (!hasCell(xi + 1, yi)) bucket.vertical.push({ x: x1, y0, y1, material: 0 });
    }
  }

  function t0GridCellOccupied(x0, x1, y0, y1, regions) {
    const insetX = (x1 - x0) * 0.22;
    const insetY = (y1 - y0) * 0.22;
    const samples = [
      { x: (x0 + x1) / 2, y: (y0 + y1) / 2 },
      { x: x0 + insetX, y: y0 + insetY },
      { x: x1 - insetX, y: y0 + insetY },
      { x: x0 + insetX, y: y1 - insetY },
      { x: x1 - insetX, y: y1 - insetY },
    ];
    return regions.some((region) => samples.filter((point) => pointInPolygon(point, region.polygon)).length >= 2);
  }

  return {
    addT0CompleteGridBoundaryEdges,
    rasterizedT0GridSegments,
    rasterizedT0SolidCells,
  };
}
