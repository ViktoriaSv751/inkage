import '@/lib/tr-server';
import '@fontsource/geist-sans/400.css';
import '@fontsource/geist-sans/500.css';
import '@fontsource/geist-sans/600.css';
import '@fontsource/geist-sans/700.css';
import '@fontsource/geist-sans/800.css';
import './globals.css';
import './dark.css';
import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import { isLang, tx, htmlLang, type Lang } from '@/lib/tr';
import LOCALE_VER from '@/lib/locales/manifest.json';
import { Suspense } from 'react';
import { SITE_URL, langAlternates } from '@/lib/site';
import { ScrollTop } from './ScrollTop';
import { Splash } from './Splash';

export function generateMetadata(): Metadata {
  const h = headers().get('x-ink-lang');
  const L = isLang(h) ? h : 'hu';
  const path = headers().get('x-ink-path') || '/';
  const title = `InkAge – ${tx(L, 'See your tattoo in 50 years', 'Nézd meg a tetoválásod 50 év múlva')}`;
  const description = tx(L, 'Upload a photo and see any design on your skin at 10, 30 and 50 years.', 'Tölts fel egy fotót, és nézd meg bármelyik mintát a bőrödön 10, 30 és 50 év múlva.');
  return {
    metadataBase: new URL(SITE_URL),
    title,
    description,
    // every page points Google at its own language version and lists the others (pages may override).
    // Not on the home page: Next drops the ?lang query from metadata URLs whose path is "/", which made all 35
    // home pages name the Hungarian one as canonical; RootLayout writes those <link>s itself (HomeLangLinks)
    alternates: path === '/' ? undefined : langAlternates(path, L),
    // Google Search Console ownership check (the code from "HTML tag" verification)
    verification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION } : undefined,
    manifest: '/manifest.webmanifest',
    appleWebApp: { capable: true, title: 'InkAge', statusBarStyle: 'default' },
    icons: { icon: '/icon.svg', apple: '/icons/apple-touch-icon.png' },
    openGraph: { title, description, type: 'website' },
  };
}
// dark is the default look (light only when chosen with the theme switch, for that visit)
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#000000', colorScheme: 'dark' };

/** canonical and hreflang <link>s of the home page, with their ?lang query intact (see generateMetadata) */
function HomeLangLinks({ lang }: { lang: Lang }) {
  const { canonical, languages } = langAlternates('/', lang);
  return (
    <>
      <link rel="canonical" href={canonical} />
      {Object.entries(languages).map(([l, href]) => <link key={l} rel="alternate" hrefLang={l} href={href} />)}
    </>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const h = headers().get('x-ink-lang');
  const lang = isLang(h) ? h : 'hu';
  const home = (headers().get('x-ink-path') || '/') === '/';
  const ver = (LOCALE_VER as Record<string, string>)[lang];
  return (
    <html lang={htmlLang(lang)} suppressHydrationWarning>
      <head>
        {home && <HomeLangLinks lang={lang} />}
        {/* this language's words, before the page starts (Hungarian and English are built in) */}
        {ver && <script src={`/locales/${lang}.js?v=${ver}`} />}
        {/* theme (dark unless light was chosen this visit) + language before first paint, so there is no flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var d=document.documentElement;var t=null;try{localStorage.removeItem('ink_theme');t=sessionStorage.getItem('ink_theme');}catch(e){}d.dataset.theme=t==='light'?'light':'dark';d.style.colorScheme=d.dataset.theme;var m=document.querySelector('meta[name=theme-color]');if(m)m.setAttribute('content',t==='light'?'#ffffff':'#000000');var q=new URLSearchParams(location.search).get('lang');var L=['hu','en','de','es','pt','fr','it','pl','tr','ro','nl','sv','cs','el','uk','ja','ko','id','th','zh','vi','fil','ms','zhs','da','no','fi','sk','hr','bg','sl','lt','lv','et','sr'];var l=q||localStorage.getItem('ink_lang')||'hu';d.lang=L.indexOf(l)>=0?l:'hu';try{var C=window.Capacitor;if(C&&C.isNativePlatform&&C.isNativePlatform()){d.classList.add('native');if(location.pathname==='/')location.replace('/app');}}catch(e){}try{var s=JSON.parse(sessionStorage.getItem('ink_splash')||'null');sessionStorage.removeItem('ink_splash');if(s&&Date.now()-s.t<180000)d.classList.add('splash','splash-'+(s.k==='out'?'out':'in'));}catch(e){}}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        <Splash />
        <Suspense fallback={null}>
          <ScrollTop />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
