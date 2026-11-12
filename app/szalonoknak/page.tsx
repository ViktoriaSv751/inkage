import type { Metadata } from 'next';
import { InfoPage, type InfoSec } from '../_info/InfoPage';
import { IMG } from '@/lib/kb';
import { B2BForm } from './B2BForm';
import './b2b.css';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'InkAge tetoválószalonoknak és lézerklinikáknak – havidíjas csomagok',
  description: 'Mutasd meg a vendégnek a saját bőrén, milyen lesz a tetoválás 1, 10, 30 és 50 év múlva, vagy 3, 6 és 10 lézeres kezelés után. Havidíjas csomagok, 2 hét próba.',
};

/* B2B (2026-11-12): tattoo studios and laser clinics, Hungarian first. Linked from the outreach e-mails (?ref=<lead>). */
const STRIP: [string, string][] = [
  ['hf_20261013_200843_15e0b201-b6cc-486c-a5a4-9073748b837c', 'Ma'],
  ['hf_20261013_200913_a2cc2bf1-1955-4593-a519-529d8a7ff22c', '1 év'],
  ['hf_20261013_200914_28a5dcbe-63ae-4431-9e25-28696542dc60', '10 év'],
  ['hf_20261013_200914_80587d64-e00b-48e4-a28f-69bc17f1cb6a', '30 év'],
  ['hf_20261013_200918_3120c2be-e153-4881-a8f8-04c1cf79fcb4', '50 év'],
];

export default function Page({ searchParams }: { searchParams: { ref?: string } }) {
  const sections: InfoSec[] = [
    {
      h: 'Amit a vendég nem tud elképzelni, azt megmutatod',
      icon: 'clock',
      ps: [
        'A vendég feltölt egy fotót a testrészéről, te kiválasztod a mintát és a méretet. Kb. egy perc múlva látja a saját bőrén: frissen, egy év után gyógyultan, majd 10, 30 és 50 év múlva.',
        'Ha túl kicsi a minta vagy túl vékony a vonal, nem neked kell meggyőznöd: a képen látja, mi lesz belőle. Így könnyebb a jobb méretre és helyre terelni, és kevesebb a csalódott vendég évekkel később.',
      ],
    },
    {
      h: 'Lézeres eltávolításhoz',
      icon: 'laser',
      ps: [
        'Klinikáknak: a vendég saját tetoválásáról megmutatod, mire számíthat 3, 6 és 10 kezelés után. A konzultáción ez sokkal többet mond, mint egy általános előtte–utána kép.',
      ],
    },
    {
      h: 'Hogyan működik a szalonban',
      icon: 'user',
      cards: [
        { i: 'camera', h: 'Fotó és minta', p: 'Telefonról vagy gépről, a konzultáció közben.' },
        { i: 'clock', h: 'Kb. 1 perc', p: 'Elkészül az összes év (vagy a lézeres sorozat).' },
        { i: 'heart', h: 'A vendégnek elküldöd', p: 'Egy linkkel hazaviheti és megmutathatja.' },
      ],
      ps: [],
    },
  ];
  return (
    <InfoPage lang="hu" path="/szalonoknak" kicker="Tetoválószalonoknak és lézerklinikáknak" kickerIcon="heart" title="Mutasd meg a vendégnek, milyen lesz a tetoválása 50 év múlva" lede="A saját bőrén, a saját fényeiben. Havidíjas csomagok szalonoknak és klinikáknak, 2 hét próbával." sections={sections} cta={false} numbered={false}>
      <div className="b2b-strip" aria-label="Valódi InkAge-eredmény: ugyanaz a tetoválás ma és 1, 10, 30, 50 év múlva">
        {STRIP.map(([id, label]) => (
          <figure key={id}>
            <img src={IMG(id, 600)} alt={`A tetoválás – ${label}`} loading="lazy" />
            <figcaption>{label}</figcaption>
          </figure>
        ))}
      </div>
      <B2BForm refCode={String(searchParams.ref || '').slice(0, 60)} />
    </InfoPage>
  );
}
