'use client';
import { sb } from './sb';

export type StageKey = 'fresh' | 'healed' | 'y10' | 'y30' | 'y50';
export const STAGES: StageKey[] = ['fresh', 'healed', 'y10', 'y30', 'y50'];

export type Report = {
  score: number;
  factors: { label: string; impact: number }[];
  suggestions: string[];
  tips: string[];
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
  source: 'local' | 'cloud';
  share_id?: string | null;
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
  paths: Partial<Record<StageKey, string>>;
  share_id: string | null;
};

async function signed(paths: Partial<Record<StageKey, string>>) {
  const s = sb()!;
  const list = Object.entries(paths).filter(([, p]) => !!p) as [StageKey, string][];
  if (!list.length) return {};
  const { data } = await s.storage.from('previews').createSignedUrls(
    list.map(([, p]) => p),
    60 * 60
  );
  const out: Partial<Record<StageKey, string>> = {};
  list.forEach(([k], i) => {
    const u = data?.[i]?.signedUrl;
    if (u) out[k] = u;
  });
  return out;
}

const fromRow = async (r: Row): Promise<Preview> => ({
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
  images: await signed(r.paths || {}),
  source: 'cloud',
  share_id: r.share_id,
});

export const cloud = {
  async all(): Promise<Preview[]> {
    const { data } = await sb()!.from('previews').select('*').eq('hidden', false).order('created_at', { ascending: false }).limit(200);
    return Promise.all(((data as Row[]) || []).map(fromRow));
  },
  async one(id: string): Promise<Preview | null> {
    const { data } = await sb()!.from('previews').select('*').eq('id', id).maybeSingle();
    return data ? fromRow(data as Row) : null;
  },
  /** Upload the images (shrunk) and create the row. */
  async save(uid: string, p: Omit<Preview, 'id' | 'source'> & { analysis?: any }, id = crypto.randomUUID()) {
    const s = sb()!;
    const paths: Partial<Record<StageKey, string>> = {};
    for (const k of STAGES) {
      const src = p.images[k];
      if (!src) continue;
      const blob = src.startsWith('data:') ? await shrink(src, 1080) : await (await fetch(src)).blob();
      const path = `${uid}/${id}/${k}.jpg`;
      const { error } = await s.storage.from('previews').upload(path, blob, { contentType: 'image/jpeg', upsert: true });
      if (!error) paths[k] = path;
    }
    const { error } = await s.from('previews').insert({
      id,
      user_id: uid,
      created_at: p.created_at,
      placement: p.placement,
      size: p.size,
      score: p.score,
      report: p.report,
      analysis: p.analysis ?? (p.age ? { apparentAge: p.age } : null),
      notes: p.notes || null,
      favorite: p.favorite,
      collection: p.collection,
      paths,
    });
    if (error) throw error;
    return id;
  },
  update: (id: string, patch: Partial<Pick<Row, 'notes' | 'favorite' | 'collection'>>) => sb()!.from('previews').update(patch).eq('id', id),
  hide: (id: string) => sb()!.from('previews').update({ hidden: true }).eq('id', id),
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

export { blobToDataUrl };
