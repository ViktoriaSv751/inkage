'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  STAGE_LABELS,
  StageKey,
  dataUrlToBlob,
  makeTimelapse,
  prepareImage,
  shareOrDownload,
} from '@/lib/client';
import { api, sb } from '@/lib/sb';
import { BodyMap, EXAMPLE, HeroAging } from './visuals';

type Cfg = { ai: boolean; auth: boolean; payments: boolean };
type Me = { user: { id: string; email?: string } | null; plan?: string; remaining?: number; limit?: number; canAge?: boolean };
type Img = { dataUrl: string; w: number; h: number } | null;
type StageState = { status: 'idle' | 'loading' | 'done' | 'error' | 'locked'; src?: string; error?: string };

const SIZES = ['small', 'medium', 'large'] as const;
const WATERMARK = 'made with InkAge';

const emptyStages = (): Record<StageKey, StageState> =>
  Object.fromEntries(STAGE_LABELS.map((s) => [s.key, { status: 'idle' }])) as any;

export default function Home() {
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [me, setMe] = useState<Me>({ user: null });
  const [photo, setPhoto] = useState<Img>(null);
  const [design, setDesign] = useState<Img>(null);
  const [placement, setPlacement] = useState('Inner forearm');
  const [size, setSize] = useState<(typeof SIZES)[number]>('medium');
  const [stages, setStages] = useState(emptyStages());
  const [active, setActive] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [modal, setModal] = useState<null | 'auth' | 'paywall'>(null);
  const [video, setVideo] = useState<{ progress: number; url?: string; blob?: Blob; ext?: string } | null>(null);
  const [notice, setNotice] = useState('');
  const [baseAge, setBaseAge] = useState<number | null>(null);
  const [exampleMode, setExampleMode] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);
  const pendingGenerate = useRef(false);

  const demo = cfg ? !cfg.ai : false;
  const hasResult = stages.fresh.status === 'done' || stages.fresh.status === 'loading';

  const refreshMe = useCallback(async () => {
    const r = await api<Me>('/api/me');
    if (r.ok) setMe(r.data);
    return r.data;
  }, []);

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_STATIC_DEMO) {
      setCfg({ ai: false, auth: false, payments: false });
      return;
    }
    api<Cfg>('/api/config').then((r) => setCfg(r.ok ? r.data : { ai: false, auth: false, payments: false }));
    refreshMe();
    const s = sb();
    const sub = s?.auth.onAuthStateChange(() => { setTimeout(() => { refreshMe(); }, 0); });
    const q = new URLSearchParams(location.search);
    if (q.get('paid')) {
      setNotice('Payment received — aging is unlocked. Thank you!');
      setTimeout(refreshMe, 2500);
    }
    if (q.get('paid') || q.get('canceled')) history.replaceState(null, '', '/');
    return () => sub?.data.subscription.unsubscribe();
  }, [refreshMe]);

  const onFile = async (f: File | undefined, kind: 'photo' | 'design') => {
    if (!f) return;
    if (!f.type.startsWith('image/')) return setError('Please choose an image file.');
    setError('');
    try {
      const img = await prepareImage(f, 1024, kind === 'design' ? 'image/png' : 'image/jpeg');
      kind === 'photo' ? setPhoto(img) : setDesign(img);
    } catch {
      setError('Could not read that image. Try a JPG or PNG.');
    }
  };

  const ageStage = async (key: Exclude<StageKey, 'fresh'>, image: string, token: string) => {
    setStages((s) => ({ ...s, [key]: { status: 'loading' } }));
    const r = await api('/api/age', { stage: key, image, token });
    setStages((s) => ({
      ...s,
      [key]: r.ok ? { status: 'done', src: r.data.image } : { status: 'error', error: r.data.error || 'Failed' },
    }));
  };

  const generate = async () => {
    if (!photo || !design) return setError('Add your photo and a tattoo design first.');
    setError('');
    setVideo(null);

    // ---------- AI not connected: show a real example from the same pipeline ----------
    if (demo) {
      setStages(Object.fromEntries(STAGE_LABELS.map((s, i) => [s.key, { status: 'done', src: EXAMPLE[i].src }])) as any);
      setBaseAge(28);
      setExampleMode(true);
      setActive(0);
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      return;
    }
    setExampleMode(false);

    if (!me.user) {
      pendingGenerate.current = true;
      return setModal('auth');
    }

    setBusy(true);
    setActive(0);
    setStages({ ...emptyStages(), fresh: { status: 'loading' } });
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);

    const r = await api('/api/generate', {
      photo: photo.dataUrl,
      design: design.dataUrl,
      placement,
      size,
      w: photo.w,
      h: photo.h,
    });
    setBusy(false);
    if (!r.ok) {
      setStages(emptyStages());
      if (r.data.code === 'auth') return setModal('auth');
      if (r.data.code === 'paywall') return setModal('paywall');
      return setError(r.data.error || 'Something went wrong.');
    }
    const fresh = r.data.image as string;
    setBaseAge(typeof r.data.age === 'number' ? r.data.age : null);
    refreshMe();
    if (r.data.canAge && r.data.token) {
      setStages({ ...emptyStages(), fresh: { status: 'done', src: fresh } });
      (['healed', 'y10', 'y30', 'y50'] as const).forEach((k) => ageStage(k, fresh, r.data.token));
    } else {
      // free preview: aging stages are shown blurred behind the paywall
      setStages({
        fresh: { status: 'done', src: fresh },
        healed: { status: 'locked', src: fresh },
        y10: { status: 'locked', src: fresh },
        y30: { status: 'locked', src: fresh },
        y50: { status: 'locked', src: fresh },
      });
    }
  };

  // continue after sign-in
  useEffect(() => {
    if (me.user && pendingGenerate.current) {
      pendingGenerate.current = false;
      setModal(null);
      generate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me.user]);

  const doneFrames = useMemo(
    () => STAGE_LABELS.filter((s) => stages[s.key].status === 'done').map((s) => ({ label: s.key === 'fresh' ? 'Fresh' : s.label, src: stages[s.key].src! })),
    [stages]
  );
  const allDone = doneFrames.length === STAGE_LABELS.length;
  const anyLocked = STAGE_LABELS.some((s) => stages[s.key].status === 'locked');
  const cur = stages[STAGE_LABELS[active].key];

  const makeVideo = async () => {
    if (anyLocked) return setModal('paywall');
    try {
      setVideo({ progress: 0 });
      const { blob, ext } = await makeTimelapse(doneFrames, {
        watermark: demo ? `${WATERMARK} · DEMO` : WATERMARK,
        onProgress: (p) => setVideo((v) => ({ ...(v || {}), progress: p })),
      });
      setVideo({ progress: 1, url: URL.createObjectURL(blob), blob, ext });
    } catch (e: any) {
      setVideo(null);
      setError(e?.message || 'Could not create the video.');
    }
  };

  const saveImage = async () => {
    if (!cur.src || cur.status !== 'done') return;
    await shareOrDownload(await dataUrlToBlob(cur.src), `inkage-${STAGE_LABELS[active].key}.jpg`);
  };

  const reset = () => {
    setStages(emptyStages());
    setVideo(null);
    setActive(0);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const stageIdx = active;
  const yearsLabel = ['Fresh', '1 year', '10 years', '30 years', '50 years'][stageIdx];

  return (
    <main>
      <header className="top">
        <a className="logo" href="/" aria-label="InkAge home">
          <svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="30" /><path d="M38 14a20 20 0 1 0 0 36a16 16 0 1 1 0-36z" /></svg>
          InkAge
        </a>
        {cfg?.auth && (
          <nav className="row">
            {me.user && me.plan === 'free' && (
              <button className="link" onClick={() => setModal('paywall')}>Unlock aging</button>
            )}
            {me.user && me.plan !== 'free' && (
              <button
                className="link"
                onClick={async () => {
                  const r = await api('/api/portal', {});
                  if (r.ok) location.href = r.data.url;
                  else setError(r.data.error);
                }}
              >
                Billing
              </button>
            )}
            <button className="link" onClick={() => (me.user ? sb()?.auth.signOut().then(refreshMe) : setModal('auth'))}>
              {me.user ? 'Sign out' : 'Sign in'}
            </button>
          </nav>
        )}
      </header>

      {demo && <div className="banner">Preview: the AI isn’t connected here yet. You’ll see a real example result instead of your own photo.</div>}
      {notice && (
        <button className="banner ok" onClick={() => setNotice('')}>
          {notice}
        </button>
      )}

      <section className="hero">
        <div className="hero-copy">
          <h1>
            Your tattoo,
            <br />
            50 years
            <br />
            from now.
          </h1>
          <p className="lede">
            Put any design on a photo of your own body. See it fresh today, healed, and at 10, 30 and 50 years, before it’s permanent.
          </p>
          <a className="btn" href="#studio">Try it on your photo</a>
        </div>
        <HeroAging />
      </section>

      <section id="studio" className="studio">
        <h2 className="studio-title">Make your preview</h2>

        <div className="slots">
          <Drop title="Your photo" hint="The body area, in good light" img={photo} onFile={(f) => onFile(f, 'photo')} kind="photo" />
          <Drop title="The design" hint="Screenshot, sketch or Pinterest pin" img={design} onFile={(f) => onFile(f, 'design')} kind="design" />
        </div>

        <div className="where">
          <h3>Where should it go?</h3>
          <BodyMap value={placement} onChange={setPlacement} />
          <input
            className="text"
            value={placement}
            onChange={(e) => setPlacement(e.target.value)}
            maxLength={80}
            aria-label="Placement"
            placeholder="Or describe it, e.g. left inner forearm near the wrist"
          />
        </div>

        <div className="sizes" role="radiogroup" aria-label="Size">
          <h3>Size</h3>
          <div className="size-row">
            {SIZES.map((s) => (
              <button key={s} role="radio" aria-checked={size === s} className={size === s ? 'on' : ''} onClick={() => setSize(s)}>
                <i style={{ width: s === 'small' ? 10 : s === 'medium' ? 18 : 28, height: s === 'small' ? 10 : s === 'medium' ? 18 : 28 }} />
                {s[0].toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="err" role="alert">{error}</p>}
        <button className="btn wide" disabled={busy || !photo || !design} onClick={generate}>
          {busy ? 'Tattooing…' : !photo ? 'Add your photo to start' : !design ? 'Add a design to continue' : 'Show me my tattoo'}
        </button>
        {!demo && me.user && typeof me.remaining === 'number' && (
          <p className="fine">
            {me.plan === 'free' ? (me.remaining > 0 ? 'Your first preview is free.' : 'Free preview used. Unlock aging for more.') : `${me.remaining} previews left this period.`}
          </p>
        )}
      </section>

      {hasResult && (
        <section className="result" ref={resultRef} aria-live="polite">
          {exampleMode && (
            <p className="example-note">
              The AI isn’t connected on this preview yet, so this is a real example made with the same AI on a test photo. Your own photo will look like this once the app is live.
            </p>
          )}
          <div className="viewer">
            {cur.src ? (
              <img src={cur.src} alt={`Your tattoo, ${yearsLabel.toLowerCase()}`} className={cur.status === 'locked' ? 'locked' : ''} />
            ) : (
              <div className="ph" style={{ aspectRatio: photo ? `${photo.w}/${photo.h}` : '3/4' }} />
            )}
            <div className="stamp">
              <span>{['0', '1', '10', '30', '50'][stageIdx]}</span>
              <small>
                {stageIdx === 0 ? 'fresh today' : stageIdx === 1 ? 'year later' : 'years later'}
                {baseAge !== null && ` · you at ~${baseAge + [0, 1, 10, 30, 50][stageIdx]}`}
              </small>
            </div>
            {(cur.status === 'loading' || (active === 0 && stages.fresh.status === 'loading')) && (
              <div className="veil">
                <div className="needle" />
                <p>{active === 0 ? 'Tattooing your photo. This takes about a minute.' : `Aging it to ${yearsLabel}…`}</p>
              </div>
            )}
            {cur.status === 'locked' && (
              <div className="veil">
                <p className="veil-big">See it at {yearsLabel}</p>
                <button className="btn" onClick={() => setModal('paywall')}>Unlock aging</button>
              </div>
            )}
            {cur.status === 'error' && (
              <div className="veil">
                <p>{cur.error}</p>
              </div>
            )}
          </div>

          <div className="ruler">
            <input
              type="range"
              min={0}
              max={STAGE_LABELS.length - 1}
              step={1}
              value={active}
              onChange={(e) => setActive(Number(e.target.value))}
              aria-label="Years later"
            />
            <div className="ticks">
              {STAGE_LABELS.map((s, i) => (
                <button key={s.key} className={`${i === active ? 'on' : ''} ${stages[s.key].status}`} onClick={() => setActive(i)}>
                  {s.short}
                </button>
              ))}
            </div>
          </div>

          <div className="result-actions">
            <button className="btn wide" disabled={!allDone && !anyLocked} onClick={makeVideo}>
              {anyLocked ? 'Unlock the time-lapse video' : allDone ? 'Make the time-lapse video' : 'Aging in progress…'}
            </button>
            <div className="row">
              <button className="btn ghost" disabled={cur.status !== 'done'} onClick={saveImage}>Save image</button>
              <button className="btn ghost" onClick={reset}>New design</button>
            </div>
          </div>

          {video && (
            <div className="video">
              {video.url ? (
                <>
                  <video src={video.url} controls playsInline autoPlay loop muted />
                  <button className="btn wide" onClick={() => shareOrDownload(video.blob!, `my-tattoo-in-50-years.${video.ext}`)}>Share or save the video</button>
                  <p className="fine">Post it with #InkAge so we can repost you.</p>
                </>
              ) : (
                <div className="render">
                  <div className="bar"><i style={{ width: `${Math.round(video.progress * 100)}%` }} /></div>
                  <p className="fine">Rendering your video… {Math.round(video.progress * 100)}%</p>
                </div>
              )}
            </div>
          )}
          <p className="fine">This is an AI simulation. Real healing and aging depend on your skin, sun exposure, ink and artist.</p>
        </section>
      )}

      <section className="facts">
        <h2>What changes over the years</h2>
        <ol className="timeline">
          <li><b>Fresh</b><span>Sharp lines, some redness and shine for the first weeks.</span></li>
          <li><b>1 year</b><span>Fully healed. Ink settles into the skin and softens slightly.</span></li>
          <li><b>10 years</b><span>Fine lines start to thicken. Black drifts toward charcoal.</span></li>
          <li><b>30 years</b><span>Small details merge. Colors fade, black turns blue-grey.</span></li>
          <li><b>50 years</b><span>Lines blur and spread with the skin itself as it ages.</span></li>
        </ol>
      </section>

      <footer>
        <span>© {new Date().getFullYear()} InkAge</span>
        <a href="/terms">Terms</a>
        <a href="/privacy">Privacy</a>
      </footer>

      {modal === 'auth' && <AuthModal onClose={() => setModal(null)} onDone={() => { setModal(null); refreshMe(); }} />}
      {modal === 'paywall' && <Paywall cfg={cfg} me={me} onClose={() => setModal(null)} needAuth={() => setModal('auth')} />}
    </main>
  );
}

function Drop({ title, hint, img, onFile, kind }: { title: string; hint: string; img: Img; onFile: (f?: File) => void; kind: 'photo' | 'design' }) {
  const ref = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <button
      type="button"
      className={`slot ${kind} ${over ? 'over' : ''} ${img ? 'has' : ''}`}
      onClick={() => ref.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        onFile(e.dataTransfer.files?.[0]);
      }}
    >
      <input ref={ref} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />
      {img ? (
        <img src={img.dataUrl} alt="" />
      ) : (
        <svg className="slot-art" viewBox="0 0 80 80" aria-hidden="true">
          {kind === 'photo' ? (
            <path d="M28 8c-2 20-4 44-2 64M54 8c2 20 3 44 1 64" />
          ) : (
            <>
              <circle cx="40" cy="40" r="20" />
              <path d="M40 12v8M40 60v8M12 40h8M60 40h8" />
            </>
          )}
        </svg>
      )}
      <span className="slot-label">
        <b>{title}</b>
        <small>{img ? 'Tap to change' : hint}</small>
      </span>
    </button>
  );
}

function AuthModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const s = sb();

  const send = async () => {
    if (!s) return setErr('Sign-in is not configured.');
    setBusy(true);
    setErr('');
    const { error } = await s.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin, shouldCreateUser: true } });
    setBusy(false);
    if (error) return setErr(error.message);
    setSent(true);
  };
  const verify = async () => {
    setBusy(true);
    setErr('');
    const { error } = await s!.auth.verifyOtp({ email, token: code.trim(), type: 'email' });
    setBusy(false);
    if (error) return setErr('That code did not work. Check the newest email.');
    onDone();
  };

  return (
    <div className="modal" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <button className="x" aria-label="Close" onClick={onClose}>
          ×
        </button>
        <h2>{sent ? 'Check your email' : 'Your first preview is free'}</h2>
        {!sent ? (
          <>
            <p className="sub">We’ll email you a sign-in code. No password needed.</p>
            <input type="email" autoFocus placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} />
            <button className="btn wide" disabled={busy || !/\S+@\S+\.\S+/.test(email)} onClick={send}>
              {busy ? 'Sending…' : 'Email me a code'}
            </button>
          </>
        ) : (
          <>
            <p className="sub">
              Enter the code we sent to <b>{email}</b>, or tap the link in the email.
            </p>
            <input inputMode="numeric" autoComplete="one-time-code" placeholder="Code" value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && verify()} />
            <button className="btn wide" disabled={busy || code.trim().length < 6} onClick={verify}>
              {busy ? 'Checking…' : 'Continue'}
            </button>
            <button className="btn ghost wide" onClick={() => setSent(false)}>
              Use a different email
            </button>
          </>
        )}
        {err && <p className="err">{err}</p>}
      </div>
    </div>
  );
}

