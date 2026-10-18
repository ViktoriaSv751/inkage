'use client';
import { tx, type Lang } from '@/lib/tr';
import { useEffect, useState } from 'react';
import { EXAMPLE } from '../visuals';

/**
 * The sign-in visual: one real tattoo aging from today to 50 years, on a loop,
 * with the year counter and the timeline the app itself uses.
 */
export function AuthArt({ lang }: { lang: Lang }) {
  const L = (en: string, hu: string) => tx(lang, en, hu);
  const [years, setYears] = useState(0);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return setYears(30);
    // hold fresh → age to 50 → hold → rewind, forever
    const HOLD0 = 1400, AGE = 5600, HOLD1 = 2600, BACK = 1100;
    const T = HOLD0 + AGE + HOLD1 + BACK;
    const ease = (p: number) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);
    const t0 = performance.now();
    let raf = 0;
    const loop = (now: number) => {
      const t = (now - t0) % T;
      const y =
        t < HOLD0 ? 0 : t < HOLD0 + AGE ? ease((t - HOLD0) / AGE) * 50 : t < HOLD0 + AGE + HOLD1 ? 50 : (1 - ease((t - HOLD0 - AGE - HOLD1) / BACK)) * 50;
      setYears(y);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  let i = 0;
  while (i < EXAMPLE.length - 2 && years > EXAMPLE[i + 1].years) i++;
  const a = EXAMPLE[i];
  const b = EXAMPLE[i + 1];
  const f = Math.min(1, Math.max(0, (years - a.years) / (b.years - a.years)));
  // the timeline is spaced by stage, not by year
  const pos = ((i + f) / (EXAMPLE.length - 1)) * 100;
  const shown = Math.round(years);

  return (
    <div className="aa">
      <div className="aa-photo">
        {EXAMPLE.map((e, k) => (
          <img key={e.years} src={e.src} alt="" style={{ opacity: k === i ? 1 : k === i + 1 ? f : 0 }} loading={k === 0 ? 'eager' : 'lazy'} />
        ))}
      </div>
      <div className="aa-shade" />
      <div className="aa-read" aria-hidden="true">
        <span className="aa-num">{shown === 0 ? L('Today', 'Ma') : shown}</span>
        <span className="aa-unit">{shown === 0 ? L('fresh ink', 'friss tinta') : L(shown === 1 ? 'year later' : 'years later', 'év múlva')}</span>
      </div>
      <div className="aa-line" aria-hidden="true">
        <div className="aa-track">
          <i style={{ width: `${pos}%` }} />
          {EXAMPLE.map((e, k) => (
            <b key={e.years} className={k <= i + (f > 0.98 ? 1 : 0) ? 'on' : ''} style={{ left: `${(k / (EXAMPLE.length - 1)) * 100}%` }} />
          ))}
        </div>
        <div className="aa-ticks">
          {EXAMPLE.map((e) => (
            <span key={e.years}>{e.years === 0 ? L('Now', 'Most') : e.years}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
