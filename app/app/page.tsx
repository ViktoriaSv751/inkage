'use client';

import { useEffect, useRef, useState } from 'react';
import { useApp } from './AppProvider';
import { Icon, OutOfPreviews } from './ui';
import { Result } from './Result';
import { Onboarding, OnboardingAnswers } from './create/Onboarding';
import { Design, DesignStep, Photo, PhotoStep, PlaceStep } from './create/steps';
import { tx } from '@/lib/i18n';
import { api } from '@/lib/sb';
import { cloud, haptic, local, lsGet, Preview, StageKey, STAGES, track } from '@/lib/store';
import { composeMockup, Placement } from '@/lib/editor';
import { loadImage } from '@/lib/client';
import { frameCm } from '@/lib/score';
import { DESIGNS } from '@/lib/designs';
import { processDesign } from '@/lib/editor';
import { lsSet } from '@/lib/store';

type Phase = 'loading' | 'onboarding' | 'photo' | 'design' | 'place' | 'gen' | 'result';
const AGE_STAGES: StageKey[] = ['healed', 'y10', 'y30', 'y50'];

async function flattenOnWhite(src: string, max = 1024) {
  const img = await loadImage(src);
  const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const pad = 0.08;
  const w = Math.round(img.naturalWidth * s), h = Math.round(img.naturalHeight * s);
  const c = document.createElement('canvas');
  c.width = Math.round(w * (1 + pad * 2));
  c.height = Math.round(h * (1 + pad * 2));
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(img, w * pad, h * pad, w, h);
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
  const [genStep, setGenStep] = useState(0);
  const [err, setErr] = useState('');
  const [paywall, setPaywall] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [pending, setPending] = useState<StageKey[]>([]);
  const [failed, setFailed] = useState<StageKey[]>([]);
  const [fact, setFact] = useState(0);
  const job = useRef<{ token: string; fresh: string } | null>(null);
  const saved = useRef(false);
  const previewRef = useRef<Preview | null>(null);
  previewRef.current = preview;

  // start: onboarding once, then straight into creating
  useEffect(() => {
    const ans = lsGet<OnboardingAnswers | null>('ink_onboarding', null);
    if (ans) {
      applyOnboarding(ans);
      setPhase('photo');
    } else setPhase('onboarding');
    // a design picked in Explore
    const pick = DESIGNS.find((d) => d.id === lsGet<string | null>('ink_pick', null));
    if (pick) {
      lsSet('ink_pick', null);
      processDesign(pick.src, 'black').then((d) => setDesign({ raw: pick.src, ink: d.dataUrl, ratio: d.ratio, detail: d.detail, mode: 'black', libId: pick.id }));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // signed-in users who onboarded on another device skip it too
  useEffect(() => {
    if (phase === 'onboarding' && me.onboarding?.placement) {
      applyOnboarding(me.onboarding);
      setPhase('photo');
    }
  }, [me.onboarding]); // eslint-disable-line react-hooks/exhaustive-deps

  function applyOnboarding(a: OnboardingAnswers) {
    setOb(a);
    if (a.placement) setPlacement(a.placement);
    const cm = Number(a.size) || 8;
    setPl((p) => ({ ...p, w: Math.min(0.8, Math.max(0.1, cm / frameCm(a.placement || 'forearm'))) }));
  }

  useEffect(() => {
    if (phase !== 'gen') return;
    const i = setInterval(() => setFact((f) => (f + 1) % FACTS.en.length), 4500);
    return () => clearInterval(i);
  }, [phase]);

  // ---------------------------------------------------------------- generation
  const ageOne = async (k: StageKey) => {
    const j = job.current;
    if (!j) return;
    setFailed((f) => f.filter((x) => x !== k));
    setPending((p) => (p.includes(k) ? p : [...p, k]));
    const r = await api<{ image: string; error?: string }>('/api/age', { stage: k, image: j.fresh, token: j.token });
    setPending((p) => p.filter((x) => x !== k));
    if (r.ok && r.data.image) {
      setPreview((p) => (p ? { ...p, images: { ...p.images, [k]: r.data.image } } : p));
      if (k === 'y50') track('stage_y50');
    } else {
      setFailed((f) => [...f, k]);
      if (r.data?.error) toast(r.data.error);
    }
  };

  const go = async () => {
    if (!photo || !design) return;
    setErr('');
    setPhase('gen');
    setGenStep(0);
    haptic();
    track('generate_start', { placement, lib: design.libId || null });
    const timers = [setTimeout(() => setGenStep(1), 3500), setTimeout(() => setGenStep(2), 17000)];
    const cm = pl.w * frameCm(placement);
    const [flat, mockup] = await Promise.all([flattenOnWhite(design.ink), composeMockup(photo.dataUrl, design.ink, pl)]);
    const r = await api<any>('/api/generate', {
      photo: photo.dataUrl,
      design: flat,
      mockup,
      placement,
      size: cm < 6 ? 'small' : cm > 12 ? 'large' : 'medium',
      colorMode: design.mode,
      sizeCm: Math.round(cm * 10) / 10,
      detail: design.detail,
      sun: ob?.sun,
      lang: ui.lang,
      w: photo.w,
      h: photo.h,
    });
    timers.forEach(clearTimeout);

    if (!r.ok) {
      setPhase('place');
      if (r.data?.code === 'paywall') {
        track('paywall', { plan: r.data.plan });
        if (!me.user) openAuth(t('You used your free guest preview. Sign in (free) for one more — and to keep your designs.', 'Elhasználtad a vendég előnézetet. Jelentkezz be (ingyenes), és kapsz még egyet – a terveid is megmaradnak.'));
        else setPaywall(true);
        return;
      }
      setErr(r.data?.error || t('Something went wrong. Try again.', 'Valami hiba történt. Próbáld újra.'));
      return;
    }

    setGenStep(3);
    haptic('success');
    track('generate_done', { qc: r.data.qc, score: r.data.report?.score });
    saved.current = false;
    const p: Preview = {
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      placement,
      size: `${cm.toFixed(1)} cm`,
      score: r.data.report?.score ?? null,
      report: r.data.report ?? null,
      age: r.data.age ?? null,
      notes: '',
      favorite: false,
      collection: null,
      images: { fresh: r.data.image },
      source: 'local',
    };
    setPreview(p);
    setFailed([]);
    setPhase('result');
    refreshMe();
    if (r.data.canAge && r.data.token) {
      job.current = { token: r.data.token, fresh: r.data.image };
      setPending(AGE_STAGES);
      AGE_STAGES.forEach((k) => ageOne(k));
    }
  };

  // ---------------------------------------------------------------- auto-save when aging settles
  useEffect(() => {
    const p = previewRef.current;
    if (phase !== 'result' || !p || pending.length || saved.current) return;
    saved.current = true;
    (async () => {
      try {
        if (me.user) {
          await cloud.save(me.user.id, { ...p, analysis: p.age ? { apparentAge: p.age } : undefined }, p.id);
          setPreview((x) => (x && x.id === p.id ? { ...x, source: 'cloud' } : x));
          toast(ui.t('result.saved'));
        } else {
          await local.put(p);
          toast(ui.t('result.savedLocal'));
        }
        track('preview_saved', { cloud: !!me.user });
      } catch (e) {
        console.warn('save failed', e);
        saved.current = false;
      }
    })();
  }, [pending, phase, me.user]); // eslint-disable-line react-hooks/exhaustive-deps

  const patch = (x: Partial<Preview>) => {
    const p = previewRef.current;
    if (!p) return;
    const next = { ...p, ...x };
    setPreview(next);
    if (!saved.current) return;
    if (p.source === 'cloud') cloud.update(p.id, { notes: next.notes, favorite: next.favorite });
    else local.put(next);
  };

  const restart = () => {
    setPreview(null);
    setDesign(null);
    setPending([]);
    setFailed([]);
    job.current = null;
    setPhase('design');
    window.scrollTo({ top: 0 });
  };

  // ---------------------------------------------------------------- render
  if (phase === 'loading') return null;
  if (phase === 'onboarding')
    return (
      <Onboarding
        onDone={(a) => {
          applyOnboarding(a);
          setPhase('photo');
        }}
      />
    );

  const stepIdx = phase === 'photo' ? 0 : phase === 'design' ? 1 : 2;
  const head = (title: string, sub: string, back?: () => void) => (
    <>
      <div className="stephead">
        {back ? (
          <button className="iconbtn" aria-label={ui.t('common.back')} onClick={back}>
            {Icon.back}
          </button>
        ) : (
          <span className="free-pill">
            {me.user ? t(`${Math.max(0, me.remaining ?? 0)} preview${me.remaining === 1 ? '' : 's'} left`, `${Math.max(0, me.remaining ?? 0)} előnézet maradt`) : t('✦ First preview free', '✦ Az első ingyenes')}
          </span>
        )}
        <div className="dots" aria-label={`${stepIdx + 1} / 3`}>
          {[0, 1, 2].map((i) => (
            <i key={i} className={i === stepIdx ? 'on' : ''} />
          ))}
        </div>
      </div>
      <h1>{title}</h1>
      <p className="sub">{sub}</p>
    </>
  );

  if (phase === 'photo')
    return (
      <>
        {head(ui.t('create.photo.title'), ui.t('create.photo.sub'))}
        <PhotoStep placement={placement} setPlacement={setPlacement} photo={photo} setPhoto={setPhoto} onNext={() => setPhase(design ? 'place' : 'design')} />
      </>
    );

  if (phase === 'design')
    return (
      <>
        {head(ui.t('create.design.title'), ui.t('create.design.sub'), () => setPhase('photo'))}
        <DesignStep design={design} setDesign={setDesign} onNext={() => setPhase('place')} />
      </>
    );

  if (phase === 'place' && photo && design)
    return (
      <>
        {head(ui.t('create.place.title'), ui.t('create.place.sub'), () => setPhase('design'))}
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
          pl={pl}
          setPl={setPl}
          onGo={go}
          canGo
          footer={!me.user ? <p className="fine">{ui.t('create.free')}</p> : null}
        />
        <OutOfPreviews open={paywall} onClose={() => setPaywall(false)} />
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
        <p className="gen-fact" dangerouslySetInnerHTML={{ __html: FACTS[ui.lang][fact] }} />
      </div>
    );

  if (phase === 'result' && preview)
    return (
      <>
        <div className="stephead" style={{ marginBottom: 12 }}>
          <button className="iconbtn" aria-label={t('Edit placement', 'Elhelyezés módosítása')} onClick={() => setPhase('place')} disabled={pending.length > 0}>
            {Icon.back}
          </button>
          <h1 style={{ margin: 0, fontSize: 34 }}>{t('Your tattoo', 'A tetoválásod')}</h1>
        </div>
        <Result
          preview={preview}
          pending={pending}
          failed={failed}
          reveal
          onNotes={(notes) => patch({ notes })}
          onFavorite={() => patch({ favorite: !preview.favorite })}
          onRetryStage={ageOne}
          onNew={restart}
        />
      </>
    );

  // fallback (e.g. place without photo after refresh)
  return (
    <div className="empty">
      <button className="btn" onClick={() => setPhase('photo')}>
        {ui.t('common.continue')}
      </button>
    </div>
  );
}
