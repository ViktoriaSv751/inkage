'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useApp, type Me } from '../AppProvider';
import { tx, type Lang } from '@/lib/i18n';
import { api } from '@/lib/sb';
import { track } from '@/lib/store';
import { B2B, isB2BPlan } from '@/lib/b2b';
import { Sheet } from './Sheet';

/* Studio and clinic accounts inside the app (2026-11-12). A "studio account" has its own b2b_subs row (any status) or
   is a member of a studio's team (public.b2b_team): its previews come from the studio's monthly plan, so it never sees the
   consumer packages or the teaser. The numbers come from public.b2b_me(), loaded with the account (AppProvider).
   The store apps show no way to buy at all (App Store rules: no link to paying on the web), only the numbers. */

/** public.b2b_me() */
export type StudioMe = {
  studio: boolean;
  role?: 'owner' | 'member';
  company?: string | null;
  ownerEmail?: string | null;
  plan?: string | null;
  status?: 'trial' | 'trial_ended' | 'active' | 'past_due' | 'canceled' | string;
  trial?: boolean;
  trialEndsAt?: string | null;
  trialDaysLeft?: number | null;
  trialTotal?: number | null;
  remaining?: number;
  usedPeriod?: number;
  periodStart?: string | null;
  refill?: number | null;
  extra?: number;
  carried?: number;
  nextRefill?: string | null;
  periodEnd?: string | null;
  cancelAtPeriodEnd?: boolean;
  low?: boolean;
  seats?: number;
  members?: number;
};

export const isNativeApp = () => typeof window !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform?.();
export const isClinic = (me: Me) => !!me.studio && me.b2b?.plan === 'b2b_clinic';

/** "dec. 12." / "Dec 12" */
export const fmtDay = (lang: string, iso?: string | null) => {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat(lang === 'hu' ? 'hu-HU' : lang, { month: 'short', day: 'numeric' }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
};

export const planName = (plan?: string | null) => (isB2BPlan(plan) ? B2B[plan].name : null);

/** "Számláim és előfizetés": the Stripe customer portal (web only, the subscription's owner only) */
export async function openPortal(lang: Lang, toast: (m: string) => void) {
  track('studio_portal');
  const r = await api<{ url?: string; error?: string }>('/api/b2b/portal', {});
  if (r.ok && r.data.url) return void location.assign(r.data.url);
  toast(
    r.status === 404
      ? tx(lang, 'There is no subscription on this account yet.', 'Ezen a fiókon még nincs előfizetés.')
      : tx(lang, 'The billing page did not open. Try again in a minute.', 'A számlázási oldal nem nyílt meg. Próbáld újra egy perc múlva.')
  );
}

/** the meter's lines: what was used, what is left and when it fills up again */
function lines(b: StudioMe, lang: Lang, native: boolean) {
  const t = (en: string, hu: string) => tx(lang, en, hu);
  const rem = Math.max(0, b.remaining ?? 0);
  const out: { main: string; note?: string } = { main: '' };
  if (b.status === 'trial') {
    const d = b.trialDaysLeft ?? 0;
    const tot = b.trialTotal ?? rem;
    out.main = t(`Trial: ${d} day${d === 1 ? '' : 's'} left · ${rem}/${tot} previews left`, `Próba: még ${d} nap · ${rem}/${tot} előnézet maradt`);
  } else {
    const used = b.usedPeriod ?? 0;
    const carried = b.carried ?? 0;
    const next = b.nextRefill ? fmtDay(lang, b.nextRefill) : '';
    out.main =
      t(`This month: ${used} used · ${rem} left`, `Ebben a hónapban: ${used} felhasználva · ${rem} maradt`) +
      (carried > 0 ? t(` (${carried} carried over)`, ` (ebből ${carried} áthozott)`) : '') +
      (next ? t(` · next refill: ${next}`, ` · következő feltöltés: ${next}`) : '');
    if (b.status === 'trial_ended') out.main = t(`The trial has ended · ${rem} previews left`, `A próba véget ért · ${rem} előnézet maradt`);
    else if (b.status === 'canceled') out.main = t(`Subscription ended · ${rem} previews left`, `Az előfizetés véget ért · ${rem} előnézet maradt`);
    else if (b.cancelAtPeriodEnd && b.periodEnd) out.main += t(` · cancelled, runs until ${fmtDay(lang, b.periodEnd)}`, ` · lemondva, ${fmtDay(lang, b.periodEnd)}-ig él`);
    if (b.status === 'past_due') out.note = t('The last payment did not go through yet.', 'Az utolsó fizetés még nem ment át.');
  }
  if (!out.note && rem <= 5) {
    if (rem === 0) out.note = t('No previews left.', 'Elfogytak az előnézetek.');
    else if (b.role === 'member') out.note = t(`Only ${rem} left. Let the studio's account owner know.`, `Már csak ${rem} maradt. Szólj a szalon fiókgazdájának.`);
    else if (native) out.note = t(`Only ${rem} left.`, `Már csak ${rem} maradt.`);
    else out.note = t(`Only ${rem} left. An add-on pack tops it up any time.`, `Már csak ${rem} maradt. Kiegészítő csomaggal bármikor bővítheted.`);
  }
  return out;
}

/** a small bar at the top of the gallery, the start screen and the profile (studio accounts only) */
export function StudioMeter({ where }: { where: 'home' | 'profile' }) {
  const { me, ui } = useApp();
  const b = me.b2b;
  if (!me.studio || !b?.studio) return null;
  const native = isNativeApp();
  const l = lines(b, ui.lang, native);
  const rem = Math.max(0, b.remaining ?? 0);
  const tot = b.status === 'trial' ? b.trialTotal || 0 : (b.usedPeriod ?? 0) + rem;
  const pct = tot > 0 ? Math.min(100, Math.round((rem / tot) * 100)) : 0;
  return (
    <div className={`studio-meter ${where} ${rem <= 5 ? 'low' : ''}`} role="status">
      <div className="studio-meter-top">
        <b>{b.company || planName(b.plan) || tx(ui.lang, 'Studio account', 'Szalonfiók')}</b>
        {planName(b.plan) && b.company && <span>{planName(b.plan)}</span>}
      </div>
      <div className="studio-meter-bar" aria-hidden="true">
        <i style={{ width: `${pct}%` }} />
      </div>
      <p>{l.main}</p>
      {l.note && <p className="studio-meter-note">{l.note}</p>}
    </div>
  );
}

/** Profile: the studio's links (team page; billing in the Stripe portal on the web, owner only) */
export function StudioLinks() {
  const { me, ui, toast } = useApp();
  const [busy, setBusy] = useState(false);
  const t = (en: string, hu: string) => tx(ui.lang, en, hu);
  if (!me.studio || !me.b2b?.studio) return null;
  const owner = me.b2b.role === 'owner';
  return (
    <div className="studio-links">
      <Link className="pf-edit" href="/app/csapat">
        {owner ? t('Team', 'Csapat') : t('My team', 'Csapatom')}
        {owner && (me.b2b.seats ?? 1) > 1 ? ` · ${(me.b2b.members ?? 0) + 1}/${me.b2b.seats}` : ''}
      </Link>
      {owner && !isNativeApp() && (
        <button
          className="pf-edit"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await openPortal(ui.lang, toast);
            setBusy(false);
          }}
        >
          {busy ? t('Opening…', 'Megnyitás…') : t('My invoices and subscription', 'Számláim és előfizetés')}
        </button>
      )}
    </div>
  );
}

