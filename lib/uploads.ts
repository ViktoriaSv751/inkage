'use client';
import { sb } from './sb';
import { shrink } from './store';

/** A picture the user added (a body photo or a design), kept on the account so every device sees it. */
export type Upload = { id: string; created_at: string; kind: 'photo' | 'design'; w: number; h: number; src: string };

type Row = { id: string; created_at: string; kind: 'photo' | 'design'; path: string; w: number | null; h: number | null };

const sameImage = new Map<string, string>(); // tail of a data URL → upload id (so a re-pick is not saved twice)

export const uploads = {
  /** Shrink, store in the private bucket, then add the row. Returns the upload, or null when it could not be saved. */
  async add(uid: string, kind: Upload['kind'], dataUrl: string, w: number, h: number): Promise<Upload | null> {
    const s = sb();
    if (!s || !uid) return null;
    const tail = dataUrl.slice(-80);
    if (sameImage.has(tail)) return null;
    const id = crypto.randomUUID();
    sameImage.set(tail, id);
    try {
      const blob = await shrink(dataUrl, 1280, 0.88);
      const path = `${uid}/uploads/${id}.jpg`;
      const up = await s.storage.from('previews').upload(path, blob, { contentType: 'image/jpeg', upsert: true });
      if (up.error) throw up.error;
      const { error } = await s.from('uploads').insert({ id, user_id: uid, kind, path, w, h });
      if (error) {
        await s.storage.from('previews').remove([path]).catch(() => {});
        throw error;
      }
      return { id, created_at: new Date().toISOString(), kind, w, h, src: dataUrl };
    } catch (e) {
      sameImage.delete(tail);
      console.warn('upload save failed', e);
      return null;
    }
  },
  /** The account's uploads, newest first, with signed image links (valid for a day). */
  async list(kind?: Upload['kind'], count = 60): Promise<Upload[]> {
    const s = sb();
    if (!s) return [];
    let q = s.from('uploads').select('id, created_at, kind, path, w, h').order('created_at', { ascending: false }).limit(count);
    if (kind) q = q.eq('kind', kind);
    const { data, error } = await q;
    if (error) throw error;
    const rows = (data as Row[]) || [];
    if (!rows.length) return [];
    const { data: urls } = await s.storage.from('previews').createSignedUrls(rows.map((r) => r.path), 60 * 60 * 24);
    return rows
      .map((r, i) => ({ id: r.id, created_at: r.created_at, kind: r.kind, w: r.w || 0, h: r.h || 0, src: urls?.[i]?.signedUrl || '' }))
      .filter((u) => !!u.src);
  },
  /** Delete for good: the row and the image. */
  async remove(id: string) {
    const s = sb()!;
    const { data, error } = await s.from('uploads').delete().eq('id', id).select('path').maybeSingle();
    if (error) throw error;
    if (data?.path) await s.storage.from('previews').remove([data.path]).catch(() => {});
  },
};

/** An upload picked in the gallery, handed to the studio ("use this photo / design"). */
export const USE_UPLOAD_KEY = 'ink_use_upload';
export type UseUpload = { kind: Upload['kind']; src: string };
