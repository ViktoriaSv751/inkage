import { tx, langOf, pick, qOf } from '@/lib/tr';
import type { Metadata } from 'next';
import Link from 'next/link';
import { toolAlternates, TOOL_TITLE } from '@/lib/tool-pages';
import { GLOSSARY } from '@/lib/glossary';
import { LONG } from '@/lib/longform';
import { articleLangs } from '@/lib/article-langs';
import { SITE_URL } from '@/lib/site';
import { InfoPage } from '../_info/InfoPage';
import './szotar.css';

export const dynamic = 'force-dynamic';
const PATH = '/szotar';

export function generateMetadata({ searchParams }: { searchParams: { lang?: string } }): Metadata {
  const L = langOf(searchParams);
  return {
    title: tx(L, TOOL_TITLE[PATH], 'Tetoválás szótár: 30 kifejezés röviden, érthetően') + ' – InkAge',
    description: tx(
      L,
      'Blowout, cover-up, fine line, ghosting, picosecond laser, REACH and more: tattoo and tattoo-removal terms explained in a sentence or two.',
      'Blowout, cover-up, fine line, szellemkép, pikoszekundumos lézer, REACH és a többi: tetoválás- és eltávolítási kifejezések egy-két mondatban.'
    ),
    ...toolAlternates(PATH, L, TOOL_TITLE[PATH]),
  };
}

export default function Page({ searchParams }: { searchParams: { lang?: string } }) {
  const L = langOf(searchParams);
  const T = (en: string, hu: string) => tx(L, en, hu);
  const q = qOf(L);
  const terms = [...GLOSSARY].sort((a, b) => pick(a.term, L).localeCompare(pick(b.term, L), L));
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'DefinedTermSet',
    name: T('Tattoo glossary', 'Tetoválás szótár'),
    url: `${SITE_URL}${PATH}${q}`,
    hasDefinedTerm: terms.map((t) => ({ '@type': 'DefinedTerm', name: pick(t.term, L), description: pick(t.def, L), url: `${SITE_URL}${PATH}${q}#${t.id}` })),
  };
  return (
    <InfoPage
      lang={L}
      path={PATH}
      kicker={T('Glossary', 'Szótár')}
      kickerIcon="spark"
      title={T('Tattoo glossary', 'Tetoválás szótár')}
      lede={T('The words artists and clinics use, explained in a sentence or two, with a link to the article that goes deeper.', 'A tetoválók és klinikák szavai egy-két mondatban, mindegyiknél a részletesebb cikk linkjével.')}
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <dl className="gl-list">
        {terms.map((t) => {
          const see = t.see && LONG.find((x) => x.slug === t.see && articleLangs(x.slug).includes(L));
          return (
            <div key={t.id} id={t.id} className="gl-item">
              <dt>{pick(t.term, L)}</dt>
              <dd>
                {pick(t.def, L)}
                {see && (
                  <>
                    {' '}
                    <Link href={`/tudastar/${see.slug}${q}`}>{T('Read more', 'Bővebben')} →</Link>
                  </>
                )}
              </dd>
            </div>
          );
        })}
      </dl>
    </InfoPage>
  );
}
