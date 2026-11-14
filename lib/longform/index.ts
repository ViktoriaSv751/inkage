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
import a44 from './fine-line-script-tattoos';
import a45 from './infected-tattoo-signs';
import a46 from './japanese-tattoos';
import a47 from './tattoos-blood-donation-mri';
import a48 from './raised-tattoo';
import a49 from './minimalist-tattoos';
import a50 from './ankle-tattoos';
import a51 from './watercolour-tattoos';
import a52 from './behind-the-ear-tattoos';
import a53 from './neo-traditional-tattoos';
import a54 from './dotwork-geometric-tattoos';
import a55 from './white-and-uv-ink-tattoos';
import a56 from './tattoo-age-limit';
import a57 from './what-to-avoid-after-a-tattoo';
import a58 from './second-skin-tattoo-film';
import a59 from './couple-and-name-tattoos';
import a60 from './knee-and-elbow-tattoos';
import a61 from './tattoos-at-work';
import a62 from './tribal-tattoos';
import a63 from './stick-and-poke-tattoos';
import a64 from './regret-new-tattoo';
import a65 from './spine-tattoos';
import a66 from './chest-tattoos';

export type { LongArticle } from './types';
const ALL: LongArticle[] = [a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16, a17, a18, a19, a20, a21, a22, a23, a24, a25, a26, a27, a28, a29, a30, a31, a32, a33, a34, a35, a36, a37, a38, a39, a40, a41, a42, a43, a44, a45, a46, a47, a48, a49, a50, a51, a52, a53, a54, a55, a56, a57, a58, a59, a60, a61, a62, a63, a64, a65, a66];
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
