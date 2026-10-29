'use client';
import { api, sb } from './sb';

export type StageKey = 'fresh' | 'healed' | 'y10' | 'y30' | 'y50';
export const STAGES: StageKey[] = ['fresh', 'healed', 'y10', 'y30', 'y50'];
export type RemovalKey = 'laser3' | 'laser6' | 'laser10';
export const REMOVAL_STAGES: RemovalKey[] = ['laser3', 'laser6', 'laser10'];

export type Report = {
  score: number;
  factors: { label: string; impact: number }[];
  suggestions: string[];
  tips: string[];
  input?: import('./score').ScoreInput;
};

/** One saved preview. images are data URLs locally, storage paths in the cloud. */
export type Preview = {
  id: string;
  created_at: string;
  placement: string;
  size: string;
  score: number | null;
  report: Report | null;
  age: number | null;
  notes: string;
  favorite: boolean;
  collection: string | null;
  images: Partial<Record<StageKey, string>>;
  /** Laser removal preview (laser3 / laser6 / laser10), kept on this device. */
  removal?: Partial<Record<RemovalKey, string>>;
  /** 'existing' = the user's own tattoo, aged; 'removal' = laser removal preview only; otherwise a new design. */
  mode?: 'new' | 'existing' | 'removal';
  /** The design used (data URL), for the artist sheet. */
  design?: string;
  /** black or colour ink, to redo it the same way */
  colorMode?: 'black' | 'color';
  sizeCm?: number;
  /** where the tattoo is in the photo (centre and width as fractions), for the close-up */
  focus?: { x: number; y: number; w: number };
  /** when the user actually got this tattoo ("I got it done") */
  doneAt?: string | null;
  source: 'local' | 'cloud';
  share_id?: string | null;
  /** photos of the real tattoo over the years, to compare with the preview */
  real?: { at: string; src: string; key?: string }[];
};

// ---------------------------------------------------------------- tiny helpers

export function anonId() {
  try {
    let id = localStorage.getItem('ink_anon');
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem('ink_anon', id);
    }
    return id;
  } catch {
    return 'na';
  }
}

export function haptic(kind: 'tap' | 'success' | 'warn' = 'tap') {
  try {
    navigator.vibrate?.(kind === 'success' ? [12, 40, 18] : kind === 'warn' ? [30, 50, 30] : 8);
  } catch {}
}

/* What the owner's dashboard (/admin) reads from every event besides its name: the visit it belongs to (one id per
   browser tab, sessionStorage), the page and the language, and once per visit where it came from (the utm_* tags and
   ?ref of its first page, the referring site, the in-app browser it opened in). No name, photo or e-mail, ever.
   The database moves sid / path / lang into their own columns (events_ink_fill). */
