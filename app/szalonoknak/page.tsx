import type { Metadata } from 'next';
import { tx } from '@/lib/tr';
import { InfoPage, langOf, type InfoSec } from '../_info/InfoPage';
import { IMG } from '@/lib/kb';
import { B2BPanel } from './B2BPanel';
import { B2BFaq, faqItems } from './B2BFaq';
import './b2b.css';

export const dynamic = 'force-dynamic';
export function generateMetadata({ searchParams }: { searchParams: { lang?: string } }): Metadata {
  const L = langOf(searchParams);
  return {
    title: tx(L, 'InkAge for tattoo studios and laser clinics – plans', 'InkAge tetoválószalonoknak és lézerklinikáknak – csomagok'),
    description: tx(
      L,
      'Show the guest on their own skin how the tattoo will look after 1, 10, 30 and 50 years, or after 3, 6 and 10 laser sessions. Monthly and annual plans, 2-week trial without card.',
      'Mutasd meg a vendégnek a saját bőrén, milyen lesz a tetoválás 1, 10, 30 és 50 év múlva, vagy 3, 6 és 10 lézeres kezelés után. Havi és éves csomagok, 2 hét próba kártya nélkül.'
    ),
    alternates: { canonical: '/szalonoknak' },
  };
}

/* B2B (2026-11-12): tattoo studios and laser clinics, Hungarian first. Linked from the outreach e-mails (?ref=<lead>). */
const STRIP: [string, string, string][] = [
  ['hf_20261013_200843_15e0b201-b6cc-486c-a5a4-9073748b837c', 'Today', 'Ma'],
  ['hf_20261013_200913_a2cc2bf1-1955-4593-a519-529d8a7ff22c', '1 year', '1 év'],
  ['hf_20261013_200914_28a5dcbe-63ae-4431-9e25-28696542dc60', '10 years', '10 év'],
  ['hf_20261013_200914_80587d64-e00b-48e4-a28f-69bc17f1cb6a', '30 years', '30 év'],
  ['hf_20261013_200918_3120c2be-e153-4881-a8f8-04c1cf79fcb4', '50 years', '50 év'],
];

