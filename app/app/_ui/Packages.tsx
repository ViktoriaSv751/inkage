'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../AppProvider';
import { tx } from '@/lib/i18n';
import { localeOf } from '@/lib/tr';
import { api } from '@/lib/sb';
import { haptic, track } from '@/lib/store';
import { IMG } from '@/lib/img';
import { useScrollLock } from '@/lib/scrolllock';
import { BEST, fmtUsd, PLAN, PLANS, type PlanId } from '@/lib/pricing';

export type PaywallWhy = 'previews' | 'locked' | 'helper' | 'menu';

/* real InkAge results: today and the same tattoo 50 years later (the home page and Explore use them too) */
const PAIRS: [string, string][] = [
  ['hf_20261013_200843_f699cd39-8d0a-43e3-9ba7-71b494279840', 'hf_20261013_200913_5ffd13b1-e537-4454-bb4c-495a2921afcc'],
  ['hf_20261013_200843_15e0b201-b6cc-486c-a5a4-9073748b837c', 'hf_20261013_200918_3120c2be-e153-4881-a8f8-04c1cf79fcb4'],
  ['hf_20261013_204219_480510e4-c412-4eae-9c90-eab4348178ba', 'hf_20261013_204308_b1d4b7fe-a9f2-4f93-8e19-d070d503ba2e'],
  ['hf_20261012_125250_eb1fedf5-fe1d-4bff-b203-9f7f6e04435f', 'hf_20261012_125519_356de094-5fd9-4c5d-a3d4-2e41892aa5b4'],
];
const SWEEP = 5200; // one look from today to 50 years and back, ms

/** The packages page. Full screen and dark: a real before/after that sweeps by itself (drag it to look yourself),
    one headline, the years a package opens on a timeline, three packages as a vertical list (the cheapest chosen
    first, as in Calligra) and a pinned pay button with the withdrawal waiver beside it. Two columns on a computer.
    Web only: the store apps never open it (lib/pricing.ts webPaymentsOn, AppProvider canBuy). */
