export interface DrumVoiceInfo {
  row: number;
  id: string;
  name: string;
  shortName: string;
  icon: string;
  color: string;
}

export const DRUM_VOICES: DrumVoiceInfo[] = [
  { row: 0, id: 'hihat', name: 'Hi-Hat', shortName: 'HAT', icon: '🔔', color: '#06b6d4' },
  { row: 1, id: 'clap', name: 'Hand Clap', shortName: 'CLP', icon: '👏', color: '#ec4899' },
  { row: 2, id: 'snare', name: 'Snare Drum', shortName: 'SNR', icon: '🥁', color: '#f59e0b' },
  { row: 3, id: 'tom', name: 'Low Tom', shortName: 'TOM', icon: '🪘', color: '#8b5cf6' },
  { row: 4, id: 'kick', name: 'Bass Kick', shortName: 'KIK', icon: '💥', color: '#ef4444' },
];

export function getDrumVoiceForRow(row: number): DrumVoiceInfo {
  const normalized = Math.max(0, Math.min(DRUM_VOICES.length - 1, row));
  return DRUM_VOICES[normalized];
}

