import { liveArticles } from '@/lib/articles';
import { seoSlugs, TATTOO_LANGS } from '@/lib/seo';
import { LANGS, qOf, htmlLang, type Lang } from '@/lib/tr';
import { articleLangs } from '@/lib/article-langs';
import { TOOL_TITLE, toolLangs } from '@/lib/tool-pages';
import { KB } from '@/lib/kb';
import { SITE_URL } from '@/lib/site';

// when the fixed pages and articles last really changed (a date that moves on every build teaches Google to ignore it)
const CONTENT_DATE = '2026-10-30';

export type SitemapRow = { url: string; lastModified: string; changeFrequency: string; priority: number; languages: Record<string, string> };
type Entry = { url: string; changeFrequency: string; priority: number; langs?: readonly Lang[]; lastModified?: string };

/** Every page in every language it is written in (?lang=…), each listing its translations. */
function expand(list: Entry[]): SitemapRow[] {
  return list.flatMap(({ langs = LANGS, lastModified = CONTENT_DATE, ...e }) => {
    const languages = { ...Object.fromEntries(langs.map((l) => [htmlLang(l), `${e.url}${qOf(l)}`])), 'x-default': `${e.url}${qOf('hu')}` };
    return langs.map((l) => ({ ...e, lastModified, url: `${e.url}${qOf(l)}`, languages }));
  });
}

/** The sitemap groups, so Search Console shows indexing per page type. */
export const SITEMAP_GROUPS = {
  pages: (): SitemapRow[] =>
    expand([
      { url: `${SITE_URL}/`, changeFrequency: 'weekly', priority: 1 },
      { url: `${SITE_URL}/tudastar`, changeFrequency: 'weekly', priority: 0.8 },
      // tool and reference pages, only in the languages they are written in (see lib/tool-pages.ts)
      ...(Object.keys(TOOL_TITLE) as (keyof typeof TOOL_TITLE)[]).map((p) => ({ url: `${SITE_URL}${p}`, changeFrequency: 'monthly', priority: 0.8, langs: toolLangs(TOOL_TITLE[p]) })),
      ...['hogyan-mukodik', 'funkciok', 'gyik', 'rolunk', 'kapcsolat', 'adatbiztonsag', 'fiok-torlese', 'suti', 'mi-az-inkage', 'telepites', 'jog', 'szalonoknak'].map((p) => ({ url: `${SITE_URL}/${p}`, changeFrequency: 'monthly', priority: 0.5 })),
      { url: `${SITE_URL}/terms`, changeFrequency: 'yearly', priority: 0.2 },
      { url: `${SITE_URL}/privacy`, changeFrequency: 'yearly', priority: 0.2 },
    ]),
  articles: (): SitemapRow[] =>
    expand(
      liveArticles().map((a) => {
        const d = KB[a.slug]?.date;
        return { url: `${SITE_URL}/tudastar/${a.slug}`, changeFrequency: 'monthly', priority: 0.6, langs: articleLangs(a.slug), lastModified: d && d > CONTENT_DATE ? d : CONTENT_DATE };
      })
    ),
  tattoo: (): SitemapRow[] => expand(seoSlugs().map((slug) => ({ url: `${SITE_URL}/tattoo/${slug}`, changeFrequency: 'monthly', priority: 0.5, langs: TATTOO_LANGS }))),
};
export type SitemapGroup = keyof typeof SITEMAP_GROUPS;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function urlsetXml(rows: SitemapRow[]) {
  const body = rows
    .map(
      (r) =>
        `<url><loc>${esc(r.url)}</loc>` +
        Object.entries(r.languages).map(([h, u]) => `<xhtml:link rel="alternate" hreflang="${h}" href="${esc(u)}"/>`).join('') +
        `<lastmod>${r.lastModified}</lastmod><changefreq>${r.changeFrequency}</changefreq><priority>${r.priority}</priority></url>`
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${body}\n</urlset>\n`;
}

export const xmlResponse = (xml: string) => new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
