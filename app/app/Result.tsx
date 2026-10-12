'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from './AppProvider';
import { Icon, Sheet } from './ui';
import { tx } from '@/lib/i18n';
import { cloud, haptic, Preview, StageKey, STAGES, track } from '@/lib/store';
import { shareOrDownload } from '@/lib/client';
import { HOOKS, makeVideo, Template } from '@/lib/video';

const toBlob = async (src: string) => (await fetch(src)).blob();

export function Result({
  preview,
  pending = [],
  failed = [],
  onNotes,
  onFavorite,
  onRetryStage,
  onNew,
  reveal = false,
}: {
  preview: Preview;
  pending?: StageKey[];
  failed?: StageKey[];
  onNotes?: (s: string) => void;
  onFavorite?: () => void;
  onRetryStage?: (k: StageKey) => void;
  onNew?: () => void;
  reveal?: boolean;
}) {
  const { ui, me, openAuth, toast } = useApp();
  const t = (en: string, hu: string) => tx(ui.lang, en, hu);
  const [active, setActive] = useState<StageKey>('fresh');
  const [mode, setMode] = useState<'view' | 'split'>('view');
  const [split, setSplit] = useState(50);
  const [zoom, setZoom] = useState(false);
  const [video, setVideo] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [notes, setNotes] = useState(preview.notes || '');
  const touch = useRef<number | null>(null);
  const autoAdvanced = useRef(false);
  const img = preview.images;
  const report = preview.report;

  // When the 50-year image lands for the first time, jump to it once — that's the wow moment.
  useEffect(() => {
    if (reveal && img.y50 && !autoAdvanced.current) {
      autoAdvanced.current = true;
      setTimeout(() => {
        setActive('y50');
        haptic('success');
      }, 400);
    }
  }, [img.y50, reveal]);

  useEffect(() => setNotes(preview.notes || ''), [preview.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const ready = STAGES.filter((k) => img[k]);
  const label = (k: StageKey) => ui.t(`stage.${k}` as any);
  const step = (dir: 1 | -1) => {
    const i = ready.indexOf(active);
    const n = ready[i + dir];
    if (n) {
      setActive(n);
      haptic();
    }
  };

  const saveImage = async () => {
    const src = img[active];
    if (!src) return;
    track('save_image', { stage: active });
    await shareOrDownload(await toBlob(src), `inkage-${active}.jpg`);
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

  return (
    <div>
      <div
        className="res-viewer"
        onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touch.current === null || mode === 'split') return;
          const dx = e.changedTouches[0].clientX - touch.current;
          if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
          touch.current = null;
        }}
      >
        {mode === 'view' || !img.fresh ? (
          <>
            {img.fresh ? <img src={img.fresh} alt={t(`Your tattoo, ${label('fresh')}`, `A tetoválásod, ${label('fresh')}`)} className={reveal ? 'reveal' : ''} /> : <div className="ph" />}
            {STAGES.slice(1).map((k) =>
              img[k] ? <img key={k} className="layer" src={img[k]} alt={k === active ? t(`Your tattoo after ${label(k)}`, `A tetoválásod ${label(k)} múlva`) : ''} style={{ opacity: active === k ? 1 : 0 }} /> : null
            )}
            <div className="stamp">
              <span>{active === 'fresh' ? t('NEW', 'ÚJ') : active === 'healed' ? '1' : active.slice(1)}</span>
              <small>{active === 'fresh' ? t('fresh ink', 'friss tinta') : active === 'healed' ? t('year later', 'év múlva') : t('years later', 'év múlva')}</small>
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
          <button className="iconbtn dark" aria-label={t('Zoom in', 'Nagyítás')} onClick={() => setZoom(true)} disabled={!img[active]}>
            {Icon.zoom}
          </button>
          {onFavorite && (
            <button className={`iconbtn dark ${preview.favorite ? 'on' : ''}`} aria-label={t('Favorite', 'Kedvenc')} aria-pressed={preview.favorite} onClick={onFavorite}>
              {Icon.heart}
            </button>
          )}
        </div>
        {pending.length > 0 && mode === 'view' && (
          <div className="res-pending" role="status">
            <i className="needle" />
            {t(`Aging your skin… ${STAGES.length - 1 - pending.length}/4 ready`, `A bőröd öregítése… ${STAGES.length - 1 - pending.length}/4 kész`)}
          </div>
        )}
      </div>

      <div className="stagebar" role="tablist" aria-label={t('Years', 'Évek')}>
        {STAGES.map((k) => {
          const fail = failed.includes(k);
          return (
            <button
              key={k}
              role="tab"
              aria-selected={active === k}
              className={`${active === k ? 'on' : ''} ${pending.includes(k) ? 'loading' : ''}`}
              disabled={!img[k] && !fail}
              onClick={() => {
                if (fail && onRetryStage) return onRetryStage(k);
                setActive(k);
                haptic();
              }}
            >
              {fail ? '↻' : label(k)}
            </button>
          );
        })}
      </div>

      <div className="actgrid">
        <button className="act primary" onClick={() => setVideo(true)} disabled={ready.length < 2}>
          {Icon.video}
          {t('Video', 'Videó')}
        </button>
        <button className="act" onClick={share} disabled={sharing}>
          {Icon.share}
          {t('Ask friends', 'Kérdezd meg')}
        </button>
        <button className="act" onClick={() => setMode(mode === 'split' ? 'view' : 'split')} disabled={ready.length < 2} aria-pressed={mode === 'split'}>
          <svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M12 3v18" /></svg>
          {mode === 'split' ? t('Single', 'Egy kép') : t('Compare', 'Összevet')}
        </button>
        <button className="act" onClick={saveImage} disabled={!img[active]}>
          {Icon.download}
          {t('Save', 'Mentés')}
        </button>
      </div>

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

      {zoom && img[active] && (
        <div className="zoomview" role="dialog" aria-modal="true" aria-label={t('Zoomed image', 'Nagyított kép')} onClick={() => setZoom(false)}>
          <img src={img[active]} alt={label(active)} />
          <button className="iconbtn dark" aria-label={ui.t('common.close')} onClick={() => setZoom(false)}>
            {Icon.close}
          </button>
        </div>
      )}

      <VideoSheet open={video} onClose={() => setVideo(false)} preview={preview} />
    </div>
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
        yes: t('YES', 'IGEN'),
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
