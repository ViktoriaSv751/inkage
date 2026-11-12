'use client';
/* Studio (B2B) accounts and their guests. An account is a studio when it has a b2b_subs row (any status: a studio
   whose plan ended still sees its guests). Consumers never see any of this: useStudio() returns null for them.
   Tables (supabase/2026-11-12-b2b-guests.sql): b2b_studio (logo, name, auto-delete), guest_links (/e/<id>),
   b2b_purge_queue (files the daily auto-delete left for this app to remove), previews.guest_* columns. */
import { useEffect, useState } from 'react';
import { sb } from './sb';
import { shrink, type Preview, REMOVAL_STAGES, STAGES } from './store';
import { siteOrigin } from './site';

export type Studio = {
  uid: string;
  company: string | null;
  plan: string | null;
  status: string | null;
  /** the name guests see (b2b_studio.name, else the company on the subscription) */
  name: string;
  logoUrl: string | null;
  logoPath: string | null;
  photoDays: 30 | 90 | null;
  deletePreviews: boolean;
  markDownloads: boolean;
};

let cache: { uid: string; at: number; v: Studio | null } | null = null;
let inflight: Promise<Studio | null> | null = null;
const EVT = 'ink:studio';

async function fetchStudio(): Promise<Studio | null> {
  const s = sb();
  if (!s) return null;
  const { data: u } = await s.auth.getUser();
  const uid = u.user?.id;
  if (!uid) return null;
  if (cache && cache.uid === uid && Date.now() - cache.at < 5 * 60e3) return cache.v;
  const [{ data: sub }, { data: st }] = await Promise.all([
    s.from('b2b_subs').select('company, plan, status').eq('user_id', uid).maybeSingle(),
    s.from('b2b_studio').select('name, logo_url, logo_path, photo_days, delete_previews, mark_downloads').eq('user_id', uid).maybeSingle(),
  ]);
  const v: Studio | null = sub
    ? {
        uid,
        company: (sub as any).company ?? null,
        plan: (sub as any).plan ?? null,
        status: (sub as any).status ?? null,
        name: String((st as any)?.name || (sub as any).company || '').trim(),
        logoUrl: (st as any)?.logo_url ?? null,
        logoPath: (st as any)?.logo_path ?? null,
        photoDays: ((st as any)?.photo_days as 30 | 90 | null) ?? null,
        deletePreviews: !!(st as any)?.delete_previews,
        markDownloads: !!(st as any)?.mark_downloads,
      }
    : null;
  cache = { uid, at: Date.now(), v };
  return v;
}

/** The studio name for the corner of downloaded images, when the studio turned it on (else null). */
export function studioMarkText(): string | null {
  const v = cache?.v;
  return v && v.markDownloads && v.name ? v.name.slice(0, 40) : null;
}

export function getStudio(): Promise<Studio | null> {
  return (inflight ||= fetchStudio().finally(() => (inflight = null)));
}

/** The signed-in account's studio, or null (consumers, signed out); undefined while loading. */
export function useStudio(uid?: string | null): Studio | null | undefined {
  const [v, setV] = useState<Studio | null | undefined>(() => (cache && uid && cache.uid === uid ? cache.v : undefined));
  useEffect(() => {
    if (!uid) return setV(null);
    let off = false;
    const load = () => getStudio().then((x) => !off && setV(x), () => !off && setV(null));
    load();
    const on = () => {
      cache = null;
      load();
    };
    window.addEventListener(EVT, on);
    return () => {
      off = true;
      window.removeEventListener(EVT, on);
    };
  }, [uid]);
  return v;
}

/** Save studio settings (creates the row the first time). */
export async function saveStudio(uid: string, patch: Partial<{ name: string | null; logo_url: string | null; logo_path: string | null; photo_days: 30 | 90 | null; delete_previews: boolean; mark_downloads: boolean }>) {
  const s = sb()!;
  const { error } = await s.from('b2b_studio').upsert({ user_id: uid, ...patch, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) throw error;
  cache = null;
  window.dispatchEvent(new Event(EVT));
}

/** The studio logo: a small PNG in the public shares bucket (guests' pages show it), the old one removed. */
export async function uploadLogo(uid: string, file: File, oldPath?: string | null) {
  const s = sb()!;
  const dataUrl = await new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(file);
  });
  const blob = await toPng(dataUrl, 400);
  const path = `${uid}/studio/logo-${Date.now().toString(36)}.png`;
  const up = await s.storage.from('shares').upload(path, blob, { contentType: 'image/png', upsert: true, cacheControl: '31536000' });
  if (up.error) throw up.error;
  const url = s.storage.from('shares').getPublicUrl(path).data.publicUrl;
  await saveStudio(uid, { logo_url: url, logo_path: path });
  if (oldPath && oldPath !== path) await s.storage.from('shares').remove([oldPath]).catch(() => {});
  return url;
}
export async function removeLogo(uid: string, path?: string | null) {
  await saveStudio(uid, { logo_url: null, logo_path: null });
  if (path) await sb()!.storage.from('shares').remove([path]).catch(() => {});
}

