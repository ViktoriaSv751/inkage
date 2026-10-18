import { tx } from '@/lib/tr';
import type { Metadata } from 'next';
import { InfoPage, langOf, type InfoSec } from '../_info/InfoPage';
import { PUBLIC } from '@/lib/public-config';

export const dynamic = 'force-dynamic';
export function generateMetadata({ searchParams }: { searchParams: { lang?: string } }): Metadata {
  return { title: tx(langOf(searchParams), 'Delete your account – InkAge', 'Fiók törlése – InkAge') };
}

export default function Page({ searchParams }: { searchParams: { lang?: string } }) {
  const L = langOf(searchParams);
  const T = (en: string, hu: string) => tx(L, en, hu);
  const mail = PUBLIC.contactEmail;
  const sections: InfoSec[] = [
    {
      h: T('Delete it yourself in the app', 'Töröld magad az appban'),
      icon: 'user',
      ps: [
        T('1. Open InkAge and sign in.', '1. Nyisd meg az InkAge-et, és jelentkezz be.'),
        T('2. Go to Profile and tap “Delete account” at the top.', '2. Lépj a Profil oldalra, és koppints fent a „Fiók törlése” gombra.'),
        T('3. Type DELETE to confirm and tap “Delete everything”.', '3. Megerősítésként írd be: TÖRLÉS, majd koppints a „Mindent törlök” gombra.'),
        T('> Want to keep something? Use Profile → Download my data first.', '> Szeretnél megtartani valamit? Előtte használd a Profil → Adataim letöltése lehetőséget.'),
      ],
    },
    {
      h: T('Ask us to delete it – no app needed', 'Kérd tőlünk – app nélkül is'),
      id: 'request',
      icon: 'mail',
      ps: [
        mail
          ? T(`Write to ${mail} from the e-mail address of your Google account or Apple ID, with the subject “Delete my InkAge account”. You can also use the contact page.`, `Írj a ${mail} címre a Google-fiókod vagy Apple ID-d e-mail-címéről, „InkAge-fiók törlése” tárggyal. A kapcsolat oldalt is használhatod.`)
          : T('Send us a message on the contact page with the subject “Delete my InkAge account”, from the e-mail address of your Google account or Apple ID.', 'Írj nekünk a kapcsolat oldalon „InkAge-fiók törlése” tárggyal, a Google-fiókod vagy Apple ID-d e-mail-címéről.'),
        T('We confirm that the address is yours and delete the account within 30 days, usually within 2 working days, then let you know.', 'Ellenőrizzük, hogy a cím a tiéd, és 30 napon belül, általában 2 munkanapon belül töröljük a fiókot, majd értesítünk.'),
      ],
    },
    {
      h: T('What is deleted and what is kept', 'Mi törlődik és mi marad meg'),
      icon: 'trash',
      ps: [
        T('- **Deleted at once:** your name, e-mail address and profile picture, every photo, design and preview (including Recently deleted), your vote links and Explore posts, notes, folders, onboarding answers, notification tokens and planned reminders.', '- **Azonnal törlődik:** a neved, e-mail-címed és profilképed, minden fotó, minta és előnézet (a Nemrég törölt mappával együtt), a szavazós linkek és a Felfedezés bejegyzései, a jegyzetek, mappák, bevezető válaszok, értesítési azonosítók és a beállított emlékeztetők.'),
        T('- **Kept:** a closed record with a random ID and the dates of past previews (no name, e-mail or image), so the free limit cannot be abused with the same sign-in, and the reason of reports you sent, for up to 12 months.', '- **Megmarad:** egy lezárt bejegyzés véletlenszerű azonosítóval és a korábbi előnézetek dátumaival (név, e-mail és kép nélkül), hogy ugyanazzal a belépéssel ne lehessen visszaélni az ingyenes kerettel, valamint az általad küldött jelentések oka, legfeljebb 12 hónapig.'),
        T('Deleting can’t be undone. You can sign up again later with the same Google account or Apple ID; that starts a new, empty account.', 'A törlés nem vonható vissza. Később ugyanazzal a Google-fiókkal vagy Apple ID-val újra regisztrálhatsz; ez egy új, üres fiókot indít.'),
      ],
    },
  ];
  return <InfoPage lang={L} path="/fiok-torlese" kicker={T('Delete account', 'Fiók törlése')} title={T('Delete your InkAge account and data.', 'InkAge-fiók és adatok törlése.')} lede={T('Do it yourself in the app in under a minute, or ask us here – no app needed.', 'Megteheted magad az appban egy perc alatt, vagy kérheted tőlünk itt – app nélkül is.')} sections={sections} cta={false} kickerIcon="trash" highlights={[
    { i: 'clock', h: T('Under a minute', 'Egy percen belül'), p: T('Done in the app, by you.', 'Az appban, magad intézed.') },
    { i: 'trash', h: T('Everything goes', 'Minden törlődik'), p: T('Account, previews and vote links.', 'Fiók, előnézetek és szavazós linkek.') },
    { i: 'download', h: T('Keep a copy first', 'Előtte ments'), p: T('Download your data before deleting.', 'Töltsd le az adataidat törlés előtt.') },
  ]} related={[
    { href: '/adatbiztonsag', t: T('Data security', 'Adatbiztonság'), p: T('How your photos are protected.', 'Így védjük a fotóidat.'), i: 'shield' },
    { href: '/privacy', t: T('Privacy policy', 'Adatvédelem'), p: T('Your rights under the GDPR.', 'A jogaid a GDPR szerint.'), i: 'doc' },
    { href: '/kapcsolat', t: T('Contact', 'Kapcsolat'), p: T('We’ll help if you’re stuck.', 'Segítünk, ha elakadtál.'), i: 'mail' },
  ]} />;
}
