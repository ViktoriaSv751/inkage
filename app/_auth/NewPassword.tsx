'use client';
import { tx, qOf, type Lang } from '@/lib/tr';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { sb } from '@/lib/sb';
import './auth.css';

/** Landing page of the password-reset e-mail: set a new password. */
export function NewPassword({ lang }: { lang: Lang }) {
  const T = (en: string, hu: string) => tx(lang, en, hu);
  const q = qOf(lang);
  const router = useRouter();
  const [ready, setReady] = useState<'wait' | 'ok' | 'none'>('wait');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);
  useEffect(() => {
    const s = sb();
    if (!s) return setReady('none');
    const { data } = s.auth.onAuthStateChange((ev, session) => {
      if (ev === 'PASSWORD_RECOVERY' || session) setReady('ok');
    });
    s.auth.getSession().then(({ data: d }) => d.session && setReady('ok'));
    const t = setTimeout(() => setReady((r) => (r === 'wait' ? 'none' : r)), 4000);
    return () => {
      data.subscription.unsubscribe();
      clearTimeout(t);
    };
  }, []);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 8) return setErr(T('Use at least 8 characters.', 'Legalább 8 karaktert használj.'));
    if (pw !== pw2) return setErr(T('The two passwords don’t match.', 'A két jelszó nem egyezik.'));
    setBusy(true);
    setErr('');
    const { error } = await sb()!.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return setErr(error.message);
    setDone(true);
    setTimeout(() => router.replace('/app/gallery'), 1600);
  };
  return (
    <div className="au au-single">
      <main className="au-main">
        <header className="au-top">
          <Link href={`/${q}`} className="au-logo" aria-label="InkAge">
            <svg viewBox="0 0 64 64" aria-hidden="true">
              <circle cx="32" cy="32" r="30" />
              <path d="M38 14a20 20 0 1 0 0 36a16 16 0 1 1 0-36z" />
            </svg>
            InkAge
          </Link>
        </header>
        <div className="au-card">
          {done ? (
            <div className="au-done">
              <h1>{T('Password updated', 'Jelszó frissítve')}</h1>
              <p className="au-sub">{T('You’re signed in. Taking you to your profile…', 'Be vagy jelentkezve. Átviszünk a profilodra…')}</p>
            </div>
          ) : ready === 'none' ? (
            <div className="au-done">
              <h1>{T('This link has expired', 'Ez a link lejárt')}</h1>
              <p className="au-sub">{T('Request a new reset link and open it on this device.', 'Kérj új visszaállító linket, és ezen az eszközön nyisd meg.')}</p>
              <Link className="au-btn as-link" href={`/elfelejtett-jelszo${q}`}>
                {T('Send a new link', 'Új link kérése')}
              </Link>
            </div>
          ) : (
            <form className="au-form" onSubmit={save}>
              <h1>{T('Set a new password', 'Új jelszó beállítása')}</h1>
              <p className="au-sub">{T('Choose something you haven’t used elsewhere.', 'Olyat válassz, amit máshol nem használsz.')}</p>
              <label className="au-field">
                <span>{T('New password', 'Új jelszó')}</span>
                <input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder={T('At least 8 characters', 'Legalább 8 karakter')} />
              </label>
              <label className="au-field">
                <span>{T('Repeat password', 'Jelszó újra')}</span>
                <input type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
              </label>
              <button className="au-btn" disabled={busy || ready !== 'ok'}>
                {busy || ready === 'wait' ? <i className="au-spin" aria-hidden="true" /> : T('Save password', 'Jelszó mentése')}
              </button>
              {err && (
                <p className="au-err" role="alert">
                  {err}
                </p>
              )}
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
