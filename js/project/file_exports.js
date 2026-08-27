export function downloadTextFile(filename, text, type = "text/plain") {
  const blob = new Blob([text], { type });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
}

export function projectFilename(c, now = new Date()) {
  return `${timestampPart(now)}_PunchPrintShapes_EPI${formatParam(c.epi)}.punchprint.json`;
}

export function gcodeFilename(c, snakeStats = null, now = new Date()) {
  const epi = formatParam(c.epi);
  const snake = snakeFilenamePart(c, snakeStats);
  return `${timestampPart(now)}_EPI${epi}_L${c.gridLineCount}${snake}.gcode`;
}

export function snakeFilenamePart(c, snakeStats = null) {
  if (!c.tpuSnakeEnabled || !snakeStats) return "";
  if (snakeStats.length <= 0) return "";
  const items = snakeStats.items ?? [];
  if (items.length > 0) {
    const lengths = items
      .map((item, index) => `P${snakeLabelForFilename(item, index)}-${formatSnakeLengthParam(item.length)}`)
      .join("_");
    return `_Snake_${lengths}mm`;
  }
  return `_Snake${formatSnakeLengthParam(snakeStats.length)}mm`;
}

function snakeLabelForFilename(item, index) {
  const raw = item.sourceConnectionLabel ?? String((item.sourceConnectionIndex ?? index) + 1);
  return String(raw).replace(/[^A-Za-z0-9]+/g, "");
}

export function formatParam(value) {
  return String(Number(value.toFixed(3))).replace(".", "p");
}

export function formatSnakeLengthParam(value) {
  return String(Number(value.toFixed(1))).replace(".", "p");
}

function timestampPart(now) {
  return now.toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "")
    .replace("T", "_");
}
