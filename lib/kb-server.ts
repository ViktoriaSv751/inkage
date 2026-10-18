import { pick } from '@/lib/tr';
import { type Lang } from '@/lib/tr';
// Server-only helpers that need the full long-form texts (kept out of client bundles).
import { Article, ARTICLES } from './articles';
import { longArticle, words } from './longform';
import { IMG, KB, KB_STILL } from './kb';

/** Reading time in minutes for the long-form article (≈150 words/min HU, 170 EN — calm, careful reading). */
export function readMin(a: Pick<Article, 'slug'>, lang: Lang) {
  const l = longArticle(a.slug);
  if (!l) return 5;
  return Math.max(2, Math.round(words(l, lang) / (lang === 'hu' ? 150 : 170)));
}

export type KbItem = {
  slug: string;
  cat: string;
  title: string;
  desc: string;
  img: string;
  date: string;
  min: number;
};
export function kbList(lang: Lang): KbItem[] {
  return ARTICLES.map((a) => ({
    slug: a.slug,
    cat: pick(a.tag, lang),
    title: pick(a.title, lang),
    desc: pick(a.desc, lang),
    img: IMG(KB[a.slug]?.img || KB_STILL, 1200),
    date: KB[a.slug]?.date || '2026-10-12',
    min: readMin(a, lang),
  }));
}

