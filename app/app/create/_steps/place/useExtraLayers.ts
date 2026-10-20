'use client';
import { useEffect, useRef, useState } from 'react';
import { useApp } from '../../../AppProvider';
import { api } from '@/lib/sb';
import { haptic } from '@/lib/store';
import { prepareImage } from '@/lib/client';
import { uploads } from '@/lib/uploads';
import { processDesign, type Placement } from '@/lib/editor';
import type { Design, Layer } from '../types';
import { L } from '../utils';

/** More tattoos on the same photo: add (upload or saved upload), duplicate and remove them. */
export function useExtraLayers({
  design0,
  pl0,
  extras,
  setExtras,
  layers,
  setActive,
  setSel,
}: {
  design0: Design;
  pl0: Placement;
  extras: Layer[];
  setExtras?: (l: Layer[]) => void;
  layers: Layer[];
  setActive: (i: number) => void;
  setSel: (s: boolean) => void;
}) {
  const { ui, toast, me } = useApp();
  const t = L(ui.lang);
  const [addOpen, setAddOpen] = useState(false);
  const [addBusy, setAddBusy] = useState(false);
  const addRef = useRef<HTMLInputElement>(null);
  const addLayer = async (raw: string, fromPhoto: boolean) => {
    setAddBusy(true);
    try {
      let src = raw;
      if (fromPhoto) {
        const r = await api<{ image?: string; error?: string }>('/api/extract', { image: raw, color: design0.mode === 'color' });
        if (!r.ok || !r.data.image) throw new Error(r.data?.error || 'extract');
        src = r.data.image;
      }
      const d = await processDesign(src, design0.mode, { clean: fromPhoto });
      // place it right under the first one, a bit smaller
      const next: Layer = { design: { raw: src, ink: d.dataUrl, ratio: d.ratio, detail: d.detail, mode: design0.mode }, pl: { x: pl0.x, y: Math.min(0.92, pl0.y + 0.18), w: pl0.w * 0.8, rot: 0, mirror: false } };
      setExtras?.([...extras, next]);
      setActive(extras.length + 1);
      setSel(true);
      setAddOpen(false);
      haptic('success');
      toast(t('Added — drag it where you want it', 'Hozzáadva – húzd oda, ahová szeretnéd'));
    } catch {
      toast(t('Could not add that picture. Try another one.', 'Ezt a képet nem sikerült hozzáadni. Próbálj egy másikat.'));
    }
    setAddBusy(false);
  };
  /** One tap: the same tattoo again, a little to the side, ready to drag (same design, size and angle). */
  const duplicateLayer = (i: number) => {
    if (!setExtras || extras.length >= 5) return toast(t('Up to 6 tattoos on one photo.', 'Egy fotón legfeljebb 6 tetoválás lehet.'));
    const src = layers[i];
    const next: Layer = { design: src.design, pl: { ...src.pl, x: src.pl.x + (src.pl.x > 0.7 ? -0.1 : 0.1), y: Math.min(0.95, src.pl.y + 0.06) } };
    setExtras([...extras, next]);
    setActive(extras.length + 1);
    setSel(true);
    setAddOpen(false);
    haptic('success');
    toast(t('Copied — drag it where you want it', 'Lemásolva – húzd oda, ahová szeretnéd'));
  };
  // the designs this person uploaded before (from the account), to add with one tap
  const [myDesigns, setMyDesigns] = useState<{ id: string; src: string }[]>([]);
  useEffect(() => {
    if (!addOpen || !me.user) return;
    uploads.list('design', 12).then((u) => setMyDesigns(u.map((x) => ({ id: x.id, src: x.src }))), () => {});
  }, [addOpen, me.user]);
  /** A saved upload is a signed link: it is turned back into a picture, then added like a fresh upload. */
  const addSaved = async (src: string) => {
    setAddBusy(true);
    try {
      const blob = await (await fetch(src)).blob();
      const pimg = await prepareImage(new File([blob], 'design.jpg', { type: blob.type || 'image/jpeg' }), 1024, 'image/jpeg');
      const probe = await processDesign(pimg.dataUrl, design0.mode).catch(() => null);
      setAddBusy(false);
      await addLayer(pimg.dataUrl, !!probe?.photoLike);
    } catch {
      setAddBusy(false);
      toast(t('Could not add that picture. Try another one.', 'Ezt a képet nem sikerült hozzáadni. Próbálj egy másikat.'));
    }
  };
  const removeLayer = (i: number) => {
    if (i === 0) return;
    setExtras?.(extras.filter((_, k) => k !== i - 1));
    setActive(0);
    setSel(false);
  };
  return { addOpen, setAddOpen, addBusy, addRef, addLayer, duplicateLayer, myDesigns, addSaved, removeLayer };
}
