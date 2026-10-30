'use client';
/* App Store 5.1.2(i): personal data (the user's photos) may only go to third-party AI after a clear
   disclosure and explicit permission. Asked once per device, before the first call that sends a picture. */
const KEY = 'ink_ai_ok';
type Ask = (ok: boolean) => void;

export const AI_PATHS = /^\/api\/(check-photo|extract|generate|design|improve|find-tattoos|age|age-saved|fetch-image)(\/|\?|$)/;

export function aiConsented() {
  try {
    return localStorage.getItem(KEY) === 'yes';
  } catch {
    return false;
  }
}

export function setAiConsent(yes: boolean) {
  try {
    if (yes) localStorage.setItem(KEY, 'yes');
    else localStorage.removeItem(KEY);
  } catch {}
}

/** Resolves true once the person allowed it (now or earlier). Outside the app (no dialog mounted) it resolves true:
    the website shows the same disclosure next to every upload. */
export function askAiConsent(): Promise<boolean> {
  if (typeof window === 'undefined' || aiConsented()) return Promise.resolve(true);
  if (!(window as any).__inkAiConsentHost) return Promise.resolve(true);
  return new Promise<boolean>((resolve) => {
    window.dispatchEvent(new CustomEvent<Ask>('ink-ai-consent', { detail: resolve }));
  });
}
