'use client';
import { pick } from '@/lib/tr';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from './AppProvider';
import { Icon, Sheet } from './ui';
import { tx } from '@/lib/i18n';
import { anonId, cloud, haptic, lsGet, lsSet, Preview, REMOVAL_STAGES, RemovalKey, revokeGuestShare, shares, StageKey, STAGES, track } from '@/lib/store';
import { loadImage, shareOrDownload } from '@/lib/client';
import { api, sb } from '@/lib/sb';
import { canRecordVideo, HOOKS, makeVideo, photoSlides, Template } from '@/lib/video';
import { artistPdf } from '@/lib/brief';
import { aftercareIcs, CARE } from '@/lib/aftercare';
import { placeName } from './create/steps';
import { longevity } from '@/lib/score';
import { useScrollLock } from '@/lib/scrolllock';
import { PollSheet } from './PollSheet';
import { AiReport } from './AiReport';
import { PollResults } from './PollResults';
import type { PollData } from '@/lib/share';
import { closePoll } from '@/lib/share';

const toBlob = async (src: string) => (await fetch(src)).blob();

/** Small JPEG for links (kept under ~450 KB). */
async function smallJpeg(src: string, max = 900) {
  const img = await loadImage(src);
  const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * s);
  c.height = Math.round(img.naturalHeight * s);
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  let q = 0.82, out = c.toDataURL('image/jpeg', q);
  while (out.length > 450_000 && q > 0.4) out = c.toDataURL('image/jpeg', (q -= 0.12));
  return out;
}

/** "Fresh vs. 50 years" picture for Instagram / TikTok photo posts (1080×1350). */
async function makeCard(fresh: string, old: string, o: { left: string; right: string; title: string; score: string | null }) {
  const [a, b] = await Promise.all([loadImage(fresh), loadImage(old)]);
  const W = 1080, H = 1350;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const x = c.getContext('2d')!;
  x.fillStyle = '#0d0b14';
  x.fillRect(0, 0, W, H);
  const pad = 36, gap = 16, top = 190, ih = H - top - 150;
  const iw = (W - pad * 2 - gap) / 2;
  const draw = (img: HTMLImageElement, dx: number) => {
    const r = Math.max(iw / img.naturalWidth, ih / img.naturalHeight);
    const sw = iw / r, sh = ih / r;
    x.save();
    x.beginPath();
    (x as any).roundRect ? (x as any).roundRect(dx, top, iw, ih, 28) : x.rect(dx, top, iw, ih);
    x.clip();
    x.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, dx, top, iw, ih);
    x.restore();
  };
  draw(a, pad);
  draw(b, pad + iw + gap);
  x.fillStyle = '#fff';
  x.textBaseline = 'alphabetic';
  x.font = `800 64px 'Geist Sans', system-ui, sans-serif`;
  x.fillText(o.title, pad, 120);
  const tag = (txt: string, dx: number) => {
    x.font = `700 34px 'Geist Sans', system-ui, sans-serif`;
    const w = x.measureText(txt).width + 36;
    x.fillStyle = 'rgba(0,0,0,.6)';
    x.beginPath();
    (x as any).roundRect ? (x as any).roundRect(dx + 18, top + 18, w, 56, 28) : x.rect(dx + 18, top + 18, w, 56);
    x.fill();
    x.fillStyle = '#fff';
    x.fillText(txt, dx + 36, top + 58);
  };
  tag(o.left, pad);
  tag(o.right, pad + iw + gap);
  x.font = `600 32px 'Geist Sans', system-ui, sans-serif`;
  x.fillStyle = 'rgba(255,255,255,.75)';
  if (o.score) x.fillText(o.score, pad, H - 64);
  x.textAlign = 'right';
  x.fillStyle = '#fff';
  x.fillText('inkage.app', W - pad, H - 64);
  return new Promise<Blob>((res) => c.toBlob((bl) => res(bl!), 'image/jpeg', 0.9));
}

/** One sentence per stage: what changes and why. */
const WHY: Record<StageKey, [string, string]> = {
  fresh: ['Fresh: lines are slightly raised and shiny; the redness settles within days.', 'Friss: a vonalak kicsit kiemelkednek és fényesek, a pirosság pár nap alatt elmúlik.'],
  healed: ['1 year: fully healed — the ink has settled a touch deeper, lines look a little softer.', '1 év: teljesen begyógyult – a tinta kicsit mélyebbre ült, a vonalak picit lágyabbak.'],
  y10: ['10 years: ink spreads about 0.1 mm; the finest details lose their edge, sun fades colours first.', '10 év: a tinta kb. 0,1 mm-t terül; a legfinomabb részletek élessége csökken, a nap először a színeket fakítja.'],
  y30: ['30 years: black shifts towards blue-grey and lines closer than ~1 mm start to merge.', '30 év: a fekete kékesszürke felé tolódik, és a kb. 1 mm-nél közelebbi vonalak összeérnek.'],
  y50: ['50 years: thinner, looser skin carries a softer, wider design — bold lines still read clearly.', '50 év: a vékonyabb, lazább bőrön a minta lágyabb és szélesebb – a vastag vonalak még jól olvashatók.'],
};

/** The same design scored on a few other body areas. */
const OTHER_SPOTS: [string, string, string][] = [
  ['Inner forearm', 'on the forearm', 'alkaron'],
  ['Upper arm', 'on the upper arm', 'felkaron'],
  ['Upper back', 'on the back', 'háton'],
  ['Ribs', 'on the ribs', 'bordán'],
  ['Ankle', 'on the ankle', 'bokán'],
  ['Hand', 'on the hand', 'kézfejen'],
  ['Finger', 'on a finger', 'ujjon'],
];

export const REDO_REASONS = [
  ['clothes', 'It went onto clothes or the background', 'Ruhára vagy a háttérre került'],
  ['design', 'It’s not my design / details changed', 'Nem az én mintám / változtak a részletek'],
  ['place', 'Wrong place or size', 'Rossz helyen vagy rossz méretben van'],
  ['anatomy', 'Hand or body looks distorted', 'Torz a kéz vagy a test'],
  ['fake', 'Looks fake, like a sticker', 'Nem élethű, matricának tűnik'],
] as const;
const YEARS: Record<StageKey, number> = { fresh: 0, healed: 1, y10: 10, y30: 30, y50: 50 };

