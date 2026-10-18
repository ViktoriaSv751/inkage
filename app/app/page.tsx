'use client';
import { pick } from '@/lib/tr';

import { useEffect, useRef, useState } from 'react';
import { useApp } from './AppProvider';
import { Icon, OutOfPreviews, Waitlist } from './ui';
import { Result } from './Result';
import { Onboarding, OnboardingAnswers } from './create/Onboarding';
import { aiPlacement } from '@/lib/placements';
import { PollSheet } from './PollSheet';
import { Area, Design, fitToArea, Layer, Photo, placeName, PlaceStep, StudioStep } from './create/steps';
import { trErr, tx, huArticle } from '@/lib/i18n';
import { api, sb } from '@/lib/sb';
import { cloud, haptic, local, lsGet, Preview, REMOVAL_STAGES, RemovalKey, shares, StageKey, STAGES, track } from '@/lib/store';
import { composeMockup, mergeLayers, pasteMask, Placement, Skin } from '@/lib/editor';
import { loadImage, prepareImage } from '@/lib/client';
import { USE_UPLOAD_KEY, type UseUpload } from '@/lib/uploads';
import { frameCm, photoCm } from '@/lib/score';
import { ALL_DESIGNS as DESIGNS } from '@/lib/designs';
import { processDesign } from '@/lib/editor';
import { lsSet } from '@/lib/store';

type Phase = 'loading' | 'onboarding' | 'studio' | 'place' | 'gen' | 'result';
type JobMeta = Pick<Preview, 'placement' | 'mode' | 'size' | 'sizeCm' | 'design' | 'focus' | 'colorMode'>;
const AGE_STAGES: StageKey[] = ['healed', 'y10', 'y30', 'y50'];

/** The design on white, turned (and mirrored) exactly as placed – so the AI gets it in the final orientation. */
async function flattenOnWhite(src: string, max = 1024, rot = 0, mirror = false) {
  const img = await loadImage(src);
  const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const pad = 0.08;
  const w = Math.round(img.naturalWidth * s), h = Math.round(img.naturalHeight * s);
  const a = (rot * Math.PI) / 180;
  const bw = Math.abs(w * Math.cos(a)) + Math.abs(h * Math.sin(a));
  const bh = Math.abs(w * Math.sin(a)) + Math.abs(h * Math.cos(a));
  const c = document.createElement('canvas');
  c.width = Math.round(bw * (1 + pad * 2));
  c.height = Math.round(bh * (1 + pad * 2));
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.translate(c.width / 2, c.height / 2);
  ctx.rotate(a);
  if (mirror) ctx.scale(-1, 1);
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  return c.toDataURL('image/png');
}

const FACTS = {
  en: [
    '<b>Ink spreads</b> about 0.1 mm a decade as your body slowly carries pigment away.',
    '<b>Black ink</b> lasts longest. Yellows and pastels fade first.',
    '<b>Sun</b> is the #1 reason tattoos fade. SPF 50 makes a real difference.',
    '<b>Fine lines</b> closer than 1 mm usually merge within 10–15 years.',
  ],
  hu: [
    '<b>A tinta szétterül</b> – évtizedenként kb. 0,1 mm-t, ahogy a szervezet lassan elszállítja a pigmentet.',
    '<b>A fekete tinta</b> tart a legtovább. A sárga és a pasztell fakul először.',
    '<b>A nap</b> az első számú oka a fakulásnak. Az 50-es fényvédő tényleg sokat számít.',
    '<b>Az 1 mm-nél közelebbi vékony vonalak</b> 10–15 éven belül általában összefolynak.',
  ],
};

