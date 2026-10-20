import type { StageKey } from '@/lib/store';

export const AGE_STAGES: StageKey[] = ['healed', 'y10', 'y30', 'y50'];

// Aging runs as a chain so every stage continues from the previous one (same pose, same changes):
// fresh → 1 year and fresh → 10 years in parallel, then 10 → 30 → 50.
export const PARENT: Partial<Record<StageKey, StageKey>> = { healed: 'fresh', y10: 'fresh', y30: 'y10', y50: 'y30' };

export const FACTS = {
  en: [
    '<b>Ink spreads</b> about 0.1 mm a decade as your body slowly carries pigment away.',
    '<b>Black ink</b> lasts longest. Yellows and pastels fade first.',
    '<b>Sun</b> is the #1 reason tattoos fade. SPF 50 makes a real difference.',
    '<b>Fine lines</b> closer than 1 mm usually merge within 10–15 years.',
  ],
  hu: [
    '<b>A tinta szétterül</b> – évtizedenként kb. 0,1 mm-t, ahogy a szervezet lassan elszállítja a pigmentet.',
    '<b>A fekete tinta</b> tart a legtovább. A sárga és a pasztell fakul először.',
    '<b>A nap</b> az első számú oka a fakulásnak. Az 50-es fényvédő tényleg sokat számít.',
    '<b>Az 1 mm-nél közelebbi vékony vonalak</b> 10–15 éven belül általában összefolynak.',
  ],
};
