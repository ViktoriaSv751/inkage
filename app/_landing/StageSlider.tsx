'use client';

import { useRef, useState } from 'react';
import { PIC } from '@/lib/img';
import { track } from '@/lib/track';
import type { T } from './types';

// one real InkAge result at five moments (the same pictures as the home page timeline)
const STOPS = [
  'hf_20261013_200843_15e0b201-b6cc-486c-a5a4-9073748b837c',
  'hf_20261013_200913_a2cc2bf1-1955-4593-a519-529d8a7ff22c',
  'hf_20261013_200914_28a5dcbe-63ae-4431-9e25-28696542dc60',
  'hf_20261013_200914_80587d64-e00b-48e4-a28f-69bc17f1cb6a',
  'hf_20261013_200918_3120c2be-e153-4881-a8f8-04c1cf79fcb4',
];

/**
 * Drag through a real example: today → 1 → 10 → 30 → 50 years. Shown before any sign-up or photo,
 * so people see what they get first (the app's "Try an example", articles, style pages).
 */
export function StageSlider({ t, where, compact }: { t: T; where: string; compact?: boolean }) {
  const [i, setI] = useState(0);
  const moved = useRef(false);
  const labels = [t('Today', 'Ma'), t('1 year', '1 év'), t('10 years', '10 év'), t('30 years', '30 év'), t('50 years', '50 év')];
  const set = (v: number) => {
    setI(v);
    if (!moved.current) {
      moved.current = true;
      track('example_slide', { where });
    }
  };
  return (
    <div className={`stg ${compact ? 'compact' : ''}`}>
      <div className="stg-pic">
        {STOPS.map((s, k) => (
          <img key={s} {...PIC(s, compact ? '(min-width: 700px) 420px, 92vw' : '(min-width: 700px) 640px, 100vw', 900)} alt={k === i ? labels[k] : ''} aria-hidden={k !== i} loading={k === 0 ? 'eager' : 'lazy'} style={{ opacity: k === i ? 1 : 0 }} draggable={false} />
        ))}
        <span className="stg-badge">{labels[i]}</span>
      </div>
      <input
        className="stg-range"
        type="range"
        min={0}
        max={4}
        step={1}
        value={i}
        onChange={(e) => set(Number(e.target.value))}
        aria-label={t('Years after the tattoo', 'Évek a tetoválás után')}
        aria-valuetext={labels[i]}
      />
      <div className="stg-ticks" aria-hidden="true">
        {labels.map((l, k) => (
          <button key={l} type="button" className={k === i ? 'on' : ''} onClick={() => set(k)} tabIndex={-1}>
            {l}
          </button>
        ))}
      </div>
      <p className="stg-note">{t('A real example made with InkAge. Drag to see it age. Previews are AI estimates.', 'Valódi, InkAge-dzsel készült példa. Húzd, és nézd, hogyan öregszik. Az előnézetek MI-becslések.')}</p>
    </div>
  );
}
