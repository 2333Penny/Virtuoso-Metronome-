
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Pendulum } from './components/Pendulum';
import { MetronomeDial } from './components/MetronomeDial';
import { AudioEngine } from './services/AudioEngine';
import { TimeSignature, SoundProfile, CustomSoundProfile } from './types';

const INITIAL_SIGNATURES: TimeSignature[] = [
  { beats: 2, noteValue: 4 },
  { beats: 3, noteValue: 4 },
  { beats: 4, noteValue: 4 },
  { beats: 3, noteValue: 8 },
  { beats: 6, noteValue: 8 },
];

const DEFAULT_SIGNATURE = INITIAL_SIGNATURES[2]; // 4/4

const BUILT_IN_PROFILES = [
  SoundProfile.DIGITAL,
  SoundProfile.WOOD,
  SoundProfile.METALLIC
];

const App: React.FC = () => {
  const [bpm, setBpm] = useState(() => {
    const saved = localStorage.getItem('metronome_bpm');
    return saved ? parseInt(saved, 10) : 60; // Optimized: Default BPM changed to 60
  });
  
  const [signatures, setSignatures] = useState<TimeSignature[]>(() => {
    const saved = localStorage.getItem('metronome_custom_sigs');
    return saved ? JSON.parse(saved) : INITIAL_SIGNATURES;
  });

  const [activeSignature, setActiveSignature] = useState<TimeSignature>(() => {
    const saved = localStorage.getItem('metronome_sig');
    return saved ? JSON.parse(saved) : DEFAULT_SIGNATURE;
  });

  const [customProfiles, setCustomProfiles] = useState<CustomSoundProfile[]>(() => {
    const saved = localStorage.getItem('metronome_custom_profiles');
    return saved ? JSON.parse(saved) : [];
  });

  const [activeProfileId, setActiveProfileId] = useState<string>(() => {
    return localStorage.getItem('metronome_active_profile_id') || SoundProfile.DIGITAL;
  });

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentBeat, setCurrentBeat] = useState(0);
  const [accentOn, setAccentOn] = useState(true);
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [isSettingSound, setIsSettingSound] = useState(false);
  const [isInteracting, setIsInteracting] = useState(false);
  
  const [isCreatingProfile, setIsCreatingProfile] = useState(false);
  const [newProfileName, setNewProfileName] = useState("");
  
  const [newBeats, setNewBeats] = useState(4);
  const [newNoteValue, setNewNoteValue] = useState(4);

  const audioEngine = useRef<AudioEngine | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const activeItemRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    audioEngine.current = new AudioEngine();
    return () => audioEngine.current?.stop();
  }, []);

  useEffect(() => {
    const updateEngine = async () => {
      if (!audioEngine.current) return;
      
      let currentProfileType = SoundProfile.DIGITAL;
      if (BUILT_IN_PROFILES.includes(activeProfileId as SoundProfile)) {
        currentProfileType = activeProfileId as SoundProfile;
      } else {
        currentProfileType = SoundProfile.CUSTOM;
        const profile = customProfiles.find(p => p.id === activeProfileId);
        if (profile) {
          await audioEngine.current.setCustomSounds(profile.accent, profile.beat);
        }
      }

      audioEngine.current.setParams(
        bpm, 
        accentOn ? activeSignature.beats : 99999,
        currentProfileType,
        (beat) => setCurrentBeat(beat)
      );
    };

    updateEngine();
    
    localStorage.setItem('metronome_bpm', bpm.toString());
    localStorage.setItem('metronome_sig', JSON.stringify(activeSignature));
    localStorage.setItem('metronome_active_profile_id', activeProfileId);
    localStorage.setItem('metronome_custom_sigs', JSON.stringify(signatures));
    localStorage.setItem('metronome_custom_profiles', JSON.stringify(customProfiles));
  }, [bpm, activeSignature, accentOn, activeProfileId, customProfiles, signatures]);

  useEffect(() => {
    if (activeItemRef.current && scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const activeItem = activeItemRef.current;
      const containerWidth = container.clientWidth;
      const itemWidth = activeItem.offsetWidth;
      const itemLeft = activeItem.offsetLeft;
      
      const targetScroll = itemLeft - (containerWidth / 2) + (itemWidth / 2);
      container.scrollTo({
        left: targetScroll,
        behavior: 'smooth'
      });
    }
  }, [activeSignature, signatures]);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      audioEngine.current?.stop();
      setCurrentBeat(0);
    } else {
      audioEngine.current?.start();
    }
    setIsPlaying(!isPlaying);
    if ('vibrate' in navigator) navigator.vibrate(15);
  }, [isPlaying]);

  const cycleProfile = () => {
    const allAvailable = [...BUILT_IN_PROFILES, ...customProfiles.map(p => p.id)];
    const currentIndex = allAvailable.indexOf(activeProfileId);
    const nextIndex = (currentIndex + 1) % allAvailable.length;
    setActiveProfileId(allAvailable[nextIndex]);
    if ('vibrate' in navigator) navigator.vibrate(10);
  };

  const handleAddSignature = () => {
    const newSig = { beats: newBeats, noteValue: newNoteValue };
    const alreadyExists = signatures.some(s => s.beats === newSig.beats && s.noteValue === newSig.noteValue);
    if (!alreadyExists) setSignatures([...signatures, newSig]);
    setActiveSignature(newSig);
    setIsCustomizing(false);
    if ('vibrate' in navigator) navigator.vibrate(20);
  };

  const removeSignature = (e: React.MouseEvent, sig: TimeSignature) => {
    e.stopPropagation();
    const isInitial = INITIAL_SIGNATURES.some(s => s.beats === sig.beats && s.noteValue === sig.noteValue);
    if (isInitial) return;

    const filtered = signatures.filter(s => !(s.beats === sig.beats && s.noteValue === sig.noteValue));
    setSignatures(filtered);

    if (activeSignature.beats === sig.beats && activeSignature.noteValue === sig.noteValue) {
      setActiveSignature(DEFAULT_SIGNATURE);
    }
  };

  const createNewProfile = () => {
    if (!newProfileName.trim()) return;
    const newProfile: CustomSoundProfile = {
      id: `custom_${Date.now()}`,
      name: newProfileName.trim(),
      accent: null,
      beat: null,
      backgroundImage: null,
      backgroundImageName: null
    };
    setCustomProfiles([...customProfiles, newProfile]);
    setNewProfileName("");
    setIsCreatingProfile(false);
    setActiveProfileId(newProfile.id);
  };

  const updateProfileData = (id: string, updates: Partial<CustomSoundProfile>) => {
    setCustomProfiles(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const deleteProfile = (id: string) => {
    const filtered = customProfiles.filter(p => p.id !== id);
    setCustomProfiles(filtered);
    if (activeProfileId === id) {
      setActiveProfileId(SoundProfile.DIGITAL);
    }
  };

  const backgroundStyles = useMemo(() => {
    const currentProfile = customProfiles.find(p => p.id === activeProfileId);
    if (currentProfile?.backgroundImage) {
      return {
        backgroundImage: `linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.4)), url(${currentProfile.backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundColor: '#000',
        transition: 'background-image 1.5s cubic-bezier(0.2, 0, 0.2, 1)',
        '--accent-color': 'rgba(255, 255, 255, 0.6)',
      } as React.CSSProperties;
    }

    const progress = (bpm - 1) / (240 - 1);
    let h, s, l;

    if (activeProfileId === SoundProfile.WOOD) {
      h = 22 + (progress * 8);
      s = 35 + (progress * 25);
      l = 6 + (progress * 18);
    } else if (activeProfileId === SoundProfile.METALLIC) {
      h = 212 - (progress * 4); 
      s = 18 + (progress * 14); 
      l = 12 + (progress * 18); 
    } else if (!BUILT_IN_PROFILES.includes(activeProfileId as SoundProfile)) {
      h = 280 + (progress * 20); 
      s = 30 + (progress * 10);
      l = 10 + (progress * 10);
    } else {
      h = 210 - (progress * 5); 
      s = 40 + (progress * 20);
      l = 6 + (progress * 16);
    }

    const baseColor = `hsl(${h}, ${s}%, ${l}%)`;
    const sunriseGlow = `hsl(${h}, ${s + 5}%, ${l + 10}%)`;
    const accentColor = `hsl(${h}, ${s + 10}%, ${l + 20}%)`;

    return {
      backgroundColor: baseColor,
      backgroundImage: `
        radial-gradient(circle at 50% 45%, ${sunriseGlow} 0%, transparent 80%),
        radial-gradient(circle at 20% 10%, hsla(${h}, ${s}%, 30%, 0.02) 0%, transparent 40%),
        radial-gradient(circle at 80% 80%, hsla(${h}, ${s}%, 15%, 0.04) 0%, transparent 60%)
      `,
      transition: 'background-color 1.5s cubic-bezier(0.2, 0, 0.2, 1), background-image 1.5s cubic-bezier(0.2, 0, 0.2, 1)',
      '--accent-color': accentColor,
    } as React.CSSProperties;
  }, [bpm, activeProfileId, customProfiles]);

  const activeProfileName = useMemo(() => {
    const profile = customProfiles.find(p => p.id === activeProfileId);
    return profile ? profile.name : activeProfileId;
  }, [activeProfileId, customProfiles]);

  return (
    <div 
      className="flex flex-col items-center h-screen w-screen text-white selection:bg-none overflow-hidden font-['JetBrains_Mono'] relative"
      style={backgroundStyles}
    >
      <div 
        className="absolute inset-0 pointer-events-none z-0 mix-blend-overlay opacity-[0.1]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />
      
      <header className="w-full flex justify-between items-center z-20 px-8 pt-10 flex-shrink-0">
        <div className="flex flex-col">
          <h1 className="text-2xl font-black tracking-tighter text-white/80">VIRTUOSO</h1>
          <span className="text-[10px] text-white/50 uppercase tracking-[0.6em] font-light">PRECISION</span>
        </div>
        <div className="flex gap-4">
          {/* Sound Library button moved from here to bottom area */}
          <button 
            onClick={() => setAccentOn(!accentOn)}
            className={`px-5 py-2.5 rounded-full text-[10px] uppercase tracking-widest font-bold transition-all border shadow-2xl backdrop-blur-md ${
              accentOn ? 'bg-white/90 text-black border-white' : 'bg-white/5 text-white/50 border-white/10'
            }`}
          >
            {accentOn ? 'ACCENT ON' : 'ACCENT OFF'}
          </button>
        </div>
      </header>

      <main className="flex-1 w-full flex flex-col items-center relative z-10 overflow-hidden">
        <div className="flex-[1.2] w-full flex items-center justify-center relative min-h-0">
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <Pendulum 
              bpm={bpm} 
              isActive={isPlaying} 
              currentBeat={currentBeat} 
              beatsPerMeasure={activeSignature.beats} 
              size={480} 
            />
          </div>
          
          <div className="relative z-10 scale-110 sm:scale-125">
            <MetronomeDial 
              bpm={bpm} 
              setBpm={setBpm} 
              isPlaying={isPlaying}
              togglePlay={togglePlay}
              onInteractionStart={() => setIsInteracting(true)}
              onInteractionEnd={() => setIsInteracting(false)}
              onInteraction={() => {}} 
            />
          </div>
          
          <div 
            className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 blur-[140px] rounded-full -z-10 transition-all ${isInteracting ? 'duration-150 scale-150 opacity-30' : 'duration-1000 scale-100 opacity-15'}`} 
            style={{ backgroundColor: 'var(--accent-color)' }}
          />
        </div>

        <div className="w-full flex flex-col items-center gap-8 pb-12 flex-shrink-0">
          <div className="w-full flex justify-center items-center gap-4 px-4">
            <button 
              onClick={cycleProfile} 
              className="group px-8 py-3 bg-white/5 border border-white/10 rounded-full flex items-center gap-5 active:scale-95 transition-all hover:bg-white/10 hover:border-white/20 shadow-2xl backdrop-blur-3xl"
            >
              <span className="text-[9px] uppercase tracking-[0.4em] font-black text-white/50 group-hover:text-white/80">PROFILE:</span>
              <span className="text-[11px] font-black tracking-[0.1em] text-white/80 group-hover:text-white uppercase truncate max-w-[120px]">{activeProfileName}</span>
            </button>
            
            {/* Optimized: Sound Library button relocated next to Profile */}
            <button 
              onClick={() => setIsSettingSound(true)}
              className="p-3.5 rounded-full bg-white/5 border border-white/10 text-white/70 hover:text-white transition-all active:scale-90 shadow-xl backdrop-blur-3xl hover:bg-white/10 hover:border-white/20"
              title="Sound Library"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"/></svg>
            </button>
          </div>

          <div className="w-full flex flex-col items-center gap-3 max-w-full">
            <div className="flex flex-col items-center mb-1">
              <span className="text-[9px] uppercase tracking-[0.8em] font-light text-white/50 text-center">RHYTHMIC PRESETS</span>
            </div>
            
            <div 
              ref={scrollContainerRef}
              className="w-full overflow-x-auto no-scrollbar scroll-smooth snap-x snap-mandatory relative"
            >
              <div className="flex gap-4 py-4 items-center min-w-max">
                <div className="flex-shrink-0 w-[calc(50vw-45px)]" />
                {signatures.map((sig) => {
                  const isActive = sig.beats === activeSignature.beats && sig.noteValue === activeSignature.noteValue;
                  const isInitial = INITIAL_SIGNATURES.some(s => s.beats === sig.beats && s.noteValue === sig.noteValue);
                  return (
                    <button
                      key={`${sig.beats}-${sig.noteValue}`}
                      ref={isActive ? activeItemRef : null}
                      onClick={() => setActiveSignature(sig)}
                      className={`group relative px-6 py-2.5 rounded-2xl transition-all duration-700 border text-[13px] font-bold flex items-center gap-2.5 flex-shrink-0 backdrop-blur-2xl snap-center ${
                        isActive 
                          ? 'border-white/30 text-white bg-white/10 scale-105 shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-10' 
                          : 'border-white/5 text-white/30 hover:text-white/60 bg-white/5'
                      }`}
                    >
                      <span className="tabular-nums">{sig.beats}</span>
                      <span className="text-white/30 font-thin">/</span>
                      <span className="tabular-nums">{sig.noteValue}</span>
                      {!isInitial && (
                        <span onClick={(e) => removeSignature(e, sig)} className="ml-2 text-white/50 hover:text-red-400 text-lg leading-none p-0.5">×</span>
                      )}
                    </button>
                  );
                })}
                <button 
                  onClick={() => setIsCustomizing(true)}
                  className="px-6 py-2.5 rounded-2xl border border-dashed border-white/10 text-white/30 hover:text-white/60 hover:bg-white/5 transition-all text-[10px] font-bold active:scale-95 flex items-center gap-2.5 whitespace-nowrap flex-shrink-0 backdrop-blur-sm snap-center"
                >
                  <span className="text-xl leading-none font-light">+</span> CUSTOM
                </button>
                <div className="flex-shrink-0 w-[calc(50vw-45px)]" />
              </div>
            </div>
          </div>
        </div>

        {/* Modal: New Signature */}
        {isCustomizing && (
          <div className="absolute inset-0 z-[100] flex items-center justify-center p-6 bg-transparent">
            <div className="glass w-full max-w-[340px] p-10 rounded-[3.5rem] border border-white/20 space-y-12 animate-in zoom-in duration-300">
              <h3 className="text-[11px] text-center uppercase tracking-[0.6em] font-black text-white/60">NEW SIGNATURE</h3>
              <div className="space-y-10">
                <div className="space-y-4">
                  <div className="flex justify-between px-2 text-[10px] text-white/70 font-bold tracking-widest">BEATS <span>{newBeats}</span></div>
                  <input type="range" min="1" max="32" value={newBeats} onChange={(e) => setNewBeats(parseInt(e.target.value))} className="w-full accent-white opacity-40 hover:opacity-100 transition-opacity" />
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between px-2 text-[10px] text-white/70 font-bold tracking-widest">UNIT <span>1/{newNoteValue}</span></div>
                  <div className="flex justify-between gap-2">
                    {[1, 2, 4, 8, 16].map(v => (
                      <button key={v} onClick={() => setNewNoteValue(v)} className={`flex-1 py-3 rounded-xl border text-[11px] font-bold transition-all ${newNoteValue === v ? 'bg-white text-black border-white' : 'bg-white/5 border-white/10 text-white/70'}`}>{v}</button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex gap-4 pt-4">
                <button onClick={() => setIsCustomizing(false)} className="flex-1 py-5 text-[11px] font-black text-white/50 uppercase tracking-[0.4em]">CANCEL</button>
                <button onClick={handleAddSignature} className="flex-1 py-5 bg-white text-black rounded-3xl text-[11px] font-black tracking-[0.4em]">ADD</button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Sound Library */}
        {isSettingSound && (
          <div className="absolute inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-transparent animate-in fade-in duration-500">
            <div className="relative w-full max-w-[460px] max-h-[90vh] flex flex-col rounded-[3rem] border border-white/30 shadow-[0_60px_120px_rgba(0,0,0,0.6)] overflow-hidden animate-in zoom-in duration-400 bg-white/[0.08] backdrop-blur-[40px]">
              
              <div className="flex justify-between items-center p-6 pb-4 flex-shrink-0 z-10 border-b border-white/10">
                <h3 className="text-[11px] uppercase tracking-[0.6em] font-black text-white/70">SOUND LIBRARY</h3>
                <button 
                  onClick={() => setIsSettingSound(false)} 
                  className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-all active:scale-90"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto no-scrollbar p-6 pt-5 space-y-8">
                <div className="space-y-4">
                  <span className="text-[9px] uppercase tracking-[0.4em] font-black text-white/50 block ml-1">BUILT-IN</span>
                  <div className="grid grid-cols-3 gap-2.5">
                    {BUILT_IN_PROFILES.map(id => (
                      <button 
                        key={id} 
                        onClick={() => setActiveProfileId(id)} 
                        className={`py-3.5 rounded-xl border text-[10px] font-bold transition-all ${activeProfileId === id ? 'bg-white text-black border-white shadow-lg' : 'bg-white/5 border-white/10 text-white/70 hover:border-white/30 hover:bg-white/10'}`}
                      >
                        {id.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-5">
                  <div className="flex justify-between items-center ml-1">
                    <span className="text-[9px] uppercase tracking-[0.4em] font-black text-white/50">USER DEFINED</span>
                    {!isCreatingProfile && (
                      <button 
                        onClick={() => setIsCreatingProfile(true)} 
                        className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/10 text-[8.5px] font-black tracking-widest text-white/90 hover:text-white hover:bg-white/20 transition-all uppercase"
                      >
                        + NEW
                      </button>
                    )}
                  </div>

                  {isCreatingProfile && (
                    <div className="p-5 rounded-[2rem] bg-white/[0.05] border border-white/20 space-y-4 animate-in slide-in-from-top duration-300">
                      <input 
                        autoFocus 
                        placeholder="NAME..." 
                        value={newProfileName} 
                        onChange={(e) => setNewProfileName(e.target.value)} 
                        className="w-full bg-transparent border-b border-white/20 py-2.5 text-sm focus:outline-none focus:border-white/50 text-white placeholder-white/50 font-bold" 
                        onKeyDown={(e) => e.key === 'Enter' && createNewProfile()} 
                      />
                      <div className="flex gap-3 justify-end">
                        <button onClick={() => setIsCreatingProfile(false)} className="text-[9px] font-black tracking-widest text-white/50 hover:text-white/80 uppercase">Cancel</button>
                        <button onClick={createNewProfile} className="px-5 py-2 rounded-full bg-white text-black text-[9px] font-black tracking-widest uppercase shadow-lg active:scale-95 transition-all">Create</button>
                      </div>
                    </div>
                  )}

                  <div className="space-y-6 pb-6">
                    {customProfiles.map(p => (
                      <div 
                        key={p.id} 
                        className={`group p-5 rounded-[2.5rem] border transition-all duration-500 ${activeProfileId === p.id ? 'bg-white/[0.1] border-white/40 shadow-xl' : 'bg-white/[0.03] border-white/10'}`}
                      >
                        <div className="flex justify-between items-center mb-5">
                          <button onClick={() => setActiveProfileId(p.id)} className="flex items-center gap-3 flex-1 text-left">
                            <span className={`w-2.5 h-2.5 rounded-full transition-all duration-500 ${activeProfileId === p.id ? 'bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)]' : 'bg-white/30'}`} />
                            <span className="text-[13px] font-black uppercase tracking-[0.1em] truncate text-white/90">{p.name}</span>
                          </button>
                          <button 
                            onClick={() => deleteProfile(p.id)} 
                            className="opacity-0 group-hover:opacity-40 hover:opacity-100 transition-opacity text-red-400 p-1.5 active:scale-90"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                          </button>
                        </div>
                        
                        <div className="space-y-6">
                          <div className="grid grid-cols-2 gap-5">
                            <SoundSlot label="ACCENT" current={p.accent} onSave={(data) => updateProfileData(p.id, { accent: data })} />
                            <SoundSlot label="BEAT" current={p.beat} onSave={(data) => updateProfileData(p.id, { beat: data })} />
                          </div>
                          
                          <div>
                             <BackgroundUploader 
                               current={p.backgroundImage} 
                               currentName={p.backgroundImageName}
                               onSave={(img, name) => updateProfileData(p.id, { backgroundImage: img, backgroundImageName: name })} 
                             />
                          </div>
                        </div>
                      </div>
                    ))}
                    {customProfiles.length === 0 && !isCreatingProfile && (
                      <div className="text-center py-12 text-[10px] text-white/30 font-black tracking-[0.3em] uppercase">No custom profiles</div>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="h-10 bg-gradient-to-t from-black/20 to-transparent flex-shrink-0 pointer-events-none absolute bottom-0 left-0 right-0 rounded-b-[3rem]" />
            </div>
          </div>
        )}
      </main>

      <div className="fixed top-0 left-0 w-full h-full pointer-events-none -z-10 overflow-hidden">
        <div 
          className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150vw] h-[150vh] rounded-full blur-[160px] transition-all duration-300 ${!isInteracting && isPlaying && currentBeat % activeSignature.beats === 0 ? 'opacity-20 scale-110' : 'opacity-0 scale-100'}`} 
          style={{ backgroundColor: 'var(--accent-color)' }}
        />
      </div>
    </div>
  );
};

const BackgroundUploader: React.FC<{ current?: string | null, currentName?: string | null, onSave: (data: string | null, name: string | null) => void }> = ({ current, currentName, onSave }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const name = file.name;
    const reader = new FileReader();
    reader.onload = (ev) => { if (ev.target?.result) onSave(ev.target.result as string, name); };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-between items-center px-1">
        <label className="text-[9px] tracking-[0.2em] text-white/50 font-black uppercase">BACKGROUND</label>
        {current && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,1)]" />}
      </div>
      
      <div className="relative group">
        {current ? (
          <div className="flex gap-3 items-center animate-in fade-in duration-300">
            <div className="flex-1 h-12 rounded-xl border border-white/20 bg-white/5 flex items-center px-4 overflow-hidden">
               <span className="text-[10px] font-bold text-white/80 truncate tracking-wide">
                 {currentName || 'CUSTOM_BG.IMG'}
               </span>
            </div>
            <button 
              onClick={() => onSave(null, null)} 
              className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 flex items-center justify-center hover:bg-red-500/20 active:scale-95 transition-all"
              title="Remove Background"
            >
               <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
        ) : (
          <button 
            onClick={() => fileInputRef.current?.click()} 
            className="w-full h-12 rounded-xl border border-white/10 bg-white/10 text-white/50 hover:text-white hover:border-white/30 hover:bg-white/20 flex items-center justify-center gap-2.5 transition-all duration-300 active:scale-[0.98]"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h14a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
            <span className="text-[9px] font-bold tracking-widest uppercase opacity-80">Upload Image</span>
          </button>
        )}
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />
      </div>
    </div>
  );
};

const SoundSlot: React.FC<{ label: string, current: string | null, onSave: (data: string | null) => void }> = ({ label, current, onSave }) => {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { if (ev.target?.result) onSave(ev.target.result as string); };
    reader.readAsDataURL(file);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorder.current = recorder;
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/wav' });
        const reader = new FileReader();
        reader.onload = (ev) => { if (ev.target?.result) onSave(ev.target.result as string); };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach(t => t.stop());
      };
      recorder.start();
      setIsRecording(true);
      setTimeout(() => stopRecording(), 1000);
    } catch (e) { console.error("Recording failed", e); }
  };

  const stopRecording = () => {
    if (mediaRecorder.current && mediaRecorder.current.state === 'recording') mediaRecorder.current.stop();
    setIsRecording(false);
  };

  const playSound = () => {
    if (current) {
      const audio = new Audio(current);
      audio.play();
    }
  };

  const clearSound = () => {
    onSave(null);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-between items-center px-1">
        <label className="text-[9px] tracking-[0.2em] text-white/50 font-black uppercase">{label}</label>
        {current && <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,1)]" />}
      </div>
      
      <div className="flex flex-col gap-2">
        {current ? (
          <div className="flex gap-2.5 animate-in fade-in duration-300">
             <button 
               onClick={playSound} 
               className="flex-1 h-12 rounded-xl bg-white/10 border border-white/20 text-white flex items-center justify-center hover:bg-white/20 active:scale-95 transition-all"
               title="Play"
             >
                <svg className="w-4 h-4 fill-white" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
             </button>
             <button 
               onClick={clearSound} 
               className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 flex items-center justify-center hover:bg-red-500/20 active:scale-95 transition-all"
               title="Clear"
             >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12"/></svg>
             </button>
          </div>
        ) : (
          <div className="flex gap-2.5 animate-in fade-in duration-300">
            <button 
              onClick={isRecording ? stopRecording : startRecording} 
              className={`flex-1 h-12 rounded-xl border flex items-center justify-center transition-all duration-300 ${isRecording ? 'bg-red-500/20 border-red-500 text-red-500 animate-pulse' : 'bg-white/10 border-white/10 text-white/50 hover:text-white hover:border-white/30 hover:bg-white/20 active:scale-90'}`}
              title="Record"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>
            </button>
            <button 
              onClick={() => fileInputRef.current?.click()} 
              className="flex-1 h-12 rounded-xl border border-white/10 bg-white/10 text-white/50 hover:text-white hover:border-white/30 hover:bg-white/20 flex items-center justify-center transition-all duration-300 active:scale-90"
              title="Upload"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
            </button>
            <input ref={fileInputRef} type="file" accept="audio/*" onChange={handleUpload} className="hidden" />
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
