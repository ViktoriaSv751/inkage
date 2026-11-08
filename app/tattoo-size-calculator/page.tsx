import { tx, langOf, type Lang } from '@/lib/tr';
import type { Metadata } from 'next';
import { toolAlternates, TOOL_TITLE } from '@/lib/tool-pages';
import { SITE_URL } from '@/lib/site';
import { InfoPage } from '../_info/InfoPage';
import { Blocks } from '../tudastar/[slug]/Blocks';
import { SizeCalc, type SizeText } from './SizeCalc';
import '../tattoo-removal-calculator/calc.css';

export const dynamic = 'force-dynamic';
const PATH = '/tattoo-size-calculator';

export function generateMetadata({ searchParams }: { searchParams: { lang?: string } }): Metadata {
  const L = langOf(searchParams);
  return {
    title: tx(L, TOOL_TITLE[PATH], 'Tetoválás méretkalkulátor: mekkora legyen, hogy 20 év múlva is olvasható maradjon') + ' – InkAge',
    description: tx(
      L,
      'How big should your tattoo be? Work out the letter height and length of a word, or the minimum size of a design, so it stays readable as the ink spreads.',
      'Mekkora legyen a tetoválásod? Számold ki a betűmagasságot és a felirat hosszát, vagy egy minta minimális méretét, hogy olvasható maradjon, ahogy a tinta szétterül.'
    ),
    ...toolAlternates(PATH, L, TOOL_TITLE[PATH]),
  };
}

function texts(L: Lang): SizeText {
  const T = (en: string, hu: string) => tx(L, en, hu);
  return {
    heading: T('Your design', 'A mintád'),
    modeLabel: T('What is it?', 'Mi az?'),
    modes: [T('Lettering', 'Felirat'), T('A design or symbol', 'Minta vagy szimbólum')],
    chars: T('Letters in the longest line', 'Betűk a leghosszabb sorban'),
    lines: T('Lines of text', 'Sorok száma'),
    font: T('Typeface', 'Betűtípus'),
    fonts: [T('Simple print letters', 'Egyszerű nyomtatott betűk'), T('Script or ornate', 'Kézírásos vagy díszes'), T('Very thin fine line', 'Nagyon vékony fine line')],
    detail: T('Amount of detail', 'Részletesség'),
    details: [T('Simple symbol, bold shape or silhouette', 'Egyszerű szimbólum, vastag forma vagy sziluett'), T('Motif with a little detail', 'Kevés részletből álló motívum'), T('Several elements, shading or fine detail', 'Több elem, árnyékolás vagy finom részletek'), T('Realism, portrait or a complex scene', 'Realizmus, portré vagy összetett jelenet')],
    place: T('Where will it go?', 'Hová kerül?'),
    places: [T('Upper arm, shoulder or back', 'Felkar, váll vagy hát'), T('Forearm, thigh, calf or ribs', 'Alkar, comb, vádli vagy borda'), T('Wrist or ankle', 'Csukló vagy boka'), T('Hand, finger or foot', 'Kéz, ujj vagy lábfej'), T('Chest, neck or elsewhere', 'Mellkas, nyak vagy máshol')],
    letter: T('Letter height', 'Betűmagasság'),
    width: T('Line length', 'Sor hossza'),
    height: T('Total height', 'Teljes magasság'),
    minSize: T('Recommended size (longest side)', 'Ajánlott méret (a hosszabb oldal)'),
    spread: T('Lines spread roughly 0.1 mm per decade, so after 30 years every line is about 0.3 mm wider and gaps under 1 mm tend to close.', 'A vonalak évtizedenként nagyjából 0,1 mm-t terülnek szét, így 30 év után minden vonal kb. 0,3 mm-rel szélesebb, és az 1 mm-nél szűkebb rések hajlamosak összefolyni.'),
    note: T('Rules of thumb from tattoo artists, not a guarantee. Your artist will judge the final size from the actual design and your skin.', 'Tetoválók ökölszabályai, nem garancia. A végső méretet a tetoválód a konkrét minta és a bőröd alapján ítéli meg.'),
  };
}

export default function Page({ searchParams }: { searchParams: { lang?: string } }) {
  const L = langOf(searchParams);
  const T = (en: string, hu: string) => tx(L, en, hu);
  const about = [
    {
      h: T('Why size decides how a tattoo ages', 'Miért a méret dönti el, hogyan öregszik a tetoválás'),
      ps: [
        T('Ink spreads by about the same amount on a small design as on a large one. On a 20 cm back piece a few tenths of a millimetre go unnoticed; on a 2 cm wrist piece they decide whether the shape stays recognisable.', 'A tinta nagyjából ugyanannyit terül szét egy kis mintán, mint egy nagyon. Egy 20 cm-es hátmintán fel sem tűnik néhány tized milliméter, egy 2 cm-es csuklómintán viszont pont ez dönti el, hogy felismerhető marad-e a forma.'),
        T('So the narrowest gap in the design is what matters: if it is under 1 mm at the planned size, it will probably merge. For lettering that means letters of at least about 1 cm, and more for script.', 'Ezért a minta legszűkebb rése számít: ha a tervezett méretben 1 mm alatt van, valószínűleg összefolyik. Feliratnál ez legalább kb. 1 cm-es betűket jelent, kézírásos betűknél többet.'),
      ],
    },
  ];
  const jsonLd = { '@context': 'https://schema.org', '@type': 'WebApplication', name: T('Tattoo size calculator', 'Tetoválás méretkalkulátor'), url: `${SITE_URL}${PATH}`, applicationCategory: 'DesignApplication', operatingSystem: 'Web', publisher: { '@type': 'Organization', name: 'InkAge' } };
  return (
    <InfoPage
      lang={L}
      path={PATH}
      kicker={T('Calculator', 'Kalkulátor')}
      kickerIcon="ruler"
      title={T('How big should your tattoo be?', 'Mekkora legyen a tetoválásod?')}
      lede={T('Work out the size that keeps your lettering or design readable in 20 and 30 years.', 'Számold ki azt a méretet, amelynél a feliratod vagy a mintád 20 és 30 év múlva is olvasható marad.')}
      related={[
        { href: '/tudastar/tattoo-size-guide', t: T('Tattoo size guide', 'Tetoválás méretútmutató'), p: T('The rules behind the calculator.', 'A kalkulátor mögötti szabályok.'), i: 'ruler' },
        { href: '/tudastar/fine-line-tattoos-aging', t: T('How fine line tattoos age', 'Hogyan öregszik a fine line tetoválás'), p: T('Thin lines over the decades.', 'Vékony vonalak az évtizedek alatt.'), i: 'spark' },
        { href: '/tattoo-aging-simulator', t: T('Tattoo aging simulator', 'Tetoválás öregedés szimulátor'), p: T('See it on your own skin.', 'Nézd meg a saját bőrödön.'), i: 'eye' },
      ]}
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SizeCalc t={texts(L)} />
      {about.map((x) => (
        <section key={x.h} className="ip-sec">
          <div className="ip-sec-txt">
            <h2>{x.h}</h2>
            <Blocks ps={x.ps} figs={{}} tip={T('Tip', 'Tipp')} />
          </div>
        </section>
      ))}
    </InfoPage>
  );
}
