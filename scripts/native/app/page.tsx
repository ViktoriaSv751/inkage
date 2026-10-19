'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BUNDLED_PATH, SITE_URL } from '@/lib/site';
import { openRemote } from '@/lib/native-bundle';

/* Store-app build: every full page load starts here (the app serves this page for any address).
   Send it on to the screen it asked for; addresses that only exist on the website open there. */
export default function Start() {
  const router = useRouter();
  useEffect(() => {
    const p = location.pathname.replace(/\/index\.html$/, '/');
    const rest = location.search + location.hash;
    if (p === '/' || p === '') return router.replace('/app' + rest);
    if (BUNDLED_PATH.test(p)) {
      // the router believes it is on this address already (it shows the start page), so the same address
      // would be ignored: add a marker to make it a real navigation
      const qs = location.search ? location.search + '&start=1' : '?start=1';
      return router.replace(p + qs + location.hash);
    }
    openRemote(SITE_URL + p + rest);
    router.replace('/app');
  }, [router]);
  return <div style={{ minHeight: '100dvh', background: 'var(--bg, #000)' }} />;
}
