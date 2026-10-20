'use client';
import { useRef } from 'react';
import { useApp } from '../AppProvider';
import { Icon } from '../ui';
import { tx } from '@/lib/i18n';
import { haptic, Preview, REMOVAL_STAGES, RemovalKey, StageKey, STAGES } from '@/lib/store';

/** The big image: the aging layers, the laser sessions or the before / after split. */
export function Viewer({
  preview,
  view,
  mode,
  remKey,
  ready,
  lo,
  frac,
  yearsNow,
  active,
  activeSrc,
  activeName,
  label,
  remLabel,
  own,
  reveal,
  zs,
  closeup,
  setCloseup,
  split,
  setSplit,
  setZoom,
  step,
  pending,
  removalPending,
  onFavorite,
}: {
  preview: Preview;
  view: 'aging' | 'removal';
  mode: 'view' | 'split';
  remKey: 'fresh' | RemovalKey;
  ready: StageKey[];
  lo: number;
  frac: number;
  yearsNow: number;
  active: StageKey;
  activeSrc?: string;
  activeName: string;
  label: (k: StageKey) => string;
  remLabel: (k: 'fresh' | RemovalKey) => string;
  own: boolean;
  reveal: boolean;
  zs?: React.CSSProperties;
  closeup: boolean;
  setCloseup: (v: boolean) => void;
  split: number;
  setSplit: (v: number) => void;
  setZoom: (v: boolean) => void;
  step: (dir: 1 | -1) => void;
  pending: StageKey[];
  removalPending: RemovalKey[];
  onFavorite?: () => void;
}) {
  const { ui } = useApp();
  const t = (en: string, hu: string) => tx(ui.lang, en, hu);
  const img = preview.images;
  const rem = preview.removal || {};
  const f = preview.focus;
  const touch = useRef<number | null>(null);
  return (
    <div
      className="res-viewer"
      onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touch.current === null || mode === 'split' || view === 'removal') return;
        const dx = e.changedTouches[0].clientX - touch.current;
        if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
        touch.current = null;
      }}
    >
      {view === 'removal' ? (
        <>
          {img.fresh && <img src={img.fresh} alt={remLabel('fresh')} className="zoomable" style={zs} />}
          {REMOVAL_STAGES.map((k) => (rem[k] ? <img key={k} className="layer zoomable" src={rem[k]} alt={k === remKey ? remLabel(k) : ''} style={{ opacity: remKey === k ? 1 : 0, ...zs }} /> : null))}
          <div className="stamp">
            <span>{remKey === 'fresh' ? t('NOW', 'MA') : remKey.slice(5)}</span>
            <small>{remKey === 'fresh' ? t('before laser', 'lézer előtt') : t('laser sessions', 'lézeres kezelés')}</small>
          </div>
          {removalPending.length > 0 && (
            <div className="res-pending" role="status">
              <i className="needle" />
              {t(`Simulating laser sessions… ${3 - removalPending.length}/3`, `Lézeres kezelések szimulálása… ${3 - removalPending.length}/3`)}
            </div>
          )}
        </>
      ) : mode === 'view' || !img.fresh ? (
        <>
          {img.fresh ? <img src={img.fresh} alt={t(`Your tattoo, ${activeName}`, `A tetoválásod, ${activeName}`)} className={`${reveal ? 'reveal' : ''} zoomable`} style={zs} /> : <div className="ph" />}
          {ready.slice(1).map((k, j) => {
            const idx = j + 1;
            const op = idx <= lo ? 1 : idx === lo + 1 ? frac : 0;
            return <img key={k} className="layer nofade zoomable" src={img[k]} alt="" style={{ opacity: op, ...zs }} />;
          })}
          <div className="stamp">
            <span>{yearsNow === 0 ? (own ? t('NOW', 'MA') : t('NEW', 'ÚJ')) : yearsNow}</span>
            <small>{yearsNow === 0 ? (own ? t('today', 'ma') : t('fresh ink', 'friss tinta')) : t(yearsNow === 1 ? 'year later' : 'years later', 'év múlva')}</small>
          </div>
        </>
      ) : (
        <div className="split">
          <img src={img.fresh} alt={label('fresh')} />
          <div className="after" style={{ clipPath: `inset(0 0 0 ${split}%)` }}>
            <img src={img[active === 'fresh' ? ready[ready.length - 1] : active]} alt={label(active)} />
          </div>
          <div className="handle" style={{ left: `${split}%` }} />
          <span className="lab" style={{ left: 12 }}>{label('fresh')}</span>
          <span className="lab" style={{ right: 12 }}>{label(active === 'fresh' ? ready[ready.length - 1] : active)}</span>
          <input
            type="range"
            aria-label={ui.t('result.compare')}
            min={0}
            max={100}
            value={split}
            onChange={(e) => setSplit(Number(e.target.value))}
            style={{ position: 'absolute', inset: 0, height: '100%', opacity: 0, cursor: 'ew-resize' }}
          />
        </div>
      )}
      <div className="res-tools">
        {f && mode === 'view' && (
          <button className={`pillbtn dark ${closeup ? 'on' : ''}`} aria-pressed={closeup} onClick={() => (setCloseup(!closeup), haptic())}>
            {closeup ? t('Whole photo', 'Teljes kép') : t('Close-up', 'Közelkép')}
          </button>
        )}
        <button className="iconbtn dark" aria-label={t('Zoom in', 'Nagyítás')} onClick={() => setZoom(true)} disabled={!activeSrc}>
          {Icon.zoom}
        </button>
        {onFavorite && (
          <button className={`iconbtn dark ${preview.favorite ? 'on' : ''}`} aria-label={t('Favorite', 'Kedvenc')} aria-pressed={preview.favorite} onClick={onFavorite}>
            {Icon.heart}
          </button>
        )}
      </div>
      {view === 'aging' && pending.length > 0 && mode === 'view' && (
        <div className="res-pending" role="status">
          <i className="needle" />
          {t(`Aging your skin… ${STAGES.length - 1 - pending.length}/4 ready`, `A bőröd öregítése… ${STAGES.length - 1 - pending.length}/4 kész`)}
        </div>
      )}
    </div>
  );
}
