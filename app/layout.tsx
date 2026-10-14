import '@fontsource/geist-sans/400.css';
import '@fontsource/geist-sans/500.css';
import '@fontsource/geist-sans/600.css';
import '@fontsource/geist-sans/700.css';
import '@fontsource/geist-sans/800.css';
import './globals.css';
import './dark.css';
import type { Metadata, Viewport } from 'next';

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
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#ffffff', colorScheme: 'light dark' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="hu" suppressHydrationWarning>
      <head>
        {/* theme + language before first paint, so there is no flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var d=document.documentElement;var t=localStorage.getItem('ink_theme');d.dataset.theme=t==='dark'?'dark':'light';if(t==='dark'){var m=document.querySelector('meta[name=theme-color]');if(m)m.setAttribute('content','#000000');}var q=new URLSearchParams(location.search).get('lang');var l=q||(location.pathname.indexOf('/app')===0?localStorage.getItem('ink_lang'):null)||'hu';d.lang=l==='en'?'en':'hu';}catch(e){}})();`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
