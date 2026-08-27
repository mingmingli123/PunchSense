export function createViewport(deps) {
  const {
    canvas,
    ctx,
    snakeManager,
    config,
    win = window,
  } = deps;

  function fit() {
    const c = config();
    const rect = canvas.getBoundingClientRect();
    const dpr = win.devicePixelRatio || 1;
    canvas.width = Math.max(600, Math.floor(rect.width * dpr));
    canvas.height = Math.max(600, Math.floor(rect.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const padX = 14;
    const padY = 34;
    const managerRect = snakeManager?.getBoundingClientRect();
    const managerLeft = managerRect && managerRect.width > 0
      ? Math.max(240, managerRect.left - rect.left - 14)
      : rect.width;
    const drawableWidth = Math.max(220, managerLeft - padX * 2);
    const drawableHeight = Math.max(220, rect.height - padY * 2);
    const scale = Math.min(drawableWidth / c.bedWidth, drawableHeight / c.bedDepth);
    return {
      scale,
      ox: (managerLeft - c.bedWidth * scale) / 2,
      oy: (rect.height - c.bedDepth * scale) / 2,
    };
  }

  function mmToPx(x, y, f) {
    return { x: f.ox + x * f.scale, y: f.oy + y * f.scale };
  }

  function pxToMm(x, y, f) {
    return { x: (x - f.ox) / f.scale, y: (y - f.oy) / f.scale };
  }

  return {
    fit,
    mmToPx,
    pxToMm,
  };
}
