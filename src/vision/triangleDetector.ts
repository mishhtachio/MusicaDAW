export interface Point {
  x: number;
  y: number;
}

/**
 * Finds a guaranteed external perimeter pixel for a blob by finding the
 * first pixel from the top that borders a background (0) pixel above or left.
 */
export function findBoundaryStartPixel(
  mask: Uint8Array,
  width: number,
  minX: number,
  maxX: number,
  minY: number,
  maxY: number
): Point | null {
  for (let y = minY; y <= maxY; y++) {
    const rowOffset = y * width;
    for (let x = minX; x <= maxX; x++) {
      if (mask[rowOffset + x]) {
        // Must border background above, below, left, or right
        const topBg = y === 0 || !mask[(y - 1) * width + x];
        const leftBg = x === 0 || !mask[rowOffset + (x - 1)];
        if (topBg || leftBg) {
          return { x, y };
        }
      }
    }
  }
  return null;
}

/**
 * Traces the external boundary contour of a binary mask blob starting from (startX, startY)
 * using the Moore-Neighbor Boundary Tracing algorithm.
 * Guarantees a clean, clockwise, closed boundary path.
 */
export function traceContour(
  mask: Uint8Array,
  width: number,
  height: number,
  startX: number,
  startY: number
): Point[] {
  const contour: Point[] = [];
  let currX = startX;
  let currY = startY;

  // 8-neighborhood directions clockwise starting from East (0)
  // 0: (1, 0), 1: (1, 1), 2: (0, 1), 3: (-1, 1), 4: (-1, 0), 5: (-1, -1), 6: (0, -1), 7: (1, -1)
  const dx = [1, 1, 0, -1, -1, -1, 0, 1];
  const dy = [0, 1, 1, 1, 0, -1, -1, -1];

  contour.push({ x: currX, y: currY });

  // Starting entering direction from North (top background pixel)
  let bDir = 6;
  const maxSteps = 3000;
  let steps = 0;

  while (steps++ < maxSteps) {
    let nextX = -1;
    let nextY = -1;
    let nextBDir = 0;

    // Search clockwise around current pixel starting from (bDir + 1) % 8
    for (let i = 0; i < 8; i++) {
      const dir = (bDir + 1 + i) % 8;
      const nx = currX + dx[dir];
      const ny = currY + dy[dir];

      if (nx >= 0 && nx < width && ny >= 0 && ny < height && mask[ny * width + nx]) {
        nextX = nx;
        nextY = ny;
        // Direction from next to current
        nextBDir = (dir + 4) % 8;
        break;
      }
    }

    if (nextX === -1 || (nextX === startX && nextY === startY)) {
      break; // Closed loop or solitary pixel
    }

    contour.push({ x: nextX, y: nextY });
    currX = nextX;
    currY = nextY;
    bDir = nextBDir;
  }

  return contour;
}

/**
 * Calculates perpendicular distance from point p to line segment (p1, p2).
 */
export function perpendicularDistance(p: Point, p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const mag = Math.hypot(dx, dy);
  if (mag === 0) {
    return Math.hypot(p.x - p1.x, p.y - p1.y);
  }
  return Math.abs(dy * p.x - dx * p.y + p2.x * p1.y - p2.y * p1.x) / mag;
}

/**
 * Douglas-Peucker polygonal approximation algorithm.
 */
export function douglasPeucker(points: Point[], epsilon: number): Point[] {
  if (points.length <= 2) {
    return [...points];
  }

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

/**
 * Calculates the polygon perimeter.
 */
export function polygonPerimeter(points: Point[]): number {
  let peri = 0;
  for (let i = 0; i < points.length; i++) {
    const next = points[(i + 1) % points.length];
    peri += Math.hypot(next.x - points[i].x, next.y - points[i].y);
  }
  return peri;
}

/**
 * Calculates polygon area using the Shoelace formula.
 */
export function polygonArea(points: Point[]): number {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  return Math.abs(area) / 2;
}

/**
 * Computes the convex hull of a point set using Andrew's Monotone Chain algorithm.
 */
export function convexHull(points: Point[]): Point[] {
  if (points.length <= 3) return [...points];

  const sorted = [...points].sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));

  const cross = (o: Point, a: Point, b: Point) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

  const lower: Point[] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }

  const upper: Point[] = [];
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

