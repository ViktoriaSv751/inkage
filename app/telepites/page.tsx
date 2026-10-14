import type { Metadata } from 'next';
import { InfoPage, langOf, type InfoSec } from '../_info/InfoPage';

export const dynamic = 'force-dynamic';
export function generateMetadata({ searchParams }: { searchParams: { lang?: string } }): Metadata {
  return { title: langOf(searchParams) === 'hu' ? 'Telepítés a kezdőképernyőre – InkAge' : 'Install InkAge – InkAge' };
}

export default function Page({ searchParams }: { searchParams: { lang?: string } }) {
  const L = langOf(searchParams);
  const T = (en: string, hu: string) => (L === 'hu' ? hu : en);
  const sections: InfoSec[] = [
    {
      h: T('iPhone and iPad', 'iPhone és iPad'),
      icon: 'phone',
      ps: [
        T('1. Open inkage.vercel.app in Safari.', '1. Nyisd meg az inkage.vercel.app oldalt Safariban.'),
        T('2. Tap the Share button (the square with an arrow).', '2. Koppints a Megosztás gombra (négyzet nyíllal).'),
        T('3. Scroll down and choose “Add to Home Screen”.', '3. Görgess le, és válaszd a „Főképernyőhöz adás” lehetőséget.'),
        T('4. Tap “Add”. InkAge appears with its own icon.', '4. Koppints a „Hozzáadás” gombra. Megjelenik az InkAge saját ikonnal.'),
      ],
    },
    {
      h: T('Android', 'Android'),
      icon: 'phone',
      ps: [
        T('1. Open inkage.vercel.app in Chrome.', '1. Nyisd meg az inkage.vercel.app oldalt Chrome-ban.'),
        T('2. Tap the menu (⋮) in the top right.', '2. Koppints a jobb felső menüre (⋮).'),
        T('3. Choose “Install app” or “Add to Home screen”.', '3. Válaszd az „Alkalmazás telepítése” vagy „Hozzáadás a kezdőképernyőhöz” lehetőséget.'),
      ],
    },
    {
      h: T('Computer', 'Számítógép'),
      icon: 'globe',
      ps: [T('In Chrome or Edge, click the install icon at the right end of the address bar, or open the menu and choose “Install InkAge”.', 'Chrome-ban vagy Edge-ben kattints a címsor jobb végén lévő telepítés ikonra, vagy a menüben válaszd az „InkAge telepítése” lehetőséget.')],
    },
    {
      h: T('Why install?', 'Miért érdemes?'),
      icon: 'spark',
      ps: [],
      cards: [
        { i: 'phone', h: T('Full screen', 'Teljes képernyő'), p: T('No browser bars, like a native app.', 'Böngészősávok nélkül, mint egy rendes app.') },
        { i: 'clock', h: T('One tap away', 'Egy koppintásra'), p: T('Open it straight from your home screen.', 'Közvetlenül a kezdőképernyőről nyílik.') },
        { i: 'download', h: T('No app store', 'Nincs alkalmazásbolt'), p: T('Nothing to download or update.', 'Semmit nem kell letölteni vagy frissíteni.') },
        { i: 'lock', h: T('Same privacy', 'Ugyanaz az adatvédelem'), p: T('Signed in, your previews are there too. As a guest on iPhone, the home-screen app has its own storage — sign in first to bring them along.', 'Bejelentkezve ott is megvannak az előnézeteid. iPhone-on vendégként a kezdőképernyős app külön tárhelyet kap – előbb lépj be, hogy átkerüljenek.') },
      ],
    },
  ];
  return (
    <InfoPage
      lang={L}
      path="/telepites"
      kicker={T('Install', 'Telepítés')}
      kickerIcon="phone"
      title={T('InkAge on your home screen.', 'InkAge a kezdőképernyődön.')}
      lede={T('Works like an app, opens full screen — and needs no app store.', 'Úgy működik, mint egy app, teljes képernyőn nyílik – és nem kell hozzá alkalmazásbolt.')}
      sections={sections}
      related={[
        { href: '/hogyan-mukodik', t: T('How it works', 'Hogyan működik'), p: T('Five steps, about a minute.', 'Öt lépés, kb. egy perc.'), i: 'camera' },
        { href: '/ingyenes-beta', t: T('Free beta', 'Ingyenes béta'), p: T('Every feature, free.', 'Minden funkció, ingyen.'), i: 'gift' },
        { href: '/gyik', t: T('FAQ', 'GYIK'), p: T('Quick answers.', 'Gyors válaszok.'), i: 'doc' },
      ]}
    />
  );
}
