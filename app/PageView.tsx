'use client';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

/** Counts every page view for the owner's dashboard without cookies or storage (see app/api/pv). The visit id that
 *  comes back is kept in memory only, so the events of visitors who accepted usage stats join the same visit. */
export function PageView() {
  const path = usePathname();
  useEffect(() => {
    if (!path || path.startsWith('/admin')) return;
    try {
      if (/InkAgeApp/.test(navigator.userAgent) || (window as any).Capacitor?.isNativePlatform?.()) return;
      if (!/(^|\.)inkage\.app$/.test(location.hostname)) return;
      const w = window as any;
      // where the visit came from: read once, on its first page
      if (!w.__inkSrc) {
        const q = new URLSearchParams(location.search);
        const o: Record<string, string> = {};
        const set = (k: string, v: string | null) => v && (o[k] = v.slice(0, 60));
        set('us', q.get('utm_source')); set('um', q.get('utm_medium')); set('uc', q.get('utm_campaign')); set('ux', q.get('utm_content')); set('ref', q.get('ref'));
        try { if (document.referrer) { const h = new URL(document.referrer).hostname; if (h !== location.hostname) o.from = h.slice(0, 60); } } catch {}
        o.land = location.pathname.slice(0, 60);
        w.__inkSrc = o;
      }
      const u = navigator.userAgent || '';
      const ia = /musical_ly|bytedance|tiktok/i.test(u) ? 'tiktok' : /instagram/i.test(u) ? 'instagram' : /FBAN|FBAV|FB_IAB|FBIOS/.test(u) ? 'facebook' : /pinterest/i.test(u) ? 'pinterest' : /snapchat/i.test(u) ? 'snapchat' : /linkedinapp/i.test(u) ? 'linkedin' : undefined;
      fetch('/api/pv', {
        method: 'POST',
        keepalive: true,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path: location.pathname, lang: document.documentElement.lang, ia, ...w.__inkSrc }),
      })
        .then((r) => (r.ok && r.status === 200 ? r.json() : null))
        .then((j) => j?.sid && (w.__inkSid = j.sid))
        .catch(() => {});
    } catch {}
  }, [path]);
  return null;
}
