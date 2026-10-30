'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { qOf } from '@/lib/tr';
import { useApp } from './AppProvider';
import { Icon, OutOfPreviews, Waitlist } from './ui';
import { Result } from './Result';
import { Onboarding, OnboardingAnswers } from './create/Onboarding';
import { Design, Layer, Photo, placeName, PlaceStep, StudioStep } from './create/steps';
import { trErr, tx, huArticle } from '@/lib/i18n';
import { api, sb } from '@/lib/sb';
import { cloud, local, Preview, RemovalKey, StageKey, track } from '@/lib/store';
import { Placement } from '@/lib/editor';
import { frameCm, photoCm } from '@/lib/score';
import { processDesign } from '@/lib/editor';
import type { Phase } from './_home/types';
import { flattenOnWhite } from './_home/flattenOnWhite';
import { useBodyArea } from './_home/useBodyArea';
import { useStart } from './_home/useStart';
import { useStages } from './_home/useStages';
import { useGenerate } from './_home/useGenerate';
import { useAutoSave } from './_home/useAutoSave';
import { useDraftSave, useFactTicker, useFreshReset, useJobRecovery } from './_home/effects';
import { StepHead } from './_home/StepHead';
import { GenView } from './_home/GenView';
import { CompareCard } from './_home/CompareCard';

export default function CreatePage() {
  const { ui, me, toast } = useApp();
  const router = useRouter();
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
  useFreshReset({ setPhoto, setDesign, setExtras, setPhase });
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
  const { setArea, userMoved, skinNow, keepSkin, areaNow, fit } = useBodyArea({ photo, placement, mode, phase, design, setPl });
  const job = useRef<{ token: string; fresh: string; id?: string } | null>(null);
  const recovering = useRef(false);
  const againRef = useRef(false);
  const saved = useRef(false);
  const savingRef = useRef(false);
  const previewRef = useRef<Preview | null>(null);
  previewRef.current = preview;

  useStart({ phase, setPhase, setMode, setPlacement, setPhoto, setDesign, setPl, applyOnboarding, explicitMode, againRef });

  function applyOnboarding(a: OnboardingAnswers) {
    setOb(a);
    if (!explicitMode.current && (a.goal === 'existing' || a.goal === 'removal')) setMode(a.goal);
    if (a.placement) setPlacement(a.placement);
    const cm = Number(a.size) || 8;
    setPl((p) => ({ ...p, w: Math.min(0.8, Math.max(0.1, cm / frameCm(a.placement || 'forearm'))) }));
  }

  useDraftSave({ phase, placement, photo, design, pl });

  useFactTicker(phase, setFact);

  // ---------------------------------------------------------------- generation
  const { tokens, started, ageOne, lateQueue, persistLate, startAging, startRemoval } = useStages({
    job,
    previewRef,
    saved,
    savingRef,
    removalIntent,
    setPreview,
    setPending,
    setFailed,
    setRemPending,
  });

  const { go, showResult } = useGenerate({
    design,
    pl,
    extras,
    photo,
    mode,
    placement,
    existingCm,
    ob,
    areaNow,
    skinNow,
    removalIntent,
    recovering,
    previewRef,
    prevRef,
    job,
    saved,
    tokens,
    started,
    ageOne,
    startRemoval,
    setPhase,
    setGenStep,
    setErr,
    setPaywall,
    setWaitlist,
    setBusyNote,
    setPreview,
    setPending,
    setFailed,
    setRemPending,
  });

  useJobRecovery({ phase, preview, recovering, setPhase, setGenStep, showResult });

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
    toast(t('Redrawn to last — here is the new version', 'Átrajzolva, hogy tartós legyen – itt az új változat'));
    go({ design: next });
  };
  const resize = (cm: number) => {
    const next = { ...pl, w: Math.min(0.95, cm / ((photo ? photoCm(placement, areaNow, photo) : frameCm(placement)) * Math.max(1, design?.ratio ?? 1))) };
    setPl(next);
    track('resize', { cm });
    go({ pl: next });
  };

  // ---------------------------------------------------------------- auto-save when aging settles
  useAutoSave({ previewRef, pending, phase, saved, savingRef, setPreview, lateQueue, persistLate });

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
          // "just looking around": the Explore page, with a "try it on your photo" button there
          if (a.goal === 'explore') return void router.push(`/app/explore${qOf(ui.lang)}`);
          setPhase('studio');
        }}
      />
    );

  const stepIdx = phase === 'studio' ? 0 : 1;
  const head = (title: string, sub: string, back?: () => void) => <StepHead title={title} sub={sub} back={back} stepIdx={stepIdx} />;

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

  if (phase === 'gen') return <GenView photo={photo} genStep={genStep} busyNote={busyNote} fact={fact} />;

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
          <CompareCard prev={prevRef.current} preview={preview} pollOpen={pollOpen} setPollOpen={setPollOpen} />
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
