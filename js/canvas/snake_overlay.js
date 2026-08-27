import {
  samePoint,
} from "../core/geometry.js";

export function createSnakeOverlayRenderer({
  ctx,
  state,
  mmToPx,
  drawOpenPath,
  drawRectRegion,
  tpuSnakePlanningCorridors,
  tpuPathDeps,
  currentTpuSnakePreviewPaths,
  pcbPinMarkers,
}) {
  function drawTpuSnakePlanningRegions(c, f) {
    if (!c.tpuSnakeEnabled || state.tpuSnake.connections.length === 0) return;
    const regions = tpuSnakePlanningCorridors(c, tpuPathDeps(), state.tpuSnake.connections);
    if (regions.length === 0) return;
    const selectedIndex = Number(state.tpuSnake.selectedConnectionIndex ?? -1);
    const hasSelection = selectedIndex >= 0 && selectedIndex < regions.length;
    ctx.save();
    const ordered = hasSelection
      ? regions.map((region, index) => ({ region, index })).sort((a, b) => (a.index === selectedIndex ? 1 : b.index === selectedIndex ? -1 : 0))
      : regions.map((region, index) => ({ region, index }));
    ordered.forEach(({ region, index }) => {
      const active = hasSelection && index === selectedIndex;
      const fill = active
        ? "rgba(47, 157, 224, 0.10)"
        : hasSelection
          ? "rgba(80, 80, 80, 0.00)"
          : "rgba(47, 157, 224, 0.035)";
      const stroke = active
        ? "rgba(47, 157, 224, 0.70)"
        : hasSelection
          ? "rgba(47, 157, 224, 0.10)"
          : "rgba(47, 157, 224, 0.18)";
      const dash = active ? [7, 5] : [4, 8];
      drawRectRegion(region.local, f, fill, stroke, dash);
      if (!active && hasSelection) return;
      const labelPoint = mmToPx(region.local.x + 1.5, region.local.y + 4, f);
      ctx.fillStyle = active ? "rgba(31, 103, 151, 0.86)" : "rgba(31, 103, 151, 0.34)";
      ctx.font = "12px sans-serif";
      ctx.fillText(`路径 ${index + 1} 可用区`, labelPoint.x, labelPoint.y);
    });
    ctx.restore();
  }

  function drawImportedGuideLines(c, f) {
    if (!c.tpuSnakeEnabled || state.tpuSnake.connections.length === 0) return;
    const guideConnections = state.tpuSnake.connections
      .map((connection, index) => ({ connection, index }))
      .filter(({ connection }) => Array.isArray(connection.guidePoints) && connection.guidePoints.length >= 2);
    if (guideConnections.length === 0) return;
    ctx.save();
    ctx.lineWidth = Math.max(2, c.beadWidth * f.scale * 1.8);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const { connection, index } of guideConnections) {
      const points = orthogonalDisplayPath(connection.guidePoints);
      if (points.length < 2) continue;
      ctx.strokeStyle = index === state.tpuSnake.selectedConnectionIndex ? "rgba(224, 91, 53, 0.95)" : "rgba(224, 91, 53, 0.62)";
      ctx.setLineDash([8, 5]);
      ctx.beginPath();
      points.forEach((point, pointIndex) => {
        const p = mmToPx(point.x, point.y, f);
        if (pointIndex === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawGridPathOverlays(pathOverlays, c, f) {
    if (pathOverlays.length === 0) return;
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const overlay of pathOverlays) {
      if (overlay.path.length < 2) continue;
      ctx.strokeStyle = overlay.color;
      ctx.lineWidth = Math.max(2.4, c.gridLineWidth * f.scale);
      drawOpenPath(orthogonalDisplayPath(overlay.path), f);
    }
    ctx.restore();
  }

  function drawTpuSnakeEndpoints(c, f) {
    if (!c.tpuSnakeEnabled && state.tpuSnake.endpoints.length === 0 && state.tpuSnake.connections.length === 0) return;
    ctx.save();
    const previewPaths = c.tpuSnakeEnabled ? currentTpuSnakePreviewPaths(c) : [];
    const pathByConnectionIndex = snakePathByConnectionIndex(previewPaths);
    const points = [
      ...state.tpuSnake.connections.flatMap((connection, connectionIndex) => (
        displayedSnakeConnectionEndpoints(connection, pathByConnectionIndex.get(connectionIndex)).map((point, endpointIndex) => ({ point, label: `${connectionIndex + 1}${endpointIndex === 0 ? "A" : "B"}` }))
      )),
      ...state.tpuSnake.endpoints.map((point, index) => ({ point, label: `新${index + 1}` })),
    ];
    points.forEach(({ point, label }, index) => {
      const p = mmToPx(point.x, point.y, f);
      ctx.fillStyle = index === 0 ? "#111111" : "#f7f2e8";
      ctx.strokeStyle = "#e05b35";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#20252b";
      ctx.font = "12px sans-serif";
      ctx.fillText(label, p.x + 8, p.y - 8);
    });
    ctx.restore();
  }

  function drawPcbPinMarkers(c, f) {
    const markers = pcbPinMarkers?.(c) ?? [];
    if (markers.length === 0) return;
    const activeRefs = new Set(state.tpuSnake.connections.flatMap((connection) => (
      (connection.endpoints ?? [])
        .filter((endpoint) => endpoint?.source === "pcb-pin" && endpoint.pcbShapeId && endpoint.pinId)
        .map((endpoint) => `${endpoint.pcbShapeId}:${endpoint.pinId}`)
    )));
    const picking = Boolean(state.tpuSnake.picking);
    ctx.save();
    for (const marker of markers) {
      const role = marker.role === "send" || marker.role === "receive" || marker.role === "ground";
      const p = mmToPx(marker.point.x, marker.point.y, f);
      const active = activeRefs.has(`${marker.pcbShapeId}:${marker.pinId}`);
      if (!role) continue;
      const style = pcbPinMarkerStyle(marker);
      const radius = Math.max(12, c.pitch * f.scale * 1.55);

      ctx.fillStyle = active ? "rgba(17, 17, 17, 0.88)" : style.fill;
      ctx.strokeStyle = style.color;
      ctx.lineWidth = active || picking ? 3 : 2.2;
      ctx.setLineDash(active || picking ? [] : [6, 4]);
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = active ? "#111111" : "#ffffff";
      ctx.strokeStyle = style.color;
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 6.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = style.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.x - 8, p.y);
      ctx.lineTo(p.x + 8, p.y);
      ctx.moveTo(p.x, p.y - 8);
      ctx.lineTo(p.x, p.y + 8);
      ctx.stroke();

      drawPinLabel(style.label, p, style.color, style.side);
    }
    ctx.restore();
  }

  function pcbPinMarkerStyle(marker) {
    if (marker.role === "send") {
      return { color: "#1f8f5f", fill: "rgba(31, 143, 95, 0.18)", label: "SEND D2 / GPIO4", side: -1 };
    }
    if (marker.role === "receive") {
      return { color: "#7b61ff", fill: "rgba(123, 97, 255, 0.18)", label: "RECV D7 / GPIO20", side: 1 };
    }
    return { color: "#1677ff", fill: "rgba(22, 119, 255, 0.18)", label: "GND", side: 1 };
  }

  function drawPinLabel(text, p, color, side) {
    const paddingX = 7;
    const paddingY = 4;
    ctx.save();
    ctx.font = "bold 11px sans-serif";
    const textWidth = ctx.measureText(text).width;
    const boxW = textWidth + paddingX * 2;
    const boxH = 22;
    const boxX = side < 0 ? p.x - boxW - 14 : p.x + 14;
    const boxY = p.y - boxH / 2;
    ctx.strokeStyle = color;
    ctx.fillStyle = "rgba(255, 255, 255, 0.94)";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(side < 0 ? boxX + boxW : boxX, boxY + boxH / 2);
    ctx.stroke();
    roundedRect(ctx, boxX, boxY, boxW, boxH, 5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.fillText(text, boxX + paddingX, boxY + 15);
    ctx.restore();
  }

  return {
    drawGridPathOverlays,
    drawImportedGuideLines,
    drawPcbPinMarkers,
    drawTpuSnakeEndpoints,
    drawTpuSnakePlanningRegions,
    orthogonalDisplayPath,
  };
}

function roundedRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
}

function orthogonalDisplayPath(path) {
  const result = [];
  for (const point of path) {
    if (result.length === 0) {
      result.push(point);
      continue;
    }
    const last = result[result.length - 1];
    if (samePoint(last, point, 0.001)) continue;
    const sameX = Math.abs(last.x - point.x) <= 0.001;
    const sameY = Math.abs(last.y - point.y) <= 0.001;
    if (!sameX && !sameY) {
      const previous = result.length >= 2 ? result[result.length - 2] : null;
      const continueHorizontal = previous && Math.abs(previous.y - last.y) <= 0.001;
      result.push(continueHorizontal ? { x: point.x, y: last.y } : { x: last.x, y: point.y });
    }
    result.push(point);
  }
  return result;
}

function displayedSnakeConnectionEndpoints(connection, previewPath) {
  if (previewPath?.length >= 2) return [previewPath[0], previewPath[previewPath.length - 1]];
  return connection.endpoints ?? [];
}

function snakePathByConnectionIndex(paths) {
  const result = new Map();
  (paths ?? []).forEach((path, fallbackIndex) => {
    const index = Number.isInteger(path?.sourceConnectionIndex)
      ? path.sourceConnectionIndex
      : fallbackIndex;
    if (!result.has(index)) result.set(index, path);
  });
  return result;
}
