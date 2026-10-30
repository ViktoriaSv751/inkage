'use client';
import { useEffect, useState } from 'react';
import { useApp } from './AppProvider';
import { Icon } from './ui';
import { tx } from '@/lib/i18n';
import { REMOVAL_STAGES, RemovalKey, StageKey, STAGES, track } from '@/lib/store';
import { shareOrDownload } from '@/lib/client';
import { useScrollLock } from '@/lib/scrolllock';
import { PollSheet } from './PollSheet';
import { AiReport } from './AiReport';
import { WHY } from './_result/constants';
import { toBlob } from './_result/media';
import type { ResultProps } from './_result/types';
import { useTimeline } from './_result/useTimeline';
import { useShareActions } from './_result/useShareActions';
import { Viewer } from './_result/Viewer';
import { StageBar } from './_result/StageBar';
import { FixCard, ScoreCard } from './_result/ScoreCard';
import { LinksPanel } from './_result/LinksPanel';
import { NextSteps } from './_result/NextSteps';
import { CareSheet } from './_result/CareSheet';
import { VideoSheet } from './_result/VideoSheet';
import { PublishSheet } from './_result/PublishSheet';
import { RedoSheet } from './_result/RedoSheet';

export { REDO_REASONS } from './_result/constants';
export { VideoSheet } from './_result/VideoSheet';

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
  gallery = false,
  onTryPlace,
}: ResultProps) {
  const { ui, toast } = useApp();
  const t = (en: string, hu: string) => tx(ui.lang, en, hu);
  const img = preview.images;
  const rem = preview.removal || {};
  const report = preview.report;
  const ready = STAGES.filter((k) => img[k]);
  /** the person's own tattoo (aging or removal), not a new design */
  const own = preview.mode === 'existing' || preview.mode === 'removal';
  const [view, setView] = useState<'aging' | 'removal'>(startView);
  const [remKey, setRemKey] = useState<'fresh' | RemovalKey>('fresh');
  const [mode, setMode] = useState<'view' | 'split'>('view');
  const [split, setSplit] = useState(50);
  const [zoom, setZoom] = useState(false);
  useScrollLock(!!zoom);
  const [video, setVideo] = useState(false);
  const [care, setCare] = useState(false);
  const [pollOpen, setPollOpen] = useState(false);
  const [notes, setNotes] = useState(preview.notes || '');
  const [closeup, setCloseup] = useState(false);
  const [redoOpen, setRedoOpen] = useState(false);
  const [pubOpen, setPubOpen] = useState(false);
  const [linksTick, setLinksTick] = useState(0);
  const { pdf, pdfBusy, linkFor, card, cardBusy } = useShareActions(preview, own, onShared);
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
  const label = (k: StageKey) => (k === 'fresh' && own ? t('Today', 'Ma') : ui.t(`stage.${k}` as any));
  const remLabel = (k: 'fresh' | RemovalKey) => (k === 'fresh' ? t('Today', 'Ma') : t(`${k.slice(5)} sessions`, `${k.slice(5)} kezelés`));

  const { pos, setPos, maxPos, p, lo, frac, active, yearsNow, step } = useTimeline(ready, reveal);
  // in the gallery these buttons say what they are waiting for, instead of just being grey
  const agingHere = gallery && !!onAging;
  const needAging = () => toast(t('First make the images of the years.', 'Ehhez előbb készítsd el az évek képeit.'));

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

  const saveImage = async () => {
    if (!activeSrc) return;
    track('save_image', { stage: view === 'removal' ? remKey : active });
    await shareOrDownload(await toBlob(activeSrc), `inkage-${view === 'removal' ? remKey : active}.jpg`);
  };

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

      <Viewer
        preview={preview}
        view={view}
        mode={mode}
        remKey={remKey}
        ready={ready}
        lo={lo}
        frac={frac}
        yearsNow={yearsNow}
        active={active}
        activeSrc={activeSrc}
        activeName={activeName}
        label={label}
        remLabel={remLabel}
        own={own}
        reveal={reveal}
        zs={zs}
        closeup={closeup}
        setCloseup={setCloseup}
        split={split}
        setSplit={setSplit}
        setZoom={setZoom}
        step={step}
        pending={pending}
        removalPending={removalPending}
        onFavorite={onFavorite}
      />

      <StageBar
        view={view}
        mode={mode}
        ready={ready}
        maxPos={maxPos}
        p={p}
        yearsNow={yearsNow}
        setPos={setPos}
        active={active}
        label={label}
        failed={failed}
        pending={pending}
        onRetryStage={onRetryStage}
        onMissingStage={gallery ? onAging : undefined}
        rem={rem}
        remKey={remKey}
        setRemKey={setRemKey}
        remLabel={remLabel}
        removalPending={removalPending}
      />

      {onRedo && view === 'aging' && img.fresh && !own && (
        <button className="redo-link" onClick={() => setRedoOpen(true)}>
          {t('Not right? Make it again', 'Nem lett jó? Újracsináljuk')}
        </button>
      )}
      {view === 'aging' && mode === 'view' && (
        <p className="why" aria-live="polite">{t(...WHY[active])}</p>
      )}
      {img.fresh && <AiReport previewId={preview.id} image={img[ready[Math.round(pos)] as StageKey] || img.fresh} />}
      {!removalOnly && onAging && view === 'aging' && (gallery ? ready.length < STAGES.length : ready.length <= 1) && pending.length === 0 && failed.length === 0 && img.fresh && (
        <div className="age-offer">
          <p>
            {gallery
              ? ready.length > 1
                ? t('Some of the years are still missing.', 'Néhány év még hiányzik.')
                : t('Want to see how it looks over the years?', 'Megnézed, hogyan néz ki az évek múlásával?')
              : t('Saved to your gallery. Want to see how it looks over the years?', 'Elmentve a galériádba. Megnézed, hogyan néz ki az évek múlásával?')}
          </p>
          <button className="btn wide" onClick={onAging}>
            {gallery && ready.length > 1 ? t('Finish the missing years', 'Hiányzó évek elkészítése') : t('Show how it ages (1–50 years)', 'Mutasd, hogyan öregszik (1–50 év)')}
          </button>
        </div>
      )}
      {gallery && view === 'aging' && pending.length > 0 && (
        <p className="why" role="status">{t('Making the years, about a minute. You can leave this page: finished images stay saved.', 'Készülnek az évek, kb. egy perc. Elhagyhatod az oldalt, a kész képek megmaradnak.')}</p>
      )}
      {removalOnly && onAging && (
        <button className="btn ghost wide" style={{ margin: '4px 0 12px' }} onClick={() => (setView('aging'), onAging())} disabled={removalPending.length > 0}>
          {t('Also show how it ages over 50 years', 'Az öregedését is megnézem 50 évre')}
        </button>
      )}
      <div className="actgrid">
        <button className="act primary" onClick={() => (ready.length < 2 ? needAging() : setVideo(true))} disabled={ready.length < 2 && !agingHere}>
          {Icon.video}
          {t('Video', 'Videó')}
        </button>
        <button className="act" onClick={() => setPollOpen(true)} disabled={!img.fresh}>
          {Icon.share}
          {t('Ask friends', 'Kérdezd meg')}
        </button>
        <button className="act" onClick={() => (ready.length < 2 ? needAging() : setMode(mode === 'split' ? 'view' : 'split'))} disabled={(ready.length < 2 && !agingHere) || view === 'removal'} aria-pressed={mode === 'split'}>
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
        <FixCard onImprove={onImprove} improving={improving} pending={pending} suggestCm={suggestCm} onResize={onResize} />
      )}

      {report && <ScoreCard preview={preview} report={report} own={own} onTryPlace={onTryPlace} />}

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

      {img.y50 && (
        <div className="card nextcta">
          <h3>{t('Happy with it?', 'Tetszik?')}</h3>
          <p className="sub">{t('It’s saved in your gallery. Most people ask a few friends before they book.', 'A galériádba mentettük. A legtöbben megkérdeznek pár barátot, mielőtt időpontot foglalnak.')}</p>
          <button className="btn wide" onClick={() => { track('next_vote'); setPollOpen(true); }}>
            {t('Ask friends to vote', 'Kérd ki a barátaid véleményét')}
          </button>
          {onNew && (
            <button className="btn wide ghost" style={{ marginTop: 8 }} onClick={() => { track('next_new'); onNew(); }}>
              {t('Try another design or spot', 'Másik minta vagy hely kipróbálása')}
            </button>
          )}
        </div>
      )}

      <NextSteps
        img={img}
        pending={pending}
        pdf={pdf}
        pdfBusy={pdfBusy}
        card={card}
        cardBusy={cardBusy}
        onRemoval={onRemoval}
        remCount={remCount}
        removalPending={removalPending}
        setView={setView}
        setPubOpen={setPubOpen}
        setCare={setCare}
      />

      {onNew && !img.y50 && (
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
      <PublishSheet preview={preview} pubOpen={pubOpen} setPubOpen={setPubOpen} setLinksTick={setLinksTick} linkFor={linkFor} />
      <RedoSheet redoOpen={redoOpen} setRedoOpen={setRedoOpen} onRedo={onRedo} />
    </div>
  );
}
