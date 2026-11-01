import React from 'react';
import { PitchLabels } from './PitchLabels';
import { GridBoard } from './GridBoard';
import type { NoteEvent, PitchName, TransportStatus, InstrumentType } from '../types/music';

interface PianoRollProps {
  pitches: PitchName[];
  cols: number;
  notes: NoteEvent[];
  currentStep: number;
  status: TransportStatus;
  instrument?: InstrumentType;
  onCellToggle: (row: number, col: number, pitch: PitchName) => void;
  onPitchClick: (pitch: PitchName) => void;
  onRowClick?: (row: number, pitch: PitchName) => void;
}

export const PianoRoll: React.FC<PianoRollProps> = ({
  pitches,
  cols,
  notes,
  currentStep,
  status,
  instrument = 'piano',
  onCellToggle,
  onPitchClick,
  onRowClick,
}) => {
  return (
    <div className="piano-roll-container">
      {/* Top step indicators (1, 2, 3, 4...) */}
      <div className="piano-roll-header">
        <div className="pitch-header-spacer" aria-hidden="true" />
        <div
          className="step-indicators"
          style={{
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
          }}
        >
          {Array.from({ length: cols }).map((_, i) => (
            <div
              key={`step-hdr-${i}`}
              className={`step-badge ${(status === 'playing' || status === 'paused') && currentStep === i ? 'active' : ''}`}
            >
              Step {i + 1}
            </div>
          ))}
        </div>
      </div>

      {/* Main interactive board: Row labels on left, Grid on right */}
      <div className="piano-roll-main">
        <PitchLabels
          pitches={pitches}
          instrument={instrument}
          onPitchClick={onPitchClick}
          onRowClick={onRowClick}
        />
        <GridBoard
          pitches={pitches}
          cols={cols}
          notes={notes}
          currentStep={currentStep}
          status={status}
          instrument={instrument}
          onCellToggle={onCellToggle}
        />
      </div>
    </div>
  );
};
