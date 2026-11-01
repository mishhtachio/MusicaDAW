import type { BoardConfig } from '../types/music';

/**
 * Initial physical board layout specification.
 * - 5 pitch rows: C6, A5, G5, E5, D5 (from top to bottom)
 * - 4 time columns (initial default, fully expandable)
 * - 100 BPM default tempo
 */
export const INITIAL_BOARD_CONFIG: BoardConfig = {
  pitches: ['C6', 'A5', 'G5', 'E5', 'D5'],
  cols: 4,
  bpm: 100,
};

/**
 * Create a custom or expanded board configuration easily.
 */
export function createBoardConfig(options?: Partial<BoardConfig>): BoardConfig {
  return {
    pitches: options?.pitches ?? [...INITIAL_BOARD_CONFIG.pitches],
    cols: Math.max(1, options?.cols ?? INITIAL_BOARD_CONFIG.cols),
    bpm: Math.max(30, Math.min(240, options?.bpm ?? INITIAL_BOARD_CONFIG.bpm)),
  };
}
