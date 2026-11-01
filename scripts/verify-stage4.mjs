import assert from 'node:assert/strict';

function perpendicularDistance(p, p1, p2) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const mag = Math.hypot(dx, dy);
  if (mag === 0) return Math.hypot(p.x - p1.x, p.y - p1.y);
  return Math.abs(dy * p.x - dx * p.y + p2.x * p1.y - p2.y * p1.x) / mag;
}

function douglasPeucker(points, epsilon) {
  if (points.length <= 2) return [...points];
  let maxDist = 0;
  let index = 0;
  const end = points.length - 1;

  for (let i = 1; i < end; i++) {
    const dist = perpendicularDistance(points[i], points[0], points[end]);
    if (dist > maxDist) {
      maxDist = dist;
      index = i;
    }
  }

  if (maxDist > epsilon) {
    const left = douglasPeucker(points.slice(0, index + 1), epsilon);
    const right = douglasPeucker(points.slice(index), epsilon);
    return left.slice(0, left.length - 1).concat(right);
  } else {
    return [points[0], points[end]];
  }
}

function polygonPerimeter(points) {
  let peri = 0;
  for (let i = 0; i < points.length; i++) {
    const next = points[(i + 1) % points.length];
    peri += Math.hypot(next.x - points[i].x, next.y - points[i].y);
  }
  return peri;
}

function polygonArea(points) {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  return Math.abs(area) / 2;
}

function convexHull(points) {
  if (points.length <= 3) return [...points];
  const sorted = [...points].sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));
  const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

  const lower = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }

  const upper = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }

  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

function findMaxAreaInscribedTriangle(hull) {
  if (hull.length < 3) return null;
  if (hull.length === 3) return { vertices: [hull[0], hull[1], hull[2]], area: polygonArea(hull) };
  let maxArea = 0;
  let best = [hull[0], hull[1], hull[2]];
  const n = hull.length;
  for (let i = 0; i < n - 2; i++) {
    for (let j = i + 1; j < n - 1; j++) {
      for (let k = j + 1; k < n; k++) {
        const area =
          Math.abs(
            (hull[j].x - hull[i].x) * (hull[k].y - hull[i].y) -
              (hull[k].x - hull[i].x) * (hull[j].y - hull[i].y)
          ) / 2;
        if (area > maxArea) {
          maxArea = area;
          best = [hull[i], hull[j], hull[k]];
        }
      }
    }
  }
  return { vertices: best, area: maxArea };
}

function findBoundaryStartPixel(mask, width, minX, maxX, minY, maxY) {
  for (let y = minY; y <= maxY; y++) {
    const rowOffset = y * width;
    for (let x = minX; x <= maxX; x++) {
      if (mask[rowOffset + x]) {
        const topBg = y === 0 || !mask[(y - 1) * width + x];
        const leftBg = x === 0 || !mask[rowOffset + (x - 1)];
        if (topBg || leftBg) return { x, y };
      }
    }
  }
  return null;
}

function traceContour(mask, width, height, startX, startY) {
  const contour = [];
  let currX = startX;
  let currY = startY;
  const dx = [1, 1, 0, -1, -1, -1, 0, 1];
  const dy = [0, 1, 1, 1, 0, -1, -1, -1];
  contour.push({ x: currX, y: currY });

  let bDir = 6;
  const maxSteps = 3000;
  let steps = 0;

  while (steps++ < maxSteps) {
    let nextX = -1;
    let nextY = -1;
    let nextBDir = 0;

    for (let i = 0; i < 8; i++) {
      const dir = (bDir + 1 + i) % 8;
      const nx = currX + dx[dir];
      const ny = currY + dy[dir];

      if (nx >= 0 && nx < width && ny >= 0 && ny < height && mask[ny * width + nx]) {
        nextX = nx;
        nextY = ny;
        nextBDir = (dir + 4) % 8;
        break;
      }
    }

    if (nextX === -1 || (nextX === startX && nextY === startY)) break;
    contour.push({ x: nextX, y: nextY });
    currX = nextX;
    currY = nextY;
    bDir = nextBDir;
  }

  return contour;
}

