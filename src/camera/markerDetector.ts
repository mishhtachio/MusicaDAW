import type { BoardCorners, Point2D } from '../types/camera';

export type MarkerDetectionType = 'dark-dots' | 'color-stickers';

export interface MarkerDetectionResult {
  detected: boolean;
  corners?: BoardCorners;
  confidence: number;
  message: string;
  detectedPoints?: {
    topLeft?: Point2D;
    topRight?: Point2D;
    bottomRight?: Point2D;
    bottomLeft?: Point2D;
  };
}

/**
 * Converts RGB [0, 255] to HSV:
 * H in [0, 360], S in [0, 1], V in [0, 1]
 */
function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;

  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === rNorm) {
      h = ((gNorm - bNorm) / delta) % 6;
    } else if (max === gNorm) {
      h = (bNorm - rNorm) / delta + 2;
    } else {
      h = (rNorm - gNorm) / delta + 4;
    }
    h = Math.round(h * 60);
    if (h < 0) h += 360;
  }

  const s = max === 0 ? 0 : delta / max;
  const v = max;

  return [h, s, v];
}

/**
 * Detects 4 black / dark ink corner dots specifically drawn on paper boards.
 *
 * Designed for hand-drawn grids on notebook or blank paper (like the user's drawing):
 * - Grid drawn with dark ink (marker / pen) on light paper.
 * - 4 distinct solid circular dots marking the outer corners of the 5x4 grid.
 *
 * Algorithm:
 * 1. Adaptive luminance thresholding to separate black marker ink from paper & ruled lines.
 * 2. Find the bounding quadrant extents of the drawn grid.
 * 3. Search for local circular density peaks (the solid filled corner dots have much higher
 *    area density than thin grid lines).
 * 4. Compute sub-pixel centroids for the 4 corner dot centers.
 */
