export function createTpuSnakeTransform({
  state,
  cloneSnakeConnection,
  cloneSnakeEndpoint,
}) {
  function cloneTpuSnakeState() {
    return {
      endpoints: state.tpuSnake.endpoints.map(cloneSnakeEndpoint),
      connections: state.tpuSnake.connections.map(cloneSnakeConnection),
    };
  }

  function restoreTpuSnakeState(snapshot) {
    if (!snapshot) return;
    state.tpuSnake.endpoints = snapshot.endpoints.map(cloneSnakeEndpoint);
    state.tpuSnake.connections = snapshot.connections.map(cloneSnakeConnection);
    state.tpuSnake.conflict = null;
  }

  function transformTpuSnakePoint(point, mapper) {
    if (!point) return point;
    const mapped = mapper(point);
    const next = { ...point, x: mapped.x, y: mapped.y };
    if (point.boundaryPoint) next.boundaryPoint = mapper(point.boundaryPoint);
    if (point.contactPoint) next.contactPoint = mapper(point.contactPoint);
    return next;
  }

  function moveTpuSnake(dx, dy, importGroupIds = null) {
    const mapper = (point) => ({ x: point.x + dx, y: point.y + dy });
    transformTpuSnake(mapper, importGroupIds);
  }

  function scaleTpuSnakeFromBounds(oldBounds, nextBounds, sx, sy, importGroupIds = null) {
    const mapper = (point) => ({
      x: nextBounds.x + (point.x - oldBounds.x) * sx,
      y: nextBounds.y + (point.y - oldBounds.y) * sy,
    });
    transformTpuSnake(mapper, importGroupIds);
  }

  function transformTpuSnake(mapper, importGroupIds = null) {
    const transformAll = !importGroupIds || importGroupIds.size === 0;
    if (transformAll) state.tpuSnake.endpoints = state.tpuSnake.endpoints.map((endpoint) => transformTpuSnakePoint(endpoint, mapper));
    state.tpuSnake.connections = state.tpuSnake.connections.map((connection) => ({
      ...connection,
      endpoints: transformAll || importGroupIds.has(connection.importGroupId)
        ? (connection.endpoints ?? []).map((endpoint) => transformTpuSnakePoint(endpoint, mapper))
        : (connection.endpoints ?? []).map(cloneSnakeEndpoint),
      guidePoints: transformAll || importGroupIds.has(connection.importGroupId)
        ? (Array.isArray(connection.guidePoints) ? connection.guidePoints.map(mapper) : undefined)
        : (Array.isArray(connection.guidePoints) ? connection.guidePoints.map((point) => ({ ...point })) : undefined),
    }));
    state.tpuSnake.conflict = null;
  }

  return {
    cloneTpuSnakeState,
    moveTpuSnake,
    restoreTpuSnakeState,
    scaleTpuSnakeFromBounds,
    transformTpuSnake,
    transformTpuSnakePoint,
  };
}
