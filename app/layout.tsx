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
import { isLang } from '@/lib/tr';
import LOCALE_VER from '@/lib/locales/manifest.json';

export const metadata: Metadata = {
  title: 'InkAge – See your tattoo in 50 years',
  description: 'Upload a photo and any tattoo design. See it fresh, healed, and aged 10, 30 and 50 years – then make a time-lapse video.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'InkAge', statusBarStyle: 'default' },
  icons: { icon: '/icon.svg', apple: '/icons/apple-touch-icon.png' },
  openGraph: {
    title: 'InkAge – See your tattoo in 50 years',
    description: 'Try a tattoo on your own photo and watch it age 50 years.',
    type: 'website',
  },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#ffffff', colorScheme: 'light' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const h = headers().get('x-ink-lang');
  const lang = isLang(h) ? h : 'hu';
  const ver = (LOCALE_VER as Record<string, string>)[lang];
  return (
    <html lang={lang} suppressHydrationWarning>
      <head>
        {/* this language's words, before the page starts (Hungarian and English are built in) */}
        {ver && <script src={`/locales/${lang}.js?v=${ver}`} />}
        {/* theme + language before first paint, so there is no flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var d=document.documentElement;var t=null;try{localStorage.removeItem('ink_theme');t=sessionStorage.getItem('ink_theme');}catch(e){}d.dataset.theme=t==='dark'?'dark':'light';if(t==='dark'){var m=document.querySelector('meta[name=theme-color]');if(m)m.setAttribute('content','#000000');}var q=new URLSearchParams(location.search).get('lang');var L=['hu','en','de','es','pt','fr','it','pl','tr','ro'];var l=q||localStorage.getItem('ink_lang')||'hu';d.lang=L.indexOf(l)>=0?l:'hu';}catch(e){}})();`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
