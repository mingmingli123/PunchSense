import {
  normalizeFrame,
} from "../core/geometry.js";

export function normalizeProjectData(data, options = {}) {
  if (!data || typeof data !== "object") throw new Error("JSON 内容为空或格式不正确。");
  const {
    fallbackDrawMode = "rect",
    fallbackMaterial = 0,
    fallbackTargetLength = 200,
    fallbackNormalLeadLength = 0,
  } = options;
  const controlsData = data.format === "punchprint-ui-project" ? data.controls ?? {} : controlsFromLegacyConfig(data);
  const geometry = data.format === "punchprint-ui-project"
    ? data.geometry ?? {}
    : legacyGeometryFromConfig(data);
  const snake = data.format === "punchprint-ui-project"
    ? data.tpuSnake ?? {}
    : data.tpu_snake ?? {};

  const sanitizeOptions = { fallbackMaterial, fallbackTargetLength, fallbackNormalLeadLength };
  const shapes = Array.isArray(geometry.shapes)
    ? geometry.shapes.map((shape) => sanitizeShape(shape, sanitizeOptions)).filter(Boolean)
    : [];
  const frame = sanitizeFrame(geometry.frame ?? {});
  const path = Array.isArray(geometry.path)
    ? geometry.path.map(sanitizePoint).filter(Boolean)
    : [];
  const shapeMode = ["empty", "rect", "free", "polyline"].includes(geometry.shapeMode) ? geometry.shapeMode : "empty";
  return {
    controls: controlsData,
    drawMode: ["rect", "free", "polyline"].includes(controlsData.drawMode) ? controlsData.drawMode : fallbackDrawMode,
    shapeMode,
    frame,
    path,
    polylineClosed: Boolean(geometry.polylineClosed),
    shapes,
    regionMaterialOverrides: sanitizeRegionOverrides(geometry.regionMaterialOverrides ?? [], sanitizeOptions),
    tpuSnake: {
      endpoints: Array.isArray(snake.endpoints) ? snake.endpoints.map(sanitizeSnakeEndpoint).filter(Boolean) : [],
      connections: Array.isArray(snake.connections)
        ? snake.connections.map((connection) => sanitizeSnakeConnection(connection, sanitizeOptions)).filter(Boolean)
        : [],
    },
  };
}

export function controlsFromLegacyConfig(data) {
  const baseLayerCount = data.printer?.base_layer_count;
  const snakeLayerCount = data.tpu_snake?.layer_count;
  const inferredBottomLayerCount = Number.isFinite(Number(baseLayerCount)) && Number.isFinite(Number(snakeLayerCount))
    ? Math.max(1, Number(baseLayerCount) - Number(snakeLayerCount))
    : undefined;
  return {
    bedWidth: data.bed?.width,
    bedDepth: data.bed?.depth,
    nozzleDiameter: data.printer?.nozzle_diameter,
    beadWidth: data.printer?.bead_width,
    layerHeight: data.printer?.layer_height,
    firstLayerHeight: data.printer?.first_layer_height,
    baseLayerCount,
    bottomLayerCount: data.printer?.bottom_layer_count ?? inferredBottomLayerCount,
    extrusionFlow: data.printer?.extrusion_flow ?? 1.1,
    epi: data.epi,
    gridLineCount: data.grid_line_count,
    tpuFillMode: data.t0_fill_mode_default,
    pcbPinContactsEnabled: data.pcb_pin_contacts?.enabled,
    pcbPinContactEpi: data.pcb_pin_contacts?.epi,
    pcbPinContactWidth: data.pcb_pin_contacts?.width,
    pcbPinExtraLayerCount: data.pcb_pin_contacts?.extra_layer_count,
    frameLoops: data.frame_loops,
    frameSpacing: data.frame_spacing,
    materialOverlapWidth: data.material_overlap_width,
    materialBoundaryFrames: data.material_boundary_frames,
    tpuSnakeEnabled: data.tpu_snake?.enabled,
    printMode: data.tpu_snake?.mode ?? (data.tpu_snake?.exposed_mode ? "exposed" : "crossing"),
    exposedSnakeMode: data.tpu_snake?.exposed_mode,
    tpuSnakeLayerCount: data.tpu_snake?.layer_count,
    t0BlockLayerCount: data.tpu_snake?.t0_block_layer_count,
    tpuSnakeRemainderMaterial: data.tpu_snake?.remainder_material,
    tpuSnakeMaterialOrder: data.tpu_snake?.material_order,
    tpuSnakeCornerRelief: data.tpu_snake?.corner_relief,
    tpuSnakeAllowCrossings: data.tpu_snake?.allow_crossings,
    tpuSnakeTargetLength: data.tpu_snake?.target_length_mm,
    tpuSnakeNormalLeadLength: data.tpu_snake?.normal_lead_length_mm,
    tool: data.tool,
    extruderTemp: data.extruder_temp,
    bedTemp: data.bed_temp,
    drawMode: data.shape_mode === "free" || data.shape_mode === "polyline" ? data.shape_mode : "rect",
  };
}

export function legacyGeometryFromConfig(data) {
  return {
    shapeMode: data.shape_mode ?? "empty",
    frame: data.frame ?? {},
    path: Array.isArray(data.polygon) ? data.polygon : [],
    polylineClosed: data.polyline_closed,
    shapes: Array.isArray(data.shapes) ? data.shapes : [],
    regionMaterialOverrides: Array.isArray(data.region_material_overrides) ? data.region_material_overrides : [],
  };
}

