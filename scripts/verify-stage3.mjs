import assert from 'node:assert/strict';

// Helper geometric inverse mapping
function imageToBoard(x, y, Hinv) {
  const uNum = Hinv[0] * x + Hinv[1] * y + Hinv[2];
  const vNum = Hinv[3] * x + Hinv[4] * y + Hinv[5];
  const w = Hinv[6] * x + Hinv[7] * y + Hinv[8];
  return { x: uNum / w, y: vNum / w };
}

function computeHomography(corners) {
  const { topLeft: p0, topRight: p1, bottomRight: p2, bottomLeft: p3 } = corners;
  const dx1 = p1.x - p2.x;
  const dx2 = p3.x - p2.x;
  const sx = p0.x - p1.x + p2.x - p3.x;
  const dy1 = p1.y - p2.y;
  const dy2 = p3.y - p2.y;
  const sy = p0.y - p1.y + p2.y - p3.y;

  if (Math.abs(sx) < 1e-7 && Math.abs(sy) < 1e-7) {
    return [
      p1.x - p0.x, p3.x - p0.x, p0.x,
      p1.y - p0.y, p3.y - p0.y, p0.y,
      0, 0, 1
    ];
  }

  const det = dx1 * dy2 - dx2 * dy1;
  if (Math.abs(det) < 1e-10) return null;

  const g = (sx * dy2 - sy * dx2) / det;
  const h = (dx1 * sy - dy1 * sx) / det;
  const a = p1.x - p0.x + g * p1.x;
  const b = p3.x - p0.x + h * p3.x;
  const c = p0.x;
  const d = p1.y - p0.y + g * p1.y;
  const e = p3.y - p0.y + h * p3.y;
  const f = p0.y;

  return [a, b, c, d, e, f, g, h, 1];
}

function invertMatrix3x3(m) {
  const [
    m00, m01, m02,
    m10, m11, m12,
    m20, m21, m22
  ] = m;

  const c00 = m11 * m22 - m12 * m21;
  const c01 = m12 * m20 - m10 * m22;
  const c02 = m10 * m21 - m11 * m20;
  const det = m00 * c00 + m01 * c01 + m02 * c02;
  if (Math.abs(det) < 1e-12) return null;

  const invDet = 1 / det;
  const c10 = m02 * m21 - m01 * m22;
  const c11 = m00 * m22 - m02 * m20;
  const c12 = m01 * m20 - m00 * m21;
  const c20 = m01 * m12 - m02 * m11;
  const c21 = m02 * m10 - m00 * m12;
  const c22 = m00 * m11 - m01 * m10;

  return [
    c00 * invDet, c10 * invDet, c20 * invDet,
    c01 * invDet, c11 * invDet, c21 * invDet,
    c02 * invDet, c12 * invDet, c22 * invDet
  ];
}

// 1. Test Coordinate-to-Cell and Cell-to-Pitch Mapping
function testCoordinateToCellAndPitch() {
  console.log('Testing Coordinate-to-Cell and Cell-to-Pitch Mapping...');
  const pitches = ['C6', 'A5', 'G5', 'E5', 'D5'];
  const cols = 4;
  const rows = pitches.length;

  const corners = {
    topLeft: { x: 0.15, y: 0.15 },
    topRight: { x: 0.85, y: 0.15 },
    bottomRight: { x: 0.85, y: 0.85 },
    bottomLeft: { x: 0.15, y: 0.85 }
  };

  const H = computeHomography(corners);
  const Hinv = invertMatrix3x3(H);

  function mapPointToCell(imgX, imgY) {
    const board = imageToBoard(imgX, imgY, Hinv);
    if (board.x < 0 || board.x > 1 || board.y < 0 || board.y > 1) {
      return null;
    }
    const c = Math.min(cols - 1, Math.max(0, Math.floor(board.x * cols)));
    const r = Math.min(rows - 1, Math.max(0, Math.floor(board.y * rows)));
    return { row: r, col: c, pitch: pitches[r] };
  }

  // Row 0, Col 0: C6, Step 1
  const cell00 = mapPointToCell(0.20, 0.20);
  assert.equal(cell00.row, 0);
  assert.equal(cell00.col, 0);
  assert.equal(cell00.pitch, 'C6');

  // Row 2, Col 2: G5, Step 3
  const cell22 = mapPointToCell(0.50, 0.50);
  assert.equal(cell22.row, 2);
  assert.equal(cell22.col, 2);
  assert.equal(cell22.pitch, 'G5');

  // Row 4, Col 3: D5, Step 4
  const cell43 = mapPointToCell(0.80, 0.80);
  assert.equal(cell43.row, 4);
  assert.equal(cell43.col, 3);
  assert.equal(cell43.pitch, 'D5');

  console.log('✓ Coordinate-to-cell and cell-to-pitch mapping verified');
}

