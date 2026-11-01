import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { BoardCorners, CornerKey, Point2D } from '../../types/camera';
import type { NoteEvent, PitchName, TransportStatus, InstrumentType, SavedTrack } from '../../types/music';
import { DEFAULT_BOARD_CORNERS } from '../../geometry/perspectiveTransform';
import { CameraFeed, type CameraFeedHandle } from './CameraFeed';
import { CalibrationOverlay } from './CalibrationOverlay';
import { ARThreeLayer } from './ARThreeLayer';
import { InstrumentSelector } from '../InstrumentSelector';
import { TrackManager } from '../TrackManager';
import { getDrumVoiceForRow } from '../../audio/drumMapping';
import { useCamera } from '../../hooks/useCamera';
import { useTileDetection } from '../../hooks/useTileDetection';
import {
  detectColorStickers,
  detectDarkDots,
  smoothCorners,
  type MarkerDetectionType
} from '../../camera/markerDetector';

interface CalibrationScreenProps {
  pitches: PitchName[];
  cols: number;
  onReturnToManual: () => void;
  savedCorners?: BoardCorners;
  onSaveCorners?: (corners: BoardCorners) => void;
  onCompositionChange: (notes: NoteEvent[]) => void;
  currentStep?: number;
  playbackStatus?: TransportStatus;
  instrument?: InstrumentType;
  onInstrumentChange?: (inst: InstrumentType) => void;
  savedTracks?: SavedTrack[];
  activeSavedTrackIds?: Set<string>;
  onToggleActiveTrack?: (trackId: string) => void;
  onSaveCurrentTrack?: (name: string) => void;
  onDeleteTrack?: (trackId: string) => void;
  onPreviewTrack?: (track: SavedTrack) => void;
  onClearNotes?: () => void;
  hasActiveNotes?: boolean;
  onPlay?: () => void;
  onPause?: () => void;
  onStop?: () => void;
  isFreejamLayout?: boolean;
  isARModeEnabled?: boolean;
  onToggleARMode?: (enabled: boolean) => void;
}

