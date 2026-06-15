/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Web Audio API Retro Synth Engine for Neon Beats Snake
// Creates rich, procedural synthwave tracks totally in-browser.

export interface BeatStepData {
  step: number;        // 0 to 15
  quarterNote: number; // 0 to 3
  bpm: number;
  time: number;
}

export type BeatCallback = (data: BeatStepData) => void;

export interface TrackPreset {
  id: string;
  name: string;
  description: string;
  bpm: number;
  scale: number[]; // Midi notes or bass pitches
  color: string;   // Neon primary color tag (cyan, magenta, etc)
  bassPattern: number[]; // 16 steps of indexes (-1 is rest)
  leadPattern: number[]; // 16 steps of indexes
  drumPattern: {
    kick: boolean[];
    snare: boolean[];
    hihat: boolean[];
  };
}

// Interactive scale pitches (chords in G minor, C dorian, F minor, A phrygian, etc.)
export const TRACKS: TrackPreset[] = [
  {
    id: "horizon",
    name: "Synthwave Horizon",
    description: "Classic driving Retrowave with a pulsing analog baseline and warm delayed lead",
    bpm: 118,
    scale: [36, 38, 39, 41, 43, 44, 46, 48], // C minor scale (C2 to C3)
    color: "#ec4899", // Neon Pink
    bassPattern: [0, -1, 0, 0, 3, -1, 3, 2, 4, -1, 4, 4, 5, 6, 5, 3],
    leadPattern: [4, 5, 6, 7, 6, 5, 4, 3, 4, 5, 6, 7, 7, 6, 5, 4],
    drumPattern: {
      kick:  [true,  false, false, false, true,  false, false, false, true,  false, false, false, true,  false, false, false],
      snare: [false, false, false, false, true,  false, false, false, false, false, false, false, true,  false, false, false],
      hihat: [true,  false, true,  false, true,  false, true,  false, true,  false, true,  false, true,  false, true,  true],
    }
  },
  {
    id: "cyberchase",
    name: "Cyberpunk Chase",
    description: "Fast-paced action arpeggiator with industrial heavy bass hits and high energy",
    bpm: 135,
    scale: [45, 47, 48, 50, 52, 53, 55, 57], // A minor (A2 to A3)
    color: "#06b6d4", // Neon Cyan
    bassPattern: [0, 0, 3, 0, 0, 4, 0, 0, 5, 5, 4, 4, 3, 3, 2, 1],
    leadPattern: [0, 2, 4, 5, 7, 5, 4, 2, 3, 5, 7, 8, 10, 8, 7, 5],
    drumPattern: {
      kick:  [true,  false, false, true,  true,  false, false, false, true,  false, true,  false, true,  false, false, false],
      snare: [false, false, false, false, true,  false, false, true,  false, false, false, false, true,  false, true,  false],
      hihat: [true,  true,  true,  true,  true,  true,  true,  true,  true,  true,  true,  true,  true,  true,  true,  true],
    }
  },
  {
    id: "chiptune",
    name: "Retro Arcade Odyssey",
    description: "Bouncy, playful 8-bit chiptune melodies featuring classic square wave leads",
    bpm: 110,
    scale: [43, 45, 47, 48, 50, 52, 54, 55], // G major (G2 to G3)
    color: "#10b981", // Neon Green
    bassPattern: [0, -1, 4, -1, 5, -1, 2, -1, 3, 3, 4, 4, 5, -1, 0, -1],
    leadPattern: [0, 1, 2, 3, 4, 3, 2, 1, 5, 4, 3, 2, 6, 7, 6, 5],
    drumPattern: {
      kick:  [true,  false, false, false, false, false, true,  false, true,  false, false, false, false, false, true,  false],
      snare: [false, false, false, false, true,  false, false, false, false, false, false, false, true,  false, false, false],
      hihat: [true,  false, false, true,  false, true,  false, true,  true,  false, false, true,  false, true,  false, false],
    }
  },
  {
    id: "neoncalm",
    name: "Neon Dreams Chill",
    description: "Low-tempo ambient synthwave featuring warm nostalgic pads and high-resonance plucks",
    bpm: 96,
    scale: [41, 43, 45, 46, 48, 50, 52, 53], // F major (F2 to G3)
    color: "#a855f7", // Neon Purple
    bassPattern: [0, -1, -1, 0, -1, -1, 3, -1, 4, -1, -1, 4, -1, -1, 2, -1],
    leadPattern: [7, -1, 5, -1, 4, -1, 2, -1, 3, -1, 4, -1, 5, 4, 3, 2],
    drumPattern: {
      kick:  [true,  false, false, false, false, false, false, false, true,  false, false, false, false, false, false, false],
      snare: [false, false, false, false, true,  false, false, false, false, false, false, false, true,  false, false, false],
      hihat: [true,  false, true,  false, true,  false, true,  false, true,  false, true,  false, true,  false, true,  false],
    }
  }
];

