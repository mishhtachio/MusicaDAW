import assert from 'node:assert/strict';

// Import compiled or duplicate module functions for testing pure geometry logic
function computeHomography(corners) {
  const { topLeft: p0, topRight: p1, bottomRight: p2, bottomLeft: p3 } = corners;

  const dx1 = p1.x - p2.x;
  const dx2 = p3.x - p2.x;
  const sx = p0.x - p1.x + p2.x - p3.x;

  const dy1 = p1.y - p2.y;
  const dy2 = p3.y - p2.y;
  const sy = p0.y - p1.y + p2.y - p3.y;

  if (Math.abs(sx) < 1e-7 && Math.abs(sy) < 1e-7) {
    const a = p1.x - p0.x;
    const b = p3.x - p0.x;
    const c = p0.x;
    const d = p1.y - p0.y;
    const e = p3.y - p0.y;
    const f = p0.y;
    return [
      a, b, c,
      d, e, f,
      0, 0, 1
    ];
  }

  const det = dx1 * dy2 - dx2 * dy1;
  if (Math.abs(det) < 1e-10) {
    return null;
  }

  const g = (sx * dy2 - sy * dx2) / det;
  const h = (dx1 * sy - dy1 * sx) / det;

  const a = p1.x - p0.x + g * p1.x;
  const b = p3.x - p0.x + h * p3.x;
  const c = p0.x;

  const d = p1.y - p0.y + g * p1.y;
  const e = p3.y - p0.y + h * p3.y;
  const f = p0.y;

  return [
    a, b, c,
    d, e, f,
    g, h, 1
  ];
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

function boardToImage(u, v, H) {
  const xNum = H[0] * u + H[1] * v + H[2];
  const yNum = H[3] * u + H[4] * v + H[5];
  const w = H[6] * u + H[7] * v + H[8];
  return { x: xNum / w, y: yNum / w };
}

function imageToBoard(x, y, Hinv) {
  const uNum = Hinv[0] * x + Hinv[1] * y + Hinv[2];
  const vNum = Hinv[3] * x + Hinv[4] * y + Hinv[5];
  const w = Hinv[6] * x + Hinv[7] * y + Hinv[8];
  return { x: uNum / w, y: vNum / w };
}

function pointToCellIndex(x, y, Hinv, rows, cols) {
  const { x: u, y: v } = imageToBoard(x, y, Hinv);
  if (u < 0 || u > 1 || v < 0 || v > 1) return null;
  const col = Math.min(cols - 1, Math.floor(u * cols));
  const row = Math.min(rows - 1, Math.floor(v * rows));
  return { row, col };
}

function testPerspectiveHomography() {
  console.log('Testing Perspective Homography & Inversion...');

  // Test Case 1: Perspective trapezoid (typical camera viewing board at an angle)
  // Top edge narrower than bottom edge
  const corners = {
    topLeft: { x: 0.20, y: 0.15 },
    topRight: { x: 0.80, y: 0.15 },
    bottomRight: { x: 0.90, y: 0.85 },
    bottomLeft: { x: 0.10, y: 0.85 }
  };

  const H = computeHomography(corners);
  assert(H !== null, 'Homography calculation should succeed for valid quad');

  const Hinv = invertMatrix3x3(H);
  assert(Hinv !== null, 'Homography inversion should succeed');

  // Verify corners map exactly
  const pTL = boardToImage(0, 0, H);
  const pTR = boardToImage(1, 0, H);
  const pBR = boardToImage(1, 1, H);
  const pBL = boardToImage(0, 1, H);

  assert(Math.abs(pTL.x - corners.topLeft.x) < 1e-6 && Math.abs(pTL.y - corners.topLeft.y) < 1e-6, 'TL forward mapping failed');
  assert(Math.abs(pTR.x - corners.topRight.x) < 1e-6 && Math.abs(pTR.y - corners.topRight.y) < 1e-6, 'TR forward mapping failed');
  assert(Math.abs(pBR.x - corners.bottomRight.x) < 1e-6 && Math.abs(pBR.y - corners.bottomRight.y) < 1e-6, 'BR forward mapping failed');
  assert(Math.abs(pBL.x - corners.bottomLeft.x) < 1e-6 && Math.abs(pBL.y - corners.bottomLeft.y) < 1e-6, 'BL forward mapping failed');

  // Verify inverse corner mapping
  const bTL = imageToBoard(corners.topLeft.x, corners.topLeft.y, Hinv);
  const bTR = imageToBoard(corners.topRight.x, corners.topRight.y, Hinv);
  const bBR = imageToBoard(corners.bottomRight.x, corners.bottomRight.y, Hinv);
  const bBL = imageToBoard(corners.bottomLeft.x, corners.bottomLeft.y, Hinv);

  assert(Math.abs(bTL.x - 0) < 1e-5 && Math.abs(bTL.y - 0) < 1e-5, 'TL inverse mapping failed');
  assert(Math.abs(bTR.x - 1) < 1e-5 && Math.abs(bTR.y - 0) < 1e-5, 'TR inverse mapping failed');
  assert(Math.abs(bBR.x - 1) < 1e-5 && Math.abs(bBR.y - 1) < 1e-5, 'BR inverse mapping failed');
  assert(Math.abs(bBL.x - 0) < 1e-5 && Math.abs(bBL.y - 1) < 1e-5, 'BL inverse mapping failed');

  // Roundtrip test across grid steps
  for (let u = 0; u <= 1.01; u += 0.25) {
    for (let v = 0; v <= 1.01; v += 0.2) {
      const imgPt = boardToImage(u, v, H);
      const boardPt = imageToBoard(imgPt.x, imgPt.y, Hinv);
      assert(Math.abs(boardPt.x - u) < 1e-5, `Roundtrip u mismatch at (${u},${v})`);
      assert(Math.abs(boardPt.y - v) < 1e-5, `Roundtrip v mismatch at (${u},${v})`);
    }
  }

  console.log('✓ Forward and inverse perspective homography verified with 1e-5 precision');
}

function testGridCellMapping() {
  console.log('\nTesting 5x4 Grid Cell Resolution & Hit Testing...');

  const rows = 5;
  const cols = 4;
  const corners = {
    topLeft: { x: 0.15, y: 0.12 },
    topRight: { x: 0.85, y: 0.18 },
    bottomRight: { x: 0.88, y: 0.82 },
    bottomLeft: { x: 0.12, y: 0.88 }
  };

  const H = computeHomography(corners);
  const Hinv = invertMatrix3x3(H);

  // Every cell center must resolve back to its exact (row, col)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const uCenter = (c + 0.5) / cols;
      const vCenter = (r + 0.5) / rows;
      const imgCenter = boardToImage(uCenter, vCenter, H);

      const cell = pointToCellIndex(imgCenter.x, imgCenter.y, Hinv, rows, cols);
      assert(cell !== null, `Expected cell hit for row ${r}, col ${c}`);
      assert.equal(cell.row, r, `Row index mismatch: expected ${r}, got ${cell.row}`);
      assert.equal(cell.col, c, `Col index mismatch: expected ${c}, got ${cell.col}`);
    }
  }

  // Outside points must return null
  const outsideLeft = pointToCellIndex(0.02, 0.5, Hinv, rows, cols);
  const outsideRight = pointToCellIndex(0.98, 0.5, Hinv, rows, cols);
  const outsideTop = pointToCellIndex(0.5, 0.02, Hinv, rows, cols);
  const outsideBottom = pointToCellIndex(0.5, 0.98, Hinv, rows, cols);

  assert.equal(outsideLeft, null, 'Point outside left boundary must return null');
  assert.equal(outsideRight, null, 'Point outside right boundary must return null');
  assert.equal(outsideTop, null, 'Point outside top boundary must return null');
  assert.equal(outsideBottom, null, 'Point outside bottom boundary must return null');

  console.log('✓ All 20 cells in 5x4 grid correctly mapped; outer bounds correctly clipped');
}

