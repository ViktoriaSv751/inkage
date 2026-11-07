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

/* real InkAge results, today and 50 years later (the same pictures as the home page and Explore) */
const PAIRS: [string, string][] = [
  ['hf_20261012_125250_eb1fedf5-fe1d-4bff-b203-9f7f6e04435f', 'hf_20261012_125519_356de094-5fd9-4c5d-a3d4-2e41892aa5b4'],
  ['hf_20261013_200843_15e0b201-b6cc-486c-a5a4-9073748b837c', 'hf_20261013_200918_3120c2be-e153-4881-a8f8-04c1cf79fcb4'],
  ['hf_20261013_200843_f699cd39-8d0a-43e3-9ba7-71b494279840', 'hf_20261013_200913_5ffd13b1-e537-4454-bb4c-495a2921afcc'],
  ['hf_20261013_204219_480510e4-c412-4eae-9c90-eab4348178ba', 'hf_20261013_204308_b1d4b7fe-a9f2-4f93-8e19-d070d503ba2e'],
];

/** The packages page: full screen, a moving wall of real results on top, three packages (the cheapest chosen first,
    as in Calligra), what the trial has and a package adds, the withdrawal waiver and a sticky pay button.
    Web only: the store apps never open it (lib/pricing.ts webPaymentsOn + AppProvider canBuy). */
