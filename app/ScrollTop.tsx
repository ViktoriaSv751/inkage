'use client';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

/** Every page opens at its very top – also on back/forward, and in the store apps. */
export function ScrollTop() {
  const path = usePathname();
  const q = useSearchParams()?.toString();
  useEffect(() => {
    try { history.scrollRestoration = 'manual'; } catch {}
  }, []);
  useEffect(() => {
    // 'instant': smooth scrolling (on for in-page links) would stop halfway while the new page loads
    const top = () => window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
    top();
    const r = requestAnimationFrame(top);
    return () => cancelAnimationFrame(r);
  }, [path, q]);
  return null;
}
