import type { Metadata } from 'next';
import { InfoPage, langOf, type InfoSec } from '../_info/InfoPage';

export const dynamic = 'force-dynamic';
export function generateMetadata({ searchParams }: { searchParams: { lang?: string } }): Metadata {
  const L = langOf(searchParams);
  return { title: L === 'hu' ? 'Hogyan működik? – InkAge' : 'How it works – InkAge', description: L === 'hu' ? 'Egy fotó, egy minta és nagyjából egy perc: így készül az 50 éves előnézet.' : 'One photo, one design and about a minute: how the 50-year preview is made.' };
}

export default function Page({ searchParams }: { searchParams: { lang?: string } }) {
  const L = langOf(searchParams);
  const T = (en: string, hu: string) => (L === 'hu' ? hu : en);
  const sections: InfoSec[] = [
    {
      h: T('Take a photo of the spot', 'Fotózd le a helyet'),
      img: 'hf_20261013_090754_b336f404-4c34-4ef7-b5ba-a080d341d5db',
      ps: [
        T('Open InkAge and take a photo of the place where the tattoo would go — forearm, calf, shoulder blade, anywhere. You can also pick one from your gallery.', 'Nyisd meg az InkAge-et, és fotózd le azt a helyet, ahová a tetoválás kerülne – alkar, vádli, lapocka, bármi. A galériádból is választhatsz.'),
        T('The app checks the light and focus straight away and finds the bare skin in the picture, so the design is only ever placed on skin.', 'Az app azonnal ellenőrzi a fényt és az élességet, és megkeresi a csupasz bőrt a képen, hogy a minta mindig csak bőrre kerüljön.'),
        T('> Daylight from a window, the spot filling most of the frame and no filters give the most realistic result.', '> Az ablakon beeső nappali fény, a képet nagyrészt kitöltő terület és a szűrők mellőzése adja a legvalósághűbb eredményt.'),
      ],
    },
    {
      h: T('Add any design', 'Adj hozzá bármilyen mintát'),
      img: 'hf_20261013_090744_fa240786-23c2-4080-9014-5773a46c24d8',
      ps: [
        T('Upload a sketch, a screenshot from Pinterest or Instagram, a photo of a design on paper — or a photo of a tattoo on someone else’s body. You can also paste a link or pick from the design library.', 'Tölts fel egy vázlatot, egy Pinterest- vagy Instagram-képernyőfotót, egy papíron lévő mintáról készült fotót – vagy akár valaki más testén lévő tetoválás fotóját. Linket is beilleszthetsz, vagy választhatsz a mintatárból.'),
        T('If the picture contains more than one design, InkAge frames each one and asks which you want. Only the framed part is used — no person, no clothes, no background.', 'Ha a képen több minta is van, az InkAge mindegyiket bekeretezi, és megkérdezi, melyiket szeretnéd. Csak a bekeretezett rész kerül felhasználásra – ember, ruha és háttér nélkül.'),
      ],
    },
    {
      h: T('Place and size it', 'Helyezd el és méretezd'),
      img: 'hf_20261013_094428_03d5223f-83ed-4279-a522-78515046a4c0',
      ps: [
        T('Drag, pinch and rotate the design into place. The editor shows the size in centimetres, with quick buttons for 3, 5, 8, 12 and 20 cm.', 'Húzd, csippentsd és forgasd a mintát a helyére. A szerkesztő centiméterben mutatja a méretet, és vannak gyorsgombok 3, 5, 8, 12 és 20 cm-re.'),
        T('Choose the body area on the body map. Friction and sun differ a lot between, say, a finger and an upper back, and that changes how the design ages.', 'Válaszd ki a testrészt a testtérképen. A súrlódás és a napfény nagyon eltér mondjuk egy ujj és a hát felső része között, és ez megváltoztatja, hogyan öregszik a minta.'),
      ],
    },
    {
      h: T('Watch it age', 'Nézd, hogyan öregszik'),
      img: 'hf_20261013_090713_9a5ab662-392f-41d6-9e0b-52da1e87bfe3',
      ps: [
        T('In about a minute you get realistic images on your own photo: fresh, healed after a year, and at 10, 30 and 50 years.', 'Nagyjából egy perc alatt valósághű képeket kapsz a saját fotódon: frissen, gyógyultan egy év után, valamint 10, 30 és 50 év múlva.'),
        T('Alongside them comes a **longevity score from 0 to 100**, with the reasons that raised or lowered it — line weight, detail at this size, colours, placement and sun.', 'Mellettük egy **0–100-as tartóssági pontszám** is megjelenik, azokkal az okokkal, amelyek emelték vagy csökkentették – vonalvastagság, részletesség ennél a méretnél, színek, hely és napfény.'),
        T('If the design is fragile, “Make it last” redraws it the way an experienced artist might — bolder lines, fewer tiny details — so you can compare both versions side by side.', 'Ha a minta sérülékeny, a „Tedd tartóssá” úgy rajzolja át, ahogy egy tapasztalt tetováló tenné – erősebb vonalakkal, kevesebb apró részlettel –, így a két változatot egymás mellett hasonlíthatod össze.'),
      ],
    },
    {
      h: T('Decide together', 'Döntsetek közösen'),
      img: 'hf_20261013_090754_fed474a4-feac-40fa-928d-47ed6d6cef1a',
      ps: [
        T('Share a link where friends vote “get it”, “change it” or “which one?”, make a short video for TikTok, Reels or Shorts, or download a one-page PDF with the design, size, placement and previews to take to your artist.', 'Ossz meg egy linket, amin a barátaid szavaznak („csináltasd”, „változtass”, „melyiket?”), készíts rövid videót TikTokra, Reelsre vagy Shortsra, vagy töltsd le az egyoldalas PDF-et a mintával, mérettel, hellyel és előnézetekkel, és vidd el a tetoválódnak.'),
      ],
    },
    {
      h: T('Add InkAge to your home screen', 'Tedd ki az InkAge-et a kezdőképernyőre'),
      id: 'telepites',
      ps: [
        T('InkAge works in the browser and can be installed like an app, without an app store.', 'Az InkAge böngészőben működik, és alkalmazásbolt nélkül, appként is telepíthető.'),
        T('### iPhone and iPad', '### iPhone és iPad'),
        T('1. Open inkage.vercel.app in Safari.', '1. Nyisd meg az inkage.vercel.app oldalt Safariban.'),
        T('2. Tap the Share button (the square with an arrow).', '2. Koppints a Megosztás gombra (négyzet nyíllal).'),
        T('3. Choose “Add to Home Screen”, then “Add”.', '3. Válaszd a „Főképernyőhöz adás”, majd a „Hozzáadás” lehetőséget.'),
        T('### Android and desktop', '### Android és számítógép'),
        T('1. Open the browser menu (⋮).', '1. Nyisd meg a böngésző menüjét (⋮).'),
        T('2. Choose “Install app” or “Add to Home screen”.', '2. Válaszd az „Alkalmazás telepítése” vagy a „Hozzáadás a kezdőképernyőhöz” lehetőséget.'),
      ],
    },
    {
      h: T('What it is — and what it isn’t', 'Mi ez – és mi nem'),
      ps: [
        T('Every preview is an AI estimate based on how ink, skin and sun usually behave over time. It is a planning tool for comparing designs, sizes and placements, not a measurement of your skin or a promise of a result.', 'Minden előnézet MI-alapú becslés arról, ahogy a tinta, a bőr és a nap általában viselkedik az idő során. Tervezési eszköz minták, méretek és helyek összehasonlítására – nem a bőröd mérése, és nem ígéret egy eredményre.'),
        T('Your artist’s experience still matters most. InkAge helps you arrive with a clearer idea.', 'A tetoválód tapasztalata továbbra is a legfontosabb. Az InkAge abban segít, hogy tisztább elképzeléssel érkezz.'),
      ],
    },
  ];
  return (
    <InfoPage
      lang={L}
      path="/hogyan-mukodik"
      kicker={T('How it works', 'Hogyan működik?')}
      title={T('From one photo to 50 years, in about a minute.', 'Egy fotótól az 50 évig, nagyjából egy perc alatt.')}
      lede={T('Five steps, no sign-up for your first preview, and nothing leaves your device unless you ask for a preview.', 'Öt lépés, az első előnézethez nem kell regisztráció, és semmi sem hagyja el az eszközödet, amíg nem kérsz előnézetet.')}
      sections={sections}
      toc
      highlights={[
        { i: 'clock', h: T('About a minute', 'Kb. egy perc'), p: T('From photo to five ageing stages.', 'A fotótól az öt öregedési stádiumig.') },
        { i: 'user', h: T('No sign-up', 'Regisztráció nélkül'), p: T('Your first preview needs no account.', 'Az első előnézethez nem kell fiók.') },
        { i: 'spark', h: T('Free in beta', 'Ingyenes a béta alatt'), p: T('Every feature, no card needed.', 'Minden funkció, kártya nélkül.') },
      ]}
      related={[
        { href: '/funkciok', t: T('Features', 'Funkciók'), p: T('Everything InkAge can do.', 'Minden, amit az InkAge tud.'), i: 'spark' },
        { href: '/telepites', t: T('Install the app', 'Telepítés'), p: T('Put InkAge on your home screen.', 'Tedd ki a kezdőképernyőre.'), i: 'phone' },
        { href: '/gyik', t: T('FAQ', 'GYIK'), p: T('Quick answers to common questions.', 'Gyors válaszok a gyakori kérdésekre.'), i: 'doc' },
      ]}
    />
  );
}