/**
 * Finds the 3 hull vertices that maximize the area of the inscribed triangle.
 *
 * Mathematical principle:
 * For a real triangle (even with blunted or rounded scissors tips), the largest
 * inscribed triangle in its convex hull covers >= 85% (typically 90% - 99%) of the hull area.
 * For a circle, it covers only 3*sqrt(3)/(4*pi) ≈ 41.3%.
 * For a rectangle/square, it covers exactly 50%.
 */
export function findMaxAreaInscribedTriangle(hull: Point[]): {
  vertices: [Point, Point, Point];
  area: number;
} | null {
  if (hull.length < 3) return null;
  if (hull.length === 3) {
    return {
      vertices: [hull[0], hull[1], hull[2]],
      area: polygonArea(hull),
    };
  }

  let maxArea = 0;
  let bestVertices: [Point, Point, Point] = [hull[0], hull[1], hull[2]];
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
          bestVertices = [hull[i], hull[j], hull[k]];
        }
      }
    }
  }

  return { vertices: bestVertices, area: maxArea };
}

/**
 * Computes the 3 interior angles of triangle (p1, p2, p3) in degrees.
 */
export function calculateTriangleAngles(p1: Point, p2: Point, p3: Point): [number, number, number] {
  const a = Math.hypot(p2.x - p3.x, p2.y - p3.y);
  const b = Math.hypot(p1.x - p3.x, p1.y - p3.y);
  const c = Math.hypot(p1.x - p2.x, p1.y - p2.y);

  if (a === 0 || b === 0 || c === 0) return [0, 0, 0];

  const angle1 =
    Math.acos(Math.max(-1, Math.min(1, (b * b + c * c - a * a) / (2 * b * c)))) *
    (180 / Math.PI);
  const angle2 =
    Math.acos(Math.max(-1, Math.min(1, (a * a + c * c - b * b) / (2 * a * c)))) *
    (180 / Math.PI);
  const angle3 = 180 - angle1 - angle2;

  return [angle1, angle2, angle3];
}

export interface TriangleAnalysis {
  isTriangle: boolean;
  vertexCount: number;
  vertices: Point[];
  inscribedRatio: number; // Ratio of inscribed triangle to convex hull (>= 0.82 for triangles)
  extent: number; // Blob area / Bounding Box area (~0.32 - 0.62)
  solidity: number; // Blob area / Convex hull area (>= 0.84)
  aspectRatio: number;
  confidence: number;
  centroid: Point;
}

/**
 * Rigorously analyzes whether a contour represents a physical triangular tile.
 *
 * Evaluation Criteria:
 * 1. Inscribed Triangle Fit: Area(Triangle ABC) / Area(Convex Hull) >= 0.82.
 *    (Massive mathematical separation: Triangles are 0.88-0.99, Circles are 0.41, Squares are 0.50).
 * 2. Adaptive Vertex Count: Douglas-Peucker simplification produces 3 dominant corners
 *    (or 4 with a blunted/hand-cut scissors tip).
 * 3. Bounding Box Extent: 0.30 <= Extent <= 0.64 (circles are >= 0.68).
 * 4. Convexity / Solidity: Solidity >= 0.84.
 * 5. Non-Degenerate Angles: Every interior angle is between 18° and 144°.
 */
