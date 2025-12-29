
import { SoundProfile } from '../types';

export class AudioEngine {
  private audioCtx: AudioContext | null = null;
  private nextNoteTime: number = 0;
  private lookahead: number = 25.0;
  private scheduleAheadTime: number = 0.1;
  private timerID: number | null = null;
  private bpm: number = 100;
  private beatsPerMeasure: number = 4;
  private currentBeat: number = 0;
  private profile: SoundProfile = SoundProfile.DIGITAL;
  private onBeat?: (beat: number) => void;

  private customAccentBuffer: AudioBuffer | null = null;
  private customBeatBuffer: AudioBuffer | null = null;

  private initAudio() {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  public setParams(bpm: number, beatsPerMeasure: number, profile: SoundProfile, onBeat?: (beat: number) => void) {
    this.bpm = bpm;
    this.beatsPerMeasure = beatsPerMeasure;
    this.profile = profile;
    this.onBeat = onBeat;
  }

  public async setCustomSounds(accentData: string | null, beatData: string | null) {
    this.initAudio();
    if (!this.audioCtx) return;

    if (accentData) {
      this.customAccentBuffer = await this.decodeBase64(accentData);
    } else {
      this.customAccentBuffer = null;
    }

    if (beatData) {
      this.customBeatBuffer = await this.decodeBase64(beatData);
    } else {
      this.customBeatBuffer = null;
    }
  }

  private async decodeBase64(base64: string): Promise<AudioBuffer | null> {
    if (!this.audioCtx) return null;
    try {
      const response = await fetch(base64);
      const arrayBuffer = await response.arrayBuffer();
      return await this.audioCtx.decodeAudioData(arrayBuffer);
    } catch (e) {
      console.error("Failed to decode custom sound", e);
      return null;
    }
  }

  private createNoiseBuffer() {
    if (!this.audioCtx) return null;
    const bufferSize = this.audioCtx.sampleRate * 0.05;
    const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  private scheduleNote(beatNumber: number, time: number) {
    if (!this.audioCtx) return;

    const isAccent = beatNumber % this.beatsPerMeasure === 0;
    const masterGain = this.audioCtx.createGain();
    masterGain.connect(this.audioCtx.destination);

    switch (this.profile) {
      case SoundProfile.CUSTOM: {
        const buffer = isAccent ? this.customAccentBuffer : this.customBeatBuffer;
        if (buffer) {
          const source = this.audioCtx.createBufferSource();
          source.buffer = buffer;
          source.connect(masterGain);
          source.start(time);
        } else {
          // Fallback to digital if no custom sound set
          this.playDigital(isAccent, time, masterGain);
        }
        break;
      }
      case SoundProfile.METALLIC: {
        const osc1 = this.audioCtx.createOscillator();
        const osc2 = this.audioCtx.createOscillator();
        const env = this.audioCtx.createGain();
        osc1.type = 'sine';
        osc2.type = 'sine';
        if (isAccent) {
          osc1.frequency.setValueAtTime(2000, time);
          osc2.frequency.setValueAtTime(3200, time);
          env.gain.setValueAtTime(0.6, time);
          env.gain.exponentialRampToValueAtTime(0.001, time + 0.3);
        } else {
          osc1.frequency.setValueAtTime(1500, time);
          osc2.frequency.setValueAtTime(2400, time);
          env.gain.setValueAtTime(0.3, time);
          env.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
        }
        osc1.connect(env);
        osc2.connect(env);
        env.connect(masterGain);
        osc1.start(time);
        osc2.start(time);
        osc1.stop(time + 0.4);
        osc2.stop(time + 0.4);
        break;
      }
      case SoundProfile.WOOD: {
        const osc = this.audioCtx.createOscillator();
        const env = this.audioCtx.createGain();
        const filter = this.audioCtx.createBiquadFilter();
        osc.type = 'triangle';
        const freq = isAccent ? 1000 : 700;
        osc.frequency.setValueAtTime(freq, time);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.5, time + 0.03);
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2000, time);
        env.gain.setValueAtTime(0.8, time);
        env.gain.exponentialRampToValueAtTime(0.001, time + 0.06);
        const noise = this.audioCtx.createBufferSource();
        noise.buffer = this.createNoiseBuffer();
        const noiseGain = this.audioCtx.createGain();
        noiseGain.gain.setValueAtTime(0.4, time);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.01);
        osc.connect(filter);
        filter.connect(env);
        env.connect(masterGain);
        noise.connect(noiseGain);
        noiseGain.connect(masterGain);
        osc.start(time);
        osc.stop(time + 0.1);
        noise.start(time);
        break;
      }
      case SoundProfile.DIGITAL:
      default: {
        this.playDigital(isAccent, time, masterGain);
        break;
      }
    }

    if (this.onBeat) {
      const delay = (time - this.audioCtx.currentTime) * 1000;
      setTimeout(() => this.onBeat!(beatNumber), Math.max(0, delay));
    }
  }

  private playDigital(isAccent: boolean, time: number, masterGain: GainNode) {
    if (!this.audioCtx) return;
    const osc = this.audioCtx.createOscillator();
    const env = this.audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(isAccent ? 1000 : 600, time);
    env.gain.setValueAtTime(0.5, time);
    env.gain.exponentialRampToValueAtTime(0.001, time + 0.08);
    osc.connect(env);
    env.connect(masterGain);
    osc.start(time);
    osc.stop(time + 0.1);
  }

  private scheduler() {
    if (!this.audioCtx) return;
    while (this.nextNoteTime < this.audioCtx.currentTime + this.scheduleAheadTime) {
      this.scheduleNote(this.currentBeat, this.nextNoteTime);
      this.nextNote();
    }
    this.timerID = window.setTimeout(() => this.scheduler(), this.lookahead);
  }

  private nextNote() {
    const secondsPerBeat = 60.0 / this.bpm;
    this.nextNoteTime += secondsPerBeat;
    this.currentBeat++;
  }

  public start() {
    this.initAudio();
    this.currentBeat = 0;
    this.nextNoteTime = this.audioCtx!.currentTime + 0.05;
    this.scheduler();
  }

  public stop() {
    if (this.timerID) {
      window.clearTimeout(this.timerID);
      this.timerID = null;
    }
    this.currentBeat = 0;
  }
}
