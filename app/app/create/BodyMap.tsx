'use client';

import { useEffect, useState } from 'react';
import { useApp } from '../AppProvider';
import { tx } from '@/lib/i18n';
import { haptic } from '@/lib/store';
import { PLACEMENTS } from '@/lib/placements';

/** Where each numbered spot sits on the figure (viewBox 0 0 200 440). Numbers follow PLACEMENTS order. */
const SPOTS: Record<string, { view: 'front' | 'back'; x: number; y: number }> = {
  'Inner forearm': { view: 'front', x: 41, y: 160 },
  Wrist: { view: 'front', x: 34, y: 201 },
  Hand: { view: 'front', x: 30, y: 226 },
  Finger: { view: 'front', x: 168, y: 246 },
  'Upper arm': { view: 'front', x: 47, y: 118 },
  Shoulder: { view: 'front', x: 63, y: 86 },
  Collarbone: { view: 'front', x: 116, y: 82 },
  Chest: { view: 'front', x: 84, y: 110 },
  'Upper back': { view: 'back', x: 100, y: 112 },
  Ribs: { view: 'front', x: 126, y: 146 },
  Hip: { view: 'front', x: 126, y: 202 },
  Thigh: { view: 'front', x: 82, y: 256 },
  Calf: { view: 'back', x: 84, y: 352 },
  Ankle: { view: 'front', x: 114, y: 414 },
  'Back of neck': { view: 'back', x: 100, y: 62 },
};

function Figure({ view }: { view: 'front' | 'back' }) {
  // One arm and one leg are drawn and mirrored, so the figure stays symmetric.
  const arm =
    'M58 80 C47 84 44 96 43 110 L39 158 C38 170 35 186 33 198 L30 212 C28 220 26 228 25 238 C24 247 26 254 31 254 C35 253 36 246 37 238 L39 214 C41 204 44 192 46 180 L52 136 C53 126 55 112 57 100 Z';
  const leg = 'M63 206 L99 206 L98 232 C96 270 94 300 93 330 L91 400 C91 412 93 421 97 428 L77 430 C78 420 79 410 78 398 L72 330 C66 296 60 262 63 206 Z';
  return (
    <g className="bm-figure">
      <ellipse className="bm-floor" cx="100" cy="434" rx="44" ry="5" />
      <path d={leg} />
      <path d={leg} transform="translate(200 0) scale(-1 1)" />
      <path d={arm} />
      <path d={arm} transform="translate(200 0) scale(-1 1)" />
      <path d="M93 50 L107 50 L109 70 L91 70 Z" />
      <path d="M70 74 C84 68 116 68 130 74 C141 78 146 88 145 104 C144 128 138 146 134 166 C132 180 134 194 138 210 L62 210 C66 194 68 180 66 166 C62 146 56 128 55 104 C54 88 59 78 70 74 Z" />
      <ellipse className="bm-head" cx="100" cy="34" rx="15" ry="19" />
      {view === 'back' ? (
        <path className="bm-detail" d="M100 76 L100 196" />
      ) : (
        <path className="bm-detail" d="M78 84 C88 88 94 86 100 84 C106 86 112 88 122 84" />
      )}
    </g>
  );
}

export function BodyMap({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { ui } = useApp();
  const t = (en: string, hu: string) => tx(ui.lang, en, hu);
  const [view, setView] = useState<'front' | 'back'>(SPOTS[value]?.view || 'front');
  useEffect(() => {
    const v = SPOTS[value]?.view;
    if (v) setView(v);
  }, [value]);
  const pick = (v: string) => {
    onChange(v);
    haptic();
  };
  const sel = PLACEMENTS.findIndex((p) => p.v === value);

  return (
    <div className="bodymap2">
      <div className="bm-stage">
        <div className="flip bm-flip" role="radiogroup" aria-label={t('Side', 'Nézet')}>
          <button role="radio" aria-checked={view === 'front'} className={view === 'front' ? 'on' : ''} onClick={() => setView('front')}>
            {t('Front', 'Elöl')}
          </button>
          <button role="radio" aria-checked={view === 'back'} className={view === 'back' ? 'on' : ''} onClick={() => setView('back')}>
            {t('Back', 'Hátul')}
          </button>
        </div>
        <svg viewBox="0 0 200 440" className="bm-svg" role="group" aria-label={t('Body map', 'Testtérkép')}>
          <Figure view={view} />
          {PLACEMENTS.map((p, i) => {
            const s = SPOTS[p.v];
            if (!s || s.view !== view) return null;
            const on = p.v === value;
            return (
              <g
                key={p.v}
                className={`bm-spot ${on ? 'on' : ''}`}
                role="radio"
                aria-checked={on}
                aria-label={`${i + 1}. ${t(p.en, p.hu)}`}
                tabIndex={0}
                onClick={() => pick(p.v)}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && pick(p.v)}
              >
                {on && <circle className="bm-halo" cx={s.x} cy={s.y} r="15" />}
                <circle cx={s.x} cy={s.y} r="11" />
                <text x={s.x} y={s.y + 3.9}>{i + 1}</text>
              </g>
            );
          })}
        </svg>
        {sel >= 0 && (
          <div className="bm-picked" aria-live="polite">
            <span>{sel + 1}</span>
            {t(PLACEMENTS[sel].en, PLACEMENTS[sel].hu)}
          </div>
        )}
      </div>
      <ol className="bm-legend">
        {PLACEMENTS.map((p, i) => (
          <li key={p.v}>
            <button className={p.v === value ? 'on' : ''} onClick={() => pick(p.v)} aria-pressed={p.v === value}>
              <span>{i + 1}</span>
              {t(p.en, p.hu)}
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
