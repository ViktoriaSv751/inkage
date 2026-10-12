export type PlacementDef = { v: string; en: string; hu: string; view: 'front' | 'back'; x: number; y: number };

/**
 * Body areas, numbered top to bottom (front first, then back), with where each sits on the
 * body-map figure (viewBox 0 0 200 440). `v` is the stable value sent to the AI.
 */
export const PLACEMENTS: PlacementDef[] = [
  { v: 'Behind the ear', en: 'Behind ear', hu: 'Fül mögött', view: 'front', x: 116, y: 36 },
  { v: 'Side of neck', en: 'Side of neck', hu: 'Nyak oldala', view: 'front', x: 109, y: 61 },
  { v: 'Collarbone', en: 'Collarbone', hu: 'Kulcscsont', view: 'front', x: 120, y: 82 },
  { v: 'Shoulder', en: 'Shoulder', hu: 'Váll', view: 'front', x: 62, y: 86 },
  { v: 'Chest', en: 'Chest', hu: 'Mellkas', view: 'front', x: 82, y: 108 },
  { v: 'Sternum', en: 'Sternum', hu: 'Szegycsont', view: 'front', x: 103, y: 122 },
  { v: 'Upper arm', en: 'Upper arm', hu: 'Felkar', view: 'front', x: 47, y: 118 },
  { v: 'Elbow', en: 'Elbow', hu: 'Könyök', view: 'front', x: 156, y: 140 },
  { v: 'Inner forearm', en: 'Forearm', hu: 'Alkar', view: 'front', x: 41, y: 160 },
  { v: 'Outer forearm', en: 'Outer forearm', hu: 'Külső alkar', view: 'front', x: 161, y: 170 },
  { v: 'Wrist', en: 'Wrist', hu: 'Csukló', view: 'front', x: 34, y: 201 },
  { v: 'Hand', en: 'Hand', hu: 'Kézfej', view: 'front', x: 30, y: 226 },
  { v: 'Finger', en: 'Finger', hu: 'Ujj', view: 'front', x: 169, y: 247 },
  { v: 'Ribs', en: 'Ribs', hu: 'Borda', view: 'front', x: 127, y: 146 },
  { v: 'Stomach', en: 'Stomach', hu: 'Has', view: 'front', x: 100, y: 170 },
  { v: 'Hip', en: 'Hip', hu: 'Csípő', view: 'front', x: 127, y: 203 },
  { v: 'Thigh', en: 'Thigh', hu: 'Comb', view: 'front', x: 82, y: 256 },
  { v: 'Knee', en: 'Knee', hu: 'Térd', view: 'front', x: 117, y: 318 },
  { v: 'Shin', en: 'Shin', hu: 'Sípcsont', view: 'front', x: 84, y: 364 },
  { v: 'Ankle', en: 'Ankle', hu: 'Boka', view: 'front', x: 115, y: 410 },
  { v: 'Foot', en: 'Foot', hu: 'Lábfej', view: 'front', x: 86, y: 426 },
  { v: 'Back of neck', en: 'Back of neck', hu: 'Tarkó', view: 'back', x: 100, y: 62 },
  { v: 'Shoulder blade', en: 'Shoulder blade', hu: 'Lapocka', view: 'back', x: 122, y: 106 },
  { v: 'Upper back', en: 'Upper back', hu: 'Felső hát', view: 'back', x: 100, y: 96 },
  { v: 'Back of upper arm', en: 'Back of arm', hu: 'Felkar hátsó', view: 'back', x: 46, y: 124 },
  { v: 'Spine', en: 'Spine', hu: 'Gerinc', view: 'back', x: 100, y: 150 },
  { v: 'Lower back', en: 'Lower back', hu: 'Derék', view: 'back', x: 100, y: 194 },
  { v: 'Back of thigh', en: 'Back of thigh', hu: 'Comb hátsó', view: 'back', x: 84, y: 262 },
  { v: 'Calf', en: 'Calf', hu: 'Vádli', view: 'back', x: 84, y: 350 },
];

/** A spot the user marked themselves: "@front:62,140|left side of the stomach". */
export type CustomSpot = { view: 'front' | 'back'; x: number; y: number; label: string };
export const isCustom = (v: string) => v.startsWith('@');
export function parseCustom(v: string): CustomSpot | null {
  const m = /^@(front|back):(\d+(?:\.\d+)?),(\d+(?:\.\d+)?)\|(.*)$/.exec(v);
  return m ? { view: m[1] as 'front' | 'back', x: Number(m[2]), y: Number(m[3]), label: m[4] } : null;
}
export const makeCustom = (c: CustomSpot) => `@${c.view}:${Math.round(c.x)},${Math.round(c.y)}|${c.label}`;

/** The closest numbered area to a point on the figure. */
export function nearest(view: 'front' | 'back', x: number, y: number) {
  return PLACEMENTS.filter((p) => p.view === view).reduce((best, p) => (Math.hypot(p.x - x, p.y - y) < Math.hypot(best.x - x, best.y - y) ? p : best));
}

/** Display name of a stored placement value in the current language. */
export const placeName = (v: string, lang: 'en' | 'hu') => {
  const c = parseCustom(v);
  if (c) return c.label;
  const p = PLACEMENTS.find((x) => x.v === v);
  return p ? (lang === 'hu' ? p.hu : p.en) : v;
};

/** What the AI is told: custom spots keep the user's own words. */
export const aiPlacement = (v: string) => {
  const c = parseCustom(v);
  if (!c) return v;
  const n = nearest(c.view, c.x, c.y);
  return `${c.label} (exact spot chosen by the user, near the ${n.v.toLowerCase()}${c.view === 'back' ? ', back of the body' : ''})`;
};
