import '@/lib/tr-server';
import { LANGS, hasExact, type Lang } from './tr';
import { ARTICLES } from './articles';

/** The languages a knowledge-base article is actually written in: Hungarian, English and every language whose
    dictionary has its title. The others would show the English text, so they stay out of hreflang and the index. */
export function articleLangs(slug: string): Lang[] {
  const a = ARTICLES.find((x) => x.slug === slug);
  return a ? LANGS.filter((l) => hasExact(l, a.title.en)) : [...LANGS];
}
