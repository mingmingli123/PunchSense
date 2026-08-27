import {
  horizontalSegmentCenter,
  pathCenter,
  snakePathExportLabel,
  takeNearestItems,
  verticalSegmentCenter,
} from "./path_utils.js";

export function createMaterialSegmentWriter({
  firstLayerMaterial,
  toolForMaterial,
  materialFlow,
  distance,
  addExposedWhiteTpuReferenceFirstLayer,
  addPolyline,
  addLine,
  addT0GridLine,
  addT0SerpentinePolyline,
}) {
  function addMaterialSegmentGroup(lines, c, layerIndex, material, segments, z, printHeight) {
    if (c.exposedSnakeMode && layerIndex === 1 && toolForMaterial(material) === firstLayerMaterial) {
      addExposedWhiteTpuReferenceFirstLayer(lines, c, z);
      if (segments.paths?.length) {
        lines.push(`; Begin layer ${layerIndex} material T${material} white TPU outer frame after reference base`);
        lines.push(";TYPE:Outer wall");
        lines.push(`;WIDTH:${c.beadWidth.toFixed(3)}`);
        for (const path of segments.paths) addPolyline(lines, c, path, z, 1.0, printHeight, material);
      }
      return;
    }
    lines.push(`; Begin layer ${layerIndex} material T${material} at Z${z.toFixed(3)}`);
    lines.push(layerIndex === 1 ? ";TYPE:Bottom surface" : ";TYPE:Internal solid infill");
    lines.push(`;WIDTH:${c.beadWidth.toFixed(3)}`);
    const exposedT0 = c.exposedSnakeMode && toolForMaterial(material) === 0;
    if (toolForMaterial(material) === 0 && segments.paths?.length && !exposedT0) {
      addT0SpatiallyInterleavedGroup(lines, c, layerIndex, segments, z, printHeight);
      return;
    }
    if (!exposedT0 && segments.paths?.length) {
      lines.push(`; Begin layer ${layerIndex} material T${material} continuous boundary/path geometry`);
      for (const path of segments.paths) {
        if (toolForMaterial(material) === 0) addT0SerpentinePolyline(lines, c, path, z, 1.0, printHeight);
        else addPolyline(lines, c, path, z, 1.0, printHeight, material);
      }
    }
    if (!exposedT0 && segments.solidPaths?.length) {
      lines.push(`; Begin layer ${layerIndex} material T${material} concentric solid fill paths`);
      for (const path of segments.solidPaths) addPolyline(lines, c, path, z, 1.0, printHeight, material);
    }
    segments.horizontal.forEach((segment, i) => {
      const reverse = (layerIndex + i) % 2 === 1;
      const start = reverse ? { x: segment.x1, y: segment.y } : { x: segment.x0, y: segment.y };
      const end = reverse ? { x: segment.x0, y: segment.y } : { x: segment.x1, y: segment.y };
      if (toolForMaterial(material) === 0) addT0GridLine(lines, c, start, end, z, 1.0, printHeight, material);
      else addLine(lines, c, start, end, z, 1.0, printHeight, material);
    });

    const verticalFlow = c.exposedSnakeMode && toolForMaterial(material) === 0 ? 1.0 : 1.2;
    lines.push(`; Begin layer ${layerIndex} material T${material} vertical lines, cross flow ${materialFlow(c, material, verticalFlow).toFixed(3)}`);
    lines.push(`;WIDTH:${c.beadWidth.toFixed(3)}`);
    segments.vertical.forEach((segment, i) => {
      const reverse = (layerIndex + i) % 2 === 1;
      const start = reverse ? { x: segment.x, y: segment.y1 } : { x: segment.x, y: segment.y0 };
      const end = reverse ? { x: segment.x, y: segment.y0 } : { x: segment.x, y: segment.y1 };
      if (toolForMaterial(material) === 0) addT0GridLine(lines, c, start, end, z, verticalFlow, printHeight, material);
      else addLine(lines, c, start, end, z, verticalFlow, printHeight, material);
    });
    if (exposedT0 && segments.solidPaths?.length) {
      lines.push(`; Begin layer ${layerIndex} material T${material} exposed T0 snapped solid-cell paths`);
      for (const path of segments.solidPaths) addPolyline(lines, c, path, z, 1.0, printHeight, material);
    }
    if (exposedT0 && segments.paths?.length) {
      lines.push(`; Begin layer ${layerIndex} material T${material} exposed continuous serpentine paths`);
      for (const path of segments.paths) addT0SerpentinePolyline(lines, c, path, z, 1.0, printHeight);
    }
  }

  function addT0SpatiallyInterleavedGroup(lines, c, layerIndex, segments, z, printHeight) {
    const paths = segments.paths ?? [];
    lines.push(`; Begin layer ${layerIndex} material T0 spatially interleaved blocks and serpentine paths`);
    // T0 grid segments are already snapped/rasterized by the material pipeline.
    const remaining = {
      solidPaths: [...(segments.solidPaths ?? [])],
      horizontal: [...(segments.horizontal ?? [])],
      vertical: [...(segments.vertical ?? [])],
    };
    const anchors = paths.map((path) => path[0]).filter(Boolean);
    for (let i = 0; i < paths.length; i += 1) {
      const anchor = anchors[i] ?? paths[i][0];
      const label = snakePathExportLabel(paths[i], i);
      lines.push(`; T0_SPATIAL_GROUP ${label} local block/grid warmup`);
      const localSolid = takeNearestItemsByCenter(remaining.solidPaths, anchor, Math.max(1, Math.ceil((segments.solidPaths?.length ?? 0) / Math.max(1, paths.length))), pathCenter);
      for (const path of localSolid) addPolyline(lines, c, path, z, 1.0, printHeight, 0);
      const localHorizontal = takeNearestItemsByCenter(remaining.horizontal, anchor, Math.max(2, Math.ceil((segments.horizontal?.length ?? 0) / Math.max(1, paths.length))), horizontalSegmentCenter);
      localHorizontal.forEach((segment, segmentIndex) => {
        const reverse = (layerIndex + i + segmentIndex) % 2 === 1;
        const start = reverse ? { x: segment.x1, y: segment.y } : { x: segment.x0, y: segment.y };
        const end = reverse ? { x: segment.x0, y: segment.y } : { x: segment.x1, y: segment.y };
        addT0GridLine(lines, c, start, end, z, 1.0, printHeight, 0);
      });
      const localVertical = takeNearestItemsByCenter(remaining.vertical, anchor, Math.max(2, Math.ceil((segments.vertical?.length ?? 0) / Math.max(1, paths.length))), verticalSegmentCenter);
      localVertical.forEach((segment, segmentIndex) => {
        const reverse = (layerIndex + i + segmentIndex) % 2 === 1;
        const start = reverse ? { x: segment.x, y: segment.y1 } : { x: segment.x, y: segment.y0 };
        const end = reverse ? { x: segment.x, y: segment.y0 } : { x: segment.x, y: segment.y1 };
        addT0GridLine(lines, c, start, end, z, 1.2, printHeight, 0);
      });
      lines.push(`; T0_SPATIAL_GROUP ${label} continuous serpentine`);
      addT0SerpentinePolyline(lines, c, paths[i], z, 1.0, printHeight);
    }
    if (remaining.solidPaths.length || remaining.horizontal.length || remaining.vertical.length) {
      lines.push(`; T0_SPATIAL_GROUP remaining block/grid geometry`);
      for (const path of remaining.solidPaths) addPolyline(lines, c, path, z, 1.0, printHeight, 0);
      remaining.horizontal.forEach((segment, i) => {
        const reverse = (layerIndex + i) % 2 === 1;
        const start = reverse ? { x: segment.x1, y: segment.y } : { x: segment.x0, y: segment.y };
        const end = reverse ? { x: segment.x0, y: segment.y } : { x: segment.x1, y: segment.y };
        addT0GridLine(lines, c, start, end, z, 1.0, printHeight, 0);
      });
      remaining.vertical.forEach((segment, i) => {
        const reverse = (layerIndex + i) % 2 === 1;
        const start = reverse ? { x: segment.x, y: segment.y1 } : { x: segment.x, y: segment.y0 };
        const end = reverse ? { x: segment.x, y: segment.y0 } : { x: segment.x, y: segment.y1 };
        addT0GridLine(lines, c, start, end, z, 1.2, printHeight, 0);
      });
    }
  }

  function takeNearestItemsByCenter(items, anchor, count, centerFn) {
    return takeNearestItems(items, anchor, count, centerFn, distance);
  }

  return { addMaterialSegmentGroup };
}
