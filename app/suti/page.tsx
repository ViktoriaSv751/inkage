import { tx } from '@/lib/tr';
import type { Metadata } from 'next';
import { InfoPage, langOf, type InfoSec } from '../_info/InfoPage';

export const dynamic = 'force-dynamic';
export function generateMetadata({ searchParams }: { searchParams: { lang?: string } }): Metadata {
  return { title: tx(langOf(searchParams), 'Cookie notice – InkAge', 'Süti tájékoztató – InkAge') };
}

export default function Page({ searchParams }: { searchParams: { lang?: string } }) {
  const L = langOf(searchParams);
  const T = (en: string, hu: string) => tx(L, en, hu);
  const sections: InfoSec[] = [
    {
      h: T('In short', 'Röviden'),
      icon: 'check',
      ps: [T('InkAge uses only what is needed for the app to work. There are no advertising or third-party tracking cookies, so there is no cookie banner to click through.', 'Az InkAge csak azt használja, ami a működéshez szükséges. Nincsenek hirdetési vagy külső követő sütik, ezért nincs mit elfogadni egy sütisávban sem.')],
    },
    {
      h: T('Cookies', 'Sütik'),
      icon: 'cookie',
      ps: [T('- **ink_guest** — a random device ID (no personal data) used to apply the free daily limit fairly and prevent abuse. HttpOnly, kept for up to one year.', '- **ink_guest** – véletlenszerű eszközazonosító (személyes adat nélkül), amellyel az ingyenes napi keretet méltányosan alkalmazzuk, és kiszűrjük a visszaéléseket. HttpOnly, legfeljebb egy évig marad meg.')],
    },
    {
      h: T('Storage in your browser', 'Tárolás a böngésződben'),
      icon: 'globe',
      ps: [
        T('- **Sign-in session** — keeps you signed in, if you have an account.', '- **Bejelentkezési munkamenet** – bejelentkezve tart, ha van fiókod.'),
        T('- **Your settings** — language, onboarding answers and similar preferences.', '- **Beállításaid** – nyelv, a bevezető kérdésekre adott válaszaid és hasonló beállítások.'),
        T('- **Drafts** — the photo you picked on the home page, until the app opens it (cleared when you close the tab).', '- **Piszkozatok** – a kezdőlapon kiválasztott fotó, amíg az app megnyitja (a lap bezárásakor törlődik).'),
      ],
    },
    {
      h: T('Removing them', 'Törlésük'),
      icon: 'trash',
      ps: [T('You can clear cookies and site data for InkAge in your browser settings at any time. You will be signed out; your previews stay safe in your account.', 'Az InkAge sütijeit és oldaladatait bármikor törölheted a böngésződ beállításaiban. Ilyenkor kijelentkeztetünk; az előnézeteid biztonságban maradnak a fiókodban.')],
    },
  ];
  return <InfoPage lang={L} path="/suti" kicker={T('Cookie notice', 'Süti tájékoztató')} title={T('Cookies, briefly.', 'Sütik, röviden.')} sections={sections} updated={T('October 2026', '2026. október')} cta={false} kickerIcon="cookie" related={[
    { href: '/privacy', t: T('Privacy policy', 'Adatvédelem'), p: T('The full privacy policy.', 'A teljes adatvédelmi tájékoztató.'), i: 'doc' },
    { href: '/adatbiztonsag', t: T('Data security', 'Adatbiztonság'), p: T('How your photos are protected.', 'Így védjük a fotóidat.'), i: 'shield' },
    { href: '/jog', t: T('All legal pages', 'Minden jogi oldal'), p: T('Terms, privacy and more.', 'ÁSZF, adatvédelem és a többi.'), i: 'scale' },
  ]} />;
}
