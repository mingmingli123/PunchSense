export function bindSnakeManagerEvents(deps) {
  const {
    tpuSnakeList,
    state,
    draw,
    scheduleNumericDraw,
    cancelScheduledNumericDraw,
    startTpuSnakeEndpointPicking,
    clearTpuSnake,
    snakeTargetDrawDelayMs,
  } = deps;

  document.getElementById("pickTpuSnakeEndpoints").addEventListener("click", () => startTpuSnakeEndpointPicking(-1));
  document.getElementById("addTpuSnakeFromManager").addEventListener("click", () => startTpuSnakeEndpointPicking(-1));
  document.getElementById("clearTpuSnakeEndpoints").addEventListener("click", () => {
    clearTpuSnake();
  });

  tpuSnakeList?.addEventListener("input", (event) => {
    const input = event.target.closest("[data-snake-target]");
    if (!input) return;
    const index = Number(input.dataset.snakeIndex);
    const connection = state.tpuSnake.connections[index];
    if (!connection) return;
    connection.targetLength = Math.max(0, Number(input.value || 0));
    state.tpuSnake.conflict = null;
    scheduleNumericDraw({ deferSnakeStats: true, skipSnakeManager: true }, snakeTargetDrawDelayMs);
  });

  tpuSnakeList?.addEventListener("change", (event) => {
    const input = event.target.closest("[data-snake-target]");
    if (!input) return;
    cancelScheduledNumericDraw();
    draw();
  });

  tpuSnakeList?.addEventListener("click", (event) => {
    const debugToggle = event.target.closest("[data-snake-debug]");
    if (debugToggle) {
      const index = Number(debugToggle.dataset.snakeDebug);
      const connection = state.tpuSnake.connections[index];
      if (connection) {
        connection.debugOpen = !connection.debugOpen;
        draw();
      }
      return;
    }
    if (event.target.closest(".snakeDebug")) return;
    const redraw = event.target.closest("[data-snake-redraw]");
    if (redraw) {
      startTpuSnakeEndpointPicking(Number(redraw.dataset.snakeRedraw));
      return;
    }
    const del = event.target.closest("[data-snake-delete]");
    if (del) {
      const index = Number(del.dataset.snakeDelete);
      state.tpuSnake.connections.splice(index, 1);
      state.tpuSnake.endpoints = [];
      state.tpuSnake.editingConnectionIndex = -1;
      state.tpuSnake.selectedConnectionIndex = -1;
      state.tpuSnake.conflict = null;
      state.tpuSnake.connections.forEach((connection, connectionIndex) => {
        connection.label = String(connectionIndex + 1);
      });
      draw();
      return;
    }
    const card = event.target.closest("[data-snake-card]");
    if (card) {
      state.tpuSnake.selectedConnectionIndex = Number(card.dataset.snakeCard);
      draw();
    }
  });
}
