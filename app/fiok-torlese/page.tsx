import type { Metadata } from 'next';
import { InfoPage, langOf, type InfoSec } from '../_info/InfoPage';

export const dynamic = 'force-dynamic';
export function generateMetadata({ searchParams }: { searchParams: { lang?: string } }): Metadata {
  return { title: langOf(searchParams) === 'hu' ? 'Fiók törlése – InkAge' : 'Delete your account – InkAge' };
}

export default function Page({ searchParams }: { searchParams: { lang?: string } }) {
  const L = langOf(searchParams);
  const T = (en: string, hu: string) => (L === 'hu' ? hu : en);
  const sections: InfoSec[] = [
    {
      h: T('If you have an account', 'Ha van fiókod'),
      ps: [
        T('1. Open InkAge and sign in.', '1. Nyisd meg az InkAge-et, és jelentkezz be.'),
        T('2. Go to Profile.', '2. Lépj a Profil oldalra.'),
        T('3. Tap “Delete my account and data”.', '3. Koppints a „Fiókom és adataim törlése” lehetőségre.'),
        T('4. Type DELETE to confirm and tap “Delete everything”.', '4. Megerősítésként írd be: DELETE, majd koppints a „Mindent törlök” gombra.'),
        T('Your account, every saved preview and your vote links are removed. This can’t be undone.', 'Ezzel törlődik a fiókod, minden mentett előnézeted és a szavazós linkjeid. Ez nem vonható vissza.'),
        T('> Want to keep something? Download your previews or use Profile → Download my data first.', '> Szeretnél megtartani valamit? Előtte töltsd le az előnézeteidet, vagy használd a Profil → Adataim letöltése lehetőséget.'),
      ],
    },
    {
      h: T('If you never signed in', 'Ha soha nem jelentkeztél be'),
      ps: [T('Your previews live only in this browser. Delete them one by one in the gallery, or clear this site’s data in your browser settings.', 'Az előnézeteid csak ebben a böngészőben vannak. Törölheted őket egyenként a galériában, vagy a böngésző beállításaiban törölheted az oldal adatait.')],
    },
    {
      h: T('Can’t get into your account?', 'Nem tudsz belépni?'),
      ps: [T('Send us a message on the contact page from the e-mail address you signed up with and we’ll delete your data for you.', 'Írj nekünk a kapcsolat oldalon arról az e-mail-címről, amellyel regisztráltál, és töröljük helyetted az adataidat.')],
    },
  ];
  return <InfoPage lang={L} path="/fiok-torlese" kicker={T('Delete account', 'Fiók törlése')} title={T('Delete your account and data.', 'Fiók és adatok törlése.')} lede={T('You can do it yourself, in the app, in under a minute.', 'Magad is megteheted az appban, kevesebb mint egy perc alatt.')} sections={sections} cta={false} />;
}
