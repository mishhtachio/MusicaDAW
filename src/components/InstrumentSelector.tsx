import React from 'react';
import type { InstrumentType } from '../types/music';

interface InstrumentSelectorProps {
  currentInstrument: InstrumentType;
  onSelectInstrument: (instrument: InstrumentType) => void;
  size?: 'compact' | 'normal';
}

export const InstrumentSelector: React.FC<InstrumentSelectorProps> = ({
  currentInstrument,
  onSelectInstrument,
  size = 'normal',
}) => {
  return (
    <div
      className={`instrument-selector ${size === 'compact' ? 'compact' : ''}`}
      role="radiogroup"
      aria-label="Active Instrument Selection"
    >
      <button
        type="button"
        role="radio"
        aria-checked={currentInstrument === 'piano'}
        className={`instrument-pill-btn ${currentInstrument === 'piano' ? 'active-piano' : ''}`}
        onClick={() => onSelectInstrument('piano')}
        title="Piano Mode: Detect circular physical tiles and play piano melodies"
      >
        <span className="inst-icon">🎹</span>
        <span className="inst-label">Piano</span>
        <span className="inst-tile-badge circle-badge" title="Uses circular tiles">⚪ Circles</span>
      </button>

      <button
        type="button"
        role="radio"
        aria-checked={currentInstrument === 'drums'}
        className={`instrument-pill-btn ${currentInstrument === 'drums' ? 'active-drums' : ''}`}
        onClick={() => onSelectInstrument('drums')}
        title="Drums Mode: Detect triangular physical tiles and play drum beats"
      >
        <span className="inst-icon">🥁</span>
        <span className="inst-label">Drums</span>
        <span className="inst-tile-badge triangle-badge" title="Uses triangular tiles">▲ Triangles</span>
      </button>
    </div>
  );
};