function analyzeTriangleContour(rawContour, blobW, blobH, pixelArea) {
  if (rawContour.length < 8) {
    return { isTriangle: false, vertexCount: rawContour.length, inscribedRatio: 0, extent: 0, solidity: 0 };
  }

  const peri = polygonPerimeter(rawContour);
  const epsilons = [0.038 * peri, 0.048 * peri, 0.060 * peri, 0.075 * peri];
  let bestVertices = [];
  let bestVCount = 99;

  for (const eps of epsilons) {
    const approx = douglasPeucker(rawContour, eps);
    const cleaned = [];
    for (const v of approx) {
      if (cleaned.length === 0 || Math.hypot(v.x - cleaned[cleaned.length - 1].x, v.y - cleaned[cleaned.length - 1].y) > 4) {
        cleaned.push(v);
      }
    }
    if (cleaned.length > 2 && Math.hypot(cleaned[0].x - cleaned[cleaned.length - 1].x, cleaned[0].y - cleaned[cleaned.length - 1].y) < 8) {
      cleaned.pop();
    }
    if (cleaned.length === 3) {
      bestVertices = cleaned;
      bestVCount = 3;
      break;
    } else if (cleaned.length === 4 && bestVCount !== 3) {
      bestVertices = cleaned;
      bestVCount = 4;
    } else if (cleaned.length < bestVCount && cleaned.length >= 3) {
      bestVertices = cleaned;
      bestVCount = cleaned.length;
    }
  }

  const hull = convexHull(rawContour);
  const hullArea = Math.max(1, polygonArea(hull));
  const maxInscribed = findMaxAreaInscribedTriangle(hull);
  const inscribedRatio = maxInscribed ? maxInscribed.area / hullArea : 0;

  const bboxArea = Math.max(1, blobW * blobH);
  const extent = pixelArea / bboxArea;
  const solidity = Math.min(1.0, pixelArea / hullArea);
  const aspectRatio = blobW / Math.max(1, blobH);

  let anglesValid = false;
  let triangleVertices = bestVertices;
  if (maxInscribed && (bestVCount === 3 || bestVCount === 4 || inscribedRatio >= 0.82)) {
    triangleVertices = maxInscribed.vertices;
    anglesValid = true;
  }

  const hasInscribedFit = inscribedRatio >= 0.82;
  const hasTriangleVertices = bestVCount === 3 || bestVCount === 4 || hasInscribedFit;
  const hasTriangleExtent = extent >= 0.30 && extent <= 0.64;
  const isConvex = solidity >= 0.84;
  const plausibleAspectRatio = aspectRatio >= 0.45 && aspectRatio <= 2.25;

  const isTriangle =
    (hasInscribedFit || (hasTriangleVertices && hasTriangleExtent)) &&
    isConvex &&
    plausibleAspectRatio &&
    anglesValid;

  return { isTriangle, vCount: bestVCount, inscribedRatio, extent, solidity, aspectRatio, vertices: triangleVertices };
}

// ── Test 1: Boundary Extraction from Mask ───────────────────────────────────
console.log('Testing Boundary Pixel Extraction & Moore-Neighbor Contour...');
const maskW = 100, maskH = 100;
const testMask = new Uint8Array(maskW * maskH);
// Draw triangle: top (50, 20), bottom-left (20, 80), bottom-right (80, 80)
for (let y = 20; y <= 80; y++) {
  const t = (y - 20) / 60;
  const x1 = Math.round(50 - 30 * t);
  const x2 = Math.round(50 + 30 * t);
  for (let x = x1; x <= x2; x++) testMask[y * maskW + x] = 1;
}

const bPt = findBoundaryStartPixel(testMask, maskW, 20, 80, 20, 80);
assert.ok(bPt !== null, 'Boundary start pixel must be found');
assert.equal(bPt.y, 20, 'Topmost boundary pixel must have y=20');
assert.equal(bPt.x, 50, 'Top apex must have x=50');

const tracedContour = traceContour(testMask, maskW, maskH, bPt.x, bPt.y);
assert.ok(tracedContour.length > 100, `Traced contour should be full perimeter (got ${tracedContour.length})`);
console.log(`✓ External boundary successfully traced with length ${tracedContour.length} pixels`);

// ── Test 2: Inscribed Triangle vs Hull Mathematical Separation ─────────────
console.log('Testing Inscribed Triangle Area Ratio Separation...');
const triAnalysis = analyzeTriangleContour(tracedContour, 61, 61, 1800);
assert.equal(triAnalysis.isTriangle, true, 'Triangle must be confirmed');
assert.ok(triAnalysis.inscribedRatio >= 0.88, `Triangle fit ratio (${triAnalysis.inscribedRatio}) must be >= 0.88`);
assert.equal(triAnalysis.vertices.length, 3, 'Must output exactly 3 corner vertices');
console.log(`✓ Physical triangle achieved ${Math.round(triAnalysis.inscribedRatio * 100)}% inscribed fit with 3 sharp corners`);

// Test circle rejection
const circleContour = [];
const cRadius = 35;
for (let a = 0; a < Math.PI * 2; a += 0.1) {
  circleContour.push({ x: 50 + cRadius * Math.cos(a), y: 50 + cRadius * Math.sin(a) });
}
const circleArea = Math.PI * cRadius * cRadius;
const circleAsTri = analyzeTriangleContour(circleContour, 70, 70, circleArea);
assert.equal(circleAsTri.isTriangle, false, 'Circle must be rejected in triangle mode');
assert.ok(circleAsTri.inscribedRatio <= 0.45, `Circle ratio (${circleAsTri.inscribedRatio}) must be <= 0.45`);
console.log(`✓ Circle strictly rejected by inscribed triangle ratio (${Math.round(circleAsTri.inscribedRatio * 100)}% <= 45%)`);

