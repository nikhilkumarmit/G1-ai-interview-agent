/**
 * VoiceVisualizer — Reactive Canvas Soundwave & Audio Orb.
 * Reacts dynamically to both candidate microphone levels and AI speech playback.
 */

import { useEffect, useRef } from 'react';

export default function VoiceVisualizer({ audioLevel = 0, isSpeaking = false, isListening = false, isProcessing = false }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationId;
    let phase = 0;

    const render = () => {
      phase += 0.08;
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      // Determine active color & energy
      let baseEnergy = 0.12;
      let strokeGradient;

      if (isSpeaking) {
        baseEnergy = 0.75 + Math.sin(phase * 1.5) * 0.2;
        strokeGradient = ctx.createLinearGradient(0, 0, width, 0);
        strokeGradient.addColorStop(0, '#818cf8'); // Indigo
        strokeGradient.addColorStop(0.5, '#c084fc'); // Purple
        strokeGradient.addColorStop(1, '#f472b6'); // Pink
      } else if (isProcessing) {
        baseEnergy = 0.35 + Math.sin(phase * 2) * 0.15;
        strokeGradient = ctx.createLinearGradient(0, 0, width, 0);
        strokeGradient.addColorStop(0, '#38bdf8'); // Sky
        strokeGradient.addColorStop(0.5, '#818cf8');
        strokeGradient.addColorStop(1, '#34d399'); // Emerald
      } else if (isListening) {
        const liveVol = Math.max(0.15, (audioLevel / 100) * 0.9);
        baseEnergy = liveVol;
        strokeGradient = ctx.createLinearGradient(0, 0, width, 0);
        strokeGradient.addColorStop(0, '#34d399'); // Emerald
        strokeGradient.addColorStop(0.5, '#60a5fa'); // Blue
        strokeGradient.addColorStop(1, '#a78bfa'); // Violet
      } else {
        strokeGradient = ctx.createLinearGradient(0, 0, width, 0);
        strokeGradient.addColorStop(0, '#475569');
        strokeGradient.addColorStop(1, '#64748b');
      }

      // Draw 24 symmetrical audio frequency bars
      const numBars = 32;
      const barWidth = 4;
      const spacing = (width - numBars * barWidth) / (numBars + 1);

      for (let i = 0; i < numBars; i++) {
        const distFromCenter = Math.abs(i - numBars / 2) / (numBars / 2);
        const centerFactor = 1 - distFromCenter * 0.55;
        const wave = Math.sin(phase + i * 0.3) * 0.4 + 0.6;
        const barHeight = Math.max(6, (height * 0.75) * baseEnergy * centerFactor * wave);

        const x = spacing + i * (barWidth + spacing);
        const y = (height - barHeight) / 2;

        ctx.fillStyle = strokeGradient;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 3);
        ctx.fill();
      }

      animationId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationId);
  }, [audioLevel, isSpeaking, isListening, isProcessing]);

  return (
    <div className="relative flex flex-col items-center justify-center py-2">
      <canvas
        ref={canvasRef}
        width={380}
        height={54}
        className="w-full max-w-[420px] h-[54px] rounded-xl"
      />
    </div>
  );
}
