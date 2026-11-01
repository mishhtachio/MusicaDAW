import React from 'react';
import type { NoteEvent, PitchName, TransportStatus, InstrumentType } from '../types/music';
import { findNoteAt } from '../model/composition';
import { Playhead } from './Playhead';

interface GridBoardProps {
  pitches: PitchName[];
  cols: number;
  notes: NoteEvent[];
  currentStep: number;
  status: TransportStatus;
  instrument?: InstrumentType;
  onCellToggle: (row: number, col: number, pitch: PitchName) => void;
}

export const GridBoard: React.FC<GridBoardProps> = ({
  pitches,
  cols,
  notes,
  currentStep,
  status,
  instrument = 'piano',
  onCellToggle,
}) => {
  const rows = pitches.length;

  return (
    <div className="grid-board-outer">
      <div
        className="grid-board"
        style={{
          gridTemplateRows: `repeat(${rows}, 1fr)`,
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
        }}
        role="grid"
        aria-label="Composition grid"
      >
        <Playhead currentStep={currentStep} cols={cols} status={status} />

        {pitches.map((pitch, rowIdx) =>
          Array.from({ length: cols }).map((_, colIdx) => {
            const note = findNoteAt(notes, rowIdx, colIdx);
            const isPlayingCol = (status === 'playing' || status === 'paused') && currentStep === colIdx;
            const isNoteActive = Boolean(note && isPlayingCol && status === 'playing');

            return (
              <div
                key={`cell-${rowIdx}-${colIdx}`}
                className={`grid-cell ${isPlayingCol ? 'col-highlighted' : ''}`}
                role="gridcell"
                tabIndex={0}
                onClick={() => onCellToggle(rowIdx, colIdx, pitch)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onCellToggle(rowIdx, colIdx, pitch);
                  }
                }}
                aria-label={`Row ${rowIdx + 1}, Step ${colIdx + 1}${note ? ', note placed' : ', empty'}`}
                title={`Row ${rowIdx + 1}, Step ${colIdx + 1} - tap to ${note ? 'remove' : 'place'} note`}
              >
                {note && (
                  <div
                    className={`note-block ${instrument === 'drums' ? 'triangle-note-block' : 'circle-note-block'} ${
                      isNoteActive ? 'note-sounding' : ''
                    }`}
                    aria-hidden="true"
                  >
                    {instrument === 'drums' ? (
                      <div className="triangle-shape-icon" />
                    ) : (
                      <div className="note-tile-inner" />
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
