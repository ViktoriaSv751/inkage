'use client';
import { useRef, useState } from 'react';
import { haptic } from '@/lib/store';
import type { Placement } from '@/lib/editor';

export function useUndo(pl: Placement, setPl: (p: Placement) => void) {
  // undo: remember where it was before each gesture
  const hist = useRef<Placement[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const remember = () => {
    const last = hist.current[hist.current.length - 1];
    if (!last || last.x !== pl.x || last.y !== pl.y || last.w !== pl.w || last.rot !== pl.rot || last.mirror !== pl.mirror) hist.current = [...hist.current.slice(-19), pl];
    setCanUndo(true);
  };
  const undo = () => {
    const prev = hist.current.pop();
    if (prev) setPl(prev);
    setCanUndo(hist.current.length > 0);
    haptic();
  };
  return { remember, undo, canUndo };
}
