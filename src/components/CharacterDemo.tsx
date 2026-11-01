import React, { useEffect, useRef, useState } from 'react';
import { initProceduralCharacterScene, type SceneController } from '../three/characterScene';

interface CharacterDemoProps {
  onBackToManual?: () => void;
}

export const CharacterDemo: React.FC<CharacterDemoProps> = ({ onBackToManual }) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<SceneController | null>(null);

  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [resetKey, setResetKey] = useState<number>(0);

  useEffect(() => {
    if (!mountRef.current) return;

    const controller = initProceduralCharacterScene(mountRef.current);
    controllerRef.current = controller;

    return () => {
      controller.dispose();
      controllerRef.current = null;
    };
  }, []);

  const handleTogglePlay = () => {
    if (!controllerRef.current) return;
    if (isPlaying) {
      controllerRef.current.pause();
      setIsPlaying(false);
    } else {
      controllerRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleReset = () => {
    if (!controllerRef.current) return;
    controllerRef.current.reset();
    setResetKey((k) => k + 1);
  };

  return (
    <div className="character-demo-card">
      <div className="character-demo-header">
        <div className="character-badge-row">
          <span className="character-badge">✨ Procedural 3D Model</span>
          <span className="character-badge-sub">Zero External Assets • Pure Three.js Math</span>
        </div>
        <h2 className="character-demo-title">Stylized Toy Character</h2>
        <p className="character-demo-desc">
          Procedurally generated using hierarchical groups, standard materials, directional shadows,
          and a continuous harmonic idle breathing loop. Click and drag to orbit camera.
        </p>
      </div>

      {/* 3D Viewport Container */}
      <div className="character-viewport-container" ref={mountRef}>
        <div className="orbit-hint-pill" pointer-events="none">
          👆 Click &amp; drag to rotate 3D view
        </div>
      </div>

      {/* Control Actions Bar */}
      <div className="character-controls-bar">
        <div className="controls-left">
          <button
            type="button"
            className={`character-btn ${isPlaying ? 'btn-pause' : 'btn-play'}`}
            onClick={handleTogglePlay}
            aria-label={isPlaying ? 'Pause Idle Animation' : 'Resume Idle Animation'}
          >
            {isPlaying ? '⏸ Pause Idle' : '▶ Resume Idle'}
          </button>

          <button
            type="button"
            className="character-btn btn-reset-pose"
            onClick={handleReset}
            aria-label="Reset Character Pose & Camera"
          >
            🔄 Reset Pose
          </button>
        </div>

        {onBackToManual && (
          <button
            type="button"
            className="character-btn btn-back-daw"
            onClick={onBackToManual}
          >
            ⬅ Return to Sequencer
          </button>
        )}
      </div>

      {/* Character Architecture & Anatomy Specs Footer */}
      <div className="character-specs-grid" key={resetKey}>
        <div className="spec-card">
          <div className="spec-icon">🧠</div>
          <div className="spec-label">Head &amp; Face</div>
          <div className="spec-value">Spheres + Torus smile + Beanie Cap</div>
        </div>
        <div className="spec-card">
          <div className="spec-icon">👕</div>
          <div className="spec-label">Torso &amp; Limbs</div>
          <div className="spec-value">Rounded Capsule + Shoulders/Hips Rig</div>
        </div>
        <div className="spec-card">
          <div className="spec-icon">🌊</div>
          <div className="spec-label">Idle Motion</div>
          <div className="spec-value">Sine breathing, grounded knee flex, arm sway</div>
        </div>
        <div className="spec-card">
          <div className="spec-icon">💡</div>
          <div className="spec-label">Lighting &amp; Shadows</div>
          <div className="spec-value">Hemisphere + PCF Soft Shadows + Contact Shadow</div>
        </div>
      </div>
    </div>
  );
};

