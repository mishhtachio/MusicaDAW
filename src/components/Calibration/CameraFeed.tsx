import React, { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import type { CameraStatus } from '../../types/camera';
import type { CameraErrorDetails } from '../../camera/cameraManager';

export interface CameraFeedHandle {
  getVideoOrCanvas: () => HTMLVideoElement | HTMLCanvasElement | null;
}

interface CameraFeedProps {
  status: CameraStatus;
  stream: MediaStream | null;
  isMockFeed: boolean;
  errorDetails: CameraErrorDetails | null;
  onStartCamera: () => void;
  onRetry: () => void;
  onEnableMockFeed: () => void;
  children?: React.ReactNode;
}

export const CameraFeed = forwardRef<CameraFeedHandle, CameraFeedProps>(({
  status,
  stream,
  isMockFeed,
  errorDetails,
  onStartCamera,
  onRetry,
  onEnableMockFeed,
  children
}, ref) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useImperativeHandle(ref, () => ({
    getVideoOrCanvas: () => {
      if (isMockFeed) return canvasRef.current;
      return videoRef.current;
    }
  }), [isMockFeed]);

  // Attach stream to video element
  useEffect(() => {
    if (videoRef.current && stream && !isMockFeed) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch((err) => {
        console.warn('[CameraFeed] Video play was interrupted:', err);
      });
    }
  }, [stream, isMockFeed]);

  // Render simulated board feed on canvas when mock feed is active
  useEffect(() => {
    if (!isMockFeed || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const renderMockBoard = () => {
      const w = canvas.width;
      const h = canvas.height;

      // Ruled notebook page background (white paper with faint notebook lines)
      ctx.fillStyle = '#f8f9fa';
      ctx.fillRect(0, 0, w, h);

      // Faint horizontal ruled notebook lines (like in user's notebook)
      ctx.strokeStyle = '#c5cdd6';
      ctx.lineWidth = 1;
      for (let y = 18; y < h; y += 22) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // 4 corners of the 5x4 grid on the notebook
      const p0 = { x: w * 0.18, y: h * 0.18 }; // TL of 5x4 grid
      const p1 = { x: w * 0.82, y: h * 0.18 }; // TR of 5x4 grid
      const p2 = { x: w * 0.83, y: h * 0.72 }; // BR of 5x4 grid
      const p3 = { x: w * 0.17, y: h * 0.72 }; // BL of 5x4 grid

      // Outer boundary of the 5x4 hand-drawn black grid (bold black marker)
      ctx.strokeStyle = '#18181b';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.lineTo(p3.x, p3.y);
      ctx.closePath();
      ctx.stroke();

      // 5 Rows (4 internal horizontal lines)
      ctx.strokeStyle = '#27272a';
      ctx.lineWidth = 2.5;
      for (let r = 1; r < 5; r++) {
        const t = r / 5;
        const lx = p0.x * (1 - t) + p3.x * t;
        const ly = p0.y * (1 - t) + p3.y * t;
        const rx = p1.x * (1 - t) + p2.x * t;
        const ry = p1.y * (1 - t) + p2.y * t;
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo(rx, ry);
        ctx.stroke();
      }

      // 4 Columns (3 internal vertical lines)
      for (let c = 1; c < 4; c++) {
        const t = c / 4;
        const tx = p0.x * (1 - t) + p1.x * t;
        const ty = p0.y * (1 - t) + p1.y * t;
        const bx = p3.x * (1 - t) + p2.x * t;
        const by = p3.y * (1 - t) + p2.y * t;
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(bx, by);
        ctx.stroke();
      }

      // 4 SOLID BLACK CORNER DOTS (matching user's drawing)
      const dotRadius = 13;
      ctx.fillStyle = '#09090b';

      // TL Dot
      ctx.beginPath();
      ctx.arc(p0.x, p0.y, dotRadius, 0, Math.PI * 2);
      ctx.fill();

      // TR Dot
      ctx.beginPath();
      ctx.arc(p1.x, p1.y, dotRadius, 0, Math.PI * 2);
      ctx.fill();

      // BR Dot
      ctx.beginPath();
      ctx.arc(p2.x, p2.y, dotRadius, 0, Math.PI * 2);
      ctx.fill();

      // BL Dot
      ctx.beginPath();
      ctx.arc(p3.x, p3.y, dotRadius, 0, Math.PI * 2);
      ctx.fill();

      // Sample physical note tiles placed inside the 4 columns (solid red circular tokens)
      const sampleNotes = [
        { r: 0, c: 0 },
        { r: 1, c: 1 },
        { r: 2, c: 2 },
        { r: 1, c: 3 },
      ];

      for (const item of sampleNotes) {
        const u = (item.c + 0.5) / 4;
        const v = (item.r + 0.5) / 5;
        const topX = p0.x * (1 - u) + p1.x * u;
        const topY = p0.y * (1 - u) + p1.y * u;
        const botX = p3.x * (1 - u) + p2.x * u;
        const botY = p3.y * (1 - u) + p2.y * u;
        const cx = topX * (1 - v) + botX * v;
        const cy = topY * (1 - v) + botY * v;

        // Draw solid red circular token (matching user's physical red circles)
        const radius = 22;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fillStyle = '#e53935';
        ctx.fill();
        ctx.strokeStyle = '#b71c1c';
        ctx.lineWidth = 3.5;
        ctx.stroke();

        // Inner highlight ring for depth
        ctx.beginPath();
        ctx.arc(cx - 5, cy - 5, radius * 0.38, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.30)';
        ctx.fill();
      }

      // Watermark badge
      ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
      ctx.beginPath();
      ctx.roundRect(14, 14, 190, 28, [6]);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('📷 Simulated Board Feed', 22, 28);

      animId = requestAnimationFrame(renderMockBoard);
    };

    renderMockBoard();
    return () => cancelAnimationFrame(animId);
  }, [isMockFeed]);

  return (
    <div className="camera-feed-container">
      {status === 'idle' && (
        <div className="camera-prompt-card">
          <div className="camera-prompt-icon">📷</div>
          <h3 className="camera-prompt-title">Ready to Scan the Board</h3>
          <p className="camera-prompt-text">
            Tap below to turn on your phone or webcam, or test with a simulated feed.
          </p>
          <div className="camera-prompt-actions">
            <button
              type="button"
              className="camera-action-btn btn-primary"
              onClick={onStartCamera}
            >
              Start Camera
            </button>
            <button
              type="button"
              className="camera-action-btn btn-secondary"
              onClick={onEnableMockFeed}
            >
              Use Simulated Feed
            </button>
          </div>
        </div>
      )}

      {status === 'requesting' && (
        <div className="camera-loading-card">
          <div className="loading-spinner" />
          <p>Accessing camera... please allow permission if prompted.</p>
        </div>
      )}

      {status === 'error' && (
        <div className="camera-error-card">
          <div className="error-icon">⚠️</div>
          <h4 className="error-title">{errorDetails?.message || 'Camera Error'}</h4>
          <p className="error-advice">{errorDetails?.advice}</p>
          <div className="camera-error-actions">
            <button
              type="button"
              className="camera-action-btn btn-primary"
              onClick={onRetry}
            >
              Retry Camera
            </button>
            <button
              type="button"
              className="camera-action-btn btn-secondary"
              onClick={onEnableMockFeed}
            >
              Test with Simulated Feed
            </button>
          </div>
        </div>
      )}

      {status === 'active' && !isMockFeed && (
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="live-video-element"
        />
      )}

      {status === 'active' && isMockFeed && (
        <canvas
          ref={canvasRef}
          width={800}
          height={600}
          className="mock-canvas-element"
        />
      )}

      {/* Calibration SVG overlay rendered on top */}
      {status === 'active' && children}
    </div>
  );
});

CameraFeed.displayName = 'CameraFeed';
