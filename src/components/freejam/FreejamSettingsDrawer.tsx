import React from 'react';
import type { SavedTrack, InstrumentType } from '../../types/music';

interface FreejamSettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  bpm: number;
  onBpmChange: (newBpm: number) => void;
  savedTracks: SavedTrack[];
  activeSavedTrackIds: Set<string>;
  onToggleActiveTrack: (trackId: string) => void;
  onDeleteTrack: (trackId: string) => void;
  onPreviewTrack: (track: SavedTrack) => void;
  onClearBoard: () => void;
  instrument: InstrumentType;
}

export const FreejamSettingsDrawer: React.FC<FreejamSettingsDrawerProps> = ({
  isOpen,
  onClose,
  bpm,
  onBpmChange,
  savedTracks,
  activeSavedTrackIds,
  onToggleActiveTrack,
  onDeleteTrack,
  onPreviewTrack,
  onClearBoard,
}) => {
  if (!isOpen) return null;

  return (
    <div className="freejam-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="freejam-modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-sheet-header">
          <div className="modal-drag-handle" />
          <div className="modal-title-row">
            <h2 className="modal-title">Settings &amp; Multi-Track</h2>
            <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close settings">
              ✕
            </button>
          </div>
        </div>

        <div className="modal-sheet-body">
          {/* Tempo BPM section */}
          <section className="modal-section">
            <div className="section-label-row">
              <span className="section-title">Tempo</span>
              <span className="section-value-badge">{bpm} BPM</span>
            </div>
            <div className="modal-slider-row">
              <button
                type="button"
                className="tempo-btn"
                onClick={() => onBpmChange(Math.max(40, bpm - 10))}
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
                className="freejam-range-slider"
              />
              <button
                type="button"
                className="tempo-btn"
                onClick={() => onBpmChange(Math.min(200, bpm + 10))}
              >
                ＋
              </button>
            </div>
          </section>

          {/* Multi-Track Library */}
          <section className="modal-section">
            <div className="section-label-row">
              <span className="section-title">Saved Tracks (Multi-Track)</span>
              <span className="section-badge-count">{savedTracks.length} saved</span>
            </div>
            <p className="section-hint">
              Check both Piano and Drum tracks to layer and play them together simultaneously!
            </p>

            {savedTracks.length === 0 ? (
              <div className="empty-tracks-placeholder">
                <span>🎵 No tracks saved yet. Tap <strong>Save</strong> on the main screen to save one!</span>
              </div>
            ) : (
              <div className="saved-tracks-list">
                {savedTracks.map((track) => {
                  const isActive = activeSavedTrackIds.has(track.id);
                  const isDrum = track.instrument === 'drums';

                  return (
                    <div key={track.id} className={`modal-track-card ${isActive ? 'active-layer' : ''}`}>
                      <div className="track-left-info">
                        <span className={`track-inst-tag ${isDrum ? 'tag-drum' : 'tag-piano'}`}>
                          {isDrum ? '🥁 Drums' : '🎹 Piano'}
                        </span>
                        <span className="track-name-text">{track.name}</span>
                        <span className="track-notes-count">{track.notes.length} notes</span>
                      </div>

                      <div className="track-actions-row">
                        <button
                          type="button"
                          className="track-preview-btn"
                          onClick={() => onPreviewTrack(track)}
                          title="Preview track notes"
                        >
                          ▶ Preview
                        </button>

                        <button
                          type="button"
                          className={`track-layer-btn ${isActive ? 'layer-on' : 'layer-off'}`}
                          onClick={() => onToggleActiveTrack(track.id)}
                          title={isActive ? 'Mute layer in song' : 'Enable layer in song'}
                        >
                          {isActive ? '🔊 Active' : '🔇 Muted'}
                        </button>

                        <button
                          type="button"
                          className="track-delete-btn"
                          onClick={() => onDeleteTrack(track.id)}
                          title="Delete track"
                        >
                          🗑
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Quick Clear Board Action */}
          <section className="modal-section">
            <button
              type="button"
              className="modal-clear-board-btn"
              onClick={() => {
                onClearBoard();
                onClose();
              }}
            >
              🧹 Clear Active Board Notes
            </button>
          </section>
        </div>
      </div>
    </div>
  );
};

