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
import { isLang, tx, htmlLang } from '@/lib/tr';
import LOCALE_VER from '@/lib/locales/manifest.json';

export function generateMetadata(): Metadata {
  const h = headers().get('x-ink-lang');
  const L = isLang(h) ? h : 'hu';
  const title = `InkAge – ${tx(L, 'See your tattoo in 50 years', 'Nézd meg a tetoválásod 50 év múlva')}`;
  const description = tx(L, 'Upload a photo and see any design on your skin at 10, 30 and 50 years.', 'Tölts fel egy fotót, és nézd meg bármelyik mintát a bőrödön 10, 30 és 50 év múlva.');
  return {
    title,
    description,
    manifest: '/manifest.webmanifest',
    appleWebApp: { capable: true, title: 'InkAge', statusBarStyle: 'default' },
    icons: { icon: '/icon.svg', apple: '/icons/apple-touch-icon.png' },
    openGraph: { title, description, type: 'website' },
  };
}
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#ffffff', colorScheme: 'light' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const h = headers().get('x-ink-lang');
  const lang = isLang(h) ? h : 'hu';
  const ver = (LOCALE_VER as Record<string, string>)[lang];
  return (
    <html lang={htmlLang(lang)} suppressHydrationWarning>
      <head>
        {/* this language's words, before the page starts (Hungarian and English are built in) */}
        {ver && <script src={`/locales/${lang}.js?v=${ver}`} />}
        {/* theme + language before first paint, so there is no flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var d=document.documentElement;var t=null;try{localStorage.removeItem('ink_theme');t=sessionStorage.getItem('ink_theme');}catch(e){}d.dataset.theme=t==='dark'?'dark':'light';if(t==='dark'){var m=document.querySelector('meta[name=theme-color]');if(m)m.setAttribute('content','#000000');}var q=new URLSearchParams(location.search).get('lang');var L=['hu','en','de','es','pt','fr','it','pl','tr','ro','nl','sv','cs','el','uk','ja','ko','id','th','zh','vi','fil','ms','zhs','da','no','fi','sk','hr','bg'];var l=q||localStorage.getItem('ink_lang')||'hu';d.lang=L.indexOf(l)>=0?l:'hu';}catch(e){}})();`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
