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

/** First-party analytics: one row per event, no third parties. */
export function track(name: string, props: Record<string, unknown> = {}) {
  const s = sb();
  if (!s) return;
  // usage stats only after "Accept" in the cookie banner
  try {
    if (localStorage.getItem('ink_consent') !== 'all') return;
  } catch {
    return;
  }
  s.rpc('log_event', { p_name: name, p_anon: anonId(), p_props: props }).then(
    () => {},
    () => {}
  );
}

export function lsGet<T>(k: string, fallback: T): T {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : fallback;
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
  const s = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * s);
  c.height = Math.round(img.naturalHeight * s);
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  return new Promise((res) => c.toBlob((b) => res(b!), 'image/jpeg', quality));
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
  const s = sb()!;
  const out: Partial<Record<string, string>> = {};
  // images restored from the server's generation records are served from there
  for (const [k, p] of Object.entries(paths)) if (p && p.startsWith('job:')) out[k] = `/api/job-img/${p.split(':')[1]}/${p.split(':')[2] || k}`;
  const list = Object.entries(paths).filter(([, p]) => !!p && !p.startsWith('job:')) as [string, string][];
  if (!list.length) return out;
  const { data } = await s.storage.from('previews').createSignedUrls(
    list.map(([, p]) => p),
    60 * 60 * 24
  );
  list.forEach(([k], i) => {
    const u = data?.[i]?.signedUrl;
    if (u) out[k] = u;
  });
  return out;
}

async function upload(uid: string, id: string, k: string, src: string) {
  const s = sb()!;
  const png = k === 'design';
  const blob = src.startsWith('data:') ? (png ? await (await fetch(src)).blob() : await shrink(src, 1080)) : await (await fetch(src)).blob();
  const path = `${uid}/${id}/${k}.${png ? 'png' : 'jpg'}`;
  const { error } = await s.storage.from('previews').upload(path, blob, { contentType: png ? 'image/png' : 'image/jpeg', upsert: true });
  return error ? null : path;
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
    return Promise.all(((data as Row[]) || []).map(fromRow));
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
  /**
   * Previews that were generated but are missing from the gallery (lost before "Recently deleted" existed):
   * the server still has their images, so they are uploaded again and put back. Runs once per account.
   */
  async recoverMissing(uid: string): Promise<number> {
    const s = sb()!;
    const { data: list } = await s.rpc('my_recoverable_jobs');
    let n = 0;
    for (const j of (list as { job_id: string; created_at: string; preview_id: string | null; placement: string | null }[]) || []) {
      try {
        const { data } = await s.rpc('my_job_images', { p_job: j.job_id });
        if (!data) continue;
        const id = j.preview_id || crypto.randomUUID();
        const paths: Record<string, string> = {};
        for (const [k, v] of Object.entries(data as Record<string, any>)) {
          const src = typeof v === 'string' ? v : v?.image;
          if (typeof src !== 'string' || !src.startsWith('data:image')) continue;
          const path = await upload(uid, id, k, src).catch(() => null);
          if (path) paths[k] = path;
        }
        if (!paths.fresh) continue;
        const { error } = await s.rpc('restore_from_job', { p_job: j.job_id, p_preview: id, p_paths: paths, p_placement: j.placement, p_created: j.created_at });
        if (!error) n++;
      } catch {}
    }
    return n;
  },
  /** Recently deleted designs (restorable). */
  async trash(): Promise<Preview[]> {
    const { data, error } = await sb()!.from('previews').select('*').eq('hidden', true).not('deleted_at', 'is', null).order('deleted_at', { ascending: false }).limit(60);
    if (error) throw error;
    return Promise.all(((data as Row[]) || []).filter((r) => r.paths && Object.keys(r.paths).length).map(fromRow));
  },
  async restore(id: string) {
    const { data, error } = await sb()!.rpc('restore_preview', { p_id: id });
    if (error) throw error;
    return !!data;
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
