import type { BoardCorners, Point2D } from '../types/camera';
import type { PitchName } from '../types/music';
import type { DetectedTileCandidate, TileDetectionOptions, PhysicalTileShape } from '../types/tile';
import { DEFAULT_TILE_DETECTION_OPTIONS } from '../types/tile';
import {
  computeHomography,
  invertMatrix3x3,
  imageToBoard,
} from '../geometry/perspectiveTransform';
import {
  traceContour,
  analyzeTriangleContour,
  findBoundaryStartPixel,
  type Point,
} from './triangleDetector';

export interface ITileDetector {
  detect(
    imageData: ImageData,
    corners: BoardCorners,
    pitches: PitchName[],
    cols: number,
    options?: Partial<TileDetectionOptions>
  ): DetectedTileCandidate[];
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
 * Deterministic Computer Vision Tile Detector.
 *
 * Implements:
 * 1. Perspective homography mapping of the calibrated board.
 * 2. Adaptive color & contrast foreground segmentation (identifying tiles against paper background & thin grid lines).
 * 3. 2D connected-component labeling and contour extraction.
 * 4. Shape, area, and aspect-ratio filtering to eliminate thin grid lines and stray noise.
 * 5. Tile-center extraction and inverse-homography mapping to (row, col) and musical pitch.
 * 6. Deterministic single-cell conflict resolution (highest confidence tile per cell).
 */
export class DeterministicTileDetector implements ITileDetector {
  public detect(
    imageData: ImageData,
    corners: BoardCorners,
    pitches: PitchName[],
    cols: number,
    options?: Partial<TileDetectionOptions>
  ): DetectedTileCandidate[] {
    const opts: TileDetectionOptions = {
      ...DEFAULT_TILE_DETECTION_OPTIONS,
      ...options,
    };

    const rows = pitches.length;
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;

    // 1. Verify calibration validity
    const H = computeHomography(corners);
    if (!H) return [];
    const Hinv = invertMatrix3x3(H);
    if (!Hinv) return [];

    // 2. Compute approximate board & cell area in pixels
    // Board corner pixel coordinates
    const p0 = { x: corners.topLeft.x * width, y: corners.topLeft.y * height };
    const p1 = { x: corners.topRight.x * width, y: corners.topRight.y * height };
    const p2 = { x: corners.bottomRight.x * width, y: corners.bottomRight.y * height };
    const p3 = { x: corners.bottomLeft.x * width, y: corners.bottomLeft.y * height };

    // Quadrilateral area using shoelace formula
    const boardAreaPx = Math.abs(
      0.5 *
        (p0.x * p1.y - p1.x * p0.y +
          p1.x * p2.y - p2.x * p1.y +
          p2.x * p3.y - p3.x * p2.y +
          p3.x * p0.y - p0.x * p3.y)
    );
    const expectedCellAreaPx = boardAreaPx / (rows * cols);
    const minTileAreaPx = Math.max(16, expectedCellAreaPx * opts.minAreaRatio);
    const maxTileAreaPx = expectedCellAreaPx * opts.maxAreaRatio;

    // 3. Estimate paper background luminance
    let sumLum = 0;
    let sampleCount = 0;
    const step = 4;
    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const u = x / width;
        const v = y / height;
        const boardPt = imageToBoard(u, v, Hinv);
        if (boardPt.x >= 0.1 && boardPt.x <= 0.9 && boardPt.y >= 0.1 && boardPt.y <= 0.9) {
          const idx = (y * width + x) * 4;
          const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
          sumLum += lum;
          sampleCount++;
        }
      }
    }
    const avgPaperLum = sampleCount > 0 ? sumLum / sampleCount : 210;

    // 4. Foreground Mask generation for pixels strictly inside the board
    // A tile pixel is defined as:
    // a) Distinct color (saturation >= 0.22 and not pitch-black) - e.g. cyan, magenta, orange, blue, green, etc.
    // OR
    // b) Moderate luminance contrast (noticeably darker than white paper, but not the thin black 1px ink line)
    const mask = new Uint8Array(width * height);