export class AudioEngine {
  public ctx: AudioContext | null = null;
  public masterGain: GainNode | null = null;
  public filterNode: BiquadFilterNode | null = null;
  public delayNode: DelayNode | null = null;
  public delayFeedback: GainNode | null = null;
  public analyserNode: AnalyserNode | null = null;

  // Track Parameters
  private currentTrackIndex = 0;
  private bpm = 120;
  private isPlaying = false;
  private volume = 0.5;
  private filterCutoff = 2000;
  private filterResonance = 2.0;

  // Custom User Sequencer State (overlying track or custom grid)
  public customStepMatrix: boolean[][] = Array(4).fill(null).map(() => Array(16).fill(false)); // Row 0: Beat Drum, Row 1: Synth Mel, Row 2: Ambient Pad, Row 3: Noise Snap
  
  // Audio Scheduling parameters
  private schedulerTimerId: number | null = null;
  private nextNoteTime = 0.0; // Seconds when next 16th note starts
  private currentStep = 0;    // 0 to 15 step count
  private scheduleAheadTime = 0.1; // How far to look ahead (seconds)
  private lookaheadInterval = 25.0; // Polling rate (ms)

  // Subscriptions block
  private beatCallbacks: Set<BeatCallback> = new Set();

  constructor() {
    // Lazy initialisation happens on user engagement to comply with browsers and constraints.
  }

  public init() {
    if (this.ctx) return;
    
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.ctx = new AudioContextClass();
    
    // Create Analyser for neon visualizer
    this.analyserNode = this.ctx.createAnalyser();
    this.analyserNode.fftSize = 128; // Keep it clean and low cost

    // Master Gain
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);

    // Audio routing chains:
    // Synth nodes -> Filter Node -> Delay Node -> Master Gain -> Analyser -> Output
    this.filterNode = this.ctx.createBiquadFilter();
    this.filterNode.type = "lowpass";
    this.filterNode.frequency.setValueAtTime(this.filterCutoff, this.ctx.currentTime);
    this.filterNode.Q.setValueAtTime(this.filterResonance, this.ctx.currentTime);

    // Dynamic delay engine for spatial stereo synth delay effect
    this.delayNode = this.ctx.createDelay(1.0);
    this.delayNode.delayTime.setValueAtTime(0.25, this.ctx.currentTime); // quarter-note delay approx
    this.delayFeedback = this.ctx.createGain();
    this.delayFeedback.gain.setValueAtTime(0.4, this.ctx.currentTime);

    // Feedback loops
    this.delayNode.connect(this.delayFeedback);
    this.delayFeedback.connect(this.delayNode);

    // Router connections
    this.filterNode.connect(this.masterGain);
    this.filterNode.connect(this.delayNode);
    this.delayNode.connect(this.masterGain);

    this.masterGain.connect(this.analyserNode);
    this.analyserNode.connect(this.ctx.destination);

