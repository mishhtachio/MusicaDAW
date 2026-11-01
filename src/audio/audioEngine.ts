import type { NoteEvent, PitchName, TransportStatus, InstrumentType, SavedTrack } from '../types/music';
import { pitchNameToFrequency } from './pitchMapping';
import { getNotesForStep } from '../model/composition';

export type StepCallback = (step: number) => void;
export type StatusCallback = (status: TransportStatus) => void;

interface ActiveVoice {
  stopTime: number;
  stop: (time: number) => void;
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private status: TransportStatus = 'stopped';
  private bpm: number = 100;
  private totalCols: number = 4;
  private notes: NoteEvent[] = [];

  // Multi-track & instrument state
  private currentInstrument: InstrumentType = 'piano';
  private savedTracks: SavedTrack[] = [];
  private activeSavedTrackIds: Set<string> = new Set();

  // Lookahead scheduler properties
  private lookaheadIntervalMs = 25; // How often scheduler checks (ms)
  private scheduleAheadSec = 0.1; // Lookahead window (seconds)
  private timerId: number | null = null;
  private currentStep = 0;
  private nextStepTime = 0;

  // Active audio nodes tracking for clean stop/pause
  private activeVoices = new Set<ActiveVoice>();

  // Scheduled UI playhead timeouts
  private scheduledUiTimeouts: number[] = [];

  // Listeners
  private stepListeners = new Set<StepCallback>();
  private statusListeners = new Set<StatusCallback>();

  constructor(initialBpm = 100, initialCols = 4) {
    this.bpm = initialBpm;
    this.totalCols = initialCols;
  }

  /**
   * Initializes or gets the shared Web Audio context.
   */
  public getAudioContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.7, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  private getNoiseBuffer(): AudioBuffer {
    const ctx = this.getAudioContext();
    if (!this.noiseBuffer) {
      // 1 second of white noise for snare, hihat, clap
      const bufferSize = ctx.sampleRate;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      this.noiseBuffer = buffer;
    }
    return this.noiseBuffer;
  }

  public updateComposition(notes: NoteEvent[]): void {
    this.notes = [...notes];
  }

  public setInstrument(instrument: InstrumentType): void {
    this.currentInstrument = instrument;
  }

  public getInstrument(): InstrumentType {
    return this.currentInstrument;
  }

  public setSavedTracks(tracks: SavedTrack[]): void {
    this.savedTracks = [...tracks];
  }

  public setActiveSavedTrackIds(trackIds: Set<string>): void {
    this.activeSavedTrackIds = new Set(trackIds);
  }

  public setCols(cols: number): void {
    this.totalCols = Math.max(1, cols);
    if (this.currentStep >= this.totalCols) {
      this.currentStep = 0;
    }
  }

  public setBpm(newBpm: number): void {
    this.bpm = Math.max(30, Math.min(240, newBpm));
  }

  public getBpm(): number {
    return this.bpm;
  }

  public getStatus(): TransportStatus {
    return this.status;
  }

  public getCurrentStep(): number {
    return this.currentStep;
  }

  public subscribeStep(cb: StepCallback): () => void {
    this.stepListeners.add(cb);
    return () => this.stepListeners.delete(cb);
  }

  public subscribeStatus(cb: StatusCallback): () => void {
    this.statusListeners.add(cb);
    return () => this.statusListeners.delete(cb);
  }

  private notifyStep(step: number): void {
    for (const listener of this.stepListeners) {
      try {
        listener(step);
      } catch (err) {
        console.error('[AudioEngine] Error in step callback:', err);
      }
    }
  }

  private notifyStatus(status: TransportStatus): void {
    for (const listener of this.statusListeners) {
      try {
        listener(status);
      } catch (err) {
        console.error('[AudioEngine] Error in status callback:', err);
      }
    }
  }

  private getStepDuration(): number {
    return 60 / this.bpm;
  }

  /**
   * Start or resume playback.
   */
  public async play(): Promise<void> {
    if (this.status === 'playing') {
      return;
    }

    const ctx = this.getAudioContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    const wasPaused = this.status === 'paused';
    this.status = 'playing';
    this.notifyStatus('playing');

    if (!wasPaused) {
      this.currentStep = 0;
    }

    this.nextStepTime = ctx.currentTime + 0.05;
    this.timerId = window.setInterval(() => this.scheduleLoop(), this.lookaheadIntervalMs);
  }

