'use client';
import { useMemo, useState } from 'react';

export type SizeText = {
  heading: string;
  modeLabel: string;
  modes: [string, string];
  chars: string;
  lines: string;
  font: string;
  fonts: string[];
  detail: string;
  details: string[];
  place: string;
  places: string[];
  letter: string;
  width: string;
  height: string;
  minSize: string;
  spread: string;
  note: string;
};

/* rules from the tattoo-size-guide article: letters ≥ ~1 cm (more for script or very thin type); a ten-letter line ≈ 7–10 cm;
   detail bands 3–5 / 5–8 / 8–12 / 12–20 cm; fast-fading spots (hand, finger, wrist, ankle, foot) get about a fifth more */
const FONT_CM = [1.0, 1.3, 1.2];
const DETAIL_CM: [number, number][] = [[3, 5], [5, 8], [8, 12], [12, 20]];
const PLACE_K = [1, 1, 1.2, 1.2, 1];

const r1 = (n: number) => Math.round(n * 2) / 2;

export function SizeCalc({ t }: { t: SizeText }) {
  const [mode, setMode] = useState(0);
  const [chars, setChars] = useState(10);
  const [lines, setLines] = useState(1);
  const [font, setFont] = useState(0);
  const [detail, setDetail] = useState(1);
  const [place, setPlace] = useState(0);
  const r = useMemo(() => {
    const k = PLACE_K[place];
    if (mode === 0) {
      const h = Math.round(FONT_CM[font] * k * 10) / 10;
      const w1 = r1(chars * h * 0.7), w2 = r1(chars * h * 1.0);
      return { h, w1, w2, tall: r1(lines * h * 1.4) };
    }
    const [a, b] = DETAIL_CM[detail];
    return { a: r1(a * k), b: r1(b * k) };
  }, [mode, chars, lines, font, detail, place]);
  const sel = (label: string, v: number, set: (n: number) => void, opts: string[]) => (
    <label className="rc-f">
      <span>{label}</span>
      <select value={v} onChange={(e) => set(Number(e.target.value))}>
        {opts.map((o, i) => (
          <option key={i} value={i}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <section className="rc">
      <h2>{t.heading}</h2>
      <div className="rc-grid">
        {sel(t.modeLabel, mode, setMode, t.modes)}
        {mode === 0 ? (
          <>
            <label className="rc-f">
              <span>{t.chars}</span>
              <input type="number" min={1} max={60} value={chars} onChange={(e) => setChars(Math.max(1, Math.min(60, Number(e.target.value) || 1)))} />
            </label>
            <label className="rc-f">
              <span>{t.lines}</span>
              <input type="number" min={1} max={6} value={lines} onChange={(e) => setLines(Math.max(1, Math.min(6, Number(e.target.value) || 1)))} />
            </label>
            {sel(t.font, font, setFont, t.fonts)}
          </>
        ) : (
          sel(t.detail, detail, setDetail, t.details)
        )}
        {sel(t.place, place, setPlace, t.places)}
      </div>
      <div className="rc-out" aria-live="polite">
        {mode === 0 && 'h' in r ? (
          <>
            <div>
              <small>{t.letter}</small>
              <b>{r.h} cm</b>
            </div>
            <div>
              <small>{t.width}</small>
              <b>
                {r.w1}–{r.w2} cm
              </b>
            </div>
            <div className="rc-total">
              <small>{t.height}</small>
              <b>{r.tall} cm</b>
            </div>
          </>
        ) : (
          'a' in r && (
            <div className="rc-total">
              <small>{t.minSize}</small>
              <b>
                {r.a}–{r.b} cm
              </b>
            </div>
          )
        )}
      </div>
      <p className="rc-score">{t.spread}</p>
      <p className="rc-note">{t.note}</p>
    </section>
  );
}
