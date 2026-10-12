'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '../AppProvider';
import { Icon } from '../ui';
import { tx } from '@/lib/i18n';
import { api } from '@/lib/sb';
import { haptic, track } from '@/lib/store';
import { prepareImage } from '@/lib/client';
import { DESIGNS } from '@/lib/designs';
import { processDesign, Placement } from '@/lib/editor';
import { frameCm } from '@/lib/score';

export type Photo = { dataUrl: string; w: number; h: number };
export type Design = { raw: string; ink: string; ratio: number; detail: number; mode: 'black' | 'color'; libId?: string };

export const PLACEMENTS = [
  { v: 'Inner forearm', en: 'Forearm', hu: 'Alkar' },
  { v: 'Wrist', en: 'Wrist', hu: 'Csukló' },
  { v: 'Hand', en: 'Hand', hu: 'Kézfej' },
  { v: 'Finger', en: 'Finger', hu: 'Ujj' },
  { v: 'Upper arm', en: 'Upper arm', hu: 'Felkar' },
  { v: 'Shoulder', en: 'Shoulder', hu: 'Váll' },
  { v: 'Collarbone', en: 'Collarbone', hu: 'Kulcscsont' },
  { v: 'Upper back', en: 'Back', hu: 'Hát' },
  { v: 'Ribs', en: 'Ribs', hu: 'Borda' },
  { v: 'Thigh', en: 'Thigh', hu: 'Comb' },
  { v: 'Calf', en: 'Calf', hu: 'Vádli' },
  { v: 'Ankle', en: 'Ankle', hu: 'Boka' },
  { v: 'Back of neck', en: 'Neck', hu: 'Nyak' },
];

const L = (lang: 'en' | 'hu') => (en: string, hu: string) => tx(lang, en, hu);

// ================================================================ photo

type CheckState = { state: 'idle' | 'checking' | 'ok' | 'warn' | 'blocked'; msg?: string };

