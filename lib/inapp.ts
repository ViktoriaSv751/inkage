'use client';
import { isNative } from './native';

/** The browser built into Instagram, Facebook, Messenger, TikTok, Snapchat, Pinterest or LINE (bio links open there).
 *  Google refuses to sign in inside them ("403 disallowed_useragent"), so the Google button carries the page over to
 *  the phone's own browser (Chrome on Android, Safari on iPhone), where Google starts by itself (?go=google).
 *  Never inside the InkAge store apps themselves. (The same as Calligra's lib/inapp.ts.) */
export type InApp = 'instagram' | 'facebook' | 'tiktok' | 'snapchat' | 'pinterest' | 'line' | null;
export function inAppBrowser(): InApp {
  if (typeof navigator === 'undefined' || isNative()) return null;
  const ua = navigator.userAgent || '';
  if (/InkAgeApp/.test(ua)) return null;
  if (/Instagram/i.test(ua)) return 'instagram';
  if (/FBAN|FBAV|FB_IAB|FBIOS|FB4A|Messenger/.test(ua)) return 'facebook';
  if (/musical_ly|Bytedance|TikTok|trill_/i.test(ua)) return 'tiktok';
  if (/Snapchat/i.test(ua)) return 'snapchat';
  if (/Pinterest/i.test(ua)) return 'pinterest';
  if (/\bLine\//.test(ua)) return 'line';
  return null;
}
const isAndroid = () => typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent || '');
/** Android: the same page in Chrome (or the default browser when Chrome is missing); iPhone: the same page in Safari */
function outside(url: string) {
  const u = new URL(url);
  return isAndroid()
    ? `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url)};end`
    : 'x-safari-' + url;
}
/** In an in-app browser: send this page (with ?go=google) to the phone's browser and return true; otherwise false */
export function escapeForGoogle(path?: string): boolean {
  const iab = inAppBrowser();
  if (!iab) return false;
  const u = new URL(path || location.href, location.origin);
  u.searchParams.set('go', 'google');
  import('./store').then((m) => m.track('iab_escape', { iab }), () => {});
  location.href = outside(u.toString());
  return true;
}
