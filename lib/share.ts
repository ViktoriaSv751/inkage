'use client';
import { loadImage } from './client';
import { api, sb } from './sb';
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

/** A poll: 1–4 designs on one link. With one design friends say yes / change / no, with more they pick one. */
export async function createPoll(items: { p: Preview; label: string }[], question: string) {
  if (!items.length) throw new Error('Pick at least one design.');
  const options = await Promise.all(
    items.slice(0, 4).map(async ({ p, label }) => {
      const src = p.images.fresh || p.images.y50;
      if (!src) throw new Error('Wait for the images first.');
      const [fresh, y50] = await Promise.all([smallJpeg(src, 800), p.images.y50 && p.images.fresh ? smallJpeg(p.images.y50, 800) : Promise.resolve(null)]);
      return { label, placement: p.placement, score: p.score, fresh, y50 };
    })
  );
  const r = await api<{ id?: string; error?: string }>('/api/poll', { question, options });
  if (!r.ok || !r.data.id) throw new Error(r.data?.error || 'Sharing failed. Try again.');
  track('poll_create', { n: options.length });
  return r.data.id;
}

export type PollData = {
  id: string;
  question: string | null;
  created_at: string;
  total: number;
  options: { idx: number; label: string | null; placement: string | null; score: number | null; fresh: string; y50: string | null; votes: number; verdicts: { yes: number; no: number; change: number } }[];
};
export type PollComment = { idx: number; verdict: string | null; comment: string; at: string };

export type MyPoll = { share_id: string; created_at: string; question: string | null; poll: PollData | null; comments: PollComment[] };
/** Polls you made: from your account and from this device (guest cookie). */
export async function myPolls(signedIn: boolean): Promise<MyPoll[]> {
  const out = new Map<string, MyPoll>();
  const [acc, dev] = await Promise.all([
    signedIn ? sb()?.rpc('my_polls').then((r) => (r.data as MyPoll[]) || [], () => []) ?? [] : [],
    api<{ polls?: MyPoll[] }>('/api/poll?mine=1', {}).then((r) => r.data?.polls || [], () => []),
  ]);
  for (const p of [...acc, ...dev]) if (p.poll && !out.has(p.share_id)) out.set(p.share_id, p);
  return [...out.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));
}
export async function closePoll(id: string) {
  const r = await api<{ ok?: boolean }>(`/api/poll?close=${encodeURIComponent(id)}`, {});
  return r.ok;
}
