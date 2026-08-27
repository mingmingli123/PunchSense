export function createT0PathWriter(deps) {
  const {
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
  } = deps;

  const {
    TPU_SERPENTINE_PRIME_RAMP_MM,
    TPU_SERPENTINE_PREPRIME_MM,
    TPU_TOWER_SERPENTINE_PRIME_RAMP_MM,
    TPU_TOWER_SERPENTINE_PREPRIME_MM,
    TPU_SINGLE_LAYER_SERPENTINE_FLOW,
    TPU_SINGLE_LAYER_SERPENTINE_PREPRIME_MM,
    TPU_SINGLE_LAYER_SERPENTINE_PRIME_RAMP_MM,
    TPU_GRID_PRIME_RAMP_MM,
    TPU_GRID_PREPRIME_MM,
  } = constants;

  function addT0GridLine(lines, c, start, end, z, flow, printHeight = c.layerHeight, material = c.tool) {
    const feed = materialFeedrate(c, material);
    addRetractForTravel(lines, c, start, material);
    lines.push(g1({ x: start.x, y: start.y, f: 30000 }));
    lines.push(g1({ z, f: 30000 }));

    let prime = consumePrimeAmount(c, material);
    const prePrime = Math.min(prime, TPU_GRID_PREPRIME_MM);
    if (prePrime > 0.0001) {
      lines.push(`; T0_GRID_PREPRIME ${prePrime.toFixed(3)}mm`);
      primeAtStart(lines, c, material, prePrime);
      prime -= prePrime;
    }

    const len = Math.hypot(end.x - start.x, end.y - start.y);
    const primeRampLength = prime > 0.0001
      ? Math.min(TPU_GRID_PRIME_RAMP_MM, Math.max(1, len))
      : 0;
    if (prime > 0.0001) {
      lines.push(`; T0_GRID_LEAD_IN_PRIME ${prime.toFixed(3)}mm over ${primeRampLength.toFixed(1)}mm`);
    }
    if (prime > 0.0001 && len > primeRampLength + 0.2) {
      const t = primeRampLength / len;
      const rampEnd = {
        x: start.x + (end.x - start.x) * t,
        y: start.y + (end.y - start.y) * t,
      };
      addExtrusionSegmentEvenPrime(lines, c, start, rampEnd, prime, flow, printHeight, material, feed);
      addExtrusionSegment(lines, c, rampEnd, end, 0, flow, printHeight, material, feed);
    } else if (prime > 0.0001) {
      addExtrusionSegmentEvenPrime(lines, c, start, end, prime, flow, printHeight, material, feed);
    } else {
      addExtrusionSegment(lines, c, start, end, 0, flow, printHeight, material, feed);
    }
    rememberExtrusionSegment(start, end, feed);
  }

  function addT0SerpentinePolyline(lines, c, points, z, flow, printHeight = c.layerHeight) {
    points = roundedPrintablePolyline(orthogonalizePrintablePolyline(points));
    if (points.length < 2) return;
    const printPaths = printableTpuSnakePaths(points, c);
    if (printPaths.length > 1) {
      lines.push(`; T0_SERPENTINE_PRINT_STRANDS ${printPaths.length} lanes from one centerline, spacing ${c.beadWidth.toFixed(3)}mm`);
    }
    printPaths.forEach((path, index) => {
      if (printPaths.length > 1) lines.push(`; T0_SERPENTINE_PRINT_STRAND ${index + 1}/${printPaths.length}`);
      addT0SerpentinePrintPath(lines, c, path, z, flow, printHeight);
    });
  }

  function addT0SerpentinePrintPath(lines, c, points, z, flow, printHeight = c.layerHeight) {
    points = roundedPrintablePolyline(orthogonalizePrintablePolyline(points));
    if (points.length < 2) return;
    const material = 0;
    const feed = materialFeedrate(c, material);
    const lineWidth = Number(c.beadWidth ?? 0.4);
    const singleLayerSnake = c.tpuSnakeEnabled && Math.max(0, Number(c.tpuSnakeLayerCount ?? 0)) <= 1;
    const serpentineFlow = singleLayerSnake ? Math.max(flow, TPU_SINGLE_LAYER_SERPENTINE_FLOW) : flow;
    lines.push(`;WIDTH:${lineWidth.toFixed(3)} ; T0 serpentine print strand width`);
    addRetractForTravel(lines, c, points[0], material);
    const towerRestart = getRetractionState().isRetracted && getRetractionState().source === "tower";
    const serpentinePrePrime = towerRestart
      ? TPU_TOWER_SERPENTINE_PREPRIME_MM
      : singleLayerSnake ? TPU_SINGLE_LAYER_SERPENTINE_PREPRIME_MM : TPU_SERPENTINE_PREPRIME_MM;
    const serpentinePrimeRamp = towerRestart
      ? TPU_TOWER_SERPENTINE_PRIME_RAMP_MM
      : singleLayerSnake ? TPU_SINGLE_LAYER_SERPENTINE_PRIME_RAMP_MM : TPU_SERPENTINE_PRIME_RAMP_MM;
    lines.push(g1({ x: points[0].x, y: points[0].y, f: 30000 }));
    lines.push(g1({ z, f: 30000 }));

    let prime = consumePrimeAmount(c, material);
    const prePrime = Math.min(prime, serpentinePrePrime);
    if (prePrime > 0.0001) {
      lines.push(`; T0_SERPENTINE_PREPRIME ${prePrime.toFixed(3)}mm`);
      primeAtStart(lines, c, material, prePrime);
      prime -= prePrime;
    }
    const pathLength = polylineLength(points);
    const primeRampLength = prime > 0
      ? Math.min(serpentinePrimeRamp, Math.max(1, pathLength))
      : 0;
    let primeRampRemaining = primeRampLength;
    if (prime > 0.0001) {
      lines.push(`; T0_SERPENTINE_LEAD_IN_PRIME ${prime.toFixed(3)}mm over ${primeRampLength.toFixed(1)}mm`);
    }
    if (singleLayerSnake) {
      lines.push(`; T0_SINGLE_LAYER_SERPENTINE_REINFORCE flow ${serpentineFlow.toFixed(3)}, preprime ${serpentinePrePrime.toFixed(2)}mm, ramp ${serpentinePrimeRamp.toFixed(1)}mm`);
    }
    if (towerRestart) {
      lines.push(`; T0_TOWER_RESTART_SERPENTINE_SMOOTHING preprime ${serpentinePrePrime.toFixed(2)}mm, ramp ${serpentinePrimeRamp.toFixed(1)}mm`);
    }

    for (let i = 1; i < points.length; i += 1) {
      const len = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
      if (len <= 0.001) continue;
      const primeShare = primeRampRemaining > 0
        ? prime * (Math.min(len, primeRampRemaining) / primeRampLength)
        : 0;
      if (primeShare > 0) addExtrusionSegmentEvenPrime(lines, c, points[i - 1], points[i], primeShare, serpentineFlow, printHeight, material, feed, lineWidth);
      else addExtrusionSegment(lines, c, points[i - 1], points[i], 0, serpentineFlow, printHeight, material, feed, lineWidth);
      prime -= primeShare;
      primeRampRemaining = Math.max(0, primeRampRemaining - len);
      rememberExtrusionSegment(points[i - 1], points[i], feed);
    }
  }

  return {
    addT0GridLine,
    addT0SerpentinePolyline,
  };
}
