export const STAGES = ['healed', 'y10', 'y30', 'y50'] as const;
export type Stage = (typeof STAGES)[number];
/** Laser removal preview after N sessions. */
export const REMOVAL = ['laser3', 'laser6', 'laser10'] as const;
export type RemovalStage = (typeof REMOVAL)[number];
export const STAGE_YEARS: Record<Stage, number> = { healed: 1, y10: 10, y30: 30, y50: 50 };

export type Img = { buf: Buffer; mime: string; name: string };

/** What the AI sees in the photo; drives person-specific aging. */
export type Analysis = {
  apparentAge: number;
  skinTone: string; // e.g. "light olive, Fitzpatrick III"
  bodyArea: string; // where the tattoo actually landed
  tattooStyle: 'fine-line' | 'blackwork' | 'color' | 'realism' | 'traditional' | 'other';
  hasColor: boolean;
  sunExposure: 'low' | 'medium' | 'high';
};

export const DEFAULT_ANALYSIS: Analysis = {
  apparentAge: 28,
  skinTone: 'medium skin tone',
  bodyArea: 'forearm',
  tattooStyle: 'other',
  hasColor: false,
  sunExposure: 'medium',
};
