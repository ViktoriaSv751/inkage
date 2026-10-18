'use client';
import { useEffect, useState } from 'react';
import { tx, isLang, type Lang } from '@/lib/tr';
import { track } from '@/lib/store';

const KEY = 'ink_err_reload';
// a new version went live while this page was open: its old code files are gone → just load the new version
const isStale = (e: Error) => /ChunkLoadError|Loading (CSS )?chunk|dynamically imported module|importing a module script/i.test(`${e?.name} ${e?.message}`);

/** Shown instead of the blank "Application error" page: reloads by itself once, and always offers a way back in. */
export function Recover({ error }: { error: Error & { digest?: string } }) {
  const [lang, setLang] = useState<Lang>('hu');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let l: string | null = null;
    try {
      l = new URLSearchParams(location.search).get('lang') || localStorage.getItem('ink_lang');
    } catch {}
    l = l || document.documentElement.lang;
    if (isLang(l)) setLang(l);
    try {
      track('client_error', { msg: String(error?.message || error).slice(0, 200), src: `boundary ${error?.digest || ''}`, path: location.pathname });
    } catch {}
    // one automatic reload (not more often than every 20 s, so it can never loop)
    try {
      const last = Number(sessionStorage.getItem(KEY) || 0);
      if (Date.now() - last > 20000) {
        sessionStorage.setItem(KEY, String(Date.now()));
        if (isStale(error)) location.reload();
      }
    } catch {}
  }, [error]);
  const T = (en: string, hu: string) => tx(lang, en, hu);

  const reload = () => {
    try {
      sessionStorage.setItem(KEY, String(Date.now()));
    } catch {}
    location.reload();
  };
  // forget this device's sign-in (and nothing else), then the sign-in page
  const fresh = async () => {
    setBusy(true);
    try {
      const { sb } = await import('@/lib/sb');
      await sb()?.auth.signOut({ scope: 'local' }).catch(() => {});
    } catch {}
    try {
      Object.keys(localStorage)
        .filter((k) => /^sb-.*-auth-token/.test(k))
        .forEach((k) => localStorage.removeItem(k));
      sessionStorage.clear();
    } catch {}
    location.replace(`/belepes${lang === 'hu' ? '' : `?lang=${lang}`}`);
  };

  return (
    <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 24, fontFamily: 'system-ui, -apple-system, sans-serif', background: '#fff', color: '#111' }}>
      <div style={{ maxWidth: 360, textAlign: 'center' }}>
        <h1 style={{ fontSize: 22, margin: '0 0 8px' }}>{T('Something went wrong', 'Valami elromlott')}</h1>
        <p style={{ margin: '0 0 20px', color: '#555', lineHeight: 1.5 }}>
          {T('Reload the page. If it keeps happening, sign in again – your designs stay safe.', 'Töltsd újra az oldalt. Ha újra előjön, lépj be újra – a terveid megmaradnak.')}
        </p>
        <div style={{ display: 'grid', gap: 10 }}>
          <button onClick={reload} style={btn(true)}>
            {T('Reload', 'Újratöltés')}
          </button>
          <button onClick={fresh} disabled={busy} style={btn(false)}>
            {T('Sign out and sign in again', 'Kijelentkezés és újra belépés')}
          </button>
        </div>
      </div>
    </div>
  );
}
const btn = (primary: boolean): React.CSSProperties => ({
  padding: '14px 18px',
  borderRadius: 999,
  border: primary ? 'none' : '1px solid #ccc',
  background: primary ? '#111' : '#fff',
  color: primary ? '#fff' : '#111',
  fontSize: 16,
  fontWeight: 600,
  cursor: 'pointer',
});
