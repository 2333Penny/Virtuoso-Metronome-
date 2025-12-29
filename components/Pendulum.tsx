
import React, { useMemo } from 'react';

interface PendulumProps {
  bpm: number;
  isActive: boolean;
  currentBeat: number;
  beatsPerMeasure: number;
  size: number;
}

export const Pendulum: React.FC<PendulumProps> = ({ bpm, isActive, currentBeat, beatsPerMeasure, size }) => {
  // Traditional metronome: amplitude decreases as speed increases
  const amplitude = useMemo(() => {
    // Range: ~35 degrees at 40 BPM down to ~12 degrees at 240 BPM
    const base = 35;
    const factor = Math.max(0.3, (280 - bpm) / 240);
    return base * factor;
  }, [bpm]);

  // Use a smoother transition for the physical swing effect
  const rotation = isActive ? (currentBeat % 2 === 0 ? -amplitude : amplitude) : 0;
  const isAccent = isActive && (currentBeat % beatsPerMeasure === 0);

  return (
    <div 
      className="absolute pointer-events-none transition-opacity duration-500"
      style={{ 
        width: size, 
        height: size,
        opacity: isActive ? 1 : 0.2
      }}
    >
      {/* Pivot point at the center of the component (shared with dial) */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-white/40 rounded-full z-0" />
      
      {/* The swinging arm */}
      <div 
        className="absolute bottom-1/2 left-1/2 w-0.5 origin-bottom transition-transform ease-in-out"
        style={{ 
          height: size / 2.2, // Reach almost to the edge of the dial
          transform: `translateX(-50%) rotate(${rotation}deg)`,
          transitionDuration: `${60 / bpm}s`,
          zIndex: 0
        }}
      >
        {/* Glow behind the rod */}
        <div className={`absolute inset-0 blur-sm transition-colors duration-300 ${isAccent ? 'bg-white/40' : 'bg-white/5'}`} />
        
        {/* The Rod - Adjusted from white/10 to white/20 for better visibility as requested */}
        <div className={`w-full h-full rounded-full transition-colors duration-300 ${isAccent ? 'bg-white shadow-[0_0_15px_rgba(255,255,255,0.5)]' : 'bg-white/20'}`} />
        
        {/* Sliding Weight (Traditional Metronome Feature) */}
        <div 
          className={`absolute w-4 h-5 left-1/2 -translate-x-1/2 rounded-sm border transition-all duration-300 ${
            isAccent ? 'bg-white border-white scale-110 shadow-[0_0_10px_rgba(255,255,255,0.3)]' : 'bg-zinc-200/40 border-white/20'
          }`}
          style={{ 
            // Map 1-240 BPM to 35%-90% of rod length to ensure visibility above center dial even at low speeds
            bottom: `${35 + (bpm / 240) * 55}%` 
          }}
        >
          {/* Internal detail line on the weight */}
          <div className={`w-full h-px mt-2 ${isAccent ? 'bg-black/20' : 'bg-white/30'}`} />
        </div>
      </div>

      {/* Subtle arc guide */}
      <svg className="absolute top-0 left-0 w-full h-full opacity-[0.05]" viewBox={`0 0 ${size} ${size}`}>
        <path 
          d={`M ${size * 0.25} ${size * 0.2} Q ${size * 0.5} ${size * 0.15} ${size * 0.75} ${size * 0.2}`} 
          fill="none" 
          stroke="white" 
          strokeWidth="1" 
          strokeDasharray="2 4" 
        />
      </svg>
    </div>
  );
};
