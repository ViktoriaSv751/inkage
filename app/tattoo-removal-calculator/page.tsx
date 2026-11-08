import { tx, langOf, localeOf, type Lang } from '@/lib/tr';
import type { Metadata } from 'next';
import { toolAlternates, TOOL_TITLE } from '@/lib/tool-pages';
import { SITE_URL } from '@/lib/site';
import { InfoPage, type InfoSec } from '../_info/InfoPage';
import { RemovalCalc, type CalcText } from './RemovalCalc';
import { Blocks } from '../tudastar/[slug]/Blocks';
import './calc.css';

export const dynamic = 'force-dynamic';
const PATH = '/tattoo-removal-calculator';

export function generateMetadata({ searchParams }: { searchParams: { lang?: string } }): Metadata {
  const L = langOf(searchParams);
  return {
    title: tx(L, TOOL_TITLE[PATH], 'Lézeres tetoválás-eltávolítás kalkulátor: hány alkalom és mennyibe kerül') + ' – InkAge',
    description: tx(
      L,
      'Estimate how many laser sessions your tattoo needs (Kirby–Desai scale), how long it takes and the total cost by size, in euros or dollars.',
      'Becsüld meg, hány lézeres alkalom kell a tetoválásodhoz (Kirby–Desai skála), mennyi ideig tart és mennyibe kerül összesen méret szerint, euróban vagy dollárban.'
    ),
    ...toolAlternates(PATH, L, TOOL_TITLE[PATH]),
  };
}

function texts(L: Lang): CalcText {
  const T = (en: string, hu: string) => tx(L, en, hu);
  return {
    heading: T('Your tattoo', 'A tetoválásod'),
    fields: [
      { key: 'skin', label: T('Skin type (Fitzpatrick)', 'Bőrtípus (Fitzpatrick)'), opts: [T('I – very fair, always burns', 'I – nagyon világos, mindig leég'), T('II – fair, usually burns', 'II – világos, általában leég'), T('III – medium, sometimes burns', 'III – közepes, néha leég'), T('IV – olive, rarely burns', 'IV – olajbarna, ritkán ég le'), T('V – brown, very rarely burns', 'V – barna, nagyon ritkán ég le'), T('VI – deeply pigmented', 'VI – erősen pigmentált')] },
      { key: 'place', label: T('Where is it?', 'Hol van?'), opts: [T('Head or neck', 'Fej vagy nyak'), T('Chest, upper back or shoulder', 'Mellkas, felső hát vagy váll'), T('Stomach, lower back or hips', 'Has, derék vagy csípő'), T('Upper arm or thigh', 'Felkar vagy comb'), T('Forearm, wrist, hand, lower leg, ankle or foot', 'Alkar, csukló, kéz, lábszár, boka vagy lábfej')] },
      { key: 'colour', label: T('Colours', 'Színek'), opts: [T('Black only', 'Csak fekete'), T('Mostly black with some red', 'Főleg fekete, kevés piros'), T('Black and red with some other colours', 'Fekete és piros, néhány más színnel'), T('Many colours', 'Sok szín')] },
      { key: 'ink', label: T('Amount of ink', 'Tinta mennyisége'), opts: [T('Amateur or home-made', 'Amatőr vagy házi készítésű'), T('Thin line work', 'Vékony vonalas munka'), T('Moderate shading', 'Közepes árnyékolás'), T('Dense shading or solid fill', 'Sűrű árnyékolás vagy tömör kitöltés')] },
      { key: 'scar', label: T('Scarring', 'Hegesedés'), opts: [T('None', 'Nincs'), T('Minimal', 'Minimális'), T('Moderate', 'Közepes'), T('Significant', 'Jelentős')] },
      { key: 'layer', label: T('Is it a cover-up?', 'Cover-up (régi tetoválás fölött)?'), opts: [T('No', 'Nem'), T('Yes, over an older tattoo', 'Igen, egy régebbi fölött')] },
    ],
    sizeLabel: T('Size', 'Méret'),
    sizes: [T('Small, up to about 5 cm', 'Kicsi, kb. 5 cm-ig'), T('Medium, around 10 cm', 'Közepes, kb. 10 cm'), T('Large, up to about 25 cm', 'Nagy, kb. 25 cm-ig'), T('Very large (half sleeve or more)', 'Nagyon nagy (fél kar vagy több)')],
    regionLabel: T('Prices for', 'Árak'),
    regions: [T('Europe (EUR)', 'Európa (EUR)'), T('United States (USD)', 'Egyesült Államok (USD)')],
    sessions: T('Sessions', 'Alkalmak'),
    months: T('Months in total', 'Hónap összesen'),
    perSession: T('Per session', 'Alkalmanként'),
    total: T('Estimated total', 'Becsült végösszeg'),
    scoreLine: T('Kirby–Desai score: {n} points (roughly the number of sessions, give or take two).', 'Kirby–Desai pontszám: {n} pont (nagyjából az alkalmak száma, plusz-mínusz kettő).'),
    note: T(
      'A planning estimate from a published scoring system and typical clinic prices, not a quote. Picosecond lasers and individual skin can change the numbers; a qualified clinic should assess your tattoo in person.',
      'Tervezési becslés egy publikált pontrendszer és tipikus klinikai árak alapján, nem árajánlat. A pikoszekundumos lézer és az egyéni bőr módosíthatja a számokat; a tetoválásodat egy szakképzett klinikának kell személyesen felmérnie.'
    ),
    locale: localeOf(L),
  };
}

