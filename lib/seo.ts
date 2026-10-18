import { type Lang } from '@/lib/tr';
// Programmatic guide pages: "<style> tattoo on the <area> after 10, 30 and 50 years".
import { longevity, ScoreInput } from './score';

export const SEO_STYLES = [
  { k: 'fine-line', en: 'Fine line', hu: 'Fine line (vékony vonalas)', style: 'fine-line', detail: 0.75 },
  { k: 'blackwork', en: 'Blackwork', hu: 'Blackwork', style: 'blackwork', detail: 0.3 },
  { k: 'traditional', en: 'Traditional', hu: 'Tradicionális', style: 'traditional', detail: 0.35 },
  { k: 'color', en: 'Colour', hu: 'Színes', style: 'color', detail: 0.5 },
  { k: 'realism', en: 'Realism', hu: 'Realista', style: 'realism', detail: 0.6 },
] as const;

export const SEO_AREAS = [
  { k: 'forearm', en: 'forearm', hu: 'alkar', v: 'Inner forearm' },
  { k: 'wrist', en: 'wrist', hu: 'csukló', v: 'Wrist' },
  { k: 'upper-arm', en: 'upper arm', hu: 'felkar', v: 'Upper arm' },
  { k: 'shoulder', en: 'shoulder', hu: 'váll', v: 'Shoulder' },
  { k: 'back', en: 'back', hu: 'hát', v: 'Upper back' },
  { k: 'ribs', en: 'ribs', hu: 'borda', v: 'Ribs' },
  { k: 'ankle', en: 'ankle', hu: 'boka', v: 'Ankle' },
  { k: 'hand', en: 'hand', hu: 'kézfej', v: 'Hand' },
  { k: 'finger', en: 'finger', hu: 'ujj', v: 'Finger' },
  { k: 'neck', en: 'neck', hu: 'nyak', v: 'Neck' },
] as const;

export const seoSlugs = () => SEO_STYLES.flatMap((s) => SEO_AREAS.map((a) => `${s.k}-${a.k}`));

export function seoPage(slug: string, lang: Lang) {
  const s = SEO_STYLES.find((x) => slug.startsWith(x.k + '-'));
  const a = s && SEO_AREAS.find((x) => slug === `${s.k}-${x.k}`);
  if (!s || !a) return null;
  const base: ScoreInput = { style: s.style, hasColor: s.style === 'color' || s.style === 'realism', sun: 'medium', placement: a.v, sizeCm: 8, detail: s.detail, age: 28 };
  const at = (cm: number) => longevity({ ...base, sizeCm: cm }, lang).score;
  const report = longevity(base, lang);
  const sunny = longevity({ ...base, sun: 'high' }, lang).score;
  return { s, a, report, small: at(4), medium: report.score, large: at(14), sunny };
}
