import React, { useState } from 'react';
import type { SavedTrack, InstrumentType } from '../types/music';

interface TrackManagerProps {
  currentInstrument: InstrumentType;
  savedTracks: SavedTrack[];
  activeSavedTrackIds: Set<string>;
  onToggleActiveTrack: (trackId: string) => void;
  onSaveCurrentTrack: (name: string) => void;
  onDeleteTrack: (trackId: string) => void;
  onPreviewTrack: (track: SavedTrack) => void;
  hasActiveNotes: boolean;
  onClearActiveNotes?: () => void;
}

export const TrackManager: React.FC<TrackManagerProps> = ({
  currentInstrument,
  savedTracks,
  activeSavedTrackIds,
  onToggleActiveTrack,
  onSaveCurrentTrack,
  onDeleteTrack,
  onPreviewTrack,
  hasActiveNotes,
  onClearActiveNotes,
}) => {
  const [isSaving, setIsSaving] = useState(false);
  const [trackName, setTrackName] = useState('');
  const [lastSavedMessage, setLastSavedMessage] = useState<string | null>(null);

  const handleStartSave = () => {
    const defaultName = `${currentInstrument === 'piano' ? 'Piano Melody' : 'Drum Beat'} #${savedTracks.length + 1}`;
    setTrackName(defaultName);
    setIsSaving(true);
  };

  const handleConfirmSave = (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = trackName.trim() || `${currentInstrument} Track`;
    onSaveCurrentTrack(finalName);
    setIsSaving(false);
    setTrackName('');
    const nextInst = currentInstrument === 'piano' ? '🥁 Drums' : '🎹 Piano';
    setLastSavedMessage(`Saved "${finalName}"! Now switch to ${nextInst} to layer the next track.`);
    setTimeout(() => setLastSavedMessage(null), 6000);
  };

  const handleCancelSave = () => {
    setIsSaving(false);
    setTrackName('');
  };

  const hasPianoTrack = savedTracks.some((t) => t.instrument === 'piano');
  const hasDrumTrack = savedTracks.some((t) => t.instrument === 'drums');
  const hasBothTracks = hasPianoTrack && hasDrumTrack;

  return (
    <section className="track-manager-card" aria-label="Track Library & Multi-Track Playback">
      <div className="track-manager-header">
        <div className="track-header-title-group">
          <span className="track-manager-icon">🎛️</span>
          <div>
            <h3 className="track-manager-title">Track Arranger & Multi-Track Library</h3>
            <p className="track-manager-subtitle">
              Record a Piano track, save it, switch to Drums, save it, and play both together in sync!
            </p>
          </div>
        </div>

        <div className="track-header-actions">
          {hasActiveNotes && onClearActiveNotes && (
            <button
              type="button"
              className="btn-clear-board-mini"
              onClick={onClearActiveNotes}
              title="Clear active board notes to start next instrument without losing saved tracks"
            >
              🧹 Clear Board
            </button>
          )}

          <button
            type="button"
            className="btn-save-track"
            onClick={handleStartSave}
            disabled={!hasActiveNotes}
            title={hasActiveNotes ? `Save active ${currentInstrument} pattern as a track` : 'Add or place notes on the board first'}
          >
            <span>💾</span> Save Active {currentInstrument === 'piano' ? 'Piano' : 'Drum'} Track
          </button>
        </div>
      </div>

      {lastSavedMessage && (
        <div className="track-saved-toast">
          <span>✅ {lastSavedMessage}</span>
        </div>
      )}

      {hasBothTracks && (
        <div className="track-combo-banner">
          <span>🎉 <strong>Piano + Drums Multi-Track Ready!</strong> Both tracks will play simultaneously when you press <strong>▶ Play</strong>.</span>
        </div>
      )}

      {/* Save Track Modal Dialog */}
      {isSaving && (
        <div className="save-modal-backdrop" onClick={handleCancelSave}>
          <div className="save-modal-card" onClick={(e) => e.stopPropagation()}>
            <h4 className="save-modal-title">
              {currentInstrument === 'piano' ? '🎹 Save Piano Track' : '🥁 Save Drum Track'}
            </h4>
            <p className="save-modal-desc">
              Give your {currentInstrument} sequence a friendly name. It will be saved to your browser so you can play it along with your next track!
            </p>
            <form onSubmit={handleConfirmSave} className="save-modal-form">
              <input
                type="text"
                className="save-modal-input"
                value={trackName}
                onChange={(e) => setTrackName(e.target.value)}
                autoFocus
                maxLength={32}
                placeholder="e.g. Catchy Hook, Happy Drums..."
              />
              <div className="save-modal-actions">
                <button type="button" className="btn-cancel" onClick={handleCancelSave}>
                  Cancel
                </button>
                <button type="submit" className="btn-confirm-save">
                  Save Track
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Saved Tracks List */}
      <div className="saved-tracks-list">
        {savedTracks.length === 0 ? (
          <div className="saved-tracks-empty">
            <span>✨ No saved tracks yet.</span>
            <span>
              Compose with circular <strong>Piano</strong> tiles or triangular <strong>Drum</strong> tiles and click <strong>Save Active Track</strong> to layer them!
            </span>
          </div>
        ) : (
          savedTracks.map((track) => {
            const isActive = activeSavedTrackIds.has(track.id);
            const isPiano = track.instrument === 'piano';

            return (
              <div
                key={track.id}
                className={`saved-track-row ${isActive ? 'active-layer' : 'muted-layer'}`}
              >
                {/* Sync Playback Toggle */}
                <label
                  className="track-layer-checkbox-wrap"
                  title={isActive ? 'Sync active (playing)' : 'Muted (click to layer)'}
                >
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={() => onToggleActiveTrack(track.id)}
                  />
                  <span className="checkbox-custom" />
                </label>

                {/* Instrument Icon Badge */}
                <span
                  className={`track-instrument-badge ${isPiano ? 'badge-piano' : 'badge-drums'}`}
                  title={`${track.instrument.toUpperCase()} Track`}
                >
                  {isPiano ? '🎹 Piano' : '🥁 Drums'}
                </span>

                {/* Track Details */}
                <div className="track-details">
                  <span className="track-name">{track.name}</span>
                  <span className="track-meta">
                    {track.notes.length} note{track.notes.length === 1 ? '' : 's'} • {track.cols} steps
                  </span>
                </div>

                {/* Actions */}
                <div className="track-actions">
                  <button
                    type="button"
                    className="btn-track-preview"
                    onClick={() => onPreviewTrack(track)}
                    title="Quick preview this track"
                  >
                    ▶ Audition
                  </button>
                  <button
                    type="button"
                    className="btn-track-delete"
                    onClick={() => onDeleteTrack(track.id)}
                    title="Delete track"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
};