function visitId() {
  try {
    let v = sessionStorage.getItem('ink_sid');
    if (!v) {
      v = Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem('ink_sid', v);
    }
    return v;
  } catch {
    return undefined;
  }
}
type Source = { us?: string; um?: string; uc?: string; ux?: string; ref?: string; from?: string; land?: string; ret?: string };
let src: Source | null = null;
function visitSource(): Source {
  if (src) return src;
  try {
    const kept = sessionStorage.getItem('ink_src');
    if (kept) return (src = JSON.parse(kept) as Source);
  } catch {}
  const o: Source = {};
  try {
    const q = new URLSearchParams(location.search);
    const cut = (v: string | null) => (v ? v.slice(0, 60) : undefined);
    o.us = cut(q.get('utm_source'));
    o.um = cut(q.get('utm_medium'));
    o.uc = cut(q.get('utm_campaign'));
    o.ux = cut(q.get('utm_content'));
    o.ref = cut(q.get('ref'));
    if (document.referrer) {
      const h = new URL(document.referrer).hostname;
      if (h !== location.hostname) o.from = h.slice(0, 60);
    }
    o.land = location.pathname.slice(0, 60);
    // no link and no referring site, from a browser that has been here before: someone coming back by themselves
    let seen = false;
    try {
      seen = localStorage.getItem('ink_seen') === '1';
      localStorage.setItem('ink_seen', '1');
    } catch {}
    if (seen && !o.us && !o.from && !o.ref) o.ret = '1';
    for (const k of Object.keys(o) as (keyof Source)[]) if (!o[k]) delete o[k];
    sessionStorage.setItem('ink_src', JSON.stringify(o));
  } catch {}
  return (src = o);
}
/** The owner's own devices send nothing: /admin marks the browser it runs in, ?inkage_own=1 marks any other one (?inkage_own=0 clears it). */
export function isOwnDevice() {
  try {
    const q = new URLSearchParams(location.search).get('inkage_own');
    if (q === '1') {
      localStorage.setItem('inkage.own', '1');
      document.cookie = 'inkage_own=1; path=/; max-age=63072000; samesite=lax; secure';
    }
    if (q === '0') {
      localStorage.removeItem('inkage.own');
      document.cookie = 'inkage_own=; path=/; max-age=0';
    }
    return localStorage.getItem('inkage.own') === '1';
  } catch {
    return false;
  }
}
// speed tests, crawlers that run JavaScript, and copies of the site on another host (local tests) are not visitors
function isRobot() {
  try {
    if (navigator.webdriver) return true;
    if (/bot|crawl|spider|slurp|lighthouse|pagespeed|headless|ptst|google-inspectiontool|bingpreview|facebookexternalhit/i.test(navigator.userAgent || '')) return true;
    if (/^https?:$/.test(location.protocol) && !/(^|\.)inkage\.app$/.test(location.hostname) && !/InkAgeApp/.test(navigator.userAgent)) return true;
  } catch {}
  return false;
}
// the in-app browser the page is shown in (they rarely pass on where the visitor came from)
function inApp(): string | undefined {
  const u = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
  if (/InkAgeApp/.test(u)) return /Android/i.test(u) ? 'androidapp' : 'iosapp';
  if (/musical_ly|bytedance|tiktok/i.test(u)) return 'tiktok';
  if (/instagram/i.test(u)) return 'instagram';
  if (/FBAN|FBAV|FB_IAB|FBIOS/.test(u)) return 'facebook';
  if (/pinterest/i.test(u)) return 'pinterest';
  if (/linkedinapp/i.test(u)) return 'linkedin';
  if (/snapchat/i.test(u)) return 'snapchat';
  return undefined;
}

/** First-party analytics: one row per event, no third parties. */
export function track(name: string, props: Record<string, unknown> = {}) {
  const s = sb();
  if (!s) return;
  // usage stats only after "Accept" in the cookie banner
  try {
    if (localStorage.getItem('ink_consent') !== 'all') return;
    if (isOwnDevice() || isRobot()) return;
  } catch {
    return;
  }
  let extra: Record<string, unknown> = {};
  try {
    const ia = inApp();
    extra = { sid: (window as any).__inkSid || visitId(), path: (props.path as string) || location.pathname.slice(0, 200), lang: (document.documentElement.lang || '').slice(0, 8) || undefined, src: visitSource(), ...(ia ? { ia } : { pf: 'web' }) };
  } catch {}
  // the app's own "src" (where a design came from: upload, library…) moves to dsrc; src is the visit's source
  const own = typeof props.src === 'string' ? { dsrc: props.src } : {};
  const { src: _drop, ...rest } = props;
  s.rpc('log_event', { p_name: name, p_anon: anonId(), p_props: { ...rest, ...own, ...extra } }).then(
    () => {},
    () => {}
  );
}

