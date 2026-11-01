import React from 'react';
import type { InstrumentType } from '../../types/music';

interface FreejamInstrumentBarProps {
  currentInstrument: InstrumentType;
  onSelectInstrument: (instrument: InstrumentType) => void;
  onPreviewSound?: (instrument: InstrumentType) => void;
}


export const FreejamInstrumentBar: React.FC<FreejamInstrumentBarProps> = ({
  currentInstrument,
  onSelectInstrument,
  onPreviewSound,
}) => {
  const handleClick = (inst: InstrumentType) => {
    onSelectInstrument(inst);
    onPreviewSound?.(inst);
  };

  return (
    <div className="freejam-instrument-bar" role="radiogroup" aria-label="Instrument selector">
      {/* 1. Piano (Blue) */}
      <button
        type="button"
        role="radio"
        aria-checked={currentInstrument === 'piano'}
        className={`freejam-music-badge badge-blue ${currentInstrument === 'piano' ? 'active' : ''}`}
        onClick={() => handleClick('piano')}
        title="Piano (Circular physical tiles)"
      >
        <span className="music-note-icon">♪</span>
        <span className="badge-gloss" />
      </button>

      {/* 2. Drums (Pink / Magenta) */}
      <button
        type="button"
        role="radio"
        aria-checked={currentInstrument === 'drums'}
        className={`freejam-music-badge badge-pink ${currentInstrument === 'drums' ? 'active' : ''}`}
        onClick={() => handleClick('drums')}
        title="Drums (Triangular physical tiles)"
      >
        <span className="music-note-icon">♪</span>
        <span className="badge-gloss" />
      </button>

      {/* 3. Synth / Flute (Teal / Emerald) - extra sound badge */}
      <button
        type="button"
        role="radio"
        aria-checked={false}
        className="freejam-music-badge badge-teal"
        onClick={() => handleClick('piano')}
        title="Acoustic Bell (Alternative Voice)"
      >
        <span className="music-note-icon">♪</span>
        <span className="badge-gloss" />
      </button>

      {/* 4. Percussion / FX (Coral Red) - extra sound badge */}
      <button
        type="button"
        role="radio"
        aria-checked={false}
        className="freejam-music-badge badge-coral"
        onClick={() => handleClick('drums')}
        title="Bass Kick & Claps (Alternative Voice)"
      >
        <span className="music-note-icon">♪</span>
        <span className="badge-gloss" />
      </button>
    </div>
  );
};