  /**
   * Pause playback: preserves currentStep.
   */
  public pause(): void {
    if (this.status !== 'playing') {
      return;
    }

    this.stopSchedulerTimer();
    this.clearScheduledUiTimeouts();
    this.stopAllActiveVoices();

    this.status = 'paused';
    this.notifyStatus('paused');
  }

  /**
   * Stop playback: stops audio and resets playhead to start.
   */
  public stop(): void {
    this.stopSchedulerTimer();
    this.clearScheduledUiTimeouts();
    this.stopAllActiveVoices();

    this.currentStep = 0;
    this.status = 'stopped';
    this.notifyStatus('stopped');
    this.notifyStep(0);
  }

  private stopSchedulerTimer(): void {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  private clearScheduledUiTimeouts(): void {
    for (const id of this.scheduledUiTimeouts) {
      clearTimeout(id);
    }
    this.scheduledUiTimeouts = [];
  }

  private stopAllActiveVoices(): void {
    const ctx = this.ctx;
    const now = ctx ? ctx.currentTime : 0;
    for (const voice of this.activeVoices) {
      try {
        if (voice.stopTime > now) {
          voice.stop(now);
        }
      } catch {
        // Ignored
      }
    }
    this.activeVoices.clear();
  }

  /**
   * Lookahead scheduling loop.
   */
  private scheduleLoop(): void {
    if (this.status !== 'playing' || !this.ctx) {
      return;
    }

    const stepDuration = this.getStepDuration();

    while (this.nextStepTime < this.ctx.currentTime + this.scheduleAheadSec) {
      const stepToPlay = this.currentStep;
      const timeToPlay = this.nextStepTime;

      // 1. Schedule notes from active composition + all active saved tracks
      this.scheduleNotesForStep(stepToPlay, timeToPlay, stepDuration);

      // 2. Schedule synchronized UI playhead update
      const delayMs = Math.max(0, (timeToPlay - this.ctx.currentTime) * 1000);
      const timeoutId = window.setTimeout(() => {
        if (this.status === 'playing') {
          this.notifyStep(stepToPlay);
        }
        this.scheduledUiTimeouts = this.scheduledUiTimeouts.filter((id) => id !== timeoutId);
      }, delayMs);
      this.scheduledUiTimeouts.push(timeoutId);

      // 3. Advance to the next step
      this.nextStepTime += stepDuration;
      this.currentStep = (this.currentStep + 1) % this.totalCols;
    }
  }

  /**
   * Synthesize and schedule notes for a step across both the active board
   * and all active saved tracks simultaneously.
   */
  private scheduleNotesForStep(step: number, time: number, stepDuration: number): void {
    if (!this.ctx || !this.masterGain) return;

    // A. Active board notes
    const activeNotesAtStep = getNotesForStep(this.notes, step);
    for (const note of activeNotesAtStep) {
      if (this.currentInstrument === 'piano') {
        const freq = pitchNameToFrequency(note.pitch);
        const noteDuration = stepDuration * (note.duration || 1) * 0.92;
        this.playToneAt(freq, time, noteDuration, 0.38);
      } else {
        // Drums mode
        this.playDrumAt(note.row, time, 0.65);
      }
    }

    // B. Synchronized saved tracks
    for (const track of this.savedTracks) {
      if (!this.activeSavedTrackIds.has(track.id)) continue;

      const trackStep = step % track.cols;
      const trackNotesAtStep = getNotesForStep(track.notes, trackStep);

      for (const note of trackNotesAtStep) {
        if (track.instrument === 'piano') {
          const freq = pitchNameToFrequency(note.pitch);
          const noteDuration = stepDuration * (note.duration || 1) * 0.92;
          this.playToneAt(freq, time, noteDuration, 0.32);
        } else {
          this.playDrumAt(note.row, time, 0.55);
        }
      }
    }
  }

  /**
   * Piano synthesizer: warm, child-friendly chime/bell tone.
   */
  private playToneAt(freq: number, startTime: number, duration: number, volume = 0.35): void {
    if (!this.ctx || !this.masterGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, startTime);

    const attackTime = 0.012;
    const releaseTime = 0.04;
    const sustainTime = Math.max(0.01, duration - attackTime - releaseTime);

    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(volume, startTime + attackTime);
    gain.gain.setValueAtTime(volume * 0.85, startTime + attackTime + sustainTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + attackTime + sustainTime + releaseTime);

    osc.connect(gain);
    gain.connect(this.masterGain);

    const stopTime = startTime + duration;
    osc.start(startTime);
    osc.stop(stopTime + 0.05);

    const voice: ActiveVoice = {
      stopTime,
      stop: (now: number) => {
        gain.gain.cancelScheduledValues(now);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.02);
        osc.stop(now + 0.02);
      },
    };
    this.activeVoices.add(voice);

    osc.onended = () => {
      this.activeVoices.delete(voice);
      try {
        osc.disconnect();
        gain.disconnect();
      } catch {
        // Ignored
      }
    };
  }

