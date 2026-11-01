import type { BoardCorners, Point2D, LineSegment, CellGeometry } from '../types/camera';
import type { PitchName } from '../types/music';

/**
 * 3x3 Homography Matrix represented as a flat 9-element array in row-major order:
 * [m00, m01, m02,
 *  m10, m11, m12,
 *  m20, m21, m22]
 */
export type Matrix3x3 = [
  number, number, number,
  number, number, number,
  number, number, number
];

/**
 * Computes the projective homography matrix H that maps the unit board square
 * [0, 1] x [0, 1] to the quad defined by the 4 corners:
 * (0,0) -> topLeft
 * (1,0) -> topRight
 * (1,1) -> bottomRight
 * (0,1) -> bottomLeft
 *
 * Implements Paul Heckbert's closed-form quadrilateral-to-square projective mapping.
 */
export function computeHomography(corners: BoardCorners): Matrix3x3 | null {
  const { topLeft: p0, topRight: p1, bottomRight: p2, bottomLeft: p3 } = corners;

  const dx1 = p1.x - p2.x;
  const dx2 = p3.x - p2.x;
  const sx = p0.x - p1.x + p2.x - p3.x;

  const dy1 = p1.y - p2.y;
  const dy2 = p3.y - p2.y;
  const sy = p0.y - p1.y + p2.y - p3.y;

  // Affine case: quadrilateral is a parallelogram
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

  // Projective case
  const det = dx1 * dy2 - dx2 * dy1;
  if (Math.abs(det) < 1e-10) {
    // Degenerate quadrilateral (e.g. 3 or 4 points are collinear)
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

/**
 * Computes the inverse of a 3x3 matrix.
 */
export function invertMatrix3x3(m: Matrix3x3): Matrix3x3 | null {
  const [
    m00, m01, m02,
    m10, m11, m12,
    m20, m21, m22
  ] = m;

  const c00 = m11 * m22 - m12 * m21;
  const c01 = m12 * m20 - m10 * m22;
  const c02 = m10 * m21 - m11 * m20;

  const det = m00 * c00 + m01 * c01 + m02 * c02;
  if (Math.abs(det) < 1e-12) {
    return null;
  }

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

/**
 * Maps normalized board coordinates (u, v) in [0, 1] x [0, 1] to
 * image/video space (x, y) using the homography matrix H.
 */
export function boardToImage(u: number, v: number, H: Matrix3x3): Point2D {
  const xNum = H[0] * u + H[1] * v + H[2];
  const yNum = H[3] * u + H[4] * v + H[5];
  const w = H[6] * u + H[7] * v + H[8];

  if (Math.abs(w) < 1e-12) {
    return { x: xNum, y: yNum };
  }

  return {
    x: xNum / w,
    y: yNum / w
  };
}

/**
 * Maps image/video coordinates (x, y) back to normalized board coordinates (u, v)
 * using the inverse homography matrix Hinv.
 */
export function imageToBoard(x: number, y: number, Hinv: Matrix3x3): Point2D {
  const uNum = Hinv[0] * x + Hinv[1] * y + Hinv[2];
  const vNum = Hinv[3] * x + Hinv[4] * y + Hinv[5];
  const w = Hinv[6] * x + Hinv[7] * y + Hinv[8];

  if (Math.abs(w) < 1e-12) {
    return { x: uNum, y: vNum };
  }

  return {
    x: uNum / w,
    y: vNum / w
  };
}

/**
 * Generates all internal and boundary grid line segments for the board,
 * transformed by the homography to accurately represent perspective lines.
 */
export function getGridLineSegments(
  corners: BoardCorners,
  rows: number,
  cols: number
): LineSegment[] {
  const H = computeHomography(corners);
  const segments: LineSegment[] = [];

  if (!H) {
    // Fallback: direct corner perimeter
    segments.push(
      { p1: corners.topLeft, p2: corners.topRight, isBoundary: true },
      { p1: corners.topRight, p2: corners.bottomRight, isBoundary: true },
      { p1: corners.bottomRight, p2: corners.bottomLeft, isBoundary: true },
      { p1: corners.bottomLeft, p2: corners.topLeft, isBoundary: true }
    );
    return segments;
  }

  // 1. Boundary lines
  segments.push(
    { p1: boardToImage(0, 0, H), p2: boardToImage(1, 0, H), isBoundary: true },
    { p1: boardToImage(1, 0, H), p2: boardToImage(1, 1, H), isBoundary: true },
    { p1: boardToImage(1, 1, H), p2: boardToImage(0, 1, H), isBoundary: true },
    { p1: boardToImage(0, 1, H), p2: boardToImage(0, 0, H), isBoundary: true }
  );

  // 2. Horizontal internal grid lines (rows)
  for (let r = 1; r < rows; r++) {
    const v = r / rows;
    segments.push({
      p1: boardToImage(0, v, H),
      p2: boardToImage(1, v, H),
      isBoundary: false,
      row: r
    });
  }

  // 3. Vertical internal grid lines (columns)
  for (let c = 1; c < cols; c++) {
    const u = c / cols;
    segments.push({
      p1: boardToImage(u, 0, H),
      p2: boardToImage(u, 1, H),
      isBoundary: false,
      col: c
    });
  }

  return segments;
}

/**
 * Computes the quadrilateral polygon for each cell on the board.
 */
export function getAllCellGeometries(
  corners: BoardCorners,
  pitches: PitchName[],
  cols: number
): CellGeometry[] {
  const rows = pitches.length;
  const H = computeHomography(corners);
  const cells: CellGeometry[] = [];

  if (!H) return cells;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const u0 = c / cols;
      const u1 = (c + 1) / cols;
      const v0 = r / rows;
      const v1 = (r + 1) / rows;

      const pTL = boardToImage(u0, v0, H);
      const pTR = boardToImage(u1, v0, H);
      const pBR = boardToImage(u1, v1, H);
      const pBL = boardToImage(u0, v1, H);

      const center = boardToImage((u0 + u1) / 2, (v0 + v1) / 2, H);

      cells.push({
        row: r,
        col: c,
        pitch: pitches[r],
        polygon: [pTL, pTR, pBR, pBL],
        center
      });
    }
  }

  return cells;
}

/**
 * Given a normalized point in image space (x, y), finds which board cell (row, col)
 * it falls into, or returns null if outside the board boundaries.
 */
export function pointToCellIndex(
  x: number,
  y: number,
  Hinv: Matrix3x3,
  rows: number,
  cols: number
): { row: number; col: number } | null {
  const { x: u, y: v } = imageToBoard(x, y, Hinv);

  // Check bounds in unit board coordinate space [0, 1]
  if (u < 0 || u > 1 || v < 0 || v > 1) {
    return null;
  }

  const col = Math.min(cols - 1, Math.floor(u * cols));
  const row = Math.min(rows - 1, Math.floor(v * rows));

  return { row, col };
}

/**
 * Default initial corners (centered 70% rectangular region of the frame).
 */
export const DEFAULT_BOARD_CORNERS: BoardCorners = {
  topLeft: { x: 0.15, y: 0.15 },
  topRight: { x: 0.85, y: 0.15 },
  bottomRight: { x: 0.85, y: 0.85 },
  bottomLeft: { x: 0.15, y: 0.85 }
};