export function Result({
  preview,
  pending = [],
  failed = [],
  onNotes,
  onFavorite,
  onRetryStage,
  onNew,
  reveal = false,
  onImprove,
  improving = false,
  onResize,
  onRemoval,
  removalPending = [],
  onRedo,
  startView = 'aging',
  onShared,
  onDone,
  onAging,
  onTryPlace,
}: {
  preview: Preview;
  pending?: StageKey[];
  failed?: StageKey[];
  onNotes?: (s: string) => void;
  onFavorite?: () => void;
  onRetryStage?: (k: StageKey) => void;
  onNew?: () => void;
  reveal?: boolean;
  /** "Make it last": redraw the design and try again */
  onImprove?: () => void;
  improving?: boolean;
  /** try again at a suggested width in cm */
  onResize?: (cm: number) => void;
  /** start the laser-removal preview */
  onRemoval?: () => void;
  removalPending?: RemovalKey[];
  /** which tab opens first */
  startView?: 'aging' | 'removal';
  /** "Not right?": make it again, avoiding what the user ticked */
  onRedo?: (reasons: string[]) => void;
  /** a cloud preview got (or lost) its vote link */
  onShared?: (shareId: string | null) => void;
  /** "I got it done": the date the tattoo was made */
  onDone?: (date: string) => void;
  /** removal-only preview: also run the aging stages */
  onAging?: () => void;
  /** try the same design on another body area (new photo of that spot) */
  onTryPlace?: (placement: string) => void;
}) {
  const { ui, me, openAuth, toast } = useApp();
  const t = (en: string, hu: string) => tx(ui.lang, en, hu);
  const img = preview.images;
  const rem = preview.removal || {};
  const report = preview.report;
  const ready = STAGES.filter((k) => img[k]);
  /** the person's own tattoo (aging or removal), not a new design */
  const own = preview.mode === 'existing' || preview.mode === 'removal';
  const [pos, setPos] = useState(0); // continuous position along the ready stages
  const [view, setView] = useState<'aging' | 'removal'>(startView);
  const [remKey, setRemKey] = useState<'fresh' | RemovalKey>('fresh');
  const [mode, setMode] = useState<'view' | 'split'>('view');
  const [split, setSplit] = useState(50);
  const [zoom, setZoom] = useState(false);
  useScrollLock(!!zoom);
  const [video, setVideo] = useState(false);
  const [care, setCare] = useState(false);
  const [pollOpen, setPollOpen] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [notes, setNotes] = useState(preview.notes || '');
  const [closeup, setCloseup] = useState(false);
  const [redoOpen, setRedoOpen] = useState(false);
  const [why, setWhy] = useState<string[]>([]);
  const [cardBusy, setCardBusy] = useState(false);
  const [pubOpen, setPubOpen] = useState(false);
  const [pubOk, setPubOk] = useState(false);
  const [caption, setCaption] = useState('');
  const [pubBusy, setPubBusy] = useState(false);
  const [linksTick, setLinksTick] = useState(0);
  // share to Explore: only with consent, and only after a person has reviewed it
  const publish = async () => {
    if (!img.fresh || !img.y50) return;
    setPubBusy(true);
    try {
      const sid = await linkFor();
      const { data } = (await sb()?.rpc('submit_post', { p_share: sid, p_caption: caption, p_anon: anonId() })) || {};
      if (!data) throw new Error('limit');
      lsSet('ink_posts', [sid, ...lsGet<string[]>('ink_posts', []).filter((x) => x !== sid)].slice(0, 50));
      setLinksTick((n) => n + 1);
      track('community_submit');
      setPubOpen(false);
      toast(t('Sent! It appears in Explore after a quick review.', 'Elküldve! Rövid ellenőrzés után megjelenik a Felfedezésben.'));
    } catch {
      toast(t('Could not send it. Try again later.', 'Nem sikerült elküldeni. Próbáld újra később.'));
    }
    setPubBusy(false);
  };
  // zoom into the tattoo itself
  const f = preview.focus;
  const zk = f ? Math.min(3.2, Math.max(1.6, 0.5 / Math.max(0.08, f.w))) : 2;
  // move the tattoo to the middle and scale up, without showing empty edges
  const zs: React.CSSProperties | undefined = (() => {
    if (!closeup || !f) return undefined;
    const tx = Math.min(0, Math.max(1 - zk, 0.5 - f.x * zk)) * 100;
    const ty = Math.min(0, Math.max(1 - zk, 0.5 - f.y * zk)) * 100;
    return { transformOrigin: '0 0', transform: `translate(${tx}%, ${ty}%) scale(${zk})` };
  })();
  const touch = useRef<number | null>(null);
  const played = useRef(false);
  const label = (k: StageKey) => (k === 'fresh' && own ? t('Today', 'Ma') : ui.t(`stage.${k}` as any));
  const remLabel = (k: 'fresh' | RemovalKey) => (k === 'fresh' ? t('Today', 'Ma') : t(`${k.slice(5)} sessions`, `${k.slice(5)} kezelés`));

  // keep the position inside the available range
  const maxPos = Math.max(0, ready.length - 1);
  const p = Math.min(pos, maxPos);
  const lo = Math.floor(p);
  const frac = p - lo;
  const active: StageKey = ready[Math.round(p)] || 'fresh';
  const yearsNow = ready.length ? Math.round(YEARS[ready[lo]] + (ready[lo + 1] ? (YEARS[ready[lo + 1]] - YEARS[ready[lo]]) * frac : 0)) : 0;

  // Wow moment: when all five images are in for the first time, play the 50 years once.
  useEffect(() => {
    if (!reveal || played.current || ready.length < 5) return;
    played.current = true;
    const start = performance.now() + 500;
    const dur = 3600;
    let raf = 0;
    let lastIdx = -1;
    const tick = (now: number) => {
      const k = Math.min(1, Math.max(0, (now - start) / dur));
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      const v = e * 4;
      setPos(v);
      if (Math.floor(v) !== lastIdx) {
        lastIdx = Math.floor(v);
        haptic();
      }
      if (k < 1) raf = requestAnimationFrame(tick);
      else haptic('success');
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reveal, ready.length]);

  useEffect(() => setNotes(preview.notes || ''), [preview.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // a removal-only preview opens on the laser sessions
  const removalOnly = ready.length <= 1 && pending.length === 0 && (REMOVAL_STAGES.some((k) => rem[k]) || removalPending.length > 0 || preview.mode === 'removal');
  useEffect(() => {
    if (removalOnly && view !== 'removal') setView('removal');
  }, [removalOnly]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (view === 'removal') {
      const last = [...REMOVAL_STAGES].reverse().find((k) => rem[k]);
      if (last && remKey === 'fresh') setRemKey(last);
    }
  }, [rem.laser3, rem.laser6, rem.laser10]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeSrc = view === 'removal' ? (remKey === 'fresh' ? img.fresh : rem[remKey]) : img[active];
  const activeName = view === 'removal' ? remLabel(remKey) : label(active);

  const step = (dir: 1 | -1) => {
    const n = Math.min(maxPos, Math.max(0, Math.round(p) + dir));
    if (n !== Math.round(p)) {
      setPos(n);
      haptic();
    }
  };

  const saveImage = async () => {
    if (!activeSrc) return;
    track('save_image', { stage: view === 'removal' ? remKey : active });
    await shareOrDownload(await toBlob(activeSrc), `inkage-${view === 'removal' ? remKey : active}.jpg`);
  };

  const pdf = async () => {
    setPdfBusy(true);
    try {
      const blob = await artistPdf(preview, ui.lang, placeName(preview.placement, ui.lang));
      track('artist_pdf');
      await shareOrDownload(blob, 'inkage-tetovalas-terv.pdf');
    } catch (e) {
      console.warn(e);
      toast(t('Could not create the PDF. Try again.', 'Nem sikerült a PDF. Próbáld újra.'));
    }
    setPdfBusy(false);
  };

  const shareLink = async (id: string) => {
    const url = `${location.origin}/v/${id}`;
    track('share_link', { id });
    const nav: any = navigator;
    const text = t('Should I get this tattoo? Here’s how it looks in 50 years 👀', 'Csináltassam meg ezt a tetoválást? Így néz ki 50 év múlva 👀');
    if (nav.share) await nav.share({ url, title: 'InkAge', text }).catch(() => {});
    else {
      await navigator.clipboard.writeText(url);
      toast(t('Link copied — send it to your friends', 'Link másolva – küldd el a barátaidnak'));
    }
  };
  /** The vote link for this preview: reuse it if there is one, otherwise make it. */
  const linkFor = async (): Promise<string> => {
    if (!img.y50 || !img.fresh) throw new Error(t('Wait for the 50-year image first.', 'Várd meg az 50 éves képet.'));
    if (preview.share_id) return preview.share_id;
    // a link made earlier on this device (guest kind only; it may have been closed meanwhile)
    const mine = preview.source === 'cloud' && me.user ? null : shares.forPreview(preview.id).find((x) => x.kind === 'guest');
    if (mine) {
      const { data } = (await sb()?.rpc('get_share', { p_share: mine.id })) || {};
      if (data) return mine.id;
      shares.drop(mine.id);
    }
    if (me.user && preview.source === 'cloud') {
      const id = await cloud.share(me.user.id, preview);
      onShared?.(id);
      shares.add({ id, at: new Date().toISOString(), label: placeName(preview.placement, ui.lang), previewId: preview.id, kind: 'preview' });
      return id;
    }
    // no account needed: the link keeps two small images
    const [fresh, y50] = await Promise.all([smallJpeg(img.fresh), smallJpeg(img.y50)]);
    const r = await api<{ id?: string; error?: string }>('/api/guest-share', { fresh, y50, placement: preview.placement, score: preview.score });
    if (!r.ok || !r.data.id) throw new Error(r.data?.error || t('Sharing failed. Try again.', 'A megosztás nem sikerült. Próbáld újra.'));
    shares.add({ id: r.data.id, at: new Date().toISOString(), label: placeName(preview.placement, ui.lang), previewId: preview.id, kind: 'guest' });
    return r.data.id;
  };

  const card = async () => {
    if (!img.fresh || !img.y50) return;
    setCardBusy(true);
    try {
      const blob = await makeCard(img.fresh, img.y50, {
        title: t('Fresh vs. 50 years', 'Friss vs. 50 év múlva'),
        left: own ? t('Today', 'Ma') : t('Fresh', 'Friss'),
        right: t('50 years', '50 év'),
        score: preview.score != null ? t(`Aging score ${preview.score}/100`, `Öregedési pontszám ${preview.score}/100`) : null,
      });
      track('card_made');
      await shareOrDownload(blob, 'inkage-friss-vs-50-ev.jpg');
    } catch {
      toast(t('Could not make the picture. Try again.', 'Nem sikerült a kép. Próbáld újra.'));
    }
    setCardBusy(false);
  };

  const scoreColor = report ? (report.score >= 75 ? '#1f8a5b' : report.score >= 55 ? '#d68a1f' : 'var(--fresh)') : 'var(--violet)';
  const suggestCm = preview.sizeCm && preview.sizeCm < 8 && !own ? Math.ceil(Math.max(8, preview.sizeCm * 1.4)) : null;
  const remCount = REMOVAL_STAGES.filter((k) => rem[k]).length;

  return (
    <div className="result-grid">
      <div className="col-a">
      {(remCount > 0 || removalPending.length > 0) && (ready.length > 1 || pending.length > 0) && (
        <div className="seg viewseg" role="tablist">
          <button role="tab" aria-selected={view === 'aging'} className={view === 'aging' ? 'on' : ''} onClick={() => setView('aging')}>
            {t('Aging', 'Öregedés')}
          </button>
          <button role="tab" aria-selected={view === 'removal'} className={view === 'removal' ? 'on' : ''} onClick={() => setView('removal')}>
            {t('Laser removal', 'Lézeres eltávolítás')}
          </button>
        </div>
      )}

      {view === 'removal' && (
        <div className="rm-banner" role="status">
          <span className="rm-banner-ico" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2v6M12 16v6M2 12h6M16 12h6M5 5l3 3M16 16l3 3M19 5l-3 3M8 16l-3 3" /><circle cx="12" cy="12" r="2.5" /></svg>
          </span>
          <div>
            <b>{t('Laser removal preview', 'Lézeres eltávolítás előnézete')}</b>
            <small>{removalPending.length > 0 ? t('Simulating 3, 6 and 10 sessions – about a minute', '3, 6 és 10 kezelés szimulálása – kb. egy perc') : t('How it would fade after 3, 6 and 10 laser sessions', 'Így halványulna 3, 6 és 10 lézeres kezelés után')}</small>
          </div>
          {ready.length > 1 && (
            <button className="chipbtn" onClick={() => (setView('aging'), window.scrollTo({ top: 0, behavior: 'smooth' }))}>
              {t('Back to aging', 'Vissza az öregedéshez')}
            </button>
          )}
        </div>
      )}

      <div
        className="res-viewer"
        onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touch.current === null || mode === 'split' || view === 'removal') return;
          const dx = e.changedTouches[0].clientX - touch.current;
          if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
          touch.current = null;
        }}
      >
        {view === 'removal' ? (
          <>
            {img.fresh && <img src={img.fresh} alt={remLabel('fresh')} className="zoomable" style={zs} />}
            {REMOVAL_STAGES.map((k) => (rem[k] ? <img key={k} className="layer zoomable" src={rem[k]} alt={k === remKey ? remLabel(k) : ''} style={{ opacity: remKey === k ? 1 : 0, ...zs }} /> : null))}
            <div className="stamp">
              <span>{remKey === 'fresh' ? t('NOW', 'MA') : remKey.slice(5)}</span>
              <small>{remKey === 'fresh' ? t('before laser', 'lézer előtt') : t('laser sessions', 'lézeres kezelés')}</small>
            </div>
            {removalPending.length > 0 && (
              <div className="res-pending" role="status">
                <i className="needle" />
                {t(`Simulating laser sessions… ${3 - removalPending.length}/3`, `Lézeres kezelések szimulálása… ${3 - removalPending.length}/3`)}
              </div>
            )}
          </>
        ) : mode === 'view' || !img.fresh ? (
          <>
            {img.fresh ? <img src={img.fresh} alt={t(`Your tattoo, ${activeName}`, `A tetoválásod, ${activeName}`)} className={`${reveal ? 'reveal' : ''} zoomable`} style={zs} /> : <div className="ph" />}
            {ready.slice(1).map((k, j) => {
              const idx = j + 1;
              const op = idx <= lo ? 1 : idx === lo + 1 ? frac : 0;
              return <img key={k} className="layer nofade zoomable" src={img[k]} alt="" style={{ opacity: op, ...zs }} />;
            })}
            <div className="stamp">
              <span>{yearsNow === 0 ? (own ? t('NOW', 'MA') : t('NEW', 'ÚJ')) : yearsNow}</span>
              <small>{yearsNow === 0 ? (own ? t('today', 'ma') : t('fresh ink', 'friss tinta')) : t(yearsNow === 1 ? 'year later' : 'years later', 'év múlva')}</small>
            </div>
          </>
        ) : (
          <div className="split">
            <img src={img.fresh} alt={label('fresh')} />
            <div className="after" style={{ clipPath: `inset(0 0 0 ${split}%)` }}>
              <img src={img[active === 'fresh' ? ready[ready.length - 1] : active]} alt={label(active)} />
            </div>
            <div className="handle" style={{ left: `${split}%` }} />
            <span className="lab" style={{ left: 12 }}>{label('fresh')}</span>
            <span className="lab" style={{ right: 12 }}>{label(active === 'fresh' ? ready[ready.length - 1] : active)}</span>
            <input
              type="range"
              aria-label={ui.t('result.compare')}
              min={0}
              max={100}
              value={split}
              onChange={(e) => setSplit(Number(e.target.value))}
              style={{ position: 'absolute', inset: 0, height: '100%', opacity: 0, cursor: 'ew-resize' }}
            />
          </div>
        )}
        <div className="res-tools">
          {f && mode === 'view' && (
            <button className={`pillbtn dark ${closeup ? 'on' : ''}`} aria-pressed={closeup} onClick={() => (setCloseup(!closeup), haptic())}>
              {closeup ? t('Whole photo', 'Teljes kép') : t('Close-up', 'Közelkép')}
            </button>
          )}
          <button className="iconbtn dark" aria-label={t('Zoom in', 'Nagyítás')} onClick={() => setZoom(true)} disabled={!activeSrc}>
            {Icon.zoom}
          </button>
          {onFavorite && (
            <button className={`iconbtn dark ${preview.favorite ? 'on' : ''}`} aria-label={t('Favorite', 'Kedvenc')} aria-pressed={preview.favorite} onClick={onFavorite}>
              {Icon.heart}
            </button>
          )}
        </div>
        {view === 'aging' && pending.length > 0 && mode === 'view' && (
          <div className="res-pending" role="status">
            <i className="needle" />
            {t(`Aging your skin… ${STAGES.length - 1 - pending.length}/4 ready`, `A bőröd öregítése… ${STAGES.length - 1 - pending.length}/4 kész`)}
          </div>
        )}
      </div>

      {view === 'aging' ? (
        <>
          {ready.length > 1 && mode === 'view' && (
            <div className="yearslider">
              <input
                type="range"
                min={0}
                max={maxPos}
                step={0.01}
                value={p}
                aria-label={t('Years from now', 'Évek múlva')}
                aria-valuetext={`${yearsNow}`}
                onChange={(e) => setPos(Number(e.target.value))}
                onPointerUp={() => haptic()}
              />
            </div>
          )}
          <div className="stagebar" role="tablist" aria-label={t('Years', 'Évek')}>
            {STAGES.map((k) => {
              const fail = failed.includes(k);
              const idx = ready.indexOf(k);
              return (
                <button
                  key={k}
                  role="tab"
                  aria-selected={active === k}
                  className={`${active === k ? 'on' : ''} ${pending.includes(k) ? 'loading' : ''}`}
                  disabled={idx < 0 && !fail}
                  onClick={() => {
                    if (fail && onRetryStage) return onRetryStage(k);
                    setPos(idx);
                    haptic();
                  }}
                >
                  {fail ? '↻' : label(k)}
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <div className="stagebar four" role="tablist" aria-label={t('Laser sessions', 'Lézeres kezelések')}>
          {(['fresh', ...REMOVAL_STAGES] as ('fresh' | RemovalKey)[]).map((k) => (
            <button
              key={k}
              role="tab"
              aria-selected={remKey === k}
              className={`${remKey === k ? 'on' : ''} ${k !== 'fresh' && removalPending.includes(k) ? 'loading' : ''}`}
              disabled={k !== 'fresh' && !rem[k]}
              onClick={() => {
                setRemKey(k);
                haptic();
              }}
            >
              {remLabel(k)}
            </button>
          ))}
        </div>
      )}

      {onRedo && view === 'aging' && img.fresh && !own && (
        <button className="redo-link" onClick={() => setRedoOpen(true)}>
          {t('Not right? Make it again', 'Nem lett jó? Újracsináljuk')}
        </button>
      )}
      {view === 'aging' && mode === 'view' && (
        <p className="why" aria-live="polite">{t(...WHY[active])}</p>
      )}
      {img.fresh && <AiReport previewId={preview.id} image={img[ready[Math.round(pos)] as StageKey] || img.fresh} />}
      {!removalOnly && onAging && view === 'aging' && ready.length <= 1 && pending.length === 0 && failed.length === 0 && img.fresh && (
        <div className="age-offer">
          <p>{t('Saved to your gallery. Want to see how it looks over the years?', 'Elmentve a galériádba. Megnézed, hogyan néz ki az évek múlásával?')}</p>
          <button className="btn wide" onClick={onAging}>
            {t('Show how it ages (1–50 years)', 'Mutasd, hogyan öregszik (1–50 év)')}
          </button>
        </div>
      )}
      {removalOnly && onAging && (
        <button className="btn ghost wide" style={{ margin: '4px 0 12px' }} onClick={onAging} disabled={removalPending.length > 0}>
          {t('Also show how it ages over 50 years', 'Az öregedését is megnézem 50 évre')}
        </button>
      )}
      <div className="actgrid">
        <button className="act primary" onClick={() => setVideo(true)} disabled={ready.length < 2}>
          {Icon.video}
          {t('Video', 'Videó')}
        </button>
        <button className="act" onClick={() => setPollOpen(true)} disabled={!img.fresh}>
          {Icon.share}
          {t('Ask friends', 'Kérdezd meg')}
        </button>
        <button className="act" onClick={() => setMode(mode === 'split' ? 'view' : 'split')} disabled={ready.length < 2 || view === 'removal'} aria-pressed={mode === 'split'}>
          <svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M12 3v18" /></svg>
          {mode === 'split' ? t('Single', 'Egy kép') : t('Compare', 'Összevet')}
        </button>
        <button className="act" onClick={saveImage} disabled={!activeSrc}>
          {Icon.download}
          {t('Save', 'Mentés')}
        </button>
      </div>

      </div>
      <div className="col-b">
      {(onImprove || (suggestCm && onResize)) && !own && report && report.score < 85 && (
        <div className="card fixcard">
          <h2>{t('Make it last', 'Tedd tartóssá')}</h2>
          <p className="muted">
            {t(
              'We can redraw your design the way an experienced artist would — bolder key lines, fewer tiny details — and show you how that version ages.',
              'Átrajzoljuk a mintádat úgy, ahogy egy tapasztalt tetováló tenné – erősebb fő vonalak, kevesebb apró részlet –, és megmutatjuk, hogyan öregszik az a változat.'
            )}
          </p>
          <div className="stack">
            {onImprove && (
              <button className="btn wide" onClick={onImprove} disabled={improving || pending.length > 0}>
                {improving ? t('Redrawing your design…', 'A minta átrajzolása…') : t('Redraw it to last', 'Rajzold át tartósra')}
              </button>
            )}
            {suggestCm && onResize && (
              <button className="btn ghost wide" onClick={() => onResize(suggestCm)} disabled={pending.length > 0}>
                {t(`Try it at ${suggestCm} cm`, `Próbáld ki ${suggestCm} cm-esen`)}
              </button>
            )}
          </div>
        </div>
      )}

      {report && (
        <div className="card">
          <div className="score-head">
            <div className="score-ring" style={{ ['--v' as any]: report.score, ['--c' as any]: scoreColor }}>
              <span>{report.score}</span>
              <small>/100</small>
            </div>
            <div>
              <h2>{ui.t('result.score')}</h2>
              <p>
                {report.score >= 75
                  ? t('This should age well.', 'Ez jól fog öregedni.')
                  : report.score >= 55
                    ? t('Good, with a few things to watch.', 'Jó, de van pár dolog, amire figyelj.')
                    : t('Likely to blur or fade a lot.', 'Valószínűleg sokat mosódik vagy fakul.')}
              </p>
            </div>
          </div>
          <ul className="factors">
            {report.factors.slice(0, 5).map((f) => (
              <li key={f.label} className={f.impact < 0 ? 'neg' : 'pos'}>
                <b>{f.impact > 0 ? `+${f.impact}` : f.impact}</b> {f.label}
              </li>
            ))}
          </ul>
          {report.input && !own && (() => {
            const here = preview.placement.toLowerCase();
            const alts = OTHER_SPOTS.filter(([v]) => !here.includes(v.toLowerCase().split(' ').pop()!))
              .map(([v, en, hu]) => ({ v, en, hu, score: longevity({ ...report.input!, placement: v }, ui.lang).score }))
              .sort((a, b) => b.score - a.score)
              .slice(0, 5);
            return (
              <div className="elsewhere">
                <b>{t('The same design elsewhere', 'Ugyanez a minta máshol')}</b>
                {onTryPlace && <p className="small muted" style={{ margin: '2px 0 0' }}>{t('Tap a spot to see it there for real.', 'Koppints egy helyre, és megnézzük ott is, valódi képpel.')}</p>}
                <div>
                  {alts.map((a) =>
                    onTryPlace ? (
                      <button key={a.en} className={`elsebtn ${a.score > report.score ? 'up' : a.score < report.score ? 'down' : ''}`} onClick={() => onTryPlace(a.v)} title={t('Try it there with a photo of that spot', 'Próbáld ki ott – egy fotó kell arról a helyről')}>
                        {t(a.en, a.hu)} <b>{a.score}</b>
                      </button>
                    ) : (
                      <span key={a.en} className={a.score > report.score ? 'up' : a.score < report.score ? 'down' : ''}>
                        {t(a.en, a.hu)} <b>{a.score}</b>
                      </span>
                    )
                  )}
                </div>
              </div>
            );
          })()}
          {report.suggestions.map((s) => (
            <div className="tipcard" key={s} style={{ marginBottom: 8 }}>
              <b>{t('Suggestion', 'Javaslat')}</b>
              <p>{s}</p>
            </div>
          ))}
          <h3 style={{ marginTop: 14 }}>{ui.t('result.tips')}</h3>
          <ul style={{ margin: 0, paddingLeft: 20, color: 'var(--ink-2)' }}>
            {report.tips.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      {onNotes && (
        <div className="card" style={{ marginTop: 12 }}>
          <h3>{ui.t('result.notes')}</h3>
          <textarea
            className="notes"
            id="notes"
            placeholder={t('e.g. 8 cm, thicker outline, inner left forearm', 'pl. 8 cm, vastagabb kontúr, bal belső alkar')}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => notes !== (preview.notes || '') && onNotes(notes)}
          />
        </div>
      )}

      <LinksPanel preview={preview} tick={linksTick} onShared={onShared} />
      <PollSheet
        open={pollOpen}
        onClose={() => {
          setPollOpen(false);
          setLinksTick((n) => n + 1);
        }}
        initial={[preview]}
      />

      <div className="card toolcard" style={{ marginTop: 12 }}>
        <h3>{t('Next steps', 'Következő lépések')}</h3>
        <button className="list-row" onClick={pdf} disabled={pdfBusy || !img.fresh}>
          <span>
            {pdfBusy ? t('Making the PDF…', 'PDF készül…') : t('PDF for your tattoo artist', 'PDF a tetoválódnak')}
            <small>{t('Design, size, placement, previews and notes on one page', 'Minta, méret, hely, előnézetek és jegyzetek egy oldalon')}</small>
          </span>
          <span aria-hidden="true">›</span>
        </button>
        <button className="list-row" onClick={card} disabled={cardBusy || !img.y50}>
          <span>
            {cardBusy ? t('Making the picture…', 'Kép készül…') : t('“Fresh vs. 50 years” picture', '„Friss vs. 50 év” kép')}
            <small>{t('Side by side, ready for Instagram and TikTok', 'Egymás mellett, kész Instagramra és TikTokra')}</small>
          </span>
          <span aria-hidden="true">›</span>
        </button>
        {onRemoval && (
          <button
            className="list-row"
            onClick={() => {
              setView('removal');
              haptic();
              // jump to the top so the laser preview is the first thing you see
              window.scrollTo({ top: 0, behavior: 'smooth' });
              if (!remCount && !removalPending.length) onRemoval();
            }}
            disabled={!img.fresh || pending.length > 0}
          >
            <span>
              {t('What if you regret it? Laser removal preview', 'Mi van, ha megbánod? Lézeres eltávolítás')}
              <small>{t('How it would look after 3, 6 and 10 laser sessions', 'Így nézne ki 3, 6 és 10 lézeres kezelés után')}</small>
            </span>
            <span aria-hidden="true">›</span>
          </button>
        )}
        <button className="list-row" onClick={() => setPubOpen(true)} disabled={!img.y50}>
          <span>
            {t('Share it in Explore', 'Megosztás a Felfedezésben')}
            <small>{t('Let others vote on it — reviewed by a person first', 'Mások is szavazhatnak rá – előtte egy ember átnézi')}</small>
          </span>
          <span aria-hidden="true">›</span>
        </button>
        <button className="list-row" onClick={() => setCare(true)}>
          <span>
            {t('I got it done – healing plan', 'Megcsináltattam – gyógyulási terv')}
            <small>{t('28-day aftercare reminders in your calendar', '28 napos ápolási emlékeztetők a naptáradba')}</small>
          </span>
          <span aria-hidden="true">›</span>
        </button>
      </div>

      {onNew && (
        <button className="btn wide dark" style={{ marginTop: 16 }} onClick={onNew}>
          {ui.t('result.new')}
        </button>
      )}

      <p className="disclaimer">
        {t(
          'AI simulation for inspiration. Real results depend on your artist, your skin and aftercare.',
          'MI-szimuláció inspirációnak. A valós eredmény a tetoválótól, a bőrödtől és az utókezeléstől függ.'
        )}
      </p>

      {zoom && activeSrc && (
        <div className="zoomview" role="dialog" aria-modal="true" aria-label={t('Zoomed image', 'Nagyított kép')} onClick={() => setZoom(false)}>
          <img src={activeSrc} alt={activeName} />
          <button className="iconbtn dark" aria-label={ui.t('common.close')} onClick={() => setZoom(false)}>
            {Icon.close}
          </button>
        </div>
      )}


      </div>
      <VideoSheet open={video} onClose={() => setVideo(false)} preview={preview} />
      <CareSheet open={care} onClose={() => setCare(false)} onDone={onDone} />
      <Sheet open={pubOpen} onClose={() => setPubOpen(false)} label={t('Share in Explore', 'Megosztás a Felfedezésben')}>
        <h2>{t('Share in Explore', 'Megosztás a Felfedezésben')}</h2>
        <p className="sub">{t('Your fresh and 50-year images appear in the community feed, where anyone can vote. No name or account is shown.', 'A friss és az 50 éves képed megjelenik a közösségi falon, ahol bárki szavazhat rá. Nevet vagy fiókot nem mutatunk.')}</p>
        <input className="text" id="post-caption" maxLength={120} placeholder={t('Caption (optional), e.g. my first tattoo idea', 'Felirat (nem kötelező), pl. az első tetoválás-ötletem')} value={caption} onChange={(e) => setCaption(e.target.value)} />
        <label className="consent">
          <input type="checkbox" checked={pubOk} onChange={(e) => setPubOk(e.target.checked)} />
          <span>{t('The photo is of me, I’m over 18, no face or private details are visible, and I have the right to the design.', 'A fotón én vagyok, elmúltam 18, nem látszik arc vagy személyes adat, és jogom van a mintához.')}</span>
        </label>
        <button className="btn wide" disabled={!pubOk || pubBusy} onClick={publish}>
          {pubBusy ? '…' : t('Send for review', 'Küldés ellenőrzésre')}
        </button>
      </Sheet>
      {onRedo && (
        <Sheet open={redoOpen} onClose={() => setRedoOpen(false)} label={t('Not right?', 'Nem lett jó?')}>
          <h2>{t('What went wrong?', 'Mi nem jó?')}</h2>
          <p className="sub">{t('Tick what you see — the next try avoids exactly that.', 'Jelöld be, amit látsz – az új próbálkozás pont ezt kerüli el.')}</p>
          <div className="checklist">
            {REDO_REASONS.map(([k, en, hu]) => (
              <label key={k} className={why.includes(k) ? 'on' : ''}>
                <input type="checkbox" checked={why.includes(k)} onChange={() => setWhy(why.includes(k) ? why.filter((x) => x !== k) : [...why, k])} />
                <span>{t(en, hu)}</span>
              </label>
            ))}
          </div>
          <button
            className="btn wide"
            disabled={!why.length}
            onClick={() => {
              setRedoOpen(false);
              track('redo', { why: why.join(',') });
              onRedo(why);
              setWhy([]);
            }}
          >
            {t('Make it again', 'Készítsd el újra')}
          </button>
          <p className="fine">{t('Your feedback also helps us improve InkAge.', 'A visszajelzésed az InkAge fejlesztését is segíti.')}</p>
        </Sheet>
      )}
    </div>
  );
}

function CareSheet({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone?: (date: string) => void }) {
  const { ui, toast, me } = useApp();
  const t = (en: string, hu: string) => tx(ui.lang, en, hu);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  return (
    <Sheet open={open} onClose={onClose} label={t('Healing plan', 'Gyógyulási terv')}>
      <h2>{t('Healing plan', 'Gyógyulási terv')}</h2>
      <p className="sub">{t('When did you get it?', 'Mikor készült?')}</p>
      <input id="care-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      <ol className="care-list">
        {CARE.map((s) => (
          <li key={s.day}>
            <b>{t(`Day ${s.day}`, `${s.day}. nap`)}</b> {t(s.en, s.hu)}
          </li>
        ))}
      </ol>
      <button
        className="btn wide"
        onClick={async () => {
          track('aftercare_ics');
          onDone?.(new Date(date + 'T12:00:00').toISOString());
          await shareOrDownload(aftercareIcs(new Date(date + 'T09:00:00'), ui.lang), 'inkage-gyogyulas.ics');
          toast(t('Open the file to add the reminders to your calendar', 'Nyisd meg a fájlt, és bekerülnek az emlékeztetők a naptáradba'));
          if (me?.user) {
            // phone reminders too, after the calendar file (never blocks it)
            // only when notifications are already on (Profile > Settings); no surprise permission prompt here
            const native = !!(window as any).Capacitor?.isNativePlatform?.();
            const st = await (native ? import('@/lib/native').then((m) => m.nativePushState()) : import('@/lib/push').then((m) => m.pushState())).catch(() => 'off');
            if (st === 'on') {
              const n = await import('@/lib/push').then((m) =>
                m.scheduleCare(date, CARE.map((s) => ({ day: s.day, text: t(s.en, s.hu) })), (d) => t(`Healing plan · day ${d}`, `Gyógyulási terv · ${d}. nap`))
              );
              if (n > 0) toast(t(`${n} reminders will also arrive on your phone`, `${n} emlékeztető a telefonodra is megérkezik`));
            }
          }
        }}
      >
        {t('Add reminders to my calendar', 'Emlékeztetők a naptáramba')}
      </button>
      <p className="fine">{t('General aftercare tips, not medical advice. Follow your tattoo artist’s instructions, and see a doctor if you notice signs of infection.', 'Általános utókezelési tippek, nem orvosi tanács. Kövesd a tetoválód utasításait, és fordulj orvoshoz, ha fertőzés jeleit látod.')}</p>
      <p className="fine">{t('General aftercare information, not medical advice. Follow your artist’s instructions.', 'Általános ápolási tájékoztató, nem orvosi tanács. Kövesd a tetoválód utasításait.')}</p>
    </Sheet>
  );
}

export function VideoSheet({ open, onClose, preview }: { open: boolean; onClose: () => void; preview: Preview }) {
  const { ui } = useApp();
  const t = (en: string, hu: string) => tx(ui.lang, en, hu);
  const [tpl, setTpl] = useState<Template>('timelapse');
  const [hook, setHook] = useState(0);
  const [prog, setProg] = useState<number | null>(null);
  const [out, setOut] = useState<{ url: string; blob: Blob; ext: string } | null>(null);
  const [err, setErr] = useState('');
  const hooks = pick(HOOKS, ui.lang);
  const [canVideo, setCanVideo] = useState(true);
  const [slidesBusy, setSlidesBusy] = useState(false);
  useEffect(() => setCanVideo(canRecordVideo()), []);
  // still images instead of a video (TikTok / Instagram photo mode, or browsers that can't record)
  const slides = async () => {
    setSlidesBusy(true);
    try {
      const blobs = await photoSlides(frames, { hook: hooks[hook], watermark: 'made with InkAge' });
      const files = blobs.map((b, i) => new File([b], `inkage-${i + 1}.jpg`, { type: 'image/jpeg' }));
      const nav: any = navigator;
      if (nav.canShare?.({ files })) await nav.share({ files, title: 'InkAge' }).catch(() => {});
      else for (const f of files) await shareOrDownload(f, f.name);
      track('slides_made', { n: files.length });
    } catch {
      setErr(t('Could not make the images. Try again.', 'Nem sikerültek a képek. Próbáld újra.'));
    }
    setSlidesBusy(false);
  };

  const frames = useMemo(
    () => STAGES.filter((k) => preview.images[k]).map((k) => ({ label: ui.t(`stage.${k}` as any), src: preview.images[k]! })),
    [preview.images, ui]
  );

  useEffect(() => {
    if (!open) {
      setOut(null);
      setProg(null);
      setErr('');
    }
  }, [open]);

  const render = async () => {
    setErr('');
    setOut(null);
    setProg(0);
    try {
      const r = await makeVideo(frames, {
        template: tpl,
        hook: tpl === 'poll' ? t('Would you still get it?', 'Így is megcsináltatnád?') : hooks[hook],
        watermark: 'made with InkAge',
        yes: tpl === 'countdown' ? t('years later', 'év múlva') : t('YES', 'IGEN'),
        no: t('NO', 'NEM'),
        onProgress: setProg,
      });
      setOut({ url: URL.createObjectURL(r.blob), blob: r.blob, ext: r.ext });
      track('video_made', { tpl });
      haptic('success');
    } catch (e: any) {
      setErr(e?.message || t('Video failed. Try again.', 'A videó nem sikerült. Próbáld újra.'));
    }
    setProg(null);
  };

  return (
    <Sheet open={open} onClose={onClose} label={t('Make a video', 'Videó készítése')}>
      <h2>{t('Make a video', 'Videó készítése')}</h2>
      <p className="sub">{t('Vertical, ready for TikTok, Reels and Shorts.', 'Álló formátum, kész TikTokra, Reelsre, Shortsra.')}</p>
      <div className="tpl" role="radiogroup">
        {(
          [
            ['timelapse', t('Time-lapse', 'Időutazás'), t('all 5 stages', 'mind az 5 kép')],
            ['wipe', t('Before / after', 'Előtte / utána'), t('swipe reveal', 'áttűnés')],
            ['poll', t('Poll', 'Szavazás'), t('“would you?”', '„megcsinálnád?”')],
            ['slideshow', t('Slideshow', 'Diavetítés'), t('photo-mode look', 'TikTok fotó-mód')],
            ['countdown', t('Year counter', 'Évszámláló'), t('0 → 50 years', '0 → 50 év')],
          ] as [Template, string, string][]
        ).map(([k, n, s]) => (
          <button key={k} role="radio" aria-checked={tpl === k} className={tpl === k ? 'on' : ''} onClick={() => setTpl(k)}>
            {n}
            <small>{s}</small>
          </button>
        ))}
      </div>
      {tpl !== 'poll' && (
        <div className="hooks" role="radiogroup" aria-label={t('Caption', 'Felirat')}>
          {hooks.map((h, i) => (
            <button key={h} role="radio" aria-checked={hook === i} className={hook === i ? 'on' : ''} onClick={() => setHook(i)}>
              {h}
            </button>
          ))}
        </div>
      )}
      {prog !== null ? (
        <div className="bar light" aria-label={t('Rendering', 'Készül')}>
          <i style={{ width: `${Math.round(prog * 100)}%` }} />
        </div>
      ) : out ? (
        <div className="vidout">
          <video src={out.url} controls playsInline autoPlay muted loop />
          <button className="btn wide" onClick={() => shareOrDownload(out.blob, `inkage-${tpl}.${out.ext}`)}>
            {Icon.download} {t('Save / share video', 'Videó mentése / megosztása')}
          </button>
          <button className="btn ghost wide" onClick={render}>
            {t('Render again', 'Újra')}
          </button>
        </div>
      ) : canVideo ? (
        <button className="btn wide" onClick={render} disabled={frames.length < 2}>
          {t('Create video', 'Videó készítése')}
        </button>
      ) : (
        <p className="sub">{t('This browser can’t record video — save the images instead and post them in photo mode.', 'Ez a böngésző nem tud videót rögzíteni – mentsd el helyette a képeket, és fotó módban posztold őket.')}</p>
      )}
      <button className={`btn wide ${canVideo ? 'ghost' : ''}`} style={{ marginTop: 8 }} onClick={slides} disabled={slidesBusy || frames.length < 2}>
        {slidesBusy ? t('Making images…', 'Képek készülnek…') : t('Save as photo slides', 'Mentés képsorként (fotó mód)')}
      </button>
      {err && <p className="err">{err}</p>}
    </Sheet>
  );
}

type ShareInfo = { votes?: { yes: number; no: number; change: number } } | null;

/** The preview's vote links: results, Explore status, copy and close. */
function LinksPanel({ preview, tick, onShared }: { preview: Preview; tick: number; onShared?: (id: string | null) => void }) {
  const { ui, me, toast } = useApp();
  const t = (en: string, hu: string) => tx(ui.lang, en, hu);
  const ids = useMemo(
    () => Array.from(new Set([preview.share_id, ...shares.forPreview(preview.id).map((x) => x.id)].filter(Boolean) as string[])),
    [preview.id, preview.share_id, tick] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const [info, setInfo] = useState<Record<string, ShareInfo>>({});
  const [posts, setPosts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState('');
  useEffect(() => {
    if (!ids.length) return;
    const s = sb();
    if (!s) return;
    let live = true;
    Promise.all(ids.map((id) => s.rpc(id.startsWith('p') ? 'get_poll' : 'get_share', { p_share: id }).then((r) => [id, r.data as ShareInfo] as const))).then((rows) => live && setInfo(Object.fromEntries(rows)));
    s.rpc('post_status', { p_shares: ids.filter((id) => !id.startsWith('p')) }).then((r) => live && setPosts((r.data as any) || {}));
    return () => {
      live = false;
    };
  }, [ids.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps
  const shown = ids.filter((id) => info[id] !== null);
  if (!shown.length) return null;
  const close = async (id: string) => {
    setBusy(id);
    try {
      if (id.startsWith('p')) {
        if (!(await closePoll(id))) throw new Error();
        shares.drop(id);
      } else if (id === preview.share_id && me.user && preview.source === 'cloud') {
        await cloud.unshare(me.user.id, preview.id);
        shares.drop(id);
        onShared?.(null);
      } else if (!(await revokeGuestShare(id))) throw new Error();
      setInfo((m) => ({ ...m, [id]: null }));
      toast(t('Link closed — it no longer opens', 'Link lezárva – már nem nyitható meg'));
    } catch {
      toast(t('Could not close the link. Try again.', 'Nem sikerült lezárni a linket. Próbáld újra.'));
    }
    setBusy('');
  };
  const withdraw = async (id: string) => {
    setBusy(id);
    const { data } = (await sb()?.rpc('withdraw_post', { p_share: id, p_anon: anonId() })) || {};
    if (data) setPosts((m) => ({ ...m, [id]: 'withdrawn' }));
    toast(data ? t('Removed from Explore', 'Eltávolítva a Felfedezésből') : t('Could not remove it. Try again.', 'Nem sikerült eltávolítani. Próbáld újra.'));
    setBusy('');
  };
  const postLabel = (st?: string) =>
    st === 'pending' ? t('Explore: waiting for review', 'Felfedezés: ellenőrzésre vár') : st === 'approved' ? t('Explore: live', 'Felfedezés: kint van') : st === 'rejected' ? t('Explore: not approved', 'Felfedezés: nem került ki') : null;
  return (
    <div className="card links-card" style={{ marginTop: 12 }}>
      <h3>{t('Your vote links', 'Szavazós linkjeid')}</h3>
      {shown.map((id) => {
        const v = info[id]?.votes;
        const total = v ? v.yes + v.no + v.change : 0;
        const pl = postLabel(posts[id]);
        const poll = id.startsWith('p') ? (info[id] as unknown as PollData | undefined) : undefined;
        return (
          <div key={id} className="link-row">
            {poll && (
              <>
                <b>{poll.question}</b>
                <PollResults poll={poll} lang={ui.lang} />
                <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                  <a className="chipbtn" href={`/v/${id}`} target="_blank" rel="noreferrer">
                    {t('Open', 'Megnyitás')}
                  </a>
                  <button
                    className="chipbtn"
                    onClick={async () => {
                      await navigator.clipboard.writeText(`${location.origin}/v/${id}`).catch(() => {});
                      toast(t('Link copied', 'Link másolva'));
                    }}
                  >
                    {t('Copy link', 'Link másolása')}
                  </button>
                  <button className="chipbtn" disabled={busy === id} onClick={() => close(id)}>
                    {t('Close link', 'Link lezárása')}
                  </button>
                </div>
              </>
            )}
            {!poll && (<>
            <div className="link-votes">
              {v ? (
                <>
                  <span className="yes">👍 {v.yes}</span>
                  <span className="no">👎 {v.no}</span>
                  <span className="chg">✏️ {v.change}</span>
                </>
              ) : (
                <span className="muted small">…</span>
              )}
            </div>
            <p className="muted small" style={{ margin: '4px 0 8px' }}>
              {total ? t(`${total} vote${total === 1 ? '' : 's'} so far`, `Eddig ${total} szavazat`) : t('No votes yet', 'Még nincs szavazat')}
              {pl ? ` · ${pl}` : ''}
            </p>
            <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
              <button
                className="chipbtn"
                onClick={async () => {
                  await navigator.clipboard.writeText(`${location.origin}/v/${id}`).catch(() => {});
                  toast(t('Link copied', 'Link másolva'));
                }}
              >
                {t('Copy link', 'Link másolása')}
              </button>
              {(posts[id] === 'pending' || posts[id] === 'approved') && (
                <button className="chipbtn" disabled={busy === id} onClick={() => withdraw(id)}>
                  {t('Remove from Explore', 'Levétel a Felfedezésből')}
                </button>
              )}
              <button className="chipbtn" disabled={busy === id} onClick={() => close(id)}>
                {t('Close link', 'Link lezárása')}
              </button>
            </div>
            </>)}
          </div>
        );
      })}
    </div>
  );
}