  /**
   * Procedural drum synthesis for each row:
   * Row 0: Hi-Hat (crisp highpass noise)
   * Row 1: Hand Clap (textured multi-burst filtered noise)
   * Row 2: Snare Drum (snappy tone + noise snap)
   * Row 3: Low Tom (warm resonant downward pitch sweep)
   * Row 4: Bass Kick (punchy deep 150Hz -> 36Hz kick)
   */
  public playDrumAt(row: number, startTime: number, volume = 0.65): void {
    if (!this.ctx || !this.masterGain) return;

    const normalizedRow = Math.max(0, Math.min(4, row));
    switch (normalizedRow) {
      case 0:
        this.playHiHatAt(startTime, volume * 0.7);
        break;
      case 1:
        this.playClapAt(startTime, volume * 0.85);
        break;
      case 2:
        this.playSnareAt(startTime, volume * 0.9);
        break;
      case 3:
        this.playTomAt(startTime, volume * 0.95);
        break;
      case 4:
      default:
        this.playKickAt(startTime, volume);
        break;
    }
  }

  /**
   * Bass Kick: punchy frequency drop + exponential decay
   */
  private playKickAt(startTime: number, volume = 0.75): void {
    if (!this.ctx || !this.masterGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    // Frequency drop from 150Hz down to 36Hz
    osc.frequency.setValueAtTime(150, startTime);
    osc.frequency.exponentialRampToValueAtTime(36, startTime + 0.09);

    // Punchy volume envelope
    gain.gain.setValueAtTime(volume, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.26);

    osc.connect(gain);
    gain.connect(this.masterGain);

    const stopTime = startTime + 0.28;
    osc.start(startTime);
    osc.stop(stopTime);

    const voice: ActiveVoice = {
      stopTime,
      stop: (now) => {
        gain.gain.cancelScheduledValues(now);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.01);
        osc.stop(now + 0.01);
      },
    };
    this.activeVoices.add(voice);

    osc.onended = () => {
      this.activeVoices.delete(voice);
      try {
        osc.disconnect();
        gain.disconnect();
      } catch {
        // Ignored
      }
    };
  }

  /**
   * Snare Drum: body tone pop + white noise rattle
   */
  private playSnareAt(startTime: number, volume = 0.6): void {
    if (!this.ctx || !this.masterGain) return;

    // 1. Tonal body
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(185, startTime);
    osc.frequency.exponentialRampToValueAtTime(75, startTime + 0.07);

    oscGain.gain.setValueAtTime(volume * 0.7, startTime);
    oscGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.12);

    osc.connect(oscGain);
    oscGain.connect(this.masterGain);

    osc.start(startTime);
    osc.stop(startTime + 0.13);

