
export interface TimeSignature {
  beats: number;
  noteValue: number;
}

export enum SoundType {
  TICK = 'TICK',
  TOCK = 'TOCK'
}

export enum SoundProfile {
  DIGITAL = 'Digital',
  WOOD = 'Wood',
  METALLIC = 'Metallic',
  CUSTOM = 'Custom' // Base type, specific profiles handled via ID
}

export interface CustomSoundProfile {
  id: string;
  name: string;
  accent: string | null;
  beat: string | null;
  backgroundImage?: string | null;
  backgroundImageName?: string | null;
}
