import type { Metadata } from 'next';
import { InfoPage, langOf, type InfoSec } from '../_info/InfoPage';

export const dynamic = 'force-dynamic';
export function generateMetadata({ searchParams }: { searchParams: { lang?: string } }): Metadata {
  return { title: langOf(searchParams) === 'hu' ? 'Adatvédelmi tájékoztató – InkAge' : 'Privacy policy – InkAge' };
}

export default function Privacy({ searchParams }: { searchParams: { lang?: string } }) {
  const L = langOf(searchParams);
  const T = (en: string, hu: string) => (L === 'hu' ? hu : en);
  const sections: InfoSec[] = [
    { h: T('Photos and designs', 'Fotók és minták'), ps: [
      T('Your photo and design are sent to our AI providers (Google Gemini, and OpenAI as a backup) only to check the photo and create your preview. The providers may keep data for a limited time for abuse monitoring under their own policies; they do not use it to identify you.', 'A fotódat és a mintádat csak a fotó ellenőrzéséhez és az előnézet elkészítéséhez küldjük el az MI-szolgáltatóinknak (Google Gemini, tartalékként OpenAI). A szolgáltatók saját szabályzatuk szerint korlátozott ideig megőrizhetik az adatokat visszaélések kiszűrésére; nem használják fel őket a személyazonosításodra.'),
      T('If you are not signed in, your previews are saved only in your browser on this device. If you are signed in, your previews are stored in your private account storage (hosted by Supabase) so you can see them on every device. Only you can access them.', 'Ha nem vagy bejelentkezve, az előnézeteidet csak a böngésződ menti ezen az eszközön. Ha be vagy jelentkezve, a privát tárhelyeden tároljuk őket (Supabase üzemelteti), hogy minden eszközödön elérd. Csak te férsz hozzájuk.'),
    ] },
    { h: T('Sharing', 'Megosztás'), ps: [T('When you create a vote link, we copy the fresh and 50-year images to a public link. Anyone with the link can see those two images and vote. Deleting the preview hides the link.', 'Ha szavazós linket készítesz, a friss és az 50 éves képet egy nyilvános linkre másoljuk. Bárki, akinél a link van, láthatja ezt a két képet és szavazhat. Az előnézet törlésével a link is elrejtődik.')] },
    { h: T('Account and usage data', 'Fiók- és használati adatok'), ps: [T('We store your e-mail address, your onboarding answers (e.g. preferred style and placement), referral bonuses and a log of when you created previews, to apply limits and improve the app. For guests we store a random device ID and a one-way hash of the IP address to prevent abuse. We record simple, anonymous in-app events (for example “preview created”) in our own database — no advertising trackers, no third-party analytics. If you subscribe to updates or contact us, we store your e-mail and message to answer you.', 'Tároljuk az e-mail-címedet, a bevezető kérdésekre adott válaszaidat (pl. kedvelt stílus és hely), a meghívási bónuszokat és azt, hogy mikor készítettél előnézetet – a keretek alkalmazásához és az app fejlesztéséhez. Vendégeknél egy véletlenszerű eszközazonosítót és az IP-cím egyirányú hash-ét tároljuk a visszaélések megelőzésére. Egyszerű, névtelen eseményeket (például „előnézet elkészült”) rögzítünk a saját adatbázisunkban – hirdetési követők és külső analitika nélkül. Ha feliratkozol a hírekre vagy írsz nekünk, az e-mail-címedet és az üzenetedet a válaszadáshoz tároljuk.')] },
    { h: T('Your rights', 'A jogaid'), ps: [T('You can download your data and delete your account and every saved preview yourself at any time in the app (Profile). You can also ask us to access or delete your data through the contact page. Under the GDPR you may complain to your local data protection authority (in Hungary: NAIH).', 'Az adataidat bármikor letöltheted, a fiókodat és minden mentett előnézetedet pedig magad törölheted az appban (Profil). A kapcsolat oldalon keresztül is kérheted az adataidhoz való hozzáférést vagy azok törlését. A GDPR alapján panaszt tehetsz a helyi adatvédelmi hatóságnál (Magyarországon: NAIH).')] },
    { h: T('Storage on your device', 'Tárolás az eszközödön'), ps: [T('We use one cookie and local storage only to keep you signed in, remember your language and answers, apply the guest limit and keep guest previews on your device. See the cookie notice for details.', 'Egyetlen sütit és a helyi tárolót csak arra használjuk, hogy bejelentkezve tartsunk, megjegyezzük a nyelvet és a válaszaidat, alkalmazzuk a vendégkeretet, és az eszközödön tartsuk a vendég-előnézeteket. A részleteket a süti tájékoztató tartalmazza.')] },
  ];
  return <InfoPage lang={L} path="/privacy" kicker={T('Legal', 'Jog')} title={T('Privacy policy', 'Adatvédelmi tájékoztató')} sections={sections} updated={T('October 2026', '2026. október')} toc cta={false} kickerIcon="lock" related={[
    { href: '/adatbiztonsag', t: T('Data security', 'Adatbiztonság'), p: T('The short, friendly version.', 'A rövid, barátságos változat.'), i: 'shield' },
    { href: '/fiok-torlese', t: T('Delete account', 'Fiók törlése'), p: T('Step by step.', 'Lépésről lépésre.'), i: 'trash' },
    { href: '/jog', t: T('All legal pages', 'Minden jogi oldal'), p: T('Everything in one place.', 'Minden egy helyen.'), i: 'scale' },
  ]} />;
}