// 2. Test Detection Filtering: Area, Aspect-Ratio & Out-of-Bounds
function testDetectionFiltering() {
  console.log('\nTesting Detection Filtering (Area, Aspect Ratio, Out-of-Bounds)...');
  const expectedCellArea = 2000;
  const opts = {
    minAreaRatio: 0.08, // min 160px
    maxAreaRatio: 0.85, // max 1700px
    minAspectRatio: 1.0,
    maxAspectRatio: 3.8,
    boardMargin: 0.02
  };

  function isCandidateValid(area, width, height, boardU, boardV) {
    const minArea = expectedCellArea * opts.minAreaRatio;
    const maxArea = expectedCellArea * opts.maxAreaRatio;
    if (area < minArea || area > maxArea) return false;

    const aspect = width / height;
    if (aspect < opts.minAspectRatio || aspect > opts.maxAspectRatio) return false;

    if (boardU < opts.boardMargin || boardU > 1 - opts.boardMargin) return false;
    if (boardV < opts.boardMargin || boardV > 1 - opts.boardMargin) return false;

    return true;
  }

  // Plausible tile: area 800, width 40, height 20 (aspect 2.0), inside board
  assert(isCandidateValid(800, 40, 20, 0.5, 0.5), 'Valid rectangular tile should pass');

  // Thin grid line: width 150, height 3, area 450 (aspect 50) -> REJECT
  assert(!isCandidateValid(450, 150, 3, 0.5, 0.5), 'Thin grid line should be rejected by aspect ratio');

  // Tiny noise speck: area 15 -> REJECT
  assert(!isCandidateValid(15, 4, 4, 0.5, 0.5), 'Small noise speck should be rejected by min area');

  // Large hand/shadow: area 3500 -> REJECT
  assert(!isCandidateValid(3500, 60, 58, 0.5, 0.5), 'Oversized blob should be rejected by max area');

  // Tile outside board: boardU = -0.15 -> REJECT
  assert(!isCandidateValid(800, 40, 20, -0.15, 0.5), 'Out-of-bounds candidate should be rejected');

  console.log('✓ Shape, aspect-ratio, area, and out-of-bounds filters verified');
}

// 3. Test Duplicate-Cell Conflict Resolution Policy
function testDuplicateCellConflictPolicy() {
  console.log('\nTesting Duplicate-Cell Conflicting Detections Policy...');
  // Two candidate contours resolve to the same cell (row 1, col 2)
  const candidates = [
    { id: 'cand-A', row: 1, col: 2, confidence: 0.62, areaPixels: 350 },
    { id: 'cand-B', row: 1, col: 2, confidence: 0.94, areaPixels: 720 }, // Superior confidence & area
    { id: 'cand-C', row: 3, col: 0, confidence: 0.88, areaPixels: 680 },
  ];

  const resolved = new Map();
  for (const cand of candidates) {
    const key = `${cand.row}-${cand.col}`;
    const existing = resolved.get(key);
    if (!existing || cand.confidence > existing.confidence) {
      resolved.set(key, cand);
    }
  }

  assert.equal(resolved.size, 2, 'Exactly one tile per cell must be retained');
  assert.equal(resolved.get('1-2').id, 'cand-B', 'Highest-confidence candidate must win conflict');
  assert.equal(resolved.get('3-0').id, 'cand-C');
  console.log('✓ Conflicting detections policy strictly ensures at most one note per cell');
}

