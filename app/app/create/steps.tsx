'use client';
// The create flow's steps. The code lives in ./_steps; this file keeps the public import path.

export type { Photo, Layer, Design, Area, Skin } from './_steps/types';
export { fitToArea, overflows } from './_steps/geometry';
export { PLACEMENTS, placeName } from '@/lib/placements';
export { PlacementPicker } from './_steps/PlacementPicker';
export { StudioStep } from './_steps/studio/StudioStep';
export { PlaceStep } from './_steps/place/PlaceStep';
