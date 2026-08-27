export function snakeDebugRows(state, stats = null, c = null) {
  const items = stats?.items ?? [];
  return (state?.tpuSnake?.connections ?? []).map((connection, index) => {
    const item = snakeStatsItemForConnection(items, index);
    const target = Number(connection.targetLength ?? c?.tpuSnakeTargetLength ?? 200);
    const label = connection.label ?? String(index + 1);
    return {
      index,
      label,
      id: connection.id ?? "",
      target,
      generated: Boolean(item),
      actual: item?.length ?? null,
      error: item ? item.length - target : null,
      sourceConnectionIndex: item?.sourceConnectionIndex ?? index,
      sourceConnectionLabel: item?.sourceConnectionLabel ?? label,
      reason: item ? "" : missingSnakeReason(state, connection, index),
    };
  });
}

export function snakeStatsItemForConnection(items = [], index) {
  return items.find((item) => item.sourceConnectionIndex === index) ?? null;
}

function missingSnakeReason(state, connection, index) {
  const conflict = String(state?.tpuSnake?.conflict ?? "");
  if (!conflict) return "状态 未生成";
  const labels = [
    String(index + 1),
    String(connection?.label ?? ""),
    String(connection?.id ?? ""),
  ].filter(Boolean);
  return labels.some((label) => conflict.includes(`蛇形线 ${label}`))
    ? `原因 ${conflict}`
    : "状态 未生成";
}