export function sanitizeShape(shape, options = {}) {
  if (!shape || typeof shape !== "object") return null;
  const material = sanitizeMaterial(shape.material ?? options.fallbackMaterial, options.fallbackMaterial);
  const base = {
    id: typeof shape.id === "string" ? shape.id : crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    material,
  };
  if (shape.kind === "pcb-cutout" || shape.kind === "pcb") base.kind = "pcb-cutout";
  if (typeof shape.pcbProfileId === "string") base.pcbProfileId = shape.pcbProfileId;
  if (typeof shape.label === "string") base.label = shape.label;
  if (shape.lockedMaterial) base.lockedMaterial = true;
  if (typeof shape.importGroupId === "string") base.importGroupId = shape.importGroupId;
  if (shape.tpuFillMode === "solid" || shape.tpuFillMode === "grid") base.tpuFillMode = shape.tpuFillMode;
  if (shape.type === "polygon") {
    const points = Array.isArray(shape.points) ? shape.points.map(sanitizePoint).filter(Boolean) : [];
    return points.length >= 3 ? { ...base, type: "polygon", points } : null;
  }
  if (shape.type === "rect") {
    const frame = sanitizeFrame(shape);
    const rotation = Number(shape.rotation);
    return frame.w > 0 && frame.h > 0
      ? { ...base, type: "rect", ...frame, ...(Number.isFinite(rotation) ? { rotation } : {}) }
      : null;
  }
  if (shape.type === "circle" || shape.type === "triangle" || shape.type === "hexagon") {
    const point = sanitizePoint(shape);
    const r = Number(shape.r);
    if (!point || !Number.isFinite(r) || r <= 0) return null;
    return { ...base, type: shape.type, x: point.x, y: point.y, r, rotation: Number.isFinite(Number(shape.rotation)) ? Number(shape.rotation) : null };
  }
  return null;
}

export function sanitizePoint(point) {
  const x = Number(point?.x);
  const y = Number(point?.y);
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}

export function sanitizeFrame(frame) {
  return normalizeFrame({
    x: Number(frame?.x) || 0,
    y: Number(frame?.y) || 0,
    w: Number(frame?.w) || 0,
    h: Number(frame?.h) || 0,
  });
}

export function sanitizeMaterial(material, fallbackMaterial = 0) {
  const fallback = Number(fallbackMaterial);
  const value = Number(material);
  if (Number.isInteger(value) && value >= -1 && value <= 3) return value;
  return Number.isInteger(fallback) && fallback >= 0 && fallback <= 3 ? fallback : 0;
}

export function sanitizeRegionOverrides(entries, options = {}) {
  return entries
    .map((entry) => {
      if (Array.isArray(entry) && entry.length >= 2) return [String(entry[0]), sanitizeMaterial(entry[1], options.fallbackMaterial)];
      if (entry && typeof entry === "object" && entry.key !== undefined) return [String(entry.key), sanitizeMaterial(entry.material, options.fallbackMaterial)];
      return null;
    })
    .filter(Boolean);
}

export function sanitizeSnakeEndpoint(endpoint) {
  const point = sanitizePoint(endpoint);
  if (!point) return null;
  const sanitized = {
    ...point,
    normal: sanitizePoint(endpoint.normal),
    boundaryPoint: sanitizePoint(endpoint.boundaryPoint),
    rawPoint: sanitizePoint(endpoint.rawPoint),
    clickedEdgePoint: sanitizePoint(endpoint.clickedEdgePoint),
    contactPoint: sanitizePoint(endpoint.contactPoint),
    contactGridPoint: sanitizePoint(endpoint.contactGridPoint),
    frameGridPoint: sanitizePoint(endpoint.frameGridPoint),
    normalLeadLength: Math.max(0, Number(endpoint.normalLeadLength || 0)),
  };
  if (endpoint.resolvedEndpointFinal) sanitized.resolvedEndpointFinal = true;
  if (typeof endpoint.source === "string") sanitized.source = endpoint.source;
  if (typeof endpoint.pcbShapeId === "string") sanitized.pcbShapeId = endpoint.pcbShapeId;
  if (typeof endpoint.pinId === "string") sanitized.pinId = endpoint.pinId;
  if (typeof endpoint.pinLabel === "string") sanitized.pinLabel = endpoint.pinLabel;
  if (typeof endpoint.pinName === "string") sanitized.pinName = endpoint.pinName;
  if (typeof endpoint.gpio === "string") sanitized.gpio = endpoint.gpio;
  if (typeof endpoint.role === "string") sanitized.role = endpoint.role;
  if (endpoint.selectedEdge && typeof endpoint.selectedEdge === "object") {
    sanitized.selectedEdge = { ...endpoint.selectedEdge };
  }
  return sanitized;
}

export function sanitizeSnakeConnection(connection, options = {}) {
  if (!connection || typeof connection !== "object") return null;
  const endpoints = Array.isArray(connection.endpoints) ? connection.endpoints.map(sanitizeSnakeEndpoint).filter(Boolean) : [];
  if (endpoints.length < 2) return null;
  return {
    id: typeof connection.id === "string" ? connection.id : String(Date.now()),
    label: String(connection.label ?? ""),
    endpoints: endpoints.slice(0, 2),
    guidePoints: Array.isArray(connection.guidePoints) ? connection.guidePoints.map(sanitizePoint).filter(Boolean) : undefined,
    rawGuidePoints: Array.isArray(connection.rawGuidePoints) ? connection.rawGuidePoints.map(sanitizePoint).filter(Boolean) : undefined,
    importGroupId: typeof connection.importGroupId === "string" ? connection.importGroupId : null,
    targetLength: Math.max(0, Number(connection.targetLength || options.fallbackTargetLength || 200)),
    normalLeadLength: Math.max(0, Number(connection.normalLeadLength || options.fallbackNormalLeadLength || 0)),
  };
}
