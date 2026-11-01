import type { PitchName } from '../types/music';

/**
 * Standard pitch to MIDI note offset table.
 */
const NOTE_OFFSETS: Record<string, number> = {
  C: 0,
  'C#': 1,
  Db: 1,
  D: 2,
  'D#': 3,
  Eb: 3,
  E: 4,
  F: 5,
  'F#': 6,
  Gb: 6,
  G: 7,
  'G#': 8,
  Ab: 8,
  A: 9,
  'A#': 10,
  Bb: 10,
  B: 11,
};

/**
 * Converts a standard pitch name (e.g. 'A4', 'C6', 'G5') to its equal temperament frequency in Hz.
 * Standard pitch A4 = 440 Hz (MIDI note 69).
 */
export function pitchNameToFrequency(pitch: PitchName): number {
  const match = pitch.trim().match(/^([A-G][b#]?)(-?\d+)$/);
  if (!match) {
    console.warn(`[pitchMapping] Invalid pitch name format: "${pitch}", defaulting to 440Hz`);
    return 440;
  }

  const noteName = match[1];
  const octave = parseInt(match[2], 10);
  const noteOffset = NOTE_OFFSETS[noteName];

  if (noteOffset === undefined) {
    console.warn(`[pitchMapping] Unknown note: "${noteName}", defaulting to 440Hz`);
    return 440;
  }

  // MIDI note number: C-1 is 0, C4 (middle C) is 60, A4 is 69
  const midiNumber = (octave + 1) * 12 + noteOffset;
  // A4 = 69 => 440Hz
  return 440 * Math.pow(2, (midiNumber - 69) / 12);
}

/**
 * Specific predefined frequency mapping table for the project's default initial pitches.
 * C6, A5, G5, E5, D5 (from top to bottom).
 */
export const DEFAULT_PITCH_FREQUENCIES: Record<string, number> = {
  C6: pitchNameToFrequency('C6'), // ~1046.50 Hz
  A5: pitchNameToFrequency('A5'), // 880.00 Hz
  G5: pitchNameToFrequency('G5'), // ~783.99 Hz
  E5: pitchNameToFrequency('E5'), // ~659.25 Hz
  D5: pitchNameToFrequency('D5'), // ~587.33 Hz
};

/**
 * Child-friendly color scheme for pitch pills and note highlights.
 * Inspired by the reference board's vibrant green tabs and playful palette.
 */
export const PITCH_PALETTE: Record<string, { bg: string; border: string; text: string }> = {
  C6: { bg: '#8ae28d', border: '#4cae4f', text: '#1b4d1d' }, // Bright Lime Green
  A5: { bg: '#8ae28d', border: '#4cae4f', text: '#1b4d1d' },
  G5: { bg: '#8ae28d', border: '#4cae4f', text: '#1b4d1d' },
  E5: { bg: '#8ae28d', border: '#4cae4f', text: '#1b4d1d' },
  D5: { bg: '#8ae28d', border: '#4cae4f', text: '#1b4d1d' },
  C5: { bg: '#8ae28d', border: '#4cae4f', text: '#1b4d1d' },
};
