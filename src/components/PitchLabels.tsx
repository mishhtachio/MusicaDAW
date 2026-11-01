import React from 'react';
import type { PitchName, InstrumentType } from '../types/music';
import { getDrumVoiceForRow } from '../audio/drumMapping';

interface PitchLabelsProps {
  pitches: PitchName[];
  instrument?: InstrumentType;
  onPitchClick?: (pitch: PitchName) => void;
  onRowClick?: (row: number, pitch: PitchName) => void;
}

export const PitchLabels: React.FC<PitchLabelsProps> = ({
  pitches,
  instrument = 'piano',
  onPitchClick,
  onRowClick,
}) => {
  return (
    <div
      className="pitch-labels-column"
      role="group"
      aria-label="Track voice rows"
      style={{
        display: 'grid',
        gridTemplateRows: `repeat(${pitches.length}, 1fr)`,
        rowGap: '8px',
      }}
    >
      {pitches.map((pitch, idx) => {
        const drum = getDrumVoiceForRow(idx);
        const isDrum = instrument === 'drums';

        return (
          <button
            key={`${pitch}-${idx}`}
            type="button"
            className={`pitch-label-btn ${isDrum ? 'drum-label-btn' : ''}`}
            onClick={() => {
              if (onRowClick) {
                onRowClick(idx, pitch);
              } else {
                onPitchClick?.(pitch);
              }
            }}
            title={isDrum ? `Tap to hear ${drum.name}` : `Tap to hear ${pitch}`}
            aria-label={isDrum ? `Drum ${drum.name}` : `Pitch ${pitch}`}
          >
            {isDrum ? (
              <span className="pitch-name-drum">
                <span className="drum-icon">{drum.icon}</span>
                <span className="drum-name">{drum.shortName}</span>
              </span>
            ) : (
              <span className="pitch-name">{pitch}</span>
            )}
          </button>
        );
      })}
    </div>
  );
};