export function analyzeTriangleContour(
  rawContour: Point[],
  blobWidth: number,
  blobHeight: number,
  pixelArea: number
): TriangleAnalysis {
  const fallbackCentroid: Point = {
    x: rawContour.length > 0 ? rawContour[0].x : 0,
    y: rawContour.length > 0 ? rawContour[0].y : 0,
  };

  if (rawContour.length < 8) {
    return {
      isTriangle: false,
      vertexCount: rawContour.length,
      vertices: rawContour,
      inscribedRatio: 0,
      extent: 0,
      solidity: 0,
      aspectRatio: 1,
      confidence: 0,
      centroid: fallbackCentroid,
    };
  }

  const peri = polygonPerimeter(rawContour);

  // 1. Multi-scale Adaptive Douglas-Peucker approximation
  // Tests adaptive epsilon tolerances: [0.036, 0.046, 0.058, 0.072] * peri
  const epsilons = [0.038 * peri, 0.048 * peri, 0.060 * peri, 0.075 * peri];
  let bestVertices: Point[] = [];
  let bestVCount = 99;

  for (const eps of epsilons) {
    const approx = douglasPeucker(rawContour, eps);
    const cleaned: Point[] = [];
    for (const v of approx) {
      if (
        cleaned.length === 0 ||
        Math.hypot(v.x - cleaned[cleaned.length - 1].x, v.y - cleaned[cleaned.length - 1].y) > 4
      ) {
        cleaned.push(v);
      }
    }
    if (
      cleaned.length > 2 &&
      Math.hypot(cleaned[0].x - cleaned[cleaned.length - 1].x, cleaned[0].y - cleaned[cleaned.length - 1].y) < 8
    ) {
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

  // 2. Convex Hull & Inscribed Triangle Math
  const hull = convexHull(rawContour);
  const hullArea = Math.max(1, polygonArea(hull));
  const maxInscribed = findMaxAreaInscribedTriangle(hull);
  const inscribedRatio = maxInscribed ? maxInscribed.area / hullArea : 0;

  // 3. Extent & Solidity
  const bboxArea = Math.max(1, blobWidth * blobHeight);
  const extent = pixelArea / bboxArea;
  const solidity = Math.min(1.0, pixelArea / hullArea);
  const aspectRatio = blobWidth / Math.max(1, blobHeight);

  // 4. Interior Angles
  let anglesValid = false;
  let triangleVertices: Point[] = bestVertices;

  if (maxInscribed && (bestVCount === 3 || bestVCount === 4 || inscribedRatio >= 0.82)) {
    // Use the 3 sharpest physical corner vertices from the convex hull
    const [v0, v1, v2] = maxInscribed.vertices;
    triangleVertices = [v0, v1, v2];
    const angles = calculateTriangleAngles(v0, v1, v2);
    // Real triangles have angles between 18° and 144°
    anglesValid = angles.every((a) => a >= 18 && a <= 144);
  }

  // 5. Centroid calculation
  let centroid: Point;
  if (triangleVertices.length === 3) {
    centroid = {
      x: (triangleVertices[0].x + triangleVertices[1].x + triangleVertices[2].x) / 3,
      y: (triangleVertices[0].y + triangleVertices[1].y + triangleVertices[2].y) / 3,
    };
  } else {
    centroid = fallbackCentroid;
  }

  // ── Verification Gates for Physical Triangles ──
  // A. Inscribed triangle covers >= 82% of convex hull (circles are <= 45%, squares are 50%)
  const hasInscribedFit = inscribedRatio >= 0.82;

  // B. Vertex count: 3 is ideal; 4 is acceptable for blunted handmade corners
  const hasTriangleVertices = bestVCount === 3 || bestVCount === 4 || hasInscribedFit;

  // C. Extent: Triangle occupies ~0.30 to 0.64 of its bounding box (solid circle is ~0.785)
  const hasTriangleExtent = extent >= 0.30 && extent <= 0.64;

  // D. Convexity: Solid shape (solidity >= 0.84)
  const isConvex = solidity >= 0.84;

  // E. Plausible aspect ratio under 3D perspective
  const plausibleAspectRatio = aspectRatio >= 0.45 && aspectRatio <= 2.25;

  const isTriangle =
    (hasInscribedFit || (hasTriangleVertices && hasTriangleExtent)) &&
    isConvex &&
    plausibleAspectRatio &&
    anglesValid;

  // Confidence computation
  let confidence = 0;
  if (isTriangle) {
    const fitScore = Math.min(1.0, (inscribedRatio - 0.80) / 0.18); // 0 to 1
    const extentScore = Math.max(0, 1 - Math.abs(extent - 0.48) / 0.18);
    const solidityScore = Math.min(1.0, (solidity - 0.84) / 0.14);
    confidence = Math.min(1.0, 0.45 * fitScore + 0.30 * extentScore + 0.25 * solidityScore);
  }

  return {
    isTriangle,
    vertexCount: bestVCount === 99 ? triangleVertices.length : bestVCount,
    vertices: triangleVertices,
    inscribedRatio,
    extent,
    solidity,
    aspectRatio,
    confidence,
    centroid,
  };
}
