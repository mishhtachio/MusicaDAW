/**
 * Core musical types and data structures for the piano roll.
 * Kept completely decoupled from React rendering and Web Audio nodes.
 */

export type PitchName = string;
export type InstrumentType = 'piano' | 'drums';

export interface SavedTrack {
  id: string;
  name: string;
  instrument: InstrumentType;
  notes: NoteEvent[];
  cols: number;
  bpm: number;
  createdAt: number;
  color?: string;
}

export interface NoteEvent {
  /** Unique identifier for the note */
  id: string;
  /** Row index in the piano roll grid (0 = top row) */
  row: number;
  /** Column / time step index (0 = first step) */
  col: number;
  /** Standard pitch notation label (e.g., 'C6', 'A5') */
  pitch: PitchName;
  /** Duration in grid time steps (defaults to 1) */
  duration: number;
}

export interface BoardConfig {
  /** Pitches configured from top row (index 0) to bottom row */
  pitches: PitchName[];
  /** Total number of time columns / steps */
  cols: number;
  /** Initial playback tempo in beats per minute */
  bpm: number;
}

export type TransportStatus = 'stopped' | 'playing' | 'paused';

export interface TransportState {
  status: TransportStatus;
  bpm: number;
  currentStep: number;
}

