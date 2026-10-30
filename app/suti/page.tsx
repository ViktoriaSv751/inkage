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
      ps: [T('InkAge uses only what it needs to work, and there are no advertising or third-party tracking cookies. The small window on your first visit asks one thing: may we also keep our own anonymous usage stats? You can say no, and everything still works.', 'Az InkAge csak azt használja, ami a működéshez szükséges, és nincsenek hirdetési vagy külső követő sütik. Az első látogatáskor megjelenő kis ablak egy dolgot kérdez: megtarthatjuk-e a saját, névtelen használati statisztikánkat is? Nemet is mondhatsz, minden ugyanúgy működik.')],
    },
    {
      h: T('Cookies', 'Sütik'),
      icon: 'cookie',
      ps: [
        T('- **ink_guest** — a random device ID (no personal data) used to apply the monthly preview allowance fairly and prevent abuse. HttpOnly, kept for up to one year.', '- **ink_guest** – véletlenszerű eszközazonosító (személyes adat nélkül), amellyel a havi előnézeti keretet méltányosan alkalmazzuk, és kiszűrjük a visszaéléseket. HttpOnly, legfeljebb egy évig marad meg.'),
        T('- **ink_lang** — remembers the language you chose, so pages open in it next time. Kept for one year.', '- **ink_lang** – megjegyzi a választott nyelvet, hogy legközelebb azon nyíljanak meg az oldalak. Egy évig marad meg.'),
      ],
    },
    {
      h: T('Storage in your browser', 'Tárolás a böngésződben'),
      icon: 'globe',
      ps: [
        T('- **Sign-in session** — keeps you signed in, if you have an account.', '- **Bejelentkezési munkamenet** – bejelentkezve tart, ha van fiókod.'),
        T('- **Your settings** (ink_lang, ink_onboarding, ink_folders, ink_ai_ok, ink_use_upload) — language, onboarding answers, folders, your OK for the AI step and similar preferences.', '- **Beállításaid** (ink_lang, ink_onboarding, ink_folders, ink_ai_ok, ink_use_upload) – nyelv, a bevezető kérdésekre adott válaszaid, mappák, az MI-lépéshez adott hozzájárulásod és hasonló beállítások.'),
        T('- **Your statistics choice** (ink_consent) — whether you accepted anonymous usage statistics, and when.', '- **Statisztikai döntésed** (ink_consent) – elfogadtad-e a névtelen használati statisztikát, és mikor.'),
        T('- **Anonymous IDs** (ink_anon, ink_sid, ink_seen, ink_src) — a random ID for this browser and this visit, and where the visit came from, for the statistics above. No name or e-mail.', '- **Névtelen azonosítók** (ink_anon, ink_sid, ink_seen, ink_src) – véletlenszerű azonosító ehhez a böngészőhöz és ehhez a látogatáshoz, és hogy honnan érkezett a látogatás, a fenti statisztikához. Név és e-mail nélkül.'),
        T('- **Invite code** (ink_ref) — the invite link you arrived from, until your account is created, so the bonus reaches you and your friend.', '- **Meghívókód** (ink_ref) – a meghívó link, amellyel érkeztél, amíg a fiókod létrejön, hogy a bónusz neked és a barátodnak is jóváíródjon.'),
        T('- **App state** (ink_shares, ink_job) — the vote links you made and a preview still being made, so nothing is lost if you reload.', '- **Az app állapota** (ink_shares, ink_job) – a szavazós linkjeid és a még készülő előnézet, hogy újratöltéskor se vesszen el semmi.'),
        T('- **Drafts** (ink_draft, ink_fresh) — the photo you picked on the home page, until the app opens it (cleared when you close the tab).', '- **Piszkozatok** (ink_draft, ink_fresh) – a kezdőlapon kiválasztott fotó, amíg az app megnyitja (a lap bezárásakor törlődik).'),
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
