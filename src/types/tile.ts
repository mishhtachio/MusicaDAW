import type { Point2D } from './camera';
import type { PitchName } from './music';

export type PhysicalTileShape = 'circle' | 'triangle' | 'rectangle' | 'any';

/**
 * Represents a single detected physical tile candidate in a camera frame.
 */
export interface DetectedTileCandidate {
  /** Unique ephemeral candidate identifier */
  id: string;
  /** Center of the tile in normalized image coordinates [0, 1] x [0, 1] */
  centerImg: Point2D;
  /** Center of the tile in normalized board coordinates (u, v) in [0, 1] x [0, 1] */
  centerBoard: Point2D;
  /** Nearest grid row (0 to rows - 1) */
  row: number;
  /** Nearest grid column (0 to cols - 1) */
  col: number;
  /** Pitch corresponding to the detected row */
  pitch: PitchName;
  /** Detection confidence score in [0, 1] */
  confidence: number;
  /** Area in processing pixels */
  areaPixels: number;
  /** Width / Height bounding box aspect ratio */
  aspectRatio: number;
  /** Circularity score (1.0 = perfect circle) */
  circularityScore?: number;
  /** Triangle vertex count & extent metrics */
  vertexCount?: number;
  extent?: number;
  solidity?: number;
  triangleFitRatio?: number;
  /** Normalized image coordinates for the detected triangle corner vertices [V0, V1, V2] */
  verticesImg?: Point2D[];
  /** Pixel bounding box in image coordinates */
  pixelBounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
  /** Color / contrast profile tag (e.g. 'colored-token', 'contrast-token') */
  colorTag?: string;
  /** Inferred or selected physical shape */
  shape?: PhysicalTileShape;
}

/**
 * Filter configuration options for tile detection.
 */
export interface TileDetectionOptions {
  /** Target physical tile shape to prioritize */
  targetShape: PhysicalTileShape;
  /** Minimum area ratio relative to an average cell's area */
  minAreaRatio: number;
  /** Maximum area ratio relative to an average cell's area */
  maxAreaRatio: number;
  /** Minimum aspect ratio (width / height) */
  minAspectRatio: number;
  /** Maximum aspect ratio (width / height) */
  maxAspectRatio: number;
  /** Margin inside board [0, 1] to filter out edge spillover */
  boardMargin: number;
}

export const DEFAULT_TILE_DETECTION_OPTIONS: TileDetectionOptions = {
  targetShape: 'circle', // Optimized for circular tokens (bottle caps, discs, coins)
  minAreaRatio: 0.04, // Support smaller circular tokens as well as large ones
  maxAreaRatio: 0.80,
  minAspectRatio: 0.70, // Accommodates perspective tilt of circular discs
  maxAspectRatio: 3.50, // Permits rectangular cards as well in 'any' or 'rectangle'
  boardMargin: 0.02,
};

/**
 * Configuration for temporal stability debouncing.
 */
export interface TemporalStabilityConfig {
  /** Number of consecutive frames a tile must be seen before being added */
  consecutiveFramesToConfirm: number;
  /** Number of consecutive missing frames before an active tile is removed */
  missingFramesToDrop: number;
  /** Rate of camera processing in frames per second */
  targetFps: number;
}

export const DEFAULT_TEMPORAL_CONFIG: TemporalStabilityConfig = {
  consecutiveFramesToConfirm: 2,
  missingFramesToDrop: 5,
  targetFps: 8,
};

export type CellTrackingState = 'empty' | 'pending_add' | 'active' | 'pending_remove';

export interface CellTracker {
  row: number;
  col: number;
  state: CellTrackingState;
  seenCount: number;
  missingCount: number;
  candidate: DetectedTileCandidate | null;
}
