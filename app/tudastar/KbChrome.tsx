'use client';

import { SiteNav } from '../SiteNav';

/** Public-site chrome for the knowledge base and info pages (header, tab bar, back-to-top). */
export function KbChrome({ lang, path = '/tudastar' }: { lang: 'en' | 'hu'; back?: string | null; crumb?: string; light?: boolean; path?: string }) {
  return <SiteNav lang={lang} path={path} />;
}
