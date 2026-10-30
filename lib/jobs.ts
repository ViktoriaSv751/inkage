import type { SupabaseClient } from '@supabase/supabase-js';
import { appSecret, userClient } from './server';
import { logServerError } from './errlog';

const BUCKET = 'previews';
const ID = /^[a-f0-9-]{36}$/;
const isUser = (owner: string) => /^[a-f0-9-]{36}$/.test(owner);

/**
 * Results of a running preview are kept on the server for a while,
 * so closing the app mid-way doesn't lose them (the app picks them up when reopened).
 * With a signed-in user's client the images go to Storage and the row keeps only their path: base64 images in the row
 * made the write slow enough to hit the database's 3 s limit, and the result was lost exactly when it was needed.
 */
export async function jobPut(id: unknown, owner: string, key: string, value: unknown, db?: SupabaseClient | null) {
  if (typeof id !== 'string' || !ID.test(id)) return;
  const v: any = value;
  let stored: unknown = value;
  const m = db && isUser(owner) && typeof v?.image === 'string' ? /^data:(image\/[a-z+]+);base64,(.+)$/i.exec(v.image) : null;
  if (m) {
    const path = `${owner}/jobs/${id}-${key}.${m[1].includes('png') ? 'png' : 'jpg'}`;
    const { error } = await db!.storage.from(BUCKET).upload(path, Buffer.from(m[2], 'base64'), { contentType: m[1], upsert: true });
    if (error) console.warn('job image upload failed', error.message);
    else stored = { ...v, image: undefined, image_path: path };
  }
  const { error } = await userClient()
    .rpc('job_put', { p_secret: appSecret('db'), p_id: id, p_owner: owner, p_key: key, p_value: stored })
    .then((r) => r, (e) => ({ error: e }));
  if (error) {
    console.warn('job_put failed', error.message || error);
    await logServerError('job_put', error);
  }
}

export async function jobGet(id: string, owner: string, db?: SupabaseClient | null) {
  const { data, error } = await userClient().rpc('job_get', { p_secret: appSecret('db'), p_id: id, p_owner: owner });
  if (error) console.warn('job_get failed', error.message);
  const out = (data || null) as Record<string, any> | null;
  if (!out || !db) return out;
  // the images come back in the form the app sent them away in (the aging step checks their hash)
  await Promise.all(
    Object.keys(out).map(async (k) => {
      const path = out[k]?.image_path;
      if (typeof path !== 'string' || !path.startsWith(`${owner}/`)) return;
      const { data: file } = await db.storage.from(BUCKET).download(path);
      if (!file) return;
      const { image_path, ...rest } = out[k];
      out[k] = { ...rest, image: `data:${file.type || 'image/jpeg'};base64,${Buffer.from(await file.arrayBuffer()).toString('base64')}` };
    })
  );
  return out;
}

/** Job images older than two days leave Storage (run at the start of the same person's next preview). */
export async function jobsTidy(owner: string, db: SupabaseClient) {
  if (!isUser(owner)) return;
  const { data } = await db.storage.from(BUCKET).list(`${owner}/jobs`, { limit: 100, sortBy: { column: 'created_at', order: 'asc' } });
  const old = (data || []).filter((f) => f.created_at && Date.now() - new Date(f.created_at).getTime() > 2 * 864e5).map((f) => `${owner}/jobs/${f.name}`);
  if (old.length) await db.storage.from(BUCKET).remove(old);
}
