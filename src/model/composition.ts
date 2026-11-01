import type { NoteEvent, PitchName } from '../types/music';

/**
 * Creates a unique note identifier based on its grid coordinates.
 */
export function getNoteId(row: number, col: number): string {
  return `note-${row}-${col}`;
}

/**
 * Creates a note event.
 */
export function createNote(
  row: number,
  col: number,
  pitch: PitchName,
  duration = 1
): NoteEvent {
  return {
    id: getNoteId(row, col),
    row,
    col,
    pitch,
    duration,
  };
}

/**
 * Finds a note at given row and column coordinates.
 */
export function findNoteAt(
  notes: readonly NoteEvent[],
  row: number,
  col: number
): NoteEvent | undefined {
  return notes.find((n) => n.row === row && n.col === col);
}

/**
 * Checks if a note exists at row and column.
 */
export function hasNoteAt(
  notes: readonly NoteEvent[],
  row: number,
  col: number
): boolean {
  return notes.some((n) => n.row === row && n.col === col);
}

/**
 * Toggles a note in the composition: removes if present, adds if empty.
 * Returns a new array (immutable).
 */
export function toggleNoteAt(
  notes: readonly NoteEvent[],
  row: number,
  col: number,
  pitch: PitchName
): NoteEvent[] {
  const existingIndex = notes.findIndex((n) => n.row === row && n.col === col);
  if (existingIndex >= 0) {
    return notes.filter((_, idx) => idx !== existingIndex);
  } else {
    return [...notes, createNote(row, col, pitch)];
  }
}

/**
 * Retrieves all notes active at a particular column step.
 */
export function getNotesForStep(
  notes: readonly NoteEvent[],
  col: number
): NoteEvent[] {
  return notes.filter((n) => n.col === col);
}

/**
 * Creates an initial example melody for the board, inspired by the reference board.
 * For 4 columns with pitches [C6, A5, G5, E5, D5]:
 * Col 0: C6 (row 0)
 * Col 1: A5 (row 1)
 * Col 2: G5 (row 2)
 * Col 3: A5 (row 1)
 */
export function createInitialExampleMelody(
  pitches: PitchName[],
  cols: number
): NoteEvent[] {
  const notes: NoteEvent[] = [];
  const pattern = [
    { row: 0, col: 0 }, // C6
    { row: 1, col: 1 }, // A5
    { row: 2, col: 2 }, // G5
    { row: 1, col: 3 }, // A5
  ];

  for (const item of pattern) {
    if (item.row < pitches.length && item.col < cols) {
      notes.push(createNote(item.row, item.col, pitches[item.row]));
    }
  }

  return notes;
}
