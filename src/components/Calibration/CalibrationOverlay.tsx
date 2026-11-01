import React, { useRef, useState, useCallback } from 'react';
import type { BoardCorners, CornerKey, Point2D } from '../../types/camera';
import type { PitchName, TransportStatus, InstrumentType } from '../../types/music';
import type { DetectedTileCandidate } from '../../types/tile';
import { getDrumVoiceForRow } from '../../audio/drumMapping';
import {
  computeHomography,
  boardToImage,
  getGridLineSegments
} from '../../geometry/perspectiveTransform';

interface CalibrationOverlayProps {
  corners: BoardCorners;
  pitches: PitchName[];
  cols: number;
  onCornerChange: (key: CornerKey, point: Point2D) => void;
  onCornersSequenceComplete?: (newCorners: BoardCorners) => void;
  calibrationMode: 'drag' | 'tap-sequence';
  detectedCorners?: BoardCorners | null;
  activeCellKeys?: Set<string>;
  detectedCandidates?: DetectedTileCandidate[];
  currentStep?: number;
  playbackStatus?: TransportStatus;
  isARModeEnabled?: boolean;
  instrument?: InstrumentType;
}

const CORNER_CONFIG: { key: CornerKey; label: string; color: string; ringColor: string; name: string }[] = [
  { key: 'topLeft', label: 'TL', color: '#ff3b30', ringColor: '#ffe5e5', name: 'Red Marker' },
  { key: 'topRight', label: 'TR', color: '#34c759', ringColor: '#e5f9eb', name: 'Green Marker' },
  { key: 'bottomRight', label: 'BR', color: '#007aff', ringColor: '#e5f2ff', name: 'Blue Marker' },
  { key: 'bottomLeft', label: 'BL', color: '#ff9500', ringColor: '#fff4e5', name: 'Yellow Marker' },
];