export function Packages({ open, why, onClose }: { open: boolean; why: PaywallWhy; onClose: () => void }) {
  const { ui, toast, profile } = useApp();
  const L = (en: string, hu: string) => tx(ui.lang, en, hu);
  const [plan, setPlan] = useState<PlanId>('mini');
  const [consent, setConsent] = useState(false);
  const [need, setNeed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mounted, setMounted] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const waive = useRef<HTMLLabelElement>(null);
  useScrollLock(open);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    setPlan('mini');
    setNeed(false);
    box.current?.scrollTo(0, 0);
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  if (!mounted || !open) return null;

  const loc = localeOf(ui.lang);
  const first = (profile.name || '').trim().split(/\s+/)[0] || '';
  const head =
    why === 'helper'
      ? L('More AI drawings, every year of your tattoo', 'Több MI-rajz, a tetoválásod minden éve')
      : L('See every year of your tattoo', 'Nézd meg a tetoválásod minden évét');
  const p = PLAN[plan];
  const rows: [string, boolean | string, boolean | string][] = [
    [L('Previews', 'Előnézetek'), '1', String(p.n)],
    [L('Your tattoo today and in 50 years', 'A tetoválásod ma és 50 év múlva'), true, true],
    [L('1, 10 and 30 years', '1, 10 és 30 év'), false, true],
    [L('Laser removal after 3, 6 and 10 sessions', 'Lézeres eltávolítás 3, 6 és 10 kezelés után'), false, true],
    [L('More AI drawings and cut-outs', 'További MI-rajzok és kivágások'), false, true],
    [L('Never expires', 'Nem jár le'), true, true],
  ];
  const cell = (v: boolean | string) =>
    typeof v === 'string' ? <b className="pwx-num">{v}</b> : v ? <Check /> : <Lock />;

  const buy = async () => {
    if (busy) return;
    if (!consent) {
      setNeed(false);
      requestAnimationFrame(() => setNeed(true));
      haptic();
      waive.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      track('pay_blocked', { why: 'waiver', plan });
      return;
    }
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

  const lane = (k: 0 | 1) => (
    <div className="pwx-lane" aria-hidden="true">
      <div className="pwx-run">
        {[0, 1, 2].flatMap((rep) =>
          PAIRS.map((pr, i) => (
            <span className="pwx-card" key={`${rep}-${i}`}>
              <img src={IMG(pr[k], 480)} alt="" decoding="async" loading={rep ? 'lazy' : 'eager'} draggable={false} />
              <em className={k ? 'old' : ''}>{k ? L('50 years', '50 év') : L('Today', 'Ma')}</em>
            </span>
          ))
        )}
      </div>
    </div>
  );

  return createPortal(
    <div className="pwx" role="dialog" aria-modal="true" aria-label={L('Packages', 'Csomagok')} ref={box}>
      <button className="pwx-x" onClick={onClose} aria-label={L('Close', 'Bezárás')}>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
      </button>
      <div className="pwx-wall">
        {lane(0)}
        {lane(1)}
      </div>
      <div className="pwx-body">
        <h2 className="pwx-title">
          {first ? (
            <>
              <em>{first}</em>, {head.charAt(0).toLowerCase() + head.slice(1)}
            </>
          ) : (
            head
          )}
        </h2>
        <p className="pwx-sub">{L('Real results from InkAge. Pay once, no subscription.', 'Valódi InkAge-eredmények. Egyszer fizetsz, nincs előfizetés.')}</p>

        <div className="pwx-tiles" role="radiogroup" aria-label={L('Packages', 'Csomagok')}>
          {PLANS.map((k) => {
            const q = PLAN[k];
            return (
              <button key={k} role="radio" aria-checked={plan === k} className={`pwx-tile ${plan === k ? 'on' : ''} ${k === BEST ? 'best' : ''}`} onClick={() => (setPlan(k), haptic(), track('plan_pick', { plan: k }))}>
                {k === BEST && <span className="pwx-badge">{L('Most popular', 'Legnépszerűbb')}</span>}
                <span className="pwx-name">{q.name}</span>
                <span className="pwx-n">{q.n}</span>
                <span className="pwx-nl">{L('previews', 'előnézet')}</span>
                <span className="pwx-price">{fmtUsd(q.usd, loc)}</span>
                <span className="pwx-each">{L(`${fmtUsd(q.usd / q.n, loc)} a preview`, `${fmtUsd(q.usd / q.n, loc)} / előnézet`)}</span>
                <i className="pwx-dot" aria-hidden="true" />
              </button>
            );
          })}
        </div>

        <div className="pwx-cmp" role="table" aria-label={L('What a package adds', 'Mit ad a csomag')}>
          <div className="pwx-row head" role="row">
            <span role="columnheader" />
            <span role="columnheader">{L('Trial', 'Próba')}</span>
            <span role="columnheader" className="pk">{p.name}</span>
          </div>
          {rows.map(([label, a, b]) => (
            <div className="pwx-row" role="row" key={label}>
              <span role="cell" className="lbl">{label}</span>
              <span role="cell">{cell(a)}</span>
              <span role="cell" className="pk">{cell(b)}</span>
            </div>
          ))}
        </div>

        <label ref={waive} className={`pwx-waive ${need ? 'need' : ''} ${consent ? 'ok' : ''}`}>
          <input type="checkbox" checked={consent} onChange={(e) => (setConsent(e.target.checked), setNeed(false), e.target.checked && track('pay_waive'))} />
          <span>
            {L('I ask for the previews right away, and I accept that this way I lose the 14-day right of withdrawal.', 'Kérem az előnézetek azonnali teljesítését, és tudomásul veszem, hogy ezzel elveszítem a 14 napos elállási jogot.')}{' '}
            <a href={`/terms${ui.lang === 'hu' ? '' : `?lang=${ui.lang}`}`} target="_blank" rel="noopener">
              {L('Terms', 'ÁSZF')}
            </a>
          </span>
        </label>
        <p className="pwx-fine">{L('Secure card payment with Stripe. You get an invoice by e-mail.', 'Biztonságos kártyás fizetés a Stripe-pal. A számlát e-mailben kapod.')}</p>
      </div>
      <div className="pwx-foot">
        <button className="pwx-pay" onClick={buy} disabled={busy}>
          {busy ? L('Opening the payment page…', 'Fizetési oldal megnyitása…') : L(`Continue with ${p.name} · ${fmtUsd(p.usd, loc)}`, `Tovább: ${p.name} · ${fmtUsd(p.usd, loc)}`)}
        </button>
      </div>
    </div>,
    document.body
  );
}

const Check = () => (
  <svg className="pwx-ck" viewBox="0 0 24 24" aria-label="✓" role="img">
    <path d="M5 12.5 10 17 19 7" />
  </svg>
);
const Lock = () => (
  <svg className="pwx-lk" viewBox="0 0 24 24" aria-label="🔒" role="img">
    <rect x="5.5" y="11" width="13" height="9" rx="2" />
    <path d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3" />
  </svg>
);
