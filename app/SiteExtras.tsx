'use client';
import { tx, qOf, type Lang } from '@/lib/tr';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { track } from '@/lib/store';
import './consent.css';


/** Desktop: a slim "get started" bar along the bottom of every public page. */
export function CtaBar({ lang, hidden }: { lang: Lang; hidden?: boolean }) {
  const T = (en: string, hu: string) => tx(lang, en, hu);
  const [show, setShow] = useState(false);
  const [closed, setClosed] = useState(true);
  useEffect(() => {
    try {
      setClosed(sessionStorage.getItem('ink_ctabar') === '0');
    } catch {
      setClosed(false);
    }
    const h = () => {
      const nearEnd = window.innerHeight + window.scrollY > document.documentElement.scrollHeight - 520;
      setShow(window.scrollY > 520 && !nearEnd);
    };
    h();
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);
  const visible = show && !closed && !hidden;
  useEffect(() => {
    document.documentElement.classList.toggle('has-ctabar', visible);
    return () => document.documentElement.classList.remove('has-ctabar');
  }, [visible]);
  return (
    <aside className={`ctabar ${visible ? 'on' : ''}`} aria-hidden={!visible} aria-label={T('Get started', 'Kezdd el')}>
      <div className="ctabar-in">
        <div className="ctabar-pics" aria-hidden="true">
          <span className="a" />
          <span className="b" />
        </div>
        <div className="ctabar-txt">
          <b>{T('See your tattoo 50 years from now', 'Nézd meg a tetoválásod 50 év múlva')}</b>
          <span>{T('One-tap sign-up with Google or Apple · 30 previews a month · About a minute', 'Egy koppintásos Google- vagy Apple-regisztráció · Havi 30 előnézet · Kb. egy perc')}</span>
        </div>
        <div className="ctabar-act">
          <Link href={`/belepes${qOf(lang)}`} className="ctabar-ghost" tabIndex={visible ? 0 : -1}>
            {T('Sign in', 'Belépés')}
          </Link>
          <Link href={`/regisztracio${qOf(lang)}`} className="ctabar-go" tabIndex={visible ? 0 : -1} onClick={() => track('ctabar_click')}>
            {T('Register', 'Regisztráció')}
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </Link>
          <button
            className="ctabar-x"
            aria-label={T('Hide', 'Elrejtés')}
            tabIndex={visible ? 0 : -1}
            onClick={() => {
              setClosed(true);
              try {
                sessionStorage.setItem('ink_ctabar', '0');
              } catch {}
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M7 7l10 10M17 7L7 17" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  );
}

/** First visit: which cookies and local storage we use, with an honest choice. */
export function CookieConsent({ lang, onChange, native = false }: { lang: Lang; onChange?: (open: boolean) => void; native?: boolean }) {
  const T = (en: string, hu: string) => tx(lang, en, hu);
  const [open, setOpen] = useState(false);
  const [more, setMore] = useState(false);
  useEffect(() => {
    let seen: string | null = null;
    try {
      seen = localStorage.getItem('ink_consent');
    } catch {}
    if (!seen) {
      const tm = setTimeout(() => setOpen(true), 2500); // after the first screen has been seen
      return () => clearTimeout(tm);
    }
  }, []);
  useEffect(() => onChange?.(open), [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const choose = (v: 'all' | 'essential') => {
    try {
      localStorage.setItem('ink_consent', v);
      localStorage.setItem('ink_consent_at', new Date().toISOString());
    } catch {}
    if (v === 'all') track('consent_all');
    setOpen(false);
  };
  if (!open) return null;
  return (
    <div className="cc" role="dialog" aria-modal="false" aria-labelledby="cc-h">
      <div className="cc-ico" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path d="M12 3a9 9 0 1 0 9 9 4 4 0 0 1-5-5 4 4 0 0 1-4-4zM8.5 11.5h.01M12 16h.01M15.5 13.5h.01" />
        </svg>
      </div>
      <div className="cc-body">
        <b id="cc-h">{native ? T('Help make InkAge better?', 'Segítesz jobbá tenni az InkAge-et?') : T('Cookies, the honest version', 'Sütik, őszintén')}</b>
        <p>
          {native ? T(
            'Can we count which features get used? It’s our own anonymous stats, never sold or shared. You can change this any time in Settings.',
            'Megszámolhatjuk, mely funkciókat használod? Ez saját, névtelen statisztika, nem adjuk el és nem osztjuk meg. A Beállításokban bármikor módosíthatod.'
          ) : T(
            'We only use what InkAge needs to work (sign-in, language, theme) and our own anonymous usage stats to make it better. No ads, no third-party trackers.',
            'Csak azt használjuk, ami az InkAge működéséhez kell (belépés, nyelv, téma), és saját, névtelen használati statisztikát a fejlesztéshez. Nincs hirdetés, nincs külső követő.'
          )}
        </p>
        {more && (
          <ul className="cc-list">
            <li>
              <b>{T('Necessary', 'Szükséges')}</b> {T('sign-in session, language, theme, your previews on this device. Always on.', 'belépési munkamenet, nyelv, téma, az előnézeteid ezen az eszközön. Mindig bekapcsolva.')}
            </li>
            <li>
              <b>{T('Anonymous stats', 'Névtelen statisztika')}</b> {T('which features are used, so we know what to improve. Stored by us, never sold or shared.', 'mely funkciókat használják, hogy tudjuk, mit fejlesszünk. Nálunk marad, nem adjuk el és nem osztjuk meg.')}
            </li>
          </ul>
        )}
        <div className="cc-act">
          <button className="cc-yes" onClick={() => choose('all')}>
            {native ? T('Yes, count it', 'Igen, számolhatjátok') : T('Accept', 'Elfogadom')}
          </button>
          <button className="cc-no" onClick={() => choose('essential')}>
            {native ? T('No, thanks', 'Nem, köszönöm') : T('Necessary only', 'Csak a szükségesek')}
          </button>
          {!native && (
            <button className="cc-more" onClick={() => setMore(!more)} aria-expanded={more}>
              {more ? T('Less', 'Kevesebb') : T('Details', 'Részletek')}
            </button>
          )}
          {native ? (
            <Link className="cc-more" href={`/privacy${qOf(lang)}`}>
              {T('Privacy', 'Adatvédelem')}
            </Link>
          ) : (
            <Link className="cc-more" href={`/suti${qOf(lang)}`}>
              {T('Cookie policy', 'Süti tájékoztató')}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