export function lsGet<T>(k: string, fallback: T): T {
  try {
    const v = localStorage.getItem(k);
    if (!v) return fallback;
    const got = JSON.parse(v);
    // a broken saved value (null, or not a list where a list is expected) must never crash a page
    if (got === null && fallback !== null) return fallback;
    if (Array.isArray(fallback) && !Array.isArray(got)) return fallback;
    return got as T;
  } catch {
    return fallback;
  }
}
export function lsSet(k: string, v: unknown) {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {}
}

// ---------------------------------------------------------------- IndexedDB (guest gallery)

function idb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open('inkage', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('previews', { keyPath: 'id' });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await idb();
  return new Promise((res, rej) => {
    const t = db.transaction('previews', mode);
    const req = fn(t.objectStore('previews'));
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}
export const local = {
  all: async (): Promise<Preview[]> => ((await tx('readonly', (s) => s.getAll())) as Preview[]).sort((a, b) => b.created_at.localeCompare(a.created_at)),
  put: (p: Preview) => tx('readwrite', (s) => s.put({ ...p, source: 'local' })),
  remove: (id: string) => tx('readwrite', (s) => s.delete(id)),
};

// ---------------------------------------------------------------- image helpers

export async function shrink(dataUrl: string, maxSide = 900, quality = 0.84): Promise<Blob> {
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = dataUrl;
  });
  // iOS decodes big images lazily: drawn before decoding (or with several big images in memory, as while
  // the years are being made) the canvas can come out black. Decode first, and check the result.
  await img.decode?.().catch(() => {});
  const s = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * s);
  c.height = Math.round(img.naturalHeight * s);
  const ctx = c.getContext('2d')!;
  ctx.drawImage(img, 0, 0, c.width, c.height);
  const blob = await new Promise<Blob | null>((res) => c.toBlob((b) => res(b), 'image/jpeg', quality));
  if (blob && !looksEmpty(ctx, c.width, c.height)) return blob;
  // fall back to the original picture rather than saving a black one
  return await (await fetch(dataUrl)).blob();
}

/** True when the canvas came out (almost) all one colour – a failed draw, not a real photo. */
function looksEmpty(ctx: CanvasRenderingContext2D, w: number, h: number) {
  try {
    const pts = [
      [0.5, 0.5], [0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75], [0.5, 0.2], [0.5, 0.8], [0.2, 0.5], [0.8, 0.5],
    ];
    let first = -1;
    for (const [x, y] of pts) {
      const d = ctx.getImageData(Math.floor(w * x), Math.floor(h * y), 1, 1).data;
      const v = d[0] * 65536 + d[1] * 256 + d[2];
      if (d[3] === 0) return true;
      if (first < 0) first = v;
      else if (v !== first) return false;
    }
    return true;
  } catch {
    return false;
  }
}

const blobToDataUrl = (b: Blob) =>
  new Promise<string>((res) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.readAsDataURL(b);
  });

// ---------------------------------------------------------------- cloud gallery

type Row = {
  id: string;
  created_at: string;
  placement: string;
  size: string;
  score: number | null;
  report: Report | null;
  analysis: any;
  notes: string | null;
  favorite: boolean;
  collection: string | null;
  paths: Partial<Record<string, string>>;
  share_id: string | null;
  done_at?: string | null;
};

async function signed(paths: Partial<Record<string, string>>) {
  const out: Partial<Record<string, string>> = {};
  // images restored from the server's generation records are served from there
  for (const [k, p] of Object.entries(paths)) if (p && p.startsWith('job:')) out[k] = `${process.env.NEXT_PUBLIC_NATIVE_BUNDLE ? "https://inkage.app" : ""}/api/job-img/${p.split(':')[1]}/${p.split(':')[2] || k}`;
  const list = Object.entries(paths).filter(([, p]) => !!p && !p.startsWith('job:')) as [string, string][];
  if (!list.length) return out;
  const urls = await (await import('./signcache')).signPaths(list.map(([, p]) => p));
  list.forEach(([k], i) => {
    if (urls[i]) out[k] = urls[i];
  });
  return out;
}

