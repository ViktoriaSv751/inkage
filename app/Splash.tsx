'use client';
import { useEffect } from 'react';
import { LogoMark } from './LogoMark';
import { leaveSplash } from '@/lib/splash';

/** Logo on a plain background, then the page opens up behind it. Hidden unless <html> has the "splash" class. */
export function Splash() {
  useEffect(() => {
    const d = document.documentElement;
    if (d.classList.contains('splash') && !d.classList.contains('splash-cover')) leaveSplash(d.classList.contains('splash-out') ? 650 : 1050);
  }, []);
  return (
    <div className="ink-splash" aria-hidden="true">
      <div className="ink-splash-in">
        <LogoMark />
        <span>InkAge</span>
      </div>
    </div>
  );
}