export function PhotoStep({
  placement,
  setPlacement,
  photo,
  setPhoto,
  onNext,
}: {
  placement: string;
  setPlacement: (p: string) => void;
  photo: Photo | null;
  setPhoto: (p: Photo | null) => void;
  onNext: () => void;
}) {
  const { ui, toast } = useApp();
  const t = L(ui.lang);
  const fileRef = useRef<HTMLInputElement>(null);
  const [cam, setCam] = useState(false);
  const [check, setCheck] = useState<CheckState>({ state: 'idle' });

  const runCheck = useCallback(
    async (p: Photo, where: string) => {
      setCheck({ state: 'checking' });
      const r = await api<{ ok: boolean; code: string; area: string }>('/api/check-photo', { photo: p.dataUrl, placement: where });
      if (!r.ok && r.status !== 200) return setCheck({ state: 'ok' }); // never block on a failed check
      const c = r.data.code;
      track('photo_check', { code: c });
      if (c === 'ok') return setCheck({ state: 'ok', msg: t('Looks good — clear skin, good light.', 'Jó lesz – látszik a bőr, jó a fény.') });
      if (c === 'not_allowed') return setCheck({ state: 'blocked', msg: t('We can’t use this photo. Use a photo of an adult’s arm, leg, back or similar, with no nudity.', 'Ezt a fotót nem tudjuk használni. Felnőtt karjáról, lábáról, hátáról készült, nem meztelen fotót tölts fel.') });
      if (c === 'no_skin') return setCheck({ state: 'warn', msg: t('We can’t see much bare skin. A closer shot works best.', 'Kevés csupasz bőr látszik. Egy közelebbi fotó lesz a legjobb.') });
      if (c === 'blurry') return setCheck({ state: 'warn', msg: t('This looks a bit blurry. A sharper photo gives a far more realistic result.', 'Kicsit homályos. Élesebb fotóval sokkal valósághűbb lesz.') });
      if (c === 'dark') return setCheck({ state: 'warn', msg: t('It’s quite dark. Try near a window in daylight.', 'Elég sötét. Próbáld ablak mellett, nappali fényben.') });
      setCheck({ state: 'ok' });
    },
    [ui.lang] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const take = async (file: File | Blob) => {
    try {
      const p = await prepareImage(file as File, 1024);
      setPhoto(p);
      haptic();
      track('photo_added');
      runCheck(p, placement);
    } catch {
      toast(t('That file could not be opened. Try a JPG or PNG.', 'Ezt a fájlt nem sikerült megnyitni. JPG vagy PNG legyen.'));
    }
  };

  return (
    <div>
      <div className="chips" role="radiogroup" aria-label={t('Body area', 'Testrész')}>
        {PLACEMENTS.map((p) => (
          <button
            key={p.v}
            role="radio"
            aria-checked={placement === p.v}
            className={`chip ${placement === p.v ? 'on' : ''}`}
            onClick={() => {
              setPlacement(p.v);
              haptic();
            }}
          >
            {t(p.en, p.hu)}
          </button>
        ))}
      </div>

      <button className={`dropzone ${photo ? 'has' : ''}`} onClick={() => fileRef.current?.click()} aria-label={ui.t('create.photo.library')}>
        {photo ? (
          <img src={photo.dataUrl} alt={t('Your photo', 'A fotód')} />
        ) : (
          <span className="dz-inner">
            {Icon.camera}
            <b style={{ color: 'var(--ink)', fontSize: 19 }}>{ui.t('create.photo.title')}</b>
            <span>{ui.t('create.photo.sub')}</span>
          </span>
        )}
        {photo && check.state !== 'idle' && (
          <span className={`photo-status ${check.state === 'ok' ? 'ok' : check.state === 'checking' ? '' : 'warn'}`} role="status">
            {check.state === 'checking' ? <i className="needle" /> : check.state === 'ok' ? '✓' : '!'}
            <span>{check.state === 'checking' ? ui.t('create.photo.checking') : check.msg || ui.t('create.photo.ok')}</span>
          </span>
        )}
      </button>
      <input
        ref={fileRef}
        id="photo-input"
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) take(f);
          e.target.value = '';
        }}
      />

      <div className="twobtn">
        <button className="btn light" onClick={() => setCam(true)}>
          {Icon.camera} {photo ? t('Retake', 'Új fotó') : ui.t('create.photo.camera')}
        </button>
        <button className="btn light" onClick={() => fileRef.current?.click()}>
          {Icon.image} {t('Library', 'Galéria')}
        </button>
      </div>

      {!photo && (
        <div className="photo-tips" aria-hidden="true">
          <span>☀️ {t('Daylight', 'Nappali fény')}</span>
          <span>📏 {t('Arm’s length', 'Kartávolság')}</span>
          <span>🎯 {t('Skin in focus', 'Éles bőr')}</span>
        </div>
      )}

      <div className="stickycta">
        <button className="btn wide dark" disabled={!photo || check.state === 'blocked' || check.state === 'checking'} onClick={onNext}>
          {check.state === 'warn' ? t('Use it anyway', 'Mehet így is') : ui.t('common.continue')}
        </button>
      </div>

      {cam && (
        <CameraSheet
          placement={placement}
          onClose={() => setCam(false)}
          onShot={(b) => {
            setCam(false);
            take(b);
          }}
          onFallback={() => {
            setCam(false);
            fileRef.current?.click();
          }}
        />
      )}
    </div>
  );
}

