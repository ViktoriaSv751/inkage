'use client';

import { useState } from 'react';
import { track } from '@/lib/store';

export function ShareBtn({ title, lang }: { title: string; lang: 'en' | 'hu' }) {
  const [done, setDone] = useState(false);
  return (
    <button
      className="ka-share"
      onClick={async () => {
        const nav: any = navigator;
        track('kb_share');
        if (nav.share) await nav.share({ title, url: location.href }).catch(() => {});
        else {
          await navigator.clipboard.writeText(location.href).catch(() => {});
          setDone(true);
          setTimeout(() => setDone(false), 2000);
        }
      }}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3v12M7 8l5-5 5 5M5 14v6h14v-6" />
      </svg>
      {done ? (lang === 'hu' ? 'Link másolva' : 'Link copied') : lang === 'hu' ? 'Megosztás' : 'Share'}
    </button>
  );
}

export function Helpful({ slug, lang }: { slug: string; lang: 'en' | 'hu' }) {
  const [v, setV] = useState<'' | 'yes' | 'no'>('');
  const T = (en: string, hu: string) => (lang === 'hu' ? hu : en);
  return (
    <div className="ka-helpful">
      <b>{v ? T('Thanks for the feedback!', 'Köszönjük a visszajelzést!') : T('Was this page helpful?', 'Hasznos volt ez az oldal?')}</b>
      {!v && (
        <div>
          {(['yes', 'no'] as const).map((k) => (
            <button
              key={k}
              onClick={() => {
                setV(k);
                track('kb_helpful', { slug, v: k });
              }}
            >
              {k === 'yes' ? '👍 ' + T('Yes', 'Igen') : '👎 ' + T('No', 'Nem')}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
