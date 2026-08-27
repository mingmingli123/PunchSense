import { createExtrusionSegmentWriter } from "./extrusion_segments.js";
import { createT0PathWriter } from "./t0_path_writer.js";

export function createMotionWriter(deps) {
  const {
    toolForMaterial,
    toolRetractLength,
    toolRetractSpeed,
    toolDeretractSpeed,
    materialFeedrate,
    materialFlow,
    extrusion,
    polylineLength,
    distance,
    wipeTowerRect,
    roundedPrintablePolyline,
    orthogonalizePrintablePolyline,
    printableTpuSnakePaths,
    constants,
  } = deps;

  const {
    RETRACT_Z_HOP_MM,
    RESTART_RAMP_MM,
    TPU_PRIME_RAMP_MM,
    TPU_BODY_PRIME_RAMP_MM,
  } = constants;

  let activeGcodeConfig = null;
  let extrusionIsRetracted = false;
  let lastRetractSource = null;
  let lastExtrusionSegment = null;
  let recentExtrusionPath = [];

  function setActiveGcodeConfig(c) {
    const previous = activeGcodeConfig;
    activeGcodeConfig = c;
    return previous;
  }

  function restoreActiveGcodeConfig(previous) {
    activeGcodeConfig = previous;
  }

  function resetExtrusionState() {
    extrusionIsRetracted = false;
    lastRetractSource = null;
    lastExtrusionSegment = null;
    recentExtrusionPath = [];
  }

  function markExtrusionRetracted(source = null) {
    extrusionIsRetracted = true;
    lastRetractSource = source;
  }

  function markExtrusionUnretracted() {
    extrusionIsRetracted = false;
    lastRetractSource = null;
  }

  function getRetractionState() {
    return {
      isRetracted: extrusionIsRetracted,
      source: lastRetractSource,
    };
  }

  function g1({ x, y, z, e, f }) {
    const parts = ["G1"];
    if (x !== undefined) parts.push(`X${x.toFixed(3)}`);
    if (y !== undefined) parts.push(`Y${gcodeOutputY(y).toFixed(3)}`);
    if (z !== undefined) parts.push(`Z${z.toFixed(3)}`);
    if (e !== undefined) parts.push(`E${e.toFixed(5)}`);
    if (f !== undefined) parts.push(`F${Math.round(f)}`);
    return parts.join(" ");
  }

  function gcodeOutputY(y) {
    return activeGcodeConfig ? activeGcodeConfig.bedDepth - y : y;
  }

  function addLine(lines, c, start, end, z, flow, printHeight = c.layerHeight, material = c.tool) {
    const feed = materialFeedrate(c, material);
    addRetractForTravel(lines, c, start, material);
    lines.push(g1({ x: start.x, y: start.y, f: 30000 }));
    lines.push(g1({ z, f: 30000 }));
    const prime = consumePrimeAmount(c, material);
    if (toolForMaterial(material) === 0 && prime > 0.0001) {
      addExtrusionSegmentEvenPrime(lines, c, start, end, prime, flow, printHeight, material, feed);
    } else {
      if (prime > 0.0001) primeAtStart(lines, c, material, prime);
      addExtrusionSegment(lines, c, start, end, 0, flow, printHeight, material, feed);
    }
    rememberExtrusionSegment(start, end, feed);
  }

  function addPolyline(lines, c, points, z, flow, printHeight = c.layerHeight, material = c.tool) {
    if (points.length < 2) return;
    const feed = materialFeedrate(c, material);
    addRetractForTravel(lines, c, points[0], material);
    lines.push(g1({ x: points[0].x, y: points[0].y, f: 30000 }));
    lines.push(g1({ z, f: 30000 }));
    const t0BodyRestart = toolForMaterial(material) === 0 && extrusionIsRetracted && lastRetractSource === "body";
    let prime = consumePrimeAmount(c, material);
    const pathLength = polylineLength(points);
    const primeRampLength = toolForMaterial(material) === 0 && prime > 0
      ? Math.min(t0BodyRestart ? TPU_BODY_PRIME_RAMP_MM : TPU_PRIME_RAMP_MM, Math.max(1, pathLength))
      : 0;
    let primeRampRemaining = primeRampLength;
    if (prime > 0 && primeRampRemaining <= 0) {
      primeAtStart(lines, c, material, prime);
      prime = 0;
    }
    for (let i = 1; i < points.length; i += 1) {
      const len = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
      if (len <= 0.001) continue;
      const primeShare = primeRampRemaining > 0
        ? prime * (Math.min(len, primeRampRemaining) / primeRampLength)
        : 0;
      if (primeShare > 0) addExtrusionSegmentEvenPrime(lines, c, points[i - 1], points[i], primeShare, flow, printHeight, material, feed);
      else addExtrusionSegment(lines, c, points[i - 1], points[i], 0, flow, printHeight, material, feed);
      prime -= primeShare;
      primeRampRemaining = Math.max(0, primeRampRemaining - len);
      rememberExtrusionSegment(points[i - 1], points[i], feed);
    }
  }

  const { addExtrusionSegment, addExtrusionSegmentEvenPrime } = createExtrusionSegmentWriter({
    g1,
    extrusion,
    materialFlow,
    restartRampMm: RESTART_RAMP_MM,
  });

  function addRetract(lines, c, material) {
    if (extrusionIsRetracted) return;
    const tool = toolForMaterial(material ?? c.tool);
    const totalRetract = toolRetractLength(tool, c);
    lastRetractSource = lastExtrusionSegment && pointInWipeTower(lastExtrusionSegment.end, c) ? "tower" : "body";
    const wipeRetract = tool === 0 ? 0 : lastExtrusionSegment ? Math.min(totalRetract * 0.5, totalRetract) : 0;
    const directRetract = totalRetract - wipeRetract;
    if (directRetract > 0.0001) {
      lines.push(`G1 E-${directRetract.toFixed(5)} F${Math.round(toolRetractSpeed(tool, c) * 60)}`);
    }
    if (wipeRetract > 0.0001) addReferenceWipe(lines, wipeRetract);
    lines.push("G91");
    lines.push(g1({ z: RETRACT_Z_HOP_MM, f: 1800 }));
    lines.push("G90");
    extrusionIsRetracted = true;
  }

  function addRetractForTravel(lines, c, start, material) {
    if (canContinueWithoutRetract(c, start, material)) return;
    addRetract(lines, c, material);
  }

  function canContinueWithoutRetract(c, start, material) {
    if (extrusionIsRetracted || !lastExtrusionSegment) return false;
    const tool = toolForMaterial(material ?? c.tool);
    const distanceToStart = Math.hypot(lastExtrusionSegment.end.x - start.x, lastExtrusionSegment.end.y - start.y);
    if (tool === 0) {
      if (pointInWipeTower(lastExtrusionSegment.end, c)) return false;
      const t0ContinuousTravel = Math.max(c.pitch * 1.25, c.beadWidth * 6);
      return distanceToStart <= t0ContinuousTravel;
    }
    const threshold = Math.min(8, Math.max(c.pitch * 1.5, c.beadWidth * 6));
    return distanceToStart <= threshold;
  }

  function pointInWipeTower(point, c) {
    const tower = wipeTowerRect(c);
    const margin = Math.max(2, c.beadWidth * 4);
    return point.x >= tower.x - margin
      && point.x <= tower.x + tower.w + margin
      && point.y >= tower.y - margin
      && point.y <= tower.y + tower.h + margin;
  }

  function consumePrimeAmount(c, material) {
    if (!extrusionIsRetracted) return 0;
    const tool = toolForMaterial(material ?? c.tool);
    extrusionIsRetracted = false;
    lastRetractSource = null;
    return toolRetractLength(tool, c);
  }

  function primeAtStart(lines, c, material, prime) {
    const tool = toolForMaterial(material ?? c.tool);
    lines.push(g1({
      e: prime,
      f: toolDeretractSpeed(tool, c) * 60,
    }));
  }

  function rememberExtrusionSegment(start, end, feed) {
    const len = Math.hypot(end.x - start.x, end.y - start.y);
    if (len <= 0.001) return;
    lastExtrusionSegment = {
      start: { x: start.x, y: start.y },
      end: { x: end.x, y: end.y },
      feed,
      len,
    };
    if (recentExtrusionPath.length === 0) recentExtrusionPath.push({ x: start.x, y: start.y });
    const last = recentExtrusionPath[recentExtrusionPath.length - 1];
    if (!last || Math.hypot(last.x - start.x, last.y - start.y) > 0.001) {
      recentExtrusionPath.push({ x: start.x, y: start.y });
    }
    recentExtrusionPath.push({ x: end.x, y: end.y });
    if (recentExtrusionPath.length > 60) recentExtrusionPath = recentExtrusionPath.slice(-60);
  }

  function addReferenceWipe(lines, retractAmount) {
    if (!lastExtrusionSegment || recentExtrusionPath.length < 2) return;
    const wipeMoves = referenceWipeMoves(8);
    if (wipeMoves.length === 0) return;
    const totalLength = wipeMoves.reduce((sum, move) => sum + move.length, 0);
    if (totalLength <= 0.001) return;
    lines.push(";WIPE_START");
    lines.push(`G1 F${Math.round(lastExtrusionSegment.feed)}`);
    for (const move of wipeMoves) {
      lines.push(g1({
        x: move.point.x,
        y: move.point.y,
        e: -retractAmount * (move.length / totalLength),
      }));
    }
    lines.push(";WIPE_END");
  }

  function referenceWipeMoves(targetLength) {
    const moves = [];
    let remaining = targetLength;
    for (let i = recentExtrusionPath.length - 1; i > 0 && remaining > 0.001; i -= 1) {
      const from = recentExtrusionPath[i];
      const to = recentExtrusionPath[i - 1];
      const len = Math.hypot(from.x - to.x, from.y - to.y);
      if (len <= 0.001) continue;
      const take = Math.min(len, remaining);
      const ratio = take / len;
      moves.push({
        point: {
          x: from.x + (to.x - from.x) * ratio,
          y: from.y + (to.y - from.y) * ratio,
        },
        length: take,
      });
      remaining -= take;
    }
    return moves;
  }

  const { addT0GridLine, addT0SerpentinePolyline } = createT0PathWriter({
    materialFeedrate,
    polylineLength,
    roundedPrintablePolyline,
    orthogonalizePrintablePolyline,
    printableTpuSnakePaths,
    g1,
    addRetractForTravel,
    consumePrimeAmount,
    primeAtStart,
    rememberExtrusionSegment,
    addExtrusionSegment,
    addExtrusionSegmentEvenPrime,
    getRetractionState,
    constants,
  });

  return {
    setActiveGcodeConfig,
    restoreActiveGcodeConfig,
    resetExtrusionState,
    markExtrusionRetracted,
    markExtrusionUnretracted,
    g1,
    addLine,
    addT0GridLine,
    addPolyline,
    addT0SerpentinePolyline,
    addRetract,
    addRetractForTravel,
    consumePrimeAmount,
    primeAtStart,
    rememberExtrusionSegment,
  };
}