export default function CreatePage() {
  const { ui, me, openAuth, toast, refreshMe } = useApp();
  const t = (en: string, hu: string) => tx(ui.lang, en, hu);
  const [phase, setPhase] = useState<Phase>('loading');
  const [ob, setOb] = useState<OnboardingAnswers | null>(null);
  const [placement, setPlacement] = useState('Inner forearm');
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [design, setDesign] = useState<Design | null>(null);
  const [pl, setPl] = useState<Placement>({ x: 0.5, y: 0.5, w: 0.3, rot: 0, mirror: false });
  // more tattoos on the same photo
  const [extras, setExtras] = useState<Layer[]>([]);
  const [pollOpen, setPollOpen] = useState(false);
  // "New design" tapped while already here: empty the slots
  useEffect(() => {
    const h = () => {
      try {
        sessionStorage.removeItem('ink_fresh');
        sessionStorage.removeItem('ink_draft');
      } catch {}
      setPhoto(null);
      setDesign(null);
      setExtras([]);
      setPhase((ph) => (ph === 'onboarding' || ph === 'loading' ? ph : 'studio'));
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    };
    window.addEventListener('ink:fresh', h);
    return () => window.removeEventListener('ink:fresh', h);
  }, []);
  // a different main design starts with just that one tattoo again (extras from the same picture are added right after)
  useEffect(() => setExtras([]), [design?.raw]);
  const [genStep, setGenStep] = useState(0);
  const [err, setErr] = useState('');
  const [paywall, setPaywall] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [pending, setPending] = useState<StageKey[]>([]);
  const [failed, setFailed] = useState<StageKey[]>([]);
  const [fact, setFact] = useState(0);
  const [mode, setMode] = useState<'new' | 'existing' | 'removal'>('new');
  const removalIntent = useRef(false);
  const explicitMode = useRef(false);
  const [existingCm, setExistingCm] = useState<number | null>(null);
  const [remPending, setRemPending] = useState<RemovalKey[]>([]);
  const [improving, setImproving] = useState(false);
  const [busyNote, setBusyNote] = useState(false);
  const [waitlist, setWaitlist] = useState(false);
  const prevRef = useRef<Preview | null>(null);
  // where the chosen body part is in the photo (found by the AI), and whether the user moved the design since
  const [area, setArea] = useState<(Area & { for: string; photo: string }) | null>(null);
  const userMoved = useRef(false);
  // the bare skin in the photo (outlines found by the AI), so the design never goes on clothes
  const [skin, setSkin] = useState<{ polys: Skin; photo: string } | null>(null);
  const skinNow = skin && photo && skin.photo === photo.dataUrl.slice(-64) ? skin.polys : null;
  const keepSkin = (ph: Photo, polys?: Skin | null) => {
    if (polys?.length) setSkin({ polys, photo: ph.dataUrl.slice(-64) });
  };

  const locate = async (ph: Photo, where: string) => {
    const r = await api<{ box?: Area['box'] | null; angle?: number | null; skin?: Skin | null }>('/api/check-photo', { photo: ph.dataUrl, placement: aiPlacement(where) });
    if (r.ok) keepSkin(ph, r.data.skin);
    if (r.ok && r.data.box) setArea({ box: r.data.box, angle: r.data.angle ?? 0, for: where, photo: ph.dataUrl.slice(-64) });
    else setArea(null);
  };
  const areaNow = area && photo && area.for === placement && area.photo === photo.dataUrl.slice(-64) ? area : null;
  const fit = () => {
    if (!areaNow || !design || !photo) return;
    setPl(fitToArea(areaNow, design, photo));
    userMoved.current = false;
    haptic();
  };
  // body part changed after the photo was added: find the new spot
  useEffect(() => {
    if (!photo || mode !== 'new' || phase === 'loading' || phase === 'onboarding') return;
    if (area && area.for === placement && area.photo === photo.dataUrl.slice(-64)) return;
    const tm = setTimeout(() => locate(photo, placement), 900);
    return () => clearTimeout(tm);
  }, [placement, photo]); // eslint-disable-line react-hooks/exhaustive-deps
  // snap the design into the body part automatically until the user moves it themselves
  useEffect(() => {
    if (phase === 'place' && areaNow && design && photo && !userMoved.current) setPl(fitToArea(areaNow, design, photo));
  }, [phase, areaNow?.box?.join(','), design?.ink]); // eslint-disable-line react-hooks/exhaustive-deps
  const job = useRef<{ token: string; fresh: string; id?: string } | null>(null);
  const recovering = useRef(false);
  const againRef = useRef(false);
  const saved = useRef(false);
  const savingRef = useRef(false);
  const previewRef = useRef<Preview | null>(null);
  previewRef.current = preview;

  // start: onboarding once, then straight into creating
  useEffect(() => {
    const ans = lsGet<OnboardingAnswers | null>('ink_onboarding', null);
    const draft = (() => {
      try {
        return JSON.parse(sessionStorage.getItem('ink_draft') || 'null');
      } catch {
        return null;
      }
    })();
    const sp = new URLSearchParams(location.search);
    const again = sp.has('again');
    const m = sp.get('mode');
    const redo0 = lsGet<any>('ink_redo', null);
    const pick0 = lsGet<string | null>('ink_pick', null);
    // a mode asked for explicitly wins over the onboarding goal
    explicitMode.current = m === 'removal' || m === 'existing' || !!redo0 || !!pick0;
    if (m === 'removal' || m === 'existing') setMode(m);
    if (again) againRef.current = true;
    if (ans && !again) {
      applyOnboarding(ans);
      setPhase('studio');
    } else setPhase('onboarding');
    // "New design": start with empty slots; otherwise keep work in progress when switching tabs
    let freshStart = false;
    try {
      freshStart = sessionStorage.getItem('ink_fresh') === '1';
      if (freshStart) {
        sessionStorage.removeItem('ink_fresh');
        sessionStorage.removeItem('ink_draft');
      }
    } catch {}
    if (draft && !freshStart) {
      if (draft.placement) setPlacement(draft.placement);
      if (draft.photo) setPhoto(draft.photo);
      if (draft.design) setDesign(draft.design);
      if (draft.pl) setPl(draft.pl);
    }
    // "New preview with this design" from the gallery
    const redo = lsGet<{ design: string | null; placement: string; mode: 'new' | 'existing' | 'removal' } | null>('ink_redo', null);
    if (redo) {
      lsSet('ink_redo', null);
      setPlacement(redo.placement);
      setMode(redo.mode);
      setPhoto(null);
      const cm: 'black' | 'color' = (redo as any).colorMode === 'color' ? 'color' : 'black';
      if (redo.design && redo.mode === 'new') processDesign(redo.design, cm).then((d) => setDesign({ raw: redo.design!, ink: d.dataUrl, ratio: d.ratio, detail: d.detail, mode: cm })).catch(() => {});
      if (ans) setPhase('studio');
    }
    // a design picked in Explore
    const pick = DESIGNS.find((d) => d.id === lsGet<string | null>('ink_pick', null));
    if (pick) {
      lsSet('ink_pick', null);
      setMode('new');
      processDesign(pick.src, 'black').then((d) => setDesign({ raw: pick.src, ink: d.dataUrl, ratio: d.ratio, detail: d.detail, mode: 'black', libId: pick.id }));
    }
    // "Use" on a picture in the gallery's uploads
    const use = lsGet<UseUpload | null>(USE_UPLOAD_KEY, null);
    if (use?.src) {
      lsSet(USE_UPLOAD_KEY, null);
      (async () => {
        const blob = await (await fetch(use.src)).blob();
        const p = await prepareImage(new File([blob], 'upload.jpg', { type: blob.type || 'image/jpeg' }), 1024);
        if (use.kind === 'photo') return setPhoto(p);
        setMode('new');
        const d = await processDesign(p.dataUrl, 'black');
        setDesign({ raw: p.dataUrl, ink: d.dataUrl, ratio: d.ratio, detail: d.detail, mode: 'black' });
      })().catch(() => toast(t('That picture could not be loaded. Try again.', 'Ezt a képet nem sikerült betölteni. Próbáld újra.')));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // signed-in users who onboarded on another device skip it too
  useEffect(() => {
    // any saved answers count – the questions are asked once per person, not once per device
    if (phase === 'onboarding' && me.onboarding && Object.keys(me.onboarding).length > 0 && !againRef.current) {
      lsSet('ink_onboarding', me.onboarding);
      applyOnboarding(me.onboarding);
      setPhase('studio');
    }
  }, [me.onboarding, phase]); // eslint-disable-line react-hooks/exhaustive-deps

  function applyOnboarding(a: OnboardingAnswers) {
    setOb(a);
    if (!explicitMode.current && (a.goal === 'existing' || a.goal === 'removal')) setMode(a.goal);
    if (a.placement) setPlacement(a.placement);
    const cm = Number(a.size) || 8;
    setPl((p) => ({ ...p, w: Math.min(0.8, Math.max(0.1, cm / frameCm(a.placement || 'forearm'))) }));
  }

  useEffect(() => {
    if (phase === 'loading') return;
    // big images can overflow the browser's storage (iPhone): fall back to lighter drafts
    const tries = [
      { placement, photo, design, pl },
      { placement, photo, design: design ? { ...design, raw: design.ink, original: undefined } : null, pl },
      { placement, photo, design: null, pl },
      { placement, photo: null, design: null, pl },
    ];
    for (const d of tries) {
      try {
        sessionStorage.setItem('ink_draft', JSON.stringify(d));
        break;
      } catch {}
    }
  }, [placement, photo, design, pl, phase]);

  useEffect(() => {
    if (phase !== 'gen') return;
    const i = setInterval(() => setFact((f) => (f + 1) % FACTS.en.length), 4500);
    return () => clearInterval(i);
  }, [phase]);

  // ---------------------------------------------------------------- generation
  // Aging runs as a chain so every stage continues from the previous one (same pose, same changes):
  // fresh → 1 year and fresh → 10 years in parallel, then 10 → 30 → 50.
  const PARENT: Partial<Record<StageKey, StageKey>> = { healed: 'fresh', y10: 'fresh', y30: 'y10', y50: 'y30' };
  const tokens = useRef<Partial<Record<StageKey, { token: string; image: string }>>>({});
  const started = useRef(new Set<StageKey>());
  const chain = (k: StageKey, fromFresh = false) =>
    (Object.keys(PARENT) as StageKey[]).filter((c) => PARENT[c] === k && !started.current.has(c)).forEach((c) => ageOne(c, fromFresh));
  const ageOne = async (k: StageKey, fromFresh = false) => {
    const j = job.current;
    if (!j) return;
    started.current.add(k);
    setFailed((f) => f.filter((x) => x !== k));
    setPending((p) => (p.includes(k) ? p : [...p, k]));
    const parent = !fromFresh && PARENT[k] && PARENT[k] !== 'fresh' ? tokens.current[PARENT[k]!] : null;
    const base = parent || { token: j.token, image: j.fresh };
    let r = await api<{ image: string; token?: string; error?: string }>('/api/age', { stage: k, image: base.image, token: base.token, job: j.id });
    // if continuing from the previous stage fails, start from the fresh photo instead
    if (!r.ok && parent && job.current === j) r = await api<{ image: string; token?: string; error?: string }>('/api/age', { stage: k, image: j.fresh, token: j.token, job: j.id });
    if (job.current !== j) return; // a newer preview was started meanwhile
    setPending((p) => p.filter((x) => x !== k));
    if (r.ok && r.data.image) {
      if (r.data.token) tokens.current[k] = { token: r.data.token, image: r.data.image };
      setPreview((p) => (p ? { ...p, images: { ...p.images, [k]: r.data.image } } : p));
      persistLate({ [k]: r.data.image });
      if (k === 'y50') track('stage_y50');
      chain(k); // next link of the chain
    } else {
      setFailed((f) => [...f, k]);
      chain(k, true); // the rest of the chain can still start from the fresh photo
      if (r.data?.error) toast(trErr(ui.lang, r.data.error));
    }
  };

  /** An image that arrives after the auto-save (a retried stage, a laser session): add it to the saved preview. */
  const lateQueue = useRef<Record<string, string>>({});
  const persistLate = (imgs: Record<string, string>, removal = false) => {
    Object.assign(lateQueue.current, imgs);
    setTimeout(async () => {
      const p = previewRef.current;
      const batch = lateQueue.current;
      if (!p || !saved.current || savingRef.current || !Object.keys(batch).length) return; // the auto-save picks them up
      lateQueue.current = {};
      try {
        if (p.source === 'cloud' && me.user) await cloud.addImages(me.user.id, p.id, batch);
        else if (p.source === 'local') await local.put(p);
      } catch {
        Object.assign(lateQueue.current, batch);
        toast(t('Could not save the new image. It stays here until you leave.', 'Nem sikerült menteni az új képet. Amíg itt vagy, megmarad.'));
      }
    }, removal ? 400 : 200);
  };
  const startAging = () => {
    const j = job.current;
    if (!j) return toast(t('Start a new preview to see the aging.', 'Az öregedéshez indíts új előnézetet.'));
    removalIntent.current = false;
    started.current = new Set();
    setPending(AGE_STAGES);
    AGE_STAGES.filter((k) => PARENT[k] === 'fresh').forEach((k) => ageOne(k));
    track('removal_then_aging');
  };

  const removalOne = async (k: RemovalKey) => {
    const j = job.current;
    if (!j) return;
    setRemPending((p) => (p.includes(k) ? p : [...p, k]));
    const r = await api<{ image: string; error?: string }>('/api/age', { stage: k, image: j.fresh, token: j.token, job: j.id });
    if (job.current !== j) return;
    setRemPending((p) => p.filter((x) => x !== k));
    if (r.ok && r.data.image) {
      setPreview((p) => (p ? { ...p, removal: { ...(p.removal || {}), [k]: r.data.image } } : p));
      persistLate({ [k]: r.data.image }, true);
    } else if (r.data?.error) toast(trErr(ui.lang, r.data.error));
  };
  const startRemoval = () => {
    track('removal_start');
    REMOVAL_STAGES.forEach((k) => removalOne(k));
  };

  const go = async (over?: { design?: Design; pl?: Placement; redo?: string[] }) => {
    let d = over?.design ?? design;
    let place = over?.pl ?? pl;
    // several tattoos: merge them into one design laid out exactly as placed
    if (!over?.design && d && extras.length && photo && mode === 'new') {
      const m = await mergeLayers(photo, [{ design: d, pl: place }, ...extras]).catch(() => null);
      if (m) {
        d = { ...d, ink: m.design.ink, raw: m.design.ink, ratio: m.design.ratio, detail: m.design.detail, mode: m.design.mode, libId: undefined };
        place = m.pl;
      }
    }
    const existing = mode !== 'new';
    removalIntent.current = mode === 'removal';
    if (!photo || (!d && !existing)) return;
    recovering.current = true; // a new job: nothing to recover any more
    // keep the finished one around to compare with
    if (previewRef.current?.images.y50) prevRef.current = previewRef.current;
    job.current = null;
    setPending([]);
    setRemPending([]);
    setErr('');
    setPhase('gen');
    setGenStep(0);
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    haptic();
    track('generate_start', { placement, lib: d?.libId || null, mode });
    const timers = [setTimeout(() => setGenStep(1), 3500), setTimeout(() => setGenStep(2), 17000)];
    const cm = place.w * Math.max(1, d?.ratio ?? 1) * photoCm(placement, areaNow, photo);
    const extra = existing
      ? { mode: 'existing', sizeCm: existingCm ?? undefined }
      : await (async () => {
          const [flat, mockup, mask] = await Promise.all([
            flattenOnWhite(d!.ink, 1024, place.rot, place.mirror),
            composeMockup(photo.dataUrl, d!.ink, place),
            pasteMask(photo, d!.ink, place, skinNow).catch(() => null),
          ]);
          return {
            design: flat,
            mockup,
            mask,
            redo: over?.redo,
            size: cm < 6 ? 'small' : cm > 12 ? 'large' : 'medium',
            colorMode: d!.mode,
            sizeCm: Math.round(cm * 10) / 10,
            detail: d!.detail,
          };
        })();
    const jobId = crypto.randomUUID();
    const meta: JobMeta = {
      placement,
      mode: mode === 'removal' ? 'removal' : existing ? 'existing' : 'new',
      size: existing ? t('existing tattoo', 'meglévő tetoválás') : `${cm.toFixed(1)} cm`,
      sizeCm: existing ? existingCm ?? undefined : Math.round(cm * 10) / 10,
      design: existing ? undefined : d!.ink,
      colorMode: existing ? undefined : d!.mode,
      focus: existing ? undefined : { x: place.x, y: place.y, w: place.w * Math.max(1, d!.ratio * (photo.w / photo.h)) },
    };
    // remember the running job, so its result can be picked up if the app gets closed
    try {
      localStorage.setItem('ink_job', JSON.stringify({ id: jobId, at: Date.now(), meta }));
    } catch {
      try {
        localStorage.setItem('ink_job', JSON.stringify({ id: jobId, at: Date.now(), meta: { ...meta, design: undefined } }));
      } catch {}
    }
    const body = { photo: photo.dataUrl, placement: aiPlacement(placement), sun: lsGet<any>('ink_onboarding', null)?.sun || ob?.sun, ageHint: lsGet<any>('ink_onboarding', null)?.age || ob?.age, lang: ui.lang, w: photo.w, h: photo.h, job: jobId, ...extra };
    let r = await api<any>('/api/generate', body);
    // a busy minute at the AI provider: wait and retry automatically (twice)
    for (let i = 0; i < 2 && !r.ok && /Lots of people|took too long/.test(r.data?.error || ''); i++) {
      setBusyNote(true);
      await new Promise((res) => setTimeout(res, 12000));
      r = await api<any>('/api/generate', body);
    }
    setBusyNote(false);
    timers.forEach(clearTimeout);

    if (!r.ok) {
      lsSet('ink_job', null);
      setPhase(existing ? 'studio' : 'place');
      if (r.data?.code === 'busy') setWaitlist(true);
      if (r.data?.code === 'paywall') {
        track('paywall', { plan: r.data.plan });
        if (!me.user) openAuth(t('You reached today’s limit on this device. Sign in (free) to keep going and keep your designs.', 'Elérted a mai keretet ezen az eszközön. Jelentkezz be (ingyenes), és folytathatod – a terveid is megmaradnak.'));
        else setPaywall(true);
        return;
      }
      setErr(trErr(ui.lang, r.data?.error));
      track('generate_error', { status: r.status, msg: String(r.data?.error || '').slice(0, 80) });
      return;
    }

    setGenStep(3);
    haptic('success');
    track('generate_done', { qc: r.data.qc, score: r.data.report?.score, mode });
    showResult(r.data, meta, jobId);
  };

  /** Show a finished fresh image and run (or continue) the aging stages. */
  const showResult = (data: any, meta: JobMeta, jobId: string, have: Record<string, any> = {}) => {
    saved.current = false;
    const images: Preview['images'] = { fresh: data.image };
    for (const k of AGE_STAGES) if (have[k]?.image) images[k] = have[k].image;
    const p: Preview = {
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      placement: meta.placement,
      size: meta.size,
      sizeCm: meta.sizeCm,
      score: data.report?.score ?? null,
      report: data.report ?? null,
      age: data.age ?? null,
      notes: '',
      favorite: false,
      collection: null,
      images,
      mode: meta.mode,
      colorMode: meta.colorMode,
      design: meta.design,
      focus: meta.focus,
      source: 'local',
    };
    setPreview(p);
    setFailed([]);
    setPhase('result');
    refreshMe();
    if (data.canAge && data.token) {
      job.current = { token: data.token, fresh: data.image, id: jobId };
      tokens.current = {};
      started.current = new Set();
      for (const k of AGE_STAGES) if (have[k]?.token) ((tokens.current[k] = have[k]), started.current.add(k));
      const missing = AGE_STAGES.filter((k) => !images[k]);
      setPending(missing);
      // start every missing stage whose parent is ready
      if (removalIntent.current || meta.mode === 'removal') {
        removalIntent.current = true;
        // removal preview: skip aging, simulate the laser sessions straight away
        setPending([]);
        lsSet('ink_job', null);
        startRemoval();
        return;
      }
      missing.filter((k) => PARENT[k] === 'fresh' || images[PARENT[k]!]).forEach((k) => ageOne(k));
    } else lsSet('ink_job', null);
  };

  // A preview was running when the app was closed or reloaded: pick up its result from the server.
  useEffect(() => {
    if (phase !== 'studio' || recovering.current || preview) return;
    const pj = lsGet<{ id: string; at: number; meta: JobMeta } | null>('ink_job', null);
    if (!pj?.id || Date.now() - pj.at > 2 * 3600e3) return;
    recovering.current = true;
    (async () => {
      setPhase('gen');
      setGenStep(2);
      for (let i = 0; i < 40; i++) {
        const r = await api<{ data: Record<string, any> | null }>(`/api/job?id=${pj.id}`);
        const d = r.ok ? r.data.data : null;
        if (d?.fresh) {
          track('job_recovered');
          toast(t('We kept your last preview for you', 'Megtartottuk a legutóbbi előnézetedet'));
          return showResult(d.fresh, pj.meta, pj.id, d);
        }
        if (d?.error || (!d && Date.now() - pj.at > 6 * 60e3)) break;
        await new Promise((res) => setTimeout(res, 4000));
      }
      lsSet('ink_job', null);
      setPhase('studio');
    })();
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // "Make it last": redraw the design with the AI, then run it again on the same spot.
  const improve = async () => {
    if (!design) return;
    setImproving(true);
    track('improve_start');
    const flat = await flattenOnWhite(design.ink);
    const r = await api<{ image: string; error?: string }>('/api/improve', { design: flat, sizeCm: preview?.sizeCm });
    setImproving(false);
    if (!r.ok || !r.data.image) return toast(trErr(ui.lang, r.data?.error));
    const nd = await processDesign(r.data.image, design.mode);
    const next: Design = { raw: r.data.image, ink: nd.dataUrl, ratio: nd.ratio, detail: nd.detail, mode: design.mode };
    setDesign(next);
    toast(t('Redrawn to last — now showing how it ages', 'Átrajzolva – most megnézzük, hogyan öregszik'));
    go({ design: next });
  };
  const resize = (cm: number) => {
    const next = { ...pl, w: Math.min(0.95, cm / ((photo ? photoCm(placement, areaNow, photo) : frameCm(placement)) * Math.max(1, design?.ratio ?? 1))) };
    setPl(next);
    track('resize', { cm });
    go({ pl: next });
  };

  // ---------------------------------------------------------------- auto-save when aging settles
  useEffect(() => {
    const p = previewRef.current;
    if (!p || !p.images.fresh || pending.length || saved.current) return;
    saved.current = true;
    savingRef.current = true;
    (async () => {
      try {
        if (me.user) {
          await cloud.save(me.user.id, { ...p, analysis: p.age ? { apparentAge: p.age } : undefined }, p.id);
          setPreview((x) => (x && x.id === p.id ? { ...x, source: 'cloud' } : x));
          if (previewRef.current) previewRef.current = { ...previewRef.current, source: 'cloud' };
          // images that arrived while uploading
          const cur = previewRef.current;
          const extra: Record<string, string> = {};
          if (cur) {
            for (const k of STAGES) if (cur.images[k] && !p.images[k]) extra[k] = cur.images[k]!;
            for (const k of REMOVAL_STAGES) if (cur.removal?.[k] && !p.removal?.[k]) extra[k] = cur.removal[k]!;
          }
          if (Object.keys(extra).length) await cloud.addImages(me.user.id, p.id, extra).catch(() => {});
          // edits made while uploading (favorite, notes, done)
          if (cur && (cur.notes !== p.notes || cur.favorite !== p.favorite || (cur.doneAt ?? null) !== (p.doneAt ?? null)))
            await cloud.update(p.id, { notes: cur.notes, favorite: cur.favorite, done_at: cur.doneAt ?? null }).catch(() => {});
          toast(ui.t('result.saved'));
        } else {
          await local.put(previewRef.current && previewRef.current.id === p.id ? previewRef.current : p);
          toast(ui.t('result.savedLocal'));
        }
        track('preview_saved', { cloud: !!me.user });
        lsSet('ink_job', null);
      } catch (e) {
        console.warn('save failed', e);
        saved.current = false;
      }
      savingRef.current = false;
      if (Object.keys(lateQueue.current).length) persistLate({});
    })();
  }, [pending, phase, me.user]); // eslint-disable-line react-hooks/exhaustive-deps

  const patch = (x: Partial<Preview>) => {
    const p = previewRef.current;
    if (!p) return;
    const next = { ...p, ...x };
    setPreview(next);
    if (!saved.current) return;
    if (me.user && savingRef.current) return; // the cloud save picks the change up when it finishes
    const done = p.source === 'cloud' ? cloud.update(p.id, { notes: next.notes, favorite: next.favorite, done_at: next.doneAt ?? null }) : local.put(next);
    Promise.resolve(done).catch(() => {
      setPreview(p);
      toast(t('Could not save the change. Try again.', 'Nem sikerült menteni a változást. Próbáld újra.'));
    });
  };

  const restart = () => {
    setPreview(null);
    setFailed([]);
    setPhase('studio');
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  };
  const replace = () => {
    setPhase('place');
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  };

  // ---------------------------------------------------------------- render
  if (phase === 'loading') return null;
  if (phase === 'onboarding')
    return (
      <Onboarding
        onDone={(a) => {
          applyOnboarding(a);
          if (againRef.current) {
            againRef.current = false;
            history.replaceState(null, '', '/app');
          }
          // keep the answers on the account so no other device or sign-in asks again
          if (me.user) sb()?.rpc('save_profile', { p_onboarding: a, p_lang: ui.lang }).then(() => {}, () => {});
          setPhase('studio');
        }}
      />
    );

  const stepIdx = phase === 'studio' ? 0 : 1;
  const head = (title: string, sub: string, back?: () => void) => (
    <>
      <div className="stephead">
        {back ? (
          <button className="iconbtn" aria-label={ui.t('common.back')} onClick={back}>
            {Icon.back}
          </button>
        ) : (
          <span className="free-pill">
            {t('✦ Free while in beta', '✦ Ingyenes a tesztidőszakban')}
          </span>
        )}
        <div className="dots" aria-label={`${stepIdx + 1} / 2`}>
          {[0, 1].map((i) => (
            <i key={i} className={i === stepIdx ? 'on' : ''} />
          ))}
        </div>
      </div>
      <h1>{title}</h1>
      <p className="sub">{sub}</p>
    </>
  );

  if (phase === 'studio')
    return (
      <>
        {mode === 'removal'
          ? head(t('Removal preview', 'Eltávolítás előnézete'), t('Pick the spot and add a photo of the tattoo.', 'Válaszd ki a helyet, és töltsd fel a tetoválás fotóját.'))
          : head(t('New preview', 'Új előnézet'), t('Pick the spot, add a photo of it and a design.', 'Válaszd ki a helyet, töltsd fel a fotóját és a mintát.'))}
        {err && mode !== 'new' && (
          <div className="warnbox" role="alert" style={{ marginBottom: 12 }}>
            <span>⚠️</span>
            <span>{err}</span>
          </div>
        )}
        <StudioStep
          mode={mode}
          setMode={setMode}
          placement={placement}
          setPlacement={setPlacement}
          photo={photo}
          setPhoto={setPhoto}
          design={design}
          setDesign={setDesign}
          onExtras={(ds) =>
            // around the first one (below, above, beside), a little smaller; each can be moved on the next screen
            setExtras(ds.slice(0, 5).map((d, i) => { const [dx, dy] = [[0, 0.2], [0, -0.2], [0.22, 0], [-0.22, 0], [0.22, 0.2]][i]; return { design: d, pl: { x: Math.min(0.9, Math.max(0.1, pl.x + dx)), y: Math.min(0.92, Math.max(0.08, pl.y + dy)), w: pl.w * 0.8, rot: 0, mirror: false } }; }))
          }
          existingCm={existingCm}
          setExistingCm={setExistingCm}
          onArea={(a, where, ph, sk) => {
            setArea(a ? { ...a, for: where, photo: ph.dataUrl.slice(-64) } : null);
            keepSkin(ph, sk);
          }}
          onNext={() => {
            if (mode !== 'new') return go();
            setPhase('place');
            window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
          }}
        />
        <Waitlist open={waitlist} onClose={() => setWaitlist(false)} />
        <OutOfPreviews open={paywall} onClose={() => setPaywall(false)} />
      </>
    );

  if (phase === 'place' && photo && design)
    return (
      <>
        {head(ui.t('create.place.title'), ui.t('create.place.sub'), () => setPhase('studio'))}
        {err && (
          <div className="warnbox" role="alert" style={{ marginBottom: 12 }}>
            <span>⚠️</span>
            <span>{err}</span>
          </div>
        )}
        <PlaceStep
          photo={photo}
          design={design}
          placement={placement}
          setPlacement={(v) => {
            setPlacement(v);
            userMoved.current = false;
          }}
          area={areaNow}
          skin={skinNow}
          onFit={fit}
          pl={pl}
          setPl={(x) => {
            userMoved.current = true;
            setPl(x);
          }}
          extras={extras}
          setExtras={setExtras}
          onGo={() => go()}
          canGo
          footer={null}
        />
        <OutOfPreviews open={paywall} onClose={() => setPaywall(false)} />
        <Waitlist open={waitlist} onClose={() => setWaitlist(false)} />
      </>
    );

  if (phase === 'gen')
    return (
      <div className="gen" aria-busy="true">
        <h1 style={{ marginBottom: 0 }}>{t('Inking…', 'Tetoválunk…')}</h1>
        <div className="gen-visual">
          {photo && <img src={photo.dataUrl} alt="" />}
          <div className="scan" />
        </div>
        <ul className="gen-steps" role="status">
          {(['gen.s1', 'gen.s2', 'gen.s3', 'gen.s4'] as const).map((k, i) => (
            <li key={k} className={i < genStep ? 'done' : i === genStep ? 'doing' : ''}>
              <i />
              {ui.t(k)}
            </li>
          ))}
        </ul>
        {busyNote && <p className="warnbox" role="status">{t('Lots of people are making previews right now — you’re in the queue, we’ll retry automatically.', 'Most sokan készítenek előnézetet – sorban állsz, automatikusan újrapróbáljuk.')}</p>}
        <p className="gen-fact" dangerouslySetInnerHTML={{ __html: pick(FACTS, ui.lang)[fact] }} />
      </div>
    );

  if (phase === 'result' && preview)
    return (
      <>
        <div className="stephead" style={{ marginBottom: 12 }}>
          <button className="iconbtn" aria-label={t('Edit placement', 'Elhelyezés módosítása')} onClick={replace}>
            {Icon.back}
          </button>
          <h1 style={{ margin: 0, fontSize: 34 }}>{t('Your tattoo', 'A tetoválásod')}</h1>
        </div>
        <div className="result-edit">
          <button className="chipbtn" onClick={replace}>
            {Icon.rotate} {t('Other body area / position', 'Másik testrész / helyzet')}
          </button>
          <button className="chipbtn" onClick={restart}>
            {Icon.image} {t('Other photo or design', 'Másik fotó vagy minta')}
          </button>
        </div>
        <Result
          preview={preview}
          pending={pending}
          failed={failed}
          reveal
          onNotes={(notes) => patch({ notes })}
          onFavorite={() => patch({ favorite: !preview.favorite })}
          onRetryStage={(k) => ageOne(k)}
          onRedo={preview.mode !== 'existing' && design ? (why) => go({ redo: why }) : undefined}
          onImprove={preview.mode !== 'existing' && design ? improve : undefined}
          improving={improving}
          onResize={resize}
          onRemoval={startRemoval}
          removalPending={remPending}
          startView={removalIntent.current || preview.mode === 'removal' ? 'removal' : 'aging'}
          onAging={startAging}
          onTryPlace={
            preview.mode !== 'existing' && preview.mode !== 'removal' && design
              ? (v) => {
                  setPlacement(v);
                  setPhoto(null);
                  setArea(null);
                  setPreview(null);
                  setPhase('studio');
                  window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
                  toast(t(`Now add a photo of your ${placeName(v, 'en').toLowerCase()}`, `Most töltsd fel ${huArticle(placeName(v, 'hu'))} ${placeName(v, 'hu').toLowerCase()} fotóját`));
                }
              : undefined
          }
          onShared={(sid) => setPreview((p) => (p ? { ...p, share_id: sid } : p))}
          onDone={(d) => patch({ doneAt: d })}
          onNew={restart}
        />
        {prevRef.current && prevRef.current.id !== preview.id && preview.images.y50 && (
          <div className="card" style={{ marginTop: 12 }}>
            <h2>{t('Previous vs. this one', 'Előző vs. mostani')}</h2>
            <button className="chipbtn" style={{ marginBottom: 8 }} onClick={() => setPollOpen(true)}>
              {t('Ask friends: which one?', 'Kérdezd meg a barátaidat: melyik legyen?')}
            </button>
            <PollSheet open={pollOpen} onClose={() => setPollOpen(false)} initial={[prevRef.current, preview]} />
            <p className="muted">{t('Both at 50 years.', 'Mindkettő 50 év múlva.')}</p>
            <div className="cmp">
              {[prevRef.current, preview].map((x, i) => (
                <figure key={x.id}>
                  <img src={x.images.y50} alt={i ? t('This one', 'Mostani') : t('Previous', 'Előző')} />
                  <figcaption>
                    {i ? t('This one', 'Mostani') : t('Previous', 'Előző')} · {placeName(x.placement, ui.lang)}
                    {x.sizeCm ? ` · ${x.sizeCm} cm` : ''} · {x.score ?? '–'}/100
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        )}
      </>
    );

  // fallback (e.g. place without photo after refresh)
  return (
    <div className="empty">
      <button className="btn" onClick={() => setPhase('studio')}>
        {ui.t('common.continue')}
      </button>
    </div>
  );
}
