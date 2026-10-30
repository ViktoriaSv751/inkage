import { tx } from '@/lib/tr';
import type { Metadata } from 'next';
import { InfoPage, langOf, type InfoSec } from '../_info/InfoPage';

export const dynamic = 'force-dynamic';
export function generateMetadata({ searchParams }: { searchParams: { lang?: string } }): Metadata {
  return { title: tx(langOf(searchParams), 'Beta: what’s included and the monthly allowance – InkAge', 'Béta: mi jár, és mi a havi keret – InkAge') };
}

export default function Page({ searchParams }: { searchParams: { lang?: string } }) {
  const L = langOf(searchParams);
  const T = (en: string, hu: string) => tx(L, en, hu);
  const sections: InfoSec[] = [
    {
      h: T('What’s included', 'Mi jár a béta alatt'),
      icon: 'gift',
      ps: [T('Everything. There are no locked features during the beta.', 'Minden. A béta alatt nincs zárolt funkció.')],
      cards: [
        { i: 'clock', h: T('Ageing previews', 'Öregedési előnézet'), p: T('Fresh, 1, 10, 30 and 50 years.', 'Friss, 1, 10, 30 és 50 év.') },
        { i: 'chart', h: T('Longevity score', 'Tartóssági pontszám'), p: T('0–100, with reasons.', '0–100, indoklással.') },
        { i: 'spark', h: T('Make it last', 'Tedd tartóssá'), p: T('A sturdier redraw to compare.', 'Tartósabb átrajzolás összehasonlításhoz.') },
        { i: 'laser', h: T('Laser preview', 'Lézeres előnézet'), p: T('After 3, 6 and 10 sessions.', '3, 6 és 10 kezelés után.') },
        { i: 'share', h: T('Videos and vote links', 'Videók és szavazás'), p: T('For TikTok, Reels and friends.', 'TikTokra, Reelsre és a barátaidnak.') },
        { i: 'doc', h: T('PDF for your artist', 'PDF a tetoválónak'), p: T('Design, size and placement.', 'Minta, méret és hely.') },
      ],
    },
    {
      h: T('The monthly allowance', 'A havi keret'),
      icon: 'clock',
      ps: [
        T('Each preview uses real AI computing, so every account gets 30 previews a month. The allowance restarts on the 1st of each month.', 'Minden előnézet valódi MI-számítást igényel, ezért minden fiók havonta 30 előnézetet kap. A keret minden hónap 1-jén újraindul.'),
        T('Invite bonuses come on top of the 30. If you run out, your previews are back on the 1st of next month.', 'A meghívási bónuszok a 30 fölé jönnek. Ha elfogy a keret, a következő hónap 1-jén újra készíthetsz előnézetet.'),
      ],
    },
    {
      h: T('Get more previews', 'Több előnézet'),
      icon: 'heart',
      ps: [T('Sign in and share your invite link from your profile. When a friend joins, you both get bonus previews.', 'Jelentkezz be, és oszd meg a meghívó linkedet a profilodból. Ha egy barátod csatlakozik, mindketten bónusz előnézeteket kaptok.')],
    },
    {
      h: T('After the beta', 'A béta után'),
      icon: 'check',
      ps: [T('If paid features ever arrive, prices will be shown clearly before any purchase, and nothing will be charged without your explicit consent.', 'Ha valaha fizetős funkciók jelennek meg, az árakat minden vásárlás előtt egyértelműen feltüntetjük, és semmit nem terhelünk a kifejezett hozzájárulásod nélkül.')],
    },
  ];
  return (
    <InfoPage
      lang={L}
      path="/ingyenes-beta"
      kicker={T('Beta', 'Béta')}
      kickerIcon="gift"
      title={T('Beta: what’s included and the monthly allowance', 'Béta: mi jár, és mi a havi keret')}
      lede={T('Every feature is open during the beta. Your account gets 30 previews a month, restarting on the 1st.', 'A béta alatt minden funkció elérhető. A fiókod havonta 30 előnézetet kap, a keret minden hónap 1-jén újraindul.')}
      sections={sections}
      highlights={[
        { i: 'gift', h: T('30 a month', 'Havi 30'), p: T('30 previews a month with your account.', 'Fiókkal havonta 30 előnézet.') },
        { i: 'user', h: T('One-tap sign-up', 'Egy koppintásos regisztráció'), p: T('With Google or Apple, or with e-mail.', 'Google- vagy Apple-fiókkal, vagy e-maillel.') },
        { i: 'heart', h: T('Invite bonus', 'Meghívási bónusz'), p: T('Extra previews for you and a friend.', 'Extra előnézet neked és a barátodnak.') },
      ]}
      related={[
        { href: '/funkciok', t: T('Features', 'Funkciók'), p: T('A closer look at each one.', 'Mindegyik közelebbről.'), i: 'spark' },
        { href: '/telepites', t: T('Install the app', 'Telepítés'), p: T('Keep InkAge on your home screen.', 'Tartsd a kezdőképernyőn.'), i: 'phone' },
        { href: '/terms', t: T('Terms of use', 'ÁSZF'), p: T('The rules, in plain words.', 'A szabályok, érthetően.'), i: 'scale' },
      ]}
    />
  );
}