/** instead of the consumer packages: how many are left and when they come; plan links on the web for the owner */
export function StudioSheet({ open, onClose, me, lang }: { open: boolean; onClose: () => void; me: Me; lang: Lang }) {
  const t = (en: string, hu: string) => tx(lang, en, hu);
  const b = me.b2b;
  if (!me.studio) return null;
  const native = isNativeApp();
  const rem = Math.max(0, b?.remaining ?? me.remaining ?? 0);
  const owner = b?.role !== 'member';
  return (
    <Sheet open={open} onClose={onClose} label={t('Your previews', 'Előnézeteid')}>
      <h2>{rem === 0 ? t('No previews left', 'Elfogytak az előnézetek') : t(`Your previews: ${rem}`, `Előnézeteid: ${rem}`)}</h2>
      {rem === 0 && <p className="sub">{t('Your previews: 0', 'Előnézeteid: 0')}</p>}
      {b?.nextRefill && <p className="sub">{t(`Next refill: ${fmtDay(lang, b.nextRefill)}`, `Következő feltöltés: ${fmtDay(lang, b.nextRefill)}`)}</p>}
      {b?.status === 'trial' && (
        <p className="sub">
          {t(`Trial: ${b.trialDaysLeft ?? 0} days left`, `Próba: még ${b.trialDaysLeft ?? 0} nap`)}
          {b.trialEndsAt ? t(` (until ${fmtDay(lang, b.trialEndsAt)})`, ` (${fmtDay(lang, b.trialEndsAt)}-ig)`) : ''}
        </p>
      )}
      {b?.status === 'trial_ended' && <p className="sub">{t('The trial has ended.', 'A próba véget ért.')}</p>}
      {!native && owner && (
        <div style={{ display: 'grid', gap: 8, marginTop: 14 }}>
          <a className="btn wide" href="/szalonoknak#csomagok" onClick={() => track('studio_plans_tap')}>
            {t('Change plan / subscribe', 'Csomagváltás / előfizetés')}
          </a>
          <a className="btn wide ghost" href="/szalonoknak#kiegeszito" onClick={() => track('studio_addon_tap')}>
            {t('Add-on pack', 'Kiegészítő csomag')}
          </a>
        </div>
      )}
      {!native && !owner && (
        <p className="sub">
          {t('Previews come from your studio’s plan. Ask the account owner', 'Az előnézetek a szalonod előfizetéséből jönnek. Szólj a fiókgazdának')}
          {b?.ownerEmail ? ` (${b.ownerEmail})` : ''}.
        </p>
      )}
      <button className="btn wide ghost" style={{ marginTop: 8 }} onClick={onClose}>
        {t('Close', 'Bezárás')}
      </button>
    </Sheet>
  );
}
