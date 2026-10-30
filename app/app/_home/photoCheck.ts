'use client';
import { api } from '@/lib/sb';
import type { Area } from '../create/steps';
import type { Skin } from '@/lib/editor';

export type PhotoCheckResult = { ok: boolean; code: string; area: string; box?: Area['box'] | null; angle?: number | null; skin?: Skin | null };

// one AI check per photo and body area: the studio's check and the body-area finder used to send the same photo twice
const running = new Map<string, Promise<{ ok: boolean; status: number; data: PhotoCheckResult }>>();

export function checkPhotoOnce(dataUrl: string, placement: string) {
  const key = `${dataUrl.length}:${dataUrl.slice(-64)}|${placement}`;
  let p = running.get(key);
  if (!p) {
    p = api<PhotoCheckResult>('/api/check-photo', { photo: dataUrl, placement });
    running.set(key, p);
    if (running.size > 12) running.delete(running.keys().next().value!);
    // a failed check may be tried again later
    p.then((r) => !r.ok && running.delete(key));
  }
  return p;
}
