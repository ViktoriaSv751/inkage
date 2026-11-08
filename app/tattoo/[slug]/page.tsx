import { tx, langOf } from '@/lib/tr';
import type { Metadata } from 'next';
import { seoPage, TATTOO_LANGS } from '@/lib/seo';
import { SITE_URL } from '@/lib/site';
import { qOf, htmlLang } from '@/lib/tr';
import { SeoView } from './SeoView';
import { seoTitle } from '@/lib/seo-titles';

export const dynamic = 'force-dynamic';

export function generateMetadata({ params, searchParams }: { params: { slug: string }; searchParams: { lang?: string } }): Metadata {
  const L = langOf(searchParams);
  const p = seoPage(params.slug, L);
  if (!p) return {};
  const title = tx(L, `${p.s.en} tattoo on the ${p.a.en}: how it looks after 10, 30 and 50 years`, `${p.s.hu} tetoválás – ${p.a.hu}: így néz ki 10, 30 és 50 év múlva`);
  return {
    title: seoTitle(`/tattoo/${params.slug}`, L) || `${title} – InkAge`,
    ...(() => {
      const url = (l: typeof L) => `${SITE_URL}/tattoo/${params.slug}${qOf(l)}`;
      const languages = { ...Object.fromEntries(TATTOO_LANGS.map((l) => [htmlLang(l), url(l)])), 'x-default': url('hu') };
      return TATTOO_LANGS.includes(L)
        ? { alternates: { canonical: url(L), languages } }
        : { robots: { index: false, follow: true }, alternates: { canonical: url('en'), languages } };
    })(),
    description: tx(L, `How a ${p.s.en.toLowerCase()} tattoo on the ${p.a.en} ages, which size lasts, and how to see it on your own skin.`, `Hogyan öregszik egy ${p.s.hu.toLowerCase()} tetoválás (${p.a.hu}), melyik méret tart, és hogyan nézheted meg a saját bőrödön.`),
  };
}

export default function SeoPage({ params, searchParams }: { params: { slug: string }; searchParams: { lang?: string } }) {
  return <SeoView slug={params.slug} L={langOf(searchParams)} />;
}
