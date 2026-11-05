import { articleLangs } from './article-langs';
import { TOP_ARTICLES } from './kb-links';
import { ARTICLES } from './articles';
import { KB } from './kb';
import { SEO_AREAS, SEO_STYLES, seoPage } from './seo';
import { pick, type Lang } from './tr';

/** What the home page shows from the articles and the score tables, worked out on the server so the browser doesn't download them. */
export function landingData(lang: Lang) {
  /* the most searched articles that are written in this language (lib/kb-links.ts) */
  const featured = TOP_ARTICLES.filter((s) => articleLangs(s).includes(lang))
    .map((s) => ARTICLES.find((a) => a.slug === s)!)
    .filter(Boolean)
    .slice(0, 4)
    .map((a) => ({ slug: a.slug, img: KB[a.slug].img, tag: pick(a.tag, lang), title: pick(a.title, lang), desc: pick(a.desc, lang) }));
  const styles = SEO_STYLES.map((s) => ({
    k: s.k as string,
    tab: lang === 'hu' ? s.hu.replace(/ \(.*\)/, '') : s.en,
    name: pick(s, lang),
    ranked: SEO_AREAS.map((a) => ({ k: a.k as string, name: pick(a, lang), score: seoPage(`${s.k}-${a.k}`, lang)?.medium ?? 0 })).sort((x, y) => y.score - x.score),
  }));
  return { articleCount: ARTICLES.length, featured, styles };
}
export type LandingData = ReturnType<typeof landingData>;