export function detectDarkDots(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): MarkerDetectionResult {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const totalPixels = width * height;

  // 1. Compute image luminance histogram to find paper background level
  let sumLum = 0;
  const step = 2; // sample every 2nd pixel for speed
  let sampleCount = 0;

  for (let i = 0; i < totalPixels * 4; i += 4 * step) {
    const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    sumLum += lum;
    sampleCount++;
  }

  const avgLum = sumLum / sampleCount;
  // Marker ink is significantly darker than paper background (which is usually > 180)
  // We use adaptive threshold: dark marker ink threshold
  const inkThreshold = Math.min(105, avgLum * 0.58);

  // 2. Binary ink mask & collect all ink pixels
  const inkMask = new Uint8Array(width * height);
  let minX = width, maxX = 0, minY = height, maxY = 0;
  let inkCount = 0;

  for (let y = 4; y < height - 4; y++) {
    for (let x = 4; x < width - 4; x++) {
      const idx = (y * width + x) * 4;
      const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];

      if (lum < inkThreshold) {
        inkMask[y * width + x] = 1;
        inkCount++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  // Ensure there's a plausible grid present (at least 200 ink pixels, and bounding box >= 20% of frame)
  const spanX = maxX - minX;
  const spanY = maxY - minY;

  if (inkCount < 180 || spanX < width * 0.18 || spanY < height * 0.18) {
    return {
      detected: false,
      confidence: 0,
      message: 'Looking for the drawn grid... Ensure the notebook is well-lit and in view.',
    };
  }

  // 3. Search for the 4 corner dots in the 4 corner zones of the detected grid bounds
  // The dots are prominent circular blobs near:
  // - Top-Left: near (minX, minY)
  // - Top-Right: near (maxX, minY)
  // - Bottom-Right: near (maxX, maxY)
  // - Bottom-Left: near (minX, maxY)

  const zoneMarginX = Math.round(spanX * 0.32);
  const zoneMarginY = Math.round(spanY * 0.32);

  // Helper to find the densest circular blob within a region
  function findCornerBlob(
    rx0: number, ry0: number,
    rx1: number, ry1: number,
    biasX: 'left' | 'right',
    biasY: 'top' | 'bottom'
  ): Point2D | null {
    const xStart = Math.max(0, rx0);
    const xEnd = Math.min(width - 1, rx1);
    const yStart = Math.max(0, ry0);
    const yEnd = Math.min(height - 1, ry1);

    const radius = 6; // search radius for circular dot thickness
    let bestScore = -Infinity;
    let bestX = -1;
    let bestY = -1;

    for (let y = yStart + radius; y <= yEnd - radius; y += 2) {
      for (let x = xStart + radius; x <= xEnd - radius; x += 2) {
        if (!inkMask[y * width + x]) continue;

        // Count dark pixels in circular neighborhood (solid dots have high density)
        let density = 0;
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            if (dx * dx + dy * dy <= radius * radius) {
              if (inkMask[(y + dy) * width + (x + dx)]) {
                density++;
              }
            }
          }
        }

        // Add corner extremity bonus (favors dots at outer corners over internal grid intersections)
        const normDistX = biasX === 'left' ? (xEnd - x) / (xEnd - xStart) : (x - xStart) / (xEnd - xStart);
        const normDistY = biasY === 'top' ? (yEnd - y) / (yEnd - yStart) : (y - yStart) / (yEnd - yStart);
        const extremityBonus = (normDistX + normDistY) * 12;

        const score = density + extremityBonus;
        if (score > bestScore && density >= 12) {
          bestScore = score;
          bestX = x;
          bestY = y;
        }
      }
    }

    if (bestX < 0 || bestY < 0) return null;

    // Refine centroid around the best peak
    let sumX = 0;
    let sumY = 0;
    let count = 0;
    const refineRadius = 8;

    for (let dy = -refineRadius; dy <= refineRadius; dy++) {
      for (let dx = -refineRadius; dx <= refineRadius; dx++) {
        const px = bestX + dx;
        const py = bestY + dy;
        if (px >= 0 && px < width && py >= 0 && py < height) {
          if (inkMask[py * width + px]) {
            sumX += px;
            sumY += py;
            count++;
          }
        }
      }
    }

    if (count < 8) return null;

    return {
      x: (sumX / count) / width,
      y: (sumY / count) / height,
    };
  }

  // Find 4 corner dots in their respective quadrants
  const tl = findCornerBlob(minX - 8, minY - 8, minX + zoneMarginX, minY + zoneMarginY, 'left', 'top');
  const tr = findCornerBlob(maxX - zoneMarginX, minY - 8, maxX + 8, minY + zoneMarginY, 'right', 'top');
  const br = findCornerBlob(maxX - zoneMarginX, maxY - zoneMarginY, maxX + 8, maxY + 8, 'right', 'bottom');
  const bl = findCornerBlob(minX - 8, maxY - zoneMarginY, minX + zoneMarginX, maxY + 8, 'left', 'bottom');

  const detectedCount = (tl ? 1 : 0) + (tr ? 1 : 0) + (br ? 1 : 0) + (bl ? 1 : 0);

  if (tl && tr && br && bl) {
    // Validate geometric plausibility (corners form a convex quad with proper relative positions)
    if (tr.x > tl.x && br.x > bl.x && bl.y > tl.y && br.y > tr.y) {
      return {
        detected: true,
        corners: {
          topLeft: tl,
          topRight: tr,
          bottomRight: br,
          bottomLeft: bl,
        },
        confidence: 0.95,
        message: 'All 4 black corner dots locked on drawn grid!',
        detectedPoints: { topLeft: tl, topRight: tr, bottomRight: br, bottomLeft: bl },
      };
    }
  }

  return {
    detected: false,
    confidence: detectedCount / 4,
    message: `Found ${detectedCount}/4 corner dots. Hold phone steady over your notebook.`,
    detectedPoints: {
      topLeft: tl || undefined,
      topRight: tr || undefined,
      bottomRight: br || undefined,
      bottomLeft: bl || undefined,
    },
  };
}

/**
 * Checks if HSV color matches standard corner sticker colors (for sticker fallback mode).
 */
function matchStickerColor(h: number, s: number, v: number): 'red' | 'green' | 'blue' | 'yellow' | null {
  if (s < 0.25 || v < 0.20) return null;
  if ((h >= 345 || h <= 15) && s >= 0.35 && v >= 0.25) return 'red';
  if (h >= 75 && h <= 165 && s >= 0.28 && v >= 0.22) return 'green';
  if (h >= 190 && h <= 265 && s >= 0.30 && v >= 0.22) return 'blue';
  if (h >= 24 && h <= 68 && s >= 0.35 && v >= 0.30) return 'yellow';
  return null;
}

/**
 * Detects 4 color-coded stickers (Red, Green, Blue, Yellow).
 */
