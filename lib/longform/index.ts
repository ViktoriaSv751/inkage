import { pick } from '@/lib/tr';
import { isLive } from '@/lib/kb';
import { type Lang } from '@/lib/tr';
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
import a13 from './tattoo-pain-chart';
import a14 from './tattoo-before-and-after';
import a15 from './tattoos-that-age-well';
import a16 from './tattoos-when-you-get-old';
import a17 from './tattoo-blowout';
import a18 from './laser-removal-how-many-sessions';
import a19 from './laser-removal-before-after';
import a20 from './laser-removal-healing';
import a21 from './tattoo-healing-stages';
import a22 from './blackwork-tattoos-placement';
import a23 from './sunburned-tattoo';
import a24 from './cover-up-tattoos';
import a25 from './laser-tattoo-removal-summer';
import a26 from './tattoo-styles-guide';
import a27 from './realism-tattoos-aging';
import a28 from './american-traditional-tattoo-aging';
import a29 from './how-to-book-a-tattoo';
import a30 from './laser-tattoo-removal-cost';
import a31 from './tattoo-ink-safety-eu';
import a32 from './laser-tattoo-removal-pain';
import a33 from './colour-tattoo-removal';
import a34 from './tattoo-removal-creams-diy';
import a35 from './neck-tattoos';
import a36 from './rib-tattoos';
import a37 from './tattoo-itching-peeling';
import a38 from './how-much-does-a-tattoo-cost';
import a39 from './laser-removal-darker-skin';
import a40 from './first-tattoo-ideas';
import a41 from './laser-fading-before-cover-up';
import a42 from './eyebrow-pmu-removal';
import a43 from './tattoo-removal-pregnancy';

export type { LongArticle } from './types';
const ALL: LongArticle[] = [a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16, a17, a18, a19, a20, a21, a22, a23, a24, a25, a26, a27, a28, a29, a30, a31, a32, a33, a34, a35, a36, a37, a38, a39, a40, a41, a42, a43];
/** The articles that are out today (see isLive in lib/kb.ts). */
export const liveLong = () => ALL.filter((a) => isLive(a.slug));
export const longArticle = (slug: string) => liveLong().find((a) => a.slug === slug);

/** Words in the body (markup stripped). */
export function words(a: LongArticle, lang: Lang) {
  return pick(a.body, lang)
    .filter((p) => !p.startsWith('[['))
    .join(' ')
    .replace(/^(#+ |- |\d+\. |> |!! )/gm, '')
    .replace(/\*\*/g, '')
    .split(/\s+/)
    .filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}
