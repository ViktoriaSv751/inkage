'use client';
import { useEffect } from 'react';

/** In the store apps every page (also the website's sign-in, terms and FAQ pages) keeps its links inside the app. */
export function NativeLinks() {
  useEffect(() => {
    if ((window as any).Capacitor?.isNativePlatform?.()) import('@/lib/native').then((m) => m.installLinkGuard()).catch(() => {});
  }, []);
  return null;
}
