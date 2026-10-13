'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { setLang as saveLang } from '@/lib/i18n';
import { track } from '@/lib/store';
import { LangPicker, type Lang } from './LangPicker';
import './sitenav.css';

const I = {
  home: <path d="M4 10.5L12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z" />,
  spark: <path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" />,
  plus: <path d="M12 5v14M5 12h14" />,
  book: <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5zM4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5" />,
  help: <path d="M12 21a9 9 0 1 0 0-18a9 9 0 0 0 0 18zM9.5 9.3a2.6 2.6 0 0 1 5 .9c0 1.7-2.5 2.2-2.5 3.8M12 17h.01" />,
};

/**
 * Header + app-style bottom tab bar for every public page (landing, knowledge base, info pages).
 * `onLang` is given on pages that switch language in place; otherwise the URL gets ?lang=.
 */
export function SiteNav({ lang, path, onLang, signedIn = false }: { lang: Lang; path?: string; onLang?: (l: Lang) => void; signedIn?: boolean }) {
  const T = (en: string, hu: string) => (lang === 'hu' ? hu : en);
  const pathname = usePathname() || '/';
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [up, setUp] = useState(false);
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    if (!menu) return;
    document.body.style.overflow = 'hidden';
    const k = (e: KeyboardEvent) => e.key === 'Escape' && setMenu(false);
    window.addEventListener('keydown', k);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', k);
    };
  }, [menu]);
  useEffect(() => setMenu(false), [pathname]);
  useEffect(() => {
    const h = () => {
      setScrolled(window.scrollY > 6);
      setUp(window.scrollY > 900);
    };
    h();
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);
  const q = !onLang && lang === 'en' ? '?lang=en' : '';
  const pick = (l: Lang) => {
    saveLang(l);
    track('lang_pick', { l });
    if (onLang) onLang(l);
    else router.push(`${path || pathname}${l === 'en' ? '?lang=en' : ''}`);
  };
  const links = [
    { href: `/hogyan-mukodik${q}`, base: '/hogyan-mukodik', t: T('How it works', 'Hogyan működik') },
    { href: `/funkciok${q}`, base: '/funkciok', t: T('Features', 'Funkciók') },
    { href: `/tudastar${q}`, base: '/tudastar', t: T('Knowledge base', 'Tudástár') },
    { href: `/gyik${q}`, base: '/gyik', t: T('FAQ', 'GYIK') },
  ];
  const tabs = [
    { href: `/${q}`, base: '/', t: T('Home', 'Főoldal'), i: I.home },
    { href: `/funkciok${q}`, base: '/funkciok', t: T('Features', 'Funkciók'), i: I.spark },
    { href: '/app', base: '/app', t: T('Try it', 'Kipróbálom'), i: I.plus, cta: true },
    { href: `/tudastar${q}`, base: '/tudastar', t: T('Guides', 'Tudástár'), i: I.book },
    { href: `/gyik${q}`, base: '/gyik', t: T('FAQ', 'GYIK'), i: I.help },
  ];
  const isOn = (base: string) => (base === '/' ? pathname === '/' : pathname.startsWith(base));
  return (
    <>
      <header className={`sn-top ${scrolled ? 'scrolled' : ''}`}>
        <div className="sn-in">
          <Link href={`/${q}`} className="sn-logo" aria-label="InkAge">
            <svg viewBox="0 0 64 64" aria-hidden="true">
              <circle cx="32" cy="32" r="30" />
              <path d="M38 14a20 20 0 1 0 0 36a16 16 0 1 1 0-36z" />
            </svg>
            InkAge
          </Link>
          <nav className="sn-links" aria-label={T('Main', 'Fő menü')}>
            {links.map((l) => (
              <Link key={l.base} href={l.href} className={isOn(l.base) ? 'on' : ''} aria-current={isOn(l.base) ? 'page' : undefined}>
                {l.t}
              </Link>
            ))}
          </nav>
          <div className="sn-r">
            <Link className="sn-signin" href="/app" onClick={() => track('nav_signin')}>
              {signedIn ? T('Open app', 'App') : T('Sign in', 'Belépés')}
            </Link>
            <Link className="sn-cta" href="/app" onClick={() => track('nav_cta')}>
              {T('Try it free', 'Kipróbálom')}
            </Link>
            <button className="sn-burger" aria-label={T('Menu', 'Menü')} aria-expanded={menu} onClick={() => setMenu(true)}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 7h16M4 12h16M10 17h10" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <div className={`sn-drawer-wrap ${menu ? 'open' : ''}`} aria-hidden={!menu} onClick={() => setMenu(false)}>
        <aside className="sn-drawer" role="dialog" aria-modal="true" aria-label={T('Menu', 'Menü')} onClick={(e) => e.stopPropagation()}>
          <div className="sn-dr-head">
            <Link href={`/${q}`} className="sn-logo" aria-label="InkAge">
              <svg viewBox="0 0 64 64" aria-hidden="true">
                <circle cx="32" cy="32" r="30" />
                <path d="M38 14a20 20 0 1 0 0 36a16 16 0 1 1 0-36z" />
              </svg>
              InkAge
            </Link>
            <button className="sn-dr-x" aria-label={T('Close menu', 'Menü bezárása')} onClick={() => setMenu(false)}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
          <nav className="sn-dr-main">
            {[
              { href: `/${q}`, base: '/', t: T('Home', 'Főoldal') },
              { href: `/hogyan-mukodik${q}`, base: '/hogyan-mukodik', t: T('How it works', 'Hogyan működik') },
              { href: `/funkciok${q}`, base: '/funkciok', t: T('Features', 'Funkciók') },
              { href: `/tudastar${q}`, base: '/tudastar', t: T('Knowledge base', 'Tudástár') },
              { href: `/tattoo/fine-line-forearm${lang === 'en' ? '?lang=en' : ''}`, base: '/tattoo', t: T('Styles by body area', 'Stílusok testrészenként') },
              { href: `/gyik${q}`, base: '/gyik', t: T('FAQ', 'GYIK') },
            ].map((l) => (
              <Link key={l.base} href={l.href} className={isOn(l.base) ? 'on' : ''}>
                {l.t}
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </Link>
            ))}
          </nav>
          <nav className="sn-dr-sub">
            {[
              { href: `/ingyenes-beta${q}`, t: T('Free beta', 'Ingyenes béta') },
              { href: `/telepites${q}`, t: T('Install the app', 'Telepítés') },
              { href: `/mi-az-inkage${q}`, t: T('What is InkAge?', 'Mi az InkAge?') },
              { href: `/rolunk${q}`, t: T('About us', 'Rólunk') },
              { href: `/kapcsolat${q}`, t: T('Contact', 'Kapcsolat') },
              { href: `/adatbiztonsag${q}`, t: T('Data security', 'Adatbiztonság') },
            ].map((l) => (
              <Link key={l.href} href={l.href}>
                {l.t}
              </Link>
            ))}
          </nav>
          <div className="sn-dr-lang">
            <LangPicker lang={lang} onPick={pick} variant="row" label={T('Language', 'Nyelv')} />
          </div>
          <div className="sn-dr-cta">
            <Link className="sn-dr-try" href="/app" onClick={() => track('drawer_cta')}>
              {T('Try it free', 'Kipróbálom ingyen')}
            </Link>
            <Link className="sn-dr-in" href="/app">
              {signedIn ? T('Open app', 'App megnyitása') : T('Sign in', 'Belépés')}
            </Link>
          </div>
        </aside>
      </div>

      <nav className="sn-tabbar" aria-label={T('Site', 'Oldal')}>
        {tabs.map((t) => {
          const on = !t.cta && isOn(t.base);
          return (
            <Link key={t.base} href={t.href} className={`${on ? 'on' : ''} ${t.cta ? 'cta' : ''}`} aria-current={on ? 'page' : undefined} onClick={() => t.cta && track('tab_cta')}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                {t.i}
              </svg>
              {t.cta ? <span className="sr-only">{t.t}</span> : <span>{t.t}</span>}
            </Link>
          );
        })}
      </nav>

      <button className={`sn-up ${up ? 'show' : ''}`} aria-label={T('Back to top', 'Vissza a tetejére')} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 19V5M5 12l7-7 7 7" />
        </svg>
      </button>
    </>
  );
}
