import React from 'react';
import type { TransportStatus } from '../types/music';

interface PlayheadProps {
  currentStep: number;
  cols: number;
  status: TransportStatus;
}

export const Playhead: React.FC<PlayheadProps> = ({ currentStep, cols, status }) => {
  if (status === 'stopped') {
    return null;
  }

  // Calculate percentage width and left offset for the playhead column
  const colWidthPct = 100 / cols;
  const leftPct = currentStep * colWidthPct;

  return (
    <div
      className={`grid-playhead ${status === 'playing' ? 'playing' : 'paused'}`}
      style={{
        left: `${leftPct}%`,
        width: `${colWidthPct}%`,
      }}
      aria-hidden="true"
    >
      <div className="playhead-line" />
      <div className="playhead-glow" />
    </div>
  );
};