    // Compute bounding box of board in image pixels to restrict scan
    const minBx = Math.max(0, Math.floor(Math.min(p0.x, p1.x, p2.x, p3.x)));
    const maxBx = Math.min(width - 1, Math.ceil(Math.max(p0.x, p1.x, p2.x, p3.x)));
    const minBy = Math.max(0, Math.floor(Math.min(p0.y, p1.y, p2.y, p3.y)));
    const maxBy = Math.min(height - 1, Math.ceil(Math.max(p0.y, p1.y, p2.y, p3.y)));

    for (let y = minBy; y <= maxBy; y++) {
      const normY = y / height;
      for (let x = minBx; x <= maxBx; x++) {
        const normX = x / width;
        const boardPt = imageToBoard(normX, normY, Hinv);

        // Filter: Must be inside board with slight safety margin
        if (
          boardPt.x < opts.boardMargin ||
          boardPt.x > 1 - opts.boardMargin ||
          boardPt.y < opts.boardMargin ||
          boardPt.y > 1 - opts.boardMargin
        ) {
          continue;
        }

        const idx = (y * width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];

        const [h, s, v] = rgbToHsv(r, g, b);
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;

        // Foreground Token Classification:
        // Prioritizes red circle/triangle tokens and distinct colored/contrast tokens against paper:
        // 1. Red circle/triangle tokens: in RGB space, red is distinctly stronger than green and blue
        const isRedToken = (r - g > 16 && r - b > 16 && r > 50) ||
          ((h <= 28 || h >= 332) && s >= 0.20 && v >= 0.22);

        // 2. Other colored tokens (yellow, green, orange, cyan, blue, magenta stickers/cutouts)
        //    White paper has saturation < 0.16. Colored paper has distinct saturation (s >= 0.22)
        //    and chromatic spread between max and min channel > 22.
        const maxCh = Math.max(r, g, b);
        const minCh = Math.min(r, g, b);
        const isSaturatedToken = s >= 0.22 && v >= 0.22 && (maxCh - minCh) > 22;

        // 3. High-contrast tokens distinctly darker than local paper background
        const isContrastToken = lum < avgPaperLum - 38 && lum > 25;

        if (isRedToken || isSaturatedToken || isContrastToken) {
          mask[y * width + x] = 1;
        }
      }
    }

    // 5. Connected Component / Blob Extraction (BFS flood-fill)
    interface Blob {
      pixels: number;
      minX: number;
      maxX: number;
      minY: number;
      maxY: number;
      sumX: number;
      sumY: number;
      colorPixels: number;
      /** Count of pixels that border a non-mask or out-of-bounds neighbor (used for circularity). */
      perimeterPixels: number;
      startPixelIndex: number;
    }

    const visited = new Uint8Array(width * height);
    const blobs: Blob[] = [];
    const totalPixels = width * height;

