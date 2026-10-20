'use client';
/* The full-screen logo moment between signing in / out and the next page.
   After a full page load the mark is read before the first paint (inline script in the root layout). */
export function markSplash(kind: 'in' | 'out') {
  try {
    sessionStorage.setItem('ink_splash', JSON.stringify({ k: kind, t: Date.now() }));
  } catch {}
}

let timers: ReturnType<typeof setTimeout>[] = [];
/** Show the logo now, then open the page up behind it. */
export function playSplash(kind: 'in' | 'out') {
  const d = document.documentElement;
  timers.forEach(clearTimeout);
  d.classList.remove('splash-leave', 'splash-cover');
  d.classList.add('splash', `splash-${kind}`);
  leaveSplash(kind === 'out' ? 650 : 1050);
}
export function leaveSplash(hold: number) {
  const d = document.documentElement;
  timers.forEach(clearTimeout);
  timers = [
    setTimeout(() => d.classList.add('splash-leave'), hold),
    setTimeout(() => d.classList.remove('splash', 'splash-in', 'splash-out', 'splash-leave', 'splash-cover'), hold + 950),
  ];
}

/** Cover the current page with the logo and keep it (signing out: the next page opens it up). */
export function coverSplash() {
  const d = document.documentElement;
  timers.forEach(clearTimeout);
  d.classList.remove('splash-leave');
  d.classList.add('splash', 'splash-cover');
}