export const CalibrationScreen: React.FC<CalibrationScreenProps> = ({
  pitches,
  cols,
  onReturnToManual,
  savedCorners,
  onSaveCorners,
  onCompositionChange,
  currentStep = 0,
  playbackStatus = 'stopped',
  instrument = 'piano',
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
  isFreejamLayout = false,
  isARModeEnabled: externalARModeEnabled,
  onToggleARMode: _externalToggleARMode,
}) => {
  const [corners, setCorners] = useState<BoardCorners>(
    savedCorners || DEFAULT_BOARD_CORNERS
  );
  const [mode, setMode] = useState<'drag' | 'tap-sequence'>('drag');
  const [markerType, setMarkerType] = useState<MarkerDetectionType>('dark-dots');
  const [autoTracking, setAutoTracking] = useState<boolean>(false);
  const [detectionMessage, setDetectionMessage] = useState<string>('Ready to detect corner markers.');
  const [isDetected, setIsDetected] = useState<boolean>(false);
  const [detectedCorners, setDetectedCorners] = useState<BoardCorners | null>(null);
  const [internalARCharacterEnabled, setInternalARCharacterEnabled] = useState<boolean>(true);

  const isARCharacterEnabled = externalARModeEnabled !== undefined
    ? externalARModeEnabled
    : internalARCharacterEnabled;
  const setIsARCharacterEnabled = setInternalARCharacterEnabled;

  const cameraFeedRef = useRef<CameraFeedHandle | null>(null);
  const hiddenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const cornersRef = useRef<BoardCorners>(corners);

  const {
    status,
    stream,
    isMockFeed,
    errorDetails,
    startCamera,
    retry,
    enableMockFeed
  } = useCamera();

  useEffect(() => {
    cornersRef.current = corners;
  }, [corners]);

  useEffect(() => {
    if (!hiddenCanvasRef.current && typeof document !== 'undefined') {
      const c = document.createElement('canvas');
      c.width = 480;
      c.height = 360;
      hiddenCanvasRef.current = c;
    }
  }, []);

  const handleCornerChange = useCallback((key: CornerKey, point: Point2D) => {
    setCorners((prev) => {
      const updated = { ...prev, [key]: point };
      onSaveCorners?.(updated);
      return updated;
    });
  }, [onSaveCorners]);

  const handleResetCorners = useCallback(() => {
    setCorners(DEFAULT_BOARD_CORNERS);
    onSaveCorners?.(DEFAULT_BOARD_CORNERS);
    setDetectionMessage('Corners reset to default centered rectangle.');
    setIsDetected(false);
  }, [onSaveCorners]);

  // Pass feed getter for tile detection hook
  const getVideoOrCanvas = useCallback(() => {
    return cameraFeedRef.current?.getVideoOrCanvas() || null;
  }, []);

  // Stage 3 & 4: Deterministic Physical Tile Detection (Circles for Piano, Triangles for Drums)
  const {
    isDetecting: isTileDetectionActive,
    toggleDetecting: toggleTileDetection,
    detectedCandidates,
    activeCellKeys,
  } = useTileDetection({
    getVideoOrCanvas,
    corners,
    pitches,
    cols,
    isActive: status === 'active',
    targetShape: instrument === 'drums' ? 'triangle' : 'circle',
    onCompositionChange,
  });

  // Run a single marker detection pass across the current video/canvas frame
  const runMarkerDetectionPass = useCallback(() => {
    const feed = cameraFeedRef.current?.getVideoOrCanvas();
    const procCanvas = hiddenCanvasRef.current;
    if (!feed || !procCanvas) return null;

    const ctx = procCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    // Draw matching video object-fit: cover
    if (feed instanceof HTMLVideoElement && feed.videoWidth > 0 && feed.videoHeight > 0) {
      const vw = feed.videoWidth;
      const vh = feed.videoHeight;
      const cw = procCanvas.width;
      const ch = procCanvas.height;
      const videoRatio = vw / vh;
      const canvasRatio = cw / ch;

      let sx = 0;
      let sy = 0;
      let sw = vw;
      let sh = vh;

      if (videoRatio > canvasRatio) {
        sw = Math.round(vh * canvasRatio);
        sx = Math.round((vw - sw) / 2);
      } else {
        sh = Math.round(vw / canvasRatio);
        sy = Math.round((vh - sh) / 2);
      }

      ctx.drawImage(feed, sx, sy, sw, sh, 0, 0, cw, ch);
    } else {
      ctx.drawImage(feed, 0, 0, procCanvas.width, procCanvas.height);
    }

    const result =
      markerType === 'color-stickers'
        ? detectColorStickers(ctx, procCanvas.width, procCanvas.height)
        : detectDarkDots(ctx, procCanvas.width, procCanvas.height);

    setDetectionMessage(result.message);
    setIsDetected(result.detected);

    if (result.corners) {
      setDetectedCorners(result.corners);
      return result.corners;
    }

    return null;
  }, [markerType]);

  // Auto-Detect Now (single trigger)
  const handleAutoDetectClick = () => {
    const found = runMarkerDetectionPass();
    if (found) {
      setCorners(found);
      onSaveCorners?.(found);
    }
  };

  // Continuous Auto-Tracking loop for corner markers
  useEffect(() => {
    if (!autoTracking || status !== 'active') return;

    let animId: number;
    let lastTime = 0;

    const trackingLoop = (time: number) => {
      if (time - lastTime > 80) {
        lastTime = time;
        const found = runMarkerDetectionPass();
        if (found) {
          const smoothed = smoothCorners(cornersRef.current, found, 0.35);
          setCorners(smoothed);
          onSaveCorners?.(smoothed);
        }
      }
      animId = requestAnimationFrame(trackingLoop);
    };

    animId = requestAnimationFrame(trackingLoop);
    return () => cancelAnimationFrame(animId);
  }, [autoTracking, status, runMarkerDetectionPass, onSaveCorners]);

  if (isFreejamLayout) {
    return (
      <div className="freejam-camera-embedded" style={{ width: '100%', height: '100%', position: 'relative' }}>
        <CameraFeed
          ref={cameraFeedRef}
          status={status}
          stream={stream}
          isMockFeed={isMockFeed}
          errorDetails={errorDetails}
          onStartCamera={startCamera}
          onRetry={retry}
          onEnableMockFeed={enableMockFeed}
        >
          {/* Augmented Reality Three.js 3D Character Layer */}
          <ARThreeLayer
            corners={corners}
            rows={pitches.length}
            cols={cols}
            activeCellKeys={activeCellKeys}
            isARModeEnabled={isARCharacterEnabled}
          />

          <CalibrationOverlay
            corners={corners}
            pitches={pitches}
            cols={cols}
            onCornerChange={handleCornerChange}
            calibrationMode={mode}
            detectedCorners={detectedCorners}
            activeCellKeys={activeCellKeys}
            detectedCandidates={detectedCandidates}
            currentStep={currentStep}
            playbackStatus={playbackStatus}
            isARModeEnabled={isARCharacterEnabled}
            instrument={instrument}
          />
        </CameraFeed>

        {/* Floating Tile Status Pill inside card */}
        {status === 'active' && (
          <div className="freejam-card-status-pill">
            <span>{instrument === 'drums' ? '🥁' : '🎹'}</span>
            <span>
              {activeCellKeys.size > 0
                ? `${activeCellKeys.size} ${instrument === 'drums' ? 'Triangles' : 'Circles'} Active`
                : `Scanning for ${instrument === 'drums' ? 'Triangles' : 'Circles'}...`}
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="calibration-screen">
      {/* Top Bar with Navigation, Instrument Toggle and Status */}
      <div className="calibration-top-bar">
        <button
          type="button"
          className="calibration-back-btn"
          onClick={onReturnToManual}
        >
          ⬅ Return to Manual Roll
        </button>

        {onInstrumentChange && (
          <InstrumentSelector
            currentInstrument={instrument}
            onSelectInstrument={onInstrumentChange}
            size="compact"
          />
        )}

        <div className="calibration-status-badge">
          Grid: 5 rows × 4 cols
        </div>
      </div>

      {/* Main Camera and Calibration Overlay Viewport */}
      <div className="camera-viewport-card">
        <CameraFeed
          ref={cameraFeedRef}
          status={status}
          stream={stream}
          isMockFeed={isMockFeed}
          errorDetails={errorDetails}
          onStartCamera={startCamera}
          onRetry={retry}
          onEnableMockFeed={enableMockFeed}
        >
          {/* Augmented Reality Three.js 3D Character Layer */}
          <ARThreeLayer
            corners={corners}
            rows={pitches.length}
            cols={cols}
            activeCellKeys={activeCellKeys}
            isARModeEnabled={isARCharacterEnabled}
          />

          <CalibrationOverlay
            corners={corners}
            pitches={pitches}
            cols={cols}
            onCornerChange={handleCornerChange}
            calibrationMode={mode}
            detectedCorners={detectedCorners}
            activeCellKeys={activeCellKeys}
            detectedCandidates={detectedCandidates}
            currentStep={currentStep}
            playbackStatus={playbackStatus}
            isARModeEnabled={isARCharacterEnabled}
            instrument={instrument}
          />
        </CameraFeed>
      </div>

      {/* Stage 3 & 4: Live Tile Recognition Status Banner */}
      {status === 'active' && (
        <div className="tile-recognition-banner">
          <div className="recognition-left">
            <span className="recognition-icon">{instrument === 'drums' ? '🥁' : '🎹'}</span>
            <div className="recognition-info">
              <span className="recognition-title">
                {activeCellKeys.size > 0
                  ? `${activeCellKeys.size} Physical ${
                      instrument === 'drums' ? 'Triangle' : 'Circle'
                    }${activeCellKeys.size === 1 ? '' : 's'} Recognized (${
                      instrument === 'drums' ? 'Drums' : 'Piano'
                    })`
                  : `Scanning for ${instrument === 'drums' ? 'Triangles (Drums)' : 'Circles (Piano)'}...`}
              </span>
              <span className="recognition-subtext">
                {activeCellKeys.size > 0
                  ? `${instrument === 'drums' ? 'Active Beats' : 'Active Notes'}: ${Array.from(activeCellKeys)
                      .map((k) => {
                        const [r, c] = k.split('-');
                        const label =
                          instrument === 'drums'
                            ? getDrumVoiceForRow(Number(r)).name
                            : pitches[Number(r)];
                        return `${label} (Step ${Number(c) + 1})`;
                      })
                      .join(', ')}`
                  : instrument === 'drums'
                  ? 'Place triangular physical tiles (e.g. triangle cutouts) inside the 5×4 grid.'
                  : 'Place circular physical tiles (e.g. red paper discs) inside the 5×4 grid.'}
              </span>
            </div>
          </div>

          <div className="recognition-actions">
            <label className="ar-character-toggle" title="Render 3D animated character on detected tiles">
              <input
                type="checkbox"
                checked={isARCharacterEnabled}
                onChange={(e) => setIsARCharacterEnabled(e.target.checked)}
              />
              <span className="toggle-label">🤖 3D AR Character</span>
            </label>

            <label className="tile-sync-toggle" title="Sync detected physical tiles to the sequencer & audio engine">
              <input
                type="checkbox"
                checked={isTileDetectionActive}
                onChange={toggleTileDetection}
              />
              <span className="toggle-label">Sync Audio</span>
            </label>

            {/* Quick Save Track right in camera view */}
            {onSaveCurrentTrack && (
              <button
                type="button"
                className="mini-save-track-btn"
                onClick={() =>
                  onSaveCurrentTrack(
                    `${instrument === 'piano' ? 'Piano Melody' : 'Drum Beat'} #${(savedTracks?.length || 0) + 1}`
                  )
                }
                disabled={!hasActiveNotes}
                title={hasActiveNotes ? `Save active ${instrument} track` : 'Place tiles on the board first'}
              >
                💾 Save {instrument === 'piano' ? 'Piano' : 'Drum'}
              </button>
            )}

            {/* Quick Transport Controls right in Camera View */}
            {onPlay && onPause && onStop && (
              <div className="camera-transport-mini">
                <button
                  type="button"
                  className={`mini-transport-btn btn-play ${playbackStatus === 'playing' ? 'active' : ''}`}
                  onClick={onPlay}
                  title="Play physical melody (active board + all saved tracks in sync)"
                >
                  ▶ Play
                </button>
                <button
                  type="button"
                  className={`mini-transport-btn btn-pause ${playbackStatus === 'paused' ? 'active' : ''}`}
                  onClick={onPause}
                  disabled={playbackStatus === 'stopped'}
                  title="Pause playback"
                >
                  ⏸
                </button>
                <button
                  type="button"
                  className={`mini-transport-btn btn-stop ${playbackStatus === 'stopped' ? 'active' : ''}`}
                  onClick={onStop}
                  title="Stop playback"
                >
                  ⏹
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Multi-Track Arranger & Library (accessible directly in Camera view) */}
      {savedTracks && onSaveCurrentTrack && onToggleActiveTrack && onDeleteTrack && onPreviewTrack && (
        <TrackManager
          currentInstrument={instrument}
          savedTracks={savedTracks}
          activeSavedTrackIds={activeSavedTrackIds || new Set()}
          onToggleActiveTrack={onToggleActiveTrack}
          onSaveCurrentTrack={onSaveCurrentTrack}
          onDeleteTrack={onDeleteTrack}
          onPreviewTrack={onPreviewTrack}
          hasActiveNotes={Boolean(hasActiveNotes)}
          onClearActiveNotes={onClearNotes}
        />
      )}

      {/* Marker Detection Action Banner */}
      {status === 'active' && (
        <div className={`marker-detection-banner ${isDetected ? 'success' : 'searching'}`}>
          <div className="banner-left">
            <span className="banner-icon">{isDetected ? '🎯' : '🔍'}</span>
            <span className="banner-text">{detectionMessage}</span>
          </div>
          <div className="banner-actions">
            <button
              type="button"
              className="detect-btn"
              onClick={handleAutoDetectClick}
              title="Detect 4 corner markers in current view"
            >
              ⚡ Auto-Detect Markers
            </button>
            <label className="auto-track-toggle" title="Continuously update alignment to corner markers">
              <input
                type="checkbox"
                checked={autoTracking}
                onChange={(e) => setAutoTracking(e.target.checked)}
              />
              <span className="toggle-label">Live Track</span>
            </label>
          </div>
        </div>
      )}

      {/* Calibration Controls and Guidance */}
      <div className="calibration-controls-card">
        <div className="calibration-actions-row">
          {/* Marker Type Selector */}
          <div className="marker-type-selector">
            <span className="control-label">Marker Type:</span>
            <div className="pill-group">
              <button
                type="button"
                className={`pill-btn ${markerType === 'dark-dots' ? 'active' : ''}`}
                onClick={() => setMarkerType('dark-dots')}
              >
                ⚫ Black Corner Dots (Hand-Drawn)
              </button>
              <button
                type="button"
                className={`pill-btn ${markerType === 'color-stickers' ? 'active' : ''}`}
                onClick={() => setMarkerType('color-stickers')}
              >
                🔴🟢🔵🟡 Color Stickers
              </button>
            </div>
          </div>

          {/* Manual Adjust Mode Selection */}
          <div className="mode-toggle-group" role="group" aria-label="Manual Adjustment Method">
            <button
              type="button"
              className={`mode-btn ${mode === 'drag' ? 'active' : ''}`}
              onClick={() => setMode('drag')}
            >
              ✋ Drag Pins
            </button>
            <button
              type="button"
              className={`mode-btn ${mode === 'tap-sequence' ? 'active' : ''}`}
              onClick={() => setMode('tap-sequence')}
            >
              👆 Tap 4 Corners
            </button>
          </div>

          <button
            type="button"
            className="recalibrate-btn"
            onClick={handleResetCorners}
            title="Reset corners to center"
          >
            ↺ Reset
          </button>
        </div>

        {/* Child/Teacher Friendly Instructions */}
        <div className="calibration-guide-box">
          <h4 className="guide-title">Stage 3 Tangible Tile Music Guide:</h4>
          <ol className="guide-steps">
            <li>
              <strong>Physical Note Tiles</strong>: Place rectangular tiles (e.g. colored foam, cardstock, or cyan rectangles) inside the 5×4 grid.
            </li>
            <li>
              <strong>Musical Mapping</strong>: Each row determines pitch (`C6`, `A5`, `G5`, `E5`, `D5`) and each column determines time step (`1`, `2`, `3`, `4`).
            </li>
            <li>
              <strong>Hand Occlusion Filter</strong>: Reaching over the board to adjust a tile will not delete it—the temporal filter requires 5 consecutive missing frames before removing a note.
            </li>
            <li>
              <strong>Real-Time Audio Sync</strong>: Press <strong>▶ Play</strong> to hear the sequence loop continuously as you move tiles!
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
};
