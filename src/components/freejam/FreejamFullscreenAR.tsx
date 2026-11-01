import React, { useEffect, useCallback } from 'react';
import type { PitchName, InstrumentType, SavedTrack, TransportStatus, NoteEvent } from '../../types/music';
import type { BoardCorners } from '../../types/camera';
import { CalibrationScreen } from '../Calibration/CalibrationScreen';

interface FreejamFullscreenARProps {
  isOpen: boolean;
  onClose: () => void;
  pitches: PitchName[];
  cols: number;
  calibratedCorners: BoardCorners;
  onSaveCorners: (corners: BoardCorners) => void;
  onCompositionChange: (notes: NoteEvent[]) => void;
  currentStep: number;
  playbackStatus: TransportStatus;
  instrument: InstrumentType;
  onInstrumentChange: (inst: InstrumentType) => void;
  savedTracks: SavedTrack[];
  activeSavedTrackIds: Set<string>;
  onToggleActiveTrack: (trackId: string) => void;
  onSaveCurrentTrack: (name: string) => void;
  onDeleteTrack: (trackId: string) => void;
  onPreviewTrack: (track: SavedTrack) => void;
  onClearNotes: () => void;
  hasActiveNotes: boolean;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  isAROverlayActive: boolean;
  onToggleAROverlay: () => void;
}

export const FreejamFullscreenAR: React.FC<FreejamFullscreenARProps> = ({
  isOpen,
  onClose,
  pitches,
  cols,
  calibratedCorners,
  onSaveCorners,
  onCompositionChange,
  currentStep,
  playbackStatus,
  instrument,
  onInstrumentChange,
  savedTracks,
  activeSavedTrackIds,
  onToggleActiveTrack,
  onSaveCurrentTrack,
  onDeleteTrack,
  onPreviewTrack,
  onClearNotes,
  hasActiveNotes,
  onPlay,
  onPause,
  onStop,
  isAROverlayActive,
  onToggleAROverlay,
}) => {
  // Try requesting native browser fullscreen if available
  useEffect(() => {
    if (!isOpen) return;

    try {
      if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {
          // Fullscreen API may require user gesture on some browsers
        });
      }
    } catch {
      // Ignored
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      try {
        if (document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
      } catch {
        // Ignored
      }
    };
  }, [isOpen, onClose]);

  const handleExitClick = useCallback(() => {
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  const isPlaying = playbackStatus === 'playing';

  return (
    <div className="freejam-fullscreen-overlay" role="dialog" aria-modal="true" aria-label="Full Screen Camera AR Mode">
      {/* 1. Camera Feed + 5x4 Board + Three.js 3D AR Character Layer */}
      <div className="fullscreen-camera-wrapper">
        <CalibrationScreen
          pitches={pitches}
          cols={cols}
          savedCorners={calibratedCorners}
          onSaveCorners={onSaveCorners}
          onReturnToManual={onClose}
          onCompositionChange={onCompositionChange}
          currentStep={currentStep}
          playbackStatus={playbackStatus}
          instrument={instrument}
          onInstrumentChange={onInstrumentChange}
          savedTracks={savedTracks}
          activeSavedTrackIds={activeSavedTrackIds}
          onToggleActiveTrack={onToggleActiveTrack}
          onSaveCurrentTrack={onSaveCurrentTrack}
          onDeleteTrack={onDeleteTrack}
          onPreviewTrack={onPreviewTrack}
          onClearNotes={onClearNotes}
          hasActiveNotes={hasActiveNotes}
          onPlay={onPlay}
          onPause={onPause}
          onStop={onStop}
          isFreejamLayout={true}
          isARModeEnabled={isAROverlayActive}
        />
      </div>

      {/* 2. Floating Top Header HUD */}
      <div className="fullscreen-top-hud">
        {/* Close / Minimize button */}
        <button
          type="button"
          className="fullscreen-hud-btn btn-exit"
          onClick={handleExitClick}
          title="Exit Fullscreen (Esc)"
          aria-label="Exit Fullscreen"
        >
          <svg className="hud-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            {/* Compress icon */}
            <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
          </svg>
          <span className="btn-label-text">Exit Fullscreen</span>
        </button>

        {/* Orientation & Mode Badge */}
        <div className="fullscreen-status-badge">
          <span className="badge-pulse-dot" />
          <span>Full Screen AR • Portrait or Landscape</span>
        </div>
      </div>

      {/* 3. Floating Bottom Controls HUD */}
      <div className="fullscreen-bottom-hud">
        {/* Toggle 3D Character AR */}
        <button
          type="button"
          className={`fullscreen-hud-btn btn-toggle-ar ${isAROverlayActive ? 'active' : ''}`}
          onClick={onToggleAROverlay}
          title={isAROverlayActive ? '3D AR Character is ON' : 'Turn 3D Character ON'}
        >
          <span>🤖 3D AR Character</span>
        </button>

        {/* Play / Pause Toggle */}
        <button
          type="button"
          className={`fullscreen-hud-btn btn-play-pause ${isPlaying ? 'playing' : ''}`}
          onClick={isPlaying ? onPause : onPlay}
        >
          {isPlaying ? '⏸ Pause' : '▶ Play'}
        </button>

        {/* Quick Save Track */}
        <button
          type="button"
          className="fullscreen-hud-btn btn-quick-save"
          onClick={() => {
            const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            onSaveCurrentTrack(`${instrument === 'drums' ? 'Drums Beat' : 'Piano Track'} (${time})`);
          }}
        >
          💾 Save Track
        </button>
      </div>
    </div>
  );
};
