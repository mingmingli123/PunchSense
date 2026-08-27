export function materialGridSegmentsCacheKey(c, layerIndex, state) {
  return JSON.stringify({
    algorithm: "auto-workflow-endpoints-v7",
    layerIndex,
    bed: [c.bedWidth, c.bedDepth].map(roundMaybe),
    grid: [c.epi, c.pitch, c.beadWidth, c.gridLineCount, c.gridLineWidth, c.frameLoops, c.frameSpacing, c.materialOverlapWidth].map(roundMaybe),
    pcbPinContacts: [c.pcbPinContactsEnabled, c.pcbPinContactEpi, c.pcbPinContactWidth, c.pcbPinExtraLayerCount, c.hasPcbPinContactShapes].map(roundMaybe),
    printMode: c.printMode,
    bottomLayerCount: c.bottomLayerCount,
    snake: {
      enabled: c.tpuSnakeEnabled,
      layerCount: c.tpuSnakeLayerCount,
      t0BlockLayerCount: c.t0BlockLayerCount,
      remainderMaterial: c.tpuSnakeRemainderMaterial,
      order: c.tpuSnakeMaterialOrder,
      cornerRelief: c.tpuSnakeCornerRelief,
      allowCrossings: c.tpuSnakeAllowCrossings,
      normalLead: roundMaybe(c.tpuSnakeNormalLeadLength),
      connections: state.tpuSnake.connections.map((connection) => ({
        id: connection.id,
        targetLength: roundMaybe(connection.targetLength),
        normalLeadLength: roundMaybe(connection.normalLeadLength),
        endpoints: (connection.endpoints ?? []).map((point) => ({
          x: roundMaybe(point.x),
          y: roundMaybe(point.y),
          nx: roundMaybe(point.normal?.x),
          ny: roundMaybe(point.normal?.y),
          bx: roundMaybe(point.boundaryPoint?.x),
          by: roundMaybe(point.boundaryPoint?.y),
          source: point.source ?? null,
          pcbShapeId: point.pcbShapeId ?? null,
          pinId: point.pinId ?? null,
        })),
        guidePoints: (connection.guidePoints ?? []).map((point) => [roundMaybe(point.x), roundMaybe(point.y)]),
      })),
    },
    shapeMode: c.shapeMode,
    frame: Object.fromEntries(Object.entries(c.frame ?? {}).map(([key, value]) => [key, roundMaybe(value)])),
    path: state.path.map((point) => [roundMaybe(point.x), roundMaybe(point.y)]),
    draftShape: state.draftShape ? shapeCacheKey(state.draftShape) : null,
    shapes: state.shapes.map(shapeCacheKey),
    overrides: [...state.regionMaterialOverrides.entries()].sort(),
    defaultTpuFillMode: state.defaultTpuFillMode,
  });
}

export function shapeCacheKey(shape) {
  return {
    id: shape.id,
    importGroupId: shape.importGroupId,
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
  };
}

export function cloneMaterialSegmentsMap(map, cloneSnakePath) {
  const cloned = new Map();
  for (const [material, bucket] of map) {
    cloned.set(material, {
      horizontal: (bucket.horizontal ?? []).map((segment) => ({ ...segment })),
      vertical: (bucket.vertical ?? []).map((segment) => ({ ...segment })),
      paths: (bucket.paths ?? []).map(cloneSnakePath),
      solidPaths: (bucket.solidPaths ?? []).map((path) => path.map((point) => ({ ...point }))),
    });
  }
  return cloned;
}

export function roundMaybe(value) {
  return Number.isFinite(Number(value)) ? Number(Number(value).toFixed(3)) : value;
}
