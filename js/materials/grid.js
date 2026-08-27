import {
  polygonArea,
  pointInPolygon,
  unionBounds,
} from "../core/geometry.js";
import {
  boundedScanValue,
  gridAxisPositions,
  gridLinePositions,
  materialSegmentBucket,
  segmentsAt,
} from "../grid_segments.js";
import {
  cloneMaterialSegmentsMap as cloneMaterialSegmentsMapWithDeps,
  materialGridSegmentsCacheKey as buildMaterialGridSegmentsCacheKey,
  roundMaybe,
} from "./grid_cache.js?v=auto-workflow-pin-endpoint-final-v1-20260827";

export { roundMaybe } from "./grid_cache.js?v=auto-workflow-pin-endpoint-final-v1-20260827";

export function createMaterialGridModel(deps) {
  const {
    state,
    firstLayerMaterial,
    applyTpuSnakeToMaterialSegments,
    tpuPathDeps,
    applyTpuSolidFillMode,
    enforceFinalMaterialExclusivity,
    addWhiteTpuOuterFrameToSegments,
    extendMaterialSegmentsIntoFrame,
    generatedLayerCount,
    tpuSnakeTopLayer,
    t0BlockTopLayer,
    layerPrintsT0Block,
    materialRegions,
    effectiveMaterialForPoint,
    explicitMaterialForPoint,
    rasterizedT0GridSegments,
    mergeAllMaterialBuckets,
    shrinkTpuMaterialToCompleteGrid,
    cloneSnakePath,
    addPcbPinContactGridSegments,
    addAlignedPcbCutoutFramePaths,
  } = deps;

  function gridHorizontalSegmentsUnion(c) {
    const bounds = unionBounds(c.polygons);
    const segments = [];
    for (const line of gridLinePositions(bounds.y, bounds.y + bounds.h, c)) {
      segments.push(...segmentsAt(c.polygons, boundedScanValue(line, bounds.y, bounds.y + bounds.h), "horizontal", line));
    }
    return segments;
  }

  function gridVerticalSegmentsUnion(c) {
    const bounds = unionBounds(c.polygons);
    const segments = [];
    for (const line of gridLinePositions(bounds.x, bounds.x + bounds.w, c)) {
      segments.push(...segmentsAt(c.polygons, boundedScanValue(line, bounds.x, bounds.x + bounds.w), "vertical", line));
    }
    return segments;
  }

  function materialGridSegments(c, layerIndex = 1) {
    const cacheKey = materialGridSegmentsCacheKey(c, layerIndex);
    const cached = state.materialGridCache.get(cacheKey);
    if (cached) return cloneMaterialSegmentsMap(cached);
    if (isPcbPinExtraLayer(c, layerIndex)) {
      const pinOnlyResult = new Map();
      addPcbPinContactGridSegments?.(pinOnlyResult, c, layerIndex);
      mergeAllMaterialBuckets(pinOnlyResult, tpuPathDeps());
      state.materialGridCache.set(cacheKey, cloneMaterialSegmentsMap(pinOnlyResult));
      if (state.materialGridCache.size > 16) state.materialGridCache.delete(state.materialGridCache.keys().next().value);
      return cloneMaterialSegmentsMap(pinOnlyResult);
    }
    const result = baseMaterialGridSegments(c, layerIndex);
    const withSnake = applyTpuSnakeToMaterialSegments(result, c, layerIndex, tpuPathDeps());
    applyTpuSolidFillMode(withSnake, c, layerIndex);
    enforceFinalMaterialExclusivity(withSnake, c);
    addWhiteTpuOuterFrameToSegments(withSnake, c);
    addAlignedPcbCutoutFramePaths?.(withSnake, c, layerIndex);
    const finalResult = extendMaterialSegmentsIntoFrame(withSnake, c);
    clipGridSegmentsToVoidMasks(finalResult, materialRegions(c));
    enforceFinalMaterialExclusivity(finalResult, c);
    mergeAllMaterialBuckets(finalResult, tpuPathDeps());
    state.materialGridCache.set(cacheKey, cloneMaterialSegmentsMap(finalResult));
    if (state.materialGridCache.size > 16) state.materialGridCache.delete(state.materialGridCache.keys().next().value);
    return finalResult;
  }

  function materialGridSegmentsCacheKey(c, layerIndex) {
    return buildMaterialGridSegmentsCacheKey(c, layerIndex, state);
  }

  function cloneMaterialSegmentsMap(map) {
    return cloneMaterialSegmentsMapWithDeps(map, cloneSnakePath);
  }

  function baseMaterialGridSegments(c, layerIndex = 1) {
    const result = new Map();
    if (c.exposedSnakeMode) {
      if (layerIndex <= c.bottomLayerCount) {
        const bucket = materialSegmentBucket(result, firstLayerMaterial);
        bucket.solidPaths.push(...deps.plaSolidBasePaths(c));
        return result;
      }
      if (layerIndex > generatedLayerCount(c)) return result;
      if (layerIndex > Math.max(tpuSnakeTopLayer(c), t0BlockTopLayer(c))) return result;
      if (!layerPrintsT0Block(c, layerIndex) && layerIndex > tpuSnakeTopLayer(c)) return result;
      const allRegions = materialRegions(c);
      const t0Regions = allRegions.filter((region) => Number(region.material) === 0);
      if (t0Regions.length === 0) return result;
      const bounds = unionBounds(allRegions.map((region) => region.polygon));
      const bucket = materialSegmentBucket(result, 0);
      if (layerPrintsT0Block(c, layerIndex)) {
        const rasterized = rasterizedT0GridSegments(c, bounds);
        bucket.horizontal.push(...rasterized.horizontal);
        bucket.vertical.push(...rasterized.vertical);
        addPcbPinContactGridSegments?.(result, c, layerIndex);
      }
      mergeAllMaterialBuckets(result, tpuPathDeps());
      return result;
    }
    if (layerIndex === 1 || (layerIndex <= c.bottomLayerCount && c.printMode !== "wrapped")) {
      addCellGridSegmentsFromMaterialRegions(result, c, layerIndex, { forceMaterial: firstLayerMaterial });
      mergeAllMaterialBuckets(result, tpuPathDeps());
      return result;
    }
    const regions = materialRegions(c).map((region, index) => ({
      ...region,
      area: polygonArea(region.polygon),
      order: index,
    }));
    if (regions.length === 0) return result;
    const bounds = unionBounds(regions.map((region) => region.polygon));

    addCellGridSegmentsFromPreparedRegions(result, c, layerIndex, regions, bounds);
    shrinkTpuMaterialToCompleteGrid(result, c, bounds, layerIndex);
    if (layerPrintsT0Block(c, layerIndex)) addPcbPinContactGridSegments?.(result, c, layerIndex);
    return result;
  }

  function isPcbPinExtraLayer(c, layerIndex) {
    return Boolean(c.pcbPinContactsEnabled)
      && Boolean(c.hasPcbPinContactShapes)
      && Number(layerIndex) > Number(c.baseLayerCount ?? 1)
      && Number(layerIndex) <= generatedLayerCount(c);
  }

  function addCellGridSegmentsFromMaterialRegions(result, c, layerIndex, options = {}) {
    const regions = materialRegions(c).map((region, index) => ({
      ...region,
      area: polygonArea(region.polygon),
      order: index,
    }));
    if (regions.length === 0) {
      const bucket = materialSegmentBucket(result, options.forceMaterial ?? firstLayerMaterial);
      bucket.horizontal.push(...gridHorizontalSegmentsUnion(c).map((segment) => ({ ...segment, material: firstLayerMaterial })));
      bucket.vertical.push(...gridVerticalSegmentsUnion(c).map((segment) => ({ ...segment, material: firstLayerMaterial })));
      return;
    }
    const bounds = unionBounds(regions.map((region) => region.polygon));
    addCellGridSegmentsFromPreparedRegions(result, c, layerIndex, regions, bounds, options);
  }

  function addCellGridSegmentsFromPreparedRegions(result, c, layerIndex, regions, bounds, options = {}) {
    const xs = gridAxisPositions(bounds, c, "x");
    const ys = gridAxisPositions(bounds, c, "y");
    if (xs.length < 2 || ys.length < 2) return;
    const resolveMaterial = explicitEffectiveMaterialForPoint(c, layerIndex);
    const forcedMaterial = options.forceMaterial === undefined ? null : Number(options.forceMaterial);
    const voidRegions = regions.filter((region) => Number(region.material) < 0 && region.polygon?.length >= 3);
    const pcbPinRegions = regions.filter((region) => region.source === "pcb-pin-contact" && Number(region.material) >= 0 && region.polygon?.length >= 3);
    const cells = [];
    for (let xi = 0; xi < xs.length - 1; xi += 1) {
      const x0 = xs[xi];
      const x1 = xs[xi + 1];
      cells[xi] = [];
      if (x1 - x0 <= 0.1) continue;
      for (let yi = 0; yi < ys.length - 1; yi += 1) {
        const y0 = ys[yi];
        const y1 = ys[yi + 1];
        if (y1 - y0 <= 0.1) continue;
        const material = layerCellMaterial(x0, x1, y0, y1, regions, resolveMaterial, forcedMaterial, c, layerIndex, voidRegions, pcbPinRegions);
        if (material === null) continue;
        cells[xi][yi] = material;
      }
    }
    emitLongGridSegmentsFromCells(result, cells, xs, ys, options);
  }

  function layerCellMaterial(x0, x1, y0, y1, regions, resolveMaterial, forcedMaterial, c, layerIndex, voidRegions = [], pcbPinRegions = []) {
    if (cellIntersectsVoidRegion(x0, x1, y0, y1, voidRegions) && !cellIntersectsPcbPinRegion(x0, x1, y0, y1, pcbPinRegions)) return null;
    const classified = classifiedCellMaterial(x0, x1, y0, y1, regions, resolveMaterial);
    if (classified === null || Number(classified) < 0) return null;
    if (forcedMaterial !== null) return forcedMaterial;
    if (Number(classified) === 0 && !layerPrintsT0Block(c, layerIndex)) return null;
    return Number(classified);
  }

  function cellIntersectsVoidRegion(x0, x1, y0, y1, voidRegions) {
    if (voidRegions.length === 0) return false;
    const insetX = (x1 - x0) * 0.18;
    const insetY = (y1 - y0) * 0.18;
    const samples = [
      { x: (x0 + x1) / 2, y: (y0 + y1) / 2 },
      { x: x0 + insetX, y: y0 + insetY },
      { x: x1 - insetX, y: y0 + insetY },
      { x: x0 + insetX, y: y1 - insetY },
      { x: x1 - insetX, y: y1 - insetY },
    ];
    return voidRegions.some((region) => samples.some((sample) => pointInPolygon(sample, region.polygon)));
  }

  function cellIntersectsPcbPinRegion(x0, x1, y0, y1, pcbPinRegions) {
    if (pcbPinRegions.length === 0) return false;
    const insetX = (x1 - x0) * 0.18;
    const insetY = (y1 - y0) * 0.18;
    const samples = [
      { x: (x0 + x1) / 2, y: (y0 + y1) / 2 },
      { x: x0 + insetX, y: y0 + insetY },
      { x: x1 - insetX, y: y0 + insetY },
      { x: x0 + insetX, y: y1 - insetY },
      { x: x1 - insetX, y: y1 - insetY },
    ];
    return pcbPinRegions.some((region) => samples.some((sample) => pointInPolygon(sample, region.polygon)));
  }

  function emitLongGridSegmentsFromCells(result, cells, xs, ys, options = {}) {
    for (let yi = 0; yi < ys.length; yi += 1) {
      const runsByMaterial = new Map();
      for (let xi = 0; xi < xs.length - 1; xi += 1) {
        if (xs[xi + 1] - xs[xi] <= 0.1) continue;
        for (const material of printableEdgeMaterials(cells[xi]?.[yi - 1], cells[xi]?.[yi], options)) {
          appendLineRun(runsByMaterial, material, xs[xi], xs[xi + 1]);
        }
      }
      for (const [material, runs] of runsByMaterial) {
        const bucket = materialSegmentBucket(result, material);
        for (const [x0, x1] of runs) bucket.horizontal.push({ y: ys[yi], x0, x1, material });
      }
    }

    for (let xi = 0; xi < xs.length; xi += 1) {
      const runsByMaterial = new Map();
      for (let yi = 0; yi < ys.length - 1; yi += 1) {
        if (ys[yi + 1] - ys[yi] <= 0.1) continue;
        for (const material of printableEdgeMaterials(cells[xi - 1]?.[yi], cells[xi]?.[yi], options)) {
          appendLineRun(runsByMaterial, material, ys[yi], ys[yi + 1]);
        }
      }
      for (const [material, runs] of runsByMaterial) {
        const bucket = materialSegmentBucket(result, material);
        for (const [y0, y1] of runs) bucket.vertical.push({ x: xs[xi], y0, y1, material });
      }
    }
  }

  function printableEdgeMaterials(a, b, options = {}) {
    const materials = [];
    addPrintableEdgeMaterial(materials, a, options);
    addPrintableEdgeMaterial(materials, b, options);
    return materials;
  }

  function addPrintableEdgeMaterial(materials, material, options = {}) {
    if (material === undefined || material === null || Number(material) < 0) return;
    const outputMaterial = options.forceMaterial ?? Number(material);
    if (!materials.includes(outputMaterial)) materials.push(outputMaterial);
  }

  function appendLineRun(runsByMaterial, material, start, end) {
    if (!runsByMaterial.has(material)) runsByMaterial.set(material, []);
    const runs = runsByMaterial.get(material);
    const last = runs[runs.length - 1];
    if (last && Math.abs(last[1] - start) <= 0.001) last[1] = end;
    else runs.push([start, end]);
  }

  function clipGridSegmentsToVoidMasks(result, regions) {
    const voidRegions = regions.filter((region) => Number(region.material) < 0 && region.polygon?.length >= 3);
    if (voidRegions.length === 0) return;
    const keepRegions = regions.filter((region) => region.source === "pcb-pin-contact" && Number(region.material) >= 0 && region.polygon?.length >= 3);
    for (const bucket of result.values()) {
      bucket.horizontal = clipAxisSegmentsToVoidMasks(bucket.horizontal ?? [], "horizontal", voidRegions, keepRegions);
      bucket.vertical = clipAxisSegmentsToVoidMasks(bucket.vertical ?? [], "vertical", voidRegions, keepRegions);
    }
  }

  function clipAxisSegmentsToVoidMasks(segments, direction, voidRegions, keepRegions) {
    const clipped = [];
    for (const segment of segments) {
      if (segment.source === "pcb-pin-contact") {
        clipped.push(segment);
        continue;
      }
      const coord = direction === "horizontal" ? segment.y : segment.x;
      const start = direction === "horizontal" ? Math.min(segment.x0, segment.x1) : Math.min(segment.y0, segment.y1);
      const end = direction === "horizontal" ? Math.max(segment.x0, segment.x1) : Math.max(segment.y0, segment.y1);
      if (end - start <= 0.1) continue;
      const voidSpans = scanlineInsideSpansForRegions(voidRegions, direction, coord, start, end);
      if (voidSpans.length === 0) {
        clipped.push(segment);
        continue;
      }
      const keepSpans = scanlineInsideSpansForRegions(keepRegions, direction, coord, start, end);
      const cutSpans = subtractIntervals(voidSpans, keepSpans);
      const keptSpans = subtractIntervals([[start, end]], cutSpans);
      for (const [keptStart, keptEnd] of keptSpans) {
        if (keptEnd - keptStart <= 0.1) continue;
        clipped.push(direction === "horizontal"
          ? { ...segment, x0: keptStart, x1: keptEnd }
          : { ...segment, y0: keptStart, y1: keptEnd });
      }
    }
    return clipped;
  }

  function scanlineInsideSpansForRegions(regions, direction, coord, start, end) {
    const spans = [];
    for (const region of regions) {
      const hits = polygonScanlineIntersections(region.polygon, coord, direction)
        .filter((value) => value > start + 0.001 && value < end - 0.001)
        .sort((a, b) => a - b);
      const clippedHits = [start, ...hits, end];
      for (let i = 0; i < clippedHits.length - 1; i += 1) {
        const a = clippedHits[i];
        const b = clippedHits[i + 1];
        if (b - a <= 0.1) continue;
        const mid = (a + b) / 2;
        const point = direction === "horizontal" ? { x: mid, y: coord } : { x: coord, y: mid };
        if (pointInPolygon(point, region.polygon)) spans.push([a, b]);
      }
    }
    return mergeIntervals(spans);
  }

  function polygonScanlineIntersections(polygon, value, direction) {
    const hits = [];
    for (let i = 0; i < polygon.length; i += 1) {
      const a = polygon[i];
      const b = polygon[(i + 1) % polygon.length];
      const av = direction === "horizontal" ? a.y : a.x;
      const bv = direction === "horizontal" ? b.y : b.x;
      if ((av > value) === (bv > value)) continue;
      const t = (value - av) / (bv - av);
      const hit = direction === "horizontal"
        ? a.x + (b.x - a.x) * t
        : a.y + (b.y - a.y) * t;
      if (Number.isFinite(hit)) hits.push(hit);
    }
    return hits;
  }

  function subtractIntervals(intervals, removals) {
    let parts = mergeIntervals(intervals);
    for (const [cutStart, cutEnd] of mergeIntervals(removals)) {
      const next = [];
      for (const [start, end] of parts) {
        if (cutEnd <= start + 0.001 || cutStart >= end - 0.001) {
          next.push([start, end]);
          continue;
        }
        if (cutStart > start + 0.001) next.push([start, Math.min(cutStart, end)]);
        if (cutEnd < end - 0.001) next.push([Math.max(cutEnd, start), end]);
      }
      parts = next;
      if (parts.length === 0) break;
    }
    return parts;
  }

  function mergeIntervals(intervals) {
    if (!intervals.length) return [];
    const sorted = intervals
      .map(([a, b]) => [Math.min(a, b), Math.max(a, b)])
      .filter(([a, b]) => b - a > 0.001)
      .sort((a, b) => a[0] - b[0]);
    if (sorted.length === 0) return [];
    const merged = [sorted[0]];
    for (const interval of sorted.slice(1)) {
      const last = merged[merged.length - 1];
      if (interval[0] <= last[1] + 0.001) last[1] = Math.max(last[1], interval[1]);
      else merged.push(interval);
    }
    return merged;
  }

  function classifiedCellMaterial(x0, x1, y0, y1, regions, resolveMaterial) {
    const insetX = (x1 - x0) * 0.22;
    const insetY = (y1 - y0) * 0.22;
    const samples = [
      { x: (x0 + x1) / 2, y: (y0 + y1) / 2 },
      { x: x0 + insetX, y: y0 + insetY },
      { x: x1 - insetX, y: y0 + insetY },
      { x: x0 + insetX, y: y1 - insetY },
      { x: x1 - insetX, y: y1 - insetY },
    ];
    const counts = new Map();
    for (const sample of samples) {
      const material = resolveMaterial(sample, regions);
      if (material === undefined || material === null) continue;
      const key = Number(material);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    let best = null;
    for (const [material, count] of counts) {
      if (!best || count > best.count || (count === best.count && material > best.material)) {
        best = { material, count };
      }
    }
    return best && best.count >= 2 ? best.material : null;
  }

  function explicitEffectiveMaterialForPoint(c, layerIndex) {
    return (point, regions) => {
      const material = explicitMaterialForPoint(point, regions);
      if (material === undefined || material === null) return undefined;
      if (c.printMode === "wrapped" && Number(material) === 0 && !layerPrintsT0Block(c, layerIndex)) {
        return Number(c.tpuSnakeRemainderMaterial ?? firstLayerMaterial);
      }
      return material;
    };
  }

  return {
    baseMaterialGridSegments,
    cloneMaterialSegmentsMap,
    gridHorizontalSegmentsUnion,
    gridVerticalSegmentsUnion,
    materialGridSegments,
    materialGridSegmentsCacheKey,
  };
}
