'use client';
import { useEffect, useState } from 'react';
import { useApp } from '../../../AppProvider';
import { prepareImage } from '@/lib/client';
import { uploads } from '@/lib/uploads';
import type { Photo } from '../types';
import type { Recent } from '../recent';
import { L, withTimeout } from '../utils';

/** The recent-photos strip: the account's uploads. */
export function useRecentPhotos(photo: Photo | null, usePhoto: (p: Photo) => void) {
  const { ui, toast, me } = useApp();
  const t = L(ui.lang);
  const [recent, setRecent] = useState<Recent[]>([]);
  useEffect(() => {
    try {
      localStorage.removeItem('ink_recent_photos'); // the old copies
    } catch {}
    if (!me.user) return;
    let off = false;
    uploads
      .list('photo', 8)
      .then((u) => {
        if (off || !u.length) return;
        // a photo added just now on this device is shown from its local copy until the account list has it
        const ids = new Set(u.map((x) => x.id));
        setRecent((cur) => [...cur.filter((r) => r.id && !ids.has(r.id) && r.d.startsWith('data:')), ...u.map((x) => ({ d: x.src, w: x.w, h: x.h, id: x.id }))].slice(0, 8));
      })
      .catch(() => {});
    return () => {
      off = true;
    };
  }, [photo?.dataUrl, me.user]);
  /** A photo from the account list is a signed link: it is loaded back into a picture before use. */
  const pickRecent = async (r: Recent) => {
    if (r.d.startsWith('data:')) return usePhoto({ dataUrl: r.d, w: r.w, h: r.h });
    try {
      const blob = await withTimeout(fetch(r.d).then((x) => x.blob()), 20000);
      usePhoto(await prepareImage(new File([blob], 'photo.jpg', { type: blob.type || 'image/jpeg' }), 1024));
    } catch {
      toast(t('That photo could not be loaded. Check your connection and try again.', 'Ezt a fotót nem sikerült betölteni. Ellenőrizd a kapcsolatot, és próbáld újra.'));
    }
  };
  /** Every picture the user adds is kept on the account, so it shows on all their devices and in the gallery. */
  const keep = (kind: 'photo' | 'design', p: Photo) => {
    if (!me.user) return;
    uploads.add(me.user.id, kind, p.dataUrl, p.w, p.h).then((u) => {
      if (u && kind === 'photo') setRecent((cur) => [{ d: p.dataUrl, w: p.w, h: p.h, id: u.id }, ...cur.filter((r) => r.d.slice(-80) !== p.dataUrl.slice(-80))].slice(0, 8));
    });
  };
  return { recent, pickRecent, keep };
}
