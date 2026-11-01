import { useState, useRef, useEffect, useCallback } from 'react';
import type { BoardCorners } from '../types/camera';
import type { NoteEvent, PitchName } from '../types/music';
import type { DetectedTileCandidate, PhysicalTileShape } from '../types/tile';
import { DeterministicTileDetector } from '../vision/tileDetector';
import { TemporalStabilityManager } from '../vision/temporalStability';

export interface UseTileDetectionProps {
  getVideoOrCanvas: () => HTMLVideoElement | HTMLCanvasElement | null;
  corners: BoardCorners;
  pitches: PitchName[];
  cols: number;
  isActive: boolean;
  targetShape?: PhysicalTileShape;
  onCompositionChange: (notes: NoteEvent[]) => void;
}

export function useTileDetection({
  getVideoOrCanvas,
  corners,
  pitches,
  cols,
  isActive,
  targetShape = 'circle',
  onCompositionChange,
}: UseTileDetectionProps) {
  const [isDetecting, setIsDetecting] = useState<boolean>(true);
  const [detectedCandidates, setDetectedCandidates] = useState<DetectedTileCandidate[]>([]);
  const [activeCellKeys, setActiveCellKeys] = useState<Set<string>>(new Set());

  const detectorRef = useRef<DeterministicTileDetector>(new DeterministicTileDetector());
  const stabilityRef = useRef<TemporalStabilityManager>(new TemporalStabilityManager());
  const procCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Initialize offscreen downscale canvas once
  useEffect(() => {
    if (!procCanvasRef.current && typeof document !== 'undefined') {
      const c = document.createElement('canvas');
      c.width = 480;
      c.height = 360;
      procCanvasRef.current = c;
    }
  }, []);

  const cornersRef = useRef(corners);
  const pitchesRef = useRef(pitches);
  const colsRef = useRef(cols);
  const targetShapeRef = useRef(targetShape);
  const onCompositionChangeRef = useRef(onCompositionChange);

  useEffect(() => {
    cornersRef.current = corners;
  }, [corners]);

  useEffect(() => {
    pitchesRef.current = pitches;
  }, [pitches]);

  useEffect(() => {
    colsRef.current = cols;
  }, [cols]);

  useEffect(() => {
    targetShapeRef.current = targetShape;
  }, [targetShape]);

  useEffect(() => {
    onCompositionChangeRef.current = onCompositionChange;
  }, [onCompositionChange]);

  // Main controlled processing loop (~8 FPS / every 125ms)
  useEffect(() => {
    if (!isActive || !isDetecting) return;

    let timerId: number;

    const processFrame = () => {
      const feed = getVideoOrCanvas();
      const canvas = procCanvasRef.current;
      if (!feed || !canvas) {
        timerId = window.setTimeout(processFrame, 125);
        return;
      }

      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        timerId = window.setTimeout(processFrame, 125);
        return;
      }

      // Check if video is ready
      if (feed instanceof HTMLVideoElement && (feed.readyState < 2 || feed.videoWidth === 0)) {
        timerId = window.setTimeout(processFrame, 125);
        return;
      }

      try {
        // Draw frame matching the video container's exact aspect ratio and CSS object-fit: cover
        if (feed instanceof HTMLVideoElement && feed.videoWidth > 0 && feed.videoHeight > 0) {
          const vw = feed.videoWidth;
          const vh = feed.videoHeight;
          const container = feed.parentElement;
          const containerW = container ? container.clientWidth : 480;
          const containerH = container ? container.clientHeight : 360;
          const containerRatio = (containerW && containerH) ? containerW / containerH : 4 / 3;

          // Dynamically size processing canvas to match container's exact aspect ratio
          // while maintaining real-time mobile performance (~170k pixels)
          const baseDim = 480;
          let targetW: number;
          let targetH: number;
          if (containerRatio >= 1) {
            targetW = baseDim;
            targetH = Math.max(180, Math.round(baseDim / containerRatio));
          } else {
            targetH = baseDim;
            targetW = Math.max(180, Math.round(baseDim * containerRatio));
          }

          if (canvas.width !== targetW || canvas.height !== targetH) {
            canvas.width = targetW;
            canvas.height = targetH;
          }

          const videoRatio = vw / vh;
          let sx = 0;
          let sy = 0;
          let sw = vw;
          let sh = vh;

          // Object-fit: cover emulation matching the screen container exactly
          if (videoRatio > containerRatio) {
            sw = Math.round(vh * containerRatio);
            sx = Math.round((vw - sw) / 2);
          } else {
            sh = Math.round(vw / containerRatio);
            sy = Math.round((vh - sh) / 2);
          }

          ctx.drawImage(feed, sx, sy, sw, sh, 0, 0, targetW, targetH);
        } else {
          ctx.drawImage(feed, 0, 0, canvas.width, canvas.height);
        }

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        // 1. Run deterministic tile detector
        const rawCandidates = detectorRef.current.detect(
          imageData,
          cornersRef.current,
          pitchesRef.current,
          colsRef.current,
          { targetShape: targetShapeRef.current }
        );

        setDetectedCandidates(rawCandidates);

        // 2. Run temporal stability filter (absorbs hand occlusion & debounces)
        const stabilityResult = stabilityRef.current.update(
          rawCandidates,
          pitchesRef.current.length,
          colsRef.current,
          pitchesRef.current
        );

        setActiveCellKeys(stabilityResult.activeCellKeys);

        // 3. If stable composition changed, notify audio engine & piano roll
        if (stabilityResult.hasChanges) {
          onCompositionChangeRef.current(stabilityResult.stableNotes);
        }
      } catch (err) {
        console.warn('[useTileDetection] Frame processing error:', err);
      }

      timerId = window.setTimeout(processFrame, 125);
    };

    timerId = window.setTimeout(processFrame, 125);

    return () => {
      clearTimeout(timerId);
    };
  }, [isActive, isDetecting, getVideoOrCanvas]);

  const toggleDetecting = useCallback(() => {
    setIsDetecting((prev) => !prev);
  }, []);

  return {
    isDetecting,
    setIsDetecting,
    toggleDetecting,
    detectedCandidates,
    activeCellKeys,
  };
}
