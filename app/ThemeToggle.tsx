'use client';

import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';
const read = (): Theme => (typeof document !== 'undefined' && document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');

export function applyTheme(t: Theme) {
  document.documentElement.dataset.theme = t;
  // only for this visit: every time the app is opened it starts in light mode
  try {
    sessionStorage.setItem('ink_theme', t);
  } catch {}
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'dark' ? '#000000' : '#ffffff');
  window.dispatchEvent(new CustomEvent('ink-theme', { detail: t }));
}

/** Light / dark switch, kept in sync across every toggle on the page. */
export function ThemeToggle({ className = '', lang = 'hu' }: { className?: string; lang?: 'en' | 'hu' }) {
  const [t, setT] = useState<Theme>('light');
  useEffect(() => {
    const cur = read();
    setT(cur);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', cur === 'dark' ? '#000000' : '#ffffff');
    const h = (e: Event) => setT((e as CustomEvent).detail);
    window.addEventListener('ink-theme', h);
    return () => window.removeEventListener('ink-theme', h);
  }, []);
  const dark = t === 'dark';
  const label = dark ? (lang === 'hu' ? 'Világos mód' : 'Light mode') : lang === 'hu' ? 'Sötét mód' : 'Dark mode';
  return (
    <button type="button" className={`theme-tg ${className}`} aria-label={label} title={label} aria-pressed={dark} onClick={() => applyTheme(dark ? 'light' : 'dark')}>
      <svg viewBox="0 0 24 24" aria-hidden="true" className="tg-sun">
        <circle cx="12" cy="12" r="4.2" />
        <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" />
      </svg>
      <svg viewBox="0 0 24 24" aria-hidden="true" className="tg-moon">
        <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
      </svg>
    </button>
  );
}
