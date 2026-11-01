import { useEffect, useState, useCallback } from 'react';
import { AudioEngine } from '../audio/audioEngine';
import type { NoteEvent, PitchName, TransportStatus, InstrumentType, SavedTrack } from '../types/music';

export function useAudioEngine(
  notes: NoteEvent[],
  cols: number,
  initialBpm: number,
  instrument: InstrumentType = 'piano',
  savedTracks: SavedTrack[] = [],
  activeSavedTrackIds: Set<string> = new Set()
) {
  // Stable singleton audio engine instance for the component lifecycle
  const [engine] = useState(() => new AudioEngine(initialBpm, cols));

  const [status, setStatus] = useState<TransportStatus>('stopped');
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [bpm, setBpmState] = useState<number>(initialBpm);

  // Keep notes synchronized with the audio engine
  useEffect(() => {
    engine.updateComposition(notes);
  }, [notes, engine]);

  // Keep cols synchronized
  useEffect(() => {
    engine.setCols(cols);
  }, [cols, engine]);

  // Keep instrument synchronized
  useEffect(() => {
    engine.setInstrument(instrument);
  }, [instrument, engine]);

  // Keep saved tracks synchronized for combined playback
  useEffect(() => {
    engine.setSavedTracks(savedTracks);
  }, [savedTracks, engine]);

  // Keep active track IDs synchronized
  useEffect(() => {
    engine.setActiveSavedTrackIds(activeSavedTrackIds);
  }, [activeSavedTrackIds, engine]);

  // Subscribe to transport status and step notifications
  useEffect(() => {
    const unsubStatus = engine.subscribeStatus((newStatus) => {
      setStatus(newStatus);
    });

    const unsubStep = engine.subscribeStep((step) => {
      setCurrentStep(step);
    });

    return () => {
      unsubStatus();
      unsubStep();
    };
  }, [engine]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      engine.dispose();
    };
  }, [engine]);

  const play = useCallback(() => {
    engine.play();
  }, [engine]);

  const pause = useCallback(() => {
    engine.pause();
  }, [engine]);

  const stop = useCallback(() => {
    engine.stop();
  }, [engine]);

  const setBpm = useCallback(
    (newBpm: number) => {
      setBpmState(newBpm);
      engine.setBpm(newBpm);
    },
    [engine]
  );

  const previewPitch = useCallback(
    (pitch: PitchName) => {
      engine.previewPitch(pitch);
    },
    [engine]
  );

  const previewDrum = useCallback(
    (row: number) => {
      engine.previewDrum(row);
    },
    [engine]
  );

  const previewSound = useCallback(
    (inst: InstrumentType, row: number, pitch: PitchName) => {
      engine.previewSound(inst, row, pitch);
    },
    [engine]
  );

  return {
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
  };
}
