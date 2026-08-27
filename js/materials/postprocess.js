import { plaSolidBasePaths as buildPlaSolidBasePaths } from "./base_fill.js?v=auto-workflow-pin-endpoint-final-v1-20260827";
import { createMaterialExclusivityPostprocess } from "./exclusivity.js?v=auto-workflow-pin-endpoint-final-v1-20260827";
import { createFrameOverlapPostprocess } from "./frame_overlap.js?v=auto-workflow-pin-endpoint-final-v1-20260827";
import { createWhiteTpuOuterFramePostprocess } from "./outer_frame.js?v=auto-workflow-pin-endpoint-final-v1-20260827";
import {
  pathBoundsRect,
  rectsOverlap,
  subtractCellRectsFromSegments,
  subtractOverlappingLineSegments,
  subtractPathHorizontalCrossingsFromVerticalSegments,
  subtractPathVerticalCrossingsFromHorizontalSegments,
  subtractSameLineSegments,
} from "./segment_ops.js?v=auto-workflow-pin-endpoint-final-v1-20260827";
import { solidCellConcentricFillPaths } from "./solid_fill.js";
import { createT0RasterModel } from "./t0_raster.js?v=auto-workflow-pin-endpoint-final-v1-20260827";

export function createMaterialPostprocess(deps) {
  const {
    state,
    firstLayerMaterial,
    frameMaterial,
    materialRegions,
    explicitMaterialForPoint,
    topMaterialRegionAtPoint,
    materialSegmentBucket,
    mergeAllMaterialBuckets,
    tpuPathDeps,
    visibleUnionEdgePaths,
    offsetFramePath,
    toolForMaterial,
    layerPrintsT0Block,
    subtractSnakeHorizontalFromSegments,
    subtractSnakeVerticalFromSegments,
    gridAxisPositions,
    pointInAnyPolygon,
    samePoint,
    removeDuplicateClosingPoint,
    polygonArea,
    polygonBounds,
    unionBounds,
    polygonCentroid,
    pointInPolygon,
    clamp,
    trimHorizontalSegmentToGridWithRemoved,
    trimVerticalSegmentToGridWithRemoved,
    normalizeMaterialLineSegments,
    mergeNumericIntervals,
    removedSpansBetweenKept,
    strandOffsets,
    roundMaybe,
    boundaryOverlapWinner,
  } = deps;

  const FIRST_LAYER_MATERIAL = firstLayerMaterial;
  const {
    addWhiteTpuOuterFrameToSegments,
    whiteTpuOuterFramePaths,
  } = createWhiteTpuOuterFramePostprocess({
    firstLayerMaterial: FIRST_LAYER_MATERIAL,
    materialRegions,
    materialSegmentBucket,
    mergeAllMaterialBuckets,
    tpuPathDeps,
    visibleUnionEdgePaths,
    offsetFramePath,
    toolForMaterial,
    gridAxisPositions,
    pointInAnyPolygon,
    samePoint,
    removeDuplicateClosingPoint,
    polygonArea,
    unionBounds,
  });
  const {
    extendMaterialSegmentsIntoFrame,
    extendSegmentIntoFrame,
    frameGridOverlapWidth,
  } = createFrameOverlapPostprocess({
    clamp,
    pointInAnyPolygon,
  });
  const {
    addT0CompleteGridBoundaryEdges,
    rasterizedT0GridSegments,
    rasterizedT0SolidCells,
  } = createT0RasterModel({
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
  });
  const {
    enforceFinalMaterialExclusivity,
    subtractT0GridFromNonT0Materials,
  } = createMaterialExclusivityPostprocess({
    mergeAllMaterialBuckets,
    tpuPathDeps,
    subtractSnakeHorizontalFromSegments,
    subtractSnakeVerticalFromSegments,
    pathBoundsRect,
    subtractCellRectsFromSegments,
    subtractOverlappingLineSegments,
    subtractPathHorizontalCrossingsFromVerticalSegments,
    subtractPathVerticalCrossingsFromHorizontalSegments,
    mergeNumericIntervals,
  });

  function applyTpuSolidFillMode(result, c, layerIndex) {
    if ((c.printMode !== "wrapped" && layerIndex <= c.bottomLayerCount) || !layerPrintsT0Block(c, layerIndex)) return;
    const regions = materialRegions(c).map((region, index) => ({
      ...region,
      area: polygonArea(region.polygon),
      order: index,
      bounds: polygonBounds(region.polygon),
    }));
    if (regions.length === 0) return;
    const solidRegions = regions.filter((region) => Number(region.material) === 0 && tpuRegionFillMode(region, c) === "solid");
    if (solidRegions.length === 0) return;
    const bucket = materialSegmentBucket(result, 0);
    const bounds = unionBounds(regions.map((region) => region.polygon));
    const solidCells = rasterizedT0SolidCells(c, bounds, regions);
    if (solidCells.rects.length === 0) return;
    bucket.horizontal = subtractCellRectsFromSegments(bucket.horizontal, "horizontal", solidCells.rects, c, mergeNumericIntervals);
    bucket.vertical = subtractCellRectsFromSegments(bucket.vertical, "vertical", solidCells.rects, c, mergeNumericIntervals);
    for (const [material, materialBucket] of result) {
      if (Number(material) === 0) continue;
      materialBucket.horizontal = subtractCellRectsFromSegments(materialBucket.horizontal, "horizontal", solidCells.rects, c, mergeNumericIntervals);
      materialBucket.vertical = subtractCellRectsFromSegments(materialBucket.vertical, "vertical", solidCells.rects, c, mergeNumericIntervals);
    }
    bucket.solidPaths = [
      ...(bucket.solidPaths ?? []),
      ...solidCellConcentricFillPaths(solidCells, c),
    ];
  }

  function plaSolidBasePaths(c) {
    return buildPlaSolidBasePaths(c, {
      frameMaterial,
      offsetFramePath,
      pointInPolygon,
      polygonArea,
      polygonBounds,
      polygonCentroid,
      removeDuplicateClosingPoint,
    });
  }

  function tpuRegionFillMode(region, c) {
    if (region.source === "shape" && region.shapeIndex !== undefined) {
      return state.shapes[region.shapeIndex]?.tpuFillMode ?? c.tpuFillMode;
    }
    return region.fillMode ?? c.tpuFillMode;
  }

  function shrinkTpuMaterialToCompleteGrid(result, c, bounds, layerIndex = 1) {
    const bucket = result.get(0);
    if (!bucket) return;
    const fillMaterial = toolForMaterial(c.tpuSnakeRemainderMaterial ?? FIRST_LAYER_MATERIAL);
    const fillBucket = materialSegmentBucket(result, fillMaterial);
    const originalHorizontal = bucket.horizontal.map((segment) => ({ ...segment }));
    const originalVertical = bucket.vertical.map((segment) => ({ ...segment }));
    const xs = gridAxisPositions(bounds, c, "x");
    const ys = gridAxisPositions(bounds, c, "y");
    const nextHorizontal = [];
    for (const segment of bucket.horizontal) {
      const { kept, removed } = trimHorizontalSegmentToGridWithRemoved(segment, xs, fillMaterial, c);
      nextHorizontal.push(...kept);
      fillBucket.horizontal.push(...removed);
    }
    const nextVertical = [];
    for (const segment of bucket.vertical) {
      const { kept, removed } = trimVerticalSegmentToGridWithRemoved(segment, ys, fillMaterial, c);
      nextVertical.push(...kept);
      fillBucket.vertical.push(...removed);
    }
    bucket.horizontal = nextHorizontal;
    bucket.vertical = nextVertical;
    const rasterized = rasterizedT0GridSegments(c, bounds);
    if (rasterized.horizontal.length || rasterized.vertical.length) {
      bucket.horizontal = rasterized.horizontal;
      bucket.vertical = rasterized.vertical;
      fillBucket.horizontal.push(...subtractSameLineSegments(originalHorizontal, bucket.horizontal, "horizontal", fillMaterial, mergeNumericIntervals, removedSpansBetweenKept));
      fillBucket.vertical.push(...subtractSameLineSegments(originalVertical, bucket.vertical, "vertical", fillMaterial, mergeNumericIntervals, removedSpansBetweenKept));
    } else {
      addT0CompleteGridBoundaryEdges(bucket, c, bounds);
    }
    bucket.horizontal = normalizeMaterialLineSegments(bucket.horizontal, "horizontal");
    bucket.vertical = normalizeMaterialLineSegments(bucket.vertical, "vertical");
    applyT0MaterialBoundaryInterlock(result, c, layerIndex);
    subtractT0GridFromNonT0Materials(result, c);
    bucket.horizontal = normalizeMaterialLineSegments(bucket.horizontal, "horizontal");
    bucket.vertical = normalizeMaterialLineSegments(bucket.vertical, "vertical");
    fillBucket.horizontal = normalizeMaterialLineSegments(fillBucket.horizontal, "horizontal");
    fillBucket.vertical = normalizeMaterialLineSegments(fillBucket.vertical, "vertical");
  }

  function applyT0MaterialBoundaryInterlock(result, c, layerIndex) {
    const amount = Math.max(0, Number(c.materialOverlapWidth ?? 0));
    if (amount <= 0) return;
    const t0Bucket = result.get(0);
    if (!t0Bucket) return;
    const maxBite = Math.max(0, Number(c.pitch ?? 0) * 0.45);
    const bite = Math.min(amount, maxBite);
    if (bite <= 0.05) return;
    for (const [material, bucket] of result) {
      if (Number(material) === 0 || Number(material) < 0) continue;
      applyBoundaryLineInterlock(t0Bucket.horizontal, bucket.horizontal, "horizontal", 0, Number(material), layerIndex, bite);
      applyBoundaryLineInterlock(t0Bucket.vertical, bucket.vertical, "vertical", 0, Number(material), layerIndex, bite);
      bucket.horizontal = normalizeMaterialLineSegments(bucket.horizontal, "horizontal");
      bucket.vertical = normalizeMaterialLineSegments(bucket.vertical, "vertical");
    }
  }

  function applyBoundaryLineInterlock(aSegments, bSegments, direction, materialA, materialB, layerIndex, bite) {
    for (const a of aSegments) {
      for (const b of bSegments) {
        const relation = adjacentSameLineRelation(a, b, direction);
        if (!relation) continue;
        const winner = boundaryOverlapWinner(materialA, materialB, layerIndex);
        const aWins = winner === Number(materialA);
        if (direction === "horizontal") {
          if (relation === "a-before-b") {
            a.x1 += aWins ? bite : -bite;
            b.x0 += aWins ? bite : -bite;
          } else {
            b.x1 += aWins ? -bite : bite;
            a.x0 += aWins ? -bite : bite;
          }
        } else if (relation === "a-before-b") {
          a.y1 += aWins ? bite : -bite;
          b.y0 += aWins ? bite : -bite;
        } else {
          b.y1 += aWins ? -bite : bite;
          a.y0 += aWins ? -bite : bite;
        }
      }
    }
  }

  function adjacentSameLineRelation(a, b, direction) {
    const eps = 0.01;
    if (direction === "horizontal") {
      if (Math.abs(a.y - b.y) > eps) return null;
      if (Math.abs(a.x1 - b.x0) <= eps) return "a-before-b";
      if (Math.abs(b.x1 - a.x0) <= eps) return "b-before-a";
    } else {
      if (Math.abs(a.x - b.x) > eps) return null;
      if (Math.abs(a.y1 - b.y0) <= eps) return "a-before-b";
      if (Math.abs(b.y1 - a.y0) <= eps) return "b-before-a";
    }
    return null;
  }

  return {
    addWhiteTpuOuterFrameToSegments,
    whiteTpuOuterFramePaths,
    applyTpuSolidFillMode,
    enforceFinalMaterialExclusivity,
    extendMaterialSegmentsIntoFrame,
    extendSegmentIntoFrame,
    frameGridOverlapWidth,
    shrinkTpuMaterialToCompleteGrid,
    rasterizedT0GridSegments,
    plaSolidBasePaths,
  };
}
