import type { Metadata } from 'next';
import { InfoPage, langOf, type InfoSec } from '../_info/InfoPage';

export const dynamic = 'force-dynamic';
export function generateMetadata({ searchParams }: { searchParams: { lang?: string } }): Metadata {
  return { title: langOf(searchParams) === 'hu' ? 'Ingyenes béta – InkAge' : 'Free beta – InkAge' };
}

export default function Page({ searchParams }: { searchParams: { lang?: string } }) {
  const L = langOf(searchParams);
  const T = (en: string, hu: string) => (L === 'hu' ? hu : en);
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
      h: T('The fair daily limit', 'A méltányos napi keret'),
      icon: 'clock',
      ps: [
        T('Each preview uses real AI computing, so we keep a fair daily limit to keep InkAge free for everyone.', 'Minden előnézet valódi MI-számítást igényel, ezért méltányos napi keretet tartunk, hogy az InkAge mindenkinek ingyenes maradhasson.'),
        T('If the day’s limit is reached, leave your e-mail and we’ll tell you as soon as previews are back — usually within a day.', 'Ha a napi keret betelik, add meg az e-mail-címed, és szólunk, amint újra lehet előnézetet készíteni – általában egy napon belül.'),
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
      kicker={T('Free beta', 'Ingyenes béta')}
      kickerIcon="gift"
      title={T('Every feature. Free.', 'Minden funkció. Ingyen.')}
      lede={T('No card, no trial timer, no catch — just a fair daily limit while we’re in beta.', 'Bankkártya, próbaidő és apró betű nélkül – csak egy méltányos napi keret, amíg béta vagyunk.')}
      sections={sections}
      highlights={[
        { i: 'gift', h: T('0 Ft', '0 Ft'), p: T('For everyone during the beta.', 'Mindenkinek a béta alatt.') },
        { i: 'user', h: T('No sign-up', 'Regisztráció nélkül'), p: T('For your first preview.', 'Az első előnézethez.') },
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
