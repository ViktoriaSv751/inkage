import { tx } from '@/lib/tr';
import type { Metadata } from 'next';
import { InfoPage, langOf, type InfoSec } from '../_info/InfoPage';

export const dynamic = 'force-dynamic';
export function generateMetadata({ searchParams }: { searchParams: { lang?: string } }): Metadata {
  return { title: tx(langOf(searchParams), 'Data security – InkAge', 'Adatbiztonság – InkAge') };
}

export default function Page({ searchParams }: { searchParams: { lang?: string } }) {
  const L = langOf(searchParams);
  const T = (en: string, hu: string) => tx(L, en, hu);
  const sections: InfoSec[] = [
    {
      h: T('Your photos', 'A fotóid'),
      icon: 'camera',
      ps: [
        T('Your photo and design are sent to our AI providers (Google Gemini, with OpenAI as a backup) only to check the photo and create your preview. The providers may keep data for a limited time for abuse monitoring under their own policies.', 'A fotódat és a mintádat csak a fotó ellenőrzéséhez és az előnézet elkészítéséhez küldjük el az MI-szolgáltatóinknak (Google Gemini, tartalékként OpenAI). A szolgáltatók saját szabályzatuk szerint korlátozott ideig megőrizhetik az adatokat visszaélések kiszűrésére.'),
        T('- **Without an account:** previews are saved only in your browser on this device.', '- **Fiók nélkül:** az előnézeteket csak a böngésződ menti, ezen az eszközön.'),
        T('- **With an account:** previews are stored in your private account storage (hosted by Supabase). Database rules make sure only you can read them.', '- **Fiókkal:** az előnézetek a privát tárhelyeden vannak (Supabase üzemelteti). Adatbázis-szabályok biztosítják, hogy csak te olvashasd őket.'),
      ],
    },
    {
      h: T('How the service is protected', 'Hogyan védjük a szolgáltatást'),
      icon: 'shield',
      ps: [
        T('- All traffic is encrypted with HTTPS.', '- Minden adatforgalom HTTPS-titkosítással megy.'),
        T('- Row-level security in the database: every request is checked against who is signed in.', '- Sorszintű jogosultság az adatbázisban: minden kérésnél ellenőrizzük, ki van bejelentkezve.'),
        T('- Server keys never reach your browser; sensitive actions run on the server.', '- A szerverkulcsok soha nem jutnak el a böngésződbe; az érzékeny műveletek a szerveren futnak.'),
        T('- For guests we keep a random device ID and a one-way hash of the IP address — never the raw IP — to apply fair limits.', '- Vendégeknél egy véletlenszerű eszközazonosítót és az IP-cím egyirányú hash-ét tároljuk – soha nem magát az IP-t –, hogy méltányos kereteket alkalmazhassunk.'),
        T('- Photos of minors and nude images are refused automatically.', '- A kiskorúakat ábrázoló és a meztelen képeket automatikusan elutasítjuk.'),
      ],
    },
    {
      h: T('Sharing is always your choice', 'A megosztás mindig a te döntésed'),
      icon: 'share',
      ps: [T('Nothing is public by default. When you create a vote link we copy only the fresh and the 50-year image to it. Deleting the preview hides the link.', 'Alapból semmi sem nyilvános. Ha szavazós linket készítesz, csak a friss és az 50 éves képet másoljuk hozzá. Ha törlöd az előnézetet, a link is elrejtődik.')],
    },
    {
      h: T('No ad tracking', 'Nincs reklámkövetés'),
      icon: 'eye',
      ps: [T('We don’t use advertising trackers or third-party analytics. We count simple, anonymous in-app events (for example “preview created”) in our own database to improve the app.', 'Nem használunk hirdetési követőket vagy külső analitikát. Egyszerű, névtelen eseményeket (például „előnézet elkészült”) számolunk a saját adatbázisunkban, hogy jobbá tegyük az appot.')],
    },
    {
      h: T('Your control', 'A te kezedben'),
      icon: 'user',
      ps: [
        T('- **Download your data:** Profile → Download my data.', '- **Adataid letöltése:** Profil → Adataim letöltése.'),
        T('- **Delete everything:** Profile → Delete my account and data.', '- **Minden törlése:** Profil → Fiókom és adataim törlése.'),
        T('Found a security issue? Please tell us through the contact page — we take every report seriously.', 'Biztonsági hibát találtál? Kérjük, jelezd a kapcsolat oldalon – minden bejelentést komolyan veszünk.'),
      ],
    },
  ];
  return <InfoPage lang={L} path="/adatbiztonsag" kicker={T('Data security', 'Adatbiztonság')} title={T('Your photos are yours.', 'A fotóid a tieid.')} lede={T('What happens to your photos, who can see them, and how to remove them.', 'Mi történik a fotóiddal, ki láthatja őket, és hogyan törölheted.')} sections={sections} toc kickerIcon="shield" highlights={[
    { i: 'lock', h: T('Private by default', 'Alapból privát'), p: T('Nothing is public unless you share it.', 'Semmi sem nyilvános, amíg nem osztod meg.') },
    { i: 'eye', h: T('No ad trackers', 'Nincs reklámkövetés'), p: T('No third-party analytics either.', 'Külső analitika sincs.') },
    { i: 'trash', h: T('Delete anytime', 'Bármikor törölhető'), p: T('One button removes everything.', 'Egy gomb mindent töröl.') },
  ]} related={[
    { href: '/privacy', t: T('Privacy policy', 'Adatvédelem'), p: T('The full privacy policy.', 'A teljes adatvédelmi tájékoztató.'), i: 'doc' },
    { href: '/suti', t: T('Cookie notice', 'Süti tájékoztató'), p: T('One cookie, explained.', 'Egyetlen süti, elmagyarázva.'), i: 'cookie' },
    { href: '/fiok-torlese', t: T('Delete account', 'Fiók törlése'), p: T('Step by step.', 'Lépésről lépésre.'), i: 'trash' },
  ]} />;
}
