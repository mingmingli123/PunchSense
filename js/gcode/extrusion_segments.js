export function createExtrusionSegmentWriter({
  g1,
  extrusion,
  materialFlow,
  restartRampMm,
}) {
  function addExtrusionSegment(lines, c, start, end, prime, flow, printHeight, material, feed, lineWidth = c.beadWidth) {
    const len = Math.hypot(end.x - start.x, end.y - start.y);
    if (len <= 0.001) return;
    const segmentFlow = materialFlow(c, material, flow);
    if (prime > 0.0001 && len > restartRampMm + 0.2) {
      const t = restartRampMm / len;
      const rampEnd = { x: start.x + (end.x - start.x) * t, y: start.y + (end.y - start.y) * t };
      lines.push(g1({
        x: rampEnd.x,
        y: rampEnd.y,
        e: prime + extrusion(restartRampMm, lineWidth, printHeight, segmentFlow),
        f: feed,
      }));
      lines.push(g1({
        x: end.x,
        y: end.y,
        e: extrusion(len - restartRampMm, lineWidth, printHeight, segmentFlow),
        f: feed,
      }));
      return;
    }
    lines.push(g1({
      x: end.x,
      y: end.y,
      e: prime + extrusion(len, lineWidth, printHeight, segmentFlow),
      f: feed,
    }));
  }

  function addExtrusionSegmentEvenPrime(lines, c, start, end, prime, flow, printHeight, material, feed, lineWidth = c.beadWidth) {
    const len = Math.hypot(end.x - start.x, end.y - start.y);
    if (len <= 0.001) return;
    lines.push(g1({
      x: end.x,
      y: end.y,
      e: prime + extrusion(len, lineWidth, printHeight, materialFlow(c, material, flow)),
      f: feed,
    }));
  }

  return {
    addExtrusionSegment,
    addExtrusionSegmentEvenPrime,
  };
}