function CameraSheet({ placement, onClose, onShot, onFallback }: { placement: string; onClose: () => void; onShot: (b: Blob) => void; onFallback: () => void }) {
  const { ui } = useApp();
  const t = L(ui.lang);
  const vid = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<'environment' | 'user'>('environment');

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        stream.current?.getTracks().forEach((x) => x.stop());
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1920 } }, audio: false });
        if (dead) return s.getTracks().forEach((x) => x.stop());
        stream.current = s;
        if (vid.current) {
          vid.current.srcObject = s;
          await vid.current.play().catch(() => {});
        }
      } catch {
        onFallback();
      }
    })();
    return () => {
      dead = true;
    };
  }, [facing]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => stream.current?.getTracks().forEach((x) => x.stop()), []);

  const shoot = () => {
    const v = vid.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement('canvas');
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext('2d')!.drawImage(v, 0, 0);
    haptic('success');
    c.toBlob((b) => b && onShot(b), 'image/jpeg', 0.92);
  };

  const limb = /back|hát|rib|borda/i.test(placement)
    ? 'M30 10h40l6 80H24z'
    : /hand|kéz|finger|ujj|wrist|csukló/i.test(placement)
      ? 'M38 95V55l-8-30c-1-5 6-7 8-2l6 20V12c0-5 7-5 7 0v28l2-32c0-5 7-5 7 0v34l3-26c1-5 7-4 7 1l-2 40 6-12c3-4 9-1 7 3l-12 30v17z'
      : 'M36 2c-4 30-6 60-4 96h36c2-36 0-66-4-96z';

  return (
    <div className="camera" role="dialog" aria-modal="true" aria-label={ui.t('create.photo.camera')}>
      <video ref={vid} playsInline muted />
      <div className="outline" aria-hidden="true">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none">
          <path d={limb} vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      <p className="cam-hint">{t('Fit the area inside the outline, in daylight', 'Igazítsd a testrészt a körvonalba, nappali fényben')}</p>
      <button className="iconbtn dark cam-x" aria-label={ui.t('common.close')} onClick={onClose}>
        {Icon.close}
      </button>
      <div className="cam-bar">
        <span style={{ width: 44 }} />
        <button className="shutter" aria-label={t('Take photo', 'Fotó')} onClick={shoot} />
        <button className="iconbtn dark" aria-label={t('Switch camera', 'Kameraváltás')} onClick={() => setFacing(facing === 'user' ? 'environment' : 'user')}>
          {Icon.rotate}
        </button>
      </div>
    </div>
  );
}

// ================================================================ design

