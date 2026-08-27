export function createBedPreviewRenderer(deps) {
  const {
    canvas,
    ctx,
    mmToPx,
  } = deps;

  function drawBed(c, f) {
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);

    const bed = mmToPx(0, 0, f);
    ctx.fillStyle = "#f7fafb";
    ctx.strokeStyle = "#8b98a7";
    ctx.lineWidth = 1;
    ctx.fillRect(bed.x, bed.y, c.bedWidth * f.scale, c.bedDepth * f.scale);
    ctx.strokeRect(bed.x, bed.y, c.bedWidth * f.scale, c.bedDepth * f.scale);

    drawBedGrid(c, f);
  }

  function drawBedGrid(c, f) {
    ctx.save();
    ctx.strokeStyle = "#d6dde4";
    ctx.lineWidth = 1;
    for (let x = 0; x <= c.bedWidth; x += 10) {
      const a = mmToPx(x, 0, f);
      const b = mmToPx(x, c.bedDepth, f);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    for (let y = 0; y <= c.bedDepth; y += 10) {
      const a = mmToPx(0, y, f);
      const b = mmToPx(c.bedWidth, y, f);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  return {
    drawBed,
  };
}
