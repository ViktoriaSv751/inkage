import { tx, langOf, type Lang } from '@/lib/tr';
import type { Metadata } from 'next';
import { toolAlternates, TOOL_TITLE } from '@/lib/tool-pages';
import { ToolPage, type ToolContent } from '../_tool/ToolPage';

export const dynamic = 'force-dynamic';
const PATH = '/tattoo-simulator';

function content(L: Lang): ToolContent & { meta: string } {
  const T = (en: string, hu: string) => tx(L, en, hu);
  const desc = T(
    'Try a tattoo on a photo of your own body before you get it. Place any design at real size, then see it fresh and at 10, 30 and 50 years.',
    'Próbáld fel a tetoválást a saját testedről készült fotón, mielőtt elkészíttetnéd. Tedd fel bármelyik mintát valós méretben, és nézd meg frissen, valamint 10, 30 és 50 év múlva.'
  );
  return {
    meta: T('Tattoo simulator: see a tattoo on your own body before you get it', 'Tetoválás szimulátor: nézd meg a tetoválást a saját testeden, mielőtt elkészíttetnéd'),
    path: PATH,
    desc,
    kicker: T('Tattoo simulator', 'Tetoválás szimulátor'),
    title: T('See a tattoo on your body before you get it.', 'Nézd meg a tetoválást a testeden, mielőtt elkészül.'),
    lede: T(
      'Photograph the spot, add any design, and InkAge shows it on your own skin — and how it will look in 10, 30 and 50 years.',
      'Fotózd le a helyet, adj hozzá bármilyen mintát, és az InkAge megmutatja a saját bőrödön – és azt is, hogyan fog kinézni 10, 30 és 50 év múlva.'
    ),
    about: {
      h: T('What the tattoo simulator does', 'Mit csinál a tetoválás szimulátor'),
      ps: [
        T(
          'InkAge is a tattoo try-on app. You take or upload a photo of the place where the tattoo would go and add a design: a photo, a screenshot, a sketch or a design from the InkAge library. Then you move, resize and rotate it on your skin, with the size shown in centimetres.',
          'Az InkAge egy tetoválás-felpróbáló app. Lefotózod vagy feltöltöd azt a helyet, ahová a tetoválás kerülne, és hozzáadsz egy mintát: fotót, képernyőfotót, vázlatot vagy egy mintát az InkAge mintatárából. Utána a bőrödön mozgatod, méretezed és forgatod, a méretet centiméterben látod.'
        ),
        T(
          'AI then draws the design into your photo, keeping your skin tone, your light and the shape of your body, so it looks like a tattoo, not a sticker. The same preview shows it healed after a year and at 10, 30 and 50 years.',
          'Ezután a mesterséges intelligencia belerajzolja a mintát a fotódba, megtartva a bőrtónusodat, a fényeidet és a tested formáját, így tetoválásnak látszik, nem matricának. Ugyanaz az előnézet megmutatja egy év után gyógyultan, valamint 10, 30 és 50 év múlva is.'
        ),
        T(
          'It is an AI estimate, not a promise. Your artist, the ink, your skin, sun and aftercare decide the real result. Use the preview to compare sizes, spots and designs, and to talk them through with your artist.',
          'Ez MI-becslés, nem ígéret. A valós eredményt a tetoválód, a tinta, a bőröd, a nap és az utókezelés dönti el. Az előnézettel méreteket, helyeket és mintákat hasonlíthatsz össze, és átbeszélheted őket a tetoválóddal.'
        ),
      ],
    },
    steps: [
      { i: 'camera', h: T('Photograph the spot', 'Fotózd le a helyet'), p: T('Daylight, the area in focus. The app checks light and focus and finds the bare skin.', 'Nappali fény, éles kép. Az app ellenőrzi a fényt és az élességet, és megkeresi a csupasz bőrt.') },
      { i: 'ruler', h: T('Add and place the design', 'Tedd fel a mintát'), p: T('A photo, screenshot, sketch or library design. Drag, pinch and rotate it into place at real size.', 'Fotó, képernyőfotó, vázlat vagy minta a mintatárból. Húzd, méretezd és forgasd a helyére, valós méretben.') },
      { i: 'eye', h: T('See it on your skin', 'Nézd meg a bőrödön'), p: T('In about a minute: realistic images fresh, healed and at 10, 30 and 50 years, with a 0–100 longevity score.', 'Kb. egy perc alatt: valósághű képek frissen, gyógyultan, valamint 10, 30 és 50 év múlva, 0–100-as tartóssági pontszámmal.') },
    ],
    faq: [
      [
        T('Can I see a tattoo on my body before getting it?', 'Megnézhetem a tetoválást a testemen, mielőtt elkészíttetném?'),
        T('Yes. Photograph the spot, add the design and place it at the size you want. InkAge draws it into your photo, so you see it on your own skin, not on a model.', 'Igen. Fotózd le a helyet, add hozzá a mintát, és tedd fel a kívánt méretben. Az InkAge belerajzolja a fotódba, így a saját bőrödön látod, nem egy modellén.'),
      ],
      [
        T('Which designs can I try on?', 'Milyen mintákat próbálhatok fel?'),
        T('Any image: a photo of someone else’s tattoo, a screenshot, a sketch, or a design from the InkAge library. If a photo shows several tattoos, you pick one and only that design is cut out.', 'Bármilyen képet: más tetoválásáról készült fotót, képernyőfotót, vázlatot vagy mintát az InkAge mintatárából. Ha egy fotón több tetoválás van, kiválasztod az egyiket, és csak azt vágjuk ki.'),
      ],
      [
        T('Can I try different sizes and body areas?', 'Kipróbálhatok különböző méreteket és testrészeket?'),
        T('Yes. You set the size in centimetres and can make new previews on other spots. An account comes with 30 previews a month.', 'Igen. A méretet centiméterben állítod be, és más helyekre is készíthetsz új előnézetet. Fiókkal havonta 30 előnézet jár.'),
      ],
      [
        T('Can I try a tattoo I already have?', 'Kipróbálhatom egy meglévő tetoválásomon?'),
        T('Yes. Upload a photo of your existing tattoo to see how it will age, or to see a laser removal preview after 3, 6 and 10 sessions.', 'Igen. Tölts fel egy fotót a meglévő tetoválásodról, és nézd meg, hogyan fog öregedni, vagy nézz lézeres eltávolítási előnézetet 3, 6 és 10 kezelés után.'),
      ],
      [
        T('How realistic is the result?', 'Mennyire valósághű az eredmény?'),
        T('The images keep your skin tone, light and body shape, so they look like a real tattoo on you. They are still AI estimates, not a guarantee: the real tattoo depends on your artist, the ink, your skin and aftercare.', 'A képek megtartják a bőrtónusodat, a fényeidet és a tested formáját, így valódi tetoválásnak látszanak rajtad. Ettől még MI-becslések, nem garanciák: a valódi tetoválás a tetoválódtól, a tintától, a bőrödtől és az utókezeléstől függ.'),
      ],
      [
        T('What do I need to start?', 'Mi kell az induláshoz?'),
        T('An account (one tap with Google or Apple, or e-mail) and a photo. InkAge runs in the browser on phones and computers, so there is nothing to install.', 'Egy fiók (egy koppintás Google- vagy Apple-fiókkal, vagy e-maillel) és egy fotó. Az InkAge böngészőben fut telefonon és számítógépen, így semmit nem kell telepíteni.'),
      ],
    ],
    related: [
      { href: '/tattoo-aging-simulator', t: T('Tattoo aging simulator', 'Tetoválás öregedés szimulátor'), p: T('How your tattoo will age.', 'Hogyan öregszik a tetoválásod.'), i: 'clock' },
      { href: '/hogyan-mukodik', t: T('How it works', 'Hogyan működik'), p: T('Five steps, about a minute.', 'Öt lépés, kb. egy perc.'), i: 'camera' },
      { href: '/gyik', t: T('FAQ', 'GYIK'), p: T('Quick answers', 'Gyors válaszok'), i: 'doc' },
    ],
  };
}

export function generateMetadata({ searchParams }: { searchParams: { lang?: string } }): Metadata {
  const L = langOf(searchParams);
  const c = content(L);
  return {
    title: `${c.meta} – InkAge`,
    description: c.desc,
    openGraph: { title: c.meta, description: c.desc, type: 'website' },
    ...toolAlternates(PATH, L, TOOL_TITLE[PATH]),
  };
}

export default function Page({ searchParams }: { searchParams: { lang?: string } }) {
  const L = langOf(searchParams);
  return <ToolPage lang={L} c={content(L)} />;
}
