// All long-form knowledge base articles, keyed by slug. Server-side only (large).
import type { LongArticle } from './types';
import a1 from './how-tattoos-age';
import a2 from './fine-line-tattoos-aging';
import a3 from './best-placement-for-tattoo-longevity';
import a4 from './tattoo-aftercare-sun-protection';
import a5 from './tattoo-size-guide';
import a6 from './color-vs-black-ink-aging';
import a7 from './laser-tattoo-removal-what-to-expect';
import a8 from './tattoo-touch-ups';
import a9 from './tattoos-on-darker-skin';
import a10 from './hand-and-finger-tattoos';
import a11 from './first-tattoo-checklist';
import a12 from './tattoos-weight-change-pregnancy';

export type { LongArticle } from './types';
export const LONG: LongArticle[] = [a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12];
export const longArticle = (slug: string) => LONG.find((a) => a.slug === slug);

/** Words in the body (markup stripped). */
export function words(a: LongArticle, lang: 'en' | 'hu') {
  return a.body[lang]
    .filter((p) => !p.startsWith('[['))
    .join(' ')
    .replace(/^(#+ |- |\d+\. |> |!! )/gm, '')
    .replace(/\*\*/g, '')
    .split(/\s+/)
    .filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}
