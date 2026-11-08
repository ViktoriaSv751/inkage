'use client';
import { useMemo, useState } from 'react';

export type CalcText = {
  heading: string;
  fields: { key: Field; label: string; opts: string[] }[];
  sizeLabel: string;
  sizes: string[];
  regionLabel: string;
  regions: string[];
  sessions: string;
  months: string;
  perSession: string;
  total: string;
  scoreLine: string; // contains {n}
  note: string;
  locale: string;
};
type Field = 'skin' | 'place' | 'colour' | 'ink' | 'scar' | 'layer';

/* Kirby–Desai points for each option, in the order of the options shown */
const POINTS: Record<Field, number[]> = {
  skin: [1, 2, 3, 4, 5, 6],
  place: [1, 2, 3, 4, 5],
  colour: [1, 2, 3, 4],
  ink: [1, 2, 3, 4],
  scar: [0, 1, 3, 5],
  layer: [0, 2],
};
/* typical price per session (low, high) by size: Europe in EUR, US in USD (see the laser-tattoo-removal-cost article) */
const PRICE: [number, number][][] = [
  [[50, 150], [100, 250], [200, 450], [400, 1000]],
  [[100, 300], [200, 450], [400, 800], [700, 1500]],
];

export function RemovalCalc({ t }: { t: CalcText }) {
  const [v, setV] = useState<Record<Field, number>>({ skin: 1, place: 4, colour: 0, ink: 2, scar: 0, layer: 0 });
  const [size, setSize] = useState(1);
  const [region, setRegion] = useState(0);
  const r = useMemo(() => {
    const score = (Object.keys(POINTS) as Field[]).reduce((s, k) => s + POINTS[k][v[k]], 0);
    const lo = Math.max(2, score - 2), hi = score + 2;
    const [p1, p2] = PRICE[region][size];
    return { score, lo, hi, p1, p2, t1: lo * p1, t2: hi * p2, m1: Math.round((lo * 6) / 4.3), m2: Math.round((hi * 8) / 4.3) };
  }, [v, size, region]);
  const cur = (n: number) => new Intl.NumberFormat(t.locale, { style: 'currency', currency: region ? 'USD' : 'EUR', maximumFractionDigits: 0 }).format(n);
  return (
    <section className="rc">
      <h2>{t.heading}</h2>
      <div className="rc-grid">
        {t.fields.map((f) => (
          <label key={f.key} className="rc-f">
            <span>{f.label}</span>
            <select value={v[f.key]} onChange={(e) => setV({ ...v, [f.key]: Number(e.target.value) })}>
              {f.opts.map((o, i) => (
                <option key={i} value={i}>
                  {o}
                </option>
              ))}
            </select>
          </label>
        ))}
        <label className="rc-f">
          <span>{t.sizeLabel}</span>
          <select value={size} onChange={(e) => setSize(Number(e.target.value))}>
            {t.sizes.map((o, i) => (
              <option key={i} value={i}>
                {o}
              </option>
            ))}
          </select>
        </label>
        <label className="rc-f">
          <span>{t.regionLabel}</span>
          <select value={region} onChange={(e) => setRegion(Number(e.target.value))}>
            {t.regions.map((o, i) => (
              <option key={i} value={i}>
                {o}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="rc-out" aria-live="polite">
        <div>
          <small>{t.sessions}</small>
          <b>
            {r.lo}–{r.hi}
          </b>
        </div>
        <div>
          <small>{t.months}</small>
          <b>
            {r.m1}–{r.m2}
          </b>
        </div>
        <div>
          <small>{t.perSession}</small>
          <b>
            {cur(r.p1)}–{cur(r.p2)}
          </b>
        </div>
        <div className="rc-total">
          <small>{t.total}</small>
          <b>
            {cur(r.t1)}–{cur(r.t2)}
          </b>
        </div>
      </div>
      <p className="rc-score">{t.scoreLine.replace('{n}', String(r.score))}</p>
      <p className="rc-note">{t.note}</p>
    </section>
  );
}
