import '@fontsource/geist-sans/400.css';
import '@fontsource/geist-sans/500.css';
import '@fontsource/geist-sans/600.css';
import '@fontsource/geist-sans/700.css';
import '@fontsource/geist-sans/800.css';
import './globals.css';
import './dark.css';
import type { Metadata, Viewport } from 'next';
import { Suspense } from 'react';
import { ScrollTop } from './ScrollTop';
import { NativeBoot } from './NativeBoot';

/* Store-app build (scripts/native-build.mjs): the same screens as https://inkage.app/app, carried inside the app.
   No server here, so the language comes from the device (or the person's choice) before the first paint. */
export const metadata: Metadata = { title: 'InkAge' };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#000000', colorScheme: 'dark' };

const MANIFEST = {"de": "e7d29a3a80", "es": "1c55c845fd", "pt": "6296d16ac3", "fr": "16b45883bc", "it": "7a6e822b5d", "pl": "6fc8d48f8f", "tr": "0a92bcebb1", "ro": "0ba59331b4", "nl": "c973418bae", "sv": "a61097e7ae", "cs": "6eeaeb989e", "el": "5504ded5b7", "uk": "0a869c0f94", "ja": "b82feee7ba", "ko": "e48d133a71", "id": "010e6b918a", "th": "17a0817f41", "zh": "617183020b", "vi": "33ef812eb9", "fil": "489e24afbc", "ms": "e1225be953", "zhs": "77e23c5462", "da": "2b65dacba7", "no": "4fab014165", "fi": "e9f3218786", "sk": "73fc1009e5", "hr": "b1afb4a47f", "bg": "3b0dc914f8", "sl": "5bb34db56b", "lt": "0cca2292c9", "lv": "cbb3daf20b", "et": "9c40ed5e08", "sr": "8ab5c4e73b"};
const BOOT = `(function(){try{var d=document.documentElement;var t=null;try{t=sessionStorage.getItem('ink_theme');}catch(e){}d.dataset.theme=t==='light'?'light':'dark';d.style.colorScheme=d.dataset.theme;
var L=['hu','en','de','es','pt','fr','it','pl','tr','ro','nl','sv','cs','el','uk','ja','ko','id','th','zh','vi','fil','ms','zhs','da','no','fi','sk','hr','bg','sl','lt','lv','et','sr'];
function dev(){var ls=(navigator.languages&&navigator.languages.length?navigator.languages:[navigator.language||'en']);for(var i=0;i<ls.length;i++){var x=String(ls[i]).toLowerCase();if(/^zh-(cn|hans|sg)/.test(x))return 'zhs';if(/^zh/.test(x))return 'zh';var b=x.split('-')[0];if(b==='nb'||b==='nn')b='no';if(b==='tl')b='fil';if(L.indexOf(b)>=0)return b;}return 'en';}
var q=new URLSearchParams(location.search).get('lang');var s=null;try{s=localStorage.getItem('ink_lang');}catch(e){}
var l=(q&&L.indexOf(q)>=0)?q:(s&&L.indexOf(s)>=0)?s:dev();d.lang=l;try{if(!s)localStorage.setItem('ink_lang',l);}catch(e){}
var v=${JSON.stringify(MANIFEST)}[l];if(v)document.write('<script src="/locales/'+l+'.js?v='+v+'"><'+'/script>');}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: BOOT }} />
      </head>
      <body>
        <NativeBoot />
        <Suspense fallback={null}>
          <ScrollTop />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
