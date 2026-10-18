'use client';
import { useEffect } from 'react';

/* While any pop-up is open the page behind it stays put: no scrolling, no rubber-banding on iPhone.
   Counted, so nested pop-ups don't unlock the page too early. */
let locks = 0;
let saved = { y: 0, html: '', body: '', pos: '', top: '', width: '', at: '' };

function lock() {
  if (locks++ > 0) return;
  const b = document.body, h = document.documentElement;
  saved = { at: location.pathname + location.search, y: window.scrollY, html: h.style.overflow, body: b.style.overflow, pos: b.style.position, top: b.style.top, width: b.style.width };
  h.style.overflow = 'hidden';
  b.style.overflow = 'hidden';
  b.style.position = 'fixed';
  b.style.top = `-${saved.y}px`;
  b.style.width = '100%';
}
function unlock() {
  if (--locks > 0) return;
  locks = 0;
  const b = document.body, h = document.documentElement;
  h.style.overflow = saved.html;
  b.style.overflow = saved.body;
  b.style.position = saved.pos;
  b.style.top = saved.top;
  b.style.width = saved.width;
  // a pop-up closed by opening another page: that page starts at its top
  window.scrollTo({ top: location.pathname + location.search === saved.at ? saved.y : 0, behavior: 'instant' as ScrollBehavior });
}

export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    lock();
    return unlock;
  }, [active]);
}
