'use client';
import { IMG } from '@/lib/kb';
import { ThemeToggle } from '../ThemeToggle';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { sb } from '@/lib/sb';
import { PUBLIC } from '@/lib/public-config';
import { track } from '@/lib/store';
import './auth.css';


/** Full-page sign-in / sign-up with e-mail code (and Google / Apple when switched on). */
export function AuthScreen({ mode, lang, img }: { mode: 'login' | 'signup' | 'forgot'; lang: 'en' | 'hu'; img: string }) {
  const T = (en: string, hu: string) => (lang === 'hu' ? hu : en);
  const q = lang === 'en' ? '?lang=en' : '';
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [agree, setAgree] = useState(false);
  const [step, setStep] = useState<'email' | 'code' | 'sent'>('email');
  const [withCode, setWithCode] = useState(false);
  const [name, setName] = useState('');
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  const [sentKind, setSentKind] = useState<'confirm' | 'reset'>('confirm');
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [wait, setWait] = useState(0);
  const [providers, setProviders] = useState<{ google?: boolean; apple?: boolean; loaded?: boolean }>({});
  const boxes = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    sb()
      ?.auth.getSession()
      .then(({ data }) => data.session && router.replace('/app/gallery'));
    const url = PUBLIC.supabaseUrl,
      key = PUBLIC.supabaseAnonKey;
    if (url && key)
      fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } })
        .then((r) => r.json())
        .then((d) => setProviders({ google: !!d?.external?.google, apple: !!d?.external?.apple, loaded: true }))
        .catch(() => {});
  }, [router]);
  useEffect(() => {
    if (wait <= 0) return;
    const id = setTimeout(() => setWait(wait - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  const okEmail = /\S+@\S+\.\S+/.test(email);
  const canSend = okEmail && (mode !== 'signup' || agree) && !busy;
  const pwScore = (pw.length >= 8 ? 1 : 0) + (/[a-záéíóöőúüű]/i.test(pw) && /\d/.test(pw) ? 1 : 0) + (pw.length >= 12 || /[^\w]/.test(pw) ? 1 : 0);
  const friendly = (m: string) =>
    /invalid login/i.test(m)
      ? T('Wrong e-mail or password.', 'Hibás e-mail-cím vagy jelszó.')
      : /not confirmed/i.test(m)
        ? T('Confirm your e-mail first — check your inbox.', 'Előbb erősítsd meg az e-mail-címedet – nézd meg a leveleidet.')
        : /already registered|already exists/i.test(m)
          ? T('There’s already an account with this e-mail. Sign in instead.', 'Ezzel az e-mail-címmel már van fiók. Lépj be inkább.')
          : /rate/i.test(m)
            ? T('Too many attempts. Wait a minute and try again.', 'Túl sok próbálkozás. Várj egy percet, és próbáld újra.')
            : /password/i.test(m) && /6|8|short|weak/i.test(m)
              ? T('Choose a longer password (at least 8 characters).', 'Válassz hosszabb jelszót (legalább 8 karakter).')
              : m;

  const loginPw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!okEmail || pw.length < 6 || busy) return;
    setBusy(true);
    setErr('');
    const { error } = (await sb()?.auth.signInWithPassword({ email: email.trim(), password: pw })) || { error: { message: 'unavailable' } as any };
    setBusy(false);
    if (error) return setErr(friendly(error.message));
    track('auth_ok', { mode: 'password' });
    router.replace('/app/gallery');
  };
  const signupPw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!okEmail || pw.length < 8 || !agree || busy) return;
    setBusy(true);
    setErr('');
    const { data, error } = (await sb()?.auth.signUp({ email: email.trim(), password: pw, options: { data: { full_name: name.trim() }, emailRedirectTo: `${location.origin}/app/gallery` } })) || ({ error: { message: 'unavailable' } } as any);
    setBusy(false);
    if (error) return setErr(friendly(error.message));
    track('auth_signup');
    if (data?.session) return router.replace('/app/gallery');
    setSentKind('confirm');
    setStep('sent');
  };
  const forgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!okEmail || busy) return;
    setBusy(true);
    setErr('');
    const { error } = (await sb()?.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${location.origin}/uj-jelszo${q}` })) || { error: { message: 'unavailable' } as any };
    setBusy(false);
    if (error) return setErr(friendly(error.message));
    track('auth_reset_request');
    setSentKind('reset');
    setStep('sent');
  };

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!canSend && step === 'email') return;
    const s = sb();
    if (!s) return setErr(T('Sign-in is not available right now.', 'A belépés most nem érhető el.'));
    setBusy(true);
    setErr('');
    const { error } = await s.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: `${location.origin}/app/gallery`, shouldCreateUser: true } });
    setBusy(false);
    if (error) return setErr(/rate/i.test(error.message) ? T('Too many e-mails right now. Wait a minute and try again.', 'Most túl sok e-mail ment ki. Várj egy percet, és próbáld újra.') : error.message);
    track(mode === 'login' ? 'auth_code_login' : 'auth_code_signup');
    setStep('code');
    setWait(45);
    setTimeout(() => boxes.current[0]?.focus(), 50);
  };

  const verify = async (digits = code.join('')) => {
    if (digits.length < 6) return;
    setBusy(true);
    setErr('');
    const { error } = await sb()!.auth.verifyOtp({ email: email.trim(), token: digits, type: 'email' });
    setBusy(false);
    if (error) return setErr(T('That code didn’t work. Use the newest e-mail.', 'Ez a kód nem jó. A legfrissebb e-mailt használd.'));
    track('auth_ok', { mode });
    router.replace('/app/gallery');
  };

  const setDigit = (i: number, v: string) => {
    const d = v.replace(/\D/g, '');
    if (d.length > 1) {
      const all = d.slice(0, 6).split('');
      const next = [...code];
      all.forEach((x, k) => (next[k] = x));
      setCode(next);
      boxes.current[Math.min(5, all.length)]?.focus();
      if (next.join('').length === 6) verify(next.join(''));
      return;
    }
    const next = [...code];
    next[i] = d;
    setCode(next);
    if (d && i < 5) boxes.current[i + 1]?.focus();
    if (next.join('').length === 6) verify(next.join(''));
  };

  const oauth = async (provider: 'google' | 'apple') => {
    if (mode === 'signup' && !agree) return setErr(T('Please tick the box below first.', 'Előbb pipáld be a lenti mezőt.'));
    if (providers.loaded && !providers[provider])
      return setErr(provider === 'google' ? T('Google sign-in is coming soon. Use your e-mail for now.', 'A Google-belépés hamarosan elérhető. Addig használd az e-mail-címedet.') : T('Apple sign-in is coming soon. Use your e-mail for now.', 'Az Apple-belépés hamarosan elérhető. Addig használd az e-mail-címedet.'));
    setErr('');
    if ((window as any).Capacitor?.isNativePlatform?.()) {
      const e = await import('@/lib/native').then((m) => m.nativeOAuth(provider));
      if (e) setErr(e);
      return;
    }
    const { error } = (await sb()?.auth.signInWithOAuth({ provider, options: { redirectTo: `${location.origin}/app/gallery` } })) || {};
    if (error) setErr(error.message);
  };

  return (
    <div className="au">
      <aside className="au-art">
        <img src={IMG(img, 1400)} alt="" />
        <div className="au-art-in">
          <Link href={`/${q}`} className="au-logo light" aria-label="InkAge">
            <svg viewBox="0 0 64 64" aria-hidden="true">
              <circle cx="32" cy="32" r="30" />
              <path d="M38 14a20 20 0 1 0 0 36a16 16 0 1 1 0-36z" />
            </svg>
            InkAge
          </Link>
          <div>
            <h2>{T('See it before it’s permanent.', 'Nézd meg, mielőtt végleges lesz.')}</h2>
            <ul>
              <li>{T('Your designs on every device', 'A terveid minden eszközödön')}</li>
              <li>{T('Bonus previews for inviting friends', 'Bónusz előnézetek a meghívásokért')}</li>
              <li>{T('Free after sign-up', 'Regisztráció után ingyenes')}</li>
            </ul>
          </div>
        </div>
      </aside>

      <main className="au-main">
        <header className="au-top">
          <Link href={`/${q}`} className="au-logo" aria-label="InkAge">
            <svg viewBox="0 0 64 64" aria-hidden="true">
              <circle cx="32" cy="32" r="30" />
              <path d="M38 14a20 20 0 1 0 0 36a16 16 0 1 1 0-36z" />
            </svg>
            InkAge
          </Link>
          <span className="au-top-r">
            <ThemeToggle lang={lang} />
            <Link href={`/${q}`} className="au-close" aria-label={T('Close', 'Bezárás')}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </Link>
          </span>
        </header>

        <div className="au-card">
          {step === 'sent' ? (
            <div className="au-done">
              <span className="au-mail" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M3 6h18v12H3zM3 7l9 6 9-6" />
                </svg>
              </span>
              <h1>{T('Check your inbox', 'Nézd meg a leveleidet')}</h1>
              <p className="au-sub">
                {sentKind === 'reset'
                  ? T('If there’s an account for ', 'Ha van fiók ehhez a címhez: ')
                  : T('We sent a confirmation link to ', 'Megerősítő linket küldtünk ide: ')}
                <b>{email}</b>
                {sentKind === 'reset' ? T(', you’ll get a link to set a new password.', ', kapsz egy linket az új jelszó beállításához.') : T('. Open it to activate your account.', '. Nyisd meg, és aktiváld a fiókodat.')}
              </p>
              <Link className="au-btn as-link" href={`/belepes${q}`}>
                {T('Back to sign in', 'Vissza a belépéshez')}
              </Link>
              <p className="au-hint">{T('Didn’t get it? Check spam, or try again in a minute.', 'Nem jött meg? Nézd meg a spam mappát, vagy próbáld újra egy perc múlva.')}</p>
            </div>
          ) : step === 'email' ? (
            <>
              {mode !== 'forgot' && (
                <div className="au-tabs" role="tablist">
                  <Link href={`/belepes${q}`} role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'on' : ''}>
                    {T('Sign in', 'Belépés')}
                  </Link>
                  <Link href={`/regisztracio${q}`} role="tab" aria-selected={mode === 'signup'} className={mode === 'signup' ? 'on' : ''}>
                    {T('Create account', 'Regisztráció')}
                  </Link>
                </div>
              )}
              {mode === 'forgot' && (
                <Link className="au-back" href={`/belepes${q}`}>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M15 5l-7 7 7 7" />
                  </svg>
                  {T('Back to sign in', 'Vissza a belépéshez')}
                </Link>
              )}
              <h1>{mode === 'login' ? T('Welcome back', 'Üdv újra itt') : mode === 'signup' ? T('Create your account', 'Hozd létre a fiókodat') : T('Forgot your password?', 'Elfelejtetted a jelszavad?')}</h1>
              <p className="au-sub">
                {mode === 'login'
                  ? T('Sign in with Google or Apple to try InkAge on your own photo.', 'Lépj be Google- vagy Apple-fiókkal, és próbáld ki az InkAge-et a saját fotódon.')
                  : mode === 'signup'
                    ? T('One tap with Google or Apple – then try it free on your own photo.', 'Egy koppintás Google- vagy Apple-fiókkal – utána ingyen kipróbálhatod a saját fotódon.')
                    : T('Enter your e-mail and we’ll send you a link to set a new one.', 'Add meg az e-mail-címed, és küldünk egy linket az új jelszó beállításához.')}
              </p>

              {mode !== 'forgot' && (
                <div className="au-social">
                  <button type="button" className="au-soc dark" onClick={() => oauth('apple')}>
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M16.4 12.6c0-2.5 2-3.6 2.1-3.7-1.2-1.7-3-1.9-3.6-2-1.5-.2-3 .9-3.8.9-.8 0-2-.9-3.3-.8-1.7 0-3.3 1-4.2 2.5-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.5 1.3 0 1.8-.8 3.3-.8s2 .8 3.3.8c1.4 0 2.3-1.2 3.1-2.5 1-1.4 1.4-2.8 1.4-2.9 0 0-2.8-1-2.8-4.2zM14 5.2c.7-.8 1.2-2 1-3.2-1 0-2.2.7-2.9 1.5-.6.7-1.2 1.9-1 3 1.1.1 2.2-.6 2.9-1.3z" />
                    </svg>
                    {T('Continue with Apple', 'Folytatás Apple-lel')}
                  </button>
                  <button type="button" className="au-soc" onClick={() => oauth('google')}>
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path fill="#4285F4" d="M22.6 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-7.9z" />
                      <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23z" />
                      <path fill="#FBBC05" d="M5.8 14.2a6.6 6.6 0 0 1 0-4.2V7.2H2.1a11 11 0 0 0 0 9.8z" />
                      <path fill="#EA4335" d="M12 5.4c1.6 0 3 .6 4.2 1.6l3.1-3.1A11 11 0 0 0 2.1 7.2L5.8 10c.9-2.6 3.3-4.6 6.2-4.6z" />
                    </svg>
                    {T('Continue with Google', 'Folytatás Google-lel')}
                  </button>
                </div>
              )}

              {mode === 'forgot' ? (
                <form onSubmit={forgot} className="au-form">
                  <label className="au-field">
                    <span>{T('E-mail address', 'E-mail-cím')}</span>
                    <input type="email" autoComplete="email" inputMode="email" placeholder={T('you@email.com', 'te@email.hu')} value={email} onChange={(e) => setEmail(e.target.value)} required />
                  </label>
                  <button className="au-btn" disabled={busy || !okEmail}>
                    {busy ? <i className="au-spin" aria-hidden="true" /> : T('Send reset link', 'Visszaállító link küldése')}
                  </button>
                </form>
              ) : (
                <div className="au-form">
                  {mode === 'signup' ? (
                    <label className="au-check">
                      <input type="checkbox" checked={agree} onChange={(e) => (setAgree(e.target.checked), setErr(''))} />
                      <span className="au-box" aria-hidden="true">
                        <svg viewBox="0 0 24 24">
                          <path d="M6 12.5l4 4L18 8" />
                        </svg>
                      </span>
                      <span>
                        {T('I’m over 18 and accept the ', 'Elmúltam 18 éves, és elfogadom az ')}
                        <Link href={`/terms${q}`}>{T('Terms', 'ÁSZF-et')}</Link>
                        {T(' and the ', ' és az ')}
                        <Link href={`/privacy${q}`}>{T('Privacy policy', 'Adatvédelmi tájékoztatót')}</Link>.
                      </span>
                    </label>
                  ) : null}
                  <p className="au-hint">{T('Free after sign-up. We never post anything on your behalf.', 'A regisztráció után ingyenes. A nevedben soha nem posztolunk semmit.')}</p>
                </div>
              )}
            </>
          ) : (
            <>
              <button type="button" className="au-back" onClick={() => (setStep('email'), setCode(['', '', '', '', '', '']), setErr(''))}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M15 5l-7 7 7 7" />
                </svg>
                {T('Back', 'Vissza')}
              </button>
              <span className="au-mail" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M3 6h18v12H3zM3 7l9 6 9-6" />
                </svg>
              </span>
              <h1>{T('Check your inbox', 'Nézd meg a leveleidet')}</h1>
              <p className="au-sub">
                {T('We sent a 6-digit code to ', 'Küldtünk egy 6 jegyű kódot ide: ')}
                <b>{email}</b>
              </p>
              <div className="au-otp" onPaste={(e) => (e.preventDefault(), setDigit(0, e.clipboardData.getData('text')))}>
                {code.map((d, i) => (
                  <input
                    key={i}
                    ref={(el) => {
                      boxes.current[i] = el;
                    }}
                    inputMode="numeric"
                    autoComplete={i === 0 ? 'one-time-code' : 'off'}
                    maxLength={6}
                    value={d}
                    aria-label={T(`Digit ${i + 1}`, `${i + 1}. számjegy`)}
                    onChange={(e) => setDigit(i, e.target.value)}
                    onKeyDown={(e) => e.key === 'Backspace' && !d && i > 0 && boxes.current[i - 1]?.focus()}
                  />
                ))}
              </div>
              <button className="au-btn" disabled={busy || code.join('').length < 6} onClick={() => verify()}>
                {busy ? <i className="au-spin" aria-hidden="true" /> : T('Continue', 'Tovább')}
              </button>
              <p className="au-resend">
                {wait > 0 ? (
                  T(`You can request a new code in ${wait} s`, `Új kódot ${wait} mp múlva kérhetsz`)
                ) : (
                  <button type="button" onClick={() => send()}>
                    {T('Send a new code', 'Új kód küldése')}
                  </button>
                )}
              </p>
              <p className="au-hint">{T('You can also tap the link in the e-mail.', 'A levélben lévő linkre is koppinthatsz.')}</p>
            </>
          )}
          {err && (
            <p className="au-err" role="alert">
              {err}
            </p>
          )}
        </div>

        <p className="au-switch">
          {mode !== 'signup' ? (
            <>
              {T('New to InkAge? ', 'Még nincs fiókod? ')}
              <Link href={`/regisztracio${q}`}>{T('Create an account', 'Regisztrálj')}</Link>
            </>
          ) : (
            <>
              {T('Already have an account? ', 'Van már fiókod? ')}
              <Link href={`/belepes${q}`}>{T('Sign in', 'Lépj be')}</Link>
            </>
          )}
        </p>
      </main>
    </div>
  );
}
