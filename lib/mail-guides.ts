import { LONG } from './longform';
import { KB } from './kb';
import { articleLangs } from './article-langs';
import { pick, qOf, type Lang } from './tr';
import type { Guide } from './mail-more';

/** This month's guides: the articles written in this language, taking turns month by month. */
export function monthGuides(lang: Lang, origin = 'https://inkage.app'): { main: Guide; more: Guide[] } | null {
  const list = LONG.filter((a) => articleLangs(a.slug).includes(lang));
  if (!list.length) return null;
  const now = new Date();
  const start = (now.getUTCFullYear() * 12 + now.getUTCMonth()) % list.length;
  const at = (i: number): Guide => {
    const a = list[(start + i) % list.length];
    const img = KB[a.slug]?.img;
    return { title: pick(a.title, lang), desc: pick(a.desc, lang), href: `${origin}/tudastar/${a.slug}${qOf(lang)}`, image: img ? `${origin}/api/mail-img/${img}` : null };
  };
  return { main: at(0), more: list.length > 2 ? [at(1), at(2)] : [] };
}
