'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../../../AppProvider';
import { haptic } from '@/lib/store';
import { offSkin, Placement, skinVeil } from '@/lib/editor';
import { photoCm } from '@/lib/score';
import { PLACEMENTS } from '@/lib/placements';
import type { Area, Design, Layer, Photo, Skin } from '../types';
import { overflows } from '../geometry';
import { L } from '../utils';
import { useExtraLayers } from './useExtraLayers';
import { useUndo } from './useUndo';
import { useInkGestures } from './useInkGestures';
import { AreaButton, AreaSheet } from './AreaPicker';
import { LayerBar } from './LayerBar';
import { AddLayerSheet } from './AddLayerSheet';
import { PlaceControls } from './PlaceControls';
import { PlaceWarnings } from './PlaceWarnings';

// ================================================================ place

export function PlaceStep({
  photo,
  design: design0,
  placement,
  pl: pl0,
  setPl: setPl0,
  extras = [],
  setExtras,
  onGo,
  canGo,
  footer,
  setPlacement,
  area,
  onFit,
  skin,
}: {
  photo: Photo;
  design: Design;
  placement: string;
  setPlacement: (p: string) => void;
  area?: Area | null;
  skin?: Skin | null;
  onFit?: () => void;
  pl: Placement;
  setPl: (p: Placement) => void;
  /** more tattoos on the same photo (above, below, next to the first) */
  extras?: Layer[];
  setExtras?: (l: Layer[]) => void;
  onGo: () => void;
  canGo: boolean;
  footer?: React.ReactNode;
}) {
  const { ui } = useApp();
  const t = L(ui.lang);
  const box = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  // zoom into the photo (pinch, double-tap or the +/− buttons) to place the tattoo precisely
  const [zoom, setZoom] = useState({ z: 1, tx: 0, ty: 0 });
  const clampZoom = (z: number, tx: number, ty: number) => {
    const r = box.current?.getBoundingClientRect();
    const W = r?.width || 1, H = r?.height || 1;
    z = Math.min(4, Math.max(1, z));
    return { z, tx: Math.min(0, Math.max(W * (1 - z), tx)), ty: Math.min(0, Math.max(H * (1 - z), ty)) };
  };
  const zoomAt = (z: number, px?: number, py?: number) => {
    const r = box.current?.getBoundingClientRect();
    if (!r) return;
    setZoom((o) => {
      // buttons: bring the tattoo being placed to the middle; double-tap: zoom where the finger is
      if (px === undefined || py === undefined) {
        const nz = Math.min(4, Math.max(1, z));
        return clampZoom(nz, r.width / 2 - plRef.current.x * r.width * nz, r.height / 2 - plRef.current.y * r.height * nz);
      }
      const cx = px, cy = py;
      const k = Math.min(4, Math.max(1, z)) / o.z;
      return clampZoom(o.z * k, cx - (cx - o.tx) * k, cy - (cy - o.ty) * k);
    });
  };
  const bgPts = useRef(new Map<number, { x: number; y: number }>());
  const bgStart = useRef<{ z: number; tx: number; ty: number; d: number; mx: number; my: number; moved: boolean } | null>(null);
  const bgSnap = () => {
    const pts = Array.from(bgPts.current.values());
    const r = box.current!.getBoundingClientRect();
    const mx = pts.reduce((a, p) => a + p.x, 0) / pts.length - r.left, my = pts.reduce((a, p) => a + p.y, 0) / pts.length - r.top;
    const d = pts.length > 1 ? Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y) : 0;
    bgStart.current = { ...zoom, d, mx, my, moved: false };
  };
  const bgDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('.ink, .ink-frame, .zoombar')) return;
    // while a tattoo is selected, a second finger anywhere resizes / turns the tattoo – the photo never zooms by itself
    if (sel && pointers.current.size > 0) return down(activeRef.current)(e);
    bgPts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    // one finger scrolls the page when not zoomed; two fingers, or a zoomed photo, are ours
    if (bgPts.current.size > 1 || zoom.z > 1) {
      try {
        (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
      } catch {}
    }
    bgSnap();
  };
  const bgMove = (e: React.PointerEvent) => {
    if (pointers.current.has(e.pointerId)) return move(e);
    if (!bgPts.current.has(e.pointerId) || !bgStart.current || !box.current) return;
    bgPts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = Array.from(bgPts.current.values());
    const r = box.current.getBoundingClientRect();
    const mx = pts.reduce((a, p) => a + p.x, 0) / pts.length - r.left, my = pts.reduce((a, p) => a + p.y, 0) / pts.length - r.top;
    const s0 = bgStart.current;
    if (Math.hypot(mx - s0.mx, my - s0.my) > 6) s0.moved = true;
    if (pts.length > 1 && s0.d && !sel) {
      const k = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y) / s0.d;
      const z = Math.min(4, Math.max(1, s0.z * k));
      const kk = z / s0.z;
      setZoom(clampZoom(z, mx - (s0.mx - s0.tx) * kk, my - (s0.my - s0.ty) * kk));
      s0.moved = true;
    } else if (s0.z > 1) setZoom(clampZoom(s0.z, s0.tx + (mx - s0.mx), s0.ty + (my - s0.my)));
  };
  const bgUp = (e: React.PointerEvent) => {
    if (pointers.current.has(e.pointerId)) return up(e);
    const s0 = bgStart.current;
    bgPts.current.delete(e.pointerId);
    if (bgPts.current.size) return bgSnap();
    bgStart.current = null;
    // a tap on the photo deselects; zooming is only ever done by the user (pinch with nothing selected, or +/−)
    if (s0 && !s0.moved) setSel(false);
  };
  // which tattoo is being edited (0 = the first one) and whether its frame + handles show
  const [active, setActive] = useState(0);
  const [sel, setSel] = useState(false);
  const layers: Layer[] = [{ design: design0, pl: pl0 }, ...extras];
  const cur = Math.min(active, layers.length - 1);
  const design = layers[cur].design;
  const pl = layers[cur].pl;
  const setLayerPl = (i: number, p: Placement) => {
    if (i === 0) setPl0(p);
    else setExtras?.(extras.map((l, k) => (k === i - 1 ? { ...l, pl: p } : l)));
  };
  const activeRef = useRef(0);
  activeRef.current = cur;
  const plRef = useRef(pl);
  plRef.current = pl;
  const setPl = (p: Placement) => setLayerPl(activeRef.current, p);
  const { addOpen, setAddOpen, addBusy, addRef, addLayer, duplicateLayer, myDesigns, addSaved, removeLayer } = useExtraLayers({ design0, pl0, extras, setExtras, layers, setActive, setSel });
  const { remember, undo, canUndo } = useUndo(pl, setPl);
  const { pointers, drag, down, move, up, handleDown, handleMove, handleUp } = useInkGestures({ stage, layers, pl, setPl, activeRef, setActive, setSel, remember });
  // the longer side of the design, in cm
  const fcm = photoCm(placement, area, photo);
  const cm = pl.w * Math.max(1, design.ratio) * fcm;
  const thin = design.detail > 0.55 && cm < 7;
  const [mapOpen, setMapOpen] = useState(false);
  const out = !!area && overflows(area, design, photo, pl);
  const idx = PLACEMENTS.findIndex((p) => p.v === placement);
  // how much of the ink would land on clothes or background (from the skin outline the AI found)
  const [off, setOff] = useState(0);
  useEffect(() => {
    if (!skin?.length) return setOff(0);
    let dead = false;
    const tm = setTimeout(() => offSkin(photo, design.ink, pl, skin).then((v) => !dead && setOff(v)), drag ? 250 : 60);
    return () => {
      dead = true;
      clearTimeout(tm);
    };
  }, [skin, pl.x, pl.y, pl.w, pl.rot, pl.mirror, design.ink, drag]); // eslint-disable-line react-hooks/exhaustive-deps
  const veil = useMemo(() => (skin?.length ? skinVeil(skin, photo.w, photo.h) : null), [skin, photo.w, photo.h]);
  const setCm = (target: number) => {
    remember();
    setPl({ ...pl, w: Math.min(1.4, Math.max(0.04, target / (Math.max(1, design.ratio) * fcm))) });
    haptic();
  };

  const wPx = `${pl.w * 100}%`;
  return (
    <div className="place-grid">
      <div className="col-a">
      <AreaButton idx={idx} placement={placement} onOpen={() => setMapOpen(true)} />
      <div className={`editor ${zoom.z > 1 ? 'zoomed' : ''}`} ref={box} style={{ width: `min(100%, calc(62dvh * ${(photo.w / photo.h).toFixed(4)}))`, marginInline: 'auto' }} onPointerDown={bgDown} onPointerMove={bgMove} onPointerUp={bgUp} onPointerCancel={(e) => (bgPts.current.delete(e.pointerId), bgPts.current.size ? bgSnap() : (bgStart.current = null))}>
        <div className="ed-stage" ref={stage} style={{ transform: `translate(${zoom.tx}px, ${zoom.ty}px) scale(${zoom.z})`, ['--iz' as any]: 1 / zoom.z }}>
        {area && (
          <div
            className={`areabox ${drag ? 'show' : ''} ${out ? 'bad' : ''}`}
            style={{ top: `${area.box[0] * 100}%`, left: `${area.box[1] * 100}%`, height: `${(area.box[2] - area.box[0]) * 100}%`, width: `${(area.box[3] - area.box[1]) * 100}%` }}
          />
        )}
        <img className="bg" src={photo.dataUrl} alt={t('Your photo', 'A fotód')} />
        {veil && <img className={`veil ${drag || off > 0.08 ? 'show' : ''}`} src={veil} alt="" aria-hidden="true" />}
        {layers.map((L1, i) => (
          <div
            key={i}
            className={`ink ${drag && i === cur ? 'drag' : ''}`}
            style={{
              width: `${L1.pl.w * 100}%`,
              left: `${L1.pl.x * 100}%`,
              top: `${L1.pl.y * 100}%`,
              transform: `translate(-50%, -50%) rotate(${L1.pl.rot}deg) scaleX(${L1.pl.mirror ? -1 : 1})`,
            }}
            onPointerDown={down(i)}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
            onWheel={(e) => i === cur && setPl({ ...pl, w: Math.min(1.4, Math.max(0.04, pl.w * (e.deltaY < 0 ? 1.05 : 0.95))) })}
            role="img"
            aria-label={t('Tattoo design — tap to select, drag to move', 'Tetoválásminta – koppints a kijelöléshez, húzd a helyére')}
          >
            <img src={L1.design.ink} alt="" draggable={false} />
          </div>
        ))}
        {/* Canva-style frame, only while a tattoo is selected: corners resize, the top handle rotates */}
        {sel && (
        <div
          className="ink-frame"
          style={{
            width: wPx,
            height: `${((pl.w * design.ratio * photo.w) / photo.h) * 100}%`,
            left: `${pl.x * 100}%`,
            top: `${pl.y * 100}%`,
            transform: `translate(-50%, -50%) rotate(${pl.rot}deg)`,
          }}
        >
          {/* the whole framed area (and a margin around it) drags the selected tattoo – easy even when it is tiny */}
          <div className="frame-hit" onPointerDown={down(cur)} onPointerMove={move} onPointerUp={up} onPointerCancel={up} aria-hidden="true" />
          {(['nw', 'ne', 'se', 'sw'] as const).map((c) => (
            <i key={c} className={`hdl ${c}`} onPointerDown={handleDown('scale')} onPointerMove={handleMove} onPointerUp={handleUp} onPointerCancel={handleUp} aria-hidden="true" />
          ))}
          <i className="hdl rot" onPointerDown={handleDown('rotate')} onPointerMove={handleMove} onPointerUp={handleUp} onPointerCancel={handleUp} aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M19 12a7 7 0 1 1-2.1-5M19 4v4h-4" /></svg>
          </i>
          {setExtras && extras.length < 5 && (
            <button type="button" className="hdl-dup" onPointerDown={(e) => e.stopPropagation()} onClick={() => duplicateLayer(cur)} aria-label={t('Duplicate this tattoo', 'Tetoválás duplikálása')}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" /></svg>
            </button>
          )}
          {cur > 0 && (
            <button type="button" className="hdl-del" onPointerDown={(e) => e.stopPropagation()} onClick={() => removeLayer(cur)} aria-label={t('Remove this tattoo', 'Tetoválás eltávolítása')}>
              ×
            </button>
          )}
        </div>
        )}
        </div>
        <div className="zoombar" role="group" aria-label={t('Zoom', 'Nagyítás')}>
          <button type="button" onClick={() => zoomAt(zoom.z / 1.5)} disabled={zoom.z <= 1} aria-label={t('Zoom out', 'Kicsinyítés')}>−</button>
          <button type="button" className="zlabel" onClick={() => setZoom({ z: 1, tx: 0, ty: 0 })} aria-label={t('Reset zoom', 'Eredeti méret')}>{zoom.z.toFixed(zoom.z < 2 ? 1 : 0)}×</button>
          <button type="button" onClick={() => zoomAt(zoom.z * 1.5)} disabled={zoom.z >= 4} aria-label={t('Zoom in', 'Nagyítás')}>+</button>
        </div>
        {!sel && !drag && <span className="ed-hint">{zoom.z > 1 ? t('Drag the photo to look around · 1× to zoom back out', 'Húzd a fotót a mozgatáshoz · 1× gomb: vissza') : t('Tap the tattoo to resize it · pinch or + to zoom in', 'Koppints a tetoválásra a méretezéshez · csippentés vagy + a nagyításhoz')}</span>}
        <span className="cm">≈ {cm.toFixed(cm < 10 ? 1 : 0)} cm</span>
      </div>
      {setExtras && (
        <LayerBar layers={layers} cur={cur} extras={extras} setActive={setActive} setSel={setSel} setAddOpen={setAddOpen} duplicateLayer={duplicateLayer} />
      )}
      <AddLayerSheet
        addOpen={addOpen}
        setAddOpen={setAddOpen}
        addBusy={addBusy}
        addRef={addRef}
        design0={design0}
        addLayer={addLayer}
        layers={layers}
        duplicateLayer={duplicateLayer}
        myDesigns={myDesigns}
        addSaved={addSaved}
      />

      </div>
      <div className="col-b">
      <PlaceControls pl={pl} setPl={setPl} remember={remember} cm={cm} setCm={setCm} canUndo={canUndo} undo={undo} />

      <PlaceWarnings off={off} out={out} thin={thin} cm={cm} onFit={onFit} remember={remember} />

      <div className="stickycta">
        <button className="btn wide" disabled={!canGo} onClick={onGo}>
          {ui.t('create.go')}
        </button>
        {footer}
      </div>

      </div>
      <AreaSheet open={mapOpen} setMapOpen={setMapOpen} placement={placement} setPlacement={setPlacement} />
    </div>
  );
}
