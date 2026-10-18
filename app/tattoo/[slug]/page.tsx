import { tx, langOf } from '@/lib/tr';
import type { Metadata } from 'next';
import { seoPage } from '@/lib/seo';
import { SeoView } from './SeoView';

export const dynamic = 'force-dynamic';

export function generateMetadata({ params, searchParams }: { params: { slug: string }; searchParams: { lang?: string } }): Metadata {
  const L = langOf(searchParams);
  const p = seoPage(params.slug, L);
  if (!p) return {};
  const title = tx(L, `${p.s.en} tattoo on the ${p.a.en}: how it looks after 10, 30 and 50 years`, `${p.s.hu} tetoválás – ${p.a.hu}: így néz ki 10, 30 és 50 év múlva`);
  return {
    title: `${title} – InkAge`,
    description: tx(L, `How a ${p.s.en.toLowerCase()} tattoo on the ${p.a.en} ages, which size lasts, and how to see it on your own skin.`, `Hogyan öregszik egy ${p.s.hu.toLowerCase()} tetoválás (${p.a.hu}), melyik méret tart, és hogyan nézheted meg a saját bőrödön.`),
    alternates: { canonical: `/tattoo/${params.slug}` },
  };
}

export default function SeoPage({ params, searchParams }: { params: { slug: string }; searchParams: { lang?: string } }) {
  return <SeoView slug={params.slug} L={langOf(searchParams)} />;
}
