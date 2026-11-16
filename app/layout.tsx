import '@/lib/tr-server';
import './fonts.css';
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
import { PageView } from './PageView';
import { NativeLinks } from './NativeLinks';

export async function generateMetadata(): Promise<Metadata> {
  const h = (await headers()).get('x-ink-lang');
  const L = isLang(h) ? h : 'hu';
  const path = (await headers()).get('x-ink-path') || '/';
  const inApp = /^\/app(\/|$)/.test(path);
  const title = `InkAge – ${tx(L, 'See your tattoo in 50 years', 'Nézd meg a tetoválásod 50 év múlva')}`;
  const description = tx(L, 'Upload a photo and see any design on your skin at 10, 30 and 50 years.', 'Tölts fel egy fotót, és nézd meg bármelyik mintát a bőrödön 10, 30 és 50 év múlva.');
  return {
    metadataBase: new URL(SITE_URL),
    title,
    description,
    // every page points Google at its own language version and lists the others (pages may override).
    // Not on the home page: Next drops the ?lang query from metadata URLs whose path is "/", which made all 35
    // home pages name the Hungarian one as canonical; RootLayout writes those <link>s itself (HomeLangLinks)
    alternates: path === '/' || inApp ? undefined : langAlternates(path, L),
    // the app's own screens stay out of search; its knowledge-base copies name the public article as canonical
    // (app/app/tudastar sets that), so Google never indexes /app/tudastar/... as a second, untitled copy
    robots: inApp && !path.startsWith('/app/tudastar') ? { index: false, follow: true } : undefined,
    // Google Search Console ownership check (the code from "HTML tag" verification) and the Pinterest website claim
    // of the @inkageapp business account (Settings → Link to Pinterest → Websites, 2026-11-08)
    verification: {
      ...(process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION } : {}),
      other: { 'p:domain_verify': '5ab26a9e6d9e08b04ff8eba075f6d41b' },
    },
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

/* The page's own code, React and Next write HTML and load chunks through DOM sinks; the default policy lets that through
   (scripts themselves are already limited by the nonce CSP) and refuses script URLs from other sites. */
const TT_POLICY = `(function(){try{if(window.trustedTypes&&!trustedTypes.defaultPolicy){var ok=function(u){try{var x=new URL(u,location.href);return x.origin===location.origin||x.protocol==='blob:'}catch(e){return false}};trustedTypes.createPolicy('default',{createHTML:function(s){return s},createScript:function(s){return s},createScriptURL:function(s){if(ok(s))return s;throw new TypeError('blocked script URL '+s)}})}}catch(e){}})();`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const h = (await headers()).get('x-ink-lang');
  const lang = isLang(h) ? h : 'hu';
  const home = ((await headers()).get('x-ink-path') || '/') === '/';
  const ver = (LOCALE_VER as Record<string, string>)[lang];
  const nonce = (await headers()).get('x-nonce') || undefined;
  return (
    <html lang={htmlLang(lang)} suppressHydrationWarning>
      <head>
        {home && <HomeLangLinks lang={lang} />}
        {home && process.env.NEXT_PUBLIC_SUPABASE_URL && <link rel="preconnect" href={process.env.NEXT_PUBLIC_SUPABASE_URL} crossOrigin="anonymous" />}
        {/* this language's words, before the page starts (Hungarian and English are built in) */}
        {/* Trusted Types default policy (the CSP requires them, lib/csp.ts), before any other script runs */}
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: TT_POLICY }} />
        {ver && <script nonce={nonce} src={`/locales/${lang}.js?v=${ver}`} />}
        {/* theme (dark unless light was chosen this visit) + language before first paint, so there is no flash */}
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var d=document.documentElement;var t=null;try{localStorage.removeItem('ink_theme');t=sessionStorage.getItem('ink_theme');}catch(e){}d.dataset.theme=t==='light'?'light':'dark';d.style.colorScheme=d.dataset.theme;var m=document.querySelector('meta[name=theme-color]');if(m)m.setAttribute('content',t==='light'?'#ffffff':'#000000');var q=new URLSearchParams(location.search).get('lang');var L=['hu','en','de','es','pt','fr','it','pl','tr','ro','nl','sv','cs','el','uk','ja','ko','id','th','zh','vi','fil','ms','zhs','da','no','fi','sk','hr','bg','sl','lt','lv','et','sr'];var l=q||localStorage.getItem('ink_lang')||'hu';d.lang=L.indexOf(l)>=0?l:'hu';try{var C=window.Capacitor;if(C&&C.isNativePlatform&&C.isNativePlatform()){d.classList.add('native');if(location.pathname==='/')location.replace('/app');}}catch(e){}try{var s=JSON.parse(sessionStorage.getItem('ink_splash')||'null');sessionStorage.removeItem('ink_splash');if(s&&Date.now()-s.t<180000)d.classList.add('splash','splash-'+(s.k==='out'?'out':'in'));}catch(e){}}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        <Splash />
        <PageView />
        <NativeLinks />
        <Suspense fallback={null}>
          <ScrollTop />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
