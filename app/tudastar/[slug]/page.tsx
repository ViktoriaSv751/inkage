import { pick, langOf, tr, qOf } from '@/lib/tr';
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
       English one and stay out of the index until the translation lands (then they become canonical on their own) */
    ...(L !== 'en' && L !== 'hu' && tr(L, a.title.en) === a.title.en
      ? {
          robots: { index: false, follow: true },
          alternates: {
            canonical: `${SITE_URL}/tudastar/${a.slug}${qOf('en')}`,
            languages: { hu: `${SITE_URL}/tudastar/${a.slug}`, en: `${SITE_URL}/tudastar/${a.slug}${qOf('en')}`, 'x-default': `${SITE_URL}/tudastar/${a.slug}` },
          },
        }
      : {}),
  };
}

export default function ArticlePage({ params, searchParams }: { params: { slug: string }; searchParams: { lang?: string } }) {
  return <ArticleView slug={params.slug} L={langOf(searchParams)} />;
}
