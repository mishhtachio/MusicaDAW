import React from 'react';
import type { TransportStatus } from '../types/music';

interface TransportControlsProps {
  status: TransportStatus;
  bpm: number;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onBpmChange: (bpm: number) => void;
  onClear: () => void;
  onResetExample: () => void;
}

export const TransportControls: React.FC<TransportControlsProps> = ({
  status,
  bpm,
  onPlay,
  onPause,
  onStop,
  onBpmChange,
  onClear,
  onResetExample,
}) => {
  const isPlaying = status === 'playing';

  return (
    <section className="transport-controls-card" aria-label="Playback and Tempo Controls">
      <div className="transport-main-buttons">
        {/* Play Button */}
        <button
          type="button"
          className={`transport-btn btn-play ${isPlaying ? 'active' : ''}`}
          onClick={onPlay}
          aria-label="Play melody"
          title="Play melody"
        >
          <span className="btn-icon">▶</span>
          <span className="btn-text">Play</span>
        </button>

        {/* Pause Button */}
        <button
          type="button"
          className={`transport-btn btn-pause ${status === 'paused' ? 'active' : ''}`}
          onClick={onPause}
          disabled={status === 'stopped'}
          aria-label="Pause melody"
          title="Pause melody"
        >
          <span className="btn-icon">⏸</span>
          <span className="btn-text">Pause</span>
        </button>

        {/* Stop Button */}
        <button
          type="button"
          className={`transport-btn btn-stop ${status === 'stopped' ? 'active' : ''}`}
          onClick={onStop}
          aria-label="Stop playback"
          title="Stop playback"
        >
          <span className="btn-icon">⏹</span>
          <span className="btn-text">Stop</span>
        </button>
      </div>

      {/* BPM & Speed Controls */}
      <div className="tempo-section">
        <div className="tempo-header">
          <span className="tempo-title">Tempo:</span>
          <span className="tempo-display">{bpm} BPM</span>
        </div>

        <div className="tempo-slider-row">
          <button
            type="button"
            className="tempo-step-btn"
            onClick={() => onBpmChange(Math.max(40, bpm - 10))}
            aria-label="Decrease tempo by 10 BPM"
            title="Slower"
          >
            －
          </button>
          <input
            type="range"
            min={40}
            max={200}
            step={5}
            value={bpm}
            onChange={(e) => onBpmChange(Number(e.target.value))}
            className="tempo-slider"
            aria-label="Playback speed slider"
          />
          <button
            type="button"
            className="tempo-step-btn"
            onClick={() => onBpmChange(Math.min(200, bpm + 10))}
            aria-label="Increase tempo by 10 BPM"
            title="Faster"
          >
            ＋
          </button>
        </div>
      </div>

      {/* Helpful Actions */}
      <div className="actions-row">
        <button
          type="button"
          className="utility-btn btn-reset"
          onClick={onResetExample}
          title="Restore example melody"
        >
          ↺ Example Song
        </button>
        <button
          type="button"
          className="utility-btn btn-clear"
          onClick={onClear}
          title="Clear all tiles"
        >
          ✕ Clear Board
        </button>
      </div>
    </section>
  );
};
