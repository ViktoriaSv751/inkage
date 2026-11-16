'use client';
/* First-party analytics and small device helpers, split out of lib/store (2026-11-16) so article and landing
   pages can count events without loading supabase-js. lib/store re-exports everything here. */
import { rpcLite } from './sb-lite';

// ---------------------------------------------------------------- tiny helpers

// storage full or blocked (private mode): an id for this visit, so such visitors don't all merge into one "na"
let tabAnon: string | null = null;
export function anonId() {
  let id: string | null = null;
  try {
    id = localStorage.getItem('ink_anon');
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem('ink_anon', id);
    }
    return id;
  } catch {
    return id || (tabAnon ||= typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `v${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`);
  }
}

/** Signing up says "I'm 18 or older": the age gate doesn't ask again. A "No" given on this device stays. */
export function ageAgreed() {
  try {
    if (localStorage.getItem('ink_age_ok') !== JSON.stringify('no')) localStorage.setItem('ink_age_ok', JSON.stringify('yes'));
  } catch {}
}

export function haptic(kind: 'tap' | 'success' | 'warn' = 'tap') {
  try {
    navigator.vibrate?.(kind === 'success' ? [12, 40, 18] : kind === 'warn' ? [30, 50, 30] : 8);
  } catch {}
}

/* What the owner's dashboard (/admin) reads from every event besides its name: the visit it belongs to (one id per
   browser tab, sessionStorage), the page and the language, and once per visit where it came from (the utm_* tags and
   ?ref of its first page, the referring site, the in-app browser it opened in). No name, photo or e-mail, ever.
   The database moves sid / path / lang into their own columns (events_ink_fill). */
function visitId() {
  try {
    let v = sessionStorage.getItem('ink_sid');
    if (!v) {
      v = Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem('ink_sid', v);
    }
    return v;
  } catch {
    return undefined;
  }
}
type Source = { us?: string; um?: string; uc?: string; ux?: string; ref?: string; from?: string; land?: string; ret?: string };
let src: Source | null = null;
export function visitSource(): Source {
  if (src) return src;
  try {
    const kept = sessionStorage.getItem('ink_src');
    if (kept) return (src = JSON.parse(kept) as Source);
  } catch {}
  const o: Source = {};
  try {
    const q = new URLSearchParams(location.search);
    const cut = (v: string | null) => (v ? v.slice(0, 60) : undefined);
    o.us = cut(q.get('utm_source'));
    o.um = cut(q.get('utm_medium'));
    o.uc = cut(q.get('utm_campaign'));
    o.ux = cut(q.get('utm_content'));
    o.ref = cut(q.get('ref'));
    if (document.referrer) {
      const h = new URL(document.referrer).hostname;
      if (h !== location.hostname) o.from = h.slice(0, 60);
    }
    o.land = location.pathname.slice(0, 60);
    // no link and no referring site, from a browser that has been here before: someone coming back by themselves
    let seen = false;
    try {
      seen = localStorage.getItem('ink_seen') === '1';
      localStorage.setItem('ink_seen', '1');
    } catch {}
    if (seen && !o.us && !o.from && !o.ref) o.ret = '1';
    for (const k of Object.keys(o) as (keyof Source)[]) if (!o[k]) delete o[k];
    sessionStorage.setItem('ink_src', JSON.stringify(o));
  } catch {}
  return (src = o);
}
/** The owner's own devices send nothing: /admin marks the browser it runs in, ?inkage_own=1 marks any other one (?inkage_own=0 clears it). */
export function isOwnDevice() {
  try {
    const q = new URLSearchParams(location.search).get('inkage_own');
    if (q === '1') {
      localStorage.setItem('inkage.own', '1');
      document.cookie = 'inkage_own=1; path=/; max-age=63072000; samesite=lax; secure';
    }
    if (q === '0') {
      localStorage.removeItem('inkage.own');
      document.cookie = 'inkage_own=; path=/; max-age=0';
    }
    return localStorage.getItem('inkage.own') === '1';
  } catch {
    return false;
  }
}
// speed tests, crawlers that run JavaScript, and copies of the site on another host (local tests) are not visitors
function isRobot() {
  try {
    if (navigator.webdriver) return true;
    if (/bot|crawl|spider|slurp|lighthouse|pagespeed|headless|ptst|google-inspectiontool|bingpreview|facebookexternalhit/i.test(navigator.userAgent || '')) return true;
    if (/^https?:$/.test(location.protocol) && !/(^|\.)inkage\.app$/.test(location.hostname) && !/InkAgeApp/.test(navigator.userAgent)) return true;
  } catch {}
  return false;
}
// the in-app browser the page is shown in (they rarely pass on where the visitor came from)
function inApp(): string | undefined {
  const u = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
  if (/InkAgeApp/.test(u)) return /Android/i.test(u) ? 'androidapp' : 'iosapp';
  if (/musical_ly|bytedance|tiktok/i.test(u)) return 'tiktok';
  if (/instagram/i.test(u)) return 'instagram';
  if (/FBAN|FBAV|FB_IAB|FBIOS/.test(u)) return 'facebook';
  if (/pinterest/i.test(u)) return 'pinterest';
  if (/linkedinapp/i.test(u)) return 'linkedin';
  if (/snapchat/i.test(u)) return 'snapchat';
  return undefined;
}

