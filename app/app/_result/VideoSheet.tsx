'use client';
import { useEffect, useMemo, useState } from 'react';
import { pick } from '@/lib/tr';
import { useApp } from '../AppProvider';
import { Icon, Sheet } from '../ui';
import { tx } from '@/lib/i18n';
import { haptic, Preview, STAGES, track } from '@/lib/store';
import { shareOrDownload } from '@/lib/client';
import { canRecordVideo, HOOKS, makeVideo, photoSlides, Template } from '@/lib/video';

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