function Paywall({ cfg, me, onClose, needAuth }: { cfg: Cfg | null; me: Me; onClose: () => void; needAuth: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const buy = async (plan: 'weekly' | 'lifetime') => {
    if (!me.user) return needAuth();
    setBusy(plan);
    setErr('');
    const r = await api('/api/checkout', { plan });
    setBusy(null);
    if (r.ok && r.data.url) location.href = r.data.url;
    else setErr(r.data.error || 'Checkout failed.');
  };
  const weekly = process.env.NEXT_PUBLIC_PRICE_WEEKLY_LABEL || '$5.99 / week';
  const lifetime = process.env.NEXT_PUBLIC_PRICE_LIFETIME_LABEL || '$49.99 once';
  return (
    <div className="modal" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <button className="x" aria-label="Close" onClick={onClose}>
          ×
        </button>
                <h2>Watch it age.<br />Before it’s permanent.</h2>
        <ul className="perks">
          <li>Healed, 10, 30 &amp; 50-year previews</li>
          <li>TikTok-ready time-lapse videos</li>
          <li>Try many designs and placements</li>
        </ul>
        <button className="plan best" disabled={!!busy || !cfg?.payments} onClick={() => buy('lifetime')}>
          <span>
            <b>Lifetime</b>
            <small>Pay once · 40 previews / month</small>
          </span>
          <em>{busy === 'lifetime' ? '…' : lifetime}</em>
        </button>
        <button className="plan" disabled={!!busy || !cfg?.payments} onClick={() => buy('weekly')}>
          <span>
            <b>Weekly</b>
            <small>20 previews / week · cancel anytime</small>
          </span>
          <em>{busy === 'weekly' ? '…' : weekly}</em>
        </button>
        {!cfg?.payments && <p className="fine">Payments are being set up — check back very soon.</p>}
        {err && <p className="err">{err}</p>}
        <p className="fine">Secure checkout by Stripe. Subscriptions renew automatically until cancelled.</p>
      </div>
    </div>
  );
}
