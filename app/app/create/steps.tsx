'use client';
import { qOf, type Lang } from '@/lib/tr';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../AppProvider';
import { Icon } from '../ui';
import { trErr, tx } from '@/lib/i18n';
import { api } from '@/lib/sb';
import { haptic, track } from '@/lib/store';
import { prepareImage } from '@/lib/client';
import { ALL_DESIGNS as DESIGNS } from '@/lib/designs';
import { cropImage, offSkin, processDesign, Placement, skinVeil } from '@/lib/editor';
import { Box, Found, TattooPicker } from './Picker';
import { frameCm, photoCm } from '@/lib/score';
import { BodyMap } from './BodyMap';
import { Sheet } from '../ui';

export type Photo = { dataUrl: string; w: number; h: number };
export type Layer = { design: Design; pl: Placement };

export type Design = {
  raw: string;
  ink: string;
  ratio: number;
  detail: number;
  mode: 'black' | 'color';
  libId?: string;
  /** the (cropped) photo, when the tattoo was cut out of it */
  original?: string;
  /** how faithful the cut-out is to the photo, 0-10 (-1 unknown) */
  match?: number;
};
/** The detected bare-skin area of the chosen body part: [top, left, bottom, right] as fractions of the photo. */
export type Area = { box: [number, number, number, number]; angle: number };
export type { Skin } from '@/lib/editor';
import type { Skin } from '@/lib/editor';
import { useScrollLock } from '@/lib/scrolllock';

/** Place and size the design so it sits inside the detected body area, aligned with the limb. */
export function fitToArea(area: Area, design: Design, photo: Photo): Placement {
  const [t, l, b, r] = area.box;
  const bw = r - l, bh = b - t;
  const aspect = photo.w / photo.h;
  const tilt = Math.abs(area.angle) > 12 ? area.angle : 0;
  // a tilted limb looks wider in its bounding box than it really is
  const k = tilt ? Math.cos((Math.abs(tilt) * Math.PI) / 180) * 0.8 : 1;
  const w = Math.max(0.06, Math.min(bw * 0.72 * k, (bh * 0.72) / (design.ratio * aspect), 0.7));
  return { x: (l + r) / 2, y: (t + b) / 2, w, rot: Math.round(tilt), mirror: false };
}

/** True when any corner of the placed design falls outside the detected area (with a little tolerance). */
export function overflows(area: Area, design: Design, photo: Photo, pl: Placement) {
  const [t, l, b, r] = area.box;
  const aspect = photo.w / photo.h;
  const hw = pl.w / 2, hh = (pl.w * design.ratio * aspect) / 2;
  const a = (pl.rot * Math.PI) / 180;
  const pad = 0.025;
  return [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].some(([dx, dy]) => {
    // rotate in pixel space, then back to fractions
    const px = dx * photo.w, py = dy * photo.h;
    const x = pl.x + (px * Math.cos(a) - py * Math.sin(a)) / photo.w;
    const y = pl.y + (px * Math.sin(a) + py * Math.cos(a)) / photo.h;
    return x < l - pad || x > r + pad || y < t - pad || y > b + pad;
  });
}

export { PLACEMENTS } from '@/lib/placements';
import { PLACEMENTS } from '@/lib/placements';

const L = (lang: Lang) => (en: string, hu: string) => tx(lang, en, hu);

/** Body-area chips. Always visible, so the area can be changed at any point. */
export function PlacementPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { ui } = useApp();
  const t = L(ui.lang);
  const ref = useRef<HTMLDivElement>(null);
  // bring the selected chip into view (e.g. "Neck" at the far right)
  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>('.chip.on');
    if (el && ref.current) ref.current.scrollLeft = el.offsetLeft - ref.current.clientWidth / 2 + el.clientWidth / 2;
  }, [value]);
  return (
    <div className="placepick">
      <span className="placepick-label">{t('Body area', 'Testrész')}</span>
      <div className="chips" ref={ref} role="radiogroup" aria-label={t('Body area', 'Testrész')}>
        {PLACEMENTS.map((p) => (
          <button
            key={p.v}
            role="radio"
            aria-checked={value === p.v}
            className={`chip ${value === p.v ? 'on' : ''}`}
            onClick={() => {
              onChange(p.v);
              haptic();
            }}
          >
            {t(p.en, p.hu)}
          </button>
        ))}
      </div>
    </div>
  );
}

// ================================================================ studio: photo + design on one screen

/** Never let a stuck image decode freeze the screen silently. */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('timeout')), ms);
    p.then((v) => (clearTimeout(t), res(v)), (e) => (clearTimeout(t), rej(e)));
  });
}

/** The last few photos the user added, to pick again with one tap. */
type Recent = { d: string; w: number; h: number };
function recentGet(): Recent[] {
  try {
    return JSON.parse(localStorage.getItem('ink_recent_photos') || '[]');
  } catch {
    return [];
  }
}
function recentAdd(p: Photo) {
  const list = [{ d: p.dataUrl, w: p.w, h: p.h }, ...recentGet().filter((r) => r.d.slice(-80) !== p.dataUrl.slice(-80))];
  for (let n = 5; n > 0; n--) {
    try {
      localStorage.setItem('ink_recent_photos', JSON.stringify(list.slice(0, n)));
      return;
    } catch {}
  }
}
const SKIN_TONES = ['#f6d7c3', '#e8b896', '#c98e62', '#8d5a3b', '#4f3020'];

type CheckState = { state: 'idle' | 'checking' | 'ok' | 'warn' | 'blocked'; msg?: string };

