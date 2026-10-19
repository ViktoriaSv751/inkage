import type { MetadataRoute } from 'next';
import { ARTICLES } from '@/lib/articles';
import { seoSlugs } from '@/lib/seo';
import { LANGS, qOf, htmlLang } from '@/lib/tr';

const BASE = process.env.NEXT_PUBLIC_SITE_URL || 'https://inkage.app';

export default function sitemap(): MetadataRoute.Sitemap {
  // every page in every language (?lang=…), each listing its translations
  const withLangs = (list: MetadataRoute.Sitemap): MetadataRoute.Sitemap =>
    list.flatMap((e) => {
      const languages = Object.fromEntries(LANGS.map((l) => [htmlLang(l), `${e.url}${qOf(l)}`]));
      return LANGS.map((l) => ({ ...e, url: `${e.url}${qOf(l)}`, alternates: { languages } }));
    });
  return withLangs([
    { url: `${BASE}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE}/app`, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${BASE}/tudastar`, changeFrequency: 'weekly', priority: 0.8 },
    ...ARTICLES.map((a) => ({ url: `${BASE}/tudastar/${a.slug}`, changeFrequency: 'monthly' as const, priority: 0.6 })),
    ...seoSlugs().map((slug) => ({ url: `${BASE}/tattoo/${slug}`, changeFrequency: 'monthly' as const, priority: 0.5 })),
    ...['hogyan-mukodik', 'funkciok', 'gyik', 'rolunk', 'kapcsolat', 'adatbiztonsag', 'fiok-torlese', 'suti', 'mi-az-inkage', 'ingyenes-beta', 'telepites', 'jog'].map((p) => ({ url: `${BASE}/${p}`, changeFrequency: 'monthly' as const, priority: 0.5 })),
    { url: `${BASE}/terms`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${BASE}/privacy`, changeFrequency: 'yearly', priority: 0.2 },
  ]);
}
