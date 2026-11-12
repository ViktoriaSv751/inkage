'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/sb';
import { tx, type Lang } from '@/lib/tr';
import { countB2B } from '@/lib/track';
import { B2B, B2B_PLANS, B2B_TOPUP, B2B_TRIAL, YEAR_MONTHS_PAID, baseOf, huf, intervalOf, isB2BPlan, planName, yearHuf, type B2BBase, type B2BInterval, type B2BPlan } from '@/lib/b2b';

type Status = 'none' | 'trial' | 'trial_ended' | 'active' | 'past_due' | 'canceled';
type Sub = { company: string | null; tax_number?: string | null; plan: B2BPlan | null; status: Status; trial_ends_at: string | null; current_period_end: string | null; cancel_at_period_end: boolean | null } | null;
type Me = { signedIn: boolean; email?: string; sub: Sub };

/** Plans, trial, subscription, plan change and top-up for studios and clinics (2026-11-12). Hungarian first. */
export function B2BPanel({ refCode, lang }: { refCode: string; lang: Lang }) {
  const T = (en: string, hu: string) => tx(lang, en, hu);
  const en = lang !== 'hu';
  const day = (s: string | null) => (s ? new Date(s).toLocaleDateString(en ? 'en-GB' : 'hu-HU', { month: 'long', day: 'numeric' }).replace(/\.$/, '') : '');
  const [me, setMe] = useState<Me | null>(null);
  const [plan, setPlan] = useState<B2BBase>('b2b_pro');
  const [interval, setInterval] = useState<B2BInterval>('month');
  const [company, setCompany] = useState('');
  const [tax, setTax] = useState('');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [note, setNote] = useState('');
  const q = typeof window !== 'undefined' ? new URLSearchParams(location.search) : null;
  const back = q?.get('elofizetes') ?? null;
  const topupBack = q?.get('kiegeszito') ?? null;
  const load = () =>
    api<Me>('/api/b2b/me').then((r) => {
      const m = r.ok ? r.data : { signedIn: false, sub: null };
      setMe(m);
      if (m.sub?.company) setCompany((c) => c || m.sub!.company || '');
      if (m.sub?.tax_number) setTax((t) => t || m.sub!.tax_number || '');
    });
  useEffect(() => {
    load();
    countB2B('b2b_view', { b2bref: refCode || undefined });
    if (back === 'ok') countB2B('b2b_subscribed', { b2bref: refCode || undefined });
    if (back === 'ok' || topupBack === 'ok') {
      // the webhook adds the previews within seconds
      const t = [2500, 6000, 12000].map((ms) => setTimeout(load, ms));
      return () => t.forEach(clearTimeout);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const errText = (r: { status: number; data: any }) =>
    r.data?.reason === 'company_exists'
      ? T('This studio already had a trial. Choose a plan below, or write to us.', 'Ez a szalon már kipróbálta az InkAge-et. Válassz csomagot lent, vagy írj nekünk.')
      : r.data?.reason === 'exists'
        ? T('This account already had a trial. Choose a plan below.', 'Ezen a fiókon már volt próba. Válassz csomagot lent.')
        : r.data?.error === 'already_subscribed'
          ? T('You already have a subscription: change it below.', 'Már van előfizetésed: lent tudod módosítani.')
          : r.data?.error === 'company_required'
            ? T('Add the studio or company name (it goes on the invoice).', 'Add meg a szalon vagy a cég nevét (a számlára kerül).')
            : r.data?.error === 'bad_tax'
              ? T('The tax number looks wrong (e.g. 12345678-1-42).', 'Az adószám formája nem jó (pl. 12345678-1-42).')
              : r.data?.error === 'payments_not_configured'
                ? T('Payment is not available right now. Write to us and we’ll set it up.', 'A fizetés most nem érhető el. Írj nekünk, és beállítjuk.')
                : T('That didn’t work. Try again in a minute.', 'Nem sikerült. Próbáld újra egy perc múlva.');

  const go = async (path: string, body: object, key: string) => {
    setBusy(key);
    setMsg('');
    setNote('');
    const r = await api<any>(path, body);
    if (r.ok && r.data.url) return void (location.href = r.data.url);
    setBusy('');
    if (r.ok) {
      if (r.data?.plan && r.data?.from) setNote(T(`Done: from the next renewal your plan is ${planName(r.data.plan, true)}.`, `Kész: a következő megújulástól ${planName(r.data.plan)} csomagod lesz.`));
      return load();
    }
    setMsg(errText(r));
  };
  const signIn = `/regisztracio?next=${encodeURIComponent('/szalonoknak')}`;
  const sub = me?.sub;
  const st = sub?.status;
  const subscribed = st === 'active' || st === 'past_due';
  const curPlan = sub?.plan && isB2BPlan(sub.plan) ? sub.plan : null;
  const price = (b: B2BBase) => (interval === 'year' ? yearHuf(b) : B2B[b].huf);

  return (
    <section className="b2b" id="csomagok">
      <h2>{T('Plans for studios and clinics', 'Csomagok szalonoknak és klinikáknak')}</h2>
      <p className="b2b-sub">
        {T(
          'Every preview is on the guest’s own photo: today, after 1, 10, 30 and 50 years, and after 3, 6 and 10 laser sessions, with no watermark and a link you can send to the guest. Unused previews carry over. Cancel any time.',
          'Minden előnézet a vendég saját fotóján: ma, 1, 10, 30 és 50 év múlva, illetve 3, 6 és 10 lézeres kezelés után, vízjel nélkül, a vendégnek elküldhető linkkel. A fel nem használt előnézetek megmaradnak. Bármikor lemondható.'
        )}
      </p>

      {back === 'ok' && (
        <div className="b2b-done">
          <b>{T('Thank you for subscribing!', 'Köszönjük az előfizetést!')}</b>
          <p>{T('Your previews appear in your account within seconds. The invoice comes by e-mail.', 'Az előnézetek pár másodpercen belül megjelennek a fiókodban. A számlát e-mailben kapod.')}</p>
        </div>
      )}
      {topupBack === 'ok' && (
        <div className="b2b-done">
          <b>{T(`+${B2B_TOPUP.n} previews added`, `+${B2B_TOPUP.n} előnézet hozzáadva`)}</b>
          <p>{T('They appear in your account within seconds.', 'Pár másodpercen belül megjelennek a fiókodban.')}</p>
        </div>
      )}

      {sub && st !== 'none' && (
        <div className="b2b-status">
          {st === 'trial' && (
            <>
              <b>{T('Your trial is running', 'Fut a próbád')}</b> – {T(`${B2B_TRIAL.n} previews until ${day(sub.trial_ends_at)}.`, `${B2B_TRIAL.n} előnézet ${day(sub.trial_ends_at)}-ig.`)}{' '}
              {T('If you subscribe, the trial previews you have left stay with you.', 'Ha előfizetsz, a próbából megmaradt előnézetek is megmaradnak.')}
            </>
          )}
          {st === 'trial_ended' && <><b>{T('Your trial has ended.', 'Lejárt a próbád.')}</b> {T('Choose a plan to carry on.', 'Válassz csomagot, és folytathatjátok.')}</>}
          {st === 'active' && curPlan && (
            <>
              <b>{T('Active plan', 'Aktív előfizetés')}: {planName(curPlan, en)}</b> – {T(`${B2B[baseOf(curPlan)].n} previews a month`, `${B2B[baseOf(curPlan)].n} előnézet havonta`)}
              {sub.current_period_end ? T(`, renews ${day(sub.current_period_end)}`, `, következő ${intervalOf(curPlan) === 'year' ? 'éves ' : ''}forduló: ${day(sub.current_period_end)}`) : ''}
              {sub.cancel_at_period_end ? T(' (cancelled, runs until then)', ' (lemondva, eddig jár)') : ''}.
            </>
          )}
          {st === 'past_due' && <><b>{T('The last payment didn’t go through.', 'A legutóbbi díj nem ment át.')}</b> {T('Update your card under Manage subscription.', 'Frissítsd a kártyát az Előfizetés kezelésénél.')}</>}
          {st === 'canceled' && <><b>{T('Subscription ended.', 'Az előfizetés lejárt.')}</b> {T('You can still use the previews you have left, and restart any time below.', 'A megmaradt előnézeteidet továbbra is használhatod, és bármikor újraindíthatod lent.')}</>}
          <div className="b2b-row">
            <a className="b2b-go ghost" href="/app">{T('Open InkAge', 'Megnyitom az InkAge-et')}</a>
            {(subscribed || st === 'canceled') && (
              <button className="b2b-go ghost" disabled={!!busy} onClick={() => (countB2B('b2b_portal'), go('/api/b2b/portal', {}, 'portal'))}>
                {busy === 'portal' ? T('Opening…', 'Megnyitás…') : T('Manage subscription and invoices', 'Előfizetés és számlák kezelése')}
              </button>
            )}
          </div>
        </div>
      )}
      {note && <p className="b2b-done" role="status">{note}</p>}

      {!subscribed && (
        <div className="b2b-int" role="radiogroup" aria-label={T('Billing', 'Fizetés')}>
          <button type="button" role="radio" aria-checked={interval === 'month'} className={interval === 'month' ? 'on' : ''} onClick={() => setInterval('month')}>{T('Monthly', 'Havi')}</button>
          <button type="button" role="radio" aria-checked={interval === 'year'} className={interval === 'year' ? 'on' : ''} onClick={() => setInterval('year')}>
            {T(`Annual (${YEAR_MONTHS_PAID} months’ price for 12)`, `Éves (12 hónap ${YEAR_MONTHS_PAID} hónap áráért)`)}
          </button>
        </div>
      )}

      <div className="b2b-plans" role="radiogroup" aria-label={T('Plans', 'Csomagok')}>
        {B2B_PLANS.map((k) => {
          const mine = curPlan && baseOf(curPlan) === k;
          return (
            <button type="button" key={k} role="radio" aria-checked={plan === k} className={`b2b-plan ${plan === k ? 'on' : ''}`} onClick={() => setPlan(k)}>
              {k === 'b2b_pro' && <span className="b2b-pop">{T('Most popular', 'Legnépszerűbb')}</span>}
              {mine && <span className="b2b-pop mine">{T('Your plan', 'A te csomagod')}</span>}
              <b>{B2B[k].name}</b>
              <span className="b2b-price">
                {huf(subscribed && curPlan ? (intervalOf(curPlan) === 'year' ? yearHuf(k) : B2B[k].huf) : price(k))}
                <small> / {(subscribed && curPlan ? intervalOf(curPlan) : interval) === 'year' ? T('year', 'év') : T('month', 'hó')}</small>
              </span>
              <span className="b2b-n">{T(`${B2B[k].n} previews / month`, `${B2B[k].n} előnézet / hó`)}</span>
              <small className="b2b-who">{en ? B2B[k].whoEn : B2B[k].who}</small>
            </button>
          );
        })}
      </div>

      <div className="b2b-form">
        {me && !me.signedIn && (
          <>
            <h3>{T('Start with a 2-week trial', 'Kezdjétek egy 2 hetes próbával')}</h3>
            <p className="b2b-sub">
              {T(`${B2B_TRIAL.n} previews for ${B2B_TRIAL.days} days, no card. One-tap sign-up with Google or Apple, then one button.`, `${B2B_TRIAL.n} előnézet ${B2B_TRIAL.days} napra, kártya nélkül. Egy koppintásos regisztráció Google- vagy Apple-fiókkal, utána egy gombnyomás.`)}
            </p>
            <a className="b2b-go" href={signIn} onClick={() => countB2B('b2b_trial', { b2bref: refCode || undefined, plan: 'signup' })}>
              {T('Sign up and start the trial', 'Regisztrálok és indítom a próbát')}
            </a>
            <small className="b2b-note">
              {T('Already have an account?', 'Már van fiókod?')} <a href={`/belepes?next=${encodeURIComponent('/szalonoknak')}`}>{T('Sign in', 'Belépés')}</a>
            </small>
          </>
        )}

        {me?.signedIn && (!sub || st === 'none') && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              countB2B('b2b_trial', { b2bref: refCode || undefined });
              go('/api/b2b/trial', { company, kind: fd.get('kind'), ref: refCode }, 'trial');
            }}
          >
            <h3>{T('Start the 2-week trial', 'Indítsátok el a 2 hetes próbát')}</h3>
            <p className="b2b-sub">{T(`${B2B_TRIAL.n} previews for ${B2B_TRIAL.days} days, no card. Account: ${me.email}`, `${B2B_TRIAL.n} előnézet ${B2B_TRIAL.days} napra, kártya nélkül. Fiók: ${me.email}`)}</p>
            <label>
              {T('Studio / clinic name', 'Szalon / klinika neve')}
              <input name="company" required maxLength={120} value={company} onChange={(e) => setCompany(e.target.value)} />
            </label>
            <label>
              {T('What do you do?', 'Mivel foglalkoztok?')}
              <select name="kind" defaultValue="studio">
                <option value="studio">{T('Tattoo studio', 'Tetoválószalon')}</option>
                <option value="clinic">{T('Laser removal', 'Lézeres eltávolítás')}</option>
                <option value="other">{T('Other', 'Más')}</option>
              </select>
            </label>
            <button className="b2b-go" disabled={!!busy}>{busy === 'trial' ? T('Starting…', 'Indítás…') : T('Start the trial', 'Indítom a próbát')}</button>
          </form>
        )}

        {me?.signedIn && !subscribed && (
          <div className="b2b-buy">
            <h3>{T('Subscribe', 'Előfizetés')}</h3>
            <label>
              {T('Company or studio name (on the invoice)', 'Cég vagy szalon neve (a számlára)')}
              <input value={company} onChange={(e) => setCompany(e.target.value)} maxLength={120} autoComplete="organization" />
            </label>
            <label>
              {T('Tax number (if you have one)', 'Adószám (ha van)')}
              <input value={tax} onChange={(e) => setTax(e.target.value)} maxLength={30} placeholder="12345678-1-42" inputMode="text" />
            </label>
            <button
              className={`b2b-go ${sub && st !== 'none' ? '' : 'ghost'}`}
              disabled={!!busy}
              onClick={() => (countB2B('b2b_checkout', { b2bref: refCode || undefined, plan: interval === 'year' ? `${plan}_y` : plan }), go('/api/b2b/subscribe', { plan, interval, company, tax, ref: refCode }, 'sub'))}
            >
              {busy === 'sub' ? T('Opening secure payment…', 'Biztonságos fizetés megnyitása…') : T(`Subscribe: ${B2B[plan].name}, ${huf(price(plan))} / ${interval === 'year' ? 'year' : 'month'}`, `Előfizetek: ${B2B[plan].name}, ${huf(price(plan))} / ${interval === 'year' ? 'év' : 'hó'}`)}
            </button>
          </div>
        )}

        {subscribed && curPlan && baseOf(curPlan) !== plan && (
          <div className="b2b-buy">
            <h3>{T('Change plan', 'Csomagváltás')}</h3>
            <p className="b2b-sub">{T('The new plan starts at your next renewal, with no extra charge now. Need more previews today? Use the top-up below.', 'Az új csomag a következő megújulástól él, most nincs külön díj. Ha már ma több előnézet kell, használd lent a kiegészítő csomagot.')}</p>
            <button className="b2b-go" disabled={!!busy} onClick={() => (countB2B('b2b_change', { plan }), go('/api/b2b/change', { plan }, 'change'))}>
              {busy === 'change' ? T('Saving…', 'Mentés…') : T(`Switch to ${B2B[plan].name}`, `Váltás erre: ${B2B[plan].name}`)}
            </button>
          </div>
        )}

        {msg && <p className="b2b-err">{msg}</p>}
        <small className="b2b-note">
          {T('Card payment through Stripe. Invoice by e-mail. Cancel any time (it runs until the end of the paid period).', 'Fizetés bankkártyával a Stripe-on. Számla e-mailben. Bármikor lemondható (a kifizetett időszak végéig tart).')}{' '}
          <a href="/terms">{T('Terms', 'ÁSZF')}</a> · <a href="/szalonoknak/adatfeldolgozas">{T('Data processing', 'Adatfeldolgozás')}</a> · <a href="/privacy">{T('Privacy', 'Adatkezelés')}</a>
        </small>
      </div>

      {me?.signedIn && sub && st !== 'none' && (
        <div className="b2b-buy" id="kiegeszito">
          <h3>{T(`Top-up: +${B2B_TOPUP.n} previews`, `Kiegészítő csomag: +${B2B_TOPUP.n} előnézet`)}</h3>
          <p className="b2b-sub">{T(`For a busy month, without changing plan. ${huf(B2B_TOPUP.huf)}, one-time, the previews don’t expire.`, `Forgalmas hónapra, csomagváltás nélkül. ${huf(B2B_TOPUP.huf)}, egyszeri, az előnézetek nem járnak le.`)}</p>
          <button className="b2b-go ghost" disabled={!!busy} onClick={() => (countB2B('b2b_topup'), go('/api/b2b/topup', {}, 'topup'))}>
            {busy === 'topup' ? T('Opening secure payment…', 'Biztonságos fizetés megnyitása…') : T(`Buy +${B2B_TOPUP.n} previews`, `Megveszem: +${B2B_TOPUP.n} előnézet`)}
          </button>
        </div>
      )}

      <div className="b2b-contact">
        <b>{T('Questions first?', 'Előbb kérdeznél?')}</b> {T('Write to us, we answer within a working day.', 'Írj nekünk, egy munkanapon belül válaszolunk.')}{' '}
        <a href={en ? '/kapcsolat?lang=en' : '/kapcsolat'} onClick={() => countB2B('b2b_contact')}>{T('Contact us', 'Kapcsolat')}</a>
      </div>
    </section>
  );
}
