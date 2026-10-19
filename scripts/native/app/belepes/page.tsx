'use client';
import { AuthScreen } from '../_auth/AuthScreen';
import { useEffect, useState } from 'react';
import { isLang, type Lang } from '@/lib/tr';

/* Store-app build: the sign-in screen without a server (language from the page, not from the request). */
export default function Page() {
  const [lang, setLang] = useState<Lang | null>(null);
  useEffect(() => {
    const l = document.documentElement.lang;
    setLang(isLang(l) ? (l as Lang) : 'en');
  }, []);
  if (!lang) return <div style={{ minHeight: '100dvh', background: 'var(--bg, #000)' }} />;
  return <AuthScreen mode="login" lang={lang} img="hf_20261014_072014_0bc43c3a-08b9-46d1-85a0-73f61f1b5028" />;
}
