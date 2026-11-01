import type { PitchName } from './music';

export interface Point2D {
  /** Normalized X coordinate in [0, 1] relative to video container width */
  x: number;
  /** Normalized Y coordinate in [0, 1] relative to video container height */
  y: number;
}

export interface BoardCorners {
  topLeft: Point2D;
  topRight: Point2D;
  bottomRight: Point2D;
  bottomLeft: Point2D;
}

export type CornerKey = keyof BoardCorners;

export interface LineSegment {
  p1: Point2D;
  p2: Point2D;
  isBoundary?: boolean;
  row?: number;
  col?: number;
}

export interface CellGeometry {
  row: number;
  col: number;
  pitch: PitchName;
  /** The 4 corner points of this cell in normalized video coordinates: [TL, TR, BR, BL] */
  polygon: [Point2D, Point2D, Point2D, Point2D];
  /** Center point in normalized coordinates */
  center: Point2D;
}

export interface CalibrationData {
  corners: BoardCorners;
  rows: number;
  cols: number;
  isValid: boolean;
  updatedAt: number;
}

export type AppMode = 'manual' | 'camera';

export type CameraStatus = 'idle' | 'requesting' | 'active' | 'error';

