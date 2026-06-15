/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from "react";
import { audioService } from "../audioEngine";

interface AudioVisualizerProps {
  glowColor: string;
  isPlaying: boolean;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  glowColor,
  isPlaying,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Handle high DPI displays
    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
      ctx.scale(dpr, dpr);
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // Dynamic frequency drawing loop
    const bufferLength = audioService.analyserNode
      ? audioService.analyserNode.frequencyBinCount
      : 64;
    const dataArray = new Uint8Array(bufferLength);

    let angleOffset = 0; // fallback synthwave rotation

    const draw = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (width === 0 || height === 0) {
        animationRef.current = requestAnimationFrame(draw);
        return;
      }

      ctx.clearRect(0, 0, width, height);

      // Gradient color mapping based on neon color
      const gradient = ctx.createLinearGradient(0, height, 0, 0);
      gradient.addColorStop(0, "rgba(9, 9, 11, 0.5)"); // bottom dark background
      gradient.addColorStop(0.5, glowColor);             // middle neon
      gradient.addColorStop(1, "#ffffff");                // crown highlights

      if (audioService.isCurrentlyPlaying() && audioService.analyserNode) {
        // --- REAL LIVE SYNTH FREQUENCY SPECTRUM RENDERING ---
        audioService.analyserNode.getByteFrequencyData(dataArray);

        ctx.lineWidth = 2.5;
        ctx.strokeStyle = glowColor;

        const barWidth = (width / bufferLength) * 1.6;
        let x = 0;

        // Draw symmetrical audio spectrum analyser bars
        ctx.shadowBlur = 12;
        ctx.shadowColor = glowColor;

        for (let i = 0; i < bufferLength; i++) {
          const percent = dataArray[i] / 255.0;
          const barHeight = Math.max(4, percent * height * 0.85);

          // Render neon rounded pillars
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.roundRect(
            width / 2 + x, 
            height - barHeight, 
            barWidth - 2, 
            barHeight, 
            [4, 4, 0, 0]
          );
          ctx.roundRect(
            width / 2 - x - barWidth, 
            height - barHeight, 
            barWidth - 2, 
            barHeight, 
            [4, 4, 0, 0]
          );
          ctx.fill();

          x += barWidth;
        }

        // Draw overlay waveform lines
        const waveData = new Uint8Array(bufferLength);
        audioService.analyserNode.getByteTimeDomainData(waveData);

        ctx.shadowBlur = 8;
        ctx.beginPath();
        for (let i = 0; i < bufferLength; i++) {
          const v = waveData[i] / 128.0;
          const y = (v * height) / 2;
          const px = (width / bufferLength) * i;

          if (i === 0) {
            ctx.moveTo(px, y);
          } else {
            ctx.lineTo(px, y);
          }
        }
        ctx.stroke();

      } else {
        // --- AMBIENT SYNTHWAVE FALLBACK PATTERN WHEN IDLE ---
        // Elegant flowing neon cyber wave grids to ensure UI interactive feeling
        angleOffset += 0.02;

        ctx.shadowBlur = 15;
        ctx.shadowColor = glowColor;
        ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
        ctx.lineWidth = 1;

        // Visual Perspective Grids
        const gridLines = 14;
        const spacing = width / gridLines;
        for (let i = 0; i <= gridLines; i++) {
          const lx = i * spacing;
          ctx.beginPath();
          ctx.moveTo(lx, height);
          ctx.lineTo(width / 2 + (lx - width / 2) * 0.2, height * 0.3);
          ctx.stroke();
        }

        // Horizontal speed wave patterns
        const waveFrequency = 0.03;
        const waveAmplitude = isPlaying ? 16 : 8;

        ctx.strokeStyle = glowColor;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        
        for (let px = 0; px < width; px++) {
          const py =
            height * 0.7 +
            Math.sin(px * waveFrequency + angleOffset) * waveAmplitude +
            Math.cos(px * 0.015 - angleOffset * 0.8) * (waveAmplitude * 0.5);

          if (px === 0) {
            ctx.moveTo(px, py);
          } else {
            ctx.lineTo(px, py);
          }
        }
        ctx.stroke();

        // Draw elegant glowing holographic center orb representing audio synth standby
        const pulse = 1.0 + Math.sin(angleOffset * 4) * 0.12;
        ctx.beginPath();
        ctx.arc(width / 2, height / 2.5, 22 * pulse, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.shadowBlur = 24;
        ctx.fill();
      }

      ctx.shadowBlur = 0; // reset
      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [glowColor, isPlaying]);

  return (
    <div className="relative w-full h-full bg-zinc-950/40 rounded-xl overflow-hidden border border-zinc-800/60 shadow-[inset_0_0_20px_rgba(0,0,0,0.8)] flex items-center justify-center">
      {/* Visualiser Canvas */}
      <canvas
        id="analyser_canvas"
        ref={canvasRef}
        className="w-full h-full block"
      />
      
      {/* Cover overlay glass filter */}
      <div className="absolute inset-0 bg-radial-at-t from-transparent via-transparent to-zinc-950/60 pointer-events-none" />
    </div>
  );
};
