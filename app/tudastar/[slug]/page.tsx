import { pick, LANGS, qOf, langOf } from '@/lib/tr';
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
    alternates: { canonical: `/tudastar/${a.slug}`, languages: Object.fromEntries(LANGS.map((l) => [l, `/tudastar/${a.slug}${qOf(l)}`])) },
    openGraph: { type: 'article', title: pick(a.title, L), description: pick(a.desc, L), images: img ? [{ url: IMG(img, 1200) }] : undefined },
  };
}

export default function ArticlePage({ params, searchParams }: { params: { slug: string }; searchParams: { lang?: string } }) {
  return <ArticleView slug={params.slug} L={langOf(searchParams)} />;
}
