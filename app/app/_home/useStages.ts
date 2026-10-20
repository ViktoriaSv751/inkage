'use client';
import { useRef, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { useApp } from '../AppProvider';
import { trErr, tx } from '@/lib/i18n';
import { api } from '@/lib/sb';
import { cloud, local, Preview, REMOVAL_STAGES, RemovalKey, StageKey, track } from '@/lib/store';
import { AGE_STAGES, PARENT } from './constants';
import type { Job } from './types';

/** The aging chain and the laser sessions of a finished preview, each image saved as it arrives. */
export function useStages({
  job,
  previewRef,
  saved,
  savingRef,
  removalIntent,
  setPreview,
  setPending,
  setFailed,
  setRemPending,
}: {
  job: MutableRefObject<Job | null>;
  previewRef: MutableRefObject<Preview | null>;
  saved: MutableRefObject<boolean>;
  savingRef: MutableRefObject<boolean>;
  removalIntent: MutableRefObject<boolean>;
  setPreview: Dispatch<SetStateAction<Preview | null>>;
  setPending: Dispatch<SetStateAction<StageKey[]>>;
  setFailed: Dispatch<SetStateAction<StageKey[]>>;
  setRemPending: Dispatch<SetStateAction<RemovalKey[]>>;
}) {
  const { ui, me, toast } = useApp();
  const t = (en: string, hu: string) => tx(ui.lang, en, hu);
  const tokens = useRef<Partial<Record<StageKey, { token: string; image: string }>>>({});
  const started = useRef(new Set<StageKey>());
  const chain = (k: StageKey, fromFresh = false) =>
    (Object.keys(PARENT) as StageKey[]).filter((c) => PARENT[c] === k && !started.current.has(c)).forEach((c) => ageOne(c, fromFresh));
  const ageOne = async (k: StageKey, fromFresh = false) => {
    const j = job.current;
    if (!j) return;
    started.current.add(k);
    setFailed((f) => f.filter((x) => x !== k));
    setPending((p) => (p.includes(k) ? p : [...p, k]));
    const parent = !fromFresh && PARENT[k] && PARENT[k] !== 'fresh' ? tokens.current[PARENT[k]!] : null;
    const base = parent || { token: j.token, image: j.fresh };
    let r = await api<{ image: string; token?: string; error?: string }>('/api/age', { stage: k, image: base.image, token: base.token, job: j.id });
    // if continuing from the previous stage fails, start from the fresh photo instead
    if (!r.ok && parent && job.current === j) r = await api<{ image: string; token?: string; error?: string }>('/api/age', { stage: k, image: j.fresh, token: j.token, job: j.id });
    if (job.current !== j) return; // a newer preview was started meanwhile
    setPending((p) => p.filter((x) => x !== k));
    if (r.ok && r.data.image) {
      if (r.data.token) tokens.current[k] = { token: r.data.token, image: r.data.image };
      setPreview((p) => (p ? { ...p, images: { ...p.images, [k]: r.data.image } } : p));
      persistLate({ [k]: r.data.image });
      if (k === 'y50') track('stage_y50');
      chain(k); // next link of the chain
    } else {
      setFailed((f) => [...f, k]);
      chain(k, true); // the rest of the chain can still start from the fresh photo
      if (r.data?.error) toast(trErr(ui.lang, r.data.error));
    }
  };

  /** An image that arrives after the auto-save (a retried stage, a laser session): add it to the saved preview. */
  const lateQueue = useRef<Record<string, string>>({});
  const persistLate = (imgs: Record<string, string>, removal = false) => {
    Object.assign(lateQueue.current, imgs);
    setTimeout(async () => {
      const p = previewRef.current;
      const batch = lateQueue.current;
      if (!p || !saved.current || savingRef.current || !Object.keys(batch).length) return; // the auto-save picks them up
      lateQueue.current = {};
      try {
        if (p.source === 'cloud' && me.user) await cloud.addImages(me.user.id, p.id, batch);
        else if (p.source === 'local') await local.put(p);
      } catch {
        Object.assign(lateQueue.current, batch);
        toast(t('Could not save the new image. It stays here until you leave.', 'Nem sikerült menteni az új képet. Amíg itt vagy, megmarad.'));
      }
    }, removal ? 400 : 200);
  };
  /** The years on request: 1, 10, 30 and 50 years, added to the saved preview as they arrive. */
  const startAging = () => {
    const j = job.current;
    if (!j) return toast(t('Start a new preview to see the aging.', 'Az öregedéshez indíts új előnézetet.'));
    const was = removalIntent.current;
    removalIntent.current = false;
    started.current = new Set();
    setFailed([]);
    setPending(AGE_STAGES);
    AGE_STAGES.filter((k) => PARENT[k] === 'fresh').forEach((k) => ageOne(k));
    track(was ? 'removal_then_aging' : 'aging_start');
  };

  const removalOne = async (k: RemovalKey) => {
    const j = job.current;
    if (!j) return;
    setRemPending((p) => (p.includes(k) ? p : [...p, k]));
    const r = await api<{ image: string; error?: string }>('/api/age', { stage: k, image: j.fresh, token: j.token, job: j.id });
    if (job.current !== j) return;
    setRemPending((p) => p.filter((x) => x !== k));
    if (r.ok && r.data.image) {
      setPreview((p) => (p ? { ...p, removal: { ...(p.removal || {}), [k]: r.data.image } } : p));
      persistLate({ [k]: r.data.image }, true);
    } else if (r.data?.error) toast(trErr(ui.lang, r.data.error));
  };
  const startRemoval = () => {
    track('removal_start');
    REMOVAL_STAGES.forEach((k) => removalOne(k));
  };

  return { tokens, started, ageOne, lateQueue, persistLate, startAging, startRemoval };
}
