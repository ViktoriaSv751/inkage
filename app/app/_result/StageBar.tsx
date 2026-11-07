'use client';
import { useApp } from '../AppProvider';
import { tx } from '@/lib/i18n';
import { haptic, REMOVAL_STAGES, RemovalKey, StageKey, STAGES } from '@/lib/store';

/** Year slider and stage tabs, or the laser session tabs. */
export function StageBar({
  view,
  mode,
  ready,
  maxPos,
  p,
  yearsNow,
  setPos,
  active,
  label,
  failed,
  pending,
  onRetryStage,
  onMissingStage,
  rem,
  remKey,
  setRemKey,
  remLabel,
  removalPending,
  locked = [],
  onLocked,
}: {
  view: 'aging' | 'removal';
  mode: 'view' | 'split';
  ready: StageKey[];
  maxPos: number;
  p: number;
  yearsNow: number;
  setPos: (n: number) => void;
  active: StageKey;
  label: (k: StageKey) => string;
  failed: StageKey[];
  pending: StageKey[];
  onRetryStage?: (k: StageKey) => void;
  onMissingStage?: () => void;
  rem: Partial<Record<RemovalKey, string>>;
  remKey: 'fresh' | RemovalKey;
  setRemKey: (k: 'fresh' | RemovalKey) => void;
  remLabel: (k: 'fresh' | RemovalKey) => string;
  removalPending: RemovalKey[];
  /** stages that come with a package (the trial): shown with a lock, a tap opens the packages */
  locked?: (StageKey | RemovalKey)[];
  onLocked?: () => void;
}) {
  const { ui } = useApp();
  const t = (en: string, hu: string) => tx(ui.lang, en, hu);
  if (view === 'aging')
    return (
      <>
        {ready.length > 1 && mode === 'view' && (
          <div className="yearslider">
            <input
              type="range"
              min={0}
              max={maxPos}
              step={0.01}
              value={p}
              aria-label={t('Years from now', 'Évek múlva')}
              aria-valuetext={`${yearsNow}`}
              onChange={(e) => setPos(Number(e.target.value))}
              onPointerUp={() => haptic()}
            />
          </div>
        )}
        <div className="stagebar" role="tablist" aria-label={t('Years', 'Évek')}>
          {STAGES.map((k) => {
            const fail = failed.includes(k);
            const idx = ready.indexOf(k);
            if (idx < 0 && locked.includes(k) && onLocked)
              return (
                <button key={k} role="tab" aria-selected={false} className="locked" aria-label={`${label(k)} – ${t('comes with a package', 'csomaggal nyílik')}`} onClick={() => (haptic(), onLocked())}>
                  <LockIco />
                  {label(k)}
                </button>
              );
            return (
              <button
                key={k}
                role="tab"
                aria-selected={active === k}
                className={`${active === k ? 'on' : ''} ${pending.includes(k) ? 'loading' : ''}`}
                disabled={idx < 0 && !fail && (!onMissingStage || pending.includes(k))}
                onClick={() => {
                  if (fail && onRetryStage) return onRetryStage(k);
                  if (idx < 0) return onMissingStage?.();
                  setPos(idx);
                  haptic();
                }}
              >
                {fail ? '↻' : label(k)}
              </button>
            );
          })}
        </div>
      </>
    );
  return (
    <div className="stagebar four" role="tablist" aria-label={t('Laser sessions', 'Lézeres kezelések')}>
      {(['fresh', ...REMOVAL_STAGES] as ('fresh' | RemovalKey)[]).map((k) =>
        k !== 'fresh' && !rem[k] && !removalPending.includes(k) && locked.includes(k) && onLocked ? (
          <button key={k} role="tab" aria-selected={false} className="locked" aria-label={`${remLabel(k)} – ${t('comes with a package', 'csomaggal nyílik')}`} onClick={() => (haptic(), onLocked())}>
            <LockIco />
            {remLabel(k)}
          </button>
        ) : (
        <button
          key={k}
          role="tab"
          aria-selected={remKey === k}
          className={`${remKey === k ? 'on' : ''} ${k !== 'fresh' && removalPending.includes(k) ? 'loading' : ''}`}
          disabled={k !== 'fresh' && !rem[k]}
          onClick={() => {
            setRemKey(k);
            haptic();
          }}
        >
          {remLabel(k)}
        </button>
        )
      )}
    </div>
  );
}

const LockIco = () => (
  <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" style={{ marginRight: 4, verticalAlign: '-1px' }}>
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
);
