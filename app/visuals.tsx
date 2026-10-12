'use client';

import { useEffect, useRef, useState } from 'react';

/** Map 0..1 slider position to years, front-loaded so early change is visible. */
export const toYears = (t: number) => Math.round(50 * t * t * 0.55 + 50 * t * 0.45);

/**
 * Hero: an illustrated forearm whose fine-line tattoo ages 0 → 50 years.
 * Plays once on load, then the visitor can drag it.
 */
export function HeroAging() {
  const [t, setT] = useState(0);
  const touched = useRef(false);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setT(0.62);
      return;
    }
    let raf = 0;
    const start = performance.now() + 900;
    const dur = 4200;
    const loop = (now: number) => {
      if (touched.current) return;
      const p = Math.min(1, Math.max(0, (now - start) / dur));
      const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      setT(e);
      if (p < 1) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const years = toYears(t);
  const blur = 0.15 + t * 2.6;
  const spread = 1 + t * 0.9;
  const inkOpacity = 0.96 - t * 0.38;
  const redness = Math.max(0, 1 - t * 14);
  const wrinkles = Math.max(0, (t - 0.35) / 0.65);
  const spots = Math.max(0, (t - 0.55) / 0.45);
  // ink colour drifts from near-black to blue-grey
  const lerp = (a: number, b: number) => Math.round(a + (b - a) * t);
  const ink = `rgb(${lerp(21, 96)}, ${lerp(18, 112)}, ${lerp(43, 146)})`;

  return (
    <div className="hero-demo">
      <div className="arm-wrap" aria-hidden="true">
        <svg viewBox="0 0 420 520" className="arm">
          <defs>
            <linearGradient id="skin" x1="0" x2="1">
              <stop offset="0" stopColor="#c98f74" />
              <stop offset=".45" stopColor="#e7b79c" />
              <stop offset=".8" stopColor="#dca286" />
              <stop offset="1" stopColor="#b97c62" />
            </linearGradient>
            <radialGradient id="red" cx=".5" cy=".5" r=".5">
              <stop offset=".55" stopColor="#e0483b" stopOpacity=".38" />
              <stop offset="1" stopColor="#e0483b" stopOpacity="0" />
            </radialGradient>
            <filter id="age" x="-20%" y="-20%" width="140%" height="140%">
              <feMorphology operator="dilate" radius={spread - 1} />
              <feGaussianBlur stdDeviation={blur} />
            </filter>
            <clipPath id="armclip">
              <path d="M120 0 C 108 120, 96 260, 104 520 L 316 520 C 322 300, 312 140, 300 0 Z" />
            </clipPath>
          </defs>
          <path d="M120 0 C 108 120, 96 260, 104 520 L 316 520 C 322 300, 312 140, 300 0 Z" fill="url(#skin)" />
          <g clipPath="url(#armclip)">
            {/* fresh redness */}
            <ellipse cx="210" cy="250" rx="118" ry="150" fill="url(#red)" opacity={redness} />
            {/* tattoo: fine-line moon, sun rays and stars */}
            <g filter="url(#age)" stroke={ink} fill="none" strokeLinecap="round" opacity={inkOpacity}>
              <circle cx="210" cy="240" r="58" strokeWidth="2.6" />
              <path d="M232 196 a52 52 0 1 0 0 88 a44 44 0 1 1 0 -88z" fill={ink} stroke="none" />
              {Array.from({ length: 16 }).map((_, i) => {
                const a = (i / 16) * Math.PI * 2;
                const r1 = 70;
                const r2 = i % 2 ? 84 : 98;
                return <line key={i} x1={210 + r1 * Math.cos(a)} y1={240 + r1 * Math.sin(a)} x2={210 + r2 * Math.cos(a)} y2={240 + r2 * Math.sin(a)} strokeWidth="2" />;
              })}
              <path d="M210 352 l0 60 M196 382 l28 0" strokeWidth="2.2" />
              <path d="M160 140 l4 10 10 4 -10 4 -4 10 -4 -10 -10 -4 10 -4z" fill={ink} stroke="none" />
              <path d="M262 352 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3z" fill={ink} stroke="none" />
              <circle cx="150" cy="330" r="2.4" fill={ink} stroke="none" />
              <circle cx="276" cy="150" r="2.4" fill={ink} stroke="none" />
              <circle cx="168" cy="420" r="2" fill={ink} stroke="none" />
            </g>
            {/* skin aging */}
            <g stroke="#8a5a45" strokeLinecap="round" fill="none" opacity={wrinkles * 0.55}>
              {[120, 158, 300, 338, 372, 430, 470].map((y, i) => (
                <path key={y} d={`M${100 + (i % 3) * 8} ${y} q 55 ${i % 2 ? 7 : -6} 110 0 t 110 ${i % 2 ? -4 : 5}`} strokeWidth="1.1" />
              ))}
            </g>
            <g fill="#9b6448" opacity={spots * 0.5}>
              <circle cx="150" cy="190" r="5" />
              <circle cx="282" cy="300" r="7" />
              <circle cx="236" cy="430" r="4" />
              <circle cx="140" cy="380" r="3.5" />
              <circle cx="268" cy="96" r="4.5" />
            </g>
          </g>
        </svg>
      </div>

      <div className="year-readout">
        <span className={`year-num ${years === 0 ? 'word' : ''}`}>{years === 0 ? 'Fresh' : years}</span>
        <span className="year-unit">{years === 0 ? 'done today' : years === 1 ? 'year later' : 'years later'}</span>
      </div>

      <label className="hero-scrub">
        <span className="sr">Drag to age the tattoo</span>
        <input
          type="range"
          min={0}
          max={1000}
          value={Math.round(t * 1000)}
          onChange={(e) => {
            touched.current = true;
            setT(Number(e.target.value) / 1000);
          }}
        />
        <span className="scrub-ends">
          <span>Today</span>
          <span>50 years</span>
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
