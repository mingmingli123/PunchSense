export function createScrollLockController(deps) {
  const {
    state,
    doc = document,
    win = window,
  } = deps;

  function lockCanvasDrag() {
    if (state.scrollLock) return;
    state.scrollLock = {
      x: win.scrollX,
      y: win.scrollY,
    };
    doc.documentElement.classList.add("canvasDragging");
    doc.body.classList.add("canvasDragging");
    doc.body.style.top = `-${state.scrollLock.y}px`;
    doc.body.style.left = `-${state.scrollLock.x}px`;
  }

  function unlockCanvasDrag() {
    if (!state.scrollLock) return;
    const { x, y } = state.scrollLock;
    state.scrollLock = null;
    doc.documentElement.classList.remove("canvasDragging");
    doc.body.classList.remove("canvasDragging");
    doc.body.style.top = "";
    doc.body.style.left = "";
    win.scrollTo(x, y);
  }

  function preventPageScrollDuringCanvasDrag(event) {
    if (!state.dragging && !state.scrollLock) return;
    event.preventDefault();
    if (state.scrollLock) win.scrollTo(state.scrollLock.x, state.scrollLock.y);
  }

  return {
    lockCanvasDrag,
    unlockCanvasDrag,
    preventPageScrollDuringCanvasDrag,
  };
}
