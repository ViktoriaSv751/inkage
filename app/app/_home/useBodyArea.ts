'use client';
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { aiPlacement } from '@/lib/placements';
import { Area, Design, fitToArea, Photo } from '../create/steps';
import { checkPhotoOnce } from './photoCheck';
import { haptic } from '@/lib/store';
import { Placement, Skin } from '@/lib/editor';
import type { Phase } from './types';

/** Where the chosen body part and the bare skin are in the photo, and snapping the design onto that spot. */
export function useBodyArea({
  photo,
  placement,
  mode,
  phase,
  design,
  setPl,
}: {
  photo: Photo | null;
  placement: string;
  mode: 'new' | 'existing' | 'removal';
  phase: Phase;
  design: Design | null;
  setPl: Dispatch<SetStateAction<Placement>>;
}) {
  // where the chosen body part is in the photo (found by the AI), and whether the user moved the design since
  const [area, setArea] = useState<(Area & { for: string; photo: string }) | null>(null);
  const userMoved = useRef(false);
  // the bare skin in the photo (outlines found by the AI), so the design never goes on clothes
  const [skin, setSkin] = useState<{ polys: Skin; photo: string } | null>(null);
  const skinNow = skin && photo && skin.photo === photo.dataUrl.slice(-64) ? skin.polys : null;
  const keepSkin = (ph: Photo, polys?: Skin | null) => {
    if (polys?.length) setSkin({ polys, photo: ph.dataUrl.slice(-64) });
  };

  const locate = async (ph: Photo, where: string) => {
    const r = await checkPhotoOnce(ph.dataUrl, aiPlacement(where));
    if (r.ok) keepSkin(ph, r.data.skin);
    if (r.ok && r.data.box) setArea({ box: r.data.box, angle: r.data.angle ?? 0, for: where, photo: ph.dataUrl.slice(-64) });
    else setArea(null);
  };
  const areaNow = area && photo && area.for === placement && area.photo === photo.dataUrl.slice(-64) ? area : null;
  const fit = () => {
    if (!areaNow || !design || !photo) return;
    setPl(fitToArea(areaNow, design, photo));
    userMoved.current = false;
    haptic();
  };
  // body part changed after the photo was added: find the new spot
  useEffect(() => {
    if (!photo || mode !== 'new' || phase === 'loading' || phase === 'onboarding') return;
    if (area && area.for === placement && area.photo === photo.dataUrl.slice(-64)) return;
    const tm = setTimeout(() => locate(photo, placement), 900);
    return () => clearTimeout(tm);
  }, [placement, photo]); // eslint-disable-line react-hooks/exhaustive-deps
  // snap the design into the body part automatically until the user moves it themselves
  useEffect(() => {
    if (phase === 'place' && areaNow && design && photo && !userMoved.current) setPl(fitToArea(areaNow, design, photo));
  }, [phase, areaNow?.box?.join(','), design?.ink]); // eslint-disable-line react-hooks/exhaustive-deps
  return { setArea, userMoved, skinNow, keepSkin, areaNow, fit };
}
