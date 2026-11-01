import React from 'react';
import type { AppMode } from '../../types/camera';

interface FreejamViewportCardProps {
  appMode: AppMode;
  onOpenFullscreen: () => void;
  children: React.ReactNode;
}

export const FreejamViewportCard: React.FC<FreejamViewportCardProps> = ({
  onOpenFullscreen,
  children,
}) => {
  return (
    <div className="freejam-viewport-card" aria-label="Music Playground Viewport">
      {/* Top-right Corner Reticle Button: Opens Full Screen Camera Feed & AR Mode */}
      <button
        type="button"
        className="freejam-card-reticle-btn"
        onClick={onOpenFullscreen}
        title="View Camera Feed & 3D AR in Full Screen"
        aria-label="View camera feed and 3D AR character in full screen"
      >
        <svg
          className="reticle-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* 4 corner brackets matching Figma spec */}
          <path d="M4 8V4h4" />
          <path d="M20 8V4h-4" />
          <path d="M4 16v4h4" />
          <path d="M20 16v4h-4" />
        </svg>
      </button>

      {/* Main card contents */}
      <div className="freejam-card-content">
        {children}
      </div>
    </div>
  );
};