    // Downscale traversal step to ensure fast real-time performance
    for (let y = minBy; y <= maxBy; y += 2) {
      for (let x = minBx; x <= maxBx; x += 2) {
        const startIdx = y * width + x;
        if (!mask[startIdx] || visited[startIdx]) continue;

        // Start BFS
        let pixels = 0;
        let sumX = 0;
        let sumY = 0;
        let minX = x;
        let maxX = x;
        let minY = y;
        let maxY = y;
        let colorPixels = 0;
        let perimeterPixels = 0;

        const queue: number[] = [startIdx];
        visited[startIdx] = 1;

        while (queue.length > 0) {
          const curr = queue.pop()!;
          const cy = Math.floor(curr / width);
          const cx = curr % width;

          pixels++;
          sumX += cx;
          sumY += cy;
          if (mask[curr] === 2) colorPixels++;

          if (cx < minX) minX = cx;
          if (cx > maxX) maxX = cx;
          if (cy < minY) minY = cy;
          if (cy > maxY) maxY = cy;

          // 4-neighborhood — also check for perimeter (adjacent to non-mask or edge)
          const neighbors = [curr - 1, curr + 1, curr - width, curr + width];
          let isOnPerimeter = false;
          for (const nb of neighbors) {
            if (nb < 0 || nb >= totalPixels || !mask[nb]) {
              isOnPerimeter = true;
            } else if (!visited[nb]) {
              visited[nb] = 1;
              queue.push(nb);
            }
          }
          if (isOnPerimeter) perimeterPixels++;
        }

        // Only store candidate blobs that meet coarse minimum threshold
        if (pixels >= minTileAreaPx * 0.4) {
          // Locate guaranteed external perimeter pixel
          const boundaryPt = findBoundaryStartPixel(mask, width, minX, maxX, minY, maxY);
          const trueStartIdx = boundaryPt ? boundaryPt.y * width + boundaryPt.x : startIdx;

          blobs.push({
            pixels,
            minX,
            maxX,
            minY,
            maxY,
            sumX,
            sumY,
            colorPixels,
            perimeterPixels,
            startPixelIndex: trueStartIdx,
          });
        }
      }
    }

    // 6. Shape & Aspect-Ratio Filtering, Transformation & Cell Resolution
    //
    // Circularity score: 4π × area / perimeter² = 1.0 for a perfect circle.
    // Assumption: equal-subdivision grid cells; tile fills 40–75% of one cell.
    // Circle-mode thresholds are tuned for solid discs (bottle caps, foam dots, coins).
    const candidates: DetectedTileCandidate[] = [];

