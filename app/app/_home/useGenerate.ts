'use client';
import { type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { useApp } from '../AppProvider';
import { OnboardingAnswers } from '../create/Onboarding';
import { aiPlacement } from '@/lib/placements';
import { Area, Design, Layer, Photo } from '../create/steps';
import { trErr, tx } from '@/lib/i18n';
import { api } from '@/lib/sb';
import { haptic, lsGet, Preview, RemovalKey, StageKey, track } from '@/lib/store';
import { composeMockup, mergeLayers, pasteMask, Placement, Skin } from '@/lib/editor';
import { photoCm } from '@/lib/score';
import { lsSet } from '@/lib/store';
import { AGE_STAGES, PARENT } from './constants';
import { flattenOnWhite } from './flattenOnWhite';
import type { Job, JobMeta, Phase } from './types';

/** The server keeps a running preview's result: wait for it (up to ~5 minutes). null = it failed or never arrived. */
async function waitForJob(id: string) {
  const until = Date.now() + 5 * 60e3;
  while (Date.now() < until) {
    await new Promise((res) => setTimeout(res, 5000));
    const r = await api<{ data: Record<string, any> | null }>(`/api/job?id=${id}`);
    const d = r.ok ? r.data.data : null;
    if (d?.fresh) return d.fresh;
    if (d?.error) return null;
  }
  return null;
}

/** Making a preview: send the photo and the placed design, then show the fresh result and run the aging stages. */
export function useGenerate({
  design,
  pl,
  extras,
  photo,
  mode,
  placement,
  existingCm,
  ob,
  areaNow,
  skinNow,
  removalIntent,
  recovering,
  previewRef,
  prevRef,
  job,
  saved,
  tokens,
  started,
  ageOne,
  startRemoval,
  setPhase,
  setGenStep,
  setErr,
  setPaywall,
  setWaitlist,
  setBusyNote,
  setPreview,
  setPending,
  setFailed,
  setRemPending,
}: {
  design: Design | null;
  pl: Placement;
  extras: Layer[];
  photo: Photo | null;
  mode: 'new' | 'existing' | 'removal';
  placement: string;
  existingCm: number | null;
  ob: OnboardingAnswers | null;
  areaNow: Area | null;
  skinNow: Skin | null;
  removalIntent: MutableRefObject<boolean>;
  recovering: MutableRefObject<boolean>;
  previewRef: MutableRefObject<Preview | null>;
  prevRef: MutableRefObject<Preview | null>;
  job: MutableRefObject<Job | null>;
  saved: MutableRefObject<boolean>;
  tokens: MutableRefObject<Partial<Record<StageKey, { token: string; image: string }>>>;
  started: MutableRefObject<Set<StageKey>>;
  ageOne: (k: StageKey, fromFresh?: boolean) => Promise<void>;
  startRemoval: () => void;
  setPhase: Dispatch<SetStateAction<Phase>>;
  setGenStep: Dispatch<SetStateAction<number>>;
  setErr: Dispatch<SetStateAction<string>>;
  setPaywall: Dispatch<SetStateAction<boolean>>;
  setWaitlist: Dispatch<SetStateAction<boolean>>;
  setBusyNote: Dispatch<SetStateAction<boolean>>;
  setPreview: Dispatch<SetStateAction<Preview | null>>;
  setPending: Dispatch<SetStateAction<StageKey[]>>;
  setFailed: Dispatch<SetStateAction<StageKey[]>>;
  setRemPending: Dispatch<SetStateAction<RemovalKey[]>>;
}) {
  const { ui, me, openAuth, refreshMe } = useApp();
  const t = (en: string, hu: string) => tx(ui.lang, en, hu);
  const go = async (over?: { design?: Design; pl?: Placement; redo?: string[] }) => {
    let d = over?.design ?? design;
    let place = over?.pl ?? pl;
    // several tattoos: merge them into one design laid out exactly as placed
    if (!over?.design && d && extras.length && photo && mode === 'new') {
      const m = await mergeLayers(photo, [{ design: d, pl: place }, ...extras]).catch(() => null);
      if (m) {
        d = { ...d, ink: m.design.ink, raw: m.design.ink, ratio: m.design.ratio, detail: m.design.detail, mode: m.design.mode, libId: undefined };
        place = m.pl;
      }
    }
    const existing = mode !== 'new';
    removalIntent.current = mode === 'removal';
    if (!photo || (!d && !existing)) return;
    recovering.current = true; // a new job: nothing to recover any more
    // keep the finished one around to compare with
    if (previewRef.current?.images.y50) prevRef.current = previewRef.current;
    job.current = null;
    setPending([]);
    setRemPending([]);
    setErr('');
    setPhase('gen');
    setGenStep(0);
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    haptic();
    track('generate_start', { placement, lib: d?.libId || null, mode });
    const timers = [setTimeout(() => setGenStep(1), 3500), setTimeout(() => setGenStep(2), 17000)];
    const cm = place.w * Math.max(1, d?.ratio ?? 1) * photoCm(placement, areaNow, photo);
    const extra = existing
      ? { mode: 'existing', sizeCm: existingCm ?? undefined }
      : await (async () => {
          const [flat, mockup, mask] = await Promise.all([
            flattenOnWhite(d!.ink, 1024, place.rot, place.mirror),
            composeMockup(photo.dataUrl, d!.ink, place),
            pasteMask(photo, d!.ink, place, skinNow).catch(() => null),
          ]);
          return {
            design: flat,
            mockup,
            mask,
            redo: over?.redo,
            size: cm < 6 ? 'small' : cm > 12 ? 'large' : 'medium',
            colorMode: d!.mode,
            sizeCm: Math.round(cm * 10) / 10,
            detail: d!.detail,
          };
        })();
    const jobId = crypto.randomUUID();
    const meta: JobMeta = {
      placement,
      mode: mode === 'removal' ? 'removal' : existing ? 'existing' : 'new',
      size: existing ? t('existing tattoo', 'meglévő tetoválás') : `${cm.toFixed(1)} cm`,
      sizeCm: existing ? existingCm ?? undefined : Math.round(cm * 10) / 10,
      design: existing ? undefined : d!.ink,
      colorMode: existing ? undefined : d!.mode,
      focus: existing ? undefined : { x: place.x, y: place.y, w: place.w * Math.max(1, d!.ratio * (photo.w / photo.h)) },
    };
    // remember the running job, so its result can be picked up if the app gets closed
    try {
      localStorage.setItem('ink_job', JSON.stringify({ id: jobId, at: Date.now(), meta }));
    } catch {
      try {
        localStorage.setItem('ink_job', JSON.stringify({ id: jobId, at: Date.now(), meta: { ...meta, design: undefined } }));
      } catch {}
    }
    const body = { photo: photo.dataUrl, placement: aiPlacement(placement), sun: lsGet<any>('ink_onboarding', null)?.sun || ob?.sun, ageHint: lsGet<any>('ink_onboarding', null)?.age || ob?.age, lang: ui.lang, w: photo.w, h: photo.h, job: jobId, ...extra };
    let r = await api<any>('/api/generate', body);
    // the connection dropped or the server ran out of time: the preview may still be finishing (and is already counted),
    // so ask for its result instead of starting (and paying for) a new one
    if (!r.ok && (r.status === 0 || r.status === 502 || r.status === 504) && r.data?.code !== 'ai_consent' && !/Lots of people|safety|paused/.test(r.data?.error || '')) {
      const got = await waitForJob(jobId);
      if (got) r = { ok: true, status: 200, data: got };
    }
    // a busy minute at the AI provider (the attempt was refunded): wait and retry automatically (twice)
    for (let i = 0; i < 2 && !r.ok && /Lots of people/.test(r.data?.error || ''); i++) {
      setBusyNote(true);
      await new Promise((res) => setTimeout(res, 12000));
      r = await api<any>('/api/generate', body);
    }
    setBusyNote(false);
    timers.forEach(clearTimeout);

    if (!r.ok) {
      lsSet('ink_job', null);
      setPhase(existing ? 'studio' : 'place');
      if (r.data?.code === 'busy') setWaitlist(true);
      if (r.data?.code === 'paywall') {
        track('paywall', { plan: r.data.plan });
        if (!me.user) openAuth(t('Sign in to keep going and keep your designs.', 'Jelentkezz be, és folytathatod – a terveid is megmaradnak.'));
        else setPaywall(true);
        return;
      }
      setErr(trErr(ui.lang, r.data?.error));
      track('generate_error', { status: r.status, msg: String(r.data?.error || '').slice(0, 80) });
      return;
    }

    setGenStep(3);
    haptic('success');
    track('generate_done', { qc: r.data.qc, score: r.data.report?.score, mode });
    showResult(r.data, meta, jobId);
  };

  /** Show a finished fresh image and run (or continue) the aging stages. */
  const showResult = (data: any, meta: JobMeta, jobId: string, have: Record<string, any> = {}) => {
    saved.current = false;
    const images: Preview['images'] = { fresh: data.image };
    for (const k of AGE_STAGES) if (have[k]?.image) images[k] = have[k].image;
    const p: Preview = {
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      placement: meta.placement,
      size: meta.size,
      sizeCm: meta.sizeCm,
      score: data.report?.score ?? null,
      report: data.report ?? null,
      age: data.age ?? null,
      notes: '',
      favorite: false,
      collection: null,
      images,
      mode: meta.mode,
      colorMode: meta.colorMode,
      design: meta.design,
      focus: meta.focus,
      source: 'local',
    };
    setPreview(p);
    setFailed([]);
    setPhase('result');
    refreshMe();
    if (data.canAge && data.token) {
      job.current = { token: data.token, fresh: data.image, id: jobId };
      tokens.current = {};
      started.current = new Set();
      for (const k of AGE_STAGES) if (have[k]?.token) ((tokens.current[k] = have[k]), started.current.add(k));
      const missing = AGE_STAGES.filter((k) => !images[k]);
      setPending(missing);
      // start every missing stage whose parent is ready
      if (removalIntent.current || meta.mode === 'removal') {
        removalIntent.current = true;
        // removal preview: skip aging, simulate the laser sessions straight away
        setPending([]);
        lsSet('ink_job', null);
        startRemoval();
        return;
      }
      // Aging is optional: the fresh result is saved straight away, and the years are made only when asked
      // ("Show how it ages" on the result). A recovered preview whose aging had already started carries on.
      if (!AGE_STAGES.some((k) => images[k])) return setPending([]);
      missing.filter((k) => PARENT[k] === 'fresh' || images[PARENT[k]!]).forEach((k) => ageOne(k));
    } else lsSet('ink_job', null);
  };

  return { go, showResult };
}
