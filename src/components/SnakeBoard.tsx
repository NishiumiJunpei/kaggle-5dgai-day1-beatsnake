/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Play, Pause, RotateCcw, Zap, Music, Shield, RefreshCw } from "lucide-react";
import { audioService, BeatStepData } from "../audioEngine";

// Types
interface Point {
  x: number;
  y: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
}

interface SnakeBoardProps {
  glowColor: string;
  trackIndex: number;
  isAudioPlaying: boolean;
  onGamePlayStateChange?: (isPlaying: boolean) => void;
}

type Difficulty = "easy" | "medium" | "hard";
type SyncSubdivision = "1/4" | "1/8" | "1/16";
type SnakeSkin = "neon" | "fire" | "matrix" | "vaporwave";

export const SnakeBoard: React.FC<SnakeBoardProps> = ({
  glowColor,
  trackIndex,
  isAudioPlaying,
  onGamePlayStateChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Core Game Constants
  const GRID_SIZE = 18;

  // Game Settings States
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [syncMode, setSyncMode] = useState<boolean>(true); // Rhythm-locked speed by default!
  const [subdivision, setSubdivision] = useState<SyncSubdivision>("1/8");
  const [skin, setSkin] = useState<SnakeSkin>("neon");
  const [lasersEnabled, setLasersEnabled] = useState<boolean>(false);

  // Live Game Play States
  const [snake, setSnake] = useState<Point[]>([
    { x: 5, y: 9 },
    { x: 4, y: 9 },
    { x: 3, y: 9 },
  ]);
  const [direction, setDirection] = useState<Point>({ x: 1, y: 0 });
  const [food, setFood] = useState<Point>({ x: 12, y: 9 });
  const [foodType, setFoodType] = useState<"standard" | "golden">("standard");
  const [laserBarriers, setLaserBarriers] = useState<Point[]>([]);
  
  const [score, setScore] = useState<number>(0);
  const [bestScore, setBestScore] = useState<number>(() => {
    return Number(localStorage.getItem("_neon_snake_best") || "0");
  });
  const [isGameOver, setIsGameOver] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(true);
  const [combo, setCombo] = useState<number>(1);
  const [beatPulse, setBeatPulse] = useState<boolean>(false);

  // Instanced refs for game loops to bypass React closure state staleness
  const snakeRef = useRef<Point[]>(snake);
  const directionRef = useRef<Point>(direction);
  const foodRef = useRef<Point>(food);
  const lasersRef = useRef<Point[]>(laserBarriers);
  const gameOverRef = useRef<boolean>(isGameOver);
  const pausedRef = useRef<boolean>(isPaused);
  const isSyncRef = useRef<boolean>(syncMode);
  const subdivisionRef = useRef<SyncSubdivision>(subdivision);

  // Keep refs in sync with state
  useEffect(() => { snakeRef.current = snake; }, [snake]);
  useEffect(() => { directionRef.current = direction; }, [direction]);
  useEffect(() => { foodRef.current = food; }, [food]);
  useEffect(() => { lasersRef.current = laserBarriers; }, [laserBarriers]);
  useEffect(() => { gameOverRef.current = isGameOver; }, [isGameOver]);
  useEffect(() => { pausedRef.current = isPaused; }, [isPaused]);
  useEffect(() => { isSyncRef.current = syncMode; }, [syncMode]);
  useEffect(() => { subdivisionRef.current = subdivision; }, [subdivision]);

  // Particles array for retro visual impact
  const particlesRef = useRef<Particle[]>([]);

  // Direction processing to avoid self-collison from immediate quick taps
  const nextDirRef = useRef<Point>(direction);

  // Generate valid randomized coordinates on the grid that are free of the snake and lasers
  const generateNewFood = useCallback((currentSnake: Point[], barriers: Point[]): { pos: Point; isGolden: boolean } => {
    let attempts = 0;
    while (attempts < 200) {
      const rx = Math.floor(Math.random() * GRID_SIZE);
      const ry = Math.floor(Math.random() * GRID_SIZE);
      
      const onSnake = currentSnake.some(seg => seg.x === rx && seg.y === ry);
      const onLaser = barriers.some(b => b.x === rx && b.y === ry);

      if (!onSnake && !onLaser) {
        return {
          pos: { x: rx, y: ry },
          isGolden: Math.random() < 0.20 // 20% chance of high scoring Golden Chord note
        };
      }
      attempts++;
    }
    return { pos: { x: 10, y: 10 }, isGolden: false };
  }, []);

  // Set randomized lasers
  const generateLasers = useCallback((currentSnake: Point[]): Point[] => {
    if (!lasersEnabled) return [];
    
    const count = difficulty === "easy" ? 2 : difficulty === "medium" ? 4 : 6;
    const barriers: Point[] = [];
    let attempts = 0;

    while (barriers.length < count && attempts < 100) {
      const bx = Math.floor(Math.random() * (GRID_SIZE - 2)) + 1;
      const by = Math.floor(Math.random() * (GRID_SIZE - 2)) + 1;

      // Keep barriers away from the center spawn and current snake head
      const onSnake = currentSnake.some(seg => Math.abs(seg.x - bx) <= 2 && Math.abs(seg.y - by) <= 2);
      const duplicate = barriers.some(b => b.x === bx && b.y === by);

      if (!onSnake && !duplicate) {
        barriers.push({ x: bx, y: by });
      }
      attempts++;
    }
    return barriers;
  }, [lasersEnabled, difficulty]);

  // Spark Generation
  const spawnExplosionSparks = (x: number, y: number, color: string, count = 12) => {
    const scale = 25; // canvas unit scaling
    const pxPos = x * scale + scale / 2;
    const pyPos = y * scale + scale / 2;

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 3.5;
      particlesRef.current.push({
        x: pxPos,
        y: pyPos,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        size: 1.5 + Math.random() * 3,
        life: 1,
        maxLife: 30 + Math.random() * 30
      });
    }
  };

  // --- CORE SNAKE STEP ENGINE ---
  const moveSnakeStep = useCallback(() => {
    if (pausedRef.current || gameOverRef.current) return;

    const currentSnake = [...snakeRef.current];
    const head = currentSnake[0];
    const curDir = nextDirRef.current;
    
    // Lock direction
    directionRef.current = curDir;
    setDirection(curDir);

    // Compute next coordinates
    const nextX = head.x + curDir.x;
    const nextY = head.y + curDir.y;

    // Collsion borders conditions (with elegant neon portal wrap-around option or hard walls)
    // Dark neon styling benefits from tight border impacts, let's treat border wrapping as default, 
    // but the barriers/lasers as the focal obstacles! This creates highly satisfying responsive flow.
    let wrappedX = nextX;
    let wrappedY = nextY;

    if (wrappedX < 0) wrappedX = GRID_SIZE - 1;
    if (wrappedX >= GRID_SIZE) wrappedX = 0;
    if (wrappedY < 0) wrappedY = GRID_SIZE - 1;
    if (wrappedY >= GRID_SIZE) wrappedY = 0;

    const newHead = { x: wrappedX, y: wrappedY };

    // Self eating crash detection
    const selfCollision = currentSnake.slice(1).some(seg => seg.x === wrappedX && seg.y === wrappedY);
    
    // Laser obstacle collision
    const laserCollision = lasersRef.current.some(laser => laser.x === wrappedX && laser.y === wrappedY);

    if (selfCollision || laserCollision) {
      // Trigger Retro crash sound feedback
      audioService.playCrashFeedbackSound();
      spawnExplosionSparks(wrappedX, wrappedY, "#f43f5e", 25);
      setIsGameOver(true);
      setIsPaused(true);
      if (onGamePlayStateChange) {
        onGamePlayStateChange(false);
      }
      return;
    }

    // Append new head
    currentSnake.unshift(newHead);

    // Food Eaten Check
    if (wrappedX === foodRef.current.x && wrappedY === foodRef.current.y) {
      // Play note sound aligned with synthesiser track scale!
      const currentMultiplier = foodType === "golden" ? 3 : 1;
      audioService.playEatFeedbackChime(currentMultiplier);
      
      // Spawn floating glowing sparks
      spawnExplosionSparks(wrappedX, wrappedY, foodType === "golden" ? "#fbbf24" : glowColor, 18);

      // Score increment
      const points = 10 * currentMultiplier;
      setScore(prev => {
        const nextScore = prev + points;
        if (nextScore > bestScore) {
          setBestScore(nextScore);
          localStorage.setItem("_neon_snake_best", nextScore.toString());
        }
        return nextScore;
      });

      // Spawn new food
      const nextFoodResult = generateNewFood(currentSnake, lasersRef.current);
      setFood(nextFoodResult.pos);
      setFoodType(nextFoodResult.isGolden ? "golden" : "standard");

      // Score combo
      setCombo(prev => Math.min(5, prev + 1));
    } else {
      // Remove tail
      currentSnake.pop();
    }

    setSnake(currentSnake);
  }, [glowColor, bestScore, generateNewFood, foodType, onGamePlayStateChange]);

  // Handle standard difficulty-based clock tick loop (when Rhythm-Lock is OFF)
  useEffect(() => {
    if (syncMode || isPaused || isGameOver) return;

    let intervalMs = 120;
    if (difficulty === "easy") intervalMs = 170;
    if (difficulty === "hard") intervalMs = 80;

    const intervalId = setInterval(() => {
      moveSnakeStep();
    }, intervalMs);

    return () => clearInterval(intervalId);
  }, [syncMode, isPaused, isGameOver, difficulty, moveSnakeStep]);

  // --- AUDIO BEAT-SYNC INTEGRATION ---
  useEffect(() => {
    // Listen to synth rhythmic steps in the Audio Engine
    const unsubscribe = audioService.subscribeToBeat((beatData: BeatStepData) => {
      // Rhythmic flash animation triggered on every quarter-note / pulse
      if (beatData.step % 4 === 0) {
        setBeatPulse(true);
        setTimeout(() => setBeatPulse(false), 90);
      }

      // If Rhythm Sync is enabled, calculate when to advance the snake
      if (isSyncRef.current && !pausedRef.current && !gameOverRef.current) {
        const step = beatData.step;
        const currentSub = subdivisionRef.current;

        let shouldMove = false;
        if (currentSub === "1/4" && step % 4 === 0) {
          // Move on main quarterly beats
          shouldMove = true;
        } else if (currentSub === "1/8" && step % 2 === 0) {
          // Move twice per beat
          shouldMove = true;
        } else if (currentSub === "1/16") {
          // Move on every synth sequencer step
          shouldMove = true;
        }

        if (shouldMove) {
          moveSnakeStep();
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [moveSnakeStep]);

  // Key Event Listeners for Snake movement (WASD & Arrows)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.key)) {
        e.preventDefault(); // suppress browsers default scrolling behavior
      }

      const key = e.key.toLowerCase();
      const curDir = directionRef.current;

      let nextDir = { ...curDir };

      if (key === "arrowup" || key === "w") {
        if (curDir.y !== 1) nextDir = { x: 0, y: -1 };
      } else if (key === "arrowdown" || key === "s") {
        if (curDir.y !== -1) nextDir = { x: 0, y: 1 };
      } else if (key === "arrowleft" || key === "a") {
        if (curDir.x !== 1) nextDir = { x: -1, y: 0 };
      } else if (key === "arrowright" || key === "d") {
        if (curDir.x !== -1) nextDir = { x: 1, y: 0 };
      } else if (e.key === " ") {
        togglePause();
        return;
      }

      nextDirRef.current = nextDir;
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Pause toggle helpers
  const togglePause = () => {
    if (isGameOver) {
      resetGame();
      return;
    }

    const nextPauseState = !isPaused;
    
    // Auto resume general audio context when starting game
    if (!nextPauseState) {
      audioService.init();
      audioService.resume();
    }

    setIsPaused(nextPauseState);
    if (onGamePlayStateChange) {
      onGamePlayStateChange(!nextPauseState);
    }
  };

  // Game Reset
  const resetGame = () => {
    const startingSnake = [
      { x: 5, y: 9 },
      { x: 4, y: 9 },
      { x: 3, y: 9 },
    ];
    
    // Generate fresh lasers to keep maze dynamic
    const nextLasers = lasersEnabled ? generateLasers(startingSnake) : [];
    const nextFood = generateNewFood(startingSnake, nextLasers);

    setSnake(startingSnake);
    setLaserBarriers(nextLasers);
    setDirection({ x: 1, y: 0 });
    nextDirRef.current = { x: 1, y: 0 };
    setFood(nextFood.pos);
    setFoodType(nextFood.isGolden ? "golden" : "standard");
    setScore(0);
    setIsGameOver(false);
    setIsPaused(true);
    setCombo(1);

    if (onGamePlayStateChange) {
      onGamePlayStateChange(false);
    }
    
    // Sound effect
    audioService.playLevelUpFeedbackSound();
  };

  // Re-generate lasers if options alter mid session
  useEffect(() => {
    if (isPaused) {
      const nextLasers = lasersEnabled ? generateLasers(snake) : [];
      setLaserBarriers(nextLasers);
    }
  }, [lasersEnabled, difficulty, generateLasers]);

  // --- CANVAS HIGH-PERFORMANCE NEON GAME RENDERING ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    const cellSize = canvas.width / GRID_SIZE;

    // Floating dynamic grid coordinates parameters
    let hoverWaveOffset = 0;

    const render = () => {
      // Clear with soft alpha background to enable elegant snake trailing motion blurs!
      ctx.fillStyle = "rgba(9, 9, 11, 0.28)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      hoverWaveOffset += 0.035;

      // Draw cyber mesh neon grids
      ctx.lineWidth = 0.5;
      for (let i = 1; i < GRID_SIZE; i++) {
        const offsetVal = Math.sin(hoverWaveOffset + i * 0.4) * (beatPulse ? 1.6 : 0.6);
        
        ctx.strokeStyle = "rgba(63, 63, 70, 0.24)";
        // vertical
        ctx.beginPath();
        ctx.moveTo(i * cellSize + offsetVal, 0);
        ctx.lineTo(i * cellSize + offsetVal, canvas.height);
        ctx.stroke();

        // horizontal
        ctx.beginPath();
        ctx.moveTo(0, i * cellSize + offsetVal);
        ctx.lineTo(canvas.width, i * cellSize + offsetVal);
        ctx.stroke();
      }

      // Draw Laser Warning Barriers if active
      if (laserBarriers.length > 0) {
        ctx.shadowBlur = 10 + Math.sin(hoverWaveOffset * 5) * 6;
        ctx.shadowColor = "#f43f5e"; // bright neon red
        
        laserBarriers.forEach(barrier => {
          const bx = barrier.x * cellSize;
          const by = barrier.y * cellSize;
          
          ctx.strokeStyle = "#fda4af";
          ctx.fillStyle = "#f43f5e";
          ctx.lineWidth = 1.5;

          // X border marks
          ctx.beginPath();
          ctx.arc(bx + cellSize/2, by + cellSize/2, cellSize/2.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // draw inner digital danger cross
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(bx + 4, by + 4);
          ctx.lineTo(bx + cellSize - 4, by + cellSize - 4);
          ctx.moveTo(bx + cellSize - 4, by + 4);
          ctx.lineTo(bx + 4, by + cellSize - 4);
          ctx.stroke();
        });
      }

      // Draw Glowing Food Note
      const fx = food.x * cellSize + cellSize / 2;
      const fy = food.y * cellSize + cellSize / 2;
      const isGold = foodType === "golden";
      const foodColor = isGold ? "#fbbf24" : glowColor;

      ctx.shadowBlur = 14 + Math.sin(hoverWaveOffset * 7) * 7;
      ctx.shadowColor = foodColor;
      ctx.fillStyle = foodColor;

      // Draw a retro glowing music note glyph inside the canvas!
      ctx.beginPath();
      if (isGold) {
        // Eighth note (Double double stem)
        // bottom left circle
        ctx.arc(fx - 4, fy + 4, 3.5, 0, Math.PI * 2);
        // bottom right circle
        ctx.arc(fx + 3, fy + 2, 3.5, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.strokeStyle = foodColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        // stem left
        ctx.moveTo(fx - 1, fy + 4);
        ctx.lineTo(fx - 1, fy - 6);
        // stem right
        ctx.moveTo(fx + 6, fy + 2);
        ctx.lineTo(fx + 6, fy - 8);
        // connector bar
        ctx.lineTo(fx - 1, fy - 6);
        ctx.stroke();
      } else {
        // Standard Quarter Note (single)
        ctx.arc(fx - 2, fy + 3, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = foodColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        // stem vertical
        ctx.moveTo(fx + 2, fy + 3);
        ctx.lineTo(fx + 2, fy - 5);
        // flag curve
        ctx.bezierCurveTo(fx + 5, fy - 5, fx + 7, fy - 2, fx + 8, fy - 4);
        ctx.stroke();
      }

      // Draw Glowing Snake
      ctx.shadowBlur = 0; // reset
      snake.forEach((segment, idx) => {
        const sx = segment.x * cellSize;
        const sy = segment.y * cellSize;

        // Custom skins coloring
        let segmentColor = glowColor;
        let segmentGlow = glowColor;

        if (skin === "fire") {
          const redVal = 220 - idx * 8;
          segmentColor = `rgb(${redVal}, ${70 + idx * 4}, 16)`;
          segmentGlow = "rgba(249, 115, 22, 0.8)";
        } else if (skin === "matrix") {
          segmentColor = idx === 0 ? "#22c55e" : `rgba(34, 197, 94, ${Math.max(0.2, 1 - idx * 0.08)})`;
          segmentGlow = "#22c55e";
        } else if (skin === "vaporwave") {
          segmentColor = idx % 2 === 0 ? "#a855f7" : "#ec4899"; // alternate violet and pink
          segmentGlow = "#f472b6";
        } else {
          // Standard Neon Cyan Laser
          segmentColor = idx === 0 ? "#ffffff" : glowColor;
          segmentGlow = glowColor;
        }

        ctx.shadowBlur = idx === 0 ? 15 : Math.max(0, 10 - idx * 0.7);
        ctx.shadowColor = segmentGlow;
        ctx.fillStyle = segmentColor;

        const pad = 1.5;
        const segmentSize = cellSize - pad * 2;

        if (idx === 0) {
          // Draw detailed robotic head with futuristic direction eyes
          ctx.beginPath();
          ctx.roundRect(sx + pad, sy + pad, segmentSize, segmentSize, 5);
          ctx.fill();

          // Eyeballs mapping based on vector direction
          ctx.shadowBlur = 0;
          ctx.fillStyle = "#0c0a09"; // absolute dark backing
          const eyeSize = 3;
          let el1 = { x: sx + 5, y: sy + 5 };
          let el2 = { x: sx + cellSize - 8, y: sy + 5 };

          if (directionRef.current.x === 1) {
            el1 = { x: sx + cellSize - 8, y: sy + 4 };
            el2 = { x: sx + cellSize - 8, y: sy + cellSize - 7 };
          } else if (directionRef.current.x === -1) {
            el1 = { x: sx + 4, y: sy + 4 };
            el2 = { x: sx + 4, y: sy + cellSize - 7 };
          } else if (directionRef.current.y === 1) {
            el1 = { x: sx + 4, y: sy + cellSize - 8 };
            el2 = { x: sx + cellSize - 7, y: sy + cellSize - 8 };
          } else {
            el1 = { x: sx + 4, y: sy + 4 };
            el2 = { x: sx + cellSize - 7, y: sy + 4 };
          }

          ctx.beginPath();
          ctx.arc(el1.x, el1.y, eyeSize, 0, Math.PI * 2);
          ctx.arc(el2.x, el2.y, eyeSize, 0, Math.PI * 2);
          ctx.fill();

          // Red cyborg scanning laser pupil
          ctx.fillStyle = "#ef4444";
          ctx.beginPath();
          ctx.arc(el1.x + directionRef.current.x, el1.y + directionRef.current.y, 1.2, 0, Math.PI * 2);
          ctx.arc(el2.x + directionRef.current.x, el2.y + directionRef.current.y, 1.2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Body lines rounded rectangles tapering in size
          ctx.beginPath();
          const shrinkFactor = Math.max(0.4, 1.0 - idx * 0.035);
          const segmentOffset = (cellSize - segmentSize * shrinkFactor) / 2;
          ctx.roundRect(
            sx + segmentOffset,
            sy + segmentOffset,
            segmentSize * shrinkFactor,
            segmentSize * shrinkFactor,
            [4, 4, 4, 4]
          );
          ctx.fill();
        }
      });

      // Update and Draw floating neon spark particles
      ctx.shadowBlur = 0; // reset
      const particles = particlesRef.current;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.96; // air friction decay
        p.vy *= 0.96;
        p.life++;

        ctx.fillStyle = p.color;
        ctx.shadowBlur = 6;
        ctx.shadowColor = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1 - p.life / p.maxLife), 0, Math.PI * 2);
        ctx.fill();

        if (p.life >= p.maxLife) {
          particles.splice(i, 1);
        }
      }
      ctx.shadowBlur = 0; // complete reset for subsequent turns

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [snake, food, foodType, laserBarriers, glowColor, skin, beatPulse, lasersEnabled]);

  // Handle D-pad clicks for laptop/tablets
  const triggerManualDirection = (x: number, y: number) => {
    const curDir = directionRef.current;
    // ensure no illegal backward turns
    if (x !== 0 && curDir.x === -x) return;
    if (y !== 0 && curDir.y === -y) return;
    
    const nextDir = { x, y };
    nextDirRef.current = nextDir;
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Visual Game Console Container */}
      <div 
        id="cyber_arcade_cabinet"
        className={`relative glass-panel rounded-3xl border transition-all duration-300 overflow-hidden flex flex-col items-center p-4 sm:p-5 shadow-[0_12px_40px_rgba(0,0,0,0.6)] ${
          beatPulse 
            ? `border-white shadow-[0_0_25px_${glowColor}66]` 
            : "border-white/10"
        }`}
      >
        {/* Top Game Panel Glass Display */}
        <div className="w-full h-11 border-b border-white/10 mb-3 flex items-center justify-between px-2 text-xs font-mono select-none">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-zinc-400">ARCADE_DISPLAY_01</span>
          </div>

          <div className="flex items-center gap-4 text-zinc-300">
            <div>
              SCORE: <span className="text-white font-black tracking-widest">{score}</span>
            </div>
            <div>
              BEST: <span className="text-amber-300 font-black tracking-widest">{bestScore}</span>
            </div>
          </div>
        </div>

        {/* The Grid Canvas Frame */}
        <div className="relative border border-white/10 rounded-2xl overflow-hidden bg-black/40 w-[280px] h-[280px] sm:w-[360px] sm:h-[360px] max-w-full">
          <canvas
            ref={canvasRef}
            width={450}
            height={450}
            className="w-full h-full block cursor-crosshair"
          />

          {/* PAUSED OVERLAY HOVER */}
          {isPaused && !isGameOver && (
            <div className="absolute inset-0 bg-neutral-950/85 backdrop-blur-md flex flex-col items-center justify-center text-center p-4">
              <p className="text-xs tracking-widest uppercase font-mono text-zinc-400 mb-1">ARCADE SYSTEM</p>
              <h3 className="text-xl sm:text-2xl font-black tracking-tight text-white mb-4">NEON FLOW STANDBY</h3>
              
              <button
                onClick={togglePause}
                style={{ textShadow: `0 0 10px ${glowColor}`, boxShadow: `0 0 20px ${glowColor}55` }}
                className="px-6 py-2.5 rounded-full bg-white text-zinc-950 text-sm font-bold tracking-wider flex items-center gap-2 hover:scale-105 active:scale-95 transition-all outline-none cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                BOOT GAME
              </button>
              
              <p className="text-[10px] text-zinc-400 mt-4 font-mono">
                Press <span className="border border-white/20 bg-white/5 px-1.5 py-0.5 rounded text-zinc-300 font-bold">Space</span> or use Arrow keys to Play
              </p>
            </div>
          )}

          {/* GAME OVER CARD OVERLAY */}
          {isGameOver && (
            <div className="absolute inset-0 bg-rose-950/90 backdrop-blur-md flex flex-col items-center justify-center text-center p-4">
              <span className="text-xs uppercase bg-red-500/20 text-red-300 px-2.5 py-1 rounded-full border border-red-500/40 mb-2 font-mono">
                CRASH_SEQUENCE_TRIGGERED
              </span>
              <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white uppercase drop-shadow-[0_2px_10px_rgba(244,63,94,0.6)] mb-2">
                GAME OVER
              </h3>
              
              <div className="bg-black/60 px-4 py-2 border border-white/10 rounded-xl mb-4 text-xs font-mono text-zinc-300">
                FINAL SCORE: <span className="text-white font-bold text-sm tracking-widest">{score}</span>
              </div>

              <button
                onClick={resetGame}
                className="px-6 py-2.5 rounded-full bg-rose-600 hover:bg-rose-500 text-white text-sm font-extrabold tracking-wider flex items-center gap-2 shadow-[0_0_20px_rgba(244,63,94,0.4)] hover:scale-105 active:scale-95 transition-all outline-none cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                INSERT COIN (REPLAY)
              </button>
            </div>
          )}
        </div>

        {/* Dashboard quick configs and stats */}
        <div className="w-full flex items-center justify-between mt-3 text-[11px] font-mono select-none px-1">
          <div className="flex items-center gap-1.5 text-zinc-400">
            <Zap className={`w-3.5 h-3.5 ${syncMode ? "text-yellow-405 text-yellow-300" : ""}`} />
            <span>SYNC: <strong className={syncMode ? "text-yellow-300" : "text-zinc-500"}>{syncMode ? "ON" : "OFF"}</strong></span>
          </div>

          <div className="flex items-center gap-1.5 text-zinc-400">
            <Music className="w-3.5 h-3.5 text-cyan-405 text-cyan-300" />
            <span>SUB: <strong className="text-cyan-300">{subdivision}</strong></span>
          </div>

          <div className="flex items-center gap-1.5 text-zinc-400">
            <Shield className="w-3.5 h-3.5 text-emerald-405 text-emerald-300" />
            <span>MAZE: <strong className={lasersEnabled ? "text-emerald-300" : "text-zinc-500"}>{lasersEnabled ? "ON" : "OFF"}</strong></span>
          </div>
        </div>
      </div>

      {/* Retro Tactile Console Controls Grid (Fitted beneath Board) */}
      <div className="glass-panel p-5 rounded-3xl flex flex-col gap-4">
        {/* Toggle Game Parameters Row */}
        <div className="grid grid-cols-2 gap-3 select-none text-xs">
          
          {/* Rhythm Lock Sync configuration */}
          <div className="flex flex-col gap-1.5">
            <label className="text-zinc-400 font-mono text-[10px] uppercase">Gameplay Timing</label>
            <button
              onClick={() => setSyncMode(!syncMode)}
              className={`py-2 px-3 rounded-xl border font-medium text-left flex items-center justify-between transition-colors outline-none cursor-pointer ${
                syncMode
                  ? "bg-amber-400/10 border-amber-400/30 text-amber-300 shadow-[inset_0_0_10px_rgba(245,158,11,0.05)]"
                  : "bg-white/5 border-white/10 text-zinc-400 hover:text-white"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Music className="w-3.5 h-3.5 text-amber-300" />
                <span>Rhythm-Locked</span>
              </div>
              <span className={`w-1.5 h-1.5 rounded-full ${syncMode ? "bg-amber-400 animate-pulse" : "bg-zinc-650 bg-zinc-600"}`} />
            </button>
          </div>

          {/* Subdivision Mode Selector (when sync is active) */}
          <div className="flex flex-col gap-1.5">
            <label className="text-zinc-400 font-mono text-[10px] uppercase">Rhythm Substeps</label>
            <div className="grid grid-cols-3 bg-white/5 border border-white/10 rounded-xl p-1">
              {(["1/4", "1/8", "1/16"] as SyncSubdivision[]).map(sub => (
                <button
                  key={sub}
                  disabled={!syncMode}
                  onClick={() => setSubdivision(sub)}
                  className={`text-center py-1 text-[10px] font-mono rounded-lg font-semibold transition-all outline-none ${
                    !syncMode 
                      ? "opacity-35 cursor-not-allowed" 
                      : subdivision === sub
                      ? "bg-white/15 text-white shadow-inner"
                      : "text-zinc-400 hover:text-zinc-200 cursor-pointer"
                  }`}
                >
                  {sub}
                </button>
              ))}
            </div>
          </div>

          {/* Difficulty setting (only affects manual timed movement) */}
          <div className="flex flex-col gap-1.5">
            <label className="text-zinc-400 font-mono text-[10px] uppercase">Difficulty / Speed</label>
            <select
              value={difficulty}
              disabled={syncMode}
              onChange={(e) => setDifficulty(e.target.value as Difficulty)}
              className="bg-white/5 border border-white/10 text-zinc-300 py-2.5 px-3 rounded-xl text-xs font-mono w-full focus:outline-none focus:border-white/20 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <option value="easy" className="bg-[#0e0e12]">Easy (Slower)</option>
              <option value="medium" className="bg-[#0e0e12]">Medium (Standard)</option>
              <option value="hard" className="bg-[#0e0e12]">Hard (Extreme)</option>
            </select>
          </div>

          {/* Maze lasers selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-zinc-400 font-mono text-[10px] uppercase">Laser Barriers</label>
            <button
              onClick={() => setLasersEnabled(!lasersEnabled)}
              className={`py-2 px-3 rounded-xl border font-medium text-left flex items-center justify-between transition-colors outline-none cursor-pointer ${
                lasersEnabled
                  ? "bg-rose-500/10 border-rose-500/30 text-rose-300 shadow-[inset_0_0_10px_rgba(244,63,94,0.05)]"
                  : "bg-white/5 border-white/10 text-zinc-400 hover:text-white"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-rose-400" />
                <span>Obstacles</span>
              </div>
              <span className={`w-1.5 h-1.5 rounded-full ${lasersEnabled ? "bg-rose-400 animate-pulse" : "bg-zinc-600"}`} />
            </button>
          </div>

          {/* Cosmetic Skins option */}
          <div className="flex flex-col gap-1.5">
            <label className="text-zinc-400 font-mono text-[10px] uppercase">Snake Skin Theme</label>
            <select
              value={skin}
              onChange={(e) => setSkin(e.target.value as SnakeSkin)}
              className="bg-white/5 border border-white/10 text-zinc-300 py-2.5 px-3 rounded-xl text-xs font-mono w-full focus:outline-none focus:border-white/20 cursor-pointer"
            >
              <option value="neon" className="bg-[#0e0e12]">Neon Cyan Laser</option>
              <option value="fire" className="bg-[#0e0e12]">Solar Backfire</option>
              <option value="matrix" className="bg-[#0e0e12]">Matrix Code Stream</option>
              <option value="vaporwave" className="bg-[#0e0e12]">Vaporwave Hologram</option>
            </select>
          </div>

          {/* Clear Game Manual Command */}
          <div className="flex flex-col justify-end">
            <button
              onClick={resetGame}
              className="py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 hover:text-white border border-white/10 text-zinc-300 flex items-center justify-center gap-1.5 text-xs font-bold cursor-pointer transition-colors outline-none shadow-sm"
            >
              <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
              Reset Game
            </button>
          </div>
        </div>

        {/* Tactile Virtual D-PAD for Click/Touch (Highly responsive) */}
        <div className="flex flex-col items-center justify-center py-2 border-t border-white/10 select-none">
          <div className="relative w-40 h-40">
            {/* UP BUTTON */}
            <button
              onClick={() => triggerManualDirection(0, -1)}
              style={{ boxShadow: direction.y === -1 ? `0 0 15px ${glowColor}bb` : "none" }}
              className={`absolute top-0 left-14 w-12 h-12 rounded-xl flex items-center justify-center transition-colors border outline-none active:scale-90 cursor-pointer ${
                direction.y === -1
                  ? "bg-white text-zinc-950 border-white font-extrabold"
                  : "bg-white/5 text-zinc-300 border-white/10 hover:text-white"
              }`}
            >
              ▲
            </button>
            {/* LEFT BUTTON */}
            <button
              onClick={() => triggerManualDirection(-1, 0)}
              style={{ boxShadow: direction.x === -1 ? `0 0 15px ${glowColor}bb` : "none" }}
              className={`absolute top-14 left-0 w-12 h-12 rounded-xl flex items-center justify-center transition-colors border outline-none active:scale-90 cursor-pointer ${
                direction.x === -1
                  ? "bg-white text-zinc-950 border-white font-extrabold"
                  : "bg-white/5 text-zinc-300 border-white/10 hover:text-white"
              }`}
            >
              ◀
            </button>
            {/* RUN/PAUSE CENTER HUB */}
            <button
              onClick={togglePause}
              className={`absolute top-14 left-14 w-12 h-12 rounded-xl flex flex-col items-center justify-center border font-bold outline-none active:scale-95 transition-all text-[9px] uppercase cursor-pointer ${
                isPaused
                  ? "bg-white/10 text-amber-400 border-white/10"
                  : "bg-white/10 text-emerald-400 border-white/10"
              }`}
            >
              {isPaused ? <Play className="w-3.5 h-3.5 mb-0.5 fill-current" /> : <Pause className="w-3.5 h-3.5 mb-0.5 fill-current" />}
              {isPaused ? "RUN" : "PAUSE"}
            </button>
            {/* RIGHT BUTTON */}
            <button
              onClick={() => triggerManualDirection(1, 0)}
              style={{ boxShadow: direction.x === 1 ? `0 0 15px ${glowColor}bb` : "none" }}
              className={`absolute top-14 right-0 w-12 h-12 rounded-xl flex items-center justify-center transition-colors border outline-none active:scale-90 cursor-pointer ${
                direction.x === 1
                  ? "bg-white text-zinc-950 border-white font-extrabold"
                  : "bg-white/5 text-zinc-300 border-white/10 hover:text-white"
              }`}
            >
              ▶
            </button>
            {/* DOWN BUTTON */}
            <button
              onClick={() => triggerManualDirection(0, 1)}
              style={{ boxShadow: direction.y === 1 ? `0 0 15px ${glowColor}bb` : "none" }}
              className={`absolute bottom-0 left-14 w-12 h-12 rounded-xl flex items-center justify-center transition-colors border outline-none active:scale-90 cursor-pointer ${
                direction.y === 1
                  ? "bg-white text-zinc-950 border-white font-extrabold"
                  : "bg-white/5 text-zinc-300 border-white/10 hover:text-white"
              }`}
            >
              ▼
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
