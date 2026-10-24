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

      let baseEnergy = 0.12;
      let barColor = '#52525b'; // zinc-600 default

      if (isSpeaking) {
        baseEnergy = 0.7 + Math.sin(phase * 1.5) * 0.2;
        barColor = '#3b82f6'; // blue-500
      } else if (isProcessing) {
        baseEnergy = 0.35 + Math.sin(phase * 2) * 0.15;
        barColor = '#a1a1aa'; // zinc-400
      } else if (isListening) {
        const liveVol = Math.max(0.15, (audioLevel / 100) * 0.9);
        baseEnergy = liveVol;
        barColor = '#10b981'; // emerald-500
      }

      const numBars = 32;
      const barWidth = 3;
      const spacing = (width - numBars * barWidth) / (numBars + 1);

      ctx.fillStyle = barColor;

      for (let i = 0; i < numBars; i++) {
        const distFromCenter = Math.abs(i - numBars / 2) / (numBars / 2);
        const centerFactor = 1 - distFromCenter * 0.5;
        const wave = Math.sin(phase + i * 0.35) * 0.35 + 0.65;
        const barHeight = Math.max(4, (height * 0.7) * baseEnergy * centerFactor * wave);

        const x = spacing + i * (barWidth + spacing);
        const y = (height - barHeight) / 2;

        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 2);
        ctx.fill();
      }

      animationId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationId);
  }, [audioLevel, isSpeaking, isListening, isProcessing]);

  return (
    <div className="flex flex-col items-center justify-center py-2">
      <canvas
        ref={canvasRef}
        width={360}
        height={48}
        className="w-full max-w-[380px] h-[48px]"
      />
    </div>
  );
}