export function DesignStep({ design, setDesign, onNext }: { design: Design | null; setDesign: (d: Design | null) => void; onNext: () => void }) {
  const { ui, toast } = useApp();
  const t = L(ui.lang);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const use = async (raw: string, mode: Design['mode'], libId?: string) => {
    setBusy(true);
    try {
      const d = await processDesign(raw, mode);
      setDesign({ raw, ink: d.dataUrl, ratio: d.ratio, detail: d.detail, mode, libId });
      haptic();
    } catch {
      toast(t('That design could not be opened. Try another image.', 'Ezt a mintát nem sikerült megnyitni. Próbálj másik képet.'));
    }
    setBusy(false);
  };

  const fromFile = async (f: File | Blob) => {
    const p = await prepareImage(f as File, 1024, 'image/png');
    track('design_added', { src: 'upload' });
    use(p.dataUrl, design?.mode || 'black');
  };

  const paste = async () => {
    try {
      const items = await (navigator.clipboard as any).read();
      for (const it of items) {
        const type = it.types.find((x: string) => x.startsWith('image/'));
        if (type) {
          track('design_added', { src: 'paste' });
          return fromFile(await it.getType(type));
        }
      }
      toast(t('No image on your clipboard. Copy an image first.', 'Nincs kép a vágólapon. Előbb másolj ki egy képet.'));
    } catch {
      toast(t('Your browser blocked the clipboard. Use Upload instead.', 'A böngésző letiltotta a vágólapot. Használd a Feltöltést.'));
    }
  };

  // ctrl/cmd+V anywhere on this step
  useEffect(() => {
    const h = (e: ClipboardEvent) => {
      const f = Array.from(e.clipboardData?.files || []).find((x) => x.type.startsWith('image/'));
      if (f) fromFile(f);
    };
    window.addEventListener('paste', h);
    return () => window.removeEventListener('paste', h);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <button className="design-preview" onClick={() => fileRef.current?.click()} style={{ border: 0, padding: 0 }} aria-label={ui.t('create.design.upload')}>
        <span className="checker" />
        {design ? (
          <img src={design.ink} alt={t('Your design', 'A mintád')} />
        ) : (
          <span className="dz-inner" style={{ position: 'relative', display: 'grid', justifyItems: 'center', gap: 8, color: 'var(--ink-2)', padding: 24, textAlign: 'center' }}>
            <svg viewBox="0 0 24 24" width="54" height="54" fill="none" stroke="var(--violet)" strokeWidth="1.5" strokeLinecap="round"><path d="M12 16V4M7 9l5-5 5 5M4 20h16" /></svg>
            <b style={{ color: 'var(--ink)', fontSize: 19 }}>{ui.t('create.design.upload')}</b>
            <span>{ui.t('create.design.sub')}</span>
          </span>
        )}
        {busy && (
          <span className="photo-status">
            <i className="needle" />
            {t('Cleaning up the background…', 'Háttér eltávolítása…')}
          </span>
        )}
      </button>
      <input
        ref={fileRef}
        id="design-input"
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) fromFile(f);
          e.target.value = '';
        }}
      />

      <div className="twobtn">
        <button className="btn light" onClick={() => fileRef.current?.click()}>
          {Icon.image} {t('Upload', 'Feltöltés')}
        </button>
        <button className="btn light" onClick={paste}>
          {Icon.clip} {t('Paste', 'Beillesztés')}
        </button>
      </div>

      {design && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
          <b>{ui.t('create.place.ink')}</b>
          <div className="seg" role="radiogroup">
            {(['black', 'color'] as const).map((m) => (
              <button key={m} role="radio" aria-checked={design.mode === m} className={design.mode === m ? 'on' : ''} onClick={() => use(design.raw, m, design.libId)}>
                {m === 'black' ? ui.t('create.place.black') : ui.t('create.place.color')}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="section-title">
        <h2 style={{ fontSize: 22 }}>{t('Or try one of ours', 'Vagy próbáld ki a mieinket')}</h2>
      </div>
      <div className="libgrid">
        {DESIGNS.map((d) => (
          <button
            key={d.id}
            className={design?.libId === d.id ? 'on' : ''}
            aria-label={t(d.en, d.hu)}
            onClick={() => {
              track('design_added', { src: 'library', id: d.id });
              use(d.src, 'black', d.id);
            }}
          >
            <img src={d.src} alt="" />
          </button>
        ))}
      </div>
      <p className="fine">{t('Only upload designs you have the right to use. Respect artists’ work.', 'Csak olyan mintát tölts fel, amit jogod van használni. Tiszteld a tetoválóművészek munkáját.')}</p>

      <div className="stickycta">
        <button className="btn wide dark" disabled={!design || busy} onClick={onNext}>
          {ui.t('common.continue')}
        </button>
      </div>
    </div>
  );
}

// ================================================================ place

export function PlaceStep({
  photo,
  design,
  placement,
  pl,
  setPl,
  onGo,
  canGo,
  footer,
}: {
  photo: Photo;
  design: Design;
  placement: string;
  pl: Placement;
  setPl: (p: Placement) => void;
  onGo: () => void;
  canGo: boolean;
  footer?: React.ReactNode;
}) {
  const { ui } = useApp();
  const t = L(ui.lang);
  const box = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const start = useRef<{ pl: Placement; d: number; a: number; cx: number; cy: number } | null>(null);
  const [drag, setDrag] = useState(false);
  const cm = pl.w * frameCm(placement);
  const thin = design.detail > 0.55 && cm < 7;

  const snapshot = () => {
    const pts = Array.from(pointers.current.values());
    const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    const d = pts.length > 1 ? Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y) : 0;
    const a = pts.length > 1 ? Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x) : 0;
    start.current = { pl, d, a, cx, cy };
  };

  const down = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    snapshot();
    setDrag(true);
  };
  const move = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId) || !start.current || !box.current) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const r = box.current.getBoundingClientRect();
    const pts = Array.from(pointers.current.values());
    const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    const s0 = start.current;
    const next: Placement = {
      ...s0.pl,
      x: Math.min(1, Math.max(0, s0.pl.x + (cx - s0.cx) / r.width)),
      y: Math.min(1, Math.max(0, s0.pl.y + (cy - s0.cy) / r.height)),
    };
    if (pts.length > 1 && s0.d) {
      const d = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      const a = Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x);
      next.w = Math.min(0.95, Math.max(0.06, s0.pl.w * (d / s0.d)));
      next.rot = Math.round(s0.pl.rot + ((a - s0.a) * 180) / Math.PI);
    }
    setPl(next);
  };
  const up = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size) snapshot();
    else {
      start.current = null;
      setDrag(false);
    }
  };

  const wPx = `${pl.w * 100}%`;
  return (
    <div>
      <div className="editor" ref={box}>
        <img className="bg" src={photo.dataUrl} alt={t('Your photo', 'A fotód')} />
        <div
          className={`ink ${drag ? 'drag' : ''}`}
          style={{
            width: wPx,
            left: `${pl.x * 100}%`,
            top: `${pl.y * 100}%`,
            transform: `translate(-50%, -50%) rotate(${pl.rot}deg) scaleX(${pl.mirror ? -1 : 1})`,
          }}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          onWheel={(e) => setPl({ ...pl, w: Math.min(0.95, Math.max(0.06, pl.w * (e.deltaY < 0 ? 1.05 : 0.95))) })}
          role="img"
          aria-label={t('Tattoo design — drag to move', 'Tetoválásminta – húzd a helyére')}
        >
          <img src={design.ink} alt="" draggable={false} />
        </div>
        <span className="cm">≈ {cm.toFixed(cm < 10 ? 1 : 0)} cm</span>
      </div>

      <div className="sliders">
        <label>
          {ui.t('create.place.size')}
          <input type="range" min={6} max={95} value={Math.round(pl.w * 100)} onChange={(e) => setPl({ ...pl, w: Number(e.target.value) / 100 })} />
        </label>
        <label>
          {ui.t('create.place.rotate')}
          <input type="range" min={-180} max={180} value={pl.rot} onChange={(e) => setPl({ ...pl, rot: Number(e.target.value) })} />
        </label>
      </div>
      <div className="row" style={{ marginTop: 6 }}>
        <button className={`chipbtn ${pl.mirror ? 'on' : ''}`} onClick={() => setPl({ ...pl, mirror: !pl.mirror })}>
          {Icon.mirror} {ui.t('create.place.mirror')}
        </button>
        <button className="chipbtn" onClick={() => setPl({ ...pl, rot: 0 })}>
          {Icon.rotate} 0°
        </button>
      </div>

      {thin && (
        <div className="warnbox" role="note">
          <span>⚠️</span>
          <span>
            <b>{t('Very fine detail for this size.', 'Nagyon apró részletek ehhez a mérethez.')}</b>{' '}
            {t(
              `Lines this close together usually merge within 10 years. Try at least ${Math.ceil(Math.max(7, cm * 1.4))} cm — the preview will show you why.`,
              `Ilyen közeli vonalak 10 éven belül általában összefolynak. Próbáld legalább ${Math.ceil(Math.max(7, cm * 1.4))} cm-esre – az előnézet megmutatja, miért.`
            )}
          </span>
        </div>
      )}

      <div className="stickycta">
        <button className="btn wide" disabled={!canGo} onClick={onGo}>
          {ui.t('create.go')}
        </button>
        {footer}
      </div>
    </div>
  );
}

/** Display name of a stored placement value in the current language. */
export const placeName = (v: string, lang: 'en' | 'hu') => {
  const p = PLACEMENTS.find((x) => x.v === v);
  return p ? (lang === 'hu' ? p.hu : p.en) : v;
};
