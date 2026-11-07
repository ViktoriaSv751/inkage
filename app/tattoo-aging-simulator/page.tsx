import { tx, langOf, type Lang } from '@/lib/tr';
import { webPaymentsOn } from '@/lib/pricing';
import type { Metadata } from 'next';
import { toolAlternates, TOOL_TITLE } from '@/lib/tool-pages';
import { ToolPage, type ToolContent } from '../_tool/ToolPage';

export const dynamic = 'force-dynamic';
const PATH = '/tattoo-aging-simulator';

function content(L: Lang): ToolContent & { meta: string } {
  const T = (en: string, hu: string) => tx(L, en, hu);
  const desc = T(
    'See how a tattoo will look in 10, 30 and 50 years on a photo of your own skin — a new design or one you already have, with a 0–100 longevity score.',
    'Nézd meg, hogyan fog kinézni egy tetoválás 10, 30 és 50 év múlva a saját bőrödről készült fotón – új mintával vagy a meglévő tetoválásoddal, 0–100-as tartóssági pontszámmal.'
  );
  return {
    meta: T('Tattoo aging simulator: see how your tattoo will age', 'Tetoválás öregedés szimulátor: nézd meg, hogyan öregszik a tetoválásod'),
    path: PATH,
    desc,
    kicker: T('Tattoo aging simulator', 'Tetoválás öregedés szimulátor'),
    title: T('How will your tattoo age? See it on your skin.', 'Hogyan fog öregedni a tetoválásod? Nézd meg a bőrödön.'),
    lede: T(
      'InkAge shows a new design or a tattoo you already have at five moments: fresh, healed after a year, and at 10, 30 and 50 years.',
      'Az InkAge egy új mintát vagy a meglévő tetoválásodat öt időpontban mutatja meg: frissen, egy év után gyógyultan, valamint 10, 30 és 50 év múlva.'
    ),
    about: {
      h: T('What the aging simulator shows', 'Mit mutat az öregedés szimulátor'),
      ps: [
        T(
          'Tattoos change slowly. Lines spread a little under the skin, light colours fade first, and fine details that sit close together can merge. Sun and the body area speed this up or slow it down.',
          'A tetoválás lassan változik. A vonalak kicsit szétterülnek a bőr alatt, a világos színek fakulnak először, a közel álló finom részletek pedig összefolyhatnak. A nap és a testrész ezt gyorsítja vagy lassítja.'
        ),
        T(
          'InkAge applies these usual patterns to your own photo. The images keep your skin tone and light, and a 0–100 longevity score lists what helps and what hurts: size, line thickness, colour, placement and sun.',
          'Az InkAge ezeket a szokásos folyamatokat alkalmazza a saját fotódon. A képek megtartják a bőrtónusodat és a fényeidet, a 0–100-as tartóssági pontszám pedig felsorolja, mi segít és mi árt: méret, vonalvastagság, szín, elhelyezés és nap.'
        ),
        T(
          'Already have the tattoo? Upload a photo of it and see where it is heading. Thinking of removal? The same app shows a laser removal preview after 3, 6 and 10 sessions.',
          'Már megvan a tetoválás? Tölts fel róla egy fotót, és nézd meg, merre tart. Eltávolításon gondolkodsz? Ugyanez az app lézeres eltávolítási előnézetet is mutat 3, 6 és 10 kezelés után.'
        ),
        T(
          'The images are AI estimates based on how ink, skin and sun usually behave, not a measurement of your skin and not medical advice.',
          'A képek MI-becslések arról, ahogy a tinta, a bőr és a nap általában viselkedik, nem a bőröd mérései és nem orvosi tanácsok.'
        ),
      ],
    },
    steps: [
      { i: 'camera', h: T('Upload your photo', 'Töltsd fel a fotódat'), p: T('A new design on the spot where it would go, or a photo of a tattoo you already have.', 'Egy új mintát azon a helyen, ahová kerülne, vagy egy fotót a meglévő tetoválásodról.') },
      { i: 'ruler', h: T('Set the size and spot', 'Állítsd be a méretet és a helyet'), p: T('Choose the body area and the size in centimetres; both change how a tattoo ages.', 'Válaszd ki a testrészt és a méretet centiméterben; mindkettő befolyásolja, hogyan öregszik a tetoválás.') },
      { i: 'clock', h: T('Watch the years pass', 'Nézd, ahogy telnek az évek'), p: T('Fresh, 1, 10, 30 and 50 years, with a longevity score and tips for a design that lasts.', 'Friss, 1, 10, 30 és 50 év, tartóssági pontszámmal és tippekkel egy tartósabb mintához.') },
    ],
    faq: [
      [
        T('How will my tattoo look in 20 years?', 'Hogyan fog kinézni a tetoválásom 20 év múlva?'),
        T('InkAge shows 10, 30 and 50 years on your own photo, so 20 years sits between the 10- and 30-year images. Expect softer lines and lighter colours, more so on sun-exposed spots and in small, fine designs.', 'Az InkAge 10, 30 és 50 évet mutat a saját fotódon, így a 20 év a 10 és a 30 éves kép között van. Lágyabb vonalakra és világosabb színekre számíts, főleg napnak kitett helyeken és kicsi, finom mintáknál.'),
      ],
      [
        T('Can I see how my existing tattoo will age?', 'Megnézhetem, hogyan öregszik a meglévő tetoválásom?'),
        T('Yes. Upload a photo of the tattoo you already have and InkAge shows it at 10, 30 and 50 years on your own skin.', 'Igen. Tölts fel egy fotót a meglévő tetoválásodról, és az InkAge megmutatja 10, 30 és 50 év múlva a saját bőrödön.'),
      ],
      [
        T('How accurate is a tattoo aging preview?', 'Mennyire pontos egy tetoválás-öregedési előnézet?'),
        T('It is an AI estimate of how ink, skin and sun usually behave, shown on your own photo — not a measurement of your skin or a guarantee. It is good for comparing sizes, spots and designs; the real result depends on your artist, ink, skin, sun and aftercare.', 'MI-becslés arról, ahogy a tinta, a bőr és a nap általában viselkedik, a saját fotódon megjelenítve – nem a bőröd mérése és nem garancia. Méretek, helyek és minták összehasonlítására jó; a valós eredmény a tetoválódtól, a tintától, a bőrödtől, a naptól és az utókezeléstől függ.'),
      ],
      [
        T('Which tattoos age best?', 'Melyik tetoválás öregszik a legjobban?'),
        T('Bold lines, enough space between details and a size that suits the detail usually age best. Very small, fine designs and light colours blur and fade sooner. The longevity score shows which of these apply to your design, and “Make it last” offers a sturdier redraw to compare.', 'Általában a vastag vonalak, a részletek közötti elég hely és a részletességhez illő méret öregszik a legjobban. A nagyon kicsi, finom minták és a világos színek hamarabb elmosódnak és fakulnak. A tartóssági pontszám megmutatja, ezek közül mi igaz a te mintádra, a „Tedd tartóssá” pedig egy tartósabb átrajzolást ad összehasonlításhoz.'),
      ],
      [
        T('Can it show laser removal results too?', 'A lézeres eltávolítás eredményét is meg tudja mutatni?'),
        T('Yes. InkAge shows a laser removal preview of your tattoo after 3, 6 and 10 sessions, to help you set expectations before you talk to a clinic.', 'Igen. Az InkAge lézeres eltávolítási előnézetet mutat a tetoválásodról 3, 6 és 10 kezelés után, hogy reális elvárásokkal beszélhess a klinikával.'),
      ],
      [
        T('How long does a preview take?', 'Mennyi ideig tart egy előnézet?'),
        (webPaymentsOn ? T('About a minute from photo to preview. Your account comes with one preview to try.', 'Kb. egy perc a fotótól az előnézetig. A fiókoddal egy előnézetet kipróbálhatsz.') : T('About a minute from photo to preview. An account comes with 30 previews a month.', 'Kb. egy perc a fotótól az előnézetig. Fiókkal havonta 30 előnézet jár.')),
      ],
    ],
    related: [
      { href: '/tattoo-simulator', t: T('Tattoo simulator', 'Tetoválás szimulátor'), p: T('Try a tattoo on your own photo.', 'Próbáld fel a tetoválást a saját fotódon.'), i: 'camera' },
      { href: '/tudastar/how-tattoos-age', t: T('How tattoos age', 'Hogyan öregszik a tetoválás'), p: T('The full guide.', 'A teljes útmutató.'), i: 'doc' },
      { href: '/gyik', t: T('FAQ', 'GYIK'), p: T('Quick answers', 'Gyors válaszok'), i: 'spark' },
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
