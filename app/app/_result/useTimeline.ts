'use client';
import { useEffect, useRef, useState } from 'react';
import { haptic, StageKey } from '@/lib/store';
import { YEARS } from './constants';

/** Position along the ready stages (the year slider) and the one-time 50-year playback. */
export function useTimeline(ready: StageKey[], reveal: boolean) {
  const [pos, setPos] = useState(0); // continuous position along the ready stages
  const played = useRef(false);

  // keep the position inside the available range
  const maxPos = Math.max(0, ready.length - 1);
  const p = Math.min(pos, maxPos);
  const lo = Math.floor(p);
  const frac = p - lo;
  const active: StageKey = ready[Math.round(p)] || 'fresh';
  const yearsNow = ready.length ? Math.round(YEARS[ready[lo]] + (ready[lo + 1] ? (YEARS[ready[lo + 1]] - YEARS[ready[lo]]) * frac : 0)) : 0;

  // Wow moment: when all five images are in for the first time, play the 50 years once.
  useEffect(() => {
    if (!reveal || played.current || ready.length < 5) return;
    played.current = true;
    const start = performance.now() + 500;
    const dur = 3600;
    let raf = 0;
    let lastIdx = -1;
    const tick = (now: number) => {
      const k = Math.min(1, Math.max(0, (now - start) / dur));
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      const v = e * 4;
      setPos(v);
      if (Math.floor(v) !== lastIdx) {
        lastIdx = Math.floor(v);
        haptic();
      }
      if (k < 1) raf = requestAnimationFrame(tick);
      else haptic('success');
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reveal, ready.length]);

  const step = (dir: 1 | -1) => {
    const n = Math.min(maxPos, Math.max(0, Math.round(p) + dir));
    if (n !== Math.round(p)) {
      setPos(n);
      haptic();
    }
  };

  return { pos, setPos, maxPos, p, lo, frac, active, yearsNow, step };
}
