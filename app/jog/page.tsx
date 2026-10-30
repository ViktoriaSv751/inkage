import { tx } from '@/lib/tr';
import type { Metadata } from 'next';
import { InfoPage, langOf } from '../_info/InfoPage';

export const dynamic = 'force-dynamic';
export function generateMetadata({ searchParams }: { searchParams: { lang?: string } }): Metadata {
  return { title: tx(langOf(searchParams), 'Legal – InkAge', 'Jogi információk – InkAge') };
}

export default function Page({ searchParams }: { searchParams: { lang?: string } }) {
  const L = langOf(searchParams);
  const T = (en: string, hu: string) => tx(L, en, hu);
  return (
    <InfoPage
      lang={L}
      path="/jog"
      kicker={T('Legal', 'Jog')}
      kickerIcon="scale"
      title={T('The fine print, made readable.', 'Az apró betű, olvashatóan.')}
      lede={T('Everything about using InkAge, your data and your rights — in plain words.', 'Minden az InkAge használatáról, az adataidról és a jogaidról – érthetően.')}
      cta={false}
      related={[
        { href: '/terms', t: T('Terms of use', 'ÁSZF'), p: T('The rules for using InkAge.', 'Az InkAge használatának szabályai.'), i: 'scale' },
        { href: '/privacy', t: T('Privacy policy', 'Adatvédelem'), p: T('What we store and why.', 'Mit tárolunk és miért.'), i: 'lock' },
        { href: '/adatbiztonsag', t: T('Data security', 'Adatbiztonság'), p: T('How your photos are protected.', 'Így védjük a fotóidat.'), i: 'shield' },
        { href: '/fiok-torlese', t: T('Delete account', 'Fiók törlése'), p: T('Remove everything in a minute.', 'Mindent törölhetsz egy perc alatt.'), i: 'trash' },
        { href: '/suti', t: T('Cookie notice', 'Süti tájékoztató'), p: T('Cookies and browser storage, explained.', 'Sütik és böngészőtároló, elmagyarázva.'), i: 'cookie' },
        { href: '/kapcsolat', t: T('Contact', 'Kapcsolat'), p: T('Questions about your data.', 'Kérdések az adataidról.'), i: 'mail' },
      ]}
    />
  );
}