export function StudioStep({
  existingCm,
  setExistingCm,
  onArea,
  mode = 'new',
  setMode,
  placement,
  setPlacement,
  photo,
  setPhoto,
  design,
  setDesign,
  onExtras,
  onNext,
}: {
  mode?: 'new' | 'existing' | 'removal';
  setMode?: (m: 'new' | 'existing' | 'removal') => void;
  placement: string;
  setPlacement: (p: string) => void;
  photo: Photo | null;
  setPhoto: (p: Photo | null) => void;
  design: Design | null;
  setDesign: (d: Design | null) => void;
  /** more tattoos taken from the same picture: they go onto the photo next to the first one */
  onExtras?: (ds: Design[]) => void;
  onNext: () => void;
  onArea?: (a: Area | null, where: string, ph: Photo, skin?: Skin | null) => void;
  existingCm?: number | null;
  setExistingCm?: (n: number | null) => void;
}) {
  const { ui, toast } = useApp();
  const t = L(ui.lang);
  const photoRef = useRef<HTMLInputElement>(null);
  // a fresh file input after every pick: some phones stop reporting a new choice on a reused input
  const [inputKey, setInputKey] = useState(0);
  const designRef = useRef<HTMLInputElement>(null);
  const [cam, setCam] = useState(false);
  const [check, setCheck] = useState<CheckState>({ state: photo ? 'ok' : 'idle' });
  const [busy, setBusy] = useState(false);
  const [busyMsg, setBusyMsg] = useState('');
  const [over, setOver] = useState<'' | 'photo' | 'design'>('');
  const [prompt, setPrompt] = useState('');
  const [aiStyle, setAiStyle] = useState<'fine-line' | 'blackwork' | 'traditional'>('fine-line');
  const [drawing, setDrawing] = useState(false);
  const existing = mode === 'existing' || mode === 'removal';
  const removal = mode === 'removal';
  const [recent, setRecent] = useState<Recent[]>([]);
  useEffect(() => setRecent(recentGet()), [photo?.dataUrl]);
  const [modelOpen, setModelOpen] = useState(false);
  const [tone, setTone] = useState(3);
  const [modelBusy, setModelBusy] = useState(false);
  const [modelImg, setModelImg] = useState<{ src: string; id?: number | null; tone: number } | null>(null);
  const [modelStep, setModelStep] = useState(0);
  useEffect(() => {
    if (!modelBusy) return setModelStep(0);
    const id = setInterval(() => setModelStep((n) => Math.min(n + 1, 3)), 2600);
    return () => clearInterval(id);
  }, [modelBusy]);
  const [linkOpen, setLinkOpen] = useState(false);
  const [link, setLink] = useState('');
  const [linkBusy, setLinkBusy] = useState(false);
  const [libQ, setLibQ] = useState('');
  const [libStyle, setLibStyle] = useState<'' | 'fine-line' | 'blackwork' | 'traditional'>('');

  const usePhoto = (p: Photo) => {
    setPhoto(p);
    haptic();
    runCheck(p, placement);
  };
  // "I don't have a good photo": a stand-in photo of that body area in the chosen skin tone
  const modelPhoto = async (another = false) => {
    setModelBusy(true);
    track('model_photo', { tone, another });
    const r = await api<{ image?: string; id?: number | null; error?: string }>('/api/model-photo', {
      area: aiPlacement(placement),
      tone,
      // "another one": a fresh photo, never the same as the one on screen
      fresh: another,
      not: another ? modelImg?.id ?? null : null,
    });
    setModelBusy(false);
    if (!r.ok || !r.data.image) return toast(trErr(ui.lang, r.data?.error));
    haptic('success');
    setModelImg({ src: r.data.image, id: r.data.id, tone });
  };
  const useModel = async () => {
    if (!modelImg) return;
    const blob = await (await fetch(modelImg.src)).blob();
    const p = await prepareImage(new File([blob], 'model.jpg', { type: blob.type }), 1024);
    setModelOpen(false);
    setModelImg(null);
    usePhoto(p);
  };
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

  // AI drawings: two variants to choose from, then "like this, but…" changes
  const [variants, setVariants] = useState<string[]>([]);
  const [change, setChange] = useState('');
  const aiDesign = async () => {
    if (prompt.trim().length < 3) return;
    setDrawing(true);
    track('ai_design', { style: aiStyle });
    const r = await api<{ image: string; images?: string[]; error?: string }>('/api/design', { text: prompt, style: aiStyle });
    setDrawing(false);
    if (!r.ok || !r.data.image) return toast(trErr(ui.lang, r.data?.error));
    setVariants(r.data.images?.length ? r.data.images : [r.data.image]);
    await applyDesign(r.data.image, 'black');
  };
  const refine = async () => {
    if (!design || change.trim().length < 3) return;
    setDrawing(true);
    track('ai_design_change');
    const r = await api<{ image: string; error?: string }>('/api/design', { text: change, style: aiStyle, base: design.raw });
    setDrawing(false);
    if (!r.ok || !r.data.image) return toast(trErr(ui.lang, r.data?.error));
    setVariants((v) => [r.data.image, ...v].slice(0, 4));
    setChange('');
    await applyDesign(r.data.image, design.mode);
  };

  const runCheck = useCallback(
    async (p: Photo, where: string) => {
      setCheck({ state: 'checking' });
      const r = await api<{ ok: boolean; code: string; area: string; box?: Area['box'] | null; angle?: number | null; skin?: Skin | null }>('/api/check-photo', { photo: p.dataUrl, placement: aiPlacement(where) });
      if (!r.ok) return setCheck({ state: 'ok' }); // never block on a failed check
      onArea?.(r.data.box ? { box: r.data.box, angle: r.data.angle ?? 0 } : null, where, p, r.data.skin);
      const c = r.data.code;
      track('photo_check', { code: c });
      if (c === 'not_allowed') return setCheck({ state: 'blocked', msg: t('We can’t use this photo. Use a photo of an adult’s arm, leg, back or similar, with no nudity.', 'Ezt a fotót nem tudjuk használni. Felnőtt karjáról, lábáról, hátáról készült, nem meztelen fotót tölts fel.') });
      if (c === 'no_skin') return setCheck({ state: 'warn', msg: t('We can’t see much bare skin. A closer shot works best.', 'Kevés csupasz bőr látszik. Egy közelebbi fotó lesz a legjobb.') });
      if (c === 'blurry') return setCheck({ state: 'warn', msg: t('A bit blurry — a sharper photo gives a much more realistic result.', 'Kicsit homályos – élesebb fotóval sokkal valósághűbb lesz.') });
      if (c === 'dark') return setCheck({ state: 'warn', msg: t('Quite dark — try near a window in daylight.', 'Elég sötét – próbáld ablak mellett, nappali fényben.') });
      setCheck({ state: 'ok', msg: t('Photo looks good', 'Jó a fotó') });
    },
    [ui.lang] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const takePhoto = async (file: File | Blob) => {
    try {
      const p = await withTimeout(prepareImage(file as File, 1024), 20000);
      setPhoto(p);
      recentAdd(p);
      haptic();
      track('photo_added');
      runCheck(p, placement);
    } catch (e) {
      const f = file as File;
      track('photo_open_error', { type: f.type || '?', ext: (f.name || '').split('.').pop()?.slice(0, 8) || '', kb: Math.round((f.size || 0) / 1024), msg: String((e as Error)?.message || e).slice(0, 120) });
      toast(t('That file could not be opened. Try a JPG, PNG or HEIC photo.', 'Ezt a fájlt nem sikerült megnyitni. JPG, PNG vagy HEIC fotó legyen.'));
    }
  };

  const applyDesign = async (raw: string, mode: Design['mode'], libId?: string) => {
    setBusy(true);
    try {
      const d = await processDesign(raw, mode);
      setDesign({ raw, ink: d.dataUrl, ratio: d.ratio, detail: d.detail, mode, libId, original: design?.raw === raw ? design?.original : undefined });
      haptic();
    } catch {
      toast(t('That design could not be opened. Try another image.', 'Ezt a mintát nem sikerült megnyitni. Próbálj másik képet.'));
    }
    setBusy(false);
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

  const drop = (kind: 'photo' | 'design') => ({
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      setOver(kind);
    },
    onDragLeave: () => setOver(''),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setOver('');
      const f = e.dataTransfer.files?.[0];
      if (!f) return;
      if (kind === 'photo') takePhoto(f);
      else designFromFile(f, 'upload');
    },
  });

  const ready = !!photo && (existing || !!design) && !busy && check.state !== 'blocked' && check.state !== 'checking';
  const cta = !photo
    ? existing ? t('Add a photo of your tattoo', 'Add hozzá a tetoválásod fotóját') : t('Add your photo', 'Add hozzá a fotódat')
    : !existing && !design
      ? t('Pick a design', 'Válassz mintát')
      : check.state === 'checking'
        ? ui.t('create.photo.checking')
        : removal
          ? t('Show the laser sessions', 'Mutasd a lézeres kezeléseket')
          : existing
          ? t('Show me how it ages', 'Mutasd, hogyan öregszik')
          : t('Continue — place it', 'Tovább – elhelyezés');

  return (
    <div className="studio-grid">
      <div className="col-a">
      {setMode && (
        <div className="seg modeseg" role="radiogroup" aria-label={t('What do you want to see?', 'Mit szeretnél látni?')}>
          <button role="radio" aria-checked={!existing} className={!existing ? 'on' : ''} onClick={() => setMode('new')}>
            {t('New tattoo', 'Új tetoválás')}
          </button>
          <button role="radio" aria-checked={existing && !removal} className={existing && !removal ? 'on' : ''} onClick={() => setMode('existing')}>
            {t('Existing', 'Meglévő')}
          </button>
          <button role="radio" aria-checked={removal} className={removal ? 'on' : ''} onClick={() => setMode('removal')}>
            {t('Removal', 'Eltávolítás')}
          </button>
        </div>
      )}
      {removal && (
        <div className="rm-note">
          <b>{t('Laser removal preview', 'Lézeres eltávolítás előnézete')}</b>
          <p>{t('Add a photo of the tattoo you are thinking of removing. We show it after 3, 6 and 10 laser sessions — an estimate to talk through with a dermatologist or clinic, not a medical opinion.', 'Töltsd fel annak a tetoválásnak a fotóját, amit eltávolítanál. Megmutatjuk 3, 6 és 10 lézeres kezelés után – becslés, amit bőrgyógyásszal vagy klinikával érdemes átbeszélni, nem orvosi vélemény.')}</p>
        </div>
      )}
      <section className="studio-sec">
        <h2 className="sec-title">{existing ? t('Where is it?', 'Hol van?') : t('Where will it go?', 'Hová kerül?')}</h2>
        <BodyMap value={placement} onChange={setPlacement} />
      </section>
      </div>
      <div className="col-b">

      <h2 className="sec-title">{existing ? t('Photo of your tattoo', 'Fotó a tetoválásodról') : t('Your photo and the design', 'A fotód és a minta')}</h2>
      <div className={`studio-slots ${existing ? 'one' : ''}`}>
        <div className="studio-col">
          <label htmlFor="photo-input" role="button" tabIndex={0} className={`sslot ${photo ? 'has' : ''} ${over === 'photo' ? 'over' : ''}`} onClick={() => track('photo_pick_open')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); (e.currentTarget as HTMLElement).click(); } }} aria-label={t('Choose your photo', 'Fotó kiválasztása')} {...drop('photo')}>
            {photo ? <img src={photo.dataUrl} alt={t('Your photo', 'A fotód')} /> : (
              <span className="sslot-empty">
                {Icon.camera}
                <b>{existing ? t('Your tattoo', 'A tetoválásod') : t('Your photo', 'A fotód')}</b>
                <small>{existing ? t('a clear photo of it, in daylight', 'éles fotó róla, nappali fényben') : t('the body area, in daylight', 'a testrész, nappali fényben')}</small>
              </span>
            )}
            <span className="sslot-tag">1</span>
          </label>
          {photo && (
            <button type="button" className="sslot-clear" onClick={() => { setPhoto(null); setCheck({ state: 'idle' }); }} aria-label={t('Remove photo', 'Fotó eltávolítása')}>
              ×
            </button>
          )}
          <div className="sslot-btns">
            <button className="chipbtn" onClick={() => setCam(true)}>
              {Icon.camera} {t('Camera', 'Kamera')}
            </button>
            <label htmlFor="photo-input" role="button" tabIndex={0} className="chipbtn" onClick={() => track('photo_pick_open')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); (e.currentTarget as HTMLElement).click(); } }}>
              {Icon.image} {t('Photos', 'Galéria')}
            </label>
          </div>
          {!existing && (
            <button className="linkbtn" onClick={() => setModelOpen(true)}>
              {t('No good photo? Use a model', 'Nincs jó fotód? Használj modellt')}
            </button>
          )}
        </div>

        {!existing && (
        <div className="studio-col">
          <label htmlFor="design-input" role="button" tabIndex={0} className={`sslot design ${design ? 'has' : ''} ${over === 'design' ? 'over' : ''}`} onClick={() => track('design_pick_open')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); (e.currentTarget as HTMLElement).click(); } }} aria-label={t('Choose a design', 'Minta kiválasztása')} {...drop('design')}>
            {design ? <img src={design.ink} alt={t('Your design', 'A mintád')} /> : (
              <span className="sslot-empty">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5M4 20h16" /></svg>
                <b>{t('The design', 'A minta')}</b>
                <small>{t('Screenshot, saved image, sketch', 'Képernyőfotó, mentett kép, rajz')}</small>
              </span>
            )}
            {busy && (
              <span className="sslot-busy">
                <i className="needle" />
                {busyMsg && <small>{busyMsg}</small>}
              </span>
            )}
            <span className="sslot-tag">2</span>
          </label>
          <div className="sslot-btns">
            <label htmlFor="design-input" role="button" tabIndex={0} className="chipbtn" onClick={() => track('design_pick_open')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); (e.currentTarget as HTMLElement).click(); } }}>
              {Icon.image} {t('Upload', 'Feltöltés')}
            </label>
            <button className="chipbtn" onClick={paste}>
              {Icon.clip} {t('Paste', 'Beilleszt')}
            </button>
          </div>
          <button className="linkbtn" onClick={() => setLinkOpen(true)}>
            {t('From a link (Pinterest, Instagram…)', 'Linkről (Pinterest, Instagram…)')}
          </button>
        </div>
        )}
      </div>

      {recent.length > 0 && (
        <div className="recents" aria-label={t('Recent photos', 'Legutóbbi fotóid')}>
          <span>{t('Recent', 'Legutóbbi')}</span>
          {recent.map((r, i) => (
            <button key={i} className={photo?.dataUrl.slice(-80) === r.d.slice(-80) ? 'on' : ''} onClick={() => usePhoto({ dataUrl: r.d, w: r.w, h: r.h })} aria-label={t(`Recent photo ${i + 1}`, `${i + 1}. legutóbbi fotó`)}>
              <img src={r.d} alt="" />
            </button>
          ))}
        </div>
      )}

      {photo && check.state !== 'idle' && (
        <p className={`check-line ${check.state}`} role="status">
          {check.state === 'checking' ? <i className="needle" /> : check.state === 'ok' ? '✓' : '!'}
          <span>{check.state === 'checking' ? ui.t('create.photo.checking') : check.msg || t('Photo looks good', 'Jó a fotó')}</span>
        </p>
      )}

      <p className="fine ai-note">
        {t('Your photo and design are sent to our AI providers (Google Gemini, OpenAI as backup) only to check the photo and make your preview. ', 'A fotódat és a mintádat csak az ellenőrzéshez és az előnézethez küldjük el az MI-szolgáltatóinknak (Google Gemini, tartalékként OpenAI). ')}
        {t('Only upload photos of yourself, or of someone who agreed to it. ', 'Csak saját magadról készült fotót tölts fel, vagy olyanról, aki ebbe beleegyezett. ')}
        <a href={`/privacy${qOf(ui.lang)}`}>{t('Privacy', 'Adatvédelem')}</a>
      </p>

      <input key={`p${inputKey}`} ref={photoRef} id="photo-input" className="file-hidden" type="file" accept="image/*,.heic,.heif" tabIndex={-1} aria-hidden="true" onChange={(e) => { const f = e.target.files?.[0]; setInputKey((k) => k + 1); if (f) takePhoto(f); }} />
      <input key={`d${inputKey}`} ref={designRef} id="design-input" className="file-hidden" type="file" accept="image/*,.heic,.heif" tabIndex={-1} aria-hidden="true" onChange={(e) => { const f = e.target.files?.[0]; setInputKey((k) => k + 1); if (f) designFromFile(f, 'upload'); }} />

      {!existing && design?.original && (
        <div className={`cmpcut ${design.match !== undefined && design.match >= 0 && design.match < 7 ? 'warn' : ''}`}>
          <figure>
            <img src={design.original} alt="" />
            <figcaption>{t('Your picture', 'A képed')}</figcaption>
          </figure>
          <span className="cmp-arrow" aria-hidden="true">→</span>
          <figure className="cut">
            <img src={design.ink} alt="" />
            <figcaption>{t('Cut out', 'Kivágva')}</figcaption>
          </figure>
          <div className="cmpcut-txt">
            <b>
              {design.match !== undefined && design.match >= 0 && design.match < 7
                ? t('Check it — it may differ', 'Nézd meg – eltérhet')
                : t('Only the tattoo, nothing else', 'Csak a tetoválás, semmi más')}
            </b>
            <div className="row" style={{ gap: 4 }}>
              <button className="link" disabled={busy} onClick={() => extract(design.original!, design.mode)}>
                {t('Cut again', 'Újra')}
              </button>
              {pick && (
                <button className="link" disabled={busy} onClick={() => setPick({ ...pick, open: true })}>
                  {t('Other tattoo', 'Másik tetoválás')}
                </button>
              )}
              <button className="link" disabled={busy} onClick={() => applyDesign(design.original!, design.mode)}>
                {t('Use as is', 'Eredeti kép')}
              </button>
            </div>
          </div>
        </div>
      )}
      {!existing && design && !design.libId && !design.original && (
        <button className="cutbtn" onClick={() => (pick ? setPick({ ...pick, open: true }) : extract(design.raw, design.mode))} disabled={busy}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M20 4L8.1 15.9M14.5 14.5L20 20M8.1 8.1L12 12" /></svg>
          <span>
            {t('Cut out only the tattoo', 'Csak a tetoválást vágd ki')}
            <small>{t('If your picture shows a person or background', 'Ha a képen ember vagy háttér is van')}</small>
          </span>
        </button>
      )}
      {pick && (
        <TattooPicker
          key={pick.image.slice(-48)}
          open={pick.open}
          image={pick.image}
          found={pick.found}
          onPick={(bs) => usePick(bs)}
          onWhole={() => usePick(null)}
          onClose={() => setPick({ ...pick, open: false })}
        />
      )}
      {!existing && design && (
        <div className="inkrow">
          <b>{ui.t('create.place.ink')}</b>
          <div className="seg" role="radiogroup">
            {(['black', 'color'] as const).map((m) => (
              <button key={m} role="radio" aria-checked={design.mode === m} className={design.mode === m ? 'on' : ''} onClick={() => applyDesign(design.raw, m, design.libId)}>
                {m === 'black' ? ui.t('create.place.black') : ui.t('create.place.color')}
              </button>
            ))}
          </div>
        </div>
      )}

      {existing ? (
        <div className="card" style={{ marginTop: 16 }}>
          <h3>{removal ? t('How big is the tattoo?', 'Mekkora a tetoválás?') : t('See your tattoo in 10, 30 and 50 years', 'Nézd meg a tetoválásod 10, 30 és 50 év múlva')}</h3>
          <p className="muted small">{removal ? t('Optional — it helps us estimate how the ink responds. Black usually fades fastest under the laser.', 'Nem kötelező – segít megbecsülni, hogyan reagál a tinta. A fekete általában a leggyorsabban halványul a lézer alatt.') : t('Upload a clear photo of a tattoo you already have. You can also preview laser removal afterwards.', 'Tölts fel éles fotót egy meglévő tetoválásodról. Utána a lézeres eltávolítást is megnézheted.')}</p>
          {setExistingCm && (
            <>
              <b style={{ display: 'block', fontSize: 14, margin: '10px 0 6px' }}>{t('Roughly how big is it? (makes the score more accurate)', 'Kb. mekkora? (pontosabb lesz a pontszám)')}</b>
              <div className="cmrow">
                {[3, 5, 8, 12, 20].map((c) => (
                  <button key={c} className={`chip ${existingCm === c ? 'on' : ''}`} onClick={() => setExistingCm(existingCm === c ? null : c)}>
                    {c === 20 ? '20+ cm' : `${c} cm`}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      ) : (
        <>
      <div className="section-title" style={{ marginTop: 18 }}>
        <h2 style={{ fontSize: 20 }}>{t('No design? Try one of ours', 'Nincs mintád? Próbáld ki a mieinket')}</h2>
      </div>
      <div className="libtools">
        <input type="search" id="lib-search" placeholder={t('Search: rose, moon, wave…', 'Keresés: rózsa, hold, hullám…')} value={libQ} onChange={(e) => setLibQ(e.target.value)} />
        <div className="row" style={{ gap: 6 }}>
          {(['', 'fine-line', 'blackwork', 'traditional'] as const).map((st) => (
            <button key={st || 'all'} className={`chip ${libStyle === st ? 'on' : ''}`} onClick={() => setLibStyle(st)}>
              {st === '' ? t('All', 'Mind') : st === 'fine-line' ? t('Fine line', 'Finom vonalas') : st === 'blackwork' ? 'Blackwork' : t('Classic', 'Klasszikus')}
            </button>
          ))}
        </div>
      </div>
      <div className="hscroll">
        {DESIGNS.filter((d) => (!libStyle || d.style === libStyle) && (!libQ.trim() || `${d.en} ${d.hu}`.toLowerCase().includes(libQ.trim().toLowerCase()))).map((d) => (
          <button
            key={d.id}
            className={`ex-design small ${design?.libId === d.id ? 'on' : ''}`}
            aria-label={t(d.en, d.hu)}
            onClick={() => {
              track('design_added', { src: 'library', id: d.id });
              applyDesign(d.src, 'black', d.id);
            }}
          >
            <img src={d.thumb || d.src} alt="" loading="lazy" onError={(e) => { const i = e.currentTarget; if (i.src !== d.src) i.src = d.src; }} />
          </button>
        ))}
      </div>
          <div className="card aimaker">
            <h3>{t('Describe it — we’ll draw it', 'Írd le – megrajzoljuk')}</h3>
            <textarea
              className="notes"
              id="ai-design"
              rows={2}
              maxLength={200}
              placeholder={t('e.g. a small swallow carrying an olive branch', 'pl. egy kis fecske olajággal a csőrében')}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
            <div className="row" style={{ marginTop: 8, alignItems: 'center', justifyContent: 'space-between' }}>
              <div className="seg" role="radiogroup">
                {(['fine-line', 'blackwork', 'traditional'] as const).map((st) => (
                  <button key={st} role="radio" aria-checked={aiStyle === st} className={aiStyle === st ? 'on' : ''} onClick={() => setAiStyle(st)}>
                    {st === 'fine-line' ? t('Fine', 'Finom') : st === 'blackwork' ? 'Blackwork' : t('Classic', 'Klasszikus')}
                  </button>
                ))}
              </div>
              <button className="btn" style={{ padding: '12px 18px' }} disabled={drawing || prompt.trim().length < 3} onClick={aiDesign}>
                {drawing ? t('Drawing…', 'Rajzolás…') : t('Draw it', 'Rajzold meg')}
              </button>
            </div>
            {variants.length > 0 && (
              <>
                <div className="variants" role="radiogroup" aria-label={t('Versions', 'Változatok')}>
                  {variants.map((v, i) => (
                    <button key={i} role="radio" aria-checked={design?.raw === v} className={design?.raw === v ? 'on' : ''} onClick={() => applyDesign(v, design?.mode || 'black')}>
                      <img src={v} alt={t(`Version ${i + 1}`, `${i + 1}. változat`)} />
                    </button>
                  ))}
                </div>
                {design && variants.includes(design.raw) && (
                  <div className="row" style={{ marginTop: 8, gap: 8, flexWrap: 'nowrap' }}>
                    <input
                      className="text"
                      id="ai-change"
                      style={{ flex: 1, minWidth: 0 }}
                      maxLength={160}
                      placeholder={t('Like this, but… e.g. thinner lines, add a small star', 'Ilyet, de… pl. vékonyabb vonalak, egy kis csillaggal')}
                      value={change}
                      onChange={(e) => setChange(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && refine()}
                    />
                    <button className="btn ghost" style={{ padding: '0 16px', minHeight: 46 }} disabled={drawing || change.trim().length < 3} onClick={refine}>
                      {t('Change', 'Módosít')}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}
      <p className="fine">{t('Only use designs you have the right to use — respect artists’ work.', 'Csak olyan mintát használj, amihez jogod van – tiszteld a tetoválóművészek munkáját.')}</p>

      <div className="stickycta">
        <button className="btn wide dark" disabled={!ready} onClick={onNext}>
          {check.state === 'warn' && ready ? t('Use this photo anyway', 'Mehet így is') : cta}
        </button>
      </div>

      </div>
      <Sheet open={modelOpen} onClose={() => !modelBusy && setModelOpen(false)} label={t('Model photo', 'Modellfotó')}>
        <h2>{t('Try it on a model', 'Próbáld ki egy modellen')}</h2>
        <p className="sub">{t(`A realistic photo of a ${placeName(placement, 'en').toLowerCase()} in the skin tone you pick.`, `Élethű fotó (${placeName(placement, 'hu').toLowerCase()}) a választott bőrtónussal.`)}</p>
        <div className={`model-stage ${modelBusy ? 'busy' : ''} ${modelImg ? 'has' : ''}`} style={{ ['--tone' as any]: SKIN_TONES[(modelImg && !modelBusy ? modelImg.tone : tone) - 1] }}>
          {modelImg && !modelBusy ? (
            <img key={modelImg.src.slice(-40)} src={modelImg.src} alt={t('Model photo', 'Modellfotó')} />
          ) : (
            <div className="model-ph" aria-live="polite">
              <span className="model-glow" />
              <span className="model-silhouette" aria-hidden="true">
                <svg viewBox="0 0 60 120"><path d="M22 6c-3 18-6 40-6 62 0 20 3 36 6 46h16c3-10 6-26 6-46 0-22-3-44-6-62z" /></svg>
              </span>
              <b>
                {modelBusy
                  ? [t('Setting up the light…', 'Fény beállítása…'), t('Matching your skin tone…', 'Bőrtónus illesztése…'), t('Adding skin texture…', 'Bőrtextúra hozzáadása…'), t('Almost there…', 'Mindjárt kész…')][modelStep]
                  : t('Pick a skin tone', 'Válassz bőrtónust')}
              </b>
              {modelBusy && <i className="model-bar"><i style={{ width: `${25 + modelStep * 22}%` }} /></i>}
            </div>
          )}
        </div>
        <div className="tones" role="radiogroup" aria-label={t('Skin tone', 'Bőrtónus')}>
          {SKIN_TONES.map((c, i) => (
            <button key={c} role="radio" aria-checked={tone === i + 1} className={tone === i + 1 ? 'on' : ''} style={{ background: c }} disabled={modelBusy} onClick={() => setTone(i + 1)} aria-label={t(`Skin tone ${i + 1}`, `${i + 1}. bőrtónus`)} />
          ))}
        </div>
        {modelImg && !modelBusy && modelImg.tone === tone ? (
          <>
            <button className="btn wide" onClick={useModel}>
              {t('Use this photo', 'Ezt a fotót használom')}
            </button>
            <button className="btn wide ghost" style={{ marginTop: 8 }} onClick={() => modelPhoto(true)}>
              {t('Another model', 'Másik modellt kérek')}
            </button>
          </>
        ) : (
          <button className="btn wide" onClick={() => modelPhoto(false)} disabled={modelBusy}>
            {modelBusy ? t('Making the photo…', 'Fotó készül…') : t('Show me the model', 'Mutasd a modellt')}
          </button>
        )}
      </Sheet>
      <Sheet open={linkOpen} onClose={() => setLinkOpen(false)} label={t('Design from a link', 'Minta linkről')}>
        <h2>{t('Design from a link', 'Minta linkről')}</h2>
        <p className="sub">{t('Paste a Pinterest, Instagram or image link. Only the tattoo will be used.', 'Illessz be Pinterest-, Instagram- vagy képlinket. Csak a tetoválást használjuk fel belőle.')}</p>
        <input id="design-link" type="url" inputMode="url" placeholder="https://…" value={link} onChange={(e) => setLink(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && fromLink(link)} />
        <button className="btn wide" onClick={() => fromLink(link)} disabled={linkBusy || !link.trim()}>
          {linkBusy ? t('Loading…', 'Betöltés…') : t('Load the picture', 'Kép betöltése')}
        </button>
      </Sheet>
      {cam && (
        <CameraSheet
          placement={placement}
          onClose={() => setCam(false)}
          onShot={(b) => {
            setCam(false);
            takePhoto(b);
          }}
          onFallback={() => {
            setCam(false);
            photoRef.current?.click();
          }}
        />
      )}
    </div>
  );
}

function CameraSheet({ placement, onClose, onShot, onFallback }: { placement: string; onClose: () => void; onShot: (b: Blob) => void; onFallback: () => void }) {
  const { ui } = useApp();
  const t = L(ui.lang);
  const vid = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<'environment' | 'user'>('environment');
  useScrollLock(true);

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        stream.current?.getTracks().forEach((x) => x.stop());
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1920 } }, audio: false });
        if (dead) return s.getTracks().forEach((x) => x.stop());
        stream.current = s;
        if (vid.current) {
          vid.current.srcObject = s;
          await vid.current.play().catch(() => {});
        }
      } catch {
        onFallback();
      }
    })();
    return () => {
      dead = true;
      // always release the camera, otherwise phones refuse it after a few uses
      stream.current?.getTracks().forEach((x) => x.stop());
      stream.current = null;
      if (vid.current) vid.current.srcObject = null;
    };
  }, [facing]); // eslint-disable-line react-hooks/exhaustive-deps

  // live advice while framing: too dark, too bright, hold still
  const [advice, setAdvice] = useState('');
  useEffect(() => {
    const c = document.createElement('canvas');
    c.width = 32;
    c.height = 32;
    const ctx = c.getContext('2d', { willReadFrequently: true } as any) as CanvasRenderingContext2D;
    let prev: Uint8ClampedArray | null = null;
    const i = setInterval(() => {
      const v = vid.current;
      if (!v || !v.videoWidth) return;
      ctx.drawImage(v, 0, 0, 32, 32);
      const d = ctx.getImageData(0, 0, 32, 32).data;
      let lum = 0, move = 0;
      for (let k = 0; k < d.length; k += 4) {
        const l = 0.299 * d[k] + 0.587 * d[k + 1] + 0.114 * d[k + 2];
        lum += l;
        if (prev) move += Math.abs(l - (0.299 * prev[k] + 0.587 * prev[k + 1] + 0.114 * prev[k + 2]));
      }
      lum /= 1024;
      move /= 1024;
      prev = d.slice();
      setAdvice(
        lum < 55 ? t('Too dark — move closer to a window', 'Túl sötét – menj közelebb az ablakhoz') : lum > 225 ? t('Too bright — avoid direct light', 'Túl világos – kerüld a közvetlen fényt') : move > 18 ? t('Hold still', 'Tartsd stabilan') : ''
      );
    }, 600);
    return () => clearInterval(i);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const shoot = () => {
    const v = vid.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement('canvas');
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext('2d')!.drawImage(v, 0, 0);
    haptic('success');
    c.toBlob((b) => b && onShot(b), 'image/jpeg', 0.92);
  };

  const limb = /back|hát|rib|borda/i.test(placement)
    ? 'M30 10h40l6 80H24z'
    : /hand|kéz|finger|ujj|wrist|csukló/i.test(placement)
      ? 'M38 95V55l-8-30c-1-5 6-7 8-2l6 20V12c0-5 7-5 7 0v28l2-32c0-5 7-5 7 0v34l3-26c1-5 7-4 7 1l-2 40 6-12c3-4 9-1 7 3l-12 30v17z'
      : 'M36 2c-4 30-6 60-4 96h36c2-36 0-66-4-96z';

  return (
    <div className="camera" role="dialog" aria-modal="true" aria-label={ui.t('create.photo.camera')}>
      <video ref={vid} playsInline muted />
      <div className="outline" aria-hidden="true">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none">
          <path d={limb} vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      <p className={`cam-hint ${advice ? 'warn' : ''}`} role="status">{advice || t('Fit the area inside the outline, in daylight', 'Igazítsd a testrészt a körvonalba, nappali fényben')}</p>
      <button className="iconbtn dark cam-x" aria-label={ui.t('common.close')} onClick={onClose}>
        {Icon.close}
      </button>
      <div className="cam-bar">
        <span style={{ width: 44 }} />
        <button className="shutter" aria-label={t('Take photo', 'Fotó')} onClick={shoot} />
        <button className="iconbtn dark" aria-label={t('Switch camera', 'Kameraváltás')} onClick={() => setFacing(facing === 'user' ? 'environment' : 'user')}>
          {Icon.rotate}
        </button>
      </div>
    </div>
  );
}

// ================================================================ place

export function PlaceStep({
  photo,
  design: design0,
  placement,
  pl: pl0,
  setPl: setPl0,
  extras = [],
  setExtras,
  onGo,
  canGo,
  footer,
  setPlacement,
  area,
  onFit,
  skin,
}: {
  photo: Photo;
  design: Design;
  placement: string;
  setPlacement: (p: string) => void;
  area?: Area | null;
  skin?: Skin | null;
  onFit?: () => void;
  pl: Placement;
  setPl: (p: Placement) => void;
  /** more tattoos on the same photo (above, below, next to the first) */
  extras?: Layer[];
  setExtras?: (l: Layer[]) => void;
  onGo: () => void;
  canGo: boolean;
  footer?: React.ReactNode;
}) {
  const { ui, toast } = useApp();
  const t = L(ui.lang);
  const box = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  // zoom into the photo (pinch, double-tap or the +/− buttons) to place the tattoo precisely
  const [zoom, setZoom] = useState({ z: 1, tx: 0, ty: 0 });
  const clampZoom = (z: number, tx: number, ty: number) => {
    const r = box.current?.getBoundingClientRect();
    const W = r?.width || 1, H = r?.height || 1;
    z = Math.min(4, Math.max(1, z));
    return { z, tx: Math.min(0, Math.max(W * (1 - z), tx)), ty: Math.min(0, Math.max(H * (1 - z), ty)) };
  };
  const zoomAt = (z: number, px?: number, py?: number) => {
    const r = box.current?.getBoundingClientRect();
    if (!r) return;
    setZoom((o) => {
      // buttons: bring the tattoo being placed to the middle; double-tap: zoom where the finger is
      if (px === undefined || py === undefined) {
        const nz = Math.min(4, Math.max(1, z));
        return clampZoom(nz, r.width / 2 - plRef.current.x * r.width * nz, r.height / 2 - plRef.current.y * r.height * nz);
      }
      const cx = px, cy = py;
      const k = Math.min(4, Math.max(1, z)) / o.z;
      return clampZoom(o.z * k, cx - (cx - o.tx) * k, cy - (cy - o.ty) * k);
    });
  };
  const bgPts = useRef(new Map<number, { x: number; y: number }>());
  const bgStart = useRef<{ z: number; tx: number; ty: number; d: number; mx: number; my: number; moved: boolean } | null>(null);
  const bgSnap = () => {
    const pts = Array.from(bgPts.current.values());
    const r = box.current!.getBoundingClientRect();
    const mx = pts.reduce((a, p) => a + p.x, 0) / pts.length - r.left, my = pts.reduce((a, p) => a + p.y, 0) / pts.length - r.top;
    const d = pts.length > 1 ? Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y) : 0;
    bgStart.current = { ...zoom, d, mx, my, moved: false };
  };
  const bgDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('.ink, .ink-frame, .zoombar')) return;
    // while a tattoo is selected, a second finger anywhere resizes / turns the tattoo – the photo never zooms by itself
    if (sel && pointers.current.size > 0) return down(activeRef.current)(e);
    bgPts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    // one finger scrolls the page when not zoomed; two fingers, or a zoomed photo, are ours
    if (bgPts.current.size > 1 || zoom.z > 1) {
      try {
        (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
      } catch {}
    }
    bgSnap();
  };
  const bgMove = (e: React.PointerEvent) => {
    if (pointers.current.has(e.pointerId)) return move(e);
    if (!bgPts.current.has(e.pointerId) || !bgStart.current || !box.current) return;
    bgPts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = Array.from(bgPts.current.values());
    const r = box.current.getBoundingClientRect();
    const mx = pts.reduce((a, p) => a + p.x, 0) / pts.length - r.left, my = pts.reduce((a, p) => a + p.y, 0) / pts.length - r.top;
    const s0 = bgStart.current;
    if (Math.hypot(mx - s0.mx, my - s0.my) > 6) s0.moved = true;
    if (pts.length > 1 && s0.d && !sel) {
      const k = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y) / s0.d;
      const z = Math.min(4, Math.max(1, s0.z * k));
      const kk = z / s0.z;
      setZoom(clampZoom(z, mx - (s0.mx - s0.tx) * kk, my - (s0.my - s0.ty) * kk));
      s0.moved = true;
    } else if (s0.z > 1) setZoom(clampZoom(s0.z, s0.tx + (mx - s0.mx), s0.ty + (my - s0.my)));
  };
  const bgUp = (e: React.PointerEvent) => {
    if (pointers.current.has(e.pointerId)) return up(e);
    const s0 = bgStart.current;
    bgPts.current.delete(e.pointerId);
    if (bgPts.current.size) return bgSnap();
    bgStart.current = null;
    // a tap on the photo deselects; zooming is only ever done by the user (pinch with nothing selected, or +/−)
    if (s0 && !s0.moved) setSel(false);
  };
  // which tattoo is being edited (0 = the first one) and whether its frame + handles show
  const [active, setActive] = useState(0);
  const [sel, setSel] = useState(false);
  const layers: Layer[] = [{ design: design0, pl: pl0 }, ...extras];
  const cur = Math.min(active, layers.length - 1);
  const design = layers[cur].design;
  const pl = layers[cur].pl;
  const setLayerPl = (i: number, p: Placement) => {
    if (i === 0) setPl0(p);
    else setExtras?.(extras.map((l, k) => (k === i - 1 ? { ...l, pl: p } : l)));
  };
  const activeRef = useRef(0);
  activeRef.current = cur;
  const plRef = useRef(pl);
  plRef.current = pl;
  const setPl = (p: Placement) => setLayerPl(activeRef.current, p);
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
  const removeLayer = (i: number) => {
    if (i === 0) return;
    setExtras?.(extras.filter((_, k) => k !== i - 1));
    setActive(0);
    setSel(false);
  };
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const start = useRef<{ pl: Placement; d: number; a: number; cx: number; cy: number } | null>(null);
  const [drag, setDrag] = useState(false);
  // the longer side of the design, in cm
  const fcm = photoCm(placement, area, photo);
  const cm = pl.w * Math.max(1, design.ratio) * fcm;
  const thin = design.detail > 0.55 && cm < 7;
  const [mapOpen, setMapOpen] = useState(false);
  const out = !!area && overflows(area, design, photo, pl);
  const idx = PLACEMENTS.findIndex((p) => p.v === placement);
  // how much of the ink would land on clothes or background (from the skin outline the AI found)
  const [off, setOff] = useState(0);
  useEffect(() => {
    if (!skin?.length) return setOff(0);
    let dead = false;
    const tm = setTimeout(() => offSkin(photo, design.ink, pl, skin).then((v) => !dead && setOff(v)), drag ? 250 : 60);
    return () => {
      dead = true;
      clearTimeout(tm);
    };
  }, [skin, pl.x, pl.y, pl.w, pl.rot, pl.mirror, design.ink, drag]); // eslint-disable-line react-hooks/exhaustive-deps
  const veil = useMemo(() => (skin?.length ? skinVeil(skin, photo.w, photo.h) : null), [skin, photo.w, photo.h]);
  // undo: remember where it was before each gesture
  const hist = useRef<Placement[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const remember = () => {
    const last = hist.current[hist.current.length - 1];
    if (!last || last.x !== pl.x || last.y !== pl.y || last.w !== pl.w || last.rot !== pl.rot || last.mirror !== pl.mirror) hist.current = [...hist.current.slice(-19), pl];
    setCanUndo(true);
  };
  const undo = () => {
    const prev = hist.current.pop();
    if (prev) setPl(prev);
    setCanUndo(hist.current.length > 0);
    haptic();
  };
  const setCm = (target: number) => {
    remember();
    setPl({ ...pl, w: Math.min(1.4, Math.max(0.04, target / (Math.max(1, design.ratio) * fcm))) });
    haptic();
  };

  const snapshot = (base: Placement = pl) => {
    const pts = Array.from(pointers.current.values());
    const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    const d = pts.length > 1 ? Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y) : 0;
    const a = pts.length > 1 ? Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x) : 0;
    start.current = { pl: base, d, a, cx, cy };
  };

  const down = (i: number) => (e: React.PointerEvent) => {
    e.stopPropagation();
    if (i !== activeRef.current) {
      activeRef.current = i;
      setActive(i);
      pointers.current.clear();
    }
    setSel(true);
    if (!pointers.current.size) remember();
    try {
      (e.target as Element).setPointerCapture?.(e.pointerId);
    } catch {}
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    snapshot(layers[i].pl);
    setDrag(true);
  };
  const move = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId) || !start.current || !stage.current) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const r = stage.current.getBoundingClientRect();
    const pts = Array.from(pointers.current.values());
    const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    const s0 = start.current;
    const next: Placement = {
      ...s0.pl,
      x: Math.min(1.1, Math.max(-0.1, s0.pl.x + (cx - s0.cx) / r.width)),
      y: Math.min(1.1, Math.max(-0.1, s0.pl.y + (cy - s0.cy) / r.height)),
    };
    if (pts.length > 1 && s0.d) {
      const d = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      const a = Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x);
      next.w = Math.min(1.4, Math.max(0.04, s0.pl.w * (d / s0.d)));
      next.rot = Math.round(s0.pl.rot + ((a - s0.a) * 180) / Math.PI);
    }
    setPl(next);
  };
  // corner / rotate handles
  const hd = useRef<{ mode: 'scale' | 'rotate'; cx: number; cy: number; d0: number; a0: number; pl: Placement } | null>(null);
  const handleDown = (mode: 'scale' | 'rotate') => (e: React.PointerEvent) => {
    e.stopPropagation();
    if (!stage.current) return;
    remember();
    try {
      (e.target as Element).setPointerCapture?.(e.pointerId);
    } catch {}
    const r = stage.current.getBoundingClientRect();
    const cx = r.left + pl.x * r.width, cy = r.top + pl.y * r.height;
    hd.current = { mode, cx, cy, d0: Math.hypot(e.clientX - cx, e.clientY - cy) || 1, a0: Math.atan2(e.clientY - cy, e.clientX - cx), pl };
    setDrag(true);
  };
  const handleMove = (e: React.PointerEvent) => {
    const h = hd.current;
    if (!h) return;
    e.stopPropagation();
    if (h.mode === 'scale') {
      const d = Math.hypot(e.clientX - h.cx, e.clientY - h.cy);
      setPl({ ...h.pl, w: Math.min(1.4, Math.max(0.04, h.pl.w * (d / h.d0))) });
    } else {
      const a = Math.atan2(e.clientY - h.cy, e.clientX - h.cx);
      let rot = Math.round(h.pl.rot + ((a - h.a0) * 180) / Math.PI);
      if (rot > 180) rot -= 360;
      if (rot < -180) rot += 360;
      // gentle snap to straight angles
      for (const snap of [0, 90, -90, 180, -180]) if (Math.abs(rot - snap) < 4) rot = snap;
      setPl({ ...h.pl, rot });
    }
  };
  const handleUp = (e: React.PointerEvent) => {
    e.stopPropagation();
    hd.current = null;
    setDrag(false);
    haptic();
  };

  const up = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size) snapshot();
    else {
      start.current = null;
      setDrag(false);
    }
  };

  const wPx = `${pl.w * 100}%`;
  return (
    <div className="place-grid">
      <div className="col-a">
      <button className="areabtn" onClick={() => setMapOpen(true)}>
        <span className="areanum">{idx >= 0 ? idx + 1 : '•'}</span>
        <span className="areaname">
          <small>{t('Body area', 'Testrész')}</small>
          {placeName(placement, ui.lang)}
        </span>
        <span className="areachg">{t('Change', 'Módosítás')}</span>
      </button>
      <div className={`editor ${zoom.z > 1 ? 'zoomed' : ''}`} ref={box} style={{ width: `min(100%, calc(62dvh * ${(photo.w / photo.h).toFixed(4)}))`, marginInline: 'auto' }} onPointerDown={bgDown} onPointerMove={bgMove} onPointerUp={bgUp} onPointerCancel={(e) => (bgPts.current.delete(e.pointerId), bgPts.current.size ? bgSnap() : (bgStart.current = null))}>
        <div className="ed-stage" ref={stage} style={{ transform: `translate(${zoom.tx}px, ${zoom.ty}px) scale(${zoom.z})`, ['--iz' as any]: 1 / zoom.z }}>
        {area && (
          <div
            className={`areabox ${drag ? 'show' : ''} ${out ? 'bad' : ''}`}
            style={{ top: `${area.box[0] * 100}%`, left: `${area.box[1] * 100}%`, height: `${(area.box[2] - area.box[0]) * 100}%`, width: `${(area.box[3] - area.box[1]) * 100}%` }}
          />
        )}
        <img className="bg" src={photo.dataUrl} alt={t('Your photo', 'A fotód')} />
        {veil && <img className={`veil ${drag || off > 0.08 ? 'show' : ''}`} src={veil} alt="" aria-hidden="true" />}
        {layers.map((L1, i) => (
          <div
            key={i}
            className={`ink ${drag && i === cur ? 'drag' : ''}`}
            style={{
              width: `${L1.pl.w * 100}%`,
              left: `${L1.pl.x * 100}%`,
              top: `${L1.pl.y * 100}%`,
              transform: `translate(-50%, -50%) rotate(${L1.pl.rot}deg) scaleX(${L1.pl.mirror ? -1 : 1})`,
            }}
            onPointerDown={down(i)}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
            onWheel={(e) => i === cur && setPl({ ...pl, w: Math.min(1.4, Math.max(0.04, pl.w * (e.deltaY < 0 ? 1.05 : 0.95))) })}
            role="img"
            aria-label={t('Tattoo design — tap to select, drag to move', 'Tetoválásminta – koppints a kijelöléshez, húzd a helyére')}
          >
            <img src={L1.design.ink} alt="" draggable={false} />
          </div>
        ))}
        {/* Canva-style frame, only while a tattoo is selected: corners resize, the top handle rotates */}
        {sel && (
        <div
          className="ink-frame"
          style={{
            width: wPx,
            height: `${((pl.w * design.ratio * photo.w) / photo.h) * 100}%`,
            left: `${pl.x * 100}%`,
            top: `${pl.y * 100}%`,
            transform: `translate(-50%, -50%) rotate(${pl.rot}deg)`,
          }}
        >
          {/* the whole framed area (and a margin around it) drags the selected tattoo – easy even when it is tiny */}
          <div className="frame-hit" onPointerDown={down(cur)} onPointerMove={move} onPointerUp={up} onPointerCancel={up} aria-hidden="true" />
          {(['nw', 'ne', 'se', 'sw'] as const).map((c) => (
            <i key={c} className={`hdl ${c}`} onPointerDown={handleDown('scale')} onPointerMove={handleMove} onPointerUp={handleUp} onPointerCancel={handleUp} aria-hidden="true" />
          ))}
          <i className="hdl rot" onPointerDown={handleDown('rotate')} onPointerMove={handleMove} onPointerUp={handleUp} onPointerCancel={handleUp} aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M19 12a7 7 0 1 1-2.1-5M19 4v4h-4" /></svg>
          </i>
          {cur > 0 && (
            <button type="button" className="hdl-del" onPointerDown={(e) => e.stopPropagation()} onClick={() => removeLayer(cur)} aria-label={t('Remove this tattoo', 'Tetoválás eltávolítása')}>
              ×
            </button>
          )}
        </div>
        )}
        </div>
        <div className="zoombar" role="group" aria-label={t('Zoom', 'Nagyítás')}>
          <button type="button" onClick={() => zoomAt(zoom.z / 1.5)} disabled={zoom.z <= 1} aria-label={t('Zoom out', 'Kicsinyítés')}>−</button>
          <button type="button" className="zlabel" onClick={() => setZoom({ z: 1, tx: 0, ty: 0 })} aria-label={t('Reset zoom', 'Eredeti méret')}>{zoom.z.toFixed(zoom.z < 2 ? 1 : 0)}×</button>
          <button type="button" onClick={() => zoomAt(zoom.z * 1.5)} disabled={zoom.z >= 4} aria-label={t('Zoom in', 'Nagyítás')}>+</button>
        </div>
        {!sel && !drag && <span className="ed-hint">{zoom.z > 1 ? t('Drag the photo to look around · 1× to zoom back out', 'Húzd a fotót a mozgatáshoz · 1× gomb: vissza') : t('Tap the tattoo to resize it · pinch or + to zoom in', 'Koppints a tetoválásra a méretezéshez · csippentés vagy + a nagyításhoz')}</span>}
        <span className="cm">≈ {cm.toFixed(cm < 10 ? 1 : 0)} cm</span>
      </div>
      {setExtras && (
        <div className="layer-bar">
          {layers.length > 1 && (
            <div className="layer-chips" role="group" aria-label={t('Tattoos on the photo', 'Tetoválások a fotón')}>
              {layers.map((L1, i) => (
                <button key={i} type="button" className={`layer-chip ${i === cur ? 'on' : ''}`} onClick={() => (setActive(i), setSel(true))}>
                  <img src={L1.design.ink} alt="" /> {i + 1}.
                </button>
              ))}
            </div>
          )}
          {extras.length < 5 && (
            <button type="button" className="chipbtn add-layer" onClick={() => setAddOpen(true)}>
              + {t('Add another tattoo', 'Még egy tetoválás hozzáadása')}
            </button>
          )}
        </div>
      )}
      <Sheet open={addOpen} onClose={() => !addBusy && setAddOpen(false)} label={t('Add another tattoo', 'Még egy tetoválás')}>
        <h2>{t('Add another tattoo', 'Még egy tetoválás')}</h2>
        <p className="sub">{t('It goes on the same photo – drag it above, below or next to the first one.', 'Ugyanarra a fotóra kerül – húzd a másik fölé, alá vagy mellé.')}</p>
        <input
          ref={addRef}
          id="add-layer-input"
          disabled={addBusy}
          className="file-hidden"
          type="file"
          accept="image/*,.heic,.heif"
          tabIndex={-1}
          aria-hidden="true"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            try {
              const pimg = await prepareImage(f, 1024, 'image/jpeg');
              const probe = await processDesign(pimg.dataUrl, design0.mode).catch(() => null);
              await addLayer(pimg.dataUrl, !!probe?.photoLike);
            } catch {
              toast(t('That file could not be opened.', 'Ezt a fájlt nem sikerült megnyitni.'));
            }
          }}
        />
        <label htmlFor="add-layer-input" role="button" tabIndex={0} className={`btn wide ${addBusy ? 'is-busy' : ''}`} aria-disabled={addBusy} style={{ cursor: 'pointer' }}>
          {addBusy ? t('Cutting it out…', 'Kivágás…') : t('Upload a picture', 'Kép feltöltése')}
        </label>
        <div className="layer-lib">
          {DESIGNS.slice(0, 12).map((d) => (
            <button key={d.id} type="button" disabled={addBusy} onClick={() => addLayer(d.src, false)} aria-label={t(d.en, d.hu)}>
              <img src={d.thumb || d.src} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      </Sheet>

      </div>
      <div className="col-b">
      <div className="sliders">
        <label>
          {ui.t('create.place.size')}
          <input type="range" min={4} max={140} value={Math.round(pl.w * 100)} onPointerDown={remember} onChange={(e) => setPl({ ...pl, w: Number(e.target.value) / 100 })} />
        </label>
        <div className="cmrow" role="group" aria-label={t('Size in cm', 'Méret cm-ben')}>
          {[3, 5, 8, 12, 20].map((c) => (
            <button key={c} className={`chip ${Math.abs(cm - c) < 0.6 ? 'on' : ''}`} onClick={() => setCm(c)}>
              {c} cm
            </button>
          ))}
        </div>
        <label>
          {ui.t('create.place.rotate')}
          <input type="range" min={-180} max={180} value={pl.rot} onPointerDown={remember} onChange={(e) => setPl({ ...pl, rot: Number(e.target.value) })} />
        </label>
      </div>
      <div className="row" style={{ marginTop: 6 }}>
        <button className={`chipbtn ${pl.mirror ? 'on' : ''}`} onClick={() => setPl({ ...pl, mirror: !pl.mirror })}>
          {Icon.mirror} {ui.t('create.place.mirror')}
        </button>
        <button className="chipbtn" onClick={() => (remember(), setPl({ ...pl, rot: 0 }))}>
          {Icon.rotate} 0°
        </button>
        <button className="chipbtn" disabled={!canUndo} onClick={undo}>
          <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: 16, height: 16, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }}>
            <path d="M9 14L4 9l5-5" />
            <path d="M4 9h11a5 5 0 0 1 0 10h-3" />
          </svg>
          {t('Undo', 'Vissza')}
        </button>
      </div>

      {off > 0.08 && (
        <div className="warnbox" role="alert">
          <span>⚠️</span>
          <span>
            <b>{t(`About ${Math.round(off * 100)}% of it is off the skin`, `Kb. ${Math.round(off * 100)}%-a nem bőrre esik`)}</b>{' '}
            {t('(on clothes or the background, shaded in the photo). A tattoo can only go on skin — that part will be left out.', '(ruhára vagy a háttérre – a fotón sötétítve látod). Tetoválás csak bőrre kerülhet, ez a rész kimarad.')}
            {onFit && (
              <button className="inline-fix" onClick={() => (remember(), onFit())}>
                {t('Fit it to the body part', 'Igazítsd a testrészre')}
              </button>
            )}
          </span>
        </div>
      )}
      {out && off <= 0.08 && (
        <div className="notebox" role="note">
          <span>
            <b>{t('It reaches past the detected body part.', 'Túlnyúlik a felismert testrészen.')}</b>{' '}
            {t('That’s fine if you want it there — it will continue onto the neighbouring skin, never onto clothes or the background.', 'Ha így szeretnéd, maradhat – a szomszédos bőrre folytatódik, ruhára vagy a háttérre soha.')}
            {onFit && (
              <button className="inline-fix" onClick={onFit}>
                {t('Fit it to the body part', 'Igazítsd a testrészre')}
              </button>
            )}
          </span>
        </div>
      )}

      {thin && (
        <div className="warnbox" role="note">
          <span>⚠️</span>
          <span>
            <b>{t('Very fine detail for this size.', 'Nagyon apró részletek ehhez a mérethez.')}</b>{' '}
            {t(
              `Lines this close together usually merge within 10 years. Try at least ${Math.ceil(Math.max(7, cm * 1.4))} cm — the preview will show you why.`,
              `Ilyen közeli vonalak 10 éven belül általában összefolynak. Próbáld legalább ${Math.ceil(Math.max(7, cm * 1.4))} cm-esre – az előnézet megmutatja, miért.`
            )}
          </span>
        </div>
      )}

      <div className="stickycta">
        <button className="btn wide" disabled={!canGo} onClick={onGo}>
          {ui.t('create.go')}
        </button>
        {footer}
      </div>

      </div>
      <Sheet open={mapOpen} onClose={() => setMapOpen(false)} label={t('Body area', 'Testrész')}>
        <h2>{t('Where will it go?', 'Hová kerül?')}</h2>
        <BodyMap
          value={placement}
          onChange={(v) => {
            setPlacement(v);
            if (!isCustom(v)) setMapOpen(false);
          }}
        />
        {isCustom(placement) && (
          <button className="btn wide" onClick={() => setMapOpen(false)}>
            {t('Done', 'Kész')}
          </button>
        )}
      </Sheet>
    </div>
  );
}

export { placeName } from '@/lib/placements';
import { aiPlacement, isCustom, placeName } from '@/lib/placements';