    // Initialise track params
    const track = TRACKS[this.currentTrackIndex];
    this.bpm = track.bpm;
  }

  public resume() {
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  public subscribeToBeat(callback: BeatCallback) {
    this.beatCallbacks.add(callback);
    return () => {
      this.beatCallbacks.delete(callback);
    };
  }

  private triggerBeatCallbacks(time: number) {
    const quarterNote = Math.floor(this.currentStep / 4);
    const data: BeatStepData = {
      step: this.currentStep,
      quarterNote,
      bpm: this.bpm,
      time
    };
    this.beatCallbacks.forEach(cb => {
      try {
        cb(data);
      } catch (err) {
        console.error("Error in beat subscriber:", err);
      }
    });
  }

  public start() {
    this.init();
    this.resume();
    if (this.isPlaying) return;

    this.isPlaying = true;
    if (this.ctx) {
      this.nextNoteTime = this.ctx.currentTime + 0.05;
      this.currentStep = 0;
      this.scheduler();
    }
  }

  public pause() {
    this.isPlaying = false;
    if (this.schedulerTimerId) {
      clearTimeout(this.schedulerTimerId);
      this.schedulerTimerId = null;
    }
  }

  public togglePlay() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.start();
    }
    return this.isPlaying;
  }

  public isCurrentlyPlaying() {
    return this.isPlaying;
  }

  public setTrackIndex(index: number) {
    if (index < 0 || index >= TRACKS.length) return;
    this.currentTrackIndex = index;
    const track = TRACKS[index];
    this.bpm = track.bpm;
  }

  public getCurrentTrack(): TrackPreset {
    return TRACKS[this.currentTrackIndex];
  }

  public getTrackIndex(): number {
    return this.currentTrackIndex;
  }

  public setBpm(newBpm: number) {
    this.bpm = Math.max(60, Math.min(220, newBpm));
  }

  public getBpm(): number {
    return this.bpm;
  }

  public setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1.0, v));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  public setFilterCutoff(cutoff: number) {
    this.filterCutoff = Math.max(100, Math.min(10000, cutoff));
    if (this.filterNode && this.ctx) {
      this.filterNode.frequency.setValueAtTime(this.filterCutoff, this.ctx.currentTime);
    }
  }

  public getFilterCutoff(): number {
    return this.filterCutoff;
  }

  // Helper converting MIDI Note numbers to frequencies (Midi Note 60 = 261.63Hz middle C)
  private midiNoteToHz(note: number): number {
    return 440 * Math.pow(2, (note - 69) / 12);
  }

  // --- AUDIO SYNTHESIS SOUND VOICES ---

  // Kick Drum synthesizer
  private playKickVoice(time: number) {
    if (!this.ctx || !this.filterNode) return;
    
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.connect(gain);
    gain.connect(this.filterNode);

    osc.type = "sine";
    // Rapid pitch sweep downwards creates the punchy chiptune kick drum impact
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.12);

    gain.gain.setValueAtTime(0.9, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.15);

    osc.start(time);
    osc.stop(time + 0.16);
  }

  // Hi-Hat synthesizer (simulated electronic noise burst)
  private playHiHatVoice(time: number) {
    if (!this.ctx || !this.filterNode) return;

    // Create a buffer filled with white noise
    const bufferSize = this.ctx.sampleRate * 0.05; // Short 50ms burst
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noiseNode = this.ctx.createBufferSource();
    noiseNode.buffer = buffer;

    // Highpass filter for the crisp sizzle
    const highpass = this.ctx.createBiquadFilter();
    highpass.type = "highpass";
    highpass.frequency.setValueAtTime(7000, time);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.2, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.04);

    noiseNode.connect(highpass);
    highpass.connect(gain);
    gain.connect(this.filterNode);

    noiseNode.start(time);
  }

  // Snare drum voice (synthesized synth snare)
  private playSnareVoice(time: number) {
    if (!this.ctx || !this.filterNode) return;

    // Triangle osc body
    const osc = this.ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(180, time);
    osc.frequency.exponentialRampToValueAtTime(100, time + 0.08);

    const oscGain = this.ctx.createGain();
    oscGain.gain.setValueAtTime(0.3, time);
    oscGain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);

    // Noise snap components
    const bufferSize = this.ctx.sampleRate * 0.12; 
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.setValueAtTime(1000, time);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.35, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, time + 0.12);

    osc.connect(oscGain);
    oscGain.connect(this.filterNode);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.filterNode);

    osc.start(time);
    osc.stop(time + 0.12);
    
    noise.start(time);
  }

  // Melodic Bass voice
  private playBassVoice(time: number, midiNote: number) {
    if (!this.ctx || !this.filterNode || midiNote < 0) return;

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(this.filterNode);

    // Fat rolling sawtooth bass
    osc1.type = "sawtooth";
    osc2.type = "triangle";

    const freq = this.midiNoteToHz(midiNote);
    osc1.frequency.setValueAtTime(freq, time);
    // slightly detune second oscillator for thickness
    osc2.frequency.setValueAtTime(freq + 1.2, time);

    gainNode.gain.setValueAtTime(0.4, time);
    gainNode.gain.exponentialRampToValueAtTime(0.01, time + 0.24);

    osc1.start(time);
    osc2.start(time);

    osc1.stop(time + 0.25);
    osc2.stop(time + 0.25);
  }

  // Rich Melodic Lead voice
  private playLeadVoice(time: number, midiNote: number) {
    if (!this.ctx || !this.filterNode || midiNote < 0) return;

    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();

    osc.connect(gainNode);
    gainNode.connect(this.filterNode);

    const useChiptune = TRACKS[this.currentTrackIndex].id === "chiptune";
    osc.type = useChiptune ? "square" : "sawtooth"; // Square wave gives 8-bit vibes

    // Transpose melody scale upwards for playability
    const freq = this.midiNoteToHz(midiNote + 24); 
    osc.frequency.setValueAtTime(freq, time);

    gainNode.gain.setValueAtTime(0.25, time);
    gainNode.gain.exponentialRampToValueAtTime(0.01, time + 0.18);

    osc.start(time);
    osc.stop(time + 0.2);
  }

  // Ambient chords scheduler
  private playPadVoice(time: number, midiNote: number) {
    if (!this.ctx || !this.filterNode || midiNote < 0) return;

    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();

    osc.connect(gainNode);
    gainNode.connect(this.filterNode);

    osc.type = "triangle";
    const freq = this.midiNoteToHz(midiNote + 12);
    osc.frequency.setValueAtTime(freq, time);

    gainNode.gain.setValueAtTime(0.0, time);
    gainNode.gain.linearRampToValueAtTime(0.12, time + 0.3); // Warm slow attack
    gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.9);

    osc.start(time);
    osc.stop(time + 1.0);
  }

  // Custom User Sequence Voices trigger
  private playUserSequenceEvent(time: number) {
    if (!this.ctx) return;
    // Row 0: Custom Beat drum
    if (this.customStepMatrix[0][this.currentStep]) {
      this.playKickVoice(time);
      this.playSnareVoice(time + 0.1);
    }
    // Row 1: Custom melody pluck
    if (this.customStepMatrix[1][this.currentStep]) {
      const track = TRACKS[this.currentTrackIndex];
      const note = track.scale[this.currentStep % track.scale.length];
      this.playLeadVoice(time, note);
    }
    // Row 2: Custom Pad trigger
    if (this.customStepMatrix[2][this.currentStep]) {
      const track = TRACKS[this.currentTrackIndex];
      const note = track.scale[0]; // tonic
      this.playPadVoice(time, note);
    }
    // Row 3: Ambient noise blast snap
    if (this.customStepMatrix[3][this.currentStep]) {
      this.playHiHatVoice(time);
    }
  }

  // --- SCHEDULING LOGIC ---
  private scheduleNextNote(step: number, time: number) {
    const track = TRACKS[this.currentTrackIndex];

    // Play default patterns defined in track settings
    
    // 1. Drums
    if (track.drumPattern.kick[step]) {
      this.playKickVoice(time);
    }
    if (track.drumPattern.snare[step]) {
      this.playSnareVoice(time);
    }
    if (track.drumPattern.hihat[step]) {
      this.playHiHatVoice(time);
    }

    // 2. Bass Pattern
    const bassNoteIndex = track.bassPattern[step];
    if (bassNoteIndex !== -1) {
      const noteNum = track.scale[bassNoteIndex % track.scale.length];
      this.playBassVoice(time, noteNum);
    }

    // 3. Lead Pattern
    const leadNoteIndex = track.leadPattern[step];
    if (leadNoteIndex !== -1) {
      const noteNum = track.scale[leadNoteIndex % track.scale.length];
      this.playLeadVoice(time, noteNum);
    }

    // Play user-specific overlay notes
    this.playUserSequenceEvent(time);

    // Call subscribers to sync visuals, snake animations, and movement ticks
    this.triggerBeatCallbacks(time);
  }

  private scheduler() {
    if (!this.isPlaying || !this.ctx) return;

    while (this.nextNoteTime < this.ctx.currentTime + this.scheduleAheadTime) {
      this.scheduleNextNote(this.currentStep, this.nextNoteTime);
      
      // Calculate next 16th note absolute timing
      const secondsPerBeat = 60.0 / this.bpm;
      const stepDuration = secondsPerBeat / 4.0; // 16th notes
      
      this.nextNoteTime += stepDuration;
      
      // advance step
      this.currentStep = (this.currentStep + 1) % 16;
    }

    this.schedulerTimerId = window.setTimeout(() => this.scheduler(), this.lookaheadInterval);
  }

  // --- SOUND EFFECTS CHIMES FOR ARCADE EVENTS ---

  // Eat Chime Sound Effect - plays a beautiful harmonized note aligned with the current playing track!
  public playEatFeedbackChime(scoreMultiplier = 1) {
    this.init();
    this.resume();
    if (!this.ctx || !this.filterNode) return;

    const track = TRACKS[this.currentTrackIndex];
    // Map score multiplier to scale degrees (makes food chords sound dynamic!)
    const scaleIndex = (scoreMultiplier - 1) % track.scale.length;
    const baseNote = track.scale[scaleIndex];

    const time = this.ctx.currentTime;

    // Harmonic arpeggio (3 notes)
    [0, 4, 7].forEach((interval, idx) => {
      if (!this.ctx || !this.filterNode) return;
      
      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();

      osc.connect(gainNode);
      gainNode.connect(this.filterNode);

      osc.type = "sine";
      const actualNote = baseNote + 24 + interval; // High pitch chime
      osc.frequency.setValueAtTime(this.midiNoteToHz(actualNote), time + idx * 0.05);

      gainNode.gain.setValueAtTime(0.15, time + idx * 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.001, time + idx * 0.05 + 0.25);

      osc.start(time + idx * 0.05);
      osc.stop(time + idx * 0.05 + 0.3);
    });

    // Also a quick little noise splash for snack texture
    this.playHiHatVoice(time);
  }

  // Game Over explosion slide sound effect
  public playCrashFeedbackSound() {
    this.init();
    this.resume();
    if (!this.ctx || !this.filterNode) return;

    const time = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const noiseGain = this.ctx.createGain();

    osc.connect(noiseGain);
    noiseGain.connect(this.filterNode);

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(180, time);
    osc.frequency.exponentialRampToValueAtTime(30, time + 0.6); // Slopes down to grave heavy rumble

    noiseGain.gain.setValueAtTime(0.4, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.7);

    // Add noise component
    const bufferSize = this.ctx.sampleRate * 0.5;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noiseNode = this.ctx.createBufferSource();
    noiseNode.buffer = buffer;

    const lp = this.ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(400, time);

    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.35, time);
    ng.gain.exponentialRampToValueAtTime(0.001, time + 0.5);

    noiseNode.connect(lp);
    lp.connect(ng);
    ng.connect(this.filterNode);

    osc.start(time);
    osc.stop(time + 0.8);

    noiseNode.start(time);
  }

  // Game Level Up melodic sweep sound
  public playLevelUpFeedbackSound() {
    this.init();
    this.resume();
    if (!this.ctx || !this.filterNode) return;

    const time = this.ctx.currentTime;
    const track = TRACKS[this.currentTrackIndex];
    
    // Pitch sweep up scale degrees
    [0, 2, 4, 7, 12].forEach((interval, idx) => {
      if (!this.ctx || !this.filterNode) return;
      
      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();

      osc.connect(gainNode);
      gainNode.connect(this.filterNode);

      osc.type = "triangle";
      const startFreq = this.midiNoteToHz(track.scale[0] + 12 + interval);
      osc.frequency.setValueAtTime(startFreq, time + idx * 0.08);

      gainNode.gain.setValueAtTime(0.2, time + idx * 0.08);
      gainNode.gain.exponentialRampToValueAtTime(0.001, time + idx * 0.08 + 0.3);

      osc.start(time + idx * 0.08);
      osc.stop(time + idx * 0.08 + 0.4);
    });
  }
}

// Single core singleton instance
export const audioService = new AudioEngine();
