'use client';
import { useState } from 'react';
import { useApp } from '../AppProvider';
import { tx } from '@/lib/i18n';
import { localeOf } from '@/lib/tr';
import { api } from '@/lib/sb';
import { track } from '@/lib/store';
import { BEST, fmtUsd, PLAN, PLANS, type PlanId } from '@/lib/pricing';
import { Sheet } from './Sheet';

export type PaywallWhy = 'previews' | 'locked' | 'helper' | 'menu';

/** The three packages. Web only: the store apps never open it (lib/pricing.ts webPaymentsOn + AppProvider). */
export function Packages({ open, why, onClose }: { open: boolean; why: PaywallWhy; onClose: () => void }) {
  const { ui, toast } = useApp();
  const L = (en: string, hu: string) => tx(ui.lang, en, hu);
  const [plan, setPlan] = useState<PlanId>(BEST);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const loc = localeOf(ui.lang);
  const head =
    why === 'locked'
      ? L('See every year of your tattoo', 'Nézd meg a tetoválásod minden évét')
      : why === 'helper'
        ? L('More AI drawings come with a package', 'További MI-rajzok a csomaggal')
        : why === 'previews'
          ? L('You used your trial preview', 'Elhasználtad a kipróbálást')
          : L('Packages', 'Csomagok');
  const sub = L(
    'Each preview shows your tattoo fresh and after 1, 10, 30 and 50 years, or after 3, 6 and 10 laser sessions. Pay once, no subscription.',
    'Minden előnézet megmutatja a tetoválásod frissen és 1, 10, 30 és 50 év múlva, vagy 3, 6 és 10 lézeres kezelés után. Egyszer fizetsz, nincs előfizetés.'
  );
  const buy = async () => {
    if (!consent || busy) return;
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
  return (
    <Sheet open={open} onClose={onClose} label="Packages">
      <h2>{head}</h2>
      <p className="sub">{sub}</p>
      <div className="pkgs" role="radiogroup" aria-label={L('Packages', 'Csomagok')}>
        {PLANS.map((k) => {
          const p = PLAN[k];
          return (
            <button key={k} role="radio" aria-checked={plan === k} className={`pkg ${plan === k ? 'on' : ''}`} onClick={() => setPlan(k)}>
              {k === BEST && <em className="pkg-badge">{L('Most popular', 'Legnépszerűbb')}</em>}
              <b>{p.name}</b>
              <span className="pkg-n">{L(`${p.n} previews`, `${p.n} előnézet`)}</span>
              <span className="pkg-price">{fmtUsd(p.usd, loc)}</span>
              <small>{L(`${fmtUsd(p.usd / p.n, loc)} a preview`, `${fmtUsd(p.usd / p.n, loc)} / előnézet`)}</small>
            </button>
          );
        })}
      </div>
      <ul className="pkg-list">
        <li>{L('Every year: 1, 10, 30 and 50', 'Minden év: 1, 10, 30 és 50')}</li>
        <li>{L('Laser removal after 3, 6 and 10 sessions', 'Lézeres eltávolítás 3, 6 és 10 kezelés után')}</li>
        <li>{L('Your previews never expire', 'Az előnézeteid nem járnak le')}</li>
      </ul>
      <label className="pkg-consent">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>
          {L(
            'I ask for the previews right away, and I accept that this way I lose the 14-day right of withdrawal.',
            'Kérem az előnézetek azonnali teljesítését, és tudomásul veszem, hogy ezzel elveszítem a 14 napos elállási jogot.'
          )}{' '}
          <a href={`/terms${ui.lang === 'hu' ? '' : `?lang=${ui.lang}`}`} target="_blank" rel="noopener">
            {L('Terms', 'ÁSZF')}
          </a>
        </span>
      </label>
      <button className="btn wide" disabled={!consent || busy} onClick={buy}>
        {busy ? L('Opening the payment page…', 'Fizetési oldal megnyitása…') : L(`Continue with ${PLAN[plan].name} · ${fmtUsd(PLAN[plan].usd, loc)}`, `Tovább: ${PLAN[plan].name} · ${fmtUsd(PLAN[plan].usd, loc)}`)}
      </button>
      <p className="pkg-fine">{L('Secure card payment with Stripe. You get an invoice by e-mail.', 'Biztonságos kártyás fizetés a Stripe-pal. A számlát e-mailben kapod.')}</p>
    </Sheet>
  );
}
