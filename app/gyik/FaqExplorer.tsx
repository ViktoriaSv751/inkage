'use client';
import { tx, qOf, type Lang } from '@/lib/tr';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { track } from '@/lib/store';

type G = { h: string; i: string; items: [string, string][] };

const ICON: Record<string, string> = {
  start: 'M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4z',
  photo: 'M4 8h4l2-3h4l2 3h4v11H4zM12 17a4 4 0 1 0 0-8a4 4 0 0 0 0 8z',
  result: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  privacy: 'M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6zM9 12l2 2 4-4',
};

export function FaqExplorer({ groups, lang }: { groups: G[]; lang: Lang }) {
  const T = (en: string, hu: string) => tx(lang, en, hu);
  const q = qOf(lang);
  const [cat, setCat] = useState<number>(-1);
  const [s, setS] = useState('');
  const norm = (x: string) => x.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const shown = useMemo(
    () =>
      groups
        .map((g, gi) => ({ ...g, gi, items: g.items.filter(([qq, a]) => (cat === -1 || cat === gi) && (!s || norm(qq + ' ' + a).includes(norm(s)))) }))
        .filter((g) => g.items.length),
    [groups, cat, s]
  );
  const total = shown.reduce((n, g) => n + g.items.length, 0);
  return (
    <div className="fx">
      <div className="fx-search">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-4-4" />
        </svg>
        <input value={s} onChange={(e) => setS(e.target.value)} placeholder={T('Search: free, photo, accuracy, delete…', 'Keresés: ingyenes, fotó, pontosság, törlés…')} aria-label={T('Search questions', 'Keresés a kérdések között')} />
        {s && (
          <button onClick={() => setS('')} aria-label={T('Clear', 'Törlés')}>
            ×
          </button>
        )}
      </div>
      <div className="fx-cats" role="tablist">
        <button role="tab" aria-selected={cat === -1} className={cat === -1 ? 'on' : ''} onClick={() => setCat(-1)}>
          {T('All', 'Mind')} <small>{groups.reduce((n, g) => n + g.items.length, 0)}</small>
        </button>
        {groups.map((g, gi) => (
          <button key={g.h} role="tab" aria-selected={cat === gi} className={cat === gi ? 'on' : ''} onClick={() => setCat(gi)}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d={ICON[g.i]} />
            </svg>
            {g.h}
          </button>
        ))}
      </div>
      <div className="fx-layout">
        <div className="fx-list">
          {total === 0 && (
            <div className="fx-empty">
              <b>{T('No match', 'Nincs találat')}</b>
              <p>{T('Try another word, or ask us directly.', 'Próbálj másik szót, vagy kérdezz minket közvetlenül.')}</p>
            </div>
          )}
          {shown.map((g) => (
            <section key={g.h} className="fx-group">
              <h2>
                <span>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d={ICON[g.i]} />
                  </svg>
                </span>
                {g.h}
              </h2>
              <div className="ip-faq">
                {g.items.map(([qq, a]) => (
                  <details key={qq} onToggle={(e) => (e.currentTarget as HTMLDetailsElement).open && track('faq_open')}>
                    <summary>{qq}</summary>
                    <p>{a}</p>
                  </details>
                ))}
              </div>
            </section>
          ))}
        </div>
        <aside className="fx-side">
          <div className="fx-help">
            <b>{T('Still stuck?', 'Nem találod a választ?')}</b>
            <p>{T('Write to us — we read every message.', 'Írj nekünk – minden üzenetet elolvasunk.')}</p>
            <Link href={`/kapcsolat${q}`}>{T('Contact us', 'Kapcsolat')}</Link>
          </div>
          <div className="fx-guides">
            <b>{T('Popular guides', 'Népszerű útmutatók')}</b>
            {[
              ['how-tattoos-age', T('How tattoos age', 'Hogyan öregszik a tetoválás')],
              ['fine-line-tattoos-aging', T('Do fine line tattoos last?', 'Tartósak a fine line tetoválások?')],
              ['tattoo-aftercare-sun-protection', T('Aftercare and sun', 'Utókezelés és fényvédelem')],
            ].map(([sl, t]) => (
              <Link key={sl} href={`/tudastar/${sl}${q}`}>
                {t}
                <span aria-hidden="true">›</span>
              </Link>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
