export function addExposedWhiteTpuReferenceFirstLayer({
  lines,
  c,
  z,
  firstLayerMaterial,
  constants,
  toolProfile,
  unionBounds,
  distance,
  clamp,
  g1,
  addRetractForTravel,
  addRetract,
  consumePrimeAmount,
  primeAtStart,
  rememberExtrusionSegment,
}) {
  const {
    RETRACT_Z_HOP_MM,
    PLA_REFERENCE_FIRST_LAYER_WIDTH,
    PLA_REFERENCE_BOTTOM_WIDTH,
    PLA_REFERENCE_BOTTOM_PITCH,
    PLA_REFERENCE_FIRST_LAYER_E_PER_MM,
    PLA_REFERENCE_WALL_FEED,
    PLA_REFERENCE_BOTTOM_FEED,
  } = constants;

  if (c.polygons.length === 0) return;
  const bounds = unionBounds(c.polygons);
  const x0 = bounds.x;
  const y0 = bounds.y;
  const x1 = bounds.x + bounds.w;
  const y1 = bounds.y + bounds.h;
  const innerInset = 0.335;
  const fillInset = 0.79;
  const ix0 = x0 + innerInset;
  const ix1 = x1 - innerInset;
  const iy0 = y0 + innerInset;
  const iy1 = y1 - innerInset;
  const fx0 = x0 + fillInset;
  const fx1 = x1 - fillInset;
  const fy0 = y0 + fillInset;
  const fy1 = y1 - fillInset;
  if (ix1 <= ix0 || iy1 <= iy0 || fx1 <= fx0 || fy1 <= fy0) return;

  lines.push(`; Begin layer 1 T${firstLayerMaterial} ${toolProfile(firstLayerMaterial, c).label} Object_1-style exposed base`);
  lines.push(";TYPE:Inner wall");
  lines.push(`;WIDTH:${PLA_REFERENCE_FIRST_LAYER_WIDTH.toFixed(3)}`);
  lines.push("; NOTE: Exposed white TPU base uses the Object_1_TPU_8m44s first-layer path style: inner/outer wall + diagonal bottom surface.");
  lines.push(`; NOTE: Reference bottom width ${PLA_REFERENCE_BOTTOM_WIDTH.toFixed(6)} mm, pitch ${PLA_REFERENCE_BOTTOM_PITCH.toFixed(4)} mm, measured E/mm ${PLA_REFERENCE_FIRST_LAYER_E_PER_MM.toFixed(5)}.`);
  lines.push(`; Full white TPU base bbox: X${x0.toFixed(3)}-${x1.toFixed(3)}, Y${y0.toFixed(3)}-${y1.toFixed(3)}`);

  const start = { x: ix1, y: iy1 };
  addRetractForTravel(lines, c, start, firstLayerMaterial);
  lines.push(g1({ x: start.x, y: start.y, z: z + RETRACT_Z_HOP_MM, f: 30000 }));
  lines.push(g1({ z, f: 30000 }));
  consumeReferencePrime(lines, c, firstLayerMaterial, consumePrimeAmount, primeAtStart);

  lines.push(`G1 F${PLA_REFERENCE_WALL_FEED}`);
  addReferenceEPolyline(lines, [
    start,
    { x: ix0, y: iy1 },
    { x: ix0, y: iy0 },
    { x: ix1, y: iy0 },
    { x: ix1, y: iy1 - 0.06 },
  ], PLA_REFERENCE_WALL_FEED, { distance, g1, rememberExtrusionSegment, ePerMm: PLA_REFERENCE_FIRST_LAYER_E_PER_MM });

  lines.push(";TYPE:Outer wall");
  const outerStart = { x: x1, y: y1 };
  lines.push(g1({ x: outerStart.x, y: outerStart.y, f: 30000 }));
  lines.push(`G1 F${PLA_REFERENCE_WALL_FEED}`);
  addReferenceEPolyline(lines, [
    outerStart,
    { x: x0, y: y1 },
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 - 0.06 },
  ], PLA_REFERENCE_WALL_FEED, { distance, g1, rememberExtrusionSegment, ePerMm: PLA_REFERENCE_FIRST_LAYER_E_PER_MM });

  addRetract(lines, c, firstLayerMaterial);
  const segments = diagonalFillSegments(fx0, fy0, fx1, fy1, PLA_REFERENCE_BOTTOM_PITCH, { distance, clamp });
  if (segments.length === 0) return;
  const first = segments[0][0];
  lines.push(g1({ x: first.x, y: first.y, z: z + RETRACT_Z_HOP_MM, f: 30000 }));
  lines.push(g1({ z, f: 30000 }));
  consumeReferencePrime(lines, c, firstLayerMaterial, consumePrimeAmount, primeAtStart);
  lines.push(";TYPE:Bottom surface");
  lines.push(`;WIDTH:${PLA_REFERENCE_BOTTOM_WIDTH.toFixed(6)}`);
  lines.push(`G1 F${PLA_REFERENCE_BOTTOM_FEED}`);
  let previous = first;
  for (let i = 0; i < segments.length; i += 1) {
    const segment = segments[i];
    const startPoint = i % 2 === 0 ? segment[0] : segment[1];
    const endPoint = i % 2 === 0 ? segment[1] : segment[0];
    if (distance(previous, startPoint) > 0.001) {
      addReferenceEMove(lines, previous, startPoint, PLA_REFERENCE_BOTTOM_FEED, { distance, g1, rememberExtrusionSegment, ePerMm: PLA_REFERENCE_FIRST_LAYER_E_PER_MM });
    }
    addReferenceEMove(lines, startPoint, endPoint, PLA_REFERENCE_BOTTOM_FEED, { distance, g1, rememberExtrusionSegment, ePerMm: PLA_REFERENCE_FIRST_LAYER_E_PER_MM });
    previous = endPoint;
  }
}

