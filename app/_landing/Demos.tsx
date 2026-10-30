'use client';

import { useRef, useState } from 'react';
import { IMG } from '@/lib/kb';
import { track } from '@/lib/store';
import type { T } from './types';

// example photos used only once on the site
const CMP_NEW = 'hf_20261013_200843_f699cd39-8d0a-43e3-9ba7-71b494279840';
const CMP_OLD = 'hf_20261013_200913_5ffd13b1-e537-4454-bb4c-495a2921afcc';
const TL0 = 'hf_20261013_200843_15e0b201-b6cc-486c-a5a4-9073748b837c';
const TL1 = 'hf_20261013_200913_a2cc2bf1-1955-4593-a519-529d8a7ff22c';
const TL2 = 'hf_20261013_200914_28a5dcbe-63ae-4431-9e25-28696542dc60';
const TL3 = 'hf_20261013_200914_80587d64-e00b-48e4-a28f-69bc17f1cb6a';
const TL4 = 'hf_20261013_200918_3120c2be-e153-4881-a8f8-04c1cf79fcb4';

/* ------------------------------------------------------------------ facts strip under the hero */
export function TrustStrip({ t }: { t: T }) {
  const items = [
    { b: '5', s: t('moments: fresh, 1, 10, 30, 50 years', 'időpont: friss, 1, 10, 30, 50 év') },
    { b: '29', s: t('body areas on the body map', 'testrész a testtérképen') },
    { b: '0–100', s: t('longevity score with reasons', 'tartóssági pontszám, indoklással') },
    { b: '~1', s: t('minute from photo to preview', 'perc a fotótól az előnézetig') },
    { b: '30', s: t('previews a month with your account', 'előnézet havonta a fiókoddal') },
  ];
  return (
    <ul className="lm-strip" aria-label={t('InkAge in numbers', 'Az InkAge számokban')}>
      {items.map((x) => (
        <li key={x.s}>
          <b>{x.b}</b>
          <span>{x.s}</span>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ drag to compare fresh vs 50 years */
export function CompareSlider({ t }: { t: T }) {
  const [v, setV] = useState(50);
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef(false);
  const moved = useRef(false);
  const at = (x: number) => {
    const r = box.current!.getBoundingClientRect();
    setV(Math.min(100, Math.max(0, ((x - r.left) / r.width) * 100)));
    if (!moved.current) {
      moved.current = true;
      track('landing_compare');
    }
  };
  return (
    <section className="lm-compare">
      <div className="lm-compare-head">
        <h2>{t('Same tattoo. Fifty years apart.', 'Ugyanaz a tetoválás. Ötven év különbséggel.')}</h2>
        <p>{t('Drag the line. Left is the day it was done, right is half a century of sun, skin and time — on the same arm.', 'Húzd a vonalat. Balra az elkészülés napja, jobbra fél évszázad nap, bőr és idő – ugyanazon a karon.')}</p>
      </div>
      <div
        className="lm-cmp"
        ref={box}
        onPointerDown={(e) => {
          drag.current = true;
          (e.target as Element).setPointerCapture?.(e.pointerId);
          at(e.clientX);
        }}
        onPointerMove={(e) => drag.current && at(e.clientX)}
        onPointerUp={() => (drag.current = false)}
        onPointerCancel={() => (drag.current = false)}
      >
        <img src={IMG(CMP_OLD, 1600)} alt={t('The tattoo after 50 years', 'A tetoválás 50 év múlva')} draggable={false} loading="lazy" />
        <div className="lm-cmp-top" style={{ clipPath: `inset(0 ${100 - v}% 0 0)` }}>
          <img src={IMG(CMP_NEW, 1600)} alt={t('The tattoo on day one', 'A tetoválás az első napon')} draggable={false} loading="lazy" />
        </div>
        <span className="lm-cmp-lab l">{t('Fresh', 'Friss')}</span>
        <span className="lm-cmp-lab r">{t('50 years', '50 év')}</span>
        <div className="lm-cmp-line" style={{ left: `${v}%` }}>
          <span
            role="slider"
            tabIndex={0}
            aria-label={t('Compare fresh and 50 years', 'Friss és 50 éves összehasonlítás')}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(v)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowLeft') setV((x) => Math.max(0, x - 5));
              if (e.key === 'ArrowRight') setV((x) => Math.min(100, x + 5));
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9 6l-6 6 6 6M15 6l6 6-6 6" />
            </svg>
          </span>
        </div>
      </div>
      <p className="lm-note">{t('Example made with InkAge. Previews are AI estimates, not a guarantee.', 'InkAge-dzsel készült példa. Az előnézetek MI-becslések, nem garanciák.')}</p>
    </section>
  );
}

/* ------------------------------------------------------------------ what happens at each moment */
export function AgingTimeline({ t }: { t: T }) {
  const stops = [
    { y: t('Day 1', '1. nap'), n: '0', img: IMG(TL0, 1000), h: t('Fresh', 'Friss'), p: t('Sharp, dark and slightly raised. This is the version most photos show — and the one that lasts the shortest.', 'Éles, sötét és kicsit kiemelkedő. A legtöbb fotó ezt mutatja – és ez tart a legrövidebb ideig.') },
    { y: t('1 year', '1 év'), n: '1', img: IMG(TL1, 1000), h: t('Healed', 'Gyógyult'), p: t('The top layer of skin has renewed. Lines look a touch softer and lighter than on day one.', 'A bőr felső rétege megújult. A vonalak kicsit lágyabbnak és világosabbnak tűnnek, mint az első napon.') },
    { y: t('10 years', '10 év'), n: '10', img: IMG(TL2, 1000), h: t('Settled', 'Beállt'), p: t('Fine details start to soften; light colours fade first, especially where the sun reaches.', 'A finom részletek lágyulni kezdenek; a világos színek fakulnak először, főleg ahol éri a nap.') },
    { y: t('30 years', '30 év'), n: '30', img: IMG(TL3, 1000), h: t('Mature', 'Érett'), p: t('Lines closer than about 1 mm may have merged. Bold, spaced designs still read clearly.', 'A kb. 1 mm-nél közelebbi vonalak összefolyhattak. A vastag, levegős minták még jól olvashatók.') },
    { y: t('50 years', '50 év'), n: '50', img: IMG(TL4, 1000), h: t('A lifetime', 'Egy élet'), p: t('Skin itself has aged and carries the ink with it. Strong outlines are what keep the shape.', 'Maga a bőr is öregedett, és viszi magával a tintát. Az erős kontúr az, ami megtartja a formát.') },
  ];
  const [i, setI] = useState(0);
  const s = stops[i];
  return (
    <section className="ls-sec lm-time">
      <div className="ls-head">
        <h2>{t('What changes, and when.', 'Mi változik, és mikor.')}</h2>
        <p className="lm-sub">{t('InkAge renders five moments, each based on how ink, skin and sun usually behave over time.', 'Az InkAge öt időpontot jelenít meg, mindegyiket aszerint, ahogy a tinta, a bőr és a nap általában viselkedik az idő során.')}</p>
      </div>

      {/* phone: swipeable cards */}
      <ol className="lm-tl">
        {stops.map((x) => (
          <li key={x.y}>
            <div className="lm-tl-img">
              <img src={x.img} alt="" loading="lazy" />
              <span>{x.y}</span>
            </div>
            <h3>{x.h}</h3>
            <p>{x.p}</p>
          </li>
        ))}
      </ol>

      {/* desktop: one large picture driven by a vertical timeline */}
      <div className="lm-tlx">
        <div className="lm-tlx-pic">
          {stops.map((x, k) => (
            <img key={x.y} src={x.img} alt={k === i ? x.h : ''} aria-hidden={k !== i} loading="lazy" style={{ opacity: k === i ? 1 : 0 }} />
          ))}
          <div className="lm-tlx-badge">
            <b>{s.n === '0' ? t('Fresh', 'Friss') : s.n}</b>
            <span>{s.n === '0' ? t('done today', 'ma készült') : t('years later', 'év múlva')}</span>
          </div>
        </div>
        <ol className="lm-tlx-list" role="tablist" aria-orientation="vertical" style={{ ['--p' as any]: i / (stops.length - 1) }}>
          {stops.map((x, k) => (
            <li key={x.y}>
              <button role="tab" aria-selected={k === i} className={k === i ? 'on' : k < i ? 'past' : ''} onMouseEnter={() => setI(k)} onFocus={() => setI(k)} onClick={() => setI(k)}>
                <span className="lm-dot" aria-hidden="true" />
                <span className="lm-tlx-y">{x.y}</span>
                <b>{x.h}</b>
                <p>{x.p}</p>
              </button>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
