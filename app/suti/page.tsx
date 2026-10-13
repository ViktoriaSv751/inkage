import type { Metadata } from 'next';
import { InfoPage, langOf, type InfoSec } from '../_info/InfoPage';

export const dynamic = 'force-dynamic';
export function generateMetadata({ searchParams }: { searchParams: { lang?: string } }): Metadata {
  return { title: langOf(searchParams) === 'hu' ? 'Süti tájékoztató – InkAge' : 'Cookie notice – InkAge' };
}

export default function Page({ searchParams }: { searchParams: { lang?: string } }) {
  const L = langOf(searchParams);
  const T = (en: string, hu: string) => (L === 'hu' ? hu : en);
  const sections: InfoSec[] = [
    {
      h: T('In short', 'Röviden'),
      ps: [T('InkAge uses only what is needed for the app to work. There are no advertising or third-party tracking cookies, so there is no cookie banner to click through.', 'Az InkAge csak azt használja, ami a működéshez szükséges. Nincsenek hirdetési vagy külső követő sütik, ezért nincs mit elfogadni egy sütisávban sem.')],
    },
    {
      h: T('Cookies', 'Sütik'),
      ps: [T('- **ink_guest** — a random device ID (no personal data) used to apply the free daily limit for visitors without an account. HttpOnly, kept for up to one year.', '- **ink_guest** – véletlenszerű eszközazonosító (személyes adat nélkül), amellyel a fiók nélküli látogatók ingyenes napi keretét alkalmazzuk. HttpOnly, legfeljebb egy évig marad meg.')],
    },
    {
      h: T('Storage in your browser', 'Tárolás a böngésződben'),
      ps: [
        T('- **Sign-in session** — keeps you signed in, if you have an account.', '- **Bejelentkezési munkamenet** – bejelentkezve tart, ha van fiókod.'),
        T('- **Your settings** — language, onboarding answers and similar preferences.', '- **Beállításaid** – nyelv, a bevezető kérdésekre adott válaszaid és hasonló beállítások.'),
        T('- **Guest previews** — previews made without an account, kept only on this device.', '- **Vendég-előnézetek** – a fiók nélkül készült előnézetek, csak ezen az eszközön.'),
        T('- **Drafts** — the photo you picked on the home page, until the app opens it (cleared when you close the tab).', '- **Piszkozatok** – a kezdőlapon kiválasztott fotó, amíg az app megnyitja (a lap bezárásakor törlődik).'),
      ],
    },
    {
      h: T('Removing them', 'Törlésük'),
      ps: [T('You can clear cookies and site data for InkAge in your browser settings at any time. You will be signed out and guest previews on this device will be deleted.', 'Az InkAge sütijeit és oldaladatait bármikor törölheted a böngésződ beállításaiban. Ilyenkor kijelentkeztetünk, és az ezen az eszközön lévő vendég-előnézetek is törlődnek.')],
    },
  ];
  return <InfoPage lang={L} path="/suti" kicker={T('Cookie notice', 'Süti tájékoztató')} title={T('Cookies, briefly.', 'Sütik, röviden.')} sections={sections} updated={T('October 2026', '2026. október')} cta={false} />;
}
