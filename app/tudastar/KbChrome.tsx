'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { track } from '@/lib/store';

/** Top bar, sticky "try it" button and back-to-top for the knowledge base. */
export function KbChrome({ lang, back, crumb, light = false, path = '/tudastar' }: { lang: 'en' | 'hu'; back: string | null; crumb?: string; light?: boolean; path?: string }) {
  const T = (en: string, hu: string) => (lang === 'hu' ? hu : en);
  const [up, setUp] = useState(false);
  useEffect(() => {
    const h = () => setUp(window.scrollY > 700);
    h();
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);
  return (
    <>
      <nav className={`kb-top ${light ? 'light' : ''}`}>
        <Link href="/" className="kb-logo" aria-label="InkAge">
          <svg viewBox="0 0 64 64" aria-hidden="true">
            <circle cx="32" cy="32" r="30" />
            <path d="M38 14a20 20 0 1 0 0 36a16 16 0 1 1 0-36z" />
          </svg>
          InkAge
        </Link>
        <div className="kb-top-r">
          <Link className="kb-lang" href={`${path}${lang === 'hu' ? '?lang=en' : ''}`} aria-label={T('Magyarul', 'English')}>
            {lang === 'hu' ? 'EN' : 'HU'}
          </Link>
          <Link className="kb-start" href="/app" onClick={() => track('kb_cta_top')}>
            {T('Try it', 'Kipróbálom')}
          </Link>
        </div>
      </nav>
      {back !== null && (
        <div className={`kb-crumbs ${light ? 'light' : ''}`}>
          <Link className="kb-back" href={back}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            {T('Knowledge base', 'Tudástár')}
          </Link>
          {crumb && (
            <>
              <span aria-hidden="true">›</span>
              <b>{crumb}</b>
            </>
          )}
        </div>
      )}
      <Link className="kb-sticky" href="/app" onClick={() => track('kb_cta_sticky')}>
        {T('See it on my own skin', 'Megnézem a saját bőrömön')}
      </Link>
      <button className={`kb-up ${up ? 'show' : ''} ${light ? 'light' : ''}`} aria-label={T('Back to top', 'Vissza a tetejére')} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 19V5M5 12l7-7 7 7" />
        </svg>
      </button>
    </>
  );
}
