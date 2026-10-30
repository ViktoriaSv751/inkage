import { tx } from '@/lib/tr';
import type { Metadata } from 'next';
import { InfoPage, langOf, type InfoSec } from '../_info/InfoPage';
import { PUBLIC } from '@/lib/public-config';

export const dynamic = 'force-dynamic';
export function generateMetadata({ searchParams }: { searchParams: { lang?: string } }): Metadata {
  return { title: tx(langOf(searchParams), 'Privacy policy – InkAge', 'Adatvédelmi tájékoztató – InkAge') };
}

export default function Privacy({ searchParams }: { searchParams: { lang?: string } }) {
  const L = langOf(searchParams);
  const T = (en: string, hu: string) => tx(L, en, hu);
  const op = PUBLIC.operatorName;
  const who = op
    ? T(`InkAge is developed and run by ${op}${PUBLIC.operatorAddress ? `, ${PUBLIC.operatorAddress}` : ''}, who is the data controller.`, `Az InkAge fejlesztője és üzemeltetője, egyben az adatkezelő: ${op}${PUBLIC.operatorAddress ? `, ${PUBLIC.operatorAddress}` : ''}.`)
    : T('InkAge is developed and run by its independent developer in Hungary, who is the data controller.', 'Az InkAge-et egy független magyarországi fejlesztő készíti és üzemelteti, ő az adatkezelő.');
  const reach = PUBLIC.contactEmail
    ? T(`Write to ${PUBLIC.contactEmail} or use the contact page – we answer within 30 days, usually much sooner.`, `Írj a ${PUBLIC.contactEmail} címre, vagy használd a kapcsolat oldalt – 30 napon belül, általában sokkal hamarabb válaszolunk.`)
    : T('Use the contact page – we answer within 30 days, usually much sooner.', 'Használd a kapcsolat oldalt – 30 napon belül, általában sokkal hamarabb válaszolunk.');
  const sections: InfoSec[] = [
    { h: T('Who we are', 'Kik vagyunk'), ps: [who, reach, T('InkAge is for adults: you must be 18 or older to create an account.', 'Az InkAge felnőtteknek szól: fiókot csak 18 éven felüliek hozhatnak létre.')] },
    { h: T('What we collect', 'Milyen adatokat gyűjtünk'), ps: [
      T('- **Account:** if you sign up with e-mail, your name, e-mail address and a one-way hash of your password (never the password itself); if you sign in with Google or Apple, your name, e-mail address and profile picture as they share them; in both cases a random user ID.', '- **Fiók:** e-mailes regisztrációnál a neved, az e-mail-címed és a jelszavad egyirányú hash-e (magát a jelszót soha nem tároljuk); Google- vagy Apple-belépésnél a neved, az e-mail-címed és a profilképed, ahogy ők átadják; mindkét esetben egy véletlenszerű felhasználói azonosító.'),
      T('- **Photos and designs:** the body photo and the tattoo design you upload, and the previews made from them.', '- **Fotók és minták:** a feltöltött testfotó és tetoválásminta, és a belőlük készült előnézetek.'),
      T('- **Your answers and settings:** onboarding answers (for example preferred style and placement), language, folders, notes on a preview.', '- **Válaszok és beállítások:** a bevezető kérdésekre adott válaszok (például kedvelt stílus és hely), a nyelv, a mappák, az előnézetekhez írt jegyzetek.'),
      T('- **Usage and limits:** when you created previews and how many, referral bonuses, to apply the monthly allowance of 30 previews and prevent abuse; a one-way hash of the IP address and a random device ID for the same reason.', '- **Használat és keretek:** mikor és hány előnézetet készítettél, a meghívási bónuszok – a havi 30 előnézetes keret és a visszaélések kiszűrése miatt; ugyanezért az IP-cím egyirányú hash-e és egy véletlenszerű eszközazonosító.'),
      T('- **Notifications:** if you turn them on, a push token for your device and the reminders you scheduled (for example healing reminders).', '- **Értesítések:** ha bekapcsolod, az eszközöd push-azonosítója és a beállított emlékeztetők (például gyógyulási emlékeztetők).'),
      T('- **Reports and messages:** reports you send about a picture (with a small copy of the picture), feedback, contact messages and newsletter sign-ups.', '- **Jelentések és üzenetek:** a képekről küldött jelentéseid (a kép kicsinyített másolatával), a visszajelzések, a kapcsolati üzenetek és a hírlevél-feliratkozás.'),
      T('- **Usage statistics:** simple, anonymous in-app events (for example “preview created”), only if you accept them in the cookie notice. No advertising trackers, no advertising ID.', '- **Használati statisztika:** egyszerű, névtelen események (például „előnézet elkészült”), csak ha a süti tájékoztatóban elfogadod. Nincs hirdetési követő, nincs hirdetési azonosító.'),
    ] },
    { h: T('Why we use it', 'Mire használjuk'), ps: [T('To run the app you asked for (making, saving and sharing previews – performance of a contract), to keep it safe and fair (abuse prevention, safety filters, answering reports – legitimate interest), and, only with your consent, for usage statistics, notifications and the newsletter. We never sell your data and never use your photos for advertising.', 'Az általad kért szolgáltatás működtetéséhez (előnézet készítése, mentése, megosztása – szerződés teljesítése), a biztonságos és tisztességes működéshez (visszaélés-szűrés, biztonsági szűrők, jelentések kezelése – jogos érdek), és csak a hozzájárulásoddal a használati statisztikához, az értesítésekhez és a hírlevélhez. Az adataidat soha nem adjuk el, a fotóidat soha nem használjuk hirdetésre.')] },
    { h: T('Photos, designs and AI', 'Fotók, minták és MI'), ps: [
      T('Your photo and design are sent to our AI providers (Google Gemini, and OpenAI as a backup) only to check the photo and create your preview. They may keep it for a limited time for abuse monitoring under their own terms; they do not use it to identify you. Photos showing nudity or a minor are rejected automatically.', 'A fotódat és a mintádat csak a fotó ellenőrzéséhez és az előnézet elkészítéséhez küldjük el az MI-szolgáltatóinknak (Google Gemini, tartalékként OpenAI). Saját feltételeik szerint visszaélés-szűrés céljából korlátozott ideig megőrizhetik őket; nem használják fel a személyazonosításodra. A meztelenséget vagy kiskorút mutató fotókat automatikusan elutasítjuk.'),
      T('Your previews are stored in your private account storage so you can see them on every device. Only you can open them, unless you share one.', 'Az előnézeteidet a privát fióktárhelyeden tároljuk, hogy minden eszközödön elérd. Csak te nyithatod meg őket, hacsak meg nem osztasz egyet.'),
    ] },
    { h: T('Sharing', 'Megosztás'), ps: [T('When you create a vote link, we copy the chosen images to a public link. Anyone with the link can see those images and vote; no name or account is shown. If you post to Explore, the images appear there after review. Closing the link or deleting the preview removes them.', 'Ha szavazós linket készítesz, a kiválasztott képeket egy nyilvános linkre másoljuk. Bárki, akinél a link van, láthatja őket és szavazhat; nevet vagy fiókot nem mutatunk. Ha a Felfedezés falra küldöd, a képek ellenőrzés után ott jelennek meg. A link lezárásával vagy az előnézet törlésével eltűnnek.')] },
    { h: T('Who processes data for us', 'Kik dolgoznak az adatokkal a nevünkben'), ps: [
      T('These providers process data only on our behalf and under data processing terms:', 'Ezek a szolgáltatók csak a nevünkben, adatfeldolgozási feltételek mellett kezelik az adatokat:'),
      T('- **Supabase** – database, sign-in and file storage (EU region)', '- **Supabase** – adatbázis, belépés és tárhely (EU-régió)'),
      T('- **Vercel** – hosting of the website and the app', '- **Vercel** – a weboldal és az app tárhelye'),
      T('- **Google (Gemini API)** and **OpenAI** – AI image checks and previews', '- **Google (Gemini API)** és **OpenAI** – MI-alapú fotóellenőrzés és előnézet'),
      T('- **Google (Firebase Cloud Messaging)** and **Apple (APNs)** – push notifications', '- **Google (Firebase Cloud Messaging)** és **Apple (APNs)** – push-értesítések'),
      T('- **Resend** – sending e-mails (welcome, newsletter, vote notifications)', '- **Resend** – e-mailek küldése (üdvözlő, hírlevél, szavazási értesítés)'),
      T('- **Google** and **Apple** – sign-in with your Google account or Apple ID', '- **Google** és **Apple** – belépés Google-fiókkal vagy Apple ID-val'),
      T('Some of them are based in the United States; transfers rely on the EU–US Data Privacy Framework or the EU standard contractual clauses.', 'Közülük néhány az Egyesült Államokban működik; az adattovábbítás az EU–USA adatvédelmi keretrendszeren vagy az EU általános szerződési feltételein alapul.'),
    ] },
    { h: T('How long we keep it', 'Meddig őrizzük'), ps: [
      T('- **Previews and photos:** until you delete them. Deleted previews stay in Recently deleted until you empty it or restore them; deleting your account removes them all at once.', '- **Előnézetek és fotók:** amíg nem törlöd őket. A törölt előnézetek a Nemrég törölt mappában maradnak, amíg ki nem üríted vagy vissza nem állítod őket; a fiók törlése mindet egyszerre eltávolítja.'),
      T('- **Account:** until you delete it. After deletion we keep only a closed record with a random ID (no name, e-mail, photo or preview) and the dates of past previews, so the monthly allowance cannot be abused with the same sign-in.', '- **Fiók:** amíg nem törlöd. Törlés után csak egy lezárt bejegyzést tartunk meg véletlenszerű azonosítóval (név, e-mail, fotó és előnézet nélkül), és a korábbi előnézetek dátumait, hogy ugyanazzal a belépéssel ne lehessen visszaélni a havi kerettel.'),
      T('- **Reports:** the reason for up to 12 months; the picture copy and your note are removed when your account is deleted.', '- **Jelentések:** az okot legfeljebb 12 hónapig őrizzük; a kép másolata és a megjegyzésed a fiók törlésekor törlődik.'),
      T('- **Messages and newsletter:** as long as needed to answer you, or until you unsubscribe.', '- **Üzenetek és hírlevél:** amíg a válaszhoz szükséges, illetve a leiratkozásig.'),
    ] },
    { h: T('Your rights', 'A jogaid'), id: 'rights', ps: [T('You can download your data, and delete your account and every saved preview yourself at any time in the app (Profile → Delete account), or ask us on the account deletion page. You can also ask for access, correction, restriction or objection, and withdraw consent at any time. Under the GDPR you may complain to your local data protection authority (in Hungary: NAIH, naih.hu).', 'Az adataidat bármikor letöltheted, a fiókodat és minden mentett előnézetedet pedig magad törölheted az appban (Profil → Fiók törlése), vagy kérheted a fióktörlési oldalon. Kérhetsz hozzáférést, helyesbítést, korlátozást, tiltakozhatsz, és a hozzájárulásodat bármikor visszavonhatod. A GDPR alapján panaszt tehetsz a helyi adatvédelmi hatóságnál (Magyarországon: NAIH, naih.hu).')] },
    { h: T('Storage on your device', 'Tárolás az eszközödön'), ps: [T('We use two small cookies and local storage only to keep you signed in, apply the preview allowance fairly and remember your language, answers and settings. See the cookie notice for details.', 'Két kis sütit és a helyi tárolót csak arra használjuk, hogy bejelentkezve tartsunk, méltányosan alkalmazzuk az előnézeti keretet, és megjegyezzük a nyelvet, a válaszaidat és a beállításaidat. A részleteket a süti tájékoztató tartalmazza.')] },
  ];
  return <InfoPage lang={L} path="/privacy" kicker={T('Legal', 'Jog')} title={T('Privacy policy', 'Adatvédelmi tájékoztató')} sections={sections} updated={T('18 October 2026', '2026. október 18.')} toc cta={false} kickerIcon="lock" related={[
    { href: '/adatbiztonsag', t: T('Data security', 'Adatbiztonság'), p: T('The short, friendly version.', 'A rövid, barátságos változat.'), i: 'shield' },
    { href: '/fiok-torlese', t: T('Delete account', 'Fiók törlése'), p: T('Step by step.', 'Lépésről lépésre.'), i: 'trash' },
    { href: '/jog', t: T('All legal pages', 'Minden jogi oldal'), p: T('Everything in one place.', 'Minden egy helyen.'), i: 'scale' },
  ]} />;
}