async function upload(uid: string, id: string, k: string, src: string) {
  const s = sb()!;
  const png = k === 'design';
  const blob = src.startsWith('data:') ? (png ? await (await fetch(src)).blob() : await shrink(src, 1080)) : await (await fetch(src)).blob();
  const path = `${uid}/${id}/${k}.${png ? 'png' : 'jpg'}`;
  const { error } = await s.storage.from('previews').upload(path, blob, { contentType: png ? 'image/png' : 'image/jpeg', upsert: true, cacheControl: '604800' });
  (await import('./signcache')).forgetSigned([path]);
  return error ? null : path;
}

/** Many rows at once: all their picture links are signed in one request first (then each row reads them from the cache). */
const fromRows = async (rows: Row[]): Promise<Preview[]> => {
  const paths = rows.flatMap((r) => Object.values(r.paths || {}).filter((p): p is string => !!p && !p.startsWith('job:')));
  if (paths.length) await (await import('./signcache')).signPaths(paths).catch(() => []);
  const out = await Promise.all(rows.map(fromRow));
  // pictures still kept with their generation record load slowly (the server reads them from the database
  // each time): move them into storage once, in the background, so they load like the others next time
  const slow = rows.filter((r) => Object.values(r.paths || {}).some((p) => p?.startsWith('job:')));
  if (slow.length && typeof window !== 'undefined') setTimeout(() => slow.forEach((r) => healJobPaths(r).catch(() => {})), 1500);
  return out;
};

const healing = new Set<string>();
async function healJobPaths(r: Row) {
  const s = sb();
  if (!s || healing.has(r.id)) return;
  healing.add(r.id);
  const { data } = await s.auth.getUser();
  const uid = data.user?.id;
  if (!uid) return;
  const add: Record<string, string> = {};
  for (const [k, p] of Object.entries(r.paths || {})) {
    if (!p?.startsWith('job:')) continue;
    const [, job, key] = p.split(':');
    const res = await fetch(`${process.env.NEXT_PUBLIC_NATIVE_BUNDLE ? 'https://inkage.app' : ''}/api/job-img/${job}/${key || k}`);
    if (!res.ok) continue;
    const blob = await res.blob();
    const png = k === 'design';
    const path = `${uid}/${r.id}/${k}.${png ? 'png' : 'jpg'}`;
    const small = png ? blob : await shrink(URL.createObjectURL(blob), 1080).catch(() => blob);
    const up = await s.storage.from('previews').upload(path, small, { contentType: png ? 'image/png' : 'image/jpeg', upsert: true, cacheControl: '604800' });
    if (!up.error) add[k] = path;
  }
  if (Object.keys(add).length) {
    (await import('./signcache')).forgetSigned(Object.values(add));
    await s.rpc('add_preview_paths', { p_id: r.id, p_paths: add });
  }
}

const fromRow = async (r: Row): Promise<Preview> => {
  const all = await signed(r.paths || {});
  const images: Partial<Record<StageKey, string>> = {};
  for (const k of STAGES) if (all[k]) images[k] = all[k];
  const removal: Partial<Record<RemovalKey, string>> = {};
  for (const k of REMOVAL_STAGES) if (all[k]) removal[k] = all[k];
  const meta = r.analysis?.meta || {};
  const real = Object.keys(all)
    .filter((k) => k.startsWith('real_'))
    .sort()
    .map((k) => ({ key: k, at: new Date(Number(k.slice(5))).toISOString(), src: all[k]! }));
  return {
  id: r.id,
  created_at: r.created_at,
  placement: r.placement,
  size: r.size,
  score: r.score,
  report: r.report,
  age: r.analysis?.apparentAge ?? null,
  notes: r.notes || '',
  favorite: r.favorite,
  collection: r.collection,
  images,
  removal: Object.keys(removal).length ? removal : undefined,
  design: all.design,
  mode: meta.mode,
  colorMode: meta.colorMode,
  sizeCm: meta.sizeCm,
  focus: meta.focus,
  doneAt: r.done_at ?? null,
  real: real.length ? real : undefined,
  source: 'cloud',
  share_id: r.share_id,
  };
};

