'use client';
import { useRef, useState } from 'react';
import { haptic } from '@/lib/store';
import type { Placement } from '@/lib/editor';
import type { Layer } from '../types';

/** Dragging the tattoos with one or two fingers, and the frame's corner / rotate handles. */
export function useInkGestures({
  stage,
  layers,
  pl,
  setPl,
  activeRef,
  setActive,
  setSel,
  remember,
}: {
  stage: React.RefObject<HTMLDivElement>;
  layers: Layer[];
  pl: Placement;
  setPl: (p: Placement) => void;
  activeRef: React.MutableRefObject<number>;
  setActive: (i: number) => void;
  setSel: (s: boolean) => void;
  remember: () => void;
}) {
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const start = useRef<{ pl: Placement; d: number; a: number; cx: number; cy: number } | null>(null);
  const [drag, setDrag] = useState(false);

  const snapshot = (base: Placement = pl) => {
    const pts = Array.from(pointers.current.values());
    const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    const d = pts.length > 1 ? Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y) : 0;
    const a = pts.length > 1 ? Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x) : 0;
    start.current = { pl: base, d, a, cx, cy };
  };

  const down = (i: number) => (e: React.PointerEvent) => {
    e.stopPropagation();
    if (i !== activeRef.current) {
      activeRef.current = i;
      setActive(i);
      pointers.current.clear();
    }
    setSel(true);
    if (!pointers.current.size) remember();
    try {
      (e.target as Element).setPointerCapture?.(e.pointerId);
    } catch {}
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    snapshot(layers[i].pl);
    setDrag(true);
  };
  const move = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId) || !start.current || !stage.current) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const r = stage.current.getBoundingClientRect();
    const pts = Array.from(pointers.current.values());
    const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    const s0 = start.current;
    const next: Placement = {
      ...s0.pl,
      x: Math.min(1.1, Math.max(-0.1, s0.pl.x + (cx - s0.cx) / r.width)),
      y: Math.min(1.1, Math.max(-0.1, s0.pl.y + (cy - s0.cy) / r.height)),
    };
    if (pts.length > 1 && s0.d) {
      const d = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      const a = Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x);
      next.w = Math.min(1.4, Math.max(0.04, s0.pl.w * (d / s0.d)));
      next.rot = Math.round(s0.pl.rot + ((a - s0.a) * 180) / Math.PI);
    }
    setPl(next);
  };
  // corner / rotate handles
  const hd = useRef<{ mode: 'scale' | 'rotate'; cx: number; cy: number; d0: number; a0: number; pl: Placement } | null>(null);
  const handleDown = (mode: 'scale' | 'rotate') => (e: React.PointerEvent) => {
    e.stopPropagation();
    if (!stage.current) return;
    remember();
    try {
      (e.target as Element).setPointerCapture?.(e.pointerId);
    } catch {}
    const r = stage.current.getBoundingClientRect();
    const cx = r.left + pl.x * r.width, cy = r.top + pl.y * r.height;
    hd.current = { mode, cx, cy, d0: Math.hypot(e.clientX - cx, e.clientY - cy) || 1, a0: Math.atan2(e.clientY - cy, e.clientX - cx), pl };
    setDrag(true);
  };
  const handleMove = (e: React.PointerEvent) => {
    const h = hd.current;
    if (!h) return;
    e.stopPropagation();
    if (h.mode === 'scale') {
      const d = Math.hypot(e.clientX - h.cx, e.clientY - h.cy);
      setPl({ ...h.pl, w: Math.min(1.4, Math.max(0.04, h.pl.w * (d / h.d0))) });
    } else {
      const a = Math.atan2(e.clientY - h.cy, e.clientX - h.cx);
      let rot = Math.round(h.pl.rot + ((a - h.a0) * 180) / Math.PI);
      if (rot > 180) rot -= 360;
      if (rot < -180) rot += 360;
      // gentle snap to straight angles
      for (const snap of [0, 90, -90, 180, -180]) if (Math.abs(rot - snap) < 4) rot = snap;
      setPl({ ...h.pl, rot });
    }
  };
  const handleUp = (e: React.PointerEvent) => {
    e.stopPropagation();
    hd.current = null;
    setDrag(false);
    haptic();
  };

  const up = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size) snapshot();
    else {
      start.current = null;
      setDrag(false);
    }
  };
  return { pointers, drag, down, move, up, handleDown, handleMove, handleUp };
}
