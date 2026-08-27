export function createPointerHelpers(deps) {
  const {
    canvas,
    controls,
    clamp,
    distancePointToSegment,
    currentTpuSnakePreviewPaths,
  } = deps;

  function canvasPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function clampPoint(point, c) {
    return { x: clamp(point.x, 0, c.bedWidth), y: clamp(point.y, 0, c.bedDepth) };
  }

  function hitTpuSnakePath(point, c) {
    if (!c.tpuSnakeEnabled || controls.workflowMode.value !== "grid") return -1;
    const paths = currentTpuSnakePreviewPaths(c);
    const threshold = Math.max(2.5, c.gridLineWidth * 0.75, c.pitch * 0.18);
    let best = { index: -1, distance: Infinity };
    paths.forEach((path, index) => {
      for (let i = 1; i < path.length; i += 1) {
        const d = distancePointToSegment(point, path[i - 1], path[i]);
        if (d <= threshold && d < best.distance) best = { index, distance: d };
      }
    });
    return best.index;
  }

  return {
    canvasPoint,
    clampPoint,
    hitTpuSnakePath,
  };
}
