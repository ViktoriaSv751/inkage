import type { Photo } from './types';

/** The last few photos the user added, to pick again with one tap. Signed in, they come from the account
    (every device sees them); the device's own list is only the fallback. */
export type Recent = { d: string; w: number; h: number; id?: string };
export function recentGet(): Recent[] {
  try {
    return JSON.parse(localStorage.getItem('ink_recent_photos') || '[]');
  } catch {
    return [];
  }
}
export function recentAdd(p: Photo) {
  const list = [{ d: p.dataUrl, w: p.w, h: p.h }, ...recentGet().filter((r) => r.d.slice(-80) !== p.dataUrl.slice(-80))];
  for (let n = 5; n > 0; n--) {
    try {
      localStorage.setItem('ink_recent_photos', JSON.stringify(list.slice(0, n)));
      return;
    } catch {}
  }
}
