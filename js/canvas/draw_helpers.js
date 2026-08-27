export function createDrawHelpers(ctx, mmToPx) {
  function drawRectRegion(rect, f, fillStyle, strokeStyle, dash = []) {
    if (!rect || rect.w <= 0 || rect.h <= 0) return;
    const p = mmToPx(rect.x, rect.y, f);
    ctx.save();
    ctx.setLineDash(dash);
    ctx.fillStyle = fillStyle;
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = dash.length ? 2 : 2.6;
    ctx.fillRect(p.x, p.y, rect.w * f.scale, rect.h * f.scale);
    ctx.strokeRect(p.x, p.y, rect.w * f.scale, rect.h * f.scale);
    ctx.restore();
  }

  function drawOpenPath(path, f) {
    if (!path?.length) return;
    ctx.beginPath();
    path.forEach((point, index) => {
      const p = mmToPx(point.x, point.y, f);
      if (index === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();
  }

  function drawPolygonPath(points, f) {
    if (!points?.length) return;
    const first = mmToPx(points[0].x, points[0].y, f);
    ctx.beginPath();
    ctx.moveTo(first.x, first.y);
    for (const point of points.slice(1)) {
      const p = mmToPx(point.x, point.y, f);
      ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
  }

  return {
    drawOpenPath,
    drawPolygonPath,
    drawRectRegion,
  };
}

export function createMaterialColorHelpers(materialColors, fallbackMaterial) {
  function materialColor(material) {
    const value = Number(material ?? fallbackMaterial());
    if (value < 0) return "#f8fafc";
    return materialColors[((value % materialColors.length) + materialColors.length) % materialColors.length];
  }

  function materialPreviewStrokeColor(material) {
    const value = Number(material);
    if (value < 0) return "#94a3b8";
    if (value === 2) return "#2f9de0";
    if (value === 1) return "#b4a58d";
    return materialColor(material);
  }

  return {
    materialColor,
    materialPreviewStrokeColor,
  };
}

export function hexToRgba(hex, alpha) {
  const clean = hex.replace("#", "");
  const value = Number.parseInt(clean, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
