/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Volume2,
  VolumeX,
  Music,
  Sliders,
  Clock,
  Sparkles,
  Trash2,
  HelpCircle,
  Tv,
  Gamepad2,
  Check
} from "lucide-react";
import { audioService, TRACKS } from "./audioEngine";
import { AudioVisualizer } from "./components/AudioVisualizer";
import { SnakeBoard } from "./components/SnakeBoard";

export default function App() {
  const [activeTrackIndex, setActiveTrackIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [bpm, setBpm] = useState<number>(TRACKS[0].bpm);
  const [volume, setVolume] = useState<number>(0.5);
  const [filterCutoff, setFilterCutoff] = useState<number>(3000);
  
  // Custom Sequencer Overlay Parameters
  const [sequencerMatrix, setSequencerMatrix] = useState<boolean[][]>(() => {
    return Array(4).fill(null).map(() => Array(16).fill(false));
  });
  const [currentBeatStep, setCurrentBeatStep] = useState<number>(0);
  const [currentTimeText, setCurrentTimeText] = useState<string>("00:00:00");
  const [showGuide, setShowGuide] = useState<boolean>(false);
  
  const currentTrack = TRACKS[activeTrackIndex];

  // Keep a digital clock ticking in the header (looks neat!)
  useEffect(() => {
    const timerId = setInterval(() => {
      const now = new Date();
      // Format to Japan Standard Time (JST)
      setCurrentTimeText(
        now.toLocaleTimeString("ja-JP", {
          timeZone: "Asia/Tokyo",
          hour12: false,
        })
      );
    }, 1000);
    return () => clearInterval(timerId);
  }, []);

  // Sync state loop with audioService
  useEffect(() => {
    // Initialise sliders matching service defaults
    audioService.setTrackIndex(activeTrackIndex);
    audioService.setBpm(TRACKS[activeTrackIndex].bpm);
    audioService.setVolume(volume);
    audioService.setFilterCutoff(filterCutoff);

    // Subscribe to current audio play steps to drive visualizer LEDs & markers
    const unsubscribe = audioService.subscribeToBeat((beatData) => {
      setCurrentBeatStep(beatData.step);
      // Sync reactive states
      setIsPlaying(audioService.isCurrentlyPlaying());
    });

    return () => {
      unsubscribe();
    };
  }, [activeTrackIndex]);

  // Audio actions
  const handleTogglePlay = () => {
    audioService.init();
    audioService.resume();
    const playing = audioService.togglePlay();
    setIsPlaying(playing);
  };

  const handleChangeTrack = (index: number) => {
    let nextIndex = index;
    if (nextIndex < 0) nextIndex = TRACKS.length - 1;
    if (nextIndex >= TRACKS.length) nextIndex = 0;
    
    setActiveTrackIndex(nextIndex);
    audioService.setTrackIndex(nextIndex);
    setBpm(TRACKS[nextIndex].bpm);
    audioService.setBpm(TRACKS[nextIndex].bpm);

    // Play feedback sound
    audioService.playLevelUpFeedbackSound();
  };

  const handleBpmChange = (val: number) => {
    setBpm(val);
    audioService.setBpm(val);
  };

  const handleVolumeChange = (val: number) => {
    setVolume(val);
    audioService.setVolume(val);
  };

  const handleCutoffChange = (val: number) => {
    setFilterCutoff(val);
    audioService.setFilterCutoff(val);
  };

  // Toggle Sequencer Grid buttons
  const toggleSequencerNode = (row: number, col: number) => {
    audioService.init();
    audioService.resume();
    
    const nextMatrix = sequencerMatrix.map((r, rIdx) => {
      if (rIdx === row) {
        return r.map((cell, cIdx) => (cIdx === col ? !cell : cell));
      }
      return r;
    });

    setSequencerMatrix(nextMatrix);
    audioService.customStepMatrix[row][col] = !audioService.customStepMatrix[row][col];
    
    // Quick little trigger test
    if (audioService.customStepMatrix[row][col]) {
      audioService.playEatFeedbackChime(col + 1);
    }
  };

  const clearUserSequence = () => {
    const blankMatrix = Array(4).fill(null).map(() => Array(16).fill(false));
    setSequencerMatrix(blankMatrix);
    audioService.customStepMatrix = blankMatrix;
  };

  return (
    <div id="application_root" className="min-h-screen bg-[#050508] text-zinc-100 font-sans selection:bg-cyan-500 selection:text-black flex flex-col justify-between relative overflow-hidden">
      
      {/* Decorative Warm Ambient Colored Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[50%] bg-purple-900/15 rounded-full blur-[130px] pointer-events-none z-0" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[50%] bg-cyan-950/20 rounded-full blur-[130px] pointer-events-none z-0" />
      <div className="absolute top-[40%] left-[35%] w-[40%] h-[30%] bg-pink-905/10 bg-pink-900/5 rounded-full blur-[120px] pointer-events-none z-0" />

      {/* GLOWING HEADER */}
      <header className="border-b border-white/10 bg-white/5 backdrop-blur-xl sticky top-0 z-40 px-4 py-3 sm:px-6 relative">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500/20 via-purple-500/10 to-cyan-400/20 p-[1px] shadow-[0_0_20px_rgba(6,182,212,0.15)] flex items-center justify-center">
              <div className="w-full h-full bg-[#050508]/80 rounded-[10px] flex items-center justify-center">
                <Music className="w-5 h-5 text-cyan-400 animate-pulse" />
              </div>
            </div>
            
            <div>
              <h1 className="text-md sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
                BEAT <span className="italic text-cyan-400 font-extrabold">SNAKE</span> <span className="text-[9px] font-mono bg-white/10 text-cyan-300 px-2 py-0.5 rounded border border-white/15">GLASS PRESENCE</span>
              </h1>
              <p className="text-[10px] sm:text-xs text-zinc-400 font-mono">BPM SYNCED FLOW & ARCADE ENGINE</p>
            </div>
          </div>

          {/* Clock indicator */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowGuide(!showGuide)}
              className="text-xs text-zinc-200 hover:text-white flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition cursor-pointer font-semibold outline-none shadow-sm"
            >
              <HelpCircle className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">How To Play</span>
            </button>

            <div className="hidden md:flex items-center gap-2 font-mono text-[11px] text-zinc-300 border border-white/10 bg-white/5 px-3.5 py-1.5 rounded-xl select-none">
              <Clock className="w-3.5 h-3.5 text-pink-400 animate-spin-slow" />
              <span>TIME_JST: <strong className="text-cyan-400 font-bold">{currentTimeText}</strong></span>
            </div>
          </div>
        </div>
      </header>

      {/* SYSTEM GUIDE MODAL OVERLAY */}
      <AnimatePresence>
        {showGuide && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/65 backdrop-blur-md z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="w-full max-w-lg glass-panel-heavy rounded-3xl overflow-hidden p-6 sm:p-8 relative text-zinc-100"
            >
              <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-cyan-400" />
                Frosted Arcade Console Guide
              </h3>
              <p className="text-zinc-300 text-xs sm:text-sm mb-4 leading-relaxed font-sans">
                Welcome to the synth player meets retro snake! The synthesizer engine and your game play timeline flow in rhythm-locked coordination.
              </p>

              <div className="space-y-4 text-xs font-mono">
                {/* Rule 1 */}
                <div className="p-3 bg-white/5 border border-white/10 rounded-xl">
                  <h4 className="text-cyan-300 font-bold mb-1 flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> 1. THE RHYTHM LOCK TIMING
                  </h4>
                  <p className="text-zinc-400 pl-4">
                    In "Rhythm-Locked" mode, the snake slides on the beat step clocks. Speed up the BPM slider to make the snake race faster!
                  </p>
                </div>

                {/* Rule 2 */}
                <div className="p-3 bg-white/5 border border-white/10 rounded-xl">
                  <h4 className="text-pink-300 font-bold mb-1 flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> 2. MELODIC CHORD FOODS
                  </h4>
                  <p className="text-zinc-400 pl-4">
                    Food items represent active tone notes. Eating a note triggers high pitch synth pitch chimes that sync with the background scale chord loop.
                  </p>
                </div>

                {/* Rule 3 */}
                <div className="p-3 bg-white/5 border border-white/10 rounded-xl">
                  <h4 className="text-[#bfdbfe] font-bold mb-1 flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> 3. STEP MATRIX SEQUENCER
                  </h4>
                  <p className="text-zinc-400 pl-4">
                    Push buttons on the step matrix grid below to overlay custom percussion and melodic loops in real-time.
                  </p>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setShowGuide(false)}
                  className="px-5 py-2.5 rounded-xl bg-white text-zinc-950 hover:bg-neutral-100 text-xs font-bold transition-transform active:scale-95 cursor-pointer outline-none shadow-md"
                >
                  DISMISS GUIDE
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* DASHBOARD COCKPIT */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-6 md:py-8 z-10 relative">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* LEFT COLUMN: THE MUSIC STATION (6 columns) */}
          <div className="lg:col-span-6 flex flex-col gap-6">
            
            {/* PANEL 1: RETRO NOW PLAYING DECK */}
            <div className="glass-panel p-5 rounded-3xl flex flex-col gap-4">
              
              <div className="flex items-center justify-between select-none">
                <div className="flex items-center gap-2">
                  <Tv className="w-4 h-4 text-pink-400" />
                  <span className="text-xs font-mono text-zinc-400 uppercase tracking-widest">SYNAPSE_RECEIVER_STATE</span>
                </div>
                <div className="flex items-center gap-1 text-[10px] font-mono bg-pink-500/10 text-pink-300 px-2.5 py-0.5 rounded-lg border border-pink-500/20">
                  <span className={`w-1.5 h-1.5 rounded-full bg-pink-400 ${isPlaying ? "animate-ping" : ""}`} />
                  {isPlaying ? "RECEIVING_AUDIO" : "STANDBY"}
                </div>
              </div>

              {/* Now Playing visual hub */}
              <div className="bg-white/5 border border-white/10 p-4 rounded-2xl flex items-center gap-4">
                
                {/* Hologram CD rotation representation */}
                <div className="relative flex-shrink-0">
                  <div 
                    style={{ borderColor: currentTrack.color, boxShadow: isPlaying ? `0 0 20px ${currentTrack.color}44` : "none" }}
                    className={`w-20 h-20 rounded-full border bg-black/40 flex items-center justify-center relative overflow-hidden ${
                      isPlaying ? "animate-spin-slow" : ""
                    }`}
                  >
                    {/* Inner retro grooves */}
                    <div className="absolute inset-2 rounded-full border border-white/5" />
                    <div className="absolute inset-4 rounded-full border border-white/5" />
                    <div className="absolute inset-6 rounded-full border border-white/5" />
                    
                    {/* Glowing core badge */}
                    <div 
                      style={{ backgroundColor: currentTrack.color }}
                      className="w-5 h-5 rounded-full flex items-center justify-center shadow-inner z-10"
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-black/60" />
                    </div>
                  </div>
                  
                  {/* Styling neon arm needle */}
                  <div className={`absolute top-0 right-0 w-3 h-10 border-r border-white/40 origin-top transform transition-transform duration-500 ${
                    isPlaying ? "rotate-12" : "rotate-0"
                  }`} />
                </div>

                {/* Track Details */}
                <div className="flex-1 overflow-hidden">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">PLAYLIST CHANNEL</span>
                  <h2 className="text-lg font-bold text-white truncate">{currentTrack.name}</h2>
                  <p className="text-xs text-zinc-300 select-none mt-1 leading-normal line-clamp-2">{currentTrack.description}</p>
                </div>
              </div>

              {/* Deck Player Control Keys */}
              <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-2xl p-3 select-none">
                
                {/* Back Button */}
                <button
                  onClick={() => handleChangeTrack(activeTrackIndex - 1)}
                  className="p-3 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 text-zinc-300 hover:text-white border border-white/10 transition cursor-pointer outline-none"
                >
                  <SkipBack className="w-4 h-4 fill-current text-zinc-300" />
                </button>

                {/* Main Play Toggle Hero Button */}
                <button
                  onClick={handleTogglePlay}
                  style={{
                    "--glow-color": currentTrack.color,
                  } as any}
                  className={`py-4 px-10 sm:px-12 rounded-full font-black text-xs sm:text-sm tracking-widest flex items-center gap-3 transition active:scale-95 text-transform uppercase cursor-pointer outline-none animate-glow-pulse ${
                    isPlaying
                      ? "bg-white text-zinc-950"
                      : "bg-white/5 text-zinc-100 hover:bg-white/10 border border-white/25"
                  }`}
                >
                  {isPlaying ? (
                    <>
                      <Pause className="w-3.5 h-3.5 fill-current" />
                      <span>PAUSE ENGINE</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>PLAY FROSTED BEAT</span>
                    </>
                  )}
                </button>

                {/* Skip Button */}
                <button
                  onClick={() => handleChangeTrack(activeTrackIndex + 1)}
                  className="p-3 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 text-zinc-300 hover:text-white border border-white/10 transition cursor-pointer outline-none"
                >
                  <SkipForward className="w-4 h-4 fill-current text-zinc-300" />
                </button>
              </div>

              {/* Cyber Wave list channel selectors */}
              <div className="flex flex-col gap-2">
                <span className="text-[10px] font-mono text-zinc-400 uppercase">Interactive Presets</span>
                <div className="grid grid-cols-2 gap-2">
                  {TRACKS.map((track, idx) => (
                    <button
                      key={track.id}
                      onClick={() => handleChangeTrack(idx)}
                      className={`p-3 rounded-2xl border text-left flex items-start justify-between transition outline-none cursor-pointer ${
                        activeTrackIndex === idx
                          ? "bg-white/10 text-white"
                          : "bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-zinc-200"
                      }`}
                      style={{
                        borderColor: activeTrackIndex === idx ? track.color : "rgba(255, 255, 255, 0.1)"
                      }}
                    >
                      <div className="overflow-hidden pr-2">
                        <div className="text-xs font-semibold truncate">{track.name}</div>
                        <div className="text-[9px] font-mono text-zinc-400 mt-0.5">{track.bpm} BPM</div>
                      </div>
                      <span 
                        style={{ backgroundColor: track.color }}
                        className="w-1.5 h-1.5 rounded-full mt-1.5 shadow-sm"
                      />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* PANEL 2: SYNTHESIZER SLIDERS & LIVE EQUALIZER */}
            <div className="glass-panel p-5 rounded-3xl flex flex-col gap-4">
              
              <div className="flex items-center gap-2 select-none">
                <Sliders className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-mono text-zinc-400 uppercase tracking-widest">SYNTHE_GRID_KNOBS</span>
              </div>

              {/* Slider Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 select-none">
                
                {/* 1. MASTER VOLUME SLOPE */}
                <div className="p-3 bg-white/5 border border-white/10 rounded-2xl flex flex-col gap-2">
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-zinc-300">Volume</span>
                    <span className="text-cyan-300 font-bold">{Math.round(volume * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={volume}
                    onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                    className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-white/10 rounded-lg appearance-none"
                  />
                  <div className="flex items-center gap-1 text-[9px] font-mono text-zinc-400">
                    <Volume2 className="w-3 h-3 text-cyan-400/80" />
                    <span>Loudness curve gain</span>
                  </div>
                </div>

                {/* 2. DYNAMIC BPM (TEMPO CONVERTOR) */}
                <div className="p-3 bg-white/5 border border-white/10 rounded-2xl flex flex-col gap-2">
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-zinc-300">Tempo</span>
                    <span className="text-amber-400 font-bold">{bpm} BPM</span>
                  </div>
                  <input
                    type="range"
                    min="60"
                    max="200"
                    step="2"
                    value={bpm}
                    onChange={(e) => handleBpmChange(parseInt(e.target.value))}
                    className="w-full accent-amber-400 cursor-pointer h-1.5 bg-white/10 rounded-lg appearance-none"
                  />
                  <div className="flex items-center gap-1 text-[9px] font-mono text-zinc-400">
                    <Clock className="w-3 h-3 text-amber-450 text-amber-400" />
                    <span>Speeds up game beat</span>
                  </div>
                </div>

                {/* 3. BIQUAD FILTER CUTOFF */}
                <div className="p-3 bg-white/5 border border-white/10 rounded-2xl flex flex-col gap-2">
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-zinc-300">Cutoff</span>
                    <span className="text-pink-400 font-bold">{filterCutoff}Hz</span>
                  </div>
                  <input
                    type="range"
                    min="150"
                    max="6000"
                    step="100"
                    value={filterCutoff}
                    onChange={(e) => handleCutoffChange(parseInt(e.target.value))}
                    className="w-full accent-pink-400 cursor-pointer h-1.5 bg-white/10 rounded-lg appearance-none"
                  />
                  <div className="flex items-center gap-1 text-[9px] font-mono text-zinc-400">
                    <Sliders className="w-3 h-3 text-pink-400" />
                    <span>Analog lowpass swept</span>
                  </div>
                </div>

              </div>

              {/* Realtime Canvas Audio Visualizer spectrum */}
              <div className="h-28 w-full mt-2 bg-black/20 border border-white/10 rounded-2xl overflow-hidden shadow-inner">
                <AudioVisualizer glowColor={currentTrack.color} isPlaying={isPlaying} />
              </div>
            </div>

            {/* PANEL 3: 16-STEP GRID SEQ SYNTH OVERLAY */}
            <div className="glass-panel p-5 rounded-3xl flex flex-col gap-4">
              
              <div className="flex items-center justify-between select-none">
                <div className="flex items-center gap-2">
                  <Gamepad2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-mono text-zinc-300 uppercase tracking-widest">DRUM_MATRIX_SEQUENCER</span>
                </div>
                
                {/* Clear Sequence */}
                <button
                  onClick={clearUserSequence}
                  className="text-[10px] font-mono text-zinc-400 hover:text-red-400 flex items-center gap-1 transition cursor-pointer outline-none"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  CLEAR_SEQUENCE
                </button>
              </div>

              {/* The Matrix Roll Grid Wrapper */}
              <div className="flex flex-col gap-2.5 overflow-x-auto pb-1">
                
                {/* Marker LEDs (indicates sequencer sweeps) */}
                <div className="flex items-center gap-1 min-w-[320px]">
                  {/* Title empty label space */}
                  <span className="w-16 flex-shrink-0 text-[10px] font-mono text-zinc-400 text-right pr-2">STEP</span>
                  {/* 16 LED blips */}
                  <div 
                    style={{ gridTemplateColumns: "repeat(16, minmax(0, 1fr))" }}
                    className="flex-1 grid gap-1.5 justify-items-center"
                  >
                    {Array(16).fill(null).map((_, stepIdx) => (
                      <span 
                        key={stepIdx}
                        style={{
                          backgroundColor: currentBeatStep === stepIdx ? currentTrack.color : "transparent"
                        }}
                        className={`w-1.5 h-1.5 rounded-full transition-colors border ${
                          currentBeatStep === stepIdx 
                            ? "border-white animate-pulse" 
                            : "border-white/10"
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {/* 4 Row instrument matrices */}
                {["KICK DRUM", "CHIP LEAD", "SHINE PAD", "WHITE HAT"].map((instrumentName, rowIdx) => (
                  <div key={rowIdx} className="flex items-center gap-1 min-w-[320px]">
                    
                    {/* Inst labeling info */}
                    <span className="w-16 flex-shrink-0 text-[9px] font-mono text-zinc-400 font-bold tracking-wider text-right pr-2">
                      {instrumentName}
                    </span>

                    {/* Sequential pads */}
                    <div 
                      style={{ gridTemplateColumns: "repeat(16, minmax(0, 1fr))" }}
                      className="flex-1 grid gap-1.5"
                    >
                      {Array(16).fill(null).map((_, stepColIdx) => {
                        const cellActive = sequencerMatrix[rowIdx][stepColIdx];
                        const isCurrent = currentBeatStep === stepColIdx;
                        
                        // Pick glowing background matching row indexes
                        let rowGradient = "rgba(255, 255, 255, 0.04)";
                        if (cellActive) {
                          rowGradient = rowIdx === 0 ? "#f43f5e" : rowIdx === 1 ? "#06b6d4" : rowIdx === 2 ? "#10b981" : "#a855f7";
                        } else if (isCurrent && isPlaying) {
                          rowGradient = "rgba(255, 255, 255, 0.12)"; // indicator shadow
                        }

                        return (
                          <button
                            key={stepColIdx}
                            onClick={() => toggleSequencerNode(rowIdx, stepColIdx)}
                            style={{ 
                              backgroundColor: rowGradient,
                              boxShadow: cellActive && isCurrent ? "0 0 10px #ffffff" : "none"
                            }}
                            className={`h-6 sm:h-7.5 rounded-md border text-[9px] flex items-center justify-center transition-all outline-none cursor-pointer ${
                              cellActive 
                                ? "border-white" 
                                : "border-white/10 hover:border-white/20"
                            }`}
                          />
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="text-[10px] text-zinc-400 font-mono flex items-center gap-1.5 select-none pl-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Custom step sequences render overlays over active audio loops dynamically!</span>
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN: THE ARCADE STATION (6 columns) */}
          <div className="lg:col-span-6">
            <SnakeBoard 
              glowColor={currentTrack.color} 
              trackIndex={activeTrackIndex}
              isAudioPlaying={isPlaying}
              onGamePlayStateChange={(gamePlaying) => {
                // If game starts and audio is general idle, boot up the audio sync!
                if (gamePlaying && !audioService.isCurrentlyPlaying()) {
                  audioService.init();
                  audioService.resume();
                  audioService.start();
                  setIsPlaying(true);
                }
              }}
            />
          </div>

        </div>
      </main>

      {/* SLA COMPLIANCE SYSTEM FOOTER */}
      <footer className="border-t border-white/10 bg-white/5 py-4 px-4 text-center select-none z-10 relative">
        <p className="text-[10px] text-zinc-400 font-mono">
          © 2026 BEAT SNAKE ARCADE • GLASSMORPHIC EXPERIENCE SYNCHRONIZER • COGNITIVE TIMELINE INSTRUMENT
        </p>
      </footer>

    </div>
  );
}
