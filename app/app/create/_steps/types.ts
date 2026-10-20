import type { Placement } from '@/lib/editor';
import type { Found } from '../Picker';

export type Photo = { dataUrl: string; w: number; h: number };
export type Layer = { design: Design; pl: Placement };

export type Design = {
  raw: string;
  ink: string;
  ratio: number;
  detail: number;
  mode: 'black' | 'color';
  libId?: string;
  /** the (cropped) photo, when the tattoo was cut out of it */
  original?: string;
  /** how faithful the cut-out is to the photo, 0-10 (-1 unknown) */
  match?: number;
};
/** The detected bare-skin area of the chosen body part: [top, left, bottom, right] as fractions of the photo. */
export type Area = { box: [number, number, number, number]; angle: number };
export type { Skin } from '@/lib/editor';

export type CheckState = { state: 'idle' | 'checking' | 'ok' | 'warn' | 'blocked'; msg?: string };

/** The last uploaded picture and what the AI found in it, so "another tattoo from it" works. */
export type TattooPick = { image: string; found: Found; open: boolean };
