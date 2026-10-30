import type { MetadataRoute } from 'next';
import { ARTICLES } from '@/lib/articles';
import { seoSlugs } from '@/lib/seo';
import { LANGS, qOf, htmlLang, type Lang } from '@/lib/tr';
import { articleLangs } from '@/lib/article-langs';

const BASE = process.env.NEXT_PUBLIC_SITE_URL || 'https://inkage.app';
// when the fixed pages and articles last really changed (a date that moves on every build teaches Google to ignore it)
const CONTENT_DATE = '2026-10-30';

export default function sitemap(): MetadataRoute.Sitemap {
  // every page in every language (?lang=…), each listing its translations
  // (an article only in the languages it is translated into, see lib/article-langs.ts)
  const withLangs = (list: (MetadataRoute.Sitemap[number] & { langs?: readonly Lang[] })[]): MetadataRoute.Sitemap =>
    list.flatMap(({ langs = LANGS, ...e }) => {
      const languages = { ...Object.fromEntries(langs.map((l) => [htmlLang(l), `${e.url}${qOf(l)}`])), 'x-default': e.url };
      return langs.map((l) => ({ ...e, lastModified: CONTENT_DATE, url: `${e.url}${qOf(l)}`, alternates: { languages } }));
    });
  return withLangs([
    { url: `${BASE}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE}/app`, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${BASE}/tudastar`, changeFrequency: 'weekly', priority: 0.8 },
    ...ARTICLES.map((a) => ({ url: `${BASE}/tudastar/${a.slug}`, changeFrequency: 'monthly' as const, priority: 0.6, langs: articleLangs(a.slug) })),
    ...seoSlugs().map((slug) => ({ url: `${BASE}/tattoo/${slug}`, changeFrequency: 'monthly' as const, priority: 0.5 })),
    ...['hogyan-mukodik', 'funkciok', 'gyik', 'rolunk', 'kapcsolat', 'adatbiztonsag', 'fiok-torlese', 'suti', 'mi-az-inkage', 'ingyenes-beta', 'telepites', 'jog'].map((p) => ({ url: `${BASE}/${p}`, changeFrequency: 'monthly' as const, priority: 0.5 })),
    { url: `${BASE}/terms`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${BASE}/privacy`, changeFrequency: 'yearly', priority: 0.2 },
  ]);
}
