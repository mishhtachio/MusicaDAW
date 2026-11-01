import type { NoteEvent, PitchName } from '../types/music';
import type {
  CellTracker,
  DetectedTileCandidate,
  TemporalStabilityConfig,
} from '../types/tile';
import { DEFAULT_TEMPORAL_CONFIG } from '../types/tile';
import { createNote } from '../model/composition';

/**
 * Manages temporal debouncing and stability across consecutive camera frames.
 *
 * Prevents UI/audio flickering from:
 * 1. Temporary hand occlusion (requires 5 missing frames before deleting a note).
 * 2. Transient shadows/noise (requires 3 consecutive detections before creating a note).
 * 3. Tile adjustments (debounced transition).
 */
export class TemporalStabilityManager {
  private trackers = new Map<string, CellTracker>();
  private config: TemporalStabilityConfig;

  constructor(config?: Partial<TemporalStabilityConfig>) {
    this.config = {
      ...DEFAULT_TEMPORAL_CONFIG,
      ...config,
    };
  }

  public setConfig(config: Partial<TemporalStabilityConfig>): void {
    this.config = { ...this.config, ...config };
  }

  public reset(): void {
    this.trackers.clear();
  }

  /**
   * Processes the raw tile candidates detected in the current camera frame.
   * Returns the stable confirmed notes and an indication of whether changes occurred.
   */
  public update(
    rawCandidates: DetectedTileCandidate[],
    rows: number,
    cols: number,
    pitches: PitchName[]
  ): {
    stableNotes: NoteEvent[];
    hasChanges: boolean;
    activeCellKeys: Set<string>;
    trackers: Map<string, CellTracker>;
  } {
    // Map raw candidates by cell key "row-col"
    const candidatesByCell = new Map<string, DetectedTileCandidate>();
    for (const cand of rawCandidates) {
      if (cand.row >= 0 && cand.row < rows && cand.col >= 0 && cand.col < cols) {
        candidatesByCell.set(`${cand.row}-${cand.col}`, cand);
      }
    }

    let hasChanges = false;
    const activeCellKeys = new Set<string>();

    // Iterate over all possible cells on the board
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const key = `${r}-${c}`;
        let tracker = this.trackers.get(key);

        if (!tracker) {
          tracker = {
            row: r,
            col: c,
            state: 'empty',
            seenCount: 0,
            missingCount: 0,
            candidate: null,
          };
          this.trackers.set(key, tracker);
        }

        const candidate = candidatesByCell.get(key);

        if (candidate) {
          // Candidate observed in this frame
          tracker.candidate = candidate;
          tracker.missingCount = 0;

          if (tracker.state === 'empty') {
            tracker.state = 'pending_add';
            tracker.seenCount = 1;
          } else if (tracker.state === 'pending_add') {
            tracker.seenCount++;
            if (tracker.seenCount >= this.config.consecutiveFramesToConfirm) {
              tracker.state = 'active';
              hasChanges = true;
            }
          } else if (tracker.state === 'active') {
            // Already active, refresh
            activeCellKeys.add(key);
          }
        } else {
          // Candidate NOT observed in this frame
          if (tracker.state === 'pending_add') {
            // Transient noise, immediately discard
            tracker.state = 'empty';
            tracker.seenCount = 0;
            tracker.candidate = null;
          } else if (tracker.state === 'active') {
            tracker.missingCount++;
            // Hand occlusion absorption:
            // Do NOT remove note until missing for `missingFramesToDrop` consecutive frames
            if (tracker.missingCount < this.config.missingFramesToDrop) {
              activeCellKeys.add(key); // keep active!
            } else {
              tracker.state = 'empty';
              tracker.seenCount = 0;
              tracker.candidate = null;
              hasChanges = true;
            }
          }
        }

        if (tracker.state === 'active') {
          activeCellKeys.add(key);
        }
      }
    }

    // Convert all currently active cells into standard NoteEvents
    const stableNotes: NoteEvent[] = [];
    for (const key of activeCellKeys) {
      const [rStr, cStr] = key.split('-');
      const r = parseInt(rStr, 10);
      const c = parseInt(cStr, 10);
      if (r < pitches.length && c < cols) {
        stableNotes.push(createNote(r, c, pitches[r]));
      }
    }

    return {
      stableNotes,
      hasChanges,
      activeCellKeys,
      trackers: new Map(this.trackers),
    };
  }
}

