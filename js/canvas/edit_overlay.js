export function createEditOverlayRenderer(deps) {
  const {
    ctx,
    state,
    mmToPx,
    materialColor,
    selectedShapeIndices,
    shapeHandles,
    selectedShapesBounds,
    groupBoundsHandles,
  } = deps;

  function drawSnapGuides(c, f) {
    if (!state.snapGuides || state.snapGuides.length === 0) return;
    ctx.save();
    ctx.strokeStyle = "#2f8cff";
    ctx.lineWidth = 1.2;
    ctx.setLineDash([5, 4]);
    ctx.globalAlpha = 0.9;
    for (const guide of state.snapGuides) {
      if (guide.axis === "x") {
        const a = mmToPx(guide.value, 0, f);
        const b = mmToPx(guide.value, c.bedDepth, f);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      } else if (guide.axis === "y") {
        const a = mmToPx(0, guide.value, f);
        const b = mmToPx(c.bedWidth, guide.value, f);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawEditHandles(f) {
    const selected = selectedShapeIndices();
    if (selected.length === 0) return;
    ctx.save();
    ctx.fillStyle = "#ffffff";
    ctx.lineWidth = 2;
    if (selected.length > 1) {
      const bounds = selectedShapesBounds(selected);
      ctx.strokeStyle = "#20252b";
      ctx.setLineDash([5, 4]);
      const a = mmToPx(bounds.x, bounds.y, f);
      const b = mmToPx(bounds.x + bounds.w, bounds.y + bounds.h, f);
      ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
      ctx.setLineDash([]);
      for (const handle of groupBoundsHandles(bounds)) {
        const p = mmToPx(handle.x, handle.y, f);
        ctx.beginPath();
        ctx.rect(p.x - 5, p.y - 5, 10, 10);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
      return;
    }
    if (state.selectedShapeIndex < 0 || !state.shapes[state.selectedShapeIndex]) {
      ctx.restore();
      return;
    }
    const shape = state.shapes[state.selectedShapeIndex];
    const handles = shapeHandles(shape);
    ctx.strokeStyle = materialColor(shape.material);
    for (const handle of handles) {
      const p = mmToPx(handle.x, handle.y, f);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawPolylineEditState(f) {
    if (state.path.length === 0) return;
    ctx.save();
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#1d6f5f";
    ctx.lineWidth = 2;
    for (const point of state.path) {
      const p = mmToPx(point.x, point.y, f);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    const first = mmToPx(state.path[0].x, state.path[0].y, f);
    ctx.strokeStyle = "#e05b35";
    ctx.beginPath();
    ctx.arc(first.x, first.y, 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  return {
    drawEditHandles,
    drawPolylineEditState,
    drawSnapGuides,
  };
}