/** A logo keeps its transparency: drawn to a PNG no larger than max px. */
async function toPng(dataUrl: string, max: number): Promise<Blob> {
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = dataUrl;
  });
  const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(img.naturalWidth * k));
  c.height = Math.max(1, Math.round(img.naturalHeight * k));
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  const b = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/png'));
  if (!b) throw new Error('logo');
  return b;
}

// ---------------------------------------------------------------- the guest of the preview being made

/** Who the next preview is for: set in the studio's upload step, read when the result is shown (useGenerate). */
let draft: { name: string; consentAt: string | null } = { name: '', consentAt: null };
export const guestDraft = {
  get: () => draft,
  set: (x: Partial<typeof draft>) => (draft = { ...draft, ...x }),
  clear: () => (draft = { name: '', consentAt: null }),
};
/** Fields for a new Preview: only when the studio ticked the consent (consumers: nothing). */
export function guestFields(): Pick<Preview, 'guestName' | 'guestConsentAt'> | Record<string, never> {
  if (!draft.consentAt) return {};
  return { guestName: draft.name.trim().slice(0, 80) || null, guestConsentAt: draft.consentAt };
}

// ---------------------------------------------------------------- guest links (/e/<id>)

export type GuestLink = { id: string; guest_name: string | null; created_at: string; revoked_at: string | null; views: number; items: { id: string }[]; files: string[] };

const LINK_STAGES = [...STAGES, ...REMOVAL_STAGES] as const;

function newId() {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export const guestUrl = (id: string) => `${siteOrigin()}/e/${id}`;

/** Copy the previews' images to the public bucket under a new random id and create the link. */
export async function createGuestLink(uid: string, list: Preview[], guestName: string | null): Promise<GuestLink> {
  const s = sb()!;
  const id = newId();
  const files: string[] = [];
  const items: any[] = [];
  for (const p of list.slice(0, 20)) {
    const images: Record<string, string> = {};
    for (const k of LINK_STAGES) {
      const src = (p.images as any)[k] || (p.removal as any)?.[k];
      if (!src) continue;
      const blob = src.startsWith('data:') ? await shrink(src, 1080) : await (await fetch(src)).blob();
      const path = `${uid}/e/${id}/${p.id.slice(0, 8)}-${k}.jpg`;
      const up = await s.storage.from('shares').upload(path, blob, { contentType: 'image/jpeg', upsert: true, cacheControl: '604800' });
      if (up.error) continue;
      files.push(path);
      images[k] = s.storage.from('shares').getPublicUrl(path).data.publicUrl;
    }
    if (Object.keys(images).length) items.push({ id: p.id, placement: p.placement, created_at: p.created_at, mode: p.mode || 'new', images });
  }
  if (!items.length) throw new Error('no_images');
  const row = { id, user_id: uid, guest_name: guestName?.trim().slice(0, 80) || null, items, files };
  const { data, error } = await s.from('guest_links').insert(row).select('id, guest_name, created_at, revoked_at, views, items, files').single();
  if (error) {
    await s.storage.from('shares').remove(files).catch(() => {});
    throw error;
  }
  return data as GuestLink;
}

export async function listGuestLinks(previewId?: string): Promise<GuestLink[]> {
  const s = sb();
  if (!s) return [];
  let q = s.from('guest_links').select('id, guest_name, created_at, revoked_at, views, items, files').is('revoked_at', null).order('created_at', { ascending: false }).limit(100);
  if (previewId) q = q.contains('items', JSON.stringify([{ id: previewId }])); // a string: supabase-js would turn an array into a Postgres array literal
  const { data } = await q;
  return (data as GuestLink[]) || [];
}

/** Close a guest link: the page stops working and its copied images are removed. */
export async function revokeGuestLink(l: Pick<GuestLink, 'id' | 'files'>) {
  const s = sb()!;
  const { error } = await s.from('guest_links').update({ revoked_at: new Date().toISOString() }).eq('id', l.id);
  if (error) throw error;
  if (l.files?.length) await s.storage.from('shares').remove(l.files).catch(() => {});
}

// ---------------------------------------------------------------- auto-delete: remove the files the sweep queued

let purged = false;
/** Once per app start for studios: the daily b2b_guest_sweep() deleted the records and queued their files here. */
export async function purgeQueuedFiles() {
  if (purged) return;
  purged = true;
  const s = sb();
  if (!s) return;
  const { data } = await s.from('b2b_purge_queue').select('id, bucket, path').limit(500);
  const rows = (data as { id: number; bucket: 'previews' | 'shares'; path: string }[]) || [];
  if (!rows.length) return;
  const done: number[] = [];
  for (const bucket of ['previews', 'shares'] as const) {
    const mine = rows.filter((r) => r.bucket === bucket);
    for (let i = 0; i < mine.length; i += 100) {
      const part = mine.slice(i, i + 100);
      const { error } = await s.storage.from(bucket).remove(part.map((r) => r.path));
      if (!error) done.push(...part.map((r) => r.id));
    }
  }
  if (done.length) await s.from('b2b_purge_queue').delete().in('id', done);
}
