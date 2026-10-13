// Ink Longevity Score: a transparent 0–100 estimate of how well a tattoo will hold up.
// Based on widely shared tattoo-artist rules of thumb, not a medical prediction.

export type ScoreInput = {
  style: 'fine-line' | 'blackwork' | 'color' | 'realism' | 'traditional' | 'other';
  hasColor: boolean;
  sun: 'low' | 'medium' | 'high';
  placement: string; // free text, matched against known areas
  sizeCm: number | null; // approximate width
  detail: number | null; // 0..1, how much fine detail the design has (from the client)
  age: number | null;
};

type Lang = 'en' | 'hu';
const L = (lang: Lang, en: string, hu: string) => (lang === 'hu' ? hu : en);

const AREAS: { re: RegExp; friction: number; sun: number; en: string; hu: string }[] = [
  { re: /finger|ujj/i, friction: 22, sun: 6, en: 'Fingers fade fastest (constant friction and washing)', hu: 'Az ujjakon fakul a leggyorsabban (súrlódás, kézmosás)' },
  { re: /hand|kéz|palm|tenyér/i, friction: 16, sun: 8, en: 'Hands get daily friction and sun', hu: 'A kézfej naponta kap súrlódást és napot' },
  { re: /foot|feet|láb(fej|fejen)|ankle|boka/i, friction: 12, sun: 4, en: 'Feet and ankles rub against shoes and socks', hu: 'A lábfej és boka a cipőhöz, zoknihoz dörzsölődik' },
  { re: /wrist|csukló/i, friction: 8, sun: 6, en: 'Wrists bend and rub against watches and sleeves', hu: 'A csukló sokat hajlik, óra és ruhaujj dörzsöli' },
  { re: /elbow|könyök|knee|térd/i, friction: 10, sun: 4, en: 'Joints stretch and crease a lot', hu: 'Az ízületeknél sokat nyúlik és gyűrődik a bőr' },
  { re: /outer forearm|külső alkar/i, friction: 4, sun: 8, en: 'The outer forearm sees a lot of sun', hu: 'A külső alkar sok napot kap' },
  { re: /forearm|alkar/i, friction: 3, sun: 4, en: 'Forearms are a solid, stable spot', hu: 'Az alkar stabil, jó hely' },
  { re: /neck|nyak/i, friction: 5, sun: 7, en: 'The neck is often sun-exposed', hu: 'A nyakat gyakran éri nap' },
  { re: /rib|borda|back|hát|spine|gerinc|thigh|comb|upper arm|felkar|shoulder|váll|hip|csípő/i, friction: 1, sun: 1, en: 'A protected area with little friction or sun', hu: 'Védett terület, kevés súrlódás és nap' },
];

