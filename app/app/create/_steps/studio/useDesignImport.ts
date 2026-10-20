'use client';
import { useEffect, useState } from 'react';
import { useApp } from '../../../AppProvider';
import { trErr } from '@/lib/i18n';
import { api } from '@/lib/sb';
import { haptic, track } from '@/lib/store';
import { prepareImage } from '@/lib/client';
import { cropImage, processDesign } from '@/lib/editor';
import type { Box, Found } from '../../Picker';
import type { Design, Photo } from '../types';
import { L, withTimeout } from '../utils';

/** Everything that turns a picture (upload, paste, link, idea) into the design: finding the tattoos in it,
    cutting them out, and the extra tattoos from the same picture. */
export function useDesignImport({
  design,
  setDesign,
  onExtras,
  applyDesign,
  keep,
  setBusy,
  setBusyMsg,
}: {
  design: Design | null;
  setDesign: (d: Design | null) => void;
  onExtras?: (ds: Design[]) => void;
  applyDesign: (raw: string, mode: Design['mode'], libId?: string) => Promise<void>;
  keep: (kind: 'photo' | 'design', p: Photo) => void;
  setBusy: (b: boolean) => void;
  setBusyMsg: (m: string) => void;
}) {
  const { ui, toast } = useApp();
  const t = L(ui.lang);
  const [linkOpen, setLinkOpen] = useState(false);
  const [link, setLink] = useState('');
  const [linkBusy, setLinkBusy] = useState(false);
  // a design from a link (Pinterest, Instagram, any image address)
  const fromLink = async (url: string) => {
    if (!/^https:\/\//i.test(url.trim())) return toast(t('Paste a link that starts with https://', 'Olyan linket illessz be, ami https://-sel kezdődik'));
    setLinkBusy(true);
    track('design_link');
    const r = await api<{ image?: string; error?: string }>('/api/fetch-image', { url: url.trim() });
    setLinkBusy(false);
    if (!r.ok || !r.data.image) return toast(trErr(ui.lang, r.data?.error));
    setLinkOpen(false);
    setLink('');
    const blob = await (await fetch(r.data.image)).blob();
    designFromFile(blob, 'link');
  };

  // the last uploaded picture and what the AI found in it, so "another tattoo from it" works
  const [pick, setPick] = useState<{ image: string; found: Found; open: boolean } | null>(null);

  // Cut just the tattoo out of a photo (someone's arm on Pinterest, a screenshot with background…)
  const extract = async (raw: string, mode: Design['mode']) => {
    setBusy(true);
    setBusyMsg(t('Cutting the tattoo out of the photo…', 'Kivágjuk a tetoválást a fotóból…'));
    track('extract_design');
    const r = await api<{ image: string; match?: number; error?: string }>('/api/extract', { image: raw, color: mode === 'color' });
    setBusyMsg('');
    if (!r.ok || !r.data.image) {
      setBusy(false);
      // never fall back to the raw photo: skin, clothes and background would end up on the body
      toast(r.data?.error ? trErr(ui.lang, r.data.error) : t('Could not cut the tattoo out. Frame it more tightly and try again.', 'Nem sikerült kivágni a tetoválást. Keretezd szorosabban, és próbáld újra.'));
      setPick((pk) => (pk ? { ...pk, open: true } : { image: raw, found: { kind: 'photo', tattoos: [] }, open: true }));
      return;
    }
    const d = await processDesign(r.data.image, mode, { clean: true });
    const match = typeof r.data.match === 'number' ? r.data.match : -1;
    setDesign({ raw: r.data.image, ink: d.dataUrl, ratio: d.ratio, detail: d.detail, mode, original: raw, match });
    setBusy(false);
    haptic('success');
    track('extract_done', { match });
    toast(
      match >= 0 && match < 7
        ? t('Cut out — check it against the original below', 'Kivágva – nézd meg lent, egyezik-e az eredetivel')
        : t('Tattoo cut out — only the design goes on your skin', 'Kivágva – csak maga a minta kerül a bőrödre')
    );
  };
  // one cut-out, without touching the screen state (used for the extra tattoos)
  const cutOne = async (raw: string, mode: Design['mode']): Promise<Design | null> => {
    const r = await api<{ image: string; match?: number; error?: string }>('/api/extract', { image: raw, color: mode === 'color' });
    if (!r.ok || !r.data.image) return null;
    const d = await processDesign(r.data.image, mode, { clean: true });
    return { raw: r.data.image, ink: d.dataUrl, ratio: d.ratio, detail: d.detail, mode, original: raw };
  };
  const usePick = async (boxes: Box[] | null) => {
    if (!pick) return;
    const { image, found } = pick;
    setPick({ ...pick, open: false });
    const mode = design?.mode || 'black';
    const list = boxes && boxes.length ? boxes : [null];
    const srcs = await Promise.all(list.map((b) => (b ? cropImage(image, b) : Promise.resolve(image))));
    track('tattoo_pick', { kind: found.kind, n: found.tattoos.length, picked: list.length });
    // the extra ones are cut out at the same time as the first
    const rest = srcs.slice(1);
    const extrasP = rest.length
      ? Promise.all(
          rest.map(async (src) => {
            if (found.kind === 'design') {
              const d = await processDesign(src, mode).catch(() => null);
              return d ? ({ raw: src, ink: d.dataUrl, ratio: d.ratio, detail: d.detail, mode } as Design) : null;
            }
            return cutOne(src, mode).catch(() => null);
          })
        )
      : null;
    if (found.kind === 'design') await applyDesign(srcs[0], mode);
    else await extract(srcs[0], mode);
    if (extrasP) {
      if (found.kind !== 'design') {
        setBusy(true);
        setBusyMsg(t(`Cutting out the other ${rest.length} tattoo${rest.length > 1 ? 's' : ''}…`, `A további ${rest.length} tetoválás kivágása…`));
      }
      const got = (await extrasP).filter(Boolean) as Design[];
      setBusy(false);
      setBusyMsg('');
      if (got.length) {
        onExtras?.(got);
        toast(t(`${got.length + 1} tattoos ready – you can place each of them on the next screen`, `${got.length + 1} tetoválás kész – a következő lépésben mindegyiket elhelyezheted`));
      }
      if (got.length < rest.length) toast(t('Some tattoos could not be cut out.', 'Néhány tetoválást nem sikerült kivágni.'));
    }
  };
  const designFromFile = async (f: File | Blob, src: string) => {
    let p: Photo;
    try {
      p = await withTimeout(prepareImage(f as File, 1024, 'image/jpeg'), 20000);
    } catch {
      return toast(t('That design could not be opened. Try another image.', 'Ezt a mintát nem sikerült megnyitni. Próbálj másik képet.'));
    }
    track('design_added', { src });
    keep('design', p);
    const mode = design?.mode || 'black';
    setBusy(true);
    setBusyMsg(t('Looking at your picture…', 'Megnézzük a képet…'));
    // What is it — a clean design or a photo? Where are the tattoos in it?
    const [r, probe] = await Promise.all([
      api<{ kind: Found['kind'] | null; tattoos: Found['tattoos'] }>('/api/find-tattoos', { image: p.dataUrl, lang: ui.lang }),
      processDesign(p.dataUrl, mode).catch(() => null),
    ]);
    setBusy(false);
    setBusyMsg('');
    const found: Found =
      r.ok && r.data.kind ? { kind: r.data.kind, tattoos: r.data.tattoos || [] } : { kind: probe?.photoLike ? 'photo' : 'design', tattoos: [] };
    track('design_kind', { kind: found.kind, n: found.tattoos.length });
    // a clean drawing with one motif: use it as it is (only when the pixels agree it is not a photo)
    if (found.kind === 'design' && probe?.photoLike) found.kind = 'photo';
    if (found.kind === 'design' && found.tattoos.length <= 1) return applyDesign(p.dataUrl, mode);
    // a photo with exactly one tattoo: cut that one out straight away
    if (found.kind === 'photo' && found.tattoos.length === 1) {
      setPick({ image: p.dataUrl, found, open: false });
      return extract(await cropImage(p.dataUrl, found.tattoos[0].box), mode);
    }
    // several designs, or none found in a photo: let the user choose / frame it
    setPick({ image: p.dataUrl, found, open: true });
  };
  const paste = async () => {
    try {
      const items = await (navigator.clipboard as any).read();
      for (const it of items) {
        const type = it.types.find((x: string) => x.startsWith('image/'));
        if (type) return designFromFile(await it.getType(type), 'paste');
      }
      const text = (await navigator.clipboard.readText().catch(() => '')).trim();
      if (/^https:\/\/\S+$/i.test(text)) return fromLink(text);
      toast(t('No image on your clipboard. Copy an image or a link first.', 'Nincs kép a vágólapon. Előbb másolj ki egy képet vagy egy linket.'));
    } catch {
      toast(t('Your browser blocked the clipboard. Use Upload instead.', 'A böngésző nem engedte a vágólapot. Használd a Feltöltést.'));
    }
  };

  // ctrl/cmd+V anywhere: an image becomes the design
  useEffect(() => {
    const h = (e: ClipboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.('input, textarea')) return;
      const f = Array.from(e.clipboardData?.files || []).find((x) => x.type.startsWith('image/'));
      if (f) return designFromFile(f, 'paste');
      const text = (e.clipboardData?.getData('text') || '').trim();
      if (/^https:\/\/\S+$/i.test(text)) fromLink(text);
    };
    window.addEventListener('paste', h);
    return () => window.removeEventListener('paste', h);
  }); // eslint-disable-line react-hooks/exhaustive-deps
  return { linkOpen, setLinkOpen, link, setLink, linkBusy, fromLink, pick, setPick, extract, usePick, designFromFile, paste };
}
