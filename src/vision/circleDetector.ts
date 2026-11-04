import type { Point } from './triangleDetector';

export interface CircleAnalysis {
  isCircle: boolean;
  centroid: Point;
  radius: number;
  rmseNorm: number;
  radialCV: number;
  confidence: number;
}

/**
 * Algebraic Circle Fit using Kåsa's modified least squares method.
 * Solves: (x - cx)^2 + (y - cy)^2 = r^2 in linear time O(N).
 *
 * Evaluates:
 * 1. Normalized Root Mean Square Error (RMSE / r):
 *    - True circle: < 0.05
 *    - Discretized / noisy circle: < 0.085
 *    - Square: ~0.117
 *    - Triangle: ~0.235
 * 2. Radial Coefficient of Variation (std(radius) / mean(radius)):
 *    - True circle: < 0.09
 *    - Square: ~0.117
 *    - Triangle: > 0.22
 */
export function analyzeCircleContour(contour: Point[]): CircleAnalysis {
  const n = contour.length;
  if (n < 8) {
    return {
      isCircle: false,
      centroid: { x: 0, y: 0 },
      radius: 0,
      rmseNorm: 1,
      radialCV: 1,
      confidence: 0,
    };
  }

  let sx = 0;
  let sy = 0;
  let sx2 = 0;
  let sy2 = 0;
  let sxy = 0;
  let sz = 0;
  let sxz = 0;
  let syz = 0;

  for (let i = 0; i < n; i++) {
    const x = contour[i].x;
    const y = contour[i].y;
    const z = x * x + y * y;
    sx += x;
    sy += y;
    sx2 += x * x;
    sy2 += y * y;
    sxy += x * y;
    sz += z;
    sxz += x * z;
    syz += y * z;
  }

  // 3x3 Linear system:
  // [sx2  sxy  sx] [A]   [sxz]
  // [sxy  sy2  sy] [B] = [syz]
  // [sx   sy   n ] [C]   [sz ]
  const a1 = sx2;
  const b1 = sxy;
  const c1 = sx;
  const d1 = sxz;
  const a2 = sxy;
  const b2 = sy2;
  const c2 = sy;
  const d2 = syz;
  const a3 = sx;
  const b3 = sy;
  const c3 = n;
  const d3 = sz;

  const det =
    a1 * (b2 * c3 - b3 * c2) -
    b1 * (a2 * c3 - a3 * c2) +
    c1 * (a2 * b3 - a3 * b2);

  if (Math.abs(det) < 1e-7) {
    return {
      isCircle: false,
      centroid: { x: 0, y: 0 },
      radius: 0,
      rmseNorm: 1,
      radialCV: 1,
      confidence: 0,
    };
  }

  const detA =
    d1 * (b2 * c3 - b3 * c2) -
    b1 * (d2 * c3 - d3 * c2) +
    c1 * (d2 * b3 - d3 * b2);
  const detB =
    a1 * (d2 * c3 - d3 * c2) -
    d1 * (a2 * c3 - a3 * c2) +
    c1 * (a2 * d3 - a3 * d2);
  const detC =
    a1 * (b2 * d3 - b3 * d2) -
    b1 * (a2 * d3 - a3 * d2) +
    d1 * (a2 * b3 - a3 * b2);

  const cx = detA / det / 2;
  const cy = detB / det / 2;
  const r2 = detC / det + cx * cx + cy * cy;

  if (r2 <= 0) {
    return {
      isCircle: false,
      centroid: { x: cx, y: cy },
      radius: 0,
      rmseNorm: 1,
      radialCV: 1,
      confidence: 0,
    };
  }

  const r = Math.sqrt(r2);

  // Compute normalized RMSE and radial coefficient of variation
  let sumErr2 = 0;
  let sumDist = 0;
  const dists: number[] = new Array(n);

  for (let i = 0; i < n; i++) {
    const d = Math.hypot(contour[i].x - cx, contour[i].y - cy);
    dists[i] = d;
    sumDist += d;
    sumErr2 += (d - r) * (d - r);
  }

  const rmseNorm = Math.sqrt(sumErr2 / n) / r;
  const dMean = sumDist / n;

  let sumVar = 0;
  for (let i = 0; i < n; i++) {
    const diff = dists[i] - dMean;
    sumVar += diff * diff;
  }
  const radialCV = Math.sqrt(sumVar / n) / Math.max(1e-5, dMean);

  // Strict thresholds:
  // Physical circular disc: rmseNorm <= 0.088 and radialCV <= 0.092
  // Discards squares (~0.117), rectangles (> 0.15), and triangles (~0.235)
  const isCircle = rmseNorm <= 0.088 && radialCV <= 0.092;
  const confidence = Math.max(0, Math.min(1.0, 1.0 - rmseNorm * 6));

  return {
    isCircle,
    centroid: { x: cx, y: cy },
    radius: r,
    rmseNorm,
    radialCV,
    confidence,
  };
}

