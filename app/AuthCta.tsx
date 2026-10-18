'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { sb } from '@/lib/sb';
import { track } from '@/lib/store';

/** Signed in? The app is one tap away. */
export function useSignedIn() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const s = sb();
    if (!s) return;
    s.auth.getSession().then(({ data }) => setOn(!!data.session)).catch(() => {});
    const sub = s.auth.onAuthStateChange((_e, session) => setOn(!!session));
    return () => sub.data.subscription.unsubscribe();
  }, []);
  return on;
}

/** Register / Sign in buttons for the website (the app needs an account; it's free after sign-up). */
export function AuthCta({ lang, light = false, where = 'cta', style }: { lang: 'en' | 'hu'; light?: boolean; where?: string; style?: React.CSSProperties }) {
  const T = (en: string, hu: string) => (lang === 'hu' ? hu : en);
  const q = lang === 'en' ? '?lang=en' : '';
  const signedIn = useSignedIn();
  if (signedIn)
    return (
      <div className="auth-cta" style={style}>
        <Link className={`btn ${light ? 'light' : ''}`} href="/app" onClick={() => track('cta_app', { where })}>
          {T('Open my app', 'Az appom megnyitása')}
        </Link>
      </div>
    );
  return (
    <div className="auth-cta" style={style}>
      <Link className={`btn ${light ? 'light' : ''}`} href={`/regisztracio${q}`} onClick={() => track('cta_signup', { where })}>
        {T('Create a free account', 'Regisztráció')}
      </Link>
      <Link className={`btn ghost ${light ? 'on-dark' : ''}`} href={`/belepes${q}`} onClick={() => track('cta_signin', { where })}>
        {T('Sign in', 'Belépés')}
      </Link>
    </div>
  );
}

/** A single call to action: the app when signed in, otherwise registration. */
export function TryLink({ className, children, onClick, lang }: { className?: string; children: React.ReactNode; onClick?: () => void; lang?: 'en' | 'hu' }) {
  const signedIn = useSignedIn();
  const l = lang || (typeof document !== 'undefined' && document.documentElement.lang === 'en' ? 'en' : 'hu');
  return (
    <Link className={className} href={signedIn ? '/app' : `/regisztracio${l === 'en' ? '?lang=en' : ''}`} onClick={onClick}>
      {children}
    </Link>
  );
}