export function Packages({ open, why, onClose }: { open: boolean; why: PaywallWhy; onClose: () => void }) {
  const { ui, toast, profile } = useApp();
  const L = (en: string, hu: string) => tx(ui.lang, en, hu);
  const [plan, setPlan] = useState<PlanId>('mini');
  const [busy, setBusy] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pair, setPair] = useState(0);
  const hero = useRef<HTMLDivElement>(null);
  const held = useRef(0); // until when a drag holds the sweep
  const opened = useRef(0); // when the page opened, for the close event
  const picked = useRef<PlanId | null>(null);
  // the day's dollar → forint rate for the Hungarian guide amount (null: no guide, the dollar price alone)
  const [huf, setHuf] = useState<number | null>(null);
  useScrollLock(open);
  useEffect(() => setMounted(true), []);
  /* closing the page (X, Escape) is counted, with how long it was open and the package last tapped */
  const close = () => {
    track('paywall_close', { why, plan: picked.current || '', secs: Math.round((Date.now() - opened.current) / 1000) });
    onClose();
  };
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (!open) return;
    setPlan('mini');
    opened.current = Date.now();
    picked.current = null;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open]);
  useEffect(() => {
    if (!open || ui.lang !== 'hu' || huf) return;
    api<{ huf?: number | null }>('/api/fx').then((r) => r.ok && Number(r.data.huf) > 0 && setHuf(Number(r.data.huf)));
  }, [open, ui.lang, huf]);

  // the sweep: today → 50 years → today, then the next example (paused while someone drags)
  useEffect(() => {
    if (!open) return;
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    let t0 = performance.now();
    let n = 0;
    const tick = (now: number) => {
      const el = hero.current;
      if (el && now > held.current) {
        const f = ((now - t0) % SWEEP) / SWEEP;
        const cycle = Math.floor((now - t0) / SWEEP);
        if (cycle !== n) {
          n = cycle;
          setPair((p) => (p + 1) % PAIRS.length);
        }
        // ease in and out, resting a moment at each end
        const x = f < 0.5 ? f * 2 : 2 - f * 2;
        const e = x < 0.12 ? 0 : x > 0.88 ? 1 : (1 - Math.cos(((x - 0.12) / 0.76) * Math.PI)) / 2;
        // 94% = today almost all of it, 6% = 50 years: the handle always stays in view
        el.style.setProperty('--cut', `${94 - (still ? 0.5 : e) * 88}%`);
      } else if (el && now <= held.current) t0 = now - SWEEP / 2; // continue from the middle afterwards
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [open]);

  if (!mounted || !open) return null;

  const loc = localeOf(ui.lang);
  const first = (profile.name || '').trim().split(/\s+/)[0] || '';
  const p = PLAN[plan];
  const base = PLAN.mini.usd / PLAN.mini.n;
  const save = (k: PlanId) => Math.round((1 - PLAN[k].usd / PLAN[k].n / base) * 100);
  /** "kb. 1630 Ft": a guide for Hungarian visitors only, rounded to 10 Ft (the charge itself is in dollars) */
  const ft = (usd: number) => (huf && ui.lang === 'hu' ? `kb. ${new Intl.NumberFormat('hu-HU').format(Math.round((usd * huf) / 10) * 10)} Ft` : '');

  const drag = (e: React.PointerEvent) => {
    const el = hero.current;
    if (!el || (e.type === 'pointermove' && !(e.buttons & 1) && e.pointerType === 'mouse')) return;
    const r = el.getBoundingClientRect();
    const v = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    el.style.setProperty('--cut', `${v * 100}%`);
    held.current = performance.now() + 3500;
  };

  const buy = async () => {
    if (busy) return;
    setBusy(true);
    track('checkout_start', { plan, why });
    const r = await api<{ url?: string; error?: string }>('/api/checkout', { plan, consent: true, lang: ui.lang });
    if (r.ok && r.data.url) {
      location.href = r.data.url;
      return;
    }
    setBusy(false);
    toast(r.status === 501 ? L('Buying is not open yet.', 'A vásárlás még nem érhető el.') : L('The payment page did not open. Try again.', 'Nem nyílt meg a fizetési oldal. Próbáld újra.'));
  };

  const [fresh, aged] = PAIRS[pair];
  const years: [string, boolean][] = [
    [L('Today', 'Ma'), false],
    ['1', true],
    ['10', true],
    ['30', true],
    ['50', false],
  ];

  return createPortal(
    <div className="pz" role="dialog" aria-modal="true" aria-label={L('Packages', 'Csomagok')}>
      <div className="pz-glow" aria-hidden="true" />
      <button className="pz-x" onClick={close} aria-label={L('Close', 'Bezárás')}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
      </button>

      <div className="pz-grid">
        <section className="pz-hero-col">
          <div
            ref={hero}
            className="pz-hero"
            onPointerDown={(e) => ((e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId), drag(e))}
            onPointerMove={drag}
            role="img"
            aria-label={L('A real InkAge result: the same tattoo today and in 50 years', 'Valódi InkAge-eredmény: ugyanaz a tetoválás ma és 50 év múlva')}
          >
            <img className="pz-img" src={IMG(fresh, 900)} alt="" draggable={false} />
            <img className="pz-img pz-aged" src={IMG(aged, 900)} alt="" draggable={false} />
            <span className="pz-line" aria-hidden="true">
              <i>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6-6 6 6 6M15 6l6 6-6 6" /></svg>
              </i>
            </span>
            <span className="pz-tag l">{L('Today', 'Ma')}</span>
            <span className="pz-tag r">{L('50 years', '50 év')}</span>
            <span className="pz-real">{L('Real InkAge result', 'Valódi InkAge-eredmény')}</span>
            <span className="pz-dots" aria-hidden="true">
              {PAIRS.map((_, i) => (
                <b key={i} className={i === pair ? 'on' : ''} />
              ))}
            </span>
          </div>
          {/* preload the next example, so the swap never flashes */}
          <link rel="preload" as="image" href={IMG(PAIRS[(pair + 1) % PAIRS.length][0], 900)} />
          <link rel="preload" as="image" href={IMG(PAIRS[(pair + 1) % PAIRS.length][1], 900)} />
        </section>

        <section className="pz-main">
          <p className="pz-eyebrow">{first ? L(`For you, ${first}`, `Neked, ${first}`) : L('One-time packages', 'Egyszeri csomagok')}</p>
          <h2 className="pz-title">
            {L('See every year', 'Lásd minden évét')} <span>{L('of your tattoo.', 'a tetoválásodnak.')}</span>
          </h2>
          <p className="pz-sub">
            {why === 'helper'
              ? L('More AI drawings and cut-outs come with any package, together with every year of your previews.', 'Bármelyik csomaggal jönnek a további MI-rajzok és kivágások, és az előnézeteid minden éve.')
              : L('Your trial showed 50 years. A package shows the whole way there, and laser removal too.', 'A próba megmutatta az 50 évet. A csomag az odavezető utat is, és a lézeres eltávolítást is.')}
          </p>

          <div className="pz-time" aria-label={L('Years a package opens', 'A csomaggal megnyíló évek')}>
            <span className="pz-track" aria-hidden="true" />
            {years.map(([label, locked], i) => (
              <span key={i} className={`pz-node ${locked ? 'new' : ''}`}>
                <i>{locked ? <Plus /> : <Check />}</i>
                <b>{label}</b>
                <small>{i === 0 ? '' : L('years', 'év')}</small>
              </span>
            ))}
          </div>
          <p className="pz-time-note">
            <span className="dot" /> {L('opens with a package', 'a csomaggal nyílik')} · {L('laser removal after 3, 6 and 10 sessions', 'lézeres eltávolítás 3, 6 és 10 kezelés után')}
          </p>

          <div className="pz-plans" role="radiogroup" aria-label={L('Packages', 'Csomagok')}>
            {PLANS.map((k) => {
              const q = PLAN[k];
              const s = save(k);
              return (
                <button
                  key={k}
                  role="radio"
                  aria-checked={plan === k}
                  className={`pz-plan ${plan === k ? 'on' : ''}`}
                  onClick={() => (setPlan(k), (picked.current = k), haptic(), track('plan_pick', { plan: k }))}
                >
                  {k === BEST && <span className="pz-pop">{L('Most popular', 'Legnépszerűbb')}</span>}
                  <span className="pz-radio" aria-hidden="true" />
                  <span className="pz-what">
                    <b>{q.name}</b>
                    <small>{L(`${q.n} previews`, `${q.n} előnézet`)}</small>
                  </span>
                  <span className="pz-cost">
                    <b>{fmtUsd(q.usd, loc)}</b>
                    {ft(q.usd) && <span className="pz-ft">{ft(q.usd)}</span>}
                    <small>
                      {s > 0 && <em>−{s}%</em>}
                      {L(`${fmtUsd(q.usd / q.n, loc)} a preview`, `${fmtUsd(q.usd / q.n, loc)} / előnézet`)}
                    </small>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="pz-more">
            <span className="pz-more-ic" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
            </span>
            <span>
              <b>{L('Add more any time', 'Bármikor bővítheted')}</b>
              <small>
                {L(
                  'Need more later? Buy another package whenever you like: 5, 15 or 40 more previews, added to the ones you have.',
                  'Kell még később? Bármikor vehetsz újabb csomagot: még 5, 15 vagy 40 előnézetet, és ezek hozzáadódnak a meglévőkhöz.'
                )}
              </small>
            </span>
          </div>

          <ul className="pz-trust">
            <li>
              <Check /> {L('Pay once, no subscription', 'Egyszer fizetsz, nincs előfizetés')}
            </li>
            <li>
              <Check /> {L('Previews never expire', 'Az előnézetek nem járnak le')}
            </li>
            <li>
              <Check /> {L('Invoice by e-mail', 'Számla e-mailben')}
            </li>
          </ul>
          {huf && ui.lang === 'hu' && (
            <p className="pz-fx-note">A fizetés dollárban történik; a forintösszeg csak tájékoztató a napi árfolyamon, a bankod saját árfolyama dönt.</p>
          )}
        </section>
      </div>

      <footer className="pz-foot">
        <div className="pz-foot-in">
          <button className={`pz-cta ${busy ? 'busy' : ''}`} onClick={buy} disabled={busy}>
            <span>{busy ? L('Opening secure payment…', 'Biztonságos fizetés megnyitása…') : L(`Get ${p.name}`, `${p.name} csomag`)}</span>
            {!busy && (
              <b>
                {fmtUsd(p.usd, loc)}
                {ft(p.usd) && <small className="pz-cta-ft">{ft(p.usd)}</small>}
              </b>
            )}
          </button>
          {/* one quiet line instead of a tick box (owner, 2026-11-07): pressing the button above it is the buyer's express
              request for immediate delivery and the acknowledgement that the 14-day right of withdrawal is lost
              (45/2014 Korm. r. 29. § (1) m); Stripe's page repeats it */}
          <p className="pz-waive">
            {L('Paying gets you the previews right away, so the 14-day right of withdrawal does not apply.', 'A fizetéssel azonnal megkapod az előnézeteket, így a 14 napos elállási jog nem illet meg.')}{' '}
            <a href={`/terms${ui.lang === 'hu' ? '' : `?lang=${ui.lang}`}`} target="_blank" rel="noopener">
              {L('Terms', 'ÁSZF')}
            </a>
          </p>
          <p className="pz-secure">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
            {L('Secure card payment with Stripe', 'Biztonságos kártyás fizetés · Stripe')}
          </p>
        </div>
      </footer>
    </div>,
    document.body
  );
}

const Check = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12.5 10 17 19 7" />
  </svg>
);
const Plus = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
    <path d="M12 5v14M5 12h14" />
  </svg>
);
