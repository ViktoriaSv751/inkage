'use client';
import { useEffect, useState } from 'react';
import { sb } from '@/lib/sb';

/** The owner's announcement at the top of the app (Irányítóközpont → Közlemények): a new language, a fix, maintenance.
    Only the ones switched on, inside their time window, for this language and platform. A closed one stays closed in this
    browser; nothing about who saw it is sent anywhere. */
type A = { id: number; title: string; body: string; kind: 'info' | 'good' | 'warn'; link: string | null };
const KEY = 'ink_ann_closed';

export function AnnouncementBanner({ lang, closeLabel }: { lang: string; closeLabel: string }) {
  const [list, setList] = useState<A[]>([]);
  const [closed, setClosed] = useState<number[]>([]);
  useEffect(() => {
    try {
      setClosed(JSON.parse(localStorage.getItem(KEY) || '[]'));
    } catch {}
    const C = (window as any).Capacitor;
    const pf = C?.isNativePlatform?.() ? C.getPlatform() : 'web';
    sb()
      ?.rpc('public_announcements', { p_lang: lang, p_pf: pf })
      .then(({ data }) => Array.isArray(data) && setList(data as A[]), () => {});
  }, [lang]);
  const a = list.find((x) => !closed.includes(x.id));
  if (!a) return null;
  const close = () => {
    const c = [...closed, a.id].slice(-50);
    setClosed(c);
    try {
      localStorage.setItem(KEY, JSON.stringify(c));
    } catch {}
  };
  const inner = (
    <>
      <b>{a.title}</b>
      {a.body && <span>{a.body}</span>}
    </>
  );
  return (
    <div className={`ann ann-${a.kind}`} role="status">
      <div className="ann-txt">{a.link ? <a href={a.link} onClick={close}>{inner}</a> : inner}</div>
      <button type="button" onClick={close} aria-label={closeLabel}>×</button>
    </div>
  );
}
