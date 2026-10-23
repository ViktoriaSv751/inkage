import { pick, langOf, qOf, htmlLang } from '@/lib/tr';
import { articleLangs } from '@/lib/article-langs';
import { SITE_URL } from '@/lib/site';
import type { Metadata } from 'next';
import { longArticle } from '@/lib/longform';
import { IMG, KB } from '@/lib/kb';
import { ArticleView } from './ArticleView';

export const dynamic = 'force-dynamic';

export function generateMetadata({ params, searchParams }: { params: { slug: string }; searchParams: { lang?: string } }): Metadata {
  const a = longArticle(params.slug);
  if (!a) return {};
  const L = langOf(searchParams);
  const img = KB[a.slug]?.img;
  return {
    title: `${pick(a.title, L)} – InkAge Tudástár`,
    description: pick(a.desc, L),
    openGraph: { type: 'article', title: pick(a.title, L), description: pick(a.desc, L), images: img ? [{ url: IMG(img, 1200) }] : undefined },
    /* a new article shows its English text in languages it isn't translated into yet: those versions point to the
       English one and stay out of the index; every version lists only the languages the article is written in */
    ...(() => {
      const langs = articleLangs(a.slug), url = (l: typeof L) => `${SITE_URL}/tudastar/${a.slug}${qOf(l)}`;
      const languages = { ...Object.fromEntries(langs.map((l) => [htmlLang(l), url(l)])), 'x-default': url('hu') };
      return langs.includes(L)
        ? { alternates: { canonical: url(L), languages } }
        : { robots: { index: false, follow: true }, alternates: { canonical: url('en'), languages } };
    })(),
  };
}

export default function ArticlePage({ params, searchParams }: { params: { slug: string }; searchParams: { lang?: string } }) {
  return <ArticleView slug={params.slug} L={langOf(searchParams)} />;
}
