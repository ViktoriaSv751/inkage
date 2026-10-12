export const PLACEMENTS = [
  { v: 'Inner forearm', en: 'Forearm', hu: 'Alkar' },
  { v: 'Wrist', en: 'Wrist', hu: 'Csukló' },
  { v: 'Hand', en: 'Hand', hu: 'Kézfej' },
  { v: 'Finger', en: 'Finger', hu: 'Ujj' },
  { v: 'Upper arm', en: 'Upper arm', hu: 'Felkar' },
  { v: 'Shoulder', en: 'Shoulder', hu: 'Váll' },
  { v: 'Collarbone', en: 'Collarbone', hu: 'Kulcscsont' },
  { v: 'Chest', en: 'Chest', hu: 'Mellkas' },
  { v: 'Upper back', en: 'Back', hu: 'Hát' },
  { v: 'Ribs', en: 'Ribs', hu: 'Borda' },
  { v: 'Hip', en: 'Hip', hu: 'Csípő' },
  { v: 'Thigh', en: 'Thigh', hu: 'Comb' },
  { v: 'Calf', en: 'Calf', hu: 'Vádli' },
  { v: 'Ankle', en: 'Ankle', hu: 'Boka' },
  { v: 'Back of neck', en: 'Neck', hu: 'Nyak' },
];

/** Display name of a stored placement value in the current language. */
export const placeName = (v: string, lang: 'en' | 'hu') => {
  const p = PLACEMENTS.find((x) => x.v === v);
  return p ? (lang === 'hu' ? p.hu : p.en) : v;
};
