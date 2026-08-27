export function isRedGuideElement(element) {
  const stroke = (element.getAttribute("stroke") || getComputedStyle(element).stroke || "").trim();
  const color = normalizeSvgColor(stroke);
  if (!color) return false;
  return color.r >= 160 && color.g <= 80 && color.b <= 80;
}

export function svgElementMaterialHint(element) {
  const fill = normalizeSvgColor((element.getAttribute("fill") || getComputedStyle(element).fill || "").trim());
  const stroke = normalizeSvgColor((element.getAttribute("stroke") || getComputedStyle(element).stroke || "").trim());
  const color = fill ?? stroke;
  if (!color) return null;
  if (color.r <= 40 && color.g <= 40 && color.b <= 40) return 0;
  return null;
}

function normalizeSvgColor(value) {
  const raw = String(value || "").trim();
  if (!raw || raw === "none") return null;
  const hex = raw.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const h = hex[1].length === 3
      ? hex[1].split("").map((ch) => ch + ch).join("")
      : hex[1];
    return {
      r: Number.parseInt(h.slice(0, 2), 16),
      g: Number.parseInt(h.slice(2, 4), 16),
      b: Number.parseInt(h.slice(4, 6), 16),
    };
  }
  const rgb = raw.match(/^rgba?\(([^)]+)\)$/i);
  if (rgb) {
    const values = rgb[1].split(",").map((part) => Number.parseFloat(part));
    if (values.length >= 3 && values.slice(0, 3).every(Number.isFinite)) {
      return { r: values[0], g: values[1], b: values[2] };
    }
  }
  if (raw.toLowerCase() === "red") return { r: 255, g: 0, b: 0 };
  return null;
}
