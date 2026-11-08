import { tx, langOf, qOf } from '@/lib/tr';
import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/site';
import { PainMap } from '../../tudastar/[slug]/PainMap';
import { painMapText } from '@/lib/pain-map';
import '../../tudastar/[slug]/article.css';
import './embed.css';

export const dynamic = 'force-dynamic';

/** The pain map alone, for other sites to embed in an iframe; the article is the page search engines should show. */
export function generateMetadata({ searchParams }: { searchParams: { lang?: string } }): Metadata {
  const L = langOf(searchParams);
  return {
    title: tx(L, 'Interactive tattoo pain map', 'Interaktív tetoválás fájdalomtérkép') + ' – InkAge',
    robots: { index: false, follow: true },
    alternates: { canonical: `${SITE_URL}/tudastar/tattoo-pain-chart${qOf(L)}` },
  };
}

export default function Page({ searchParams }: { searchParams: { lang?: string } }) {
  const L = langOf(searchParams);
  return (
    <div className="ka2 pm-embed">
      <PainMap t={painMapText(L)} />
      <p className="pm-src">
        {tx(L, 'Source:', 'Forrás:')}{' '}
        <a href={`${SITE_URL}/tudastar/tattoo-pain-chart${qOf(L)}`} target="_blank" rel="noopener">
          {tx(L, 'InkAge tattoo pain chart', 'InkAge tetoválás fájdalomtérkép')}
        </a>
      </p>
    </div>
  );
}
