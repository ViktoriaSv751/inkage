'use client';
import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { useApp } from '../AppProvider';
import { OnboardingAnswers } from '../create/Onboarding';
import { Design, Photo } from '../create/steps';
import { tx } from '@/lib/i18n';
import { lsGet, lsSet } from '@/lib/store';
import { Placement } from '@/lib/editor';
import { prepareImage } from '@/lib/client';
import { USE_UPLOAD_KEY, type UseUpload } from '@/lib/uploads';
import { ALL_DESIGNS as DESIGNS } from '@/lib/designs';
import { processDesign } from '@/lib/editor';
import type { Phase } from './types';

/** Opening the page: the onboarding answers, a draft in progress, or work handed over from the gallery or Explore. */
export function useStart({
  phase,
  setPhase,
  setMode,
  setPlacement,
  setPhoto,
  setDesign,
  setPl,
  applyOnboarding,
  explicitMode,
  againRef,
}: {
  phase: Phase;
  setPhase: Dispatch<SetStateAction<Phase>>;
  setMode: Dispatch<SetStateAction<'new' | 'existing' | 'removal'>>;
  setPlacement: Dispatch<SetStateAction<string>>;
  setPhoto: Dispatch<SetStateAction<Photo | null>>;
  setDesign: Dispatch<SetStateAction<Design | null>>;
  setPl: Dispatch<SetStateAction<Placement>>;
  applyOnboarding: (a: OnboardingAnswers) => void;
  explicitMode: MutableRefObject<boolean>;
  againRef: MutableRefObject<boolean>;
}) {
  const { me, ui, toast } = useApp();
  const t = (en: string, hu: string) => tx(ui.lang, en, hu);
  // start: onboarding once, then straight into creating
  useEffect(() => {
    const ans = lsGet<OnboardingAnswers | null>('ink_onboarding', null);
    const draft = (() => {
      try {
        return JSON.parse(sessionStorage.getItem('ink_draft') || 'null');
      } catch {
        return null;
      }
    })();
    const sp = new URLSearchParams(location.search);
    const again = sp.has('again');
    const m = sp.get('mode');
    const redo0 = lsGet<any>('ink_redo', null);
    const pick0 = lsGet<string | null>('ink_pick', null);
    // a mode asked for explicitly wins over the onboarding goal
    explicitMode.current = m === 'removal' || m === 'existing' || !!redo0 || !!pick0;
    if (m === 'removal' || m === 'existing') setMode(m);
    if (again) againRef.current = true;
    if (ans && !again) {
      applyOnboarding(ans);
      setPhase('studio');
    } else setPhase('onboarding');
    // "New design": start with empty slots; otherwise keep work in progress when switching tabs
    let freshStart = false;
    try {
      freshStart = sessionStorage.getItem('ink_fresh') === '1';
      if (freshStart) {
        sessionStorage.removeItem('ink_fresh');
        sessionStorage.removeItem('ink_draft');
      }
    } catch {}
    if (draft && !freshStart) {
      if (draft.placement) setPlacement(draft.placement);
      if (draft.photo) setPhoto(draft.photo);
      if (draft.design) setDesign(draft.design);
      if (draft.pl) setPl(draft.pl);
    }
    // "New preview with this design" from the gallery
    const redo = lsGet<{ design: string | null; placement: string; mode: 'new' | 'existing' | 'removal' } | null>('ink_redo', null);
    if (redo) {
      lsSet('ink_redo', null);
      setPlacement(redo.placement);
      setMode(redo.mode);
      setPhoto(null);
      const cm: 'black' | 'color' = (redo as any).colorMode === 'color' ? 'color' : 'black';
      if (redo.design && redo.mode === 'new') processDesign(redo.design, cm).then((d) => setDesign({ raw: redo.design!, ink: d.dataUrl, ratio: d.ratio, detail: d.detail, mode: cm })).catch(() => {});
      if (ans) setPhase('studio');
    }
    // a design picked in Explore
    const pick = DESIGNS.find((d) => d.id === lsGet<string | null>('ink_pick', null));
    if (pick) {
      lsSet('ink_pick', null);
      setMode('new');
      processDesign(pick.src, 'black').then((d) => setDesign({ raw: pick.src, ink: d.dataUrl, ratio: d.ratio, detail: d.detail, mode: 'black', libId: pick.id }));
    }
    // "Use" on a picture in the gallery's uploads
    const use = lsGet<UseUpload | null>(USE_UPLOAD_KEY, null);
    if (use?.src) {
      lsSet(USE_UPLOAD_KEY, null);
      (async () => {
        const blob = await (await fetch(use.src)).blob();
        const p = await prepareImage(new File([blob], 'upload.jpg', { type: blob.type || 'image/jpeg' }), 1024);
        if (use.kind === 'photo') return setPhoto(p);
        setMode('new');
        const d = await processDesign(p.dataUrl, 'black');
        setDesign({ raw: p.dataUrl, ink: d.dataUrl, ratio: d.ratio, detail: d.detail, mode: 'black' });
      })().catch(() => toast(t('That picture could not be loaded. Try again.', 'Ezt a képet nem sikerült betölteni. Próbáld újra.')));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // signed-in users who onboarded on another device skip it too
  useEffect(() => {
    // any saved answers count – the questions are asked once per person, not once per device
    if (phase === 'onboarding' && me.onboarding && Object.keys(me.onboarding).length > 0 && !againRef.current) {
      lsSet('ink_onboarding', me.onboarding);
      applyOnboarding(me.onboarding);
      setPhase('studio');
    }
  }, [me.onboarding, phase]); // eslint-disable-line react-hooks/exhaustive-deps
}
