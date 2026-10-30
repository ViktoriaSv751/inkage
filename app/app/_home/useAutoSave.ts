'use client';
import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { useApp } from '../AppProvider';
import { cloud, local, lsSet, Preview, REMOVAL_STAGES, StageKey, STAGES, track } from '@/lib/store';
import type { Phase } from './types';

/** Auto-save when aging settles: to the account when signed in, otherwise on this device. */
export function useAutoSave({
  previewRef,
  pending,
  phase,
  saved,
  savingRef,
  setPreview,
  lateQueue,
  persistLate,
}: {
  previewRef: MutableRefObject<Preview | null>;
  pending: StageKey[];
  phase: Phase;
  saved: MutableRefObject<boolean>;
  savingRef: MutableRefObject<boolean>;
  setPreview: Dispatch<SetStateAction<Preview | null>>;
  lateQueue: MutableRefObject<Record<string, string>>;
  persistLate: (imgs: Record<string, string>, removal?: boolean) => void;
}) {
  const { ui, me, toast } = useApp();
  useEffect(() => {
    const p = previewRef.current;
    if (!p || !p.images.fresh || pending.length || saved.current) return;
    saved.current = true;
    savingRef.current = true;
    (async () => {
      try {
        if (me.user) {
          await cloud.save(me.user.id, { ...p, analysis: p.age ? { apparentAge: p.age } : undefined }, p.id);
          setPreview((x) => (x && x.id === p.id ? { ...x, source: 'cloud' } : x));
          if (previewRef.current) previewRef.current = { ...previewRef.current, source: 'cloud' };
          // images that arrived while uploading
          const cur = previewRef.current;
          const extra: Record<string, string> = {};
          if (cur) {
            for (const k of STAGES) if (cur.images[k] && !p.images[k]) extra[k] = cur.images[k]!;
            for (const k of REMOVAL_STAGES) if (cur.removal?.[k] && !p.removal?.[k]) extra[k] = cur.removal[k]!;
          }
          if (Object.keys(extra).length) await cloud.addImages(me.user.id, p.id, extra).catch(() => {});
          // edits made while uploading (favorite, notes, done)
          if (cur && (cur.notes !== p.notes || cur.favorite !== p.favorite || (cur.doneAt ?? null) !== (p.doneAt ?? null)))
            await cloud.update(p.id, { notes: cur.notes, favorite: cur.favorite, done_at: cur.doneAt ?? null }).catch(() => {});
          toast(ui.t('result.saved'));
        } else {
          await local.put(previewRef.current && previewRef.current.id === p.id ? previewRef.current : p);
        }
        track('preview_saved', { cloud: !!me.user });
        lsSet('ink_job', null);
      } catch (e) {
        console.warn('save failed', e);
        saved.current = false;
      }
      savingRef.current = false;
      if (Object.keys(lateQueue.current).length) persistLate({});
    })();
  }, [pending, phase, me.user]); // eslint-disable-line react-hooks/exhaustive-deps
}
