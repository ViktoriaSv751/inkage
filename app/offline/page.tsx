'use client';
import { useLang, tx } from '@/lib/i18n';

/** Shown by the service worker when a page can't load without internet. */
export default function Offline() {
  const { lang } = useLang();
  const t = (en: string, hu: string) => tx(lang, en, hu);
  return (
    <main style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center', background: 'var(--bg)', color: 'var(--ink)' }}>
      <div style={{ maxWidth: 420, display: 'grid', gap: 12, justifyItems: 'center' }}>
        <svg viewBox="0 0 24 24" width="56" height="56" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
          <path d="M2 8.8a15 15 0 0 1 20 0M5 12.6a10 10 0 0 1 14 0M8.5 16.1a5 5 0 0 1 7 0M12 20h.01M3 3l18 18" />
        </svg>
        <h1 style={{ margin: 0, fontSize: 30, letterSpacing: '-.03em' }}>{t('No internet connection', 'Nincs internetkapcsolat')}</h1>
        <p style={{ margin: 0, color: 'var(--ink-2)', lineHeight: 1.55 }}>
          {t('Previews need the internet. Your saved designs are safe – reconnect to continue.', 'Az előnézetekhez internet kell. Az ezen az eszközön mentett terveid megmaradnak – csatlakozz újra, és folytathatod.')}
        </p>
        <a className="btn" href="/app" style={{ marginTop: 8 }}>
          {t('Try again', 'Újrapróbálom')}
        </a>
      </div>
    </main>
  );
}
