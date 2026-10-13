'use client';
import { loadImage } from './client';
import { api } from './sb';
import { Preview, track } from './store';

/** Small JPEG for links (kept under ~450 KB). */
export async function smallJpeg(src: string, max = 900) {
  const img = await loadImage(src);
  const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * s);
  c.height = Math.round(img.naturalHeight * s);
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  let q = 0.82,
    out = c.toDataURL('image/jpeg', q);
  while (out.length > 450_000 && q > 0.4) out = c.toDataURL('image/jpeg', (q -= 0.12));
  return out;
}

/** Open the share sheet (or copy) for a vote link. */
export async function shareVoteLink(id: string, text: string, copied: () => void) {
  const url = `${location.origin}/v/${id}`;
  track('share_link', { id });
  const nav: any = navigator;
  if (nav.share) await nav.share({ url, title: 'InkAge', text }).catch(() => {});
  else {
    await navigator.clipboard.writeText(url);
    copied();
  }
}

/** "Which one should I get?" — two previews on one vote link. */
export async function abShare(a: Preview, b: Preview, labelA: string, labelB: string) {
  if (!a.images.fresh || !a.images.y50 || !b.images.fresh || !b.images.y50) throw new Error('Wait for the 50-year images first.');
  const [fresh, y50, freshB, y50B] = await Promise.all([smallJpeg(a.images.fresh), smallJpeg(a.images.y50), smallJpeg(b.images.fresh), smallJpeg(b.images.y50)]);
  const r = await api<{ id?: string; error?: string }>('/api/guest-share', { fresh, y50, freshB, y50B, labelA, labelB, placement: a.placement, score: a.score });
  if (!r.ok || !r.data.id) throw new Error(r.data?.error || 'Sharing failed. Try again.');
  track('share_ab');
  return r.data.id;
}
