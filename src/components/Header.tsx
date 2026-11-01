import React from 'react';
import type { AppMode } from '../types/camera';

interface HeaderProps {
  currentMode: AppMode;
  onModeChange: (mode: AppMode) => void;
}

export const Header: React.FC<HeaderProps> = ({ currentMode, onModeChange }) => {
  return (
    <header className="app-header">
      <div className="header-title-row">
        <div className="brand-badge">🎵 Tangible Music Roll</div>
        <h1 className="header-title">DaddyDAW</h1>
      </div>
      <p className="header-tagline">
        Compose music with tangible tiles on your handmade board or on screen.
      </p>

      {/* Main Mode Navigation: Manual Roll vs Camera Calibration */}
      <nav className="mode-nav-bar" aria-label="Application Mode">
        <button
          type="button"
          className={`mode-nav-tab ${currentMode === 'manual' ? 'active' : ''}`}
          onClick={() => onModeChange('manual')}
          aria-pressed={currentMode === 'manual'}
        >
          <span className="tab-icon">🎹</span>
          <span className="tab-text">Manual Sequencer</span>
        </button>
        <button
          type="button"
          className={`mode-nav-tab ${currentMode === 'camera' ? 'active' : ''}`}
          onClick={() => onModeChange('camera')}
          aria-pressed={currentMode === 'camera'}
        >
          <span className="tab-icon">📷</span>
          <span className="tab-text">Camera Calibration</span>
        </button>
      </nav>
    </header>
  );
};
