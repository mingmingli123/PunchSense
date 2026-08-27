import {
  polygonBounds,
} from "../core/geometry.js";
import {
  shapeToPolygon,
} from "../shape_geometry.js";

export function createMoveSnapModel({
  state,
  selectedShapesBounds,
}) {
  function computeMoveSnap(indices, c, thresholdMm) {
    const moving = new Set(indices);
    const bounds = selectedShapesBounds(indices);
    const xSources = snapAxisSources(bounds, "x");
    const ySources = snapAxisSources(bounds, "y");
    const xTargets = snapAxisTargets("x", moving, c);
    const yTargets = snapAxisTargets("y", moving, c);
    const xSnap = nearestSnapDelta(xSources, xTargets, thresholdMm);
    const ySnap = nearestSnapDelta(ySources, yTargets, thresholdMm);
    const guides = [];
    if (xSnap) guides.push({ axis: "x", value: xSnap.target });
    if (ySnap) guides.push({ axis: "y", value: ySnap.target });
    return {
      dx: xSnap ? xSnap.delta : 0,
      dy: ySnap ? ySnap.delta : 0,
      guides,
    };
  }

  function snapAxisTargets(axis, moving, c) {
    const bedBounds = { x: 0, y: 0, w: c.bedWidth, h: c.bedDepth };
    const targets = snapAxisSources(bedBounds, axis).map((target) => ({ ...target, source: "bed" }));
    state.shapes.forEach((shape, index) => {
      if (moving.has(index)) return;
      const bounds = polygonBounds(shapeToPolygon(shape));
      targets.push(...snapAxisSources(bounds, axis).map((target) => ({ ...target, source: "shape", shapeIndex: index })));
    });
    return targets;
  }

  return {
    computeMoveSnap,
  };
}

function snapAxisSources(bounds, axis) {
  if (axis === "x") {
    return [
      { value: bounds.x, kind: "min" },
      { value: bounds.x + bounds.w / 2, kind: "center" },
      { value: bounds.x + bounds.w, kind: "max" },
    ];
  }
  return [
    { value: bounds.y, kind: "min" },
    { value: bounds.y + bounds.h / 2, kind: "center" },
    { value: bounds.y + bounds.h, kind: "max" },
  ];
}

function nearestSnapDelta(sources, targets, thresholdMm) {
  let best = null;
  for (const source of sources) {
    for (const target of targets) {
      const delta = target.value - source.value;
      const abs = Math.abs(delta);
      if (abs > thresholdMm) continue;
      if (!best || abs < best.abs) best = { delta, target: target.value, abs };
    }
  }
  return best;
}
