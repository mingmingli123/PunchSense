import { snakeDebugRows } from "./debug.js";

export function createSnakeUi({
  state,
  statusEl,
  listEl,
  getStats,
  firstLayerMaterial,
  toolProfile,
  tpuSnakeFirstLayer,
  tpuSnakeTopLayer,
  t0BlockFirstLayer,
  t0BlockTopLayer,
}) {
  function updateTpuSnakeStatus(c, stats = null, options = {}) {
    if (!statusEl) return;
    if (!c.tpuSnakeEnabled) {
      statusEl.textContent = "TPU 蛇形：未开启。开启后可新增多条 T0 区域之间的蛇形线。";
      return;
    }
    if (c.printMode === "wrapped") {
      statusEl.textContent = `TPU 蛇形：包裹模式，底部 ${c.bottomLayerCount} 层，蛇形线第 ${tpuSnakeFirstLayer(c)}-${tpuSnakeTopLayer(c)} 层，黑色块第 ${t0BlockFirstLayer(c)}-${t0BlockTopLayer(c)} 层。`;
    }
    const crossingText = c.printMode === "crossing" || c.printMode === "wrapped"
      ? `黑白正交交叉点${c.tpuSnakeAllowCrossings ? "保留" : "切开"}。`
      : "";
    if (c.baseLayerCount < 2) {
      statusEl.textContent = `TPU 蛇形：首层强制 ${toolProfile(firstLayerMaterial, c).label}，但当前底板只有 1 层；请增加底板层数以生成 T0 路径层。`;
      return;
    }
    if (c.tpuSnakeLayerCount < 1) {
      statusEl.textContent = "TPU 蛇形：蛇形线层数为 0，不会生成 T0 路径层。";
      return;
    }
    const count = state.tpuSnake.endpoints.length;
    if (state.tpuSnake.picking) {
      const editing = state.tpuSnake.editingConnectionIndex >= 0;
      const label = editing ? `正在重画第 ${state.tpuSnake.editingConnectionIndex + 1} 条` : `正在新增第 ${state.tpuSnake.connections.length + 1} 条`;
      statusEl.textContent = `TPU 蛇形：${label}，已选 ${count}/2。默认目标 ${c.tpuSnakeTargetLength.toFixed(1)} mm。${crossingText}`;
      return;
    }
    if (state.tpuSnake.connections.length === 0) {
      statusEl.textContent = `TPU 蛇形：已开启，尚未添加路径。点击“新增 TPU 蛇形线”选择一对端点。默认目标 ${c.tpuSnakeTargetLength.toFixed(1)} mm。${crossingText}`;
      return;
    }
    if (state.tpuSnake.conflict) {
      statusEl.textContent = `TPU 蛇形：冲突，${state.tpuSnake.conflict}。冲突路径不会导出。`;
      return;
    }
    if (!stats && options.deferStats) {
      statusEl.textContent = `TPU 蛇形：${state.tpuSnake.connections.length} 条，参数编辑中，稍后更新路径长度。${crossingText}`;
      return;
    }
    const statsToUse = stats ?? getStats(c);
    statusEl.textContent = `TPU 蛇形：${state.tpuSnake.connections.length} 条，${formatSnakeStats(c, statsToUse)}；多条线不能共用网格交点。${crossingText}`;
  }

  function renderTpuSnakeManager(c, stats = null, options = {}) {
    if (!listEl) return;
    const active = document.activeElement;
    const activeIndex = active?.dataset?.snakeIndex;
    const statsToUse = stats ?? (options.deferStats ? { items: [] } : getStats(c));
    if (!c.tpuSnakeEnabled) {
      listEl.innerHTML = "<div class=\"snakeEmpty\">开启 T0 TPU 蛇形线后，可在这里管理每条路径。</div>";
      return;
    }
    if (state.tpuSnake.connections.length === 0) {
      listEl.innerHTML = "<div class=\"snakeEmpty\">暂无蛇形线。点击“新增”后，在黑色 TPU 边界上选择两个端点。</div>";
      return;
    }
    const debugRows = snakeDebugRows(state, statsToUse, c);
    listEl.innerHTML = state.tpuSnake.connections.map((connection, index) => {
      const debug = debugRows[index];
      const actual = debug.generated ? `${debug.actual.toFixed(1)} mm` : "未生成";
      const target = debug.target;
      const error = debug.generated ? `${debug.error.toFixed(1)} mm` : "-";
      const editing = state.tpuSnake.editingConnectionIndex === index;
      const selected = state.tpuSnake.selectedConnectionIndex === index;
      const debugOpen = Boolean(connection.debugOpen);
      return `
        <article class="snakeCard${editing ? " isEditing" : ""}${selected ? " isSelected" : ""}${debug.generated ? "" : " isMissing"}" data-snake-card="${index}">
          <div class="snakeCardHeader">
            <span>路径 ${index + 1}</span>
            <span>${debug.generated ? "T0" : "未生成"}</span>
          </div>
          <label>
            目标长度 (mm)
            <input data-snake-target data-snake-index="${index}" type="number" min="0" max="5000" step="1" value="${target.toFixed(1)}">
          </label>
          <div class="snakeMetric">实际 ${actual}<br>误差 ${error}${debug.reason ? `<br>${escapeHtml(debug.reason)}` : ""}</div>
          <button type="button" class="snakeDebugToggle" data-snake-debug="${index}">${debugOpen ? "隐藏调试" : "调试"}</button>
          <div class="snakeDebug${debugOpen ? "" : " isHidden"}">
            <div>index ${debug.index}, label ${escapeHtml(debug.label)}</div>
            <div>source ${debug.sourceConnectionIndex}, ${escapeHtml(debug.sourceConnectionLabel)}</div>
            <div>状态 ${debug.generated ? "generated" : "missing"}</div>
          </div>
          <div class="snakeActions">
            <button type="button" data-snake-redraw="${index}">重画端点</button>
            <button type="button" class="danger" data-snake-delete="${index}">删除</button>
          </div>
        </article>
      `;
    }).join("");
    if (activeIndex !== undefined) {
      const next = listEl.querySelector(`[data-snake-target][data-snake-index="${activeIndex}"]`);
      if (next) next.focus();
    }
  }

  function formatSnakeStats(c, stats) {
    const target = state.tpuSnake.connections.reduce((sum, connection) => sum + Number(connection.targetLength ?? c.tpuSnakeTargetLength), 0);
    const layerNote = c.tpuSnakeLayerCount > 1
      ? `第 ${tpuSnakeFirstLayer(c)}-${tpuSnakeTopLayer(c)} 层 `
      : `第 ${tpuSnakeTopLayer(c)} 层 `;
    const details = stats.items?.length
      ? `（${stats.items.map((item, index) => `${snakeStatsLabel(item, index)}:${item.length.toFixed(1)}mm`).join(" / ")}）`
      : "";
    const base = `${layerNote}路径 ${stats.count ?? 1} 条，${stats.horizontal} 横段 / ${stats.vertical} 连接段，总长度 ${stats.length.toFixed(1)} mm ${details}`;
    if (target <= 0) return base;
    return `${base}，总目标 ${target.toFixed(1)} mm，误差 ${(stats.length - target).toFixed(1)} mm`;
  }

  function snakeStatsLabel(item, index) {
    return item.sourceConnectionLabel ?? String((item.sourceConnectionIndex ?? index) + 1);
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  return {
    renderTpuSnakeManager,
    updateTpuSnakeStatus,
  };
}
