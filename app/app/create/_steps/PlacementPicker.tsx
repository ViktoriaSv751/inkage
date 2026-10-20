'use client';
import { useEffect, useRef } from 'react';
import { useApp } from '../../AppProvider';
import { haptic } from '@/lib/store';
import { PLACEMENTS } from '@/lib/placements';
import { L } from './utils';

/** Body-area chips. Always visible, so the area can be changed at any point. */
export function PlacementPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { ui } = useApp();
  const t = L(ui.lang);
  const ref = useRef<HTMLDivElement>(null);
  // bring the selected chip into view (e.g. "Neck" at the far right)
  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>('.chip.on');
    if (el && ref.current) ref.current.scrollLeft = el.offsetLeft - ref.current.clientWidth / 2 + el.clientWidth / 2;
  }, [value]);
  return (
    <div className="placepick">
      <span className="placepick-label">{t('Body area', 'Testrész')}</span>
      <div className="chips" ref={ref} role="radiogroup" aria-label={t('Body area', 'Testrész')}>
        {PLACEMENTS.map((p) => (
          <button
            key={p.v}
            role="radio"
            aria-checked={value === p.v}
            className={`chip ${value === p.v ? 'on' : ''}`}
            onClick={() => {
              onChange(p.v);
              haptic();
            }}
          >
            {t(p.en, p.hu)}
          </button>
        ))}
      </div>
    </div>
  );
}