export const CalibrationOverlay: React.FC<CalibrationOverlayProps> = ({
  corners,
  pitches,
  cols,
  onCornerChange,
  onCornersSequenceComplete,
  calibrationMode,
  detectedCorners,
  activeCellKeys,
  detectedCandidates,
  currentStep = 0,
  playbackStatus = 'stopped',
  isARModeEnabled = false,
  instrument = 'piano',
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [activeDraggingCorner, setActiveDraggingCorner] = useState<CornerKey | null>(null);
  const [tapStep, setTapStep] = useState<number>(0);
  const sequenceCornersRef = useRef<Partial<BoardCorners>>({});

  const rows = pitches.length;
  const H = computeHomography(corners);
  const gridLines = getGridLineSegments(corners, rows, cols);

  // Converts client mouse/touch coordinates into normalized [0, 1] relative to SVG overlay
  const getNormalizedPoint = useCallback((clientX: number, clientY: number): Point2D | null => {
    if (!svgRef.current) return null;
    const rect = svgRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;

    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    return { x, y };
  }, []);

  // Pointer drag handlers
  const handlePointerDown = (key: CornerKey, e: React.PointerEvent) => {
    if (calibrationMode !== 'drag') return;
    e.stopPropagation();
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);
    setActiveDraggingCorner(key);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (calibrationMode !== 'drag' || !activeDraggingCorner) return;
    const pt = getNormalizedPoint(e.clientX, e.clientY);
    if (pt) {
      onCornerChange(activeDraggingCorner, pt);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (activeDraggingCorner) {
      try {
        (e.target as Element).releasePointerCapture(e.pointerId);
      } catch {
        // Ignored
      }
      setActiveDraggingCorner(null);
    }
  };

  // Sequential Tap-to-Set Corners handler
  const handleSvgClick = (e: React.MouseEvent) => {
    if (calibrationMode !== 'tap-sequence') return;
    const pt = getNormalizedPoint(e.clientX, e.clientY);
    if (!pt) return;

    const keys: CornerKey[] = ['topLeft', 'topRight', 'bottomRight', 'bottomLeft'];
    const currentKey = keys[tapStep];
    sequenceCornersRef.current[currentKey] = pt;
    onCornerChange(currentKey, pt);

    if (tapStep < 3) {
      setTapStep(tapStep + 1);
    } else {
      setTapStep(0);
      if (onCornersSequenceComplete) {
        onCornersSequenceComplete(sequenceCornersRef.current as BoardCorners);
      }
    }
  };

  // SVG coordinates in viewBox 0 0 1000 1000
  const toSvgX = (x: number) => x * 1000;
  const toSvgY = (y: number) => y * 1000;

  // 5x4 Quad polygon points string (enclosing purely the 4 note columns)
  const polygonPoints = [
    `${toSvgX(corners.topLeft.x)},${toSvgY(corners.topLeft.y)}`,
    `${toSvgX(corners.topRight.x)},${toSvgY(corners.topRight.y)}`,
    `${toSvgX(corners.bottomRight.x)},${toSvgY(corners.bottomRight.y)}`,
    `${toSvgX(corners.bottomLeft.x)},${toSvgY(corners.bottomLeft.y)}`,
  ].join(' ');

  return (
    <svg
      ref={svgRef}
      className={`calibration-svg-overlay ${calibrationMode}`}
      viewBox="0 0 1000 1000"
      preserveAspectRatio="none"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onClick={handleSvgClick}
    >
      <defs>
        <filter id="neon-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#000000" floodOpacity="0.8" />
        </filter>
        <filter id="handle-shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#000000" floodOpacity="0.45" />
        </filter>
        <filter id="tile-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#d81b60" floodOpacity="0.85" />
        </filter>
      </defs>

      {/* Dim outside mask (semi-transparent shroud outside the 5x4 board) */}
      <path
        d={`M 0 0 L 1000 0 L 1000 1000 L 0 1000 Z M ${toSvgX(corners.topLeft.x)} ${toSvgY(corners.topLeft.y)} L ${toSvgX(corners.bottomLeft.x)} ${toSvgY(corners.bottomLeft.y)} L ${toSvgX(corners.bottomRight.x)} ${toSvgY(corners.bottomRight.y)} L ${toSvgX(corners.topRight.x)} ${toSvgY(corners.topRight.y)} Z`}
        fill="rgba(15, 23, 42, 0.40)"
        fillRule="evenodd"
        pointerEvents="none"
      />

      {/* Outer 5x4 Note Grid Boundary Quad (Excludes pitch column) */}
      <polygon
        points={polygonPoints}
        className="calibrated-board-poly"
        fill="rgba(56, 213, 203, 0.08)"
        stroke="#ffaa00"
        strokeWidth="6"
        strokeLinejoin="round"
        filter="url(#neon-glow)"
        pointerEvents="none"
      />

      {/* Internal Perspective-Warped Grid Lines (4 Columns, 5 Rows) */}
      {gridLines
        .filter((l) => !l.isBoundary)
        .map((line, idx) => (
          <line
            key={`grid-line-${idx}`}
            x1={toSvgX(line.p1.x)}
            y1={toSvgY(line.p1.y)}
            x2={toSvgX(line.p2.x)}
            y2={toSvgY(line.p2.y)}
            stroke="#ffffff"
            strokeWidth="3.5"
            strokeDasharray="6,6"
            strokeOpacity="0.85"
            filter="url(#neon-glow)"
            pointerEvents="none"
          />
        ))}

      {/* Raw detected candidates (instant visual feedback matching instrument shape) */}
      {!isARModeEnabled &&
        detectedCandidates &&
        detectedCandidates.map((cand) => {
          const cx = toSvgX(cand.centerImg.x);
          const cy = toSvgY(cand.centerImg.y);
          const isDrum = instrument === 'drums' || cand.shape === 'triangle';

          if (isDrum) {
            // High-precision triangular visual reticle tracking actual physical corners
            const hasExactVertices = cand.verticesImg && cand.verticesImg.length === 3;
            const size = 26;
            const triPoints = hasExactVertices
              ? cand.verticesImg!.map((v) => `${toSvgX(v.x)},${toSvgY(v.y)}`).join(' ')
              : `${cx},${cy - size * 0.9} ${cx - size},${cy + size * 0.7} ${cx + size},${cy + size * 0.7}`;

            return (
              <g key={`raw-cand-${cand.id}`} pointerEvents="none">
                <polygon
                  points={triPoints}
                  fill="rgba(245, 158, 11, 0.28)"
                  stroke="#f59e0b"
                  strokeWidth="3.5"
                  strokeDasharray="4,4"
                  filter="url(#neon-glow)"
                />
                {hasExactVertices ? (
                  cand.verticesImg!.map((v, vi) => (
                    <circle
                      key={`tri-v-${vi}`}
                      cx={toSvgX(v.x)}
                      cy={toSvgY(v.y)}
                      r="4.5"
                      fill="#fde047"
                      stroke="#92400e"
                      strokeWidth="2"
                    />
                  ))
                ) : (
                  <circle cx={cx} cy={cy} r="4" fill="#f59e0b" />
                )}
                <text
                  x={cx}
                  y={cy - size - 4}
                  textAnchor="middle"
                  fill="#fde047"
                  fontSize="13"
                  fontWeight="800"
                  fontFamily="sans-serif"
                  filter="url(#neon-glow)"
                >
                  ▲ {cand.triangleFitRatio ? `${Math.round(cand.triangleFitRatio * 100)}% Fit` : `V=${cand.vertexCount || 3}`}
                </text>
              </g>
            );
          }

          // Circular visual reticle for piano mode
          return (
            <g key={`raw-cand-${cand.id}`} pointerEvents="none">
              <circle
                cx={cx}
                cy={cy}
                r="24"
                fill="rgba(255, 59, 48, 0.25)"
                stroke="#ff3b30"
                strokeWidth="3"
                strokeDasharray="4,4"
              />
              <circle cx={cx} cy={cy} r="5" fill="#ffffff" />
            </g>
          );
        })}

      {/* Live Physical Tile Overlays recognized inside cells */}
      {H &&
        activeCellKeys &&
        Array.from(activeCellKeys).map((cellKey) => {
          const [rStr, cStr] = cellKey.split('-');
          const r = parseInt(rStr, 10);
          const c = parseInt(cStr, 10);

          if (r >= rows || c >= cols) return null;

          const u0 = c / cols;
          const u1 = (c + 1) / cols;
          const v0 = r / rows;
          const v1 = (r + 1) / rows;

          const center = boardToImage((u0 + u1) / 2, (v0 + v1) / 2, H);
          const rightEdge = boardToImage(u1, (v0 + v1) / 2, H);
          const dxSvg = toSvgX(rightEdge.x) - toSvgX(center.x);
          const dySvg = toSvgY(rightEdge.y) - toSvgY(center.y);
          const radius = Math.max(14, Math.sqrt(dxSvg * dxSvg + dySvg * dySvg) * 0.72);

          const isSounding = playbackStatus === 'playing' && currentStep === c;
          const isDrum = instrument === 'drums';
          const drumVoice = getDrumVoiceForRow(r);

          // In AR Mode, the 3D character stands directly on the physical tile,
          // so we omit any overlapping 2D shapes so it looks naturally placed on the physical board.
          if (isARModeEnabled) {
            return (
              <g key={`detected-tile-${cellKey}`} pointerEvents="none">
                <text
                  x={toSvgX(center.x)}
                  y={toSvgY(center.y) + radius * 0.9}
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize="12"
                  fontWeight="900"
                  fontFamily="sans-serif"
                  filter="url(#neon-glow)"
                >
                  {isDrum ? `🥁 ${drumVoice.shortName}` : `♪ ${pitches[r]}`}
                </text>
              </g>
            );
          }

          if (isDrum) {
            // Render vibrant stylized triangle for physical drum tile
            const cx = toSvgX(center.x);
            const cy = toSvgY(center.y);
            const s = radius * 1.15;
            const triPoints = `${cx},${cy - s * 0.9} ${cx - s},${cy + s * 0.75} ${cx + s},${cy + s * 0.75}`;

            return (
              <g key={`detected-tile-${cellKey}`} pointerEvents="none">
                <polygon
                  points={triPoints}
                  fill={isSounding ? '#fbbf24' : '#f59e0b'}
                  stroke="#b45309"
                  strokeWidth={isSounding ? '5' : '3.5'}
                  filter={isSounding ? 'url(#tile-glow)' : 'url(#neon-glow)'}
                />
                <text
                  x={cx}
                  y={cy + 6}
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize="15"
                  fontWeight="900"
                  fontFamily="sans-serif"
                  filter="url(#neon-glow)"
                >
                  {drumVoice.shortName}
                </text>
              </g>
            );
          }

          // Piano mode circular token
          return (
            <g key={`detected-tile-${cellKey}`} pointerEvents="none">
              <circle
                cx={toSvgX(center.x)}
                cy={toSvgY(center.y)}
                r={radius}
                fill={isSounding ? '#ff5252' : '#e53935'}
                stroke="#b71c1c"
                strokeWidth={isSounding ? '5' : '3.5'}
                filter={isSounding ? 'url(#tile-glow)' : 'url(#neon-glow)'}
              />
              <circle
                cx={toSvgX(center.x) - radius * 0.25}
                cy={toSvgY(center.y) - radius * 0.25}
                r={radius * 0.35}
                fill="rgba(255, 255, 255, 0.3)"
              />
              <text
                x={toSvgX(center.x)}
                y={toSvgY(center.y) + 5}
                textAnchor="middle"
                fill="#ffffff"
                fontSize="16"
                fontWeight="900"
                fontFamily="sans-serif"
                filter="url(#neon-glow)"
              >
                ♪ {pitches[r]}
              </text>
            </g>
          );
        })}

      {/* Row Labels positioned OUTSIDE to the LEFT of the 5x4 grid */}
      {H &&
        pitches.map((pitch, r) => {
          const v = (r + 0.5) / rows;
          const pos = boardToImage(-0.11, v, H);
          const rowStart = boardToImage(0, v, H);
          const isDrum = instrument === 'drums';
          const drum = getDrumVoiceForRow(r);

          const badgeFill = isDrum ? drum.color : '#8ae28d';
          const badgeStroke = isDrum ? '#1e293b' : '#15803d';
          const badgeText = isDrum ? '#ffffff' : '#14532d';
          const labelContent = isDrum ? `${drum.icon} ${drum.shortName}` : pitch;

          return (
            <g key={`row-overlay-${pitch}-${r}`} pointerEvents="none">
              <line
                x1={toSvgX(pos.x + 0.03)}
                y1={toSvgY(pos.y)}
                x2={toSvgX(rowStart.x)}
                y2={toSvgY(rowStart.y)}
                stroke={badgeFill}
                strokeWidth="2.5"
                strokeDasharray="4,4"
              />

              <g transform={`translate(${toSvgX(pos.x)}, ${toSvgY(pos.y)})`}>
                <rect
                  x="-38"
                  y="-18"
                  width="76"
                  height="36"
                  rx="10"
                  fill={badgeFill}
                  stroke={badgeStroke}
                  strokeWidth="3"
                  filter="url(#neon-glow)"
                />
                <text
                  x="0"
                  y="5"
                  textAnchor="middle"
                  fill={badgeText}
                  fontSize="17"
                  fontWeight="800"
                  fontFamily="sans-serif"
                >
                  {labelContent}
                </text>
              </g>
            </g>
          );
        })}

      {/* Step Numbers positioned ABOVE the 4 playable columns */}
      {H &&
        Array.from({ length: cols }).map((_, c) => {
          const u = (c + 0.5) / cols;
          const pos = boardToImage(u, -0.07, H);
          const isCurrentStep = (playbackStatus === 'playing' || playbackStatus === 'paused') && currentStep === c;

          return (
            <g
              key={`step-overlay-${c}`}
              transform={`translate(${toSvgX(pos.x)}, ${toSvgY(pos.y)})`}
              pointerEvents="none"
            >
              <circle
                r="18"
                fill={isCurrentStep ? '#fef08a' : '#ffffff'}
                stroke={isCurrentStep ? '#ca8a04' : '#0284c7'}
                strokeWidth="3.5"
                filter="url(#neon-glow)"
              />
              <text
                x="0"
                y="6"
                textAnchor="middle"
                fill={isCurrentStep ? '#854d0e' : '#0369a1'}
                fontSize="17"
                fontWeight="800"
                fontFamily="sans-serif"
              >
                {c + 1}
              </text>
            </g>
          );
        })}

      {/* Visual Reticles for Live Detected Marker Positions */}
      {detectedCorners &&
        CORNER_CONFIG.map(({ key, color }) => {
          const det = detectedCorners[key];
          if (!det) return null;
          return (
            <g
              key={`detected-marker-${key}`}
              transform={`translate(${toSvgX(det.x)}, ${toSvgY(det.y)})`}
              pointerEvents="none"
            >
              <circle
                r="30"
                fill="none"
                stroke={color}
                strokeWidth="2.5"
                strokeDasharray="4,4"
              />
              <circle r="4" fill={color} />
            </g>
          );
        })}

      {/* 4 Interactive Corner Handles */}
      {CORNER_CONFIG.map(({ key, label, color, name }) => {
        const pt = corners[key];
        const cx = toSvgX(pt.x);
        const cy = toSvgY(pt.y);
        const isDragging = activeDraggingCorner === key;

        return (
          <g
            key={`handle-${key}`}
            className={`corner-handle-group ${isDragging ? 'dragging' : ''}`}
            transform={`translate(${cx}, ${cy})`}
            onPointerDown={(e) => handlePointerDown(key, e)}
            style={{ cursor: calibrationMode === 'drag' ? 'grab' : 'crosshair' }}
          >
            {/* Outer touch target circle */}
            <circle r="42" fill="transparent" />

            {/* Visual handle ring */}
            <circle
              r={isDragging ? 32 : 24}
              fill="rgba(255, 255, 255, 0.90)"
              stroke={color}
              strokeWidth="5"
              filter="url(#handle-shadow)"
            />

            {/* Inner center marker color dot */}
            <circle r="11" fill={color} />

            {/* Labeled handle pill */}
            <g transform="translate(0, -38)" pointerEvents="none">
              <rect
                x="-34"
                y="-14"
                width="68"
                height="28"
                rx="6"
                fill="#0f172a"
                stroke={color}
                strokeWidth="2"
              />
              <text
                x="0"
                y="5"
                textAnchor="middle"
                fill="#ffffff"
                fontSize="14"
                fontWeight="800"
                fontFamily="sans-serif"
              >
                {label} ({name.split(' ')[0]})
              </text>
            </g>
          </g>
        );
      })}
    </svg>
  );
};