export const cloud = {
  async all(from = 0, count = 120): Promise<Preview[]> {
    const { data, error } = await sb()!.from('previews').select('*').eq('hidden', false).order('created_at', { ascending: false }).range(from, from + count - 1);
    if (error) throw error;
    return fromRows((data as Row[]) || []);
  },
  async one(id: string): Promise<Preview | null> {
    const { data } = await sb()!.from('previews').select('*').eq('id', id).maybeSingle();
    return data ? fromRow(data as Row) : null;
  },
  /** Upload the images (shrunk) and create the row. */
  async save(uid: string, p: Omit<Preview, 'id' | 'source'> & { analysis?: any }, id = crypto.randomUUID()) {
    const s = sb()!;
    const paths: Partial<Record<string, string>> = {};
    const all: [string, string | undefined][] = [
      ...STAGES.map((k) => [k, p.images[k]] as [string, string | undefined]),
      ...REMOVAL_STAGES.map((k) => [k, p.removal?.[k]] as [string, string | undefined]),
      ['design', p.design],
      ...(p.real || []).map((r) => [r.key || `real_${new Date(r.at).getTime()}`, r.src] as [string, string | undefined]),
    ];
    // the row is created right after the first image, so a preview can never go missing
    // when the app is closed halfway through the upload; the other images are added one by one
    const list = all.filter(([, src]) => !!src) as [string, string][];
    const first = list.find(([k]) => k === 'fresh') || list[0];
    if (first) {
      const path = await upload(uid, id, first[0], first[1]);
      if (path) paths[first[0]] = path;
    }
    const { error } = await s.from('previews').insert({
      id,
      user_id: uid,
      created_at: p.created_at,
      placement: p.placement,
      size: p.size,
      score: p.score,
      report: p.report,
      analysis: { ...(p.analysis ?? (p.age ? { apparentAge: p.age } : {})), meta: { mode: p.mode, sizeCm: p.sizeCm, focus: p.focus, colorMode: p.colorMode } },
      notes: p.notes || null,
      favorite: p.favorite,
      collection: p.collection,
      done_at: p.doneAt ?? null,
      paths,
    });
    if (error) throw error;
    for (const [k, src] of list) {
      if (first && k === first[0]) continue;
      const path = await upload(uid, id, k, src).catch(() => null);
      if (path) await s.rpc('add_preview_paths', { p_id: id, p_paths: { [k]: path } });
    }
    return id;
  },
  /** Add images made later (laser removal) to a saved preview. */
  async addImages(uid: string, id: string, imgs: Partial<Record<string, string>>) {
    const s = sb()!;
    const paths: Record<string, string> = {};
    for (const [k, src] of Object.entries(imgs)) {
      if (!src) continue;
      const path = await upload(uid, id, k, src);
      if (path) paths[k] = path;
    }
    if (!Object.keys(paths).length) return;
    // merged in the database, so parallel uploads never overwrite each other
    const { error } = await s.rpc('add_preview_paths', { p_id: id, p_paths: paths });
    if (error) throw error;
  },
  /** Save edits (favorite, notes, folder, done). Throws if the database refused it. */
  async update(id: string, patch: Partial<Pick<Row, 'notes' | 'favorite' | 'collection' | 'done_at'>>) {
    const { error } = await sb()!.from('previews').update(patch).eq('id', id);
    if (error) throw error;
  },
  /** Delete: moves it to Recently deleted (the share link and any Explore post go away). */
  async remove(uid: string, id: string) {
    const s = sb()!;
    // moved to Recently deleted: the images stay, so it can be restored
    void uid;
    const { error } = await s.rpc('trash_preview', { p_id: id });
    if (error) throw error;
  },
  /** Recently deleted designs (restorable). */
  async trash(): Promise<Preview[]> {
    const { data, error } = await sb()!.from('previews').select('*').eq('hidden', true).not('deleted_at', 'is', null).order('deleted_at', { ascending: false }).limit(60);
    if (error) throw error;
    return fromRows(((data as Row[]) || []).filter((r) => r.paths && Object.keys(r.paths).length));
  },
  async restore(id: string) {
    const { data, error } = await sb()!.rpc('restore_preview', { p_id: id });
    if (error) throw error;
    return !!data;
  },
  /** Empty Recently deleted for good (all, or the given ids): the images are removed from storage too. */
  async purgeTrash(ids?: string[]) {
    const s = sb()!;
    const { data, error } = await s.rpc('purge_trash', { p_ids: ids ?? null });
    if (error) throw error;
    const paths = ((data as string[]) || []).filter(Boolean);
    for (let i = 0; i < paths.length; i += 100) await s.storage.from('previews').remove(paths.slice(i, i + 100)).catch(() => {});
  },
  /** Close a preview's vote link (the preview stays). */
  async unshare(uid: string, id: string) {
    const s = sb()!;
    const { error } = await s.rpc('unshare_preview', { p_preview: id });
    if (error) throw error;
    const { data } = await s.storage.from('shares').list(`${uid}/${id}`);
    const files = (data || []).map((f) => `${uid}/${id}/${f.name}`);
    if (files.length) await s.storage.from('shares').remove(files);
  },
  /** Copy fresh + 50y to the public bucket and return a share id. */
  async share(uid: string, p: Preview) {
    const s = sb()!;
    const out: Record<string, string> = {};
    for (const k of ['fresh', 'y50'] as StageKey[]) {
      const src = p.images[k];
      if (!src) continue;
      const blob = src.startsWith('data:') ? await shrink(src, 900) : await (await fetch(src)).blob();
      const path = `${uid}/${p.id}/${k}.jpg`;
      await s.storage.from('shares').upload(path, blob, { contentType: 'image/jpeg', upsert: true });
      out[k] = s.storage.from('shares').getPublicUrl(path).data.publicUrl;
    }
    if (!out.fresh || !out.y50) throw new Error('Wait for the 50-year image first.');
    const { data, error } = await s.rpc('share_preview', { p_preview: p.id, p_paths: out });
    if (error) throw error;
    return data as string;
  },
};

