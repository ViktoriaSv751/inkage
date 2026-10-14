'use client';

import { CookieConsent } from '../SiteExtras';
import { useApp } from './AppProvider';

/** The same cookie choice inside the app, for people who open it directly. */
export function AppConsent() {
  const { ui } = useApp();
  return <CookieConsent lang={ui.lang} />;
}