export default function Page({ searchParams }: { searchParams: { ref?: string; lang?: string } }) {
  const L = langOf(searchParams);
  const T = (en: string, hu: string) => tx(L, en, hu);
  const sections: InfoSec[] = [
    {
      h: T('Show what the guest can’t imagine', 'Amit a vendég nem tud elképzelni, azt megmutatod'),
      icon: 'clock',
      ps: [
        T(
          'The guest’s body part is photographed, you pick the design and the size. In about a minute they see it on their own skin: fresh, healed after a year, then after 10, 30 and 50 years.',
          'A vendég testrészéről fotó készül, te kiválasztod a mintát és a méretet. Kb. egy perc múlva látja a saját bőrén: frissen, egy év után gyógyultan, majd 10, 30 és 50 év múlva.'
        ),
        T(
          'If the design is too small or the line too thin, you don’t have to argue: they see what it becomes. It’s easier to steer them to a better size and place, and fewer guests are disappointed years later.',
          'Ha túl kicsi a minta vagy túl vékony a vonal, nem neked kell meggyőznöd: a képen látja, mi lesz belőle. Így könnyebb a jobb méretre és helyre terelni, és kevesebb a csalódott vendég évekkel később.'
        ),
      ],
    },
    {
      h: T('For laser removal', 'Lézeres eltávolításhoz'),
      icon: 'laser',
      ps: [
        T(
          'Clinics: from the guest’s own tattoo you show what to expect after 3, 6 and 10 sessions. In a consultation this says far more than a generic before-and-after picture. It is an AI illustration, not a promise: the real number of sessions varies.',
          'Klinikáknak: a vendég saját tetoválásáról megmutatod, mire számíthat 3, 6 és 10 kezelés után. A konzultáción ez sokkal többet mond, mint egy általános előtte–utána kép. MI-illusztráció, nem ígéret: a valódi kezelésszám változik.'
        ),
      ],
    },
    {
      h: T('How it goes at the counter', 'Így megy a pultnál'),
      icon: 'user',
      cards: [
        { i: 'check', h: T('1. Consent', '1. Hozzájárulás'), p: T('The guest agrees to the photo (one tick; printable form below).', 'A vendég hozzájárul a fotóhoz (egy pipa; nyomtatható minta lent).') },
        { i: 'camera', h: T('2. Photo and design', '2. Fotó és minta'), p: T('Tablet or phone camera, design from your file or the library.', 'Tablet vagy telefon kamerája, minta a saját fájlodból vagy a könyvtárból.') },
        { i: 'clock', h: T('3. About a minute', '3. Kb. 1 perc'), p: T('Every year (or the laser series) is ready.', 'Elkészül az összes év (vagy a lézeres sorozat).') },
        { i: 'share', h: T('4. Send it to the guest', '4. Elküldöd a vendégnek'), p: T('Link, SMS, WhatsApp or a QR code at the counter, with your studio’s name.', 'Link, SMS, WhatsApp vagy QR-kód a pultnál, a szalonod nevével.') },
      ],
      ps: [],
    },
    {
      h: T('Your guests’ photos', 'A vendégeid fotói'),
      icon: 'lock',
      ps: [
        T(
          'The studio decides about its guests’ photos; we only process them to make the previews (data processing terms below). You can set guest photos to be deleted automatically after 30 or 90 days, and delete any of them at any time.',
          'A vendégek fotóiról a szalon dönt, mi csak az előnézet elkészítéséhez dolgozzuk fel őket (adatfeldolgozói feltételek lent). Beállíthatod, hogy a vendégfotók 30 vagy 90 nap után automatikusan törlődjenek, és bármelyiket bármikor törölheted.'
        ),
      ],
    },
  ];
  const faq = faqItems(L);
  const ld = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) };
  return (
    <InfoPage
      lang={L}
      path="/szalonoknak"
      kicker={T('For tattoo studios and laser clinics', 'Tetoválószalonoknak és lézerklinikáknak')}
      kickerIcon="heart"
      title={T('Show the guest what their tattoo will look like in 50 years', 'Mutasd meg a vendégnek, milyen lesz a tetoválása 50 év múlva')}
      lede={T('On their own skin, in their own light. Monthly and annual plans for studios and clinics, with a 2-week trial.', 'A saját bőrén, a saját fényeiben. Havi és éves csomagok szalonoknak és klinikáknak, 2 hét próbával.')}
      sections={sections}
      cta={false}
      numbered={false}
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <div className="b2b-strip" aria-label={T('A real InkAge result: the same tattoo today and after 1, 10, 30, 50 years', 'Valódi InkAge-eredmény: ugyanaz a tetoválás ma és 1, 10, 30, 50 év múlva')}>
        {STRIP.map(([id, en, hu]) => (
          <figure key={id}>
            <img src={IMG(id, 600)} alt={T(`The tattoo – ${en}`, `A tetoválás – ${hu}`)} loading="lazy" />
            <figcaption>{T(en, hu)}</figcaption>
          </figure>
        ))}
      </div>
      <B2BPanel refCode={String(searchParams.ref || '').slice(0, 60)} lang={L} />
      <B2BFaq lang={L} />
      <p className="b2b-legal">
        <a href="/szalonoknak/hozzajarulas">{T('Printable guest consent form', 'Nyomtatható vendég-hozzájárulás')}</a> ·{' '}
        <a href="/szalonoknak/adatfeldolgozas">{T('Data processing terms', 'Adatfeldolgozói feltételek')}</a> · <a href="/terms">{T('Terms', 'ÁSZF')}</a>
      </p>
    </InfoPage>
  );
}