    for (const blob of blobs) {
      // Area filter: Reject noise specks and oversized blobs (e.g. hands or entire board)
      if (blob.pixels < minTileAreaPx || blob.pixels > maxTileAreaPx) {
        continue;
      }

      const blobW = blob.maxX - blob.minX + 1;
      const blobH = blob.maxY - blob.minY + 1;
      const aspectRatio = blobW / Math.max(1, blobH);

      // ── Circularity metric ──────────────────────────────────────────────────
      // 4π × A / P²  →  1.0 for a perfect disc, ~0.785 for a square,
      // ~0.3 or lower for long thin lines.
      const circularity =
        blob.perimeterPixels > 0
          ? (4 * Math.PI * blob.pixels) / (blob.perimeterPixels * blob.perimeterPixels)
          : 0;

      // ── Shape Analysis (Circles vs Triangles vs Rectangles) ──────────────────
      const bboxArea = blobW * blobH;
      const extent = blob.pixels / Math.max(1, bboxArea);

      let isCandidateAccepted = false;
      let triangleConfidence = 0;
      let triVertexCount: number | undefined;
      let triSolidity: number | undefined;
      let triFitRatio: number | undefined;
      let triVerticesImg: Point2D[] | undefined;
      let triCentroid: Point | undefined;

      if (opts.targetShape === 'circle') {
        // Circles: near-square bounding box, high circularity, solid fill ratio
        // Strictly rejects triangles, squares, and rectangles:
        // 1. Triangles have extent <= 0.60
        // 2. Circles have extent ~0.785 (pi/4) and empty bounding box corners
        // 3. Squares and rectangles have extent >= 0.90 and filled bounding box corners
        const radius = (blobW + blobH) / 4;
        const expectedCircleArea = Math.PI * radius * radius;
        const fillRatio = blob.pixels / expectedCircleArea;

        // Sample the 4 outer corners of the bounding box
        // For a true circle, the bounding box corners are outside the radius and empty.
        // For a square/rectangle, the corners are solid.
        const cornerSampleW = Math.max(1, Math.floor(blobW * 0.15));
        const cornerSampleH = Math.max(1, Math.floor(blobH * 0.15));
        let cornerFilledPixels = 0;
        const totalCornerSamples = cornerSampleW * cornerSampleH * 4;

        for (let dy = 0; dy < cornerSampleH; dy++) {
          for (let dx = 0; dx < cornerSampleW; dx++) {
            if (mask[(blob.minY + dy) * width + (blob.minX + dx)]) cornerFilledPixels++;
            if (mask[(blob.minY + dy) * width + (blob.maxX - dx)]) cornerFilledPixels++;
            if (mask[(blob.maxY - dy) * width + (blob.minX + dx)]) cornerFilledPixels++;
            if (mask[(blob.maxY - dy) * width + (blob.maxX - dx)]) cornerFilledPixels++;
          }
        }
        const cornerFillRatio = cornerFilledPixels / Math.max(1, totalCornerSamples);

        const passesCircle =
          aspectRatio >= 0.65 &&
          aspectRatio <= 1.55 &&
          circularity >= 0.35 &&
          fillRatio >= 0.40 &&
          fillRatio <= 1.25 &&
          extent >= 0.62 &&
          extent <= 0.88 &&
          cornerFillRatio <= 0.35;

        if (passesCircle) {
          isCandidateAccepted = true;
        }
      } else if (opts.targetShape === 'triangle') {
        // Triangles: extract outer boundary contour & run comprehensive geometric analysis
        const startX = blob.startPixelIndex % width;
        const startY = Math.floor(blob.startPixelIndex / width);
        const contour = traceContour(mask, width, height, startX, startY);
        const triAnalysis = analyzeTriangleContour(contour, blobW, blobH, blob.pixels);

        triVertexCount = triAnalysis.vertexCount;
        triSolidity = triAnalysis.solidity;
        triFitRatio = triAnalysis.inscribedRatio;
        triangleConfidence = triAnalysis.confidence;
        triCentroid = triAnalysis.centroid;
        triVerticesImg = triAnalysis.vertices.map((v) => ({
          x: v.x / width,
          y: v.y / height,
        }));

        // Reject circles (circles have inscribedRatio <= 0.45 and extent >= 0.68)
        if (triAnalysis.isTriangle && extent <= 0.64) {
          isCandidateAccepted = true;
        }
      } else if (opts.targetShape === 'rectangle') {
        // Rectangles are elongated; reject anything that looks circular or triangular.
        if (aspectRatio >= 1.1 && aspectRatio <= 3.8 && circularity <= 0.72) {
          isCandidateAccepted = true;
        }
      } else {
        // 'any': wide window
        if (aspectRatio >= opts.minAspectRatio && aspectRatio <= opts.maxAspectRatio) {
          isCandidateAccepted = true;
        }
      }

      if (!isCandidateAccepted) {
        continue;
      }

      // Calculate centroid: blend geometric vertex centroid with pixel center of mass for triangles
      const cx =
        triCentroid && opts.targetShape === 'triangle'
          ? triCentroid.x * 0.7 + (blob.sumX / blob.pixels) * 0.3
          : blob.sumX / blob.pixels;
      const cy =
        triCentroid && opts.targetShape === 'triangle'
          ? triCentroid.y * 0.7 + (blob.sumY / blob.pixels) * 0.3
          : blob.sumY / blob.pixels;

      // Transform to normalized image coordinates [0, 1] x [0, 1]
      const centerImg: Point2D = {
        x: cx / width,
        y: cy / height,
      };

      // Transform to normalized board coordinates (u, v)
      const centerBoard = imageToBoard(centerImg.x, centerImg.y, Hinv);

      // Verify that tile center is strictly within board margins
      if (
        centerBoard.x < opts.boardMargin ||
        centerBoard.x > 1 - opts.boardMargin ||
        centerBoard.y < opts.boardMargin ||
        centerBoard.y > 1 - opts.boardMargin
      ) {
        continue;
      }

      // Determine nearest valid row and column
      const col = Math.min(cols - 1, Math.max(0, Math.floor(centerBoard.x * cols)));
      const row = Math.min(rows - 1, Math.max(0, Math.floor(centerBoard.y * rows)));
      const pitch = pitches[row];

      // ── Confidence score [0, 1] ─────────────────────────────────────────────
      // Emphasize shape (circularity, fill ratio, aspect ratio) and cell position
      // rather than relying on color identity.
      // 1. Center alignment in cell (distance from cell center in board space)
      const cellCenterU = (col + 0.5) / cols;
      const cellCenterV = (row + 0.5) / rows;
      const distU = Math.abs(centerBoard.x - cellCenterU) * cols; // [0, 0.5]
      const distV = Math.abs(centerBoard.y - cellCenterV) * rows; // [0, 0.5]
      const centerAlignment = Math.max(0, 1 - Math.sqrt(distU * distU + distV * distV) * 1.5);

      // 2. Area plausibility
      const idealArea = expectedCellAreaPx * 0.40;
      const areaScore = Math.max(0, 1 - Math.abs(blob.pixels - idealArea) / idealArea);

      // 3. Circularity and shape match score (primary weighting in circle mode)
      const shapeScore = Math.min(1.0, Math.max(0, circularity));

      let confidence: number;
      if (opts.targetShape === 'circle') {
        // In circle mode: 50% circularity/shape + 30% center alignment + 20% area match
        confidence = Math.min(
          1.0,
          0.50 * shapeScore + 0.30 * centerAlignment + 0.20 * areaScore
        );
      } else if (opts.targetShape === 'triangle') {
        // In triangle mode: 50% triangle geometric confidence + 30% center alignment + 20% area match
        confidence = Math.min(
          1.0,
          0.50 * (triangleConfidence || 0.85) + 0.30 * centerAlignment + 0.20 * areaScore
        );
      } else {
        confidence = Math.min(
          1.0,
          0.50 * centerAlignment + 0.50 * areaScore
        );
      }

      // ── Infer displayed shape tag ───────────────────────────────────────────
      let inferredShape: PhysicalTileShape = 'any';
      if (
        triVertexCount === 3 ||
        (triFitRatio && triFitRatio >= 0.82) ||
        (extent >= 0.32 && extent <= 0.62 && circularity < 0.68)
      ) {
        inferredShape = 'triangle';
      } else if (circularity >= 0.55 || extent >= 0.65) {
        inferredShape = 'circle';
      } else if (aspectRatio > 1.4) {
        inferredShape = 'rectangle';
      }

      candidates.push({
        id: `tile-candidate-${row}-${col}-${Math.round(cx)}-${Math.round(cy)}`,
        centerImg,
        centerBoard,
        row,
        col,
        pitch,
        confidence,
        areaPixels: blob.pixels,
        aspectRatio,
        circularityScore: circularity,
        vertexCount: triVertexCount,
        extent,
        solidity: triSolidity,
        triangleFitRatio: triFitRatio,
        verticesImg: triVerticesImg,
        pixelBounds: {
          minX: blob.minX,
          maxX: blob.maxX,
          minY: blob.minY,
          maxY: blob.maxY,
        },
        colorTag: inferredShape === 'triangle' ? 'triangle-token' : 'circle-token',
        shape: inferredShape,
      });
    }

    // 7. Conflicting Detections Policy:
    // If multiple candidates map to the same cell (r, c),
    // retain the candidate with highest confidence (closest to cell center, best area match).
    const resolvedByCell = new Map<string, DetectedTileCandidate>();

    for (const cand of candidates) {
      const key = `${cand.row}-${cand.col}`;
      const existing = resolvedByCell.get(key);
      if (!existing || cand.confidence > existing.confidence) {
        resolvedByCell.set(key, cand);
      }
    }

    return Array.from(resolvedByCell.values());
  }
}
