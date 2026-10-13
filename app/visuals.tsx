'use client';

import { useEffect, useRef, useState } from 'react';
import { useLang } from '@/lib/i18n';

const CDN = 'https://d8j0ntlcm91z4.cloudfront.net/user_3134IoHE3NDDMNENjF96sXtstXg/';
/** Real AI results from the same pipeline the app uses (one test photo, five stages). */
export const EXAMPLE = [
  { years: 0, src: CDN + 'hf_20261012_125250_eb1fedf5-fe1d-4bff-b203-9f7f6e04435f_min.webp' },
  { years: 1, src: CDN + 'hf_20261012_125519_179724fe-1d28-4c42-8531-e5e88ebca25e_min.webp' },
  { years: 10, src: CDN + 'hf_20261012_125518_f59d80bd-88f0-4db2-9d3f-ba894916baae_min.webp' },
  { years: 30, src: CDN + 'hf_20261012_125518_4e9ab330-d2aa-4e98-8837-c163dec3c3d3_min.webp' },
  { years: 50, src: CDN + 'hf_20261012_125519_356de094-5fd9-4c5d-a3d4-2e41892aa5b4_min.webp' },
];

/**
 * Hero: real photos of one tattoo at 0, 1, 10, 30 and 50 years, cross-faded by a year slider.
 * Plays once on load, then the visitor can drag it.
 */
export function HeroAging({ frames = EXAMPLE, alt }: { frames?: { years: number; src: string }[]; alt?: string } = {}) {
  const EX = frames;
  const { lang } = useLang();
  const L = (en: string, hu: string) => (lang === 'hu' ? hu : en);
  const [years, setYears] = useState(0);
  const touched = useRef(false);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setYears(30);
      return;
    }
    let raf = 0;
    const start = performance.now() + 1200;
    const dur = 5200;
    const loop = (now: number) => {
      if (touched.current) return;
      const p = Math.min(1, Math.max(0, (now - start) / dur));
      const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      setYears(e * 50);
      if (p < 1) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // which two photos to blend
  let i = 0;
  while (i < EX.length - 2 && years > EX[i + 1].years) i++;
  const a = EX[i];
  const b = EX[i + 1];
  const f = Math.min(1, Math.max(0, (years - a.years) / (b.years - a.years)));
  const shown = Math.round(years);

  return (
    <div className="hero-demo">
      <div className="photo-stack">
        {EX.map((e, k) => (
          <img
            key={e.years}
            src={e.src}
            alt={k === 0 ? alt || L('A fine-line moon tattoo on a forearm, fresh', 'Finom vonalas hold tetoválás alkaron, frissen') : ''}
            aria-hidden={k !== 0}
            style={{ opacity: k === i ? 1 : k === i + 1 ? f : 0 }}
            loading={k === 0 ? 'eager' : 'lazy'}
          />
        ))}
        <div className="year-readout">
          <span className={`year-num ${shown === 0 ? 'word' : ''}`}>{shown === 0 ? L('Fresh', 'Friss') : shown}</span>
          <span className="year-unit">{shown === 0 ? L('done today', 'ma készült') : L(shown === 1 ? 'year later' : 'years later', 'év múlva')}</span>
        </div>
        <span className="real-tag">{L('Real AI result', 'Valódi MI-eredmény')}</span>
      </div>

      <label className="hero-scrub">
        <span className="sr">Drag to age the tattoo</span>
        <input
          type="range"
          min={0}
          max={500}
          value={Math.round(years * 10)}
          onChange={(e) => {
            touched.current = true;
            setYears(Number(e.target.value) / 10);
          }}
        />
        <span className="scrub-ends">
          <span>{L('Today', 'Ma')}</span>
          <span>{L('50 years', '50 év')}</span>
        </span>
      </label>
    </div>
  );
}

