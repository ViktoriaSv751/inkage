'use client';
import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { useApp } from '../AppProvider';
import { Design, Layer, Photo } from '../create/steps';
import { tx } from '@/lib/i18n';
import { api } from '@/lib/sb';
import { lsGet, lsSet, Preview, track } from '@/lib/store';
import { Placement } from '@/lib/editor';
import { FACTS } from './constants';
import type { JobMeta, Phase } from './types';

export function useFreshReset({
  setPhoto,
  setDesign,
  setExtras,
  setPhase,
}: {
  setPhoto: Dispatch<SetStateAction<Photo | null>>;
  setDesign: Dispatch<SetStateAction<Design | null>>;
  setExtras: Dispatch<SetStateAction<Layer[]>>;
  setPhase: Dispatch<SetStateAction<Phase>>;
}) {
  // "New design" tapped while already here: empty the slots
  useEffect(() => {
    const h = () => {
      try {
        sessionStorage.removeItem('ink_fresh');
        sessionStorage.removeItem('ink_draft');
      } catch {}
      setPhoto(null);
      setDesign(null);
      setExtras([]);
      setPhase((ph) => (ph === 'onboarding' || ph === 'loading' ? ph : 'studio'));
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    };
    window.addEventListener('ink:fresh', h);
    return () => window.removeEventListener('ink:fresh', h);
  }, []);
}

/** Keep the work in progress for this tab session (photo, design, spot), so switching tabs does not lose it. */
export function useDraftSave({ phase, placement, photo, design, pl }: { phase: Phase; placement: string; photo: Photo | null; design: Design | null; pl: Placement }) {
  useEffect(() => {
    if (phase === 'loading') return;
    // big images can overflow the browser's storage (iPhone): fall back to lighter drafts
    const tries = [
      { placement, photo, design, pl },
      { placement, photo, design: design ? { ...design, raw: design.ink, original: undefined } : null, pl },
      { placement, photo, design: null, pl },
      { placement, photo: null, design: null, pl },
    ];
    for (const d of tries) {
      try {
        sessionStorage.setItem('ink_draft', JSON.stringify(d));
        break;
      } catch {}
    }
  }, [placement, photo, design, pl, phase]);
}

/** While generating: a new fact about aging ink every few seconds. */
export function useFactTicker(phase: Phase, setFact: Dispatch<SetStateAction<number>>) {
  useEffect(() => {
    if (phase !== 'gen') return;
    const i = setInterval(() => setFact((f) => (f + 1) % FACTS.en.length), 4500);
    return () => clearInterval(i);
  }, [phase]);
}

export function useJobRecovery({
  phase,
  preview,
  recovering,
  setPhase,
  setGenStep,
  showResult,
}: {
  phase: Phase;
  preview: Preview | null;
  recovering: MutableRefObject<boolean>;
  setPhase: Dispatch<SetStateAction<Phase>>;
  setGenStep: Dispatch<SetStateAction<number>>;
  showResult: (data: any, meta: JobMeta, jobId: string, have?: Record<string, any>) => void;
}) {
  const { ui, toast } = useApp();
  const t = (en: string, hu: string) => tx(ui.lang, en, hu);
  // A preview was running when the app was closed or reloaded: pick up its result from the server.
  useEffect(() => {
    if (phase !== 'studio' || recovering.current || preview) return;
    // opened from the "your preview is ready" e-mail: on any device, for as long as the server keeps it
    const fromLink = new URLSearchParams(location.search).get('job');
    if (fromLink) {
      recovering.current = true;
      history.replaceState(null, '', location.pathname);
      if (lsGet<boolean>(`ink_job_done_${fromLink}`, false)) return void location.replace('/app/gallery');
      (async () => {
        setPhase('gen');
        setGenStep(2);
        const r = await api<{ data: Record<string, any> | null }>(`/api/job?id=${encodeURIComponent(fromLink)}`);
        const d = r.ok ? r.data.data : null;
        if (d?.fresh) {
          track('job_from_mail');
          lsSet(`ink_job_done_${fromLink}`, true);
          return showResult(d.fresh, { placement: 'Inner forearm', mode: 'new', size: '', ...(d.meta || {}) } as JobMeta, fromLink, d);
        }
        toast(t('This preview is no longer available. Make a new one.', 'Ez az előnézet már nem érhető el. Készíts egy újat.'));
        setPhase('studio');
      })();
      return;
    }
    const pj = lsGet<{ id: string; at: number; meta: JobMeta } | null>('ink_job', null);
    if (!pj?.id || Date.now() - pj.at > 2 * 3600e3) return;
    recovering.current = true;
    (async () => {
      setPhase('gen');
      setGenStep(2);
      for (let i = 0; i < 40; i++) {
        const r = await api<{ data: Record<string, any> | null }>(`/api/job?id=${pj.id}`);
        const d = r.ok ? r.data.data : null;
        if (d?.fresh) {
          track('job_recovered');
          toast(t('We kept your last preview for you', 'Megtartottuk a legutóbbi előnézetedet'));
          return showResult(d.fresh, pj.meta, pj.id, d);
        }
        if (d?.error || (!d && Date.now() - pj.at > 6 * 60e3)) break;
        await new Promise((res) => setTimeout(res, 4000));
      }
      lsSet('ink_job', null);
      setPhase('studio');
    })();
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps
}