export default function Page({ searchParams }: { searchParams: { lang?: string } }) {
  const L = langOf(searchParams);
  const T = (en: string, hu: string) => tx(L, en, hu);
  const sections: InfoSec[] = [
    {
      h: T('How the estimate works', 'Hogyan számol a kalkulátor'),
      icon: 'chart',
      ps: [
        T(
          'The number of sessions comes from the **Kirby–Desai scale**, published by dermatologists in 2009. It adds points for skin type, location, colours, amount of ink, scarring and layering; the total roughly matches the sessions patients needed.',
          'Az alkalmak száma a **Kirby–Desai skálából** jön, amelyet bőrgyógyászok publikáltak 2009-ben. Pontokat ad a bőrtípusra, a helyre, a színekre, a tinta mennyiségére, a hegesedésre és a rétegzésre; az összeg nagyjából megfelel annak, ahány alkalomra a pácienseknek szükségük volt.'
        ),
        T(
          'The price per session is a typical range by size, from published clinic prices. Sessions are usually six to eight weeks apart, which is where the months come from.',
          'Az alkalmankénti ár méret szerinti tipikus sáv, közzétett klinikai árak alapján. Az alkalmak között általában hat-nyolc hét telik el, ebből jön ki a hónapok száma.'
        ),
      ],
    },
    {
      h: T('Why your clinic may say something different', 'Miért mondhat mást a klinikád'),
      icon: 'laser',
      ps: [
        T(
          'Picosecond lasers can clear some colours faster, cheap offers may need more sessions, and prices vary two- to three-fold between countries and cities. Packages often take 10–20% off. Always compare the total, not the price of one session.',
          'A pikoszekundumos lézer egyes színeket gyorsabban eltüntethet, az olcsó ajánlatok több alkalmat igényelhetnek, és az árak országonként és városonként két-háromszoros eltérést mutatnak. A csomagok gyakran 10–20% kedvezményt adnak. Mindig a végösszeget hasonlítsd össze, ne egy alkalom árát.'
        ),
      ],
    },
  ];
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: T('Laser tattoo removal calculator', 'Lézeres tetoválás-eltávolítás kalkulátor'),
    url: `${SITE_URL}${PATH}`,
    applicationCategory: 'HealthApplication',
    operatingSystem: 'Web',
    publisher: { '@type': 'Organization', name: 'InkAge' },
  };
  return (
    <InfoPage
      lang={L}
      path={PATH}
      kicker={T('Calculator', 'Kalkulátor')}
      kickerIcon="laser"
      title={T('How many sessions, and what will it cost?', 'Hány alkalom, és mennyibe kerül?')}
      lede={T('Answer six questions about your tattoo to estimate the number of laser sessions, the time and the total price.', 'Válaszolj hat kérdésre a tetoválásodról, és megbecsüljük a lézeres alkalmak számát, az időt és a teljes árat.')}
      related={[
        { href: '/tudastar/laser-tattoo-removal-cost', t: T('How much laser tattoo removal costs', 'Mennyibe kerül a lézeres eltávolítás'), p: T('Prices by size, sessions and total.', 'Árak méret, alkalmak és végösszeg szerint.'), i: 'chart' },
        { href: '/tudastar/laser-removal-how-many-sessions', t: T('How many sessions you need', 'Hány alkalom kell'), p: T('The Kirby–Desai scale with examples.', 'A Kirby–Desai skála példákkal.'), i: 'clock' },
        { href: '/tudastar/laser-tattoo-removal-what-to-expect', t: T('Laser removal: what to expect', 'Lézeres eltávolítás: mire számíts'), p: T('How it works, step by step.', 'Hogyan működik, lépésről lépésre.'), i: 'laser' },
      ]}
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <RemovalCalc t={texts(L)} />
      {sections.map((x) => (
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
