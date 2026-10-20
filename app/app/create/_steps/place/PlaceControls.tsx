'use client';
import { useApp } from '../../../AppProvider';
import { Icon } from '../../../ui';
import type { Placement } from '@/lib/editor';
import { L } from '../utils';

/** Size (slider and cm chips), rotation, mirror, straighten and undo. */
export function PlaceControls({
  pl,
  setPl,
  remember,
  cm,
  setCm,
  canUndo,
  undo,
}: {
  pl: Placement;
  setPl: (p: Placement) => void;
  remember: () => void;
  cm: number;
  setCm: (target: number) => void;
  canUndo: boolean;
  undo: () => void;
}) {
  const { ui } = useApp();
  const t = L(ui.lang);
  return (
    <>
      <div className="sliders">
        <label>
          {ui.t('create.place.size')}
          <input type="range" min={4} max={140} value={Math.round(pl.w * 100)} onPointerDown={remember} onChange={(e) => setPl({ ...pl, w: Number(e.target.value) / 100 })} />
        </label>
        <div className="cmrow" role="group" aria-label={t('Size in cm', 'Méret cm-ben')}>
          {[3, 5, 8, 12, 20].map((c) => (
            <button key={c} className={`chip ${Math.abs(cm - c) < 0.6 ? 'on' : ''}`} onClick={() => setCm(c)}>
              {c} cm
            </button>
          ))}
        </div>
        <label>
          {ui.t('create.place.rotate')}
          <input type="range" min={-180} max={180} value={pl.rot} onPointerDown={remember} onChange={(e) => setPl({ ...pl, rot: Number(e.target.value) })} />
        </label>
      </div>
      <div className="row" style={{ marginTop: 6 }}>
        <button className={`chipbtn ${pl.mirror ? 'on' : ''}`} onClick={() => setPl({ ...pl, mirror: !pl.mirror })}>
          {Icon.mirror} {ui.t('create.place.mirror')}
        </button>
        <button className="chipbtn" onClick={() => (remember(), setPl({ ...pl, rot: 0 }))}>
          {Icon.rotate} 0°
        </button>
        <button className="chipbtn" disabled={!canUndo} onClick={undo}>
          <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: 16, height: 16, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }}>
            <path d="M9 14L4 9l5-5" />
            <path d="M4 9h11a5 5 0 0 1 0 10h-3" />
          </svg>
          {t('Undo', 'Vissza')}
        </button>
      </div>
    </>
  );
}