type Spot = { id: string; label: string; x: number; y: number; side: 'front' | 'back' };
const SPOTS: Spot[] = [
  { id: 'Collarbone', label: 'Collarbone', x: 116, y: 96, side: 'front' },
  { id: 'Shoulder', label: 'Shoulder', x: 68, y: 104, side: 'front' },
  { id: 'Upper arm', label: 'Upper arm', x: 54, y: 148, side: 'front' },
  { id: 'Inner forearm', label: 'Inner forearm', x: 160, y: 190, side: 'front' },
  { id: 'Wrist', label: 'Wrist', x: 168, y: 222, side: 'front' },
  { id: 'Hand', label: 'Hand', x: 176, y: 248, side: 'front' },
  { id: 'Ribs', label: 'Ribs', x: 84, y: 160, side: 'front' },
  { id: 'Hip', label: 'Hip', x: 128, y: 232, side: 'front' },
  { id: 'Thigh', label: 'Thigh', x: 84, y: 290, side: 'front' },
  { id: 'Calf', label: 'Calf', x: 120, y: 360, side: 'front' },
  { id: 'Ankle', label: 'Ankle', x: 84, y: 408, side: 'front' },
  { id: 'Back of neck', label: 'Back of neck', x: 100, y: 70, side: 'back' },
  { id: 'Upper back', label: 'Upper back', x: 100, y: 122, side: 'back' },
  { id: 'Spine', label: 'Spine', x: 100, y: 178, side: 'back' },
  { id: 'Outer forearm', label: 'Outer forearm', x: 42, y: 196, side: 'back' },
  { id: 'Lower back', label: 'Lower back', x: 100, y: 222, side: 'back' },
  { id: 'Back of thigh', label: 'Back of thigh', x: 120, y: 292, side: 'back' },
  { id: 'Calf (back)', label: 'Back of calf', x: 80, y: 360, side: 'back' },
];

const FIGURE =
  'M108 63 l0 10 c22 4 40 10 50 22 c8 10 10 40 12 62 c2 22 10 44 18 66 c4 12 6 24 0 28 c-6 3 -10 -4 -12 -12 c-6 -22 -16 -44 -22 -64 c-4 -14 -6 -30 -8 -42 l-2 52 c-2 20 2 40 6 60 c6 40 8 80 4 120 c-2 20 -6 40 -6 56 c0 8 6 12 2 16 c-6 4 -18 2 -22 -4 c-4 -10 0 -30 0 -50 c0 -40 -6 -80 -10 -116 l-4 0 c-4 36 -10 76 -10 116 c0 20 4 40 0 50 c-4 6 -16 8 -22 4 c-4 -4 2 -8 2 -16 c0 -16 -4 -36 -6 -56 c-4 -40 -2 -80 4 -120 c4 -20 8 -40 6 -60 l-2 -52 c-2 12 -4 28 -8 42 c-6 20 -16 42 -22 64 c-2 8 -6 15 -12 12 c-6 -4 -4 -16 0 -28 c8 -22 16 -44 18 -66 c2 -22 4 -52 12 -62 c10 -12 28 -18 50 -22 l0 -10 z';

export function BodyMap({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [side, setSide] = useState<'front' | 'back'>('front');
  const spots = SPOTS.filter((s) => s.side === side);
  return (
    <div className="bodymap">
      <div className="figure">
        <svg viewBox="0 0 200 440" role="group" aria-label={`Body, ${side} view`}>
          <circle cx="100" cy="38" r="23" className="fig" />
          <path d={FIGURE} className="fig" />
          {spots.map((s) => {
            const on = value === s.id;
            return (
              <g key={s.id} className={`spot ${on ? 'on' : ''}`} onClick={() => onChange(s.id)} role="button" tabIndex={0} aria-pressed={on} aria-label={s.label} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onChange(s.id)}>
                <circle cx={s.x} cy={s.y} r="14" className="hit" />
                <circle cx={s.x} cy={s.y} r={on ? 7 : 4.5} className="dot" />
                {on && <circle cx={s.x} cy={s.y} r="12" className="ring" />}
              </g>
            );
          })}
        </svg>
        <div className="flip">
          <button className={side === 'front' ? 'on' : ''} onClick={() => setSide('front')}>
            Front
          </button>
          <button className={side === 'back' ? 'on' : ''} onClick={() => setSide('back')}>
            Back
          </button>
        </div>
      </div>
      <div className="spotlist">
        {spots.map((s) => (
          <button key={s.id} className={value === s.id ? 'on' : ''} onClick={() => onChange(s.id)}>
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
