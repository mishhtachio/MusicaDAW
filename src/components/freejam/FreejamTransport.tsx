import React from 'react';
import type { TransportStatus } from '../../types/music';

interface FreejamTransportProps {
  status: TransportStatus;
  isAROverlayActive: boolean;
  onToggleAROverlay: () => void;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onRestartStep?: () => void;
}

export const FreejamTransport: React.FC<FreejamTransportProps> = ({
  status,
  isAROverlayActive,
  onToggleAROverlay,
  onPlay,
  onPause,
  onRestartStep,
}) => {
  const isPlaying = status === 'playing';

  const handlePlayToggle = () => {
    if (isPlaying) {
      onPause();
    } else {
      onPlay();
    }
  };

  return (
    <div className="freejam-transport-row" aria-label="Playback Controls">
      {/* 1. Overlay Button */}
      <div className="transport-button-group">
        <button
          type="button"
          className={`freejam-round-btn btn-overlay ${isAROverlayActive ? 'active' : ''}`}
          onClick={onToggleAROverlay}
          title={isAROverlayActive ? '3D AR Character is ON' : 'Turn 3D AR Character ON'}
          aria-label="Toggle AR Overlay"
        >
          {/* Camera Icon */}
          <svg
            className="transport-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" fill="#ffffff" />
          </svg>
        </button>
        <span className="transport-label">Overlay</span>
      </div>

      {/* 2. Primary Play / Pause Button */}
      <div className="transport-button-group">
        <button
          type="button"
          className={`freejam-round-btn btn-main-play ${isPlaying ? 'playing' : ''}`}
          onClick={handlePlayToggle}
          title={isPlaying ? 'Pause Melody' : 'Play Melody'}
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            /* Pause Icon (two rounded vertical bars) */
            <svg className="transport-icon icon-pause" viewBox="0 0 24 24">
              <rect x="6" y="5" width="4" height="14" rx="2" fill="#ffffff" stroke="#78350f" strokeWidth="2" />
              <rect x="14" y="5" width="4" height="14" rx="2" fill="#ffffff" stroke="#78350f" strokeWidth="2" />
            </svg>
          ) : (
            /* Play Icon (rounded triangle) */
            <svg className="transport-icon icon-play" viewBox="0 0 24 24">
              <path
                d="M7 5.5v13a1 1 0 0 0 1.55.83l10.5-6.5a1 1 0 0 0 0-1.66l-10.5-6.5A1 1 0 0 0 7 5.5z"
                fill="#ffffff"
                stroke="#78350f"
                strokeWidth="2"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </button>
        <span className="transport-label">{isPlaying ? 'Pause' : 'Play'}</span>
      </div>

      {/* 3. Loop / Reset Step Button */}
      <div className="transport-button-group">
        <button
          type="button"
          className="freejam-round-btn btn-loop"
          onClick={onRestartStep}
          title="Loop / Restart from Step 1"
          aria-label="Loop / Restart"
        >
          {/* Circular Loop Icon */}
          <svg
            className="transport-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21.5 2v6h-6" />
            <path d="M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.19" />
          </svg>
        </button>
        <span className="transport-label">Loop</span>
      </div>
    </div>
  );
};