/** Move previews made as a guest into the signed-in account (once). */
export async function migrateLocal(uid: string) {
  const items = await local.all().catch(() => []);
  for (const p of items) {
    try {
      await cloud.save(uid, p, p.id);
      await local.remove(p.id);
    } catch (e) {
      console.warn('migrate failed', e);
    }
  }
  return items.length;
}

// ---------------------------------------------------------------- vote links made on this device

export type MyShare = { id: string; at: string; label: string; previewId?: string; previewIds?: string[]; kind: 'preview' | 'guest' | 'ab' | 'poll' };
export const shares = {
  all: () => lsGet<MyShare[]>('ink_shares', []),
  add: (s: MyShare) => lsSet('ink_shares', [s, ...shares.all().filter((x) => x.id !== s.id)].slice(0, 100)),
  drop: (id: string) => lsSet('ink_shares', shares.all().filter((x) => x.id !== id)),
  forPreview: (pid: string) => shares.all().filter((x) => x.previewId === pid || x.previewIds?.includes(pid)),
};

/** Revoke a vote link made without an account (or as an A/B link). */
export async function revokeGuestShare(id: string) {
  const r = await api<{ ok?: boolean; error?: string }>(`/api/guest-share?id=${encodeURIComponent(id)}&revoke=1`, {});
  if (r.ok) shares.drop(id);
  return r.ok;
}

export { blobToDataUrl };
