'use client';
import { useEffect, useState } from 'react';
import { track } from '@/lib/store';

/** Add to Home Screen: the browser's install prompt, or the how-to sheet where there is none. */
export function useInstall() {
  const [installEvt, setInstallEvt] = useState<any>(null);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);
  const [howto, setHowto] = useState(false);

  useEffect(() => {
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    setInstalled(window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true || !!(window as any).Capacitor?.isNativePlatform?.());
    const h = (e: any) => {
      e.preventDefault();
      setInstallEvt(e);
    };
    window.addEventListener('beforeinstallprompt', h);
    return () => window.removeEventListener('beforeinstallprompt', h);
  }, []);

  const install = async () => {
    if (installEvt) {
      installEvt.prompt();
      const r = await installEvt.userChoice.catch(() => null);
      if (r?.outcome === 'accepted') {
        setInstalled(true);
        track('pwa_installed');
      }
      setInstallEvt(null);
    } else setHowto(true);
  };

  return { installed, ios, howto, setHowto, install };
}
