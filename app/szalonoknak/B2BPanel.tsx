'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/sb';
import { B2B, B2B_PLANS, B2B_TRIAL, huf, type B2BPlan } from '@/lib/b2b';

type Sub = { company: string | null; plan: B2BPlan | null; status: 'trial' | 'trial_ended' | 'active' | 'past_due' | 'canceled'; trial_ends_at: string | null; current_period_end: string | null; cancel_at_period_end: boolean | null } | null;
const day = (s: string | null) => (s ? new Date(s).toLocaleDateString('hu-HU', { month: 'long', day: 'numeric' }) : '');

/** Monthly plans for studios and clinics: start the 14-day trial (no card), subscribe through Stripe, manage it in
    Stripe's portal. Hungarian only, like the outreach (2026-11-12). */
export function B2BPanel({ refCode }: { refCode: string }) {
  const [me, setMe] = useState<{ signedIn: boolean; email?: string; sub: Sub } | null>(null);
  const [plan, setPlan] = useState<B2BPlan>('b2b_pro');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const back = typeof window !== 'undefined' ? new URLSearchParams(location.search).get('elofizetes') : null;
  const load = () => api<any>('/api/b2b/me').then((r) => setMe(r.ok ? r.data : { signedIn: false, sub: null }));
  useEffect(() => {
    load();
    if (back === 'ok') {
      // the webhook adds the month within seconds
      const t = [2500, 6000, 12000].map((ms) => setTimeout(load, ms));
      return () => t.forEach(clearTimeout);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const go = async (path: string, body: object, key: string) => {
    setBusy(key);
    setMsg('');
    const r = await api<any>(path, body);
    if (r.ok && r.data.url) return void (location.href = r.data.url);
    setBusy('');
    if (r.ok) return load();
    setMsg(r.status === 409 ? 'Ezen a fiókon már volt próba. Válassz csomagot lent.' : r.data?.error === 'payments_not_configured' ? 'A fizetés most nem érhető el. Írj nekünk, és beállítjuk.' : 'Nem sikerült. Próbáld újra egy perc múlva.');
  };
  const signIn = `/regisztracio?next=${encodeURIComponent('/szalonoknak')}`;
  const sub = me?.sub;
  const subscribed = sub && (sub.status === 'active' || sub.status === 'past_due');

  return (
    <section className="b2b">
      <h2 id="csomagok">Havidíjas csomagok</h2>
      <p className="b2b-sub">Minden előnézet a vendég saját fotóján: ma, 1, 10, 30 és 50 év múlva, illetve 3, 6 és 10 lézeres kezelés után, vízjel nélkül, a vendégnek elküldhető linkkel. A fel nem használt előnézetek megmaradnak a következő hónapra. Bármikor lemondható.</p>

      {back === 'ok' && <div className="b2b-done"><b>Köszönjük az előfizetést!</b><p>A havi előnézetek pár másodpercen belül megjelennek a fiókodban. A számlát e-mailben kapod.</p></div>}

      {sub && (
        <div className="b2b-status">
          {sub.status === 'trial' && <><b>Fut a próbád</b> – {B2B_TRIAL.n} előnézet {day(sub.trial_ends_at)}-ig. Ha tetszik, válassz csomagot lent, és a próbából megmaradt előnézetek is megmaradnak.</>}
          {sub.status === 'trial_ended' && <><b>Lejárt a próbád.</b> Válassz csomagot, és folytathatjátok.</>}
          {sub.status === 'active' && sub.plan && <><b>Aktív előfizetés: {B2B[sub.plan].name}</b> – {B2B[sub.plan].n} előnézet havonta{sub.current_period_end ? `, következő forduló: ${day(sub.current_period_end)}` : ''}{sub.cancel_at_period_end ? ' (lemondva, eddig jár)' : ''}.</>}
          {sub.status === 'past_due' && <><b>A legutóbbi havidíj nem ment át.</b> Frissítsd a kártyát az előfizetés kezelésénél.</>}
          {sub.status === 'canceled' && <><b>Az előfizetés lemondva.</b> A megmaradt előnézeteidet továbbra is használhatod; bármikor újraindíthatod lent.</>}
          <div className="b2b-row">
            <a className="b2b-go ghost" href="/app">Megnyitom az InkAge-et</a>
            {(subscribed || sub.status === 'canceled') && <button className="b2b-go ghost" disabled={!!busy} onClick={() => go('/api/b2b/portal', {}, 'portal')}>{busy === 'portal' ? 'Megnyitás…' : 'Előfizetés kezelése'}</button>}
          </div>
        </div>
      )}

      <div className="b2b-plans" role="radiogroup" aria-label="Csomagok">
        {B2B_PLANS.map((k) => (
          <button type="button" key={k} role="radio" aria-checked={plan === k} className={`b2b-plan ${plan === k ? 'on' : ''}`} onClick={() => setPlan(k)}>
            {k === 'b2b_pro' && <span className="b2b-pop">Legnépszerűbb</span>}
            <b>{B2B[k].name}</b>
            <span className="b2b-price">{huf(B2B[k].huf)}<small> / hó</small></span>
            <span className="b2b-n">{B2B[k].n} előnézet / hó</span>
            <small className="b2b-who">{B2B[k].who}</small>
          </button>
        ))}
      </div>

      {!subscribed && (
        <div className="b2b-form">
          {me && !me.signedIn && (
            <>
              <h3>Kezdjétek egy 2 hetes próbával</h3>
              <p className="b2b-sub">{B2B_TRIAL.n} előnézet {B2B_TRIAL.days} napra, kártya nélkül. Egy koppintásos regisztráció Google- vagy Apple-fiókkal, utána egy gombnyomás.</p>
              <a className="b2b-go" href={signIn}>Regisztrálok és indítom a próbát</a>
              <small className="b2b-note">Már van fiókod? <a href={`/belepes?next=${encodeURIComponent('/szalonoknak')}`}>Belépés</a></small>
            </>
          )}
          {me?.signedIn && !sub && (
            <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); go('/api/b2b/trial', { company: fd.get('company'), kind: fd.get('kind'), ref: refCode }, 'trial'); }}>
              <h3>Indítsátok el a 2 hetes próbát</h3>
              <p className="b2b-sub">{B2B_TRIAL.n} előnézet {B2B_TRIAL.days} napra, kártya nélkül. Fiók: {me.email}</p>
              <label>Szalon / klinika neve<input name="company" required maxLength={120} /></label>
              <label>
                Mivel foglalkoztok?
                <select name="kind" defaultValue="studio">
                  <option value="studio">Tetoválószalon</option>
                  <option value="clinic">Lézeres eltávolítás</option>
                  <option value="other">Más</option>
                </select>
              </label>
              <button className="b2b-go" disabled={!!busy}>{busy === 'trial' ? 'Indítás…' : 'Indítom a próbát'}</button>
            </form>
          )}
          {me?.signedIn && (
            <button className={`b2b-go ${sub ? '' : 'ghost'}`} disabled={!!busy} onClick={() => go('/api/b2b/subscribe', { plan }, 'sub')}>
              {busy === 'sub' ? 'Biztonságos fizetés megnyitása…' : `Előfizetek: ${B2B[plan].name}, ${huf(B2B[plan].huf)} / hó`}
            </button>
          )}
          {msg && <p className="b2b-err">{msg}</p>}
          <small className="b2b-note">Fizetés bankkártyával a Stripe-on, havonta. Számla e-mailben. Bármikor lemondható. <a href="/terms">ÁSZF</a> · <a href="/privacy">Adatkezelés</a></small>
        </div>
      )}
    </section>
  );
}
