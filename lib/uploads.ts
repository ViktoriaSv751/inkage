'use client';
import { sb } from './sb';
import { shrink } from './store';

/** A picture the user added (a body photo, a design, or a tattoo idea saved for later), kept on the account so
    every device sees it. An idea may remember the link it came from and a short note. */
export type UploadKind = 'photo' | 'design' | 'idea';
export type Upload = { id: string; created_at: string; kind: UploadKind; w: number; h: number; src: string; sourceUrl?: string | null; note?: string | null };

type Row = { id: string; created_at: string; kind: UploadKind; path: string; w: number | null; h: number | null; source_url: string | null; note: string | null };

const sameImage = new Map<string, string>(); // tail of a data URL → upload id (so a re-pick is not saved twice)

export const uploads = {
  /** Shrink, store in the private bucket, then add the row. Returns the upload, or null when it could not be saved. */
  async add(uid: string, kind: UploadKind, dataUrl: string, w: number, h: number, extra: { sourceUrl?: string | null; note?: string | null } = {}): Promise<Upload | null> {
    const s = sb();
    if (!s || !uid) return null;
    const tail = dataUrl.slice(-80);
    // the same picture is saved once per kind (an idea can also be a design used earlier)
    const key = `${kind}:${tail}`;
    if (sameImage.has(key)) return null;
    const id = crypto.randomUUID();
    sameImage.set(key, id);
    try {
      const blob = await shrink(dataUrl, 1280, 0.88);
      const path = `${uid}/uploads/${id}.jpg`;
      const up = await s.storage.from('previews').upload(path, blob, { contentType: 'image/jpeg', upsert: true });
      if (up.error) throw up.error;
      const sourceUrl = extra.sourceUrl ? extra.sourceUrl.slice(0, 1000) : null;
      const note = extra.note?.trim() ? extra.note.trim().slice(0, 300) : null;
      const { error } = await s.from('uploads').insert({ id, user_id: uid, kind, path, w, h, source_url: sourceUrl, note });
      if (error) {
        await s.storage.from('previews').remove([path]).catch(() => {});
        throw error;
      }
      return { id, created_at: new Date().toISOString(), kind, w, h, src: dataUrl, sourceUrl, note };
    } catch (e) {
      sameImage.delete(key);
      console.warn('upload save failed', e);
      return null;
    }
  },
  /** The account's uploads, newest first, with signed image links (valid for a day). */
  async list(kind?: UploadKind, count = 60): Promise<Upload[]> {
    const s = sb();
    if (!s) return [];
    let q = s.from('uploads').select('id, created_at, kind, path, w, h, source_url, note').order('created_at', { ascending: false }).limit(count);
    if (kind) q = q.eq('kind', kind);
    const { data, error } = await q;
    if (error) throw error;
    const rows = (data as Row[]) || [];
    if (!rows.length) return [];
    const urls = await (await import('./signcache')).signPaths(rows.map((r) => r.path));
    return rows
      .map((r, i) => ({ id: r.id, created_at: r.created_at, kind: r.kind, w: r.w || 0, h: r.h || 0, src: urls[i] || '', sourceUrl: r.source_url, note: r.note }))
      .filter((u) => !!u.src);
  },
  /** Change an idea's note. */
  async setNote(id: string, note: string) {
    const { error } = await sb()!.from('uploads').update({ note: note.trim().slice(0, 300) || null }).eq('id', id);
    if (error) throw error;
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
export type UseUpload = { kind: 'photo' | 'design'; src: string };