export function longevity(input: ScoreInput, lang: Lang = 'en') {
  let score = 92;
  const factors: { label: string; impact: number }[] = [];
  const add = (impact: number, label: string) => {
    if (!impact) return;
    score += impact;
    factors.push({ label, impact });
  };

  // style
  if (input.style === 'fine-line') add(-14, L(lang, 'Fine single-needle lines spread and blur over time', 'A vékony, egytűs vonalak idővel szétterülnek'));
  else if (input.style === 'realism') add(-10, L(lang, 'Soft realism shading loses contrast with age', 'A realista árnyalás idővel elveszíti a kontrasztját'));
  else if (input.style === 'blackwork' || input.style === 'traditional') add(+4, L(lang, 'Bold black lines are the most durable style', 'A vastag fekete vonalak a legtartósabbak'));
  if (input.hasColor || input.style === 'color') add(-7, L(lang, 'Colors (especially light ones) fade faster than black', 'A színek (főleg a világosak) gyorsabban fakulnak a feketénél'));

  // size × detail
  const size = input.sizeCm;
  const detail = input.detail ?? 0.4;
  if (size !== null) {
    if (size < 4) add(-14 - Math.round(detail * 8), L(lang, `Very small (≈${size.toFixed(0)} cm): details will merge`, `Nagyon kicsi (≈${size.toFixed(0)} cm): a részletek összefolynak`));
    else if (size < 7) add(-6 - Math.round(detail * 6), L(lang, `Small (≈${size.toFixed(0)} cm) for its level of detail`, `Kicsi (≈${size.toFixed(0)} cm) ennyi részlethez`));
    else if (size > 12) add(+4, L(lang, 'Generous size leaves room for lines to settle', 'A nagyobb méret helyet hagy a vonalak terülésének'));
  } else if (detail > 0.6) add(-6, L(lang, 'Lots of fine detail packed together', 'Sok apró részlet egymás közelében'));

  // area
  const area = AREAS.find((a) => a.re.test(input.placement));
  if (area) add(-(area.friction + area.sun) + 4, L(lang, area.en, area.hu));

  // sun habits
  if (input.sun === 'high') add(-8, L(lang, 'Frequent sun exposure fades ink', 'A gyakori napozás fakítja a tintát'));
  if (input.sun === 'low') add(+3, L(lang, 'Little sun exposure keeps ink darker', 'A kevés nap sötétebben tartja a tintát'));

  // age
  if (input.age && input.age >= 50) add(-4, L(lang, 'Thinner, older skin holds fine lines less crisply', 'Az idősebb, vékonyabb bőr kevésbé tartja élesen a vonalakat'));

  score = Math.max(18, Math.min(98, Math.round(score)));

  const suggestions: string[] = [];
  if (size !== null && size < 7) suggestions.push(L(lang, `Go about ${Math.ceil(Math.max(7, size * 1.4))} cm wide so the lines have room to age.`, `Válassz kb. ${Math.ceil(Math.max(7, size * 1.4))} cm-es szélességet, hogy a vonalaknak legyen helyük.`));
  if (input.style === 'fine-line') suggestions.push(L(lang, 'Ask your artist for slightly thicker key lines (a 3RL instead of a single needle).', 'Kérj a fő vonalakhoz kicsit vastagabb tűt (3RL az egytűs helyett).'));
  if (area && area.friction + area.sun >= 12) suggestions.push(L(lang, 'Consider the inner forearm, upper arm or back for a longer-lasting result.', 'Fontold meg a belső alkart, felkart vagy hátat a tartósabb eredményért.'));
  if (input.hasColor) suggestions.push(L(lang, 'Outline colored areas in black so the shape stays readable as colors fade.', 'Keretezd feketével a színes részeket, hogy fakulás után is olvasható maradjon.'));
  if (!suggestions.length) suggestions.push(L(lang, 'This is a strong choice — protect it from the sun and it will age well.', 'Ez jó választás – védd a naptól, és szépen fog öregedni.'));

  const tips = [
    L(lang, 'Use SPF 50 on the tattoo whenever it sees the sun.', 'Napon mindig használj 50-es fényvédőt a tetoválásra.'),
    L(lang, 'Moisturise daily; hydrated skin keeps ink looking sharper.', 'Hidratáld naponta: a jól hidratált bőrön élesebb a tinta.'),
    L(lang, 'A touch-up every 8–10 years brings back crisp lines.', '8–10 évente egy frissítés visszahozza az éles vonalakat.'),
  ];

  return { score, factors: factors.sort((a, b) => a.impact - b.impact), suggestions, tips };
}

/** Rough physical width of the visible frame for common shots, used to estimate cm from the editor. */
export function frameCm(placement: string) {
  if (/finger|ujj|ear|fül/i.test(placement)) return 9;
  if (/wrist|csukló|hand|kéz|ankle|boka|foot|lábfej/i.test(placement)) return 16;
  if (/forearm|alkar|neck|nyak|tarkó|calf|vádli|shin|sípcsont|elbow|könyök|knee|térd/i.test(placement)) return 24;
  if (/upper arm|felkar|shoulder|váll|collar|kulcscsont/i.test(placement)) return 30;
  if (/back|hát|rib|borda|thigh|comb|spine|gerinc|hip|csípő|stomach|has|sternum|szegy|chest|mellkas|derék|lapocka|blade/i.test(placement)) return 40;
  return 26;
}


/** Typical width (cm) across the limb / body part, as seen from the front. */
export function limbCm(placement: string): number | null {
  if (/finger|ujj/i.test(placement)) return 2;
  if (/wrist|csukló/i.test(placement)) return 6;
  if (/ankle|boka/i.test(placement)) return 7;
  if (/hand|kéz|foot|lábfej/i.test(placement)) return 8.5;
  if (/forearm|alkar/i.test(placement)) return 7.5;
  if (/elbow|könyök|shin|sípcsont/i.test(placement)) return 9;
  if (/upper arm|felkar/i.test(placement)) return 10;
  if (/neck|nyak|tarkó|calf|vádli|knee|térd/i.test(placement)) return 11;
  if (/thigh|comb/i.test(placement)) return 16;
  return null; // torso: the detected box says little about real size
}

/**
 * How many cm the full photo width covers. With the detected body part we measure it
 * (limb width in the photo vs. typical real width); otherwise a per-area average.
 */
export function photoCm(placement: string, area: { box: [number, number, number, number]; angle?: number } | null | undefined, photo: { w: number; h: number }) {
  const avg = frameCm(placement);
  const limb = limbCm(placement);
  if (!area || !limb) return avg;
  const [t, l, b, r] = area.box;
  // the limb's width is the narrower side of its box (in photo-width units)
  // a tilted limb's box is wider than the limb itself
  const tilt = Math.min(60, Math.abs(area.angle || 0));
  const across = Math.min(r - l, ((b - t) * photo.h) / photo.w) * (tilt > 12 ? Math.cos((tilt * Math.PI) / 180) * 0.85 : 1);
  if (across < 0.05) return avg;
  const est = limb / across;
  return Math.min(avg * 2.2, Math.max(avg * 0.35, est));
}