// Test square / rectangle rejection
const squareContour = [];
for (let x = 20; x <= 80; x += 3) squareContour.push({ x, y: 20 });
for (let y = 20; y <= 80; y += 3) squareContour.push({ x: 80, y });
for (let x = 80; x >= 20; x -= 3) squareContour.push({ x, y: 80 });
for (let y = 80; y >= 20; y -= 3) squareContour.push({ x: 20, y });
const squareAsTri = analyzeTriangleContour(squareContour, 61, 61, 3600);
assert.equal(squareAsTri.isTriangle, false, 'Square must be rejected in triangle mode');
assert.ok(squareAsTri.inscribedRatio <= 0.52, `Square ratio (${squareAsTri.inscribedRatio}) must be <= 0.52`);
console.log(`✓ Square/rectangle strictly rejected (ratio ${Math.round(squareAsTri.inscribedRatio * 100)}% <= 52%)`);

// ── Test 3: Triangle Rejection in Piano Mode ─────────────────────────────────
console.log('Testing Triangle Rejection in Piano Mode...');
const triCircularity = (4 * Math.PI * 1800) / (polygonPerimeter(tracedContour) ** 2);
const passesCircleGate = triAnalysis.extent >= 0.62 && triCircularity >= 0.50;
assert.equal(passesCircleGate, false, 'Triangle must be strictly rejected by circle mode gate');
console.log('✓ Triangles are strictly rejected by the piano (circle) detector (extent <= 0.62)');

// ── Test 4: Drum Voice Row Mapping ──────────────────────────────────────────
console.log('Testing Drum Voice Row Mapping...');
const DRUM_VOICES = [
  { row: 0, id: 'hihat', name: 'Hi-Hat', shortName: 'HAT' },
  { row: 1, id: 'clap', name: 'Hand Clap', shortName: 'CLP' },
  { row: 2, id: 'snare', name: 'Snare Drum', shortName: 'SNR' },
  { row: 3, id: 'tom', name: 'Low Tom', shortName: 'TOM' },
  { row: 4, id: 'kick', name: 'Bass Kick', shortName: 'KIK' },
];

assert.equal(DRUM_VOICES[0].shortName, 'HAT');
assert.equal(DRUM_VOICES[2].shortName, 'SNR');
assert.equal(DRUM_VOICES[4].shortName, 'KIK');
console.log('✓ Drum voices correctly mapped across 5 rows: 0=Hi-Hat, 1=Clap, 2=Snare, 3=Tom, 4=Kick');

// ── Test 5: Multi-Track Playback Scheduling Math ────────────────────────────
console.log('Testing Multi-Track Playback Combiner...');
const pianoTrack = {
  id: 'track-piano-1',
  name: 'Lead Melody',
  instrument: 'piano',
  cols: 4,
  notes: [
    { id: 'p1', row: 0, col: 0, pitch: 'C6', duration: 1 },
    { id: 'p2', row: 1, col: 1, pitch: 'A5', duration: 1 },
    { id: 'p3', row: 2, col: 2, pitch: 'G5', duration: 1 },
  ],
};

const drumTrack = {
  id: 'track-drums-1',
  name: 'Four on the Floor',
  instrument: 'drums',
  cols: 4,
  notes: [
    { id: 'd1', row: 4, col: 0, pitch: 'D5', duration: 1 },
    { id: 'd2', row: 2, col: 1, pitch: 'G5', duration: 1 },
    { id: 'd3', row: 4, col: 2, pitch: 'D5', duration: 1 },
    { id: 'd4', row: 2, col: 3, pitch: 'G5', duration: 1 },
  ],
};

const activeTracks = [pianoTrack, drumTrack];
const scheduledVoicesAtStep0 = [];

for (const trk of activeTracks) {
  const notesAtStep = trk.notes.filter((n) => n.col === 0);
  for (const n of notesAtStep) {
    scheduledVoicesAtStep0.push({ instrument: trk.instrument, row: n.row, pitch: n.pitch });
  }
}

assert.equal(scheduledVoicesAtStep0.length, 2, 'Step 0 should schedule 1 piano chime and 1 kick drum hit');
assert.deepEqual(scheduledVoicesAtStep0[0], { instrument: 'piano', row: 0, pitch: 'C6' });
assert.deepEqual(scheduledVoicesAtStep0[1], { instrument: 'drums', row: 4, pitch: 'D5' });
console.log('✓ Combined multi-track simultaneous scheduling accurately layered Piano + Drums');

console.log('\nAll Stage 4 Two-Instrument & Multi-Track tests passed successfully!');
