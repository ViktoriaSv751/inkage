'use client';

import { TryLink } from '../AuthCta';
import { useState } from 'react';
import { IMG } from '@/lib/kb';
import { track } from '@/lib/store';
import { LogoMark } from '../LogoMark';
import type { T } from './types';
import type { Lang } from '@/lib/tr';

/* ------------------------------------------------------------------ who it's for */
export function UseCases({ t, lang }: { t: T; lang?: Lang }) {
  const cases = [
    {
      k: 'first',
      tab: t('My first tattoo', 'Az első tetoválásom'),
      img: 'hf_20261013_094428_03d5223f-83ed-4279-a522-78515046a4c0',
      h: t('Decide calmly, not in the chair.', 'Dönts nyugodtan, ne a széken ülve.'),
      p: t('Try three placements and four sizes on your own photo in an evening. See which one still reads at 30 years, then book with confidence.', 'Egy este alatt kipróbálhatsz három helyet és négy méretet a saját fotódon. Nézd meg, melyik olvasható még 30 év múlva is, és utána foglalj nyugodtan.'),
      pts: [t('Placement and size in real centimetres', 'Hely és méret valós centiméterben'), t('A longevity score that explains itself', 'Tartóssági pontszám, ami meg is indokolja magát'), t('A link so friends can vote', 'Link, amin a barátaid szavazhatnak')],
    },
    {
      k: 'have',
      tab: t('I already have one', 'Már van tetoválásom'),
      img: 'hf_20261013_090713_9a5ab662-392f-41d6-9e0b-52da1e87bfe3',
      h: t('See where your ink is heading.', 'Nézd meg, merre tart a tintád.'),
      p: t('Upload a photo of a tattoo you already have. InkAge cuts it out, and shows how it is likely to look in 10, 30 and 50 years — and when a touch-up would help.', 'Tölts fel egy fotót egy meglévő tetoválásodról. Az InkAge kivágja, és megmutatja, hogyan nézhet ki 10, 30 és 50 év múlva – és mikor segítene egy frissítés.'),
      pts: [t('Smart cut-out from any photo', 'Okos kivágás bármilyen fotóból'), t('Sun and placement taken into account', 'A napfényt és a helyet is figyelembe veszi'), t('Tips to keep it crisp', 'Tippek, hogy éles maradjon')],
    },
    {
      k: 'remove',
      tab: t('Thinking about removal', 'Az eltávolításon gondolkodom'),
      img: 'hf_20261013_094405_e4565f7f-7e3b-459b-a9b4-b763da2af205',
      h: t('Know what removal looks like.', 'Tudd, hogyan néz ki az eltávolítás.'),
      p: t('A laser removal preview after 3, 6 and 10 sessions helps you set realistic expectations — before you talk to a clinic.', 'A 3, 6 és 10 kezelés utáni lézeres előnézet segít reális elvárásokat kialakítani – még mielőtt klinikával beszélnél.'),
      pts: [t('Preview after 3, 6 and 10 sessions', 'Előnézet 3, 6 és 10 kezelés után'), t('Our guide to what to expect', 'Útmutató arról, mire számíts'), t('Always talk to a dermatologist', 'Mindig beszélj bőrgyógyásszal is')],
    },
    {
      k: 'artist',
      tab: t('I’m a tattoo artist', 'Tetováló vagyok'),
      img: 'hf_20261013_094348_fa04678b-2125-4f55-9708-311bbe98a9e9',
      h: t('Show clients why bolder lasts.', 'Mutasd meg a vendégnek, miért tart tovább az erősebb vonal.'),
      p: t('Instead of explaining line spacing, show it: the client’s design on the client’s arm at 30 years, next to your sturdier version.', 'Ahelyett, hogy a vonaltávolságot magyaráznád, mutasd meg: a vendég mintája a vendég karján 30 év múlva, a te tartósabb változatod mellett.'),
      pts: [t('“Make it last” redraw to compare', '„Tedd tartóssá” átrajzolás összehasonlításhoz'), t('One-page PDF with size and placement', 'Egyoldalas PDF mérettel és hellyel'), t('Works on phones, no install needed', 'Telefonon is működik, telepítés nélkül')],
    },
  ];
  const [k, setK] = useState(cases[0].k);
  const c = cases.find((x) => x.k === k)!;
  return (
    <section className="ls-sec lm-uses">
      <div className="ls-head">
        <h2>{t('Made for every kind of tattoo decision.', 'Minden tetoválásos döntéshez.')}</h2>
      </div>
      <div className="lm-tabs" role="tablist">
        {cases.map((x) => (
          <button key={x.k} role="tab" aria-selected={x.k === k} className={x.k === k ? 'on' : ''} onClick={() => (setK(x.k), track('landing_usecase', { k: x.k }))}>
            {x.tab}
          </button>
        ))}
      </div>
      <div className="lm-use" role="tabpanel">
        <div className="lm-use-img">
          <img key={c.img} src={IMG(c.img, 1200)} alt="" loading="lazy" />
        </div>
        <div className="lm-use-txt">
          <h3>{c.h}</h3>
          <p>{c.p}</p>
          <ul>
            {c.pts.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          <TryLink lang={lang} className="btn" onClick={() => track('landing_usecase_cta', { k })}>
            {t('Register and try it', 'Regisztrálok és kipróbálom')}
          </TryLink>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ the details that make it realistic */
const ICONS: Record<string, string> = {
  cut: 'M6 6m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0M6 18m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0M8.1 8.1L20 20M14.5 9.5L20 4M8.1 15.9l3.4-3.4',
  skin: 'M12 3c3 4 6 7 6 11a6 6 0 0 1-12 0c0-4 3-7 6-11z',
  ruler: 'M3 17L17 3l4 4L7 21zM7 13l2 2M10 10l2 2M13 7l2 2',
  tone: 'M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18zM12 3v18',
  body: 'M12 5m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0M8 9h8l-1 6h-2l-1 6-1-6H9z',
  sun: 'M12 12m-4 0a4 4 0 1 0 8 0a4 4 0 1 0-8 0M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
};
export function Precision({ t }: { t: T }) {
  const items = [
    { i: 'cut', h: t('Smart cut-out', 'Okos kivágás'), p: t('Found the tattoo on someone else’s arm? We frame every design in the picture and cut out only the one you choose.', 'Más karján láttad? Minden mintát bekeretezünk a képen, és csak azt vágjuk ki, amelyiket választod.') },
    { i: 'skin', h: t('Only on skin', 'Csak bőrre'), p: t('A skin mask keeps the design off clothes, hair and background — like real ink would.', 'Egy bőrmaszk távol tartja a mintát a ruhától, a hajtól és a háttértől – ahogy a valódi tinta is.') },
    { i: 'ruler', h: t('Real centimetres', 'Valós centiméter'), p: t('Size shows in cm, with one-tap 3, 5, 8, 12 and 20 cm. Tiny detailed pieces get an honest warning.', 'A méret centiméterben látszik, egy koppintással 3, 5, 8, 12 és 20 cm. Apró, részletes mintánál őszinte figyelmeztetést kapsz.') },
    { i: 'tone', h: t('Your skin tone', 'A te bőrtónusod'), p: t('Every stage keeps your own skin tone and lighting, so the result looks like you, not a stock model.', 'Minden stádium megtartja a saját bőrtónusodat és fényeidet, így az eredmény rád hasonlít, nem egy modellre.') },
    { i: 'body', h: t('29 body areas', '29 testrész'), p: t('Pick the spot on a front and back body map; friction and sun for that area shape the result.', 'Válaszd ki a helyet az elöl- és hátulnézeti testtérképen; az adott terület súrlódása és napfénye alakítja az eredményt.') },
    { i: 'sun', h: t('Sun and habits', 'Nap és szokások'), p: t('Tell us how much sun the spot gets. More sun, faster fading — and you will see it.', 'Mondd meg, mennyi nap éri a helyet. Több nap, gyorsabb fakulás – és ezt látni is fogod.') },
  ];
  return (
    <section className="ls-sec lm-prec">
      <div className="ls-head">
        <h2>{t('The details that make it believable.', 'A részletek, amiktől hihető lesz.')}</h2>
      </div>
      <ul className="lm-prec-grid">
        {items.map((x) => (
          <li key={x.i}>
            <span className="lm-ico" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d={ICONS[x.i]} />
              </svg>
            </span>
            <h3>{x.h}</h3>
            <p>{x.p}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------------ compared with the usual ways */
export function CompareTable({ t, lang }: { t: T; lang?: Lang }) {
  const cols = [
    { k: 'imagine', t: t('Imagining it', 'Elképzelés'), s: t('Imagine', 'Fejben') },
    { k: 'sticker', t: t('Temporary sticker', 'Matrica'), s: t('Sticker', 'Matrica') },
    { k: 'sketch', t: t('Artist’s sketch', 'Tetováló vázlata'), s: t('Sketch', 'Vázlat') },
  ];
  const rows: [string, [number, number, number, number]][] = [
    [t('On your own body', 'A saját testeden'), [0, 1, 0, 1]],
    [t('Exact size in cm', 'Pontos méret cm-ben'), [0, 1, 1, 1]],
    [t('Shows 50 years of ageing', 'Megmutatja az 50 év öregedést'), [0, 0, 0, 1]],
    [t('Longevity score with reasons', 'Tartóssági pontszám indoklással'), [0, 0, 0, 1]],
    [t('Compare spots in minutes', 'Helyek összevetése percek alatt'), [0, 0, 0, 1]],
    [t('Friends vote from a link', 'A barátok linken szavaznak'), [0, 0, 0, 1]],
    [t('A human expert’s judgement', 'Szakember személyes véleménye'), [0, 0, 1, 0]],
  ];
  const Mark = ({ on, us }: { on: number; us?: boolean }) =>
    on ? (
      <span className={`cx-yes ${us ? 'us' : ''}`} role="img" aria-label={t('Yes', 'Igen')}>
        <svg viewBox="0 0 24 24">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      </span>
    ) : (
      <span className="cx-no" role="img" aria-label={t('No', 'Nem')} />
    );
  return (
    <section className="ls-sec lm-cx">
      <div className="ls-head">
        <h2>{t('How it compares.', 'Összehasonlítva.')}</h2>
        <p className="lm-sub">{t('InkAge doesn’t replace your artist — it gets you to the consultation with a clearer idea.', 'Az InkAge nem helyettesíti a tetoválót – azt segíti, hogy tisztább elképzeléssel menj a konzultációra.')}</p>
      </div>
      <div className="cx" role="table" aria-label={t('Comparison', 'Összehasonlítás')}>
        <div className="cx-row cx-head" role="row">
          <span role="columnheader" className="cx-f">
            <span className="sr-only">{t('Feature', 'Funkció')}</span>
          </span>
          {cols.map((c) => (
            <span key={c.k} role="columnheader" className="cx-c">
              <span className="cx-long">{c.t}</span>
              <span className="cx-short">{c.s}</span>
            </span>
          ))}
          <span role="columnheader" className="cx-c cx-us">
            <LogoMark />
            <span>InkAge</span>
          </span>
        </div>
        {rows.map(([r, v]) => (
          <div key={r} className="cx-row" role="row">
            <span role="rowheader" className="cx-f">
              {r}
            </span>
            {v.slice(0, 3).map((x, k) => (
              <span key={k} role="cell" className="cx-c">
                <Mark on={x} />
              </span>
            ))}
            <span role="cell" className="cx-c cx-us">
              <Mark on={v[3]} us />
            </span>
          </div>
        ))}
        <div className="cx-row cx-foot" role="row">
          <span role="cell" className="cx-f" />
          <span role="cell" className="cx-c" />
          <span role="cell" className="cx-c" />
          <span role="cell" className="cx-c" />
          <span role="cell" className="cx-c cx-us">
            <TryLink lang={lang} className="cx-try" onClick={() => track('landing_compare_cta')}>
              {t('Register', 'Regisztráció')}
            </TryLink>
          </span>
        </div>
      </div>
    </section>
  );
}
