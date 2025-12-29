
import React, { useState, useRef, useEffect, useCallback } from 'react';

interface MetronomeDialProps {
  bpm: number;
  setBpm: (bpm: number) => void;
  isPlaying: boolean;
  togglePlay: () => void;
  onInteraction: () => void;
  onInteractionStart?: () => void;
  onInteractionEnd?: () => void;
}

export const MetronomeDial: React.FC<MetronomeDialProps> = ({ 
  bpm, 
  setBpm, 
  isPlaying, 
  togglePlay, 
  onInteraction,
  onInteractionStart,
  onInteractionEnd
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartPos = useRef<{ x: number, y: number } | null>(null);
  const lastAngle = useRef<number | null>(null);
  const lastBpmFeedback = useRef<number>(bpm);
  
  // Track accumulated angle delta for smoother dragging without cycling
  const accumulatedDelta = useRef<number>(0);

  // Constants for layout and logic
  const MIN_BPM = 1;
  const MAX_BPM = 240;
  const BPM_RANGE = MAX_BPM - MIN_BPM;
  const SIZE = 240; 
  const CENTER = SIZE / 2;
  const RADIUS = 95; 
  const KNOB_RADIUS = 14;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

  // Sensitivity: how many degrees of rotation equal 1 BPM unit?
  const DEG_PER_BPM = 1.5;

  const playClickFeedback = useCallback(() => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();
      
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.01);
      
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.01);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.02);
    } catch (e) {
      console.warn('Audio feedback failed', e);
    }
  }, []);

  const triggerFeedback = useCallback((newBpm: number) => {
    const roundedBpm = Math.floor(newBpm);
    if (roundedBpm !== lastBpmFeedback.current) {
      lastBpmFeedback.current = roundedBpm;
      playClickFeedback();
      if ('vibrate' in navigator) navigator.vibrate(2);
      onInteraction();
    }
  }, [onInteraction, playClickFeedback]);

  const calculateAngle = (clientX: number, clientY: number) => {
    if (!containerRef.current) return 0;
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = clientX - centerX;
    const dy = clientY - centerY;
    let angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
    if (angle < 0) angle += 360;
    return angle;
  };

  const handleMove = useCallback((clientX: number, clientY: number) => {
    if (!isDragging || lastAngle.current === null) return;
    
    const currentAngle = calculateAngle(clientX, clientY);
    let delta = currentAngle - lastAngle.current;
    
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;

    accumulatedDelta.current += delta;
    
    if (Math.abs(accumulatedDelta.current) >= DEG_PER_BPM) {
      const bpmChange = Math.trunc(accumulatedDelta.current / DEG_PER_BPM);
      if (bpmChange !== 0) {
        const nextBpm = Math.min(MAX_BPM, Math.max(MIN_BPM, bpm + bpmChange));
        
        if (nextBpm !== bpm) {
          setBpm(nextBpm);
          triggerFeedback(nextBpm);
          accumulatedDelta.current %= DEG_PER_BPM;
        } else {
          accumulatedDelta.current = 0;
        }
      }
    }
    
    lastAngle.current = currentAngle;
  }, [bpm, isDragging, setBpm, triggerFeedback]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => handleMove(e.clientX, e.clientY);
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        handleMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };
    const onEnd = (e: MouseEvent | TouchEvent) => {
      if (dragStartPos.current) {
        const clientX = 'clientX' in e ? (e as MouseEvent).clientX : (e as TouchEvent).changedTouches[0].clientX;
        const clientY = 'clientY' in e ? (e as MouseEvent).clientY : (e as TouchEvent).changedTouches[0].clientY;
        const dist = Math.sqrt(Math.pow(clientX - dragStartPos.current.x, 2) + Math.pow(clientY - dragStartPos.current.y, 2));
        
        if (dist < 10 && (e.target as HTMLElement).closest('.center-button')) {
          togglePlay();
        } 
        else if (dist < 5) {
          const angle = calculateAngle(clientX, clientY);
          const nextBpm = Math.round(MIN_BPM + (angle / 360 * BPM_RANGE));
          setBpm(Math.min(MAX_BPM, Math.max(MIN_BPM, nextBpm)));
          triggerFeedback(nextBpm);
        }
      }

      setIsDragging(false);
      lastAngle.current = null;
      dragStartPos.current = null;
      accumulatedDelta.current = 0;
      onInteractionEnd?.();
    };

    if (isDragging) {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onEnd);
      window.addEventListener('touchmove', onTouchMove, { passive: false });
      window.addEventListener('touchend', onEnd);
    }
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onEnd);
    };
  }, [isDragging, handleMove, togglePlay, onInteractionEnd, setBpm, triggerFeedback]);

  const onStart = (clientX: number, clientY: number) => {
    setIsDragging(true);
    dragStartPos.current = { x: clientX, y: clientY };
    lastAngle.current = calculateAngle(clientX, clientY);
    accumulatedDelta.current = 0;
    lastBpmFeedback.current = Math.floor(bpm);
    onInteractionStart?.();
  };

  const ticks = Array.from({ length: 40 }).map((_, i) => (
    <div 
      key={i}
      className={`absolute w-0.5 h-2 bg-white/20 origin-bottom`}
      style={{
        bottom: '50%',
        left: '50%',
        transform: `translateX(-50%) rotate(${i * 9}deg) translateY(-${RADIUS - 12}px)`,
        opacity: i % 5 === 0 ? 0.6 : 0.2
      }}
    />
  ));

  const progress = (bpm - MIN_BPM) / BPM_RANGE;

  return (
    <div 
      ref={containerRef}
      className="relative flex items-center justify-center cursor-pointer select-none touch-none"
      style={{ width: SIZE, height: SIZE }}
      onMouseDown={(e) => onStart(e.clientX, e.clientY)}
      onTouchStart={(e) => onStart(e.touches[0].clientX, e.touches[0].clientY)}
    >
      {/* Background Gaussian Blur Circle - Restricted to interactive area (RADIUS * 2) */}
      <div 
        className="absolute rounded-full bg-white/[0.05] backdrop-blur-[24px] pointer-events-none" 
        style={{ width: RADIUS * 2 + 10, height: RADIUS * 2 + 10 }}
      />
      
      <svg 
        viewBox={`0 0 ${SIZE} ${SIZE}`} 
        className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none"
      >
        <circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          fill="none"
          stroke="white"
          strokeWidth="3"
          strokeDasharray={`${progress * CIRCUMFERENCE} ${CIRCUMFERENCE}`}
          strokeLinecap="round"
          className={`transition-all ${isDragging ? 'duration-75' : 'duration-300'}`}
          style={{ filter: 'drop-shadow(0 0 2px rgba(255,255,255,0.3))' }}
        />
      </svg>

      {ticks}

      <div 
        className="center-button glass rounded-full flex flex-col items-center justify-center shadow-[inset_0_2px_10px_rgba(255,255,255,0.05),0_15px_30px_rgba(0,0,0,0.4)] z-10 border border-white/10 active:scale-95 transition-transform duration-75 overflow-hidden"
        style={{ width: RADIUS * 1.45, height: RADIUS * 1.45 }}
      >
        <div className={`mb-1 transition-all duration-300 ${isPlaying ? 'scale-110 opacity-100' : 'scale-90 opacity-60'}`}>
          {isPlaying ? (
            <svg className="w-5 h-5 fill-white" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
          ) : (
            <svg className="w-5 h-5 fill-white" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
          )}
        </div>
        <span className="text-[10px] tracking-[0.3em] text-zinc-200 uppercase font-black mb-1 drop-shadow-sm">TEMPO</span>
        <span className="text-5xl font-black text-white leading-none tabular-nums drop-shadow-md">{bpm}</span>
        <span className="text-[10px] tracking-[0.3em] text-zinc-200 uppercase font-black mt-1 drop-shadow-sm">BPM</span>
      </div>

      <div 
        className={`absolute z-20 pointer-events-none transition-transform ${isDragging ? 'duration-75 scale-110' : 'duration-300 scale-100'}`}
        style={{ 
          width: KNOB_RADIUS * 2, 
          height: KNOB_RADIUS * 2,
          transform: `rotate(${progress * 360}deg) translateY(-${RADIUS}px)` 
        }}
      >
        <div className="w-full h-full rounded-full bg-white relative shadow-[0_4px_10px_rgba(0,0,0,0.5),inset_0_-2px_4px_rgba(0,0,0,0.2)]">
          <div className="absolute inset-[3px] rounded-full border border-black/5 bg-gradient-to-tr from-zinc-200 to-white" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-zinc-400 opacity-30 shadow-inner" />
          {isDragging && (
            <div className="absolute inset-0 rounded-full bg-white/40 blur-md -z-10 animate-pulse" />
          )}
        </div>
      </div>
    </div>
  );
};
