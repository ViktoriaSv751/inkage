'use client';
import { tx, qOf, type Lang, isLang } from '@/lib/tr';

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

/** Register / Sign in buttons for the website (an account is needed to make previews). */
export function AuthCta({ lang, light = false, where = 'cta', style }: { lang: Lang; light?: boolean; where?: string; style?: React.CSSProperties }) {
  const T = (en: string, hu: string) => tx(lang, en, hu);
  const q = qOf(lang);
  // always Register / Sign in (signed in already, both pages go straight to the gallery)
  return (
    <div className="auth-cta" style={style}>
      <Link className={`btn ${light ? 'light' : ''}`} href={`/regisztracio${q}`} onClick={() => track('cta_signup', { where })}>
        {T('Create account', 'Regisztráció')}
      </Link>
      <Link className={`btn ghost ${light ? 'on-dark' : ''}`} href={`/belepes${q}`} onClick={() => track('cta_signin', { where })}>
        {T('Sign in', 'Belépés')}
      </Link>
    </div>
  );
}

/** A single call to action: the app when signed in, otherwise registration. */
export function TryLink({ className, children, onClick, lang }: { className?: string; children: React.ReactNode; onClick?: () => void; lang?: Lang }) {
  const signedIn = useSignedIn();
  // without a lang prop the page language is read after load (the server can't know it here)
  const [docLang, setDocLang] = useState<Lang | null>(null);
  useEffect(() => {
    if (lang) return;
    const d = document.documentElement.lang;
    const q = new URLSearchParams(location.search).get('lang');
    setDocLang(isLang(q) ? q : isLang(d) ? d : null);
  }, [lang]);
  const l: Lang = lang || docLang || 'hu';
  return (
    <Link className={className} href={signedIn ? '/app' : `/regisztracio${qOf(l)}`} onClick={onClick}>
      {children}
    </Link>
  );
}
