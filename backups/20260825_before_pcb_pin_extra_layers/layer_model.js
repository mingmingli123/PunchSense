export function createTpuLayerModel(deps) {
  const {
    state,
    snakePathStats,
    getMaterialGridSegments,
    getTpuPathDeps,
  } = deps;

  function currentTpuSnakePreviewPaths(c) {
    const bucket = getMaterialGridSegments()(c, tpuSnakePreviewLayer(c)).get(0);
    return bucket?.paths ?? [];
  }

  function currentTpuSnakePreviewPath(c) {
    return currentTpuSnakePreviewPaths(c)[0] ?? [];
  }

  function currentTpuSnakeStats(c) {
    const bucket = getMaterialGridSegments()(c, tpuSnakeStatsLayer(c)).get(0);
    const rawStats = (bucket?.paths ?? []).map((path, index) => {
      const item = snakePathStats(path, getTpuPathDeps()());
      return {
        ...item,
        sourceConnectionIndex: Number.isInteger(path.sourceConnectionIndex) ? path.sourceConnectionIndex : index,
        sourceConnectionLabel: path.sourceConnectionLabel ?? String(index + 1),
      };
    });
    const stats = alignSnakeStatsToConnections(rawStats);
    return {
      count: stats.length,
      horizontal: stats.reduce((sum, item) => sum + item.horizontal, 0),
      vertical: stats.reduce((sum, item) => sum + item.vertical, 0),
      length: stats.reduce((sum, item) => sum + item.length, 0),
      items: stats,
    };
  }

  function alignSnakeStatsToConnections(items) {
    const connections = state?.tpuSnake?.connections ?? [];
    if (connections.length === 0) return items;
    return connections
      .map((connection, index) => {
        const label = connection?.label ?? connection?.id ?? String(index + 1);
        const byIndex = items.find((item) => item.sourceConnectionIndex === index);
        if (byIndex) return { ...byIndex, sourceConnectionIndex: index, sourceConnectionLabel: label };
        const byLabel = items.find((item) => String(item.sourceConnectionLabel ?? "") === String(label));
        return byLabel ? { ...byLabel, sourceConnectionIndex: index, sourceConnectionLabel: label } : null;
      })
      .filter(Boolean);
  }

  function tpuSnakePreviewLayer(c) {
    if (!c.tpuSnakeEnabled) return c.previewLayer;
    const snakeLayer = tpuSnakeTopLayer(c);
    const blockLayer = t0BlockTopLayer(c);
    if (snakeLayer >= t0BlockFirstLayer(c) && snakeLayer <= blockLayer) return snakeLayer;
    if (blockLayer >= tpuSnakeFirstLayer(c) && blockLayer <= snakeLayer) return blockLayer;
    return Math.max(tpuSnakeFirstLayer(c), t0BlockFirstLayer(c));
  }

  function tpuSnakeStatsLayer(c) {
    return tpuSnakeTopLayer(c);
  }

  function tpuSnakeFirstLayer(c) {
    return Math.max(1, Number(c.bottomLayerCount ?? 1)) + 1;
  }

  function tpuSnakeTopLayer(c) {
    if (c.tpuSnakeLayerCount <= 0) return tpuSnakeFirstLayer(c) - 1;
    return Math.min(generatedLayerCount(c), tpuSnakeFirstLayer(c) + Math.max(0, c.tpuSnakeLayerCount) - 1);
  }

  function t0BlockFirstLayer(c) {
    if (c.printMode === "wrapped") return 2;
    return Math.max(1, Number(c.bottomLayerCount ?? 1)) + 1;
  }

  function t0BlockTopLayer(c) {
    if (c.t0BlockLayerCount <= 0) return t0BlockFirstLayer(c) - 1;
    return Math.min(generatedLayerCount(c), t0BlockFirstLayer(c) + Math.max(0, c.t0BlockLayerCount) - 1);
  }

  function layerSpanCount(firstLayer, topLayer) {
    return Math.max(0, topLayer - firstLayer + 1);
  }

  function layerPrintsT0Block(c, layerIndex) {
    return layerIndex >= t0BlockFirstLayer(c) && layerIndex <= t0BlockTopLayer(c);
  }

  function generatedLayerCount(c) {
    return c.baseLayerCount;
  }

  return {
    currentTpuSnakePreviewPaths,
    currentTpuSnakePreviewPath,
    currentTpuSnakeStats,
    tpuSnakePreviewLayer,
    tpuSnakeStatsLayer,
    tpuSnakeFirstLayer,
    tpuSnakeTopLayer,
    t0BlockFirstLayer,
    t0BlockTopLayer,
    layerSpanCount,
    layerPrintsT0Block,
    generatedLayerCount,
  };
}