/* The buying path (2026-11-14): these steps are also counted for people who didn't press "Accept all", anonymously,
   so the funnel shows everyone and not only the half that accepted. Only the step name and a few plain details. */
const FUNNEL = new Set(['photo_added', 'design_added', 'generate_start', 'generate_done', 'teaser_shown', 'teaser_unlock_tap', 'paywall_open', 'paywall_hit', 'paywall_close', 'plan_pick', 'checkout_start', 'why_not', 'store_purchase']);
const FUNNEL_KEYS = ['why', 'plan', 'secs', 'at', 'reason', 'store'];
function countFunnel(name: string, props: Record<string, unknown>) {
  try {
    const keep = Object.fromEntries(FUNNEL_KEYS.filter((k) => props[k] !== undefined).map((k) => [k, String(props[k]).slice(0, 40)]));
    const ia = inApp();
    fetch('/api/pv', { method: 'POST', keepalive: true, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ev: 'fn', name, d: keep, path: location.pathname, lang: document.documentElement.lang, ia: ia || undefined }) }).catch(() => {});
  } catch {}
}

/** First-party analytics: one row per event, no third parties. */
export function track(name: string, props: Record<string, unknown> = {}) {
  if (process.env.NEXT_PUBLIC_STATIC_DEMO) return;
  // usage stats only after "Accept" in the cookie banner
  try {
    if (isOwnDevice() || isRobot()) return;
    if (localStorage.getItem('ink_consent') !== 'all') {
      // without that choice only the few buying-path steps are counted, like a page view: no cookie, no id (app/api/pv)
      if (FUNNEL.has(name)) countFunnel(name, props);
      return;
    }
  } catch {
    return;
  }
  let extra: Record<string, unknown> = {};
  try {
    const ia = inApp();
    extra = { sid: (window as any).__inkSid || visitId(), path: (props.path as string) || location.pathname.slice(0, 200), lang: (document.documentElement.lang || '').slice(0, 8) || undefined, src: visitSource(), ...(ia ? { ia } : { pf: 'web' }) };
  } catch {}
  // the app's own "src" (where a design came from: upload, library…) moves to dsrc; src is the visit's source
  const own = typeof props.src === 'string' ? { dsrc: props.src } : {};
  const { src: _drop, ...rest } = props;
  // plain fetch with the visitor's own session (if any), so website pages don't need supabase-js (lib/sb-lite)
  rpcLite('log_event', { p_name: name, p_anon: anonId(), p_props: { ...rest, ...own, ...extra } }, true);
}