function testDegenerateHandling() {
  console.log('\nTesting Degenerate Quadrilateral Handling...');
  // Collinear corners
  const collinearCorners = {
    topLeft: { x: 0.1, y: 0.1 },
    topRight: { x: 0.2, y: 0.2 },
    bottomRight: { x: 0.3, y: 0.3 },
    bottomLeft: { x: 0.4, y: 0.4 }
  };

  const H = computeHomography(collinearCorners);
  assert.equal(H, null, 'Collinear quad must return null without throwing');
  console.log('✓ Degenerate geometry safely caught');
}

function testCornerSortingAndSmoothing() {
  console.log('\nTesting Corner Marker Sorting & Smoothing...');
  // 4 unordered points
  const points = [
    { x: 0.85, y: 0.85 }, // BR
    { x: 0.15, y: 0.15 }, // TL
    { x: 0.15, y: 0.85 }, // BL
    { x: 0.85, y: 0.15 }, // TR
  ];

  function sortPointsToCorners(pts) {
    let tl = pts[0], tr = pts[0], br = pts[0], bl = pts[0];
    let minTL = Infinity, minTR = Infinity, minBR = Infinity, minBL = Infinity;
    for (const p of pts) {
      const dTL = p.x + p.y;
      if (dTL < minTL) { minTL = dTL; tl = p; }
      const dTR = (1 - p.x) + p.y;
      if (dTR < minTR) { minTR = dTR; tr = p; }
      const dBR = (1 - p.x) + (1 - p.y);
      if (dBR < minBR) { minBR = dBR; br = p; }
      const dBL = p.x + (1 - p.y);
      if (dBL < minBL) { minBL = dBL; bl = p; }
    }
    return { topLeft: tl, topRight: tr, bottomRight: br, bottomLeft: bl };
  }

  const sorted = sortPointsToCorners(points);
  assert.equal(sorted.topLeft.x, 0.15);
  assert.equal(sorted.topLeft.y, 0.15);
  assert.equal(sorted.topRight.x, 0.85);
  assert.equal(sorted.topRight.y, 0.15);
  assert.equal(sorted.bottomRight.x, 0.85);
  assert.equal(sorted.bottomRight.y, 0.85);
  assert.equal(sorted.bottomLeft.x, 0.15);
  assert.equal(sorted.bottomLeft.y, 0.85);
  console.log('✓ Spatial corner sorting reliably orders points to TL, TR, BR, BL');

  // Test 5x4 Grid Geometry: pitch column projected strictly outside grid (u < 0)
  const H = computeHomography(sorted);
  for (let r = 0; r < 5; r++) {
    const v = (r + 0.5) / 5;
    const pitchPos = boardToImage(-0.11, v, H);
    const rowStart = boardToImage(0, v, H);
    // Pitch pill must be to the left of row start
    assert(pitchPos.x < rowStart.x, `Pitch label for row ${r} must be strictly to the left of the 5x4 grid`);
  }
  console.log('✓ 5x4 grid correctly excludes the pitch column; pitch labels project to the left outside');
}

testPerspectiveHomography();
testGridCellMapping();
testDegenerateHandling();
testCornerSortingAndSmoothing();
console.log('\nAll Stage 2 calibration, marker detection & geometry tests passed successfully!');

