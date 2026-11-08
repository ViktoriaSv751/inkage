import { langOf, pick, qOf } from '@/lib/tr';
import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/site';
import { articleLangs } from '@/lib/article-langs';
import { longArticle } from '@/lib/longform';
import { ArticleView } from '../../../tudastar/[slug]/ArticleView';

export const dynamic = 'force-dynamic';

/** Same article as /tudastar/<slug>: that public page is the canonical one, so search shows it, not this app copy. */
export function generateMetadata({ params, searchParams }: { params: { slug: string }; searchParams: { lang?: string } }): Metadata {
  const a = longArticle(params.slug);
  if (!a) return {};
  const L = langOf(searchParams);
  const to = articleLangs(a.slug).includes(L) ? L : 'en';
  return { title: `${pick(a.title, L)} – InkAge`, description: pick(a.desc, L), alternates: { canonical: `${SITE_URL}/tudastar/${a.slug}${qOf(to)}` } };
}

/** A knowledge-base article inside the app (opened from Explore). */
export default function AppArticle({ params, searchParams }: { params: { slug: string }; searchParams: { lang?: string } }) {
  return <ArticleView slug={params.slug} L={langOf(searchParams)} inApp />;
}
