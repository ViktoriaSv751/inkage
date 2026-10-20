import type { StageKey } from '@/lib/store';

/** One sentence per stage: what changes and why. */
export const WHY: Record<StageKey, [string, string]> = {
  fresh: ['Fresh: lines are slightly raised and shiny; the redness settles within days.', 'Friss: a vonalak kicsit kiemelkednek és fényesek, a pirosság pár nap alatt elmúlik.'],
  healed: ['1 year: fully healed — the ink has settled a touch deeper, lines look a little softer.', '1 év: teljesen begyógyult – a tinta kicsit mélyebbre ült, a vonalak picit lágyabbak.'],
  y10: ['10 years: ink spreads about 0.1 mm; the finest details lose their edge, sun fades colours first.', '10 év: a tinta kb. 0,1 mm-t terül; a legfinomabb részletek élessége csökken, a nap először a színeket fakítja.'],
  y30: ['30 years: black shifts towards blue-grey and lines closer than ~1 mm start to merge.', '30 év: a fekete kékesszürke felé tolódik, és a kb. 1 mm-nél közelebbi vonalak összeérnek.'],
  y50: ['50 years: thinner, looser skin carries a softer, wider design — bold lines still read clearly.', '50 év: a vékonyabb, lazább bőrön a minta lágyabb és szélesebb – a vastag vonalak még jól olvashatók.'],
};

/** The same design scored on a few other body areas. */
export const OTHER_SPOTS: [string, string, string][] = [
  ['Inner forearm', 'on the forearm', 'alkaron'],
  ['Upper arm', 'on the upper arm', 'felkaron'],
  ['Upper back', 'on the back', 'háton'],
  ['Ribs', 'on the ribs', 'bordán'],
  ['Ankle', 'on the ankle', 'bokán'],
  ['Hand', 'on the hand', 'kézfejen'],
  ['Finger', 'on a finger', 'ujjon'],
];

export const REDO_REASONS = [
  ['clothes', 'It went onto clothes or the background', 'Ruhára vagy a háttérre került'],
  ['design', 'It’s not my design / details changed', 'Nem az én mintám / változtak a részletek'],
  ['place', 'Wrong place or size', 'Rossz helyen vagy rossz méretben van'],
  ['anatomy', 'Hand or body looks distorted', 'Torz a kéz vagy a test'],
  ['fake', 'Looks fake, like a sticker', 'Nem élethű, matricának tűnik'],
] as const;
export const YEARS: Record<StageKey, number> = { fresh: 0, healed: 1, y10: 10, y30: 30, y50: 50 };
