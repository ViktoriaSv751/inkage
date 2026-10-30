'use client';
import { useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { useApp } from '../../AppProvider';
import { AGE_STAGES } from '../../_home/constants';
import { trErr } from '@/lib/i18n';
import { api } from '@/lib/sb';
import { Preview, StageKey, track } from '@/lib/store';

/** The years of a preview saved in the gallery: makes what is missing, each image shown as it arrives. */
export function useSavedAging(setOpen: Dispatch<SetStateAction<Preview | null>>, setItems: Dispatch<SetStateAction<Preview[] | null>>) {
  const { ui, toast } = useApp();
  const [pending, setPending] = useState<Record<string, StageKey[]>>({});
  const [failed, setFailed] = useState<Record<string, StageKey[]>>({});
  const running = useRef(new Set<string>());
  const started = useRef(new Set<string>());

  const one = async (id: string, k: StageKey) => {
    const r = await api<{ image: string; error?: string }>('/api/age-saved', { id, stage: k });
    setPending((all) => ({ ...all, [id]: (all[id] || []).filter((x) => x !== k) }));
    if (r.ok && r.data.image) {
      const add = (p: Preview) => (p.id === id ? { ...p, images: { ...p.images, [k]: r.data.image } } : p);
      setOpen((o) => (o ? add(o) : o));
      setItems((all) => all?.map(add) ?? null);
      if (k === 'y50') track('stage_y50');
    } else if (r.status !== 409 || r.data?.error !== 'Already done') {
      setFailed((all) => ({ ...all, [id]: [...(all[id] || []), k] }));
      if (r.data?.error) toast(trErr(ui.lang, r.data.error));
    }
  };

  const start = async (p: Preview) => {
    const missing = AGE_STAGES.filter((k) => !p.images[k]);
    if (!missing.length || running.current.has(p.id)) return;
    running.current.add(p.id);
    started.current.add(p.id);
    setFailed((all) => ({ ...all, [p.id]: [] }));
    setPending((all) => ({ ...all, [p.id]: missing }));
    track('aging_start', { from: 'gallery', continued: missing.length < AGE_STAGES.length });
    // 1 year from the fresh image, next to the chain of 10, 30 and 50 years
    await Promise.all([
      missing.includes('healed') ? one(p.id, 'healed') : null,
      (async () => {
        for (const k of missing.filter((x) => x !== 'healed')) await one(p.id, k);
      })(),
    ]);
    running.current.delete(p.id);
  };

  return { pending, failed, start, wasStarted: (id: string) => started.current.has(id) };
}
