export function cloneShape(shape) {
  return {
    ...shape,
    points: shape.points ? shape.points.map((point) => ({ ...point })) : undefined,
  };
}

export function cloneSnakeEndpoint(endpoint) {
  return {
    ...endpoint,
    normal: endpoint?.normal ? { ...endpoint.normal } : null,
    boundaryPoint: endpoint?.boundaryPoint ? { ...endpoint.boundaryPoint } : null,
    contactPoint: endpoint?.contactPoint ? { ...endpoint.contactPoint } : null,
    contactGridPoint: endpoint?.contactGridPoint ? { ...endpoint.contactGridPoint } : null,
    frameGridPoint: endpoint?.frameGridPoint ? { ...endpoint.frameGridPoint } : null,
    rawPoint: endpoint?.rawPoint ? { ...endpoint.rawPoint } : undefined,
    clickedEdgePoint: endpoint?.clickedEdgePoint ? { ...endpoint.clickedEdgePoint } : undefined,
  };
}

export function cloneSnakeConnection(connection) {
  return {
    ...connection,
    endpoints: Array.isArray(connection?.endpoints) ? connection.endpoints.map(cloneSnakeEndpoint) : [],
    guidePoints: Array.isArray(connection?.guidePoints) ? connection.guidePoints.map((point) => ({ ...point })) : undefined,
    rawGuidePoints: Array.isArray(connection?.rawGuidePoints) ? connection.rawGuidePoints.map((point) => ({ ...point })) : undefined,
  };
}

export function cloneSnakePath(path) {
  const cloned = path.map((point) => ({ ...point }));
  for (const key of ["sourceConnectionIndex", "sourceConnectionLabel"]) {
    if (path[key] !== undefined) cloned[key] = path[key];
  }
  return cloned;
}
