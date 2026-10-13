'use client';

import { useRef, useState } from 'react';
import { useApp } from '../AppProvider';
import { Sheet } from '../ui';
import { tx } from '@/lib/i18n';
import { haptic } from '@/lib/store';

export type Box = [number, number, number, number];
export type Found = { kind: 'design' | 'photo'; tattoos: { box: Box; label: string }[] };

/**
 * "Which tattoo?" — shows the uploaded picture with every tattoo the AI found framed and numbered.
 * Tap one, or drag a frame yourself around the one you want.
 */
export function TattooPicker({
  open,
  image,
  found,
  onPick,
  onWhole,
  onClose,
}: {
  open: boolean;
  image: string;
  found: Found;
  onPick: (box: Box) => void;
  onWhole: () => void;
  onClose: () => void;
}) {
  const { ui } = useApp();
  const t = (en: string, hu: string) => tx(ui.lang, en, hu);
  const [sel, setSel] = useState<number>(found.tattoos.length ? 0 : -1);
  const [manual, setManual] = useState<Box | null>(null);
  const [drawMode, setDrawMode] = useState(!found.tattoos.length);
  const wrap = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);

  const at = (e: React.PointerEvent) => {
    const r = wrap.current!.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
  };
  const down = (e: React.PointerEvent) => {
    if (!drawMode) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    start.current = at(e);
    setManual(null);
  };
  const move = (e: React.PointerEvent) => {
    if (!drawMode || !start.current) return;
    const p = at(e), s = start.current;
    setManual([Math.min(s.y, p.y), Math.min(s.x, p.x), Math.max(s.y, p.y), Math.max(s.x, p.x)]);
  };
  const up = () => {
    start.current = null;
    if (manual && (manual[2] - manual[0] < 0.03 || manual[3] - manual[1] < 0.03)) setManual(null);
    else if (manual) haptic();
  };

  const chosen: Box | null = drawMode ? manual : sel >= 0 ? found.tattoos[sel]?.box ?? null : null;
  const frame = (b: Box) => ({ top: `${b[0] * 100}%`, left: `${b[1] * 100}%`, height: `${(b[2] - b[0]) * 100}%`, width: `${(b[3] - b[1]) * 100}%` });

  return (
    <Sheet open={open} onClose={onClose} label={t('Which tattoo?', 'Melyik tetoválás?')}>
      <h2>{t('Which tattoo do you want?', 'Melyik tetoválást szeretnéd?')}</h2>
      <p className="muted small" style={{ marginTop: -4 }}>
        {drawMode
          ? t('Drag a frame around the tattoo you want. Only that part is used.', 'Húzz keretet a kívánt tetoválás köré. Csak ez a rész kerül felhasználásra.')
          : found.tattoos.length > 1
            ? t(`We found ${found.tattoos.length} designs. Tap the one you want.`, `${found.tattoos.length} mintát találtunk. Koppints arra, amelyiket szeretnéd.`)
            : t('Is this the one? Only the framed part is used, without the person or background.', 'Ez az? Csak a bekeretezett rész kerül felhasználásra, ember és háttér nélkül.')}
      </p>
      <div className={`picker ${drawMode ? 'draw' : ''}`}>
      <div className="picker-in" ref={wrap} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        <img src={image} alt="" draggable={false} />
        {!drawMode &&
          found.tattoos.map((x, i) => (
            <button
              key={i}
              className={`pick-box ${sel === i ? 'on' : ''}`}
              style={frame(x.box)}
              aria-pressed={sel === i}
              aria-label={`${i + 1}. ${x.label}`}
              onClick={() => {
                setSel(i);
                haptic();
              }}
            >
              <span>{i + 1}</span>
            </button>
          ))}
        {drawMode && manual && <i className="pick-box on manual" style={frame(manual)} />}
        {chosen && <i className="pick-dim" style={{ ['--t' as any]: chosen[0], ['--l' as any]: chosen[1], ['--b' as any]: chosen[2], ['--r' as any]: chosen[3] }} />}
      </div>
      </div>
      {!drawMode && found.tattoos.length > 1 && (
        <div className="pick-list" role="radiogroup">
          {found.tattoos.map((x, i) => (
            <button key={i} role="radio" aria-checked={sel === i} className={`chip ${sel === i ? 'on' : ''}`} onClick={() => setSel(i)}>
              {i + 1}. {x.label || t('Design', 'Minta')}
            </button>
          ))}
        </div>
      )}
      <div className="pick-actions">
        <button className="btn wide" disabled={!chosen} onClick={() => chosen && onPick(chosen)}>
          {found.kind === 'design' ? t('Use this design', 'Ezt a mintát kérem') : t('Cut out this tattoo', 'Ezt a tetoválást vágd ki')}
        </button>
        <div className="row" style={{ justifyContent: 'center' }}>
          {(!drawMode || found.tattoos.length > 0) && (
            <button className="link" onClick={() => setDrawMode(!drawMode)}>
              {drawMode ? t('Show what was found', 'Mutasd a talált mintákat') : t('Select it myself', 'Kijelölöm magam')}
            </button>
          )}
          <button className="link" onClick={onWhole}>
            {t('Use the whole picture', 'Az egész kép a minta')}
          </button>
        </div>
      </div>
    </Sheet>
  );
}
