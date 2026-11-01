import React, { useState } from 'react';

interface FreejamSaveButtonProps {
  onSave: (name: string) => void;
  instrumentName: string;
  hasActiveNotes: boolean;
}

export const FreejamSaveButton: React.FC<FreejamSaveButtonProps> = ({
  onSave,
  instrumentName,
  hasActiveNotes,
}) => {
  const [justSaved, setJustSaved] = useState(false);

  const handleSaveClick = () => {
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const defaultName = `${instrumentName === 'drums' ? 'Drums Beat' : 'Piano Melody'} (${timestamp})`;
    onSave(defaultName);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2200);
  };

  return (
    <div className="freejam-save-container">
      <button
        type="button"
        className={`freejam-pill-save-btn ${justSaved ? 'saved-success' : ''}`}
        onClick={handleSaveClick}
        aria-label="Save sequence as a track"
      >
        {justSaved ? (
          <span className="save-btn-content">
            <svg
              className="save-check-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>Saved to Tracks!</span>
          </span>
        ) : (
          <span className="save-btn-content">
            <span>Save</span>
            {!hasActiveNotes && <span className="save-empty-badge">(Active)</span>}
          </span>
        )}
      </button>
    </div>
  );
};

