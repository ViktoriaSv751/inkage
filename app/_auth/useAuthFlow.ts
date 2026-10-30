'use client';
import { siteOrigin } from '@/lib/site';
import { tx, qOf, type Lang } from '@/lib/tr';
import { markSplash, playSplash } from '@/lib/splash';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { sb } from '@/lib/sb';
import { PUBLIC } from '@/lib/public-config';
import { ageAgreed, track } from '@/lib/store';
import { oauthParams, authErrorText } from '@/lib/auth-help';
import { nextFromUrl, rememberNext, withLang } from '@/lib/auth-next';

/** State and actions of the sign-in / sign-up screen: e-mail + password, Google / Apple. */
export function useAuthFlow(mode: 'login' | 'signup' | 'forgot', lang: Lang) {
  const T = (en: string, hu: string) => tx(lang, en, hu);
  const q = qOf(lang);
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [agree, setAgree] = useState(false);
  const [step, setStep] = useState<'email' | 'sent'>('email');
  const [name, setName] = useState('');
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  const [sentKind, setSentKind] = useState<'confirm' | 'reset'>('confirm');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [wait, setWait] = useState(0);
  const [providers, setProviders] = useState<{ google?: boolean; apple?: boolean; loaded?: boolean }>({});

  // in the store apps the Google / Apple sign-in comes back to this page through app.inkage://auth:
  // the listener that finishes it must be running here too, not only inside /app
  // store apps: no way back to the website from here (no ×, the logo stays on this page)
  const [native, setNative] = useState(false);
  useEffect(() => {
    setNative(!!(window as any).Capacitor?.isNativePlatform?.());
    if ((window as any).Capacitor?.isNativePlatform?.()) import('@/lib/native').then((m) => m.initNative()).catch(() => {});
  }, []);
  useEffect(() => {
    sb()
      ?.auth.getSession()
      .then(({ data }) => data.session && router.replace(withLang(nextFromUrl() || '/app/gallery', lang)));
    const url = PUBLIC.supabaseUrl,
      key = PUBLIC.supabaseAnonKey;
    if (url && key)
      fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } })
        .then((r) => r.json())
        .then((d) => setProviders({ google: !!d?.external?.google, apple: !!d?.external?.apple, loaded: true }))
        .catch(() => {});
    // a failed Google / Apple sign-in comes back here with ?err=<code>
    const code = new URLSearchParams(location.search).get('err');
    if (code) setErr(authErrorText(code, lang));
  }, [router, lang]);
  const went = useRef(false);
  useEffect(() => {
    if (went.current || !providers.loaded || mode === 'forgot') return;
    if (new URLSearchParams(location.search).get('go') !== 'google') return;
    went.current = true;
    try {
      const u = new URL(location.href);
      u.searchParams.delete('go');
      history.replaceState(null, '', u.toString());
    } catch {}
    oauth('google');
  }, [providers.loaded]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (wait <= 0) return;
    const id = setTimeout(() => setWait(wait - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  const okEmail = /\S+@\S+\.\S+/.test(email);
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
              : T('Something went wrong. Try again in a minute, or use another way to sign in.', 'Valami nem sikerült. Próbáld újra egy perc múlva, vagy lépj be másképp.');

  const loginPw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!okEmail || pw.length < 6 || busy) return;
    setBusy(true);
    setErr('');
    const { error } = (await sb()?.auth.signInWithPassword({ email: email.trim(), password: pw })) || { error: { message: 'unavailable' } as any };
    setBusy(false);
    if (error) return setErr(friendly(error.message));
    track('auth_ok', { mode: 'password' });
    playSplash('in');
    router.replace(withLang(nextFromUrl() || '/app/gallery', lang));
  };
  const signupPw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!okEmail || pw.length < 8 || !agree || busy) return;
    ageAgreed();
    setBusy(true);
    setErr('');
    const { data, error } = (await sb()?.auth.signUp({ email: email.trim(), password: pw, options: { data: { full_name: name.trim() }, emailRedirectTo: `${siteOrigin()}/app/gallery` } })) || ({ error: { message: 'unavailable' } } as any);
    setBusy(false);
    if (error) return setErr(friendly(error.message));
    track('auth_signup');
    if (data?.session) return playSplash('in'), router.replace(withLang(nextFromUrl() || '/app', lang));
    rememberNext(nextFromUrl() || '/app'); // the confirmation link opens the gallery: go on from there
    setSentKind('confirm');
    setStep('sent');
  };
  const forgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!okEmail || busy) return;
    setBusy(true);
    setErr('');
    const { error } = (await sb()?.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${siteOrigin()}/uj-jelszo${q}` })) || { error: { message: 'unavailable' } as any };
    setBusy(false);
    if (error) return setErr(friendly(error.message));
    track('auth_reset_request');
    setSentKind('reset');
    setStep('sent');
  };

  const oauth = async (provider: 'google' | 'apple') => {
    if (providers.loaded && !providers[provider])
      return setErr(provider === 'google' ? T('Google sign-in is coming soon. Use your e-mail for now.', 'A Google-belépés hamarosan elérhető. Addig használd az e-mail-címedet.') : T('Apple sign-in is coming soon. Use your e-mail for now.', 'Az Apple-belépés hamarosan elérhető. Addig használd az e-mail-címedet.'));
    setErr('');
    ageAgreed(); // tapping is the agreement, said right under the buttons
    rememberNext(nextFromUrl() || (mode === 'signup' ? '/app' : null));
    // Instagram / TikTok / Facebook: Google refuses to sign in inside their browser; carry the page to the phone's browser
    if (provider === 'google' && (await import('@/lib/inapp')).escapeForGoogle()) return;
    if ((window as any).Capacitor?.isNativePlatform?.()) {
      const e = await import('@/lib/native').then((m) => m.nativeOAuth(provider, () => setErr(T('Sign-in didn’t finish. Try again, or use your e-mail below.', 'A belépés nem fejeződött be. Próbáld újra, vagy lépj be e-maillel lent.'))));
      if (e) setErr(T('Sign-in didn’t work. Try again, or use your e-mail below.', 'A belépés nem sikerült. Próbáld újra, vagy lépj be e-maillel lent.'));
      return;
    }
    (await import('@/lib/apple-token')).markOAuthStart(provider);
    markSplash('in');
    const { error } = (await sb()?.auth.signInWithOAuth({ provider, options: { redirectTo: `${siteOrigin()}/app/gallery`, queryParams: oauthParams(provider) } })) || {};
    if (error) setErr(friendly(error.message));
  };

  // the confirmation e-mail didn't arrive: send it again
  const resend = async () => {
    if (!okEmail || busy || wait > 0) return;
    setBusy(true);
    const { error } = (await sb()?.auth.resend({ type: 'signup', email: email.trim(), options: { emailRedirectTo: `${siteOrigin()}/app/gallery` } })) || { error: { message: 'unavailable' } as any };
    setBusy(false);
    track('auth_resend', { ok: !error });
    if (error) return setErr(friendly(error.message));
    setErr('');
    setWait(60);
  };

  return {
    T, q, native, email, setEmail, agree, setAgree, step, setStep, name, setName, pw, setPw, show, setShow, sentKind,
    busy, err, setErr, wait, okEmail, pwScore, loginPw, signupPw, forgot, oauth, resend,
  };
}

export type AuthFlow = ReturnType<typeof useAuthFlow>;
