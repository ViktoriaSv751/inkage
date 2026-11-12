'use client';
import { useState } from 'react';

type Plan = 'studio' | 'pro' | 'clinic';
const PLANS: { k: Plan; name: string; price: string; n: string; who: string; pop?: boolean }[] = [
  { k: 'studio', name: 'Studio', price: '9 900 Ft', n: '40 előnézet / hó', who: '1–2 tetováló' },
  { k: 'pro', name: 'Studio Pro', price: '19 900 Ft', n: '120 előnézet / hó', who: 'nagyobb szalon, több tetováló', pop: true },
  { k: 'clinic', name: 'Klinika', price: '29 900 Ft', n: '150 előnézet / hó', who: 'lézeres eltávolítás: 3, 6, 10 kezelés' },
];

/** The monthly plans and the trial request (Hungarian only: the first outreach is to Hungarian studios and clinics). */
export function B2BForm({ refCode }: { refCode: string }) {
  const [plan, setPlan] = useState<Plan>('pro');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');
  const send = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setErr('');
    const r = await fetch('/api/b2b', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...Object.fromEntries(fd), plan, ref: refCode }) }).catch(() => null);
    setBusy(false);
    if (r?.ok) setDone(true);
    else setErr('Nem sikerült elküldeni. Nézd meg a cégnevet és az e-mail-címet, és próbáld újra.');
  };
  return (
    <section className="b2b">
      <h2 id="csomagok">Havidíjas csomagok</h2>
      <p className="b2b-sub">Minden előnézet a vendég saját fotóján: ma, 1, 10, 30 és 50 év múlva, illetve 3, 6 és 10 lézeres kezelés után. Vízjel nélkül, a vendégnek elküldhető linkkel. Havonta lemondható.</p>
      <div className="b2b-plans" role="radiogroup" aria-label="Csomagok">
        {PLANS.map((p) => (
          <button type="button" key={p.k} role="radio" aria-checked={plan === p.k} className={`b2b-plan ${plan === p.k ? 'on' : ''}`} onClick={() => setPlan(p.k)}>
            {p.pop && <span className="b2b-pop">Legnépszerűbb</span>}
            <b>{p.name}</b>
            <span className="b2b-price">{p.price}<small> / hó</small></span>
            <span className="b2b-n">{p.n}</span>
            <small className="b2b-who">{p.who}</small>
          </button>
        ))}
      </div>
      {done ? (
        <div className="b2b-done">
          <b>Köszönjük, megkaptuk!</b>
          <p>1 munkanapon belül jelentkezünk, és beállítjuk a 2 hetes próbahozzáférést.</p>
        </div>
      ) : (
        <form className="b2b-form" onSubmit={send}>
          <h3>Kérek 2 hét próbát</h3>
          <p className="b2b-sub">A próba alatt nem kell fizetni és kártyát sem kell megadni. Utána te döntöd el, maradsz-e.</p>
          <label>Szalon / klinika neve<input name="company" required maxLength={120} /></label>
          <label>A neved<input name="name" maxLength={80} /></label>
          <label>E-mail<input name="email" type="email" required maxLength={160} /></label>
          <label>Telefon (nem kötelező)<input name="phone" maxLength={40} /></label>
          <label>
            Mivel foglalkoztok?
            <select name="kind" defaultValue="studio">
              <option value="studio">Tetoválószalon</option>
              <option value="clinic">Lézeres eltávolítás</option>
              <option value="other">Más</option>
            </select>
          </label>
          <label>Üzenet (nem kötelező)<textarea name="message" rows={3} maxLength={1500} /></label>
          <input name="website" tabIndex={-1} autoComplete="off" className="b2b-hp" aria-hidden="true" />
          {err && <p className="b2b-err">{err}</p>}
          <button className="b2b-go" disabled={busy}>{busy ? 'Küldés…' : `Kérem a próbát (${PLANS.find((p) => p.k === plan)!.name})`}</button>
          <small className="b2b-note">Az adataidat csak a próbahozzáférés beállításához használjuk. <a href="/privacy">Adatkezelés</a></small>
        </form>
      )}
    </section>
  );
}