function consumeReferencePrime(lines, c, material, consumePrimeAmount, primeAtStart) {
  const prime = consumePrimeAmount(c, material);
  if (prime > 0.0001) primeAtStart(lines, c, material, prime);
}

function addReferenceEPolyline(lines, points, feed, deps) {
  for (let i = 1; i < points.length; i += 1) {
    addReferenceEMove(lines, points[i - 1], points[i], feed, deps);
  }
}

function addReferenceEMove(lines, start, end, feed, {
  distance,
  g1,
  rememberExtrusionSegment,
  ePerMm,
}) {
  const len = distance(start, end);
  if (len <= 0.001) return;
  lines.push(g1({
    x: end.x,
    y: end.y,
    e: len * ePerMm,
    f: feed,
  }));
  rememberExtrusionSegment(start, end, feed);
}

function diagonalFillSegments(x0, y0, x1, y1, pitch, deps) {
  const segments = [];
  for (let c = x1 - y0; c >= x0 - y1 - 1e-6; c -= pitch) {
    const segment = diagonalSegmentInRect(c, x0, y0, x1, y1, deps);
    if (segment) segments.push(segment);
  }
  return segments;
}

function diagonalSegmentInRect(c, x0, y0, x1, y1, { distance, clamp }) {
  const points = [];
  for (const x of [x0, x1]) {
    const y = x - c;
    if (y >= y0 - 1e-6 && y <= y1 + 1e-6) points.push({ x, y: clamp(y, y0, y1) });
  }
  for (const y of [y0, y1]) {
    const x = y + c;
    if (x >= x0 - 1e-6 && x <= x1 + 1e-6) points.push({ x: clamp(x, x0, x1), y });
  }
  const unique = [];
  for (const point of points) {
    if (!unique.some((candidate) => distance(candidate, point) < 0.001)) unique.push(point);
  }
  if (unique.length < 2) return null;
  unique.sort((a, b) => (a.x - b.x) || (a.y - b.y));
  return [unique[0], unique[unique.length - 1]];
}
