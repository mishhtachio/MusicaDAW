import { useState, useCallback, useEffect } from 'react';
import { INITIAL_BOARD_CONFIG } from './config/boardConfig';
import type { NoteEvent, PitchName, InstrumentType, SavedTrack } from './types/music';
import type { AppMode, BoardCorners } from './types/camera';
import { DEFAULT_BOARD_CORNERS } from './geometry/perspectiveTransform';
import {
  createInitialExampleMelody,
  toggleNoteAt,
  findNoteAt,
} from './model/composition';
import { useAudioEngine } from './hooks/useAudioEngine';
import { PianoRoll } from './components/PianoRoll';
import { CalibrationScreen } from './components/Calibration/CalibrationScreen';

// Freejam Design Components (matching Figma spec)
import { FreejamHeader } from './components/freejam/FreejamHeader';
import { FreejamInstrumentBar } from './components/freejam/FreejamInstrumentBar';
import { FreejamViewportCard } from './components/freejam/FreejamViewportCard';
import { FreejamTransport } from './components/freejam/FreejamTransport';
import { FreejamSaveButton } from './components/freejam/FreejamSaveButton';
import { FreejamSettingsDrawer } from './components/freejam/FreejamSettingsDrawer';
import { FreejamFullscreenAR } from './components/freejam/FreejamFullscreenAR';

import './App.css';
import './styles/freejam.css';

const SAVED_TRACKS_STORAGE_KEY = 'musicadaw_saved_tracks';
const LEGACY_STORAGE_KEY = 'daddydaw_saved_tracks';

