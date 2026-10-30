'use client';
import { qOf } from '@/lib/tr';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { sb } from '@/lib/sb';
import { haptic } from '@/lib/store';
import { useApp } from '../AppProvider';
import { tx } from '@/lib/i18n';
import { ThemeToggle } from '../../ThemeToggle';
import { LangPicker } from '../../LangPicker';
import { LogoMark } from '../../LogoMark';
import { Icon } from './Icon';

export function TopBar() {
  const { me, ui, profile } = useApp();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 4);
    h();
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);
  return (
    <header className={`topbar ${scrolled ? 'scrolled' : ''}`}>
      <div className="topbar-in">
        {/* signed in, the logo leads to your designs (the gallery); otherwise to the start */}
        <Link className="logo" href={me.user ? '/app/gallery' : '/app'} aria-label="InkAge">
          <LogoMark />
          InkAge
        </Link>
        <div className="topbar-r">
        <AppLang className="sm" />
        <ThemeToggle className="sm" lang={ui.lang} />
        {me.user ? (
          <Link href="/app/profile" className="avatar" style={{ width: 34, height: 34, fontSize: 15, textDecoration: 'none', position: 'relative', overflow: 'hidden', flex: 'none' }} aria-label={ui.t('nav.profile')}>
            {profile.avatar ? (
              <img src={profile.avatar} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
            ) : (
              (profile.name || me.user.email || '?').slice(0, 1).toUpperCase()
            )}
          </Link>
        ) : (
          <span className="beta-pill">{tx(ui.lang, 'Beta', 'Béta')}</span>
        )}
        </div>
      </div>
    </header>
  );
}

/** Desktop: the light/dark switch in the top right corner. */
export function DeskTheme() {
  const { ui } = useApp();
  return (
    <div className="desk-tg">
      <AppLang />
      <ThemeToggle lang={ui.lang} />
    </div>
  );
}

/** The language switch next to the light/dark switch (saved to the account too). */
export function AppLang({ className = '' }: { className?: string }) {
  const { ui, me } = useApp();
  return (
    <span className={`tg-lang ${className}`}>
      <LangPicker
        lang={ui.lang}
        variant="icon"
        onPick={async (l) => {
          if (me.user) await Promise.resolve(sb()?.rpc('save_profile', { p_onboarding: me.onboarding ?? null, p_lang: l })).catch(() => {});
          ui.setLang(l);
        }}
      />
    </span>
  );
}

export function BottomNav() {
  const path = usePathname();
  const { ui, me } = useApp();
  const router = useRouter();
  const [going, setGoing] = useState<string | null>(null);
  useEffect(() => setGoing(null), [path]);
  // every tab is ready before it is tapped
  useEffect(() => {
    for (const h of ['/app', '/app/gallery', '/app/explore', '/app/profile']) router.prefetch(h);
  }, [router]);
  // phones: go on the finger lift itself – iPhone Safari sometimes swallows the first "click" near the bottom edge
  const lastTouch = useRef(0);
  const go = (href: string) => {
    haptic();
    setGoing(href);
    // "New design" always starts with empty photo and design slots (recent photos stay)
    if (href === '/app') try { sessionStorage.setItem('ink_fresh', '1'); } catch {}
    if (href !== path) router.push(href);
    else if (href === '/app') window.dispatchEvent(new Event('ink:fresh'));
  };
  const items = [
    { href: '/app', label: ui.t('nav.create'), icon: Icon.plus },
    { href: '/app/gallery', label: ui.t('nav.gallery'), icon: Icon.grid },
    { href: '/app/explore', label: ui.t('nav.explore'), icon: Icon.compass },
    { href: '/app/profile', label: ui.t('nav.profile'), icon: Icon.user },
  ];
  const q = qOf(ui.lang);
  return (
    <nav className="tabbar" aria-label="Main">
      <Link href={me.user ? '/app/gallery' : '/'} className="rail-logo" aria-label="InkAge">
        <LogoMark />
        InkAge
      </Link>
      {items.map((it, i) => {
        // articles, guides and community posts opened from Explore keep Explore lit
        const fromExplore = it.href === '/app/explore' && /^\/app\/(tudastar|tattoo|v)(\/|$)/.test(path || '');
        const on = it.href === '/app' ? path === '/app' : fromExplore || path?.startsWith(it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            className={`${i === 0 ? 'cta' : ''} ${(going ? going === it.href : on) ? 'on' : ''}`}
            aria-current={on ? 'page' : undefined}
            onPointerUp={(e) => {
              if (e.pointerType !== 'touch') return;
              lastTouch.current = Date.now();
              go(it.href);
            }}
            onClick={(e) => {
              e.preventDefault();
              if (Date.now() - lastTouch.current < 800) return; // already handled on the touch
              go(it.href);
            }}
          >
            {it.icon}
            <span>{it.label}</span>
          </Link>
        );
      })}
      <div className="rail-foot">
        <div className="rail-beta">
          <b>{tx(ui.lang, 'Beta', 'Béta')}</b>
          <p>{tx(ui.lang, 'You get 30 previews a month with your account.', 'A fiókoddal havonta 30 előnézet jár.')}</p>
        </div>
        <Link href={`/tudastar${q}`}>{tx(ui.lang, 'Guides', 'Tudástár')}</Link>
        <Link href={`/gyik${q}`}>{tx(ui.lang, 'FAQ', 'GYIK')}</Link>
        <Link className="web-only" href={`/${q}`}>{tx(ui.lang, 'Back to website', 'Vissza a weboldalra')}</Link>
      </div>
    </nav>
  );
}
