export function createImportedSvgGuideConnections(fittedGeometry, importConfig, importGroupId, deps) {
  const {
    baseMaterialGridSegments,
    tpuSnakePreviewLayer,
    tpuBoundaryEdges,
    nearestTpuSnakeGridEndpoint,
    nearestTpuRegionGuideEndpoint,
    createGuidedTpuSnakeConnection,
  } = deps;

  if (!fittedGeometry.guidePaths?.length) return [];
  const endpointBucket = baseMaterialGridSegments(importConfig, tpuSnakePreviewLayer(importConfig)).get(0);
  const endpointEdges = endpointBucket ? tpuBoundaryEdges(endpointBucket, importConfig) : null;
  const endpointResolver = endpointBucket
    ? (point) => nearestTpuSnakeGridEndpoint(point, importConfig, endpointBucket, endpointEdges, { maxDistance: Infinity })
      ?? nearestTpuRegionGuideEndpoint?.(point, importConfig)
    : nearestTpuRegionGuideEndpoint
      ? (point) => nearestTpuRegionGuideEndpoint(point, importConfig)
      : null;
  return fittedGeometry.guidePaths
    .map((path, index) => createGuidedTpuSnakeConnection(path, index, importConfig, importGroupId, endpointResolver))
    .filter(Boolean);
}
