'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from './AppProvider';
import { Icon, Sheet } from './ui';
import { tx } from '@/lib/i18n';
import { cloud, haptic, Preview, REMOVAL_STAGES, RemovalKey, StageKey, STAGES, track } from '@/lib/store';
import { shareOrDownload } from '@/lib/client';
import { HOOKS, makeVideo, Template } from '@/lib/video';
import { artistPdf } from '@/lib/brief';
import { aftercareIcs, CARE } from '@/lib/aftercare';
import { placeName } from './create/steps';

const toBlob = async (src: string) => (await fetch(src)).blob();
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
}) {
  const { ui, me, openAuth, toast } = useApp();
  const t = (en: string, hu: string) => tx(ui.lang, en, hu);
  const img = preview.images;
  const rem = preview.removal || {};
  const report = preview.report;
  const ready = STAGES.filter((k) => img[k]);
  const [pos, setPos] = useState(0); // continuous position along the ready stages
  const [view, setView] = useState<'aging' | 'removal'>('aging');
  const [remKey, setRemKey] = useState<'fresh' | RemovalKey>('fresh');
  const [mode, setMode] = useState<'view' | 'split'>('view');
  const [split, setSplit] = useState(50);
  const [zoom, setZoom] = useState(false);
  const [video, setVideo] = useState(false);
  const [care, setCare] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [notes, setNotes] = useState(preview.notes || '');
  const touch = useRef<number | null>(null);
  const played = useRef(false);
  const label = (k: StageKey) => (k === 'fresh' && preview.mode === 'existing' ? t('Today', 'Ma') : ui.t(`stage.${k}` as any));
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

  const share = async () => {
    if (!me.user) {
      openAuth(t('Sign in to get a link your friends can vote on. Your preview moves to your account.', 'Jelentkezz be, és kapsz egy linket, amin a barátaid szavazhatnak. Az előnézeted átkerül a fiókodba.'));
      return;
    }
    if (preview.source !== 'cloud') {
      toast(t('Saving to your account… try again in a moment.', 'Mentés a fiókodba… próbáld újra egy pillanat múlva.'));
      return;
    }
    if (!img.y50) {
      toast(t('Wait for the 50-year image first.', 'Várd meg az 50 éves képet.'));
      return;
    }
    setSharing(true);
    try {
      const id = preview.share_id || (await cloud.share(me.user.id, preview));
      const url = `${location.origin}/v/${id}`;
      track('share_link', { id });
      const nav: any = navigator;
      const text = t('Should I get this tattoo? Here’s how it looks in 50 years 👀', 'Csináltassam meg ezt a tetoválást? Így néz ki 50 év múlva 👀');
      if (nav.share) await nav.share({ url, title: 'InkAge', text }).catch(() => {});
      else {
        await navigator.clipboard.writeText(url);
        toast(t('Link copied — send it to your friends', 'Link másolva – küldd el a barátaidnak'));
      }
    } catch {
      toast(t('Sharing failed. Try again.', 'A megosztás nem sikerült. Próbáld újra.'));
    }
    setSharing(false);
  };

  const scoreColor = report ? (report.score >= 75 ? '#1f8a5b' : report.score >= 55 ? '#d68a1f' : 'var(--fresh)') : 'var(--violet)';
  const suggestCm = preview.sizeCm && preview.sizeCm < 7 && preview.mode !== 'existing' ? Math.ceil(Math.max(7, preview.sizeCm * 1.4)) : null;
  const remCount = REMOVAL_STAGES.filter((k) => rem[k]).length;

  return (
    <div>
      {(remCount > 0 || removalPending.length > 0) && (
        <div className="seg viewseg" role="tablist">
          <button role="tab" aria-selected={view === 'aging'} className={view === 'aging' ? 'on' : ''} onClick={() => setView('aging')}>
            {t('Aging', 'Öregedés')}
          </button>
          <button role="tab" aria-selected={view === 'removal'} className={view === 'removal' ? 'on' : ''} onClick={() => setView('removal')}>
            {t('Laser removal', 'Lézeres eltávolítás')}
          </button>
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
            {img.fresh && <img src={img.fresh} alt={remLabel('fresh')} />}
            {REMOVAL_STAGES.map((k) => (rem[k] ? <img key={k} className="layer" src={rem[k]} alt={k === remKey ? remLabel(k) : ''} style={{ opacity: remKey === k ? 1 : 0 }} /> : null))}
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
            {img.fresh ? <img src={img.fresh} alt={t(`Your tattoo, ${activeName}`, `A tetoválásod, ${activeName}`)} className={reveal ? 'reveal' : ''} /> : <div className="ph" />}
            {ready.slice(1).map((k, j) => {
              const idx = j + 1;
              const op = idx <= lo ? 1 : idx === lo + 1 ? frac : 0;
              return <img key={k} className="layer nofade" src={img[k]} alt="" style={{ opacity: op }} />;
            })}
            <div className="stamp">
              <span>{yearsNow === 0 ? (preview.mode === 'existing' ? t('NOW', 'MA') : t('NEW', 'ÚJ')) : yearsNow}</span>
              <small>{yearsNow === 0 ? (preview.mode === 'existing' ? t('today', 'ma') : t('fresh ink', 'friss tinta')) : t(yearsNow === 1 ? 'year later' : 'years later', 'év múlva')}</small>
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

      <div className="actgrid">
        <button className="act primary" onClick={() => setVideo(true)} disabled={ready.length < 2}>
          {Icon.video}
          {t('Video', 'Videó')}
        </button>
        <button className="act" onClick={share} disabled={sharing}>
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

      {(onImprove || suggestCm) && preview.mode !== 'existing' && report && report.score < 85 && (
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

      <div className="card toolcard" style={{ marginTop: 12 }}>
        <h3>{t('Next steps', 'Következő lépések')}</h3>
        <button className="list-row" onClick={pdf} disabled={pdfBusy || !img.fresh}>
          <span>
            {pdfBusy ? t('Making the PDF…', 'PDF készül…') : t('PDF for your tattoo artist', 'PDF a tetoválódnak')}
            <small>{t('Design, size, placement, previews and notes on one page', 'Minta, méret, hely, előnézetek és jegyzetek egy oldalon')}</small>
          </span>
          <span aria-hidden="true">›</span>
        </button>
        {onRemoval && (
          <button
            className="list-row"
            onClick={() => {
              setView('removal');
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


      <VideoSheet open={video} onClose={() => setVideo(false)} preview={preview} />
      <CareSheet open={care} onClose={() => setCare(false)} />
    </div>
  );
}

function CareSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { ui, toast } = useApp();
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
          await shareOrDownload(aftercareIcs(new Date(date + 'T09:00:00'), ui.lang), 'inkage-gyogyulas.ics');
          toast(t('Open the file to add the reminders to your calendar', 'Nyisd meg a fájlt, és bekerülnek az emlékeztetők a naptáradba'));
        }}
      >
        {t('Add reminders to my calendar', 'Emlékeztetők a naptáramba')}
      </button>
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
  const hooks = HOOKS[ui.lang];

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
      ) : (
        <button className="btn wide" onClick={render} disabled={frames.length < 2}>
          {t('Create video', 'Videó készítése')}
        </button>
      )}
      {err && <p className="err">{err}</p>}
    </Sheet>
  );
}
