'use client';

import { CookieConsent } from '../SiteExtras';
import { useApp } from './AppProvider';

/** The same cookie choice inside the app, for people who open it directly. */
export function AppConsent() {
  const { ui } = useApp();
  // the store apps set no cookies of their own and track nothing across apps, but our own stats still need a yes
  const native = !!process.env.NEXT_PUBLIC_NATIVE_BUNDLE || (typeof window !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform?.());
  return <CookieConsent lang={ui.lang} native={native} />;
}
