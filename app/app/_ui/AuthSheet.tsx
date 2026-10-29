'use client';
import { siteOrigin } from '@/lib/site';
import { qOf } from '@/lib/tr';
import { oauthParams } from '@/lib/auth-help';

import { useEffect, useState } from 'react';
import { sb } from '@/lib/sb';
import { PUBLIC } from '@/lib/public-config';
import { useApp } from '../AppProvider';
import { tx, huArticle } from '@/lib/i18n';
import { Sheet } from './Sheet';

export function AuthSheet() {
  const { authOpen, closeAuth, authReason, ui, refreshMe, toast } = useApp();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [pw, setPw] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const L = (en: string, hu: string) => tx(ui.lang, en, hu);
  // one-tap sign-in buttons appear as soon as the provider is switched on in Supabase
  const [providers, setProviders] = useState<{ google?: boolean; apple?: boolean }>({});
  useEffect(() => {
    if (!authOpen) return;
    const url = PUBLIC.supabaseUrl, key = PUBLIC.supabaseAnonKey;
    if (!url || !key) return;
    fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } })
      .then((r) => r.json())
      .then((d) => setProviders({ google: !!d?.external?.google, apple: !!d?.external?.apple }))
      .catch(() => {});
  }, [authOpen]);
  const oauth = async (provider: 'google' | 'apple') => {
    setErr('');
    // Instagram / TikTok / Facebook: Google refuses to sign in inside their browser; carry the page to the phone's browser
    if (provider === 'google' && (await import('@/lib/inapp')).escapeForGoogle(`/belepes${qOf(ui.lang)}`)) return;
    if ((window as any).Capacitor?.isNativePlatform?.()) {
      const e = await import('@/lib/native').then((m) => m.nativeOAuth(provider, () => setErr(L('Sign-in didn’t finish. Try again, or use your e-mail.', 'A belépés nem fejeződött be. Próbáld újra, vagy lépj be e-maillel.'))));
      if (e) setErr(e);
      return;
    }
    (await import('@/lib/apple-token')).markOAuthStart(provider);
    (await import('@/lib/splash')).markSplash('in');
    const { error } = (await sb()?.auth.signInWithOAuth({ provider, options: { redirectTo: `${siteOrigin()}/app/gallery`, queryParams: oauthParams(provider) } })) || {};
    if (error) setErr(error.message);
  };

  const send = async () => {
    const s = sb();
    if (!s) return;
    setBusy(true);
    setErr('');
    const { error } = await s.auth.signInWithOtp({ email, options: { emailRedirectTo: `${siteOrigin()}/app/gallery`, shouldCreateUser: true } });
    setBusy(false);
    if (error) return setErr(/rate/i.test(error.message) ? L('Too many emails right now. Wait a minute and try again.', 'Most túl sok e-mail ment ki. Várj egy percet, és próbáld újra.') : error.message);
    setSent(true);
  };
  const loginPw = async () => {
    if (!/\S+@\S+\.\S+/.test(email) || pw.length < 6 || busy) return;
    setBusy(true);
    setErr('');
    const { error } = (await sb()?.auth.signInWithPassword({ email: email.trim(), password: pw })) || { error: { message: 'unavailable' } as any };
    setBusy(false);
    if (error) return setErr(/invalid login/i.test(error.message) ? L('Wrong e-mail or password.', 'Hibás e-mail-cím vagy jelszó.') : error.message);
    closeAuth();
    setPw('');
    (await import('@/lib/splash')).playSplash('in');
    await refreshMe();
    toast(L('Signed in', 'Bejelentkezve'));
  };
  const verify = async () => {
    setBusy(true);
    setErr('');
    const { error } = await sb()!.auth.verifyOtp({ email, token: code.trim(), type: 'email' });
    setBusy(false);
    if (error) return setErr(L('That code did not work. Use the newest email.', 'Ez a kód nem jó. A legfrissebb e-mailt használd.'));
    closeAuth();
    setSent(false);
    setCode('');
    await refreshMe();
    toast(L('Signed in', 'Bejelentkezve'));
  };

  return (
    <Sheet open={authOpen} onClose={closeAuth} label="Sign in">
      <h2>{sent ? L('Check your email', 'Nézd meg az e-mailjeidet') : L('Keep your designs', 'Őrizd meg a terveidet')}</h2>
      {!sent ? (
        <>
          <p className="sub">{authReason || L('Sign in with Google or Apple to keep your previews on every device.', 'Lépj be Google- vagy Apple-fiókkal, hogy minden eszközön meglegyenek a terveid.')}</p>
          <div className="oauth">
            <button className="btn wide dark" onClick={() => oauth('apple')}>
               {L('Continue with Apple', 'Folytatás Apple-fiókkal')}
            </button>
            <button className="btn wide ghost" onClick={() => oauth('google')}>
              <b style={{ color: '#4285f4' }}>G</b> {L('Continue with Google', 'Folytatás Google-fiókkal')}
            </button>
          </div>
          <p className="sub" style={{ fontSize: 12.5, textAlign: 'center', margin: '8px 0 0' }}>
            {L('By continuing you confirm you’re 18 or older and accept the ', 'A folytatással megerősíted, hogy elmúltál 18 éves, és elfogadod az ')}
            <a href={`/terms${qOf(ui.lang)}`}>{L('Terms', 'ÁSZF-et')}</a>
            {L(' and the ', ' és az ')}
            <a href={`/privacy${qOf(ui.lang)}`}>{L('Privacy policy', 'Adatvédelmi tájékoztatót')}</a>.
          </p>
          <p className="or-mail"><span>{L('or with e-mail', 'vagy e-maillel')}</span></p>
          <form className="pw-login" onSubmit={(e) => (e.preventDefault(), loginPw())}>
            <input id="auth-email" type="email" autoComplete="username" inputMode="email" placeholder={L('E-mail address', 'E-mail-cím')} value={email} onChange={(e) => setEmail(e.target.value)} />
            <input id="auth-pw" type="password" autoComplete="current-password" placeholder={L('Password', 'Jelszó')} value={pw} onChange={(e) => setPw(e.target.value)} />
            <button className="btn wide" disabled={busy || !/\S+@\S+\.\S+/.test(email) || pw.length < 6}>
              {busy ? '…' : L('Sign in with e-mail', 'Belépés e-maillel')}
            </button>
          </form>
          <p className="pw-links">
            <a href={`/regisztracio${qOf(ui.lang)}`}>{L('Create an account with e-mail', 'Regisztráció e-maillel')}</a>
            <a href={`/elfelejtett-jelszo${qOf(ui.lang)}`}>{L('Forgot password?', 'Elfelejtett jelszó')}</a>
          </p>
        </>
      ) : (
        <>
          <p className="sub">{L(`Enter the code we sent to ${email}, or tap the link in the email.`, `Írd be a kódot, amit ${huArticle(email)} ${email} címre küldtünk, vagy koppints a levélben lévő linkre.`)}</p>
          <input id="auth-code" inputMode="numeric" autoComplete="one-time-code" placeholder="123456" value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && verify()} />
          <button className="btn wide" disabled={busy || code.trim().length < 6} onClick={verify}>
            {busy ? '…' : L('Continue', 'Tovább')}
          </button>
          <button className="btn ghost wide" onClick={() => setSent(false)}>
            {L('Use a different email', 'Másik e-mail-cím')}
          </button>
        </>
      )}
      {err && <p className="err">{err}</p>}
    </Sheet>
  );
}