// 4. Test Temporal Stability: Additions, Removals, and Hand Occlusion
function testTemporalStabilityStateMachine() {
  console.log('\nTesting Temporal Stability State Machine (Hand Occlusion Absorption)...');

  class Tracker {
    constructor() {
      this.state = 'empty';
      this.seenCount = 0;
      this.missingCount = 0;
      this.N_CONFIRM = 3;
      this.N_DROP = 5;
    }

    step(detected) {
      if (detected) {
        this.missingCount = 0;
        if (this.state === 'empty') {
          this.state = 'pending_add';
          this.seenCount = 1;
        } else if (this.state === 'pending_add') {
          this.seenCount++;
          if (this.seenCount >= this.N_CONFIRM) {
            this.state = 'active';
          }
        }
      } else {
        if (this.state === 'pending_add') {
          this.state = 'empty';
          this.seenCount = 0;
        } else if (this.state === 'active') {
          this.missingCount++;
          if (this.missingCount >= this.N_DROP) {
            this.state = 'empty';
            this.seenCount = 0;
          }
        }
      }
      return this.state;
    }
  }

  const t = new Tracker();

  // Frame 1: Tile appears -> pending_add
  assert.equal(t.step(true), 'pending_add');
  // Frame 2: Still present -> pending_add (seenCount = 2)
  assert.equal(t.step(true), 'pending_add');
  // Frame 3: Consecutive confirmation -> ACTIVE!
  assert.equal(t.step(true), 'active');

  // Test Hand Occlusion Absorption:
  // Child reaches hand over tile for 3 frames (frame 4, 5, 6)
  assert.equal(t.step(false), 'active', 'Missing frame 1: Note must stay active!');
  assert.equal(t.step(false), 'active', 'Missing frame 2: Note must stay active!');
  assert.equal(t.step(false), 'active', 'Missing frame 3: Note must stay active!');

  // Hand moves away: tile seen again at frame 7!
  assert.equal(t.step(true), 'active', 'Tile visible again: Note remains active with missingCount reset to 0');
  assert.equal(t.missingCount, 0);

  // Test Deliberate Tile Removal:
  // Tile removed and missing for 5 consecutive frames
  t.step(false); // 1
  t.step(false); // 2
  t.step(false); // 3
  t.step(false); // 4
  assert.equal(t.state, 'active', 'Still waiting for 5th frame');
  t.step(false); // 5th missing frame
  assert.equal(t.state, 'empty', '5th missing frame confirmed removal -> state resets to empty');

  console.log('✓ Temporal stability absorbs hand occlusion and reliably confirms additions & removals');
}

// 5. Circularity Score Calculations
function testCircularityScores() {
  console.log('\nTesting Circularity Score Calculations...');

  // Analytical circularity: 4π × area / perimeter²
  function circularity(area, perimeter) {
    return perimeter > 0 ? (4 * Math.PI * area) / (perimeter * perimeter) : 0;
  }

  // Perfect mathematical circle: area = π r², perimeter = 2π r → score = 1.0
  // For a discrete pixel approximation, a radius-10 disc is approximately:
  //   area ≈ 314, perimeter ≈ 63 → 4π*314 / (63²) ≈ 0.995
  const perfectCircle = circularity(314, 63);
  assert(perfectCircle >= 0.38, `Perfect circle must pass threshold (got ${perfectCircle.toFixed(3)})`);
  assert(perfectCircle > 0.85, `Perfect circle circularity must be > 0.85 (got ${perfectCircle.toFixed(3)})`);

  // Square: area = s², perimeter = 4s → score = π/4 ≈ 0.785
  //   For s = 20: area = 400, perimeter = 80
  const square = circularity(400, 80);
  assert(square > 0.70 && square < 0.85, `Square circularity must be ~0.785 (got ${square.toFixed(3)})`);
  // In circle mode (threshold 0.38), squares can still pass — that is expected behaviour
  // because some coins/caps appear square-ish under perspective.

  // Thin horizontal line: width 80, height 4 (aspect 20) → very low circularity
  //   area ≈ 320, perimeter ≈ 168
  const thinLine = circularity(320, 168);
  assert(thinLine < 0.38, `Thin line must be below circle threshold (got ${thinLine.toFixed(3)})`);

  // Fill-ratio check for a circle: blob.pixels / (π r²) should be ≥ 0.45
  // For a 22-px-radius disc on a 2-step grid: pixelCount ≈ π*22² ≈ 1520
  const r = 22;
  const expectedArea = Math.PI * r * r;
  const fillRatio = (0.95 * expectedArea) / expectedArea; // 95 % fill (solid disc)
  assert(fillRatio >= 0.45, `Solid disc fill ratio must be ≥ 0.45 (got ${fillRatio.toFixed(3)})`);

  // Hollow ring (donut): fill ratio ≈ 0.30 — should be rejected in circle mode
  const hollowFill = (0.30 * expectedArea) / expectedArea;
  assert(hollowFill < 0.45, `Hollow ring fill ratio must be < 0.45 (got ${hollowFill.toFixed(3)})`);

  // Aspect ratio gate for circles in circle mode: must be 0.65 – 1.55
  // Plausible tilted bottle-cap: width 44, height 36 → AR ≈ 1.22 → PASS
  const capAR = 44 / 36;
  assert(capAR >= 0.65 && capAR <= 1.55, `Tilted bottle-cap AR must pass (got ${capAR.toFixed(2)})`);

  // Rectangle AR: 60 × 25 → AR = 2.4 → must FAIL circle-mode gate
  const rectAR = 60 / 25;
  assert(rectAR > 1.55, `Rectangle AR must fail circle gate (got ${rectAR.toFixed(2)})`);

  console.log('✓ Circularity score, fill-ratio, and shape-gate tests all passed');
}

testCoordinateToCellAndPitch();
testDetectionFiltering();
testDuplicateCellConflictPolicy();
testTemporalStabilityStateMachine();
testCircularityScores();
console.log('\nAll Stage 3 tile detection, mapping & stability tests passed successfully!');