    // 2. Noise rattle
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.getNoiseBuffer();

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.setValueAtTime(900, startTime);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(volume * 0.8, startTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.18);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.masterGain);

    noise.start(startTime);
    noise.stop(startTime + 0.2);

    const stopTime = startTime + 0.2;
    const voice: ActiveVoice = {
      stopTime,
      stop: (now) => {
        try {
          osc.stop(now + 0.01);
          noise.stop(now + 0.01);
        } catch {
          // Ignored
        }
      },
    };
    this.activeVoices.add(voice);

    noise.onended = () => {
      this.activeVoices.delete(voice);
    };
  }

  /**
   * Hi-Hat: Crisp, short metallic noise burst
   */
  private playHiHatAt(startTime: number, volume = 0.45): void {
    if (!this.ctx || !this.masterGain) return;

    const noise = this.ctx.createBufferSource();
    noise.buffer = this.getNoiseBuffer();

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(7500, startTime);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, startTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.05);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    const stopTime = startTime + 0.06;
    noise.start(startTime);
    noise.stop(stopTime);

    const voice: ActiveVoice = {
      stopTime,
      stop: (now) => {
        try {
          noise.stop(now + 0.01);
        } catch {
          // Ignored
        }
      },
    };
    this.activeVoices.add(voice);

    noise.onended = () => {
      this.activeVoices.delete(voice);
    };
  }

  /**
   * Low Tom: pitched sine sweep with round resonance
   */
  private playTomAt(startTime: number, volume = 0.65): void {
    if (!this.ctx || !this.masterGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, startTime);
    osc.frequency.exponentialRampToValueAtTime(80, startTime + 0.16);

    gain.gain.setValueAtTime(volume, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.24);

    osc.connect(gain);
    gain.connect(this.masterGain);

    const stopTime = startTime + 0.25;
    osc.start(startTime);
    osc.stop(stopTime);

    const voice: ActiveVoice = {
      stopTime,
      stop: (now) => {
        gain.gain.cancelScheduledValues(now);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.01);
        osc.stop(now + 0.01);
      },
    };
    this.activeVoices.add(voice);

    osc.onended = () => {
      this.activeVoices.delete(voice);
    };
  }

  /**
   * Hand Clap: triple micro-pulse noise burst
   */
  private playClapAt(startTime: number, volume = 0.55): void {
    if (!this.ctx || !this.masterGain) return;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1150, startTime);
    filter.Q.setValueAtTime(1.5, startTime);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, startTime);

    // 3 quick micro-bursts 11ms apart
    const p1 = startTime;
    const p2 = startTime + 0.011;
    const p3 = startTime + 0.022;

    gain.gain.setValueAtTime(volume * 0.7, p1);
    gain.gain.linearRampToValueAtTime(volume * 0.15, p1 + 0.009);

    gain.gain.setValueAtTime(volume * 0.85, p2);
    gain.gain.linearRampToValueAtTime(volume * 0.2, p2 + 0.009);

    gain.gain.setValueAtTime(volume, p3);
    gain.gain.exponentialRampToValueAtTime(0.001, p3 + 0.14);

    const noise = this.ctx.createBufferSource();
    noise.buffer = this.getNoiseBuffer();

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    const stopTime = p3 + 0.15;
    noise.start(startTime);
    noise.stop(stopTime);

    const voice: ActiveVoice = {
      stopTime,
      stop: (now) => {
        try {
          noise.stop(now + 0.01);
        } catch {
          // Ignored
        }
      },
    };
    this.activeVoices.add(voice);

    noise.onended = () => {
      this.activeVoices.delete(voice);
    };
  }

  /**
   * Immediate preview for piano pitch.
   */
  public previewPitch(pitch: PitchName): void {
    const ctx = this.getAudioContext();
    const now = ctx.currentTime;
    const freq = pitchNameToFrequency(pitch);
    this.playToneAt(freq, now, 0.28, 0.4);
  }

  /**
   * Immediate preview for drum row.
   */
  public previewDrum(row: number): void {
    const ctx = this.getAudioContext();
    const now = ctx.currentTime;
    this.playDrumAt(row, now, 0.7);
  }

  /**
   * Audition sound based on current instrument and row/pitch.
   */
  public previewSound(instrument: InstrumentType, row: number, pitch: PitchName): void {
    if (instrument === 'drums') {
      this.previewDrum(row);
    } else {
      this.previewPitch(pitch);
    }
  }

  public dispose(): void {
    this.stop();
    if (this.ctx && this.ctx.state !== 'closed') {
      this.ctx.close();
      this.ctx = null;
    }
    this.stepListeners.clear();
    this.statusListeners.clear();
  }
}