export function detectColorStickers(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): MarkerDetectionResult {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  const clusters = {
    red: { sumX: 0, sumY: 0, count: 0 },
    green: { sumX: 0, sumY: 0, count: 0 },
    blue: { sumX: 0, sumY: 0, count: 0 },
    yellow: { sumX: 0, sumY: 0, count: 0 },
  };

  const step = 2;
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      const [h, s, v] = rgbToHsv(r, g, b);
      const color = matchStickerColor(h, s, v);

      if (color) {
        clusters[color].sumX += x;
        clusters[color].sumY += y;
        clusters[color].count++;
      }
    }
  }

  const minPixels = 20;
  const points: {
    topLeft?: Point2D;
    topRight?: Point2D;
    bottomRight?: Point2D;
    bottomLeft?: Point2D;
  } = {};

  let foundCount = 0;

  if (clusters.red.count >= minPixels) {
    points.topLeft = {
      x: clusters.red.sumX / clusters.red.count / width,
      y: clusters.red.sumY / clusters.red.count / height,
    };
    foundCount++;
  }

  if (clusters.green.count >= minPixels) {
    points.topRight = {
      x: clusters.green.sumX / clusters.green.count / width,
      y: clusters.green.sumY / clusters.green.count / height,
    };
    foundCount++;
  }

  if (clusters.blue.count >= minPixels) {
    points.bottomRight = {
      x: clusters.blue.sumX / clusters.blue.count / width,
      y: clusters.blue.sumY / clusters.blue.count / height,
    };
    foundCount++;
  }

  if (clusters.yellow.count >= minPixels) {
    points.bottomLeft = {
      x: clusters.yellow.sumX / clusters.yellow.count / width,
      y: clusters.yellow.sumY / clusters.yellow.count / height,
    };
    foundCount++;
  }

  if (foundCount === 4 && points.topLeft && points.topRight && points.bottomRight && points.bottomLeft) {
    return {
      detected: true,
      corners: {
        topLeft: points.topLeft,
        topRight: points.topRight,
        bottomRight: points.bottomRight,
        bottomLeft: points.bottomLeft,
      },
      confidence: 0.95,
      message: 'All 4 color stickers (Red, Green, Blue, Yellow) locked!',
      detectedPoints: points,
    };
  }

  return {
    detected: false,
    confidence: foundCount / 4,
    message: `Found ${foundCount}/4 color stickers (${[
      points.topLeft ? '✓ Red TL' : '✗ Red TL',
      points.topRight ? '✓ Green TR' : '✗ Green TR',
      points.bottomRight ? '✓ Blue BR' : '✗ Blue BR',
      points.bottomLeft ? '✓ Yellow BL' : '✗ Yellow BL',
    ].join(', ')})`,
    detectedPoints: points,
  };
}

/**
 * Topologically sorts 4 arbitrary 2D points into [topLeft, topRight, bottomRight, bottomLeft].
 */
export function sortPointsToCorners(points: { x: number; y: number }[]): BoardCorners {
  let tl = points[0];
  let tr = points[0];
  let br = points[0];
  let bl = points[0];

  let minTL = Infinity;
  let minTR = Infinity;
  let minBR = Infinity;
  let minBL = Infinity;

  for (const p of points) {
    const dTL = p.x + p.y;
    if (dTL < minTL) {
      minTL = dTL;
      tl = p;
    }

    const dTR = (1 - p.x) + p.y;
    if (dTR < minTR) {
      minTR = dTR;
      tr = p;
    }

    const dBR = (1 - p.x) + (1 - p.y);
    if (dBR < minBR) {
      minBR = dBR;
      br = p;
    }

    const dBL = p.x + (1 - p.y);
    if (dBL < minBL) {
      minBL = dBL;
      bl = p;
    }
  }

  return {
    topLeft: { x: tl.x, y: tl.y },
    topRight: { x: tr.x, y: tr.y },
    bottomRight: { x: br.x, y: br.y },
    bottomLeft: { x: bl.x, y: bl.y },
  };
}

/**
 * Smooths corner movement across frames to avoid jitter.
 */
export function smoothCorners(
  current: BoardCorners,
  target: BoardCorners,
  alpha = 0.35
): BoardCorners {
  return {
    topLeft: {
      x: current.topLeft.x * (1 - alpha) + target.topLeft.x * alpha,
      y: current.topLeft.y * (1 - alpha) + target.topLeft.y * alpha,
    },
    topRight: {
      x: current.topRight.x * (1 - alpha) + target.topRight.x * alpha,
      y: current.topRight.y * (1 - alpha) + target.topRight.y * alpha,
    },
    bottomRight: {
      x: current.bottomRight.x * (1 - alpha) + target.bottomRight.x * alpha,
      y: current.bottomRight.y * (1 - alpha) + target.bottomRight.y * alpha,
    },
    bottomLeft: {
      x: current.bottomLeft.x * (1 - alpha) + target.bottomLeft.x * alpha,
      y: current.bottomLeft.y * (1 - alpha) + target.bottomLeft.y * alpha,
    },
  };
}
