import React from 'react';

interface BoardConfigBarProps {
  cols: number;
  onColsChange: (cols: number) => void;
  rowsCount: number;
}

export const BoardConfigBar: React.FC<BoardConfigBarProps> = ({
  cols,
  onColsChange,
  rowsCount,
}) => {
  return (
    <div className="board-config-bar">
      <div className="config-item">
        <span className="config-label">Pitches:</span>
        <span className="config-value">{rowsCount} rows</span>
      </div>

      <div className="config-item">
        <span className="config-label">Columns:</span>
        <div className="col-adjust-buttons">
          <button
            type="button"
            className="config-btn"
            onClick={() => onColsChange(Math.max(2, cols - 1))}
            disabled={cols <= 2}
            title="Reduce columns"
            aria-label="Reduce columns"
          >
            －
          </button>
          <span className="config-value-bold">{cols} cols</span>
          <button
            type="button"
            className="config-btn"
            onClick={() => onColsChange(Math.min(16, cols + 1))}
            disabled={cols >= 16}
            title="Add column"
            aria-label="Add column"
          >
            ＋
          </button>
        </div>
      </div>
    </div>
  );
};