function loadSavedTracksFromStorage(): SavedTrack[] {
  try {
    const raw = localStorage.getItem(SAVED_TRACKS_STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch (err) {
    console.warn('[MusicaDAW] Error loading saved tracks from localStorage:', err);
  }
  return [];
}

export function App() {
  // Application Mode: 'camera' (live camera feed + AR) or 'manual' (touch piano roll)
  const [appMode, setAppMode] = useState<AppMode>('camera');

  // Active instrument: 'piano' (circles) | 'drums' (triangles)
  const [instrument, setInstrument] = useState<InstrumentType>('piano');

  // Overlay state: 3D AR character visibility
  const [isAROverlayActive, setIsAROverlayActive] = useState<boolean>(true);

  // Fullscreen Camera & AR Mode state
  const [isFullscreenAR, setIsFullscreenAR] = useState<boolean>(false);

  // Settings & Multi-Track drawer modal open state
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  // Multi-Track Library & Layer Arranger state
  const [savedTracks, setSavedTracks] = useState<SavedTrack[]>(loadSavedTracksFromStorage);
  const [activeSavedTrackIds, setActiveSavedTrackIds] = useState<Set<string>>(() => {
    const initial = loadSavedTracksFromStorage();
    return new Set(initial.map((t) => t.id));
  });

  // Persist saved tracks to localStorage whenever updated
  useEffect(() => {
    try {
      localStorage.setItem(SAVED_TRACKS_STORAGE_KEY, JSON.stringify(savedTracks));
    } catch (err) {
      console.warn('[MusicaDAW] Error saving tracks to localStorage:', err);
    }
  }, [savedTracks]);

  // Configurable board dimensions and pitches
  const [pitches] = useState<PitchName[]>(INITIAL_BOARD_CONFIG.pitches);
  const [cols] = useState<number>(INITIAL_BOARD_CONFIG.cols);

  // Calibrated board corners (preserved between screen switches)
  const [calibratedCorners, setCalibratedCorners] = useState<BoardCorners>(DEFAULT_BOARD_CORNERS);

  // Pure composition state
  const [notes, setNotes] = useState<NoteEvent[]>(() =>
    createInitialExampleMelody(INITIAL_BOARD_CONFIG.pitches, INITIAL_BOARD_CONFIG.cols)
  );

  // Audio engine integration with multi-track and two-instrument support
  const {
    status,
    currentStep,
    bpm,
    play,
    pause,
    stop,
    setBpm,
    previewPitch,
    previewDrum,
    previewSound,
  } = useAudioEngine(notes, cols, INITIAL_BOARD_CONFIG.bpm, instrument, savedTracks, activeSavedTrackIds);

  // Cell toggle: add or remove note
  const handleCellToggle = useCallback(
    (row: number, col: number, pitch: PitchName) => {
      const existing = findNoteAt(notes, row, col);
      if (!existing) {
        previewSound(instrument, row, pitch);
      }
      setNotes((prevNotes) => toggleNoteAt(prevNotes, row, col, pitch));
    },
    [notes, instrument, previewSound]
  );

  const handleRowClick = useCallback(
    (row: number, pitch: PitchName) => {
      previewSound(instrument, row, pitch);
    },
    [instrument, previewSound]
  );

  const handlePitchClick = useCallback(
    (pitch: PitchName) => {
      previewPitch(pitch);
    },
    [previewPitch]
  );

  // Clear current active notes without touching saved tracks
  const handleClear = useCallback(() => {
    setNotes([]);
  }, []);

  // Save active sequence as a named track
  const handleSaveCurrentTrack = useCallback(
    (name: string) => {
      const newTrack: SavedTrack = {
        id: `track-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        name,
        instrument,
        notes: [...notes],
        cols,
        bpm,
        createdAt: Date.now(),
      };

      setSavedTracks((prev) => [newTrack, ...prev]);
      setActiveSavedTrackIds((prev) => new Set([...prev, newTrack.id]));
    },
    [instrument, notes, cols, bpm]
  );

  // Toggle saved track active state for simultaneous playback
  const handleToggleActiveTrack = useCallback((trackId: string) => {
    setActiveSavedTrackIds((prev) => {
      const next = new Set(prev);
      if (next.has(trackId)) {
        next.delete(trackId);
      } else {
        next.add(trackId);
      }
      return next;
    });
  }, []);

  // Delete saved track
  const handleDeleteTrack = useCallback((trackId: string) => {
    setSavedTracks((prev) => prev.filter((t) => t.id !== trackId));
    setActiveSavedTrackIds((prev) => {
      const next = new Set(prev);
      next.delete(trackId);
      return next;
    });
  }, []);

  // Audition a saved track
  const handlePreviewTrack = useCallback(
    (track: SavedTrack) => {
      for (const note of track.notes) {
        if (track.instrument === 'drums') {
          previewDrum(note.row);
        } else {
          previewPitch(note.pitch);
        }
      }
    },
    [previewDrum, previewPitch]
  );

  // Flip mode between camera feed and touch roll
  const handleToggleMode = useCallback(() => {
    setAppMode((prev) => (prev === 'camera' ? 'manual' : 'camera'));
  }, []);

  return (
    <div className="freejam-app-container">
      <main className="freejam-phone-shell">
        {/* 1. Top Header: Yellow Back Button, "Freejam", Blue Settings Gear */}
        <FreejamHeader
          currentMode={appMode}
          onToggleMode={handleToggleMode}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />

        {/* 2. Instrument / Sound Badges: 4 Glossy Bubbly Note Circles */}
        <FreejamInstrumentBar
          currentInstrument={instrument}
          onSelectInstrument={setInstrument}
          onPreviewSound={(inst) => {
            if (inst === 'drums') {
              previewDrum(0);
            } else {
              previewPitch('C6');
            }
          }}
        />

        {/* 3. Center Rounded Viewport Card with Top-Right Scan Reticle */}
        <FreejamViewportCard
          appMode={appMode}
          onOpenFullscreen={() => {
            // When opening fullscreen, ensure camera mode is ready
            setAppMode('camera');
            setIsFullscreenAR(true);
          }}
        >
          {appMode === 'camera' ? (
            <CalibrationScreen
              pitches={pitches}
              cols={cols}
              savedCorners={calibratedCorners}
              onSaveCorners={setCalibratedCorners}
              onReturnToManual={() => setAppMode('manual')}
              onCompositionChange={setNotes}
              currentStep={currentStep}
              playbackStatus={status}
              instrument={instrument}
              onInstrumentChange={setInstrument}
              savedTracks={savedTracks}
              activeSavedTrackIds={activeSavedTrackIds}
              onToggleActiveTrack={handleToggleActiveTrack}
              onSaveCurrentTrack={handleSaveCurrentTrack}
              onDeleteTrack={handleDeleteTrack}
              onPreviewTrack={handlePreviewTrack}
              onClearNotes={handleClear}
              hasActiveNotes={notes.length > 0}
              onPlay={play}
              onPause={pause}
              onStop={stop}
              isFreejamLayout={true}
              isARModeEnabled={isAROverlayActive}
            />
          ) : (
            <PianoRoll
              pitches={pitches}
              cols={cols}
              notes={notes}
              currentStep={currentStep}
              status={status}
              instrument={instrument}
              onCellToggle={handleCellToggle}
              onPitchClick={handlePitchClick}
              onRowClick={handleRowClick}
            />
          )}
        </FreejamViewportCard>

        {/* 4. Tactile Circular Transport Controls: Overlay, Play/Pause, Loop */}
        <FreejamTransport
          status={status}
          isAROverlayActive={isAROverlayActive}
          onToggleAROverlay={() => setIsAROverlayActive((prev) => !prev)}
          onPlay={play}
          onPause={pause}
          onStop={stop}
          onRestartStep={() => {
            stop();
            setTimeout(play, 40);
          }}
        />

        {/* 5. Bottom Teal Action Pill: Save */}
        <FreejamSaveButton
          onSave={handleSaveCurrentTrack}
          instrumentName={instrument}
          hasActiveNotes={notes.length > 0}
        />

        {/* 6. Settings & Multi-Track Drawer (Opened by Top-Right Blue Gear) */}
        <FreejamSettingsDrawer
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          bpm={bpm}
          onBpmChange={setBpm}
          savedTracks={savedTracks}
          activeSavedTrackIds={activeSavedTrackIds}
          onToggleActiveTrack={handleToggleActiveTrack}
          onDeleteTrack={handleDeleteTrack}
          onPreviewTrack={handlePreviewTrack}
          onClearBoard={handleClear}
          instrument={instrument}
        />

        {/* 7. Full Screen Camera Feed & AR Mode (Portrait & Landscape Responsive) */}
        <FreejamFullscreenAR
          isOpen={isFullscreenAR}
          onClose={() => setIsFullscreenAR(false)}
          pitches={pitches}
          cols={cols}
          calibratedCorners={calibratedCorners}
          onSaveCorners={setCalibratedCorners}
          onCompositionChange={setNotes}
          currentStep={currentStep}
          playbackStatus={status}
          instrument={instrument}
          onInstrumentChange={setInstrument}
          savedTracks={savedTracks}
          activeSavedTrackIds={activeSavedTrackIds}
          onToggleActiveTrack={handleToggleActiveTrack}
          onSaveCurrentTrack={handleSaveCurrentTrack}
          onDeleteTrack={handleDeleteTrack}
          onPreviewTrack={handlePreviewTrack}
          onClearNotes={handleClear}
          hasActiveNotes={notes.length > 0}
          onPlay={play}
          onPause={pause}
          onStop={stop}
          isAROverlayActive={isAROverlayActive}
          onToggleAROverlay={() => setIsAROverlayActive((prev) => !prev)}
        />
      </main>
    </div>
  );
}

export default App;
