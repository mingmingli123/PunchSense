export function bindCanvasScrollLockEvents(deps) {
  const {
    state,
    preventPageScrollDuringCanvasDrag,
  } = deps;

  window.addEventListener("wheel", preventPageScrollDuringCanvasDrag, { passive: false });
  window.addEventListener("touchmove", preventPageScrollDuringCanvasDrag, { passive: false });
  window.addEventListener("scroll", () => {
    if (state.scrollLock) window.scrollTo(state.scrollLock.x, state.scrollLock.y);
  }, { passive: true });
}
