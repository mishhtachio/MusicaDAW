import React, { useRef, useEffect } from 'react';
import type { BoardCorners } from '../../types/camera';
import { computeHomography, boardToImage } from '../../geometry/perspectiveTransform';
import { createARSceneManager, type ARSceneManager } from '../../three/arSceneManager';

interface ARThreeLayerProps {
  corners: BoardCorners;
  rows: number;
  cols: number;
  activeCellKeys: Set<string>;
  isARModeEnabled?: boolean;
}

export const ARThreeLayer: React.FC<ARThreeLayerProps> = ({
  corners,
  rows,
  cols,
  activeCellKeys,
  isARModeEnabled = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const managerRef = useRef<ARSceneManager | null>(null);
  const animIdRef = useRef<number>(0);

  const cornersRef = useRef(corners);
  const rowsRef = useRef(rows);
  const colsRef = useRef(cols);
  const activeCellKeysRef = useRef(activeCellKeys);

  useEffect(() => {
    cornersRef.current = corners;
  }, [corners]);

  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  useEffect(() => {
    colsRef.current = cols;
  }, [cols]);

  useEffect(() => {
    activeCellKeysRef.current = activeCellKeys;
  }, [activeCellKeys]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const parent = canvas.parentElement;
    const initialWidth = parent ? parent.clientWidth : 800;
    const initialHeight = parent ? parent.clientHeight : 600;

    const manager = createARSceneManager(canvas, initialWidth, initialHeight);
    managerRef.current = manager;

    // Handle container resizing
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          manager.handleResize(width, height);
        }
      }
    });

    if (parent) {
      resizeObserver.observe(parent);
    }

    // Continuous 60fps render loop
    const renderLoop = () => {
      if (!isARModeEnabled) {
        // Clear WebGL canvas if AR is disabled
        manager.clear();
        animIdRef.current = requestAnimationFrame(renderLoop);
        return;
      }

      const H = computeHomography(cornersRef.current);
      const activePositions = new Map<string, { x: number; y: number; radiusPx: number }>();

      if (H && canvas) {
        const cw = canvas.clientWidth;
        const ch = canvas.clientHeight;
        const currentRows = rowsRef.current;
        const currentCols = colsRef.current;

        for (const cellKey of activeCellKeysRef.current) {
          const [rStr, cStr] = cellKey.split('-');
          const r = parseInt(rStr, 10);
          const c = parseInt(cStr, 10);

          if (r < currentRows && c < currentCols) {
            const u0 = c / currentCols;
            const u1 = (c + 1) / currentCols;
            const v0 = r / currentRows;
            const v1 = (r + 1) / currentRows;

            // Compute center of cell in normalized image space (0..1)
            const center = boardToImage((u0 + u1) / 2, (v0 + v1) / 2, H);
            const rightEdge = boardToImage(u1, (v0 + v1) / 2, H);

            // Convert to canvas pixel coordinates using Euclidean distance (orientation-invariant)
            const screenX = center.x * cw;
            const screenY = center.y * ch;
            const dx = (rightEdge.x - center.x) * cw;
            const dy = (rightEdge.y - center.y) * ch;
            const radiusPx = Math.sqrt(dx * dx + dy * dy) * 0.75;

            activePositions.set(cellKey, {
              x: screenX,
              y: screenY,
              radiusPx: Math.max(16, radiusPx),
            });
          }
        }
      }

      manager.render(activePositions);
      animIdRef.current = requestAnimationFrame(renderLoop);
    };

    animIdRef.current = requestAnimationFrame(renderLoop);

    return () => {
      cancelAnimationFrame(animIdRef.current);
      resizeObserver.disconnect();
      manager.dispose();
      managerRef.current = null;
    };
  }, [isARModeEnabled]);

  return (
    <canvas
      ref={canvasRef}
      className="ar-three-canvas-layer"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 8, // Between video/SVG grid and interactive pins
      }}
    />
  );
};

