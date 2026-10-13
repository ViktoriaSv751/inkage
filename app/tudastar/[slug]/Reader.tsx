'use client';

import { useEffect, useState } from 'react';

/** Thin reading-progress bar under the top bar. */
export function ReadProgress() {
  const [p, setP] = useState(0);
  useEffect(() => {
    const el = document.querySelector('.ka-article') as HTMLElement | null;
    const h = () => {
      if (!el) return;
      const r = el.getBoundingClientRect();
      const total = r.height - window.innerHeight * 0.6;
      setP(Math.min(1, Math.max(0, -r.top / Math.max(1, total))));
    };
    h();
    window.addEventListener('scroll', h, { passive: true });
    window.addEventListener('resize', h);
    return () => {
      window.removeEventListener('scroll', h);
      window.removeEventListener('resize', h);
    };
  }, []);
  return (
    <div className="ka-progress" aria-hidden="true">
      <i style={{ transform: `scaleX(${p})` }} />
    </div>
  );
}

/** Table of contents that highlights the section you are reading. */
export function TocNav({ items, title, minutes, minLabel }: { items: { h: string; id: string }[]; title: string; minutes: number; minLabel: string }) {
  const [active, setActive] = useState(items[0]?.id);
  const [left, setLeft] = useState(minutes);
  useEffect(() => {
    const els = items.map((x) => document.getElementById(x.id)).filter(Boolean) as HTMLElement[];
    const h = () => {
      let cur = els[0]?.id;
      for (const e of els) if (e.getBoundingClientRect().top < window.innerHeight * 0.35) cur = e.id;
      setActive(cur);
      const art = document.querySelector('.ka-article') as HTMLElement | null;
      if (art) {
        const r = art.getBoundingClientRect();
        const done = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - window.innerHeight)));
        setLeft(Math.max(0, Math.ceil(minutes * (1 - done))));
      }
    };
    h();
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, [items, minutes]);
  return (
    <nav className="ka-toc-side" aria-label={title}>
      <p className="ka-toc-h">{title}</p>
      <ol>
        {items.map((x, i) => (
          <li key={x.id} className={x.id === active ? 'on' : ''}>
            <a href={`#${x.id}`} aria-current={x.id === active ? 'true' : undefined}>
              <span>{String(i + 1).padStart(2, '0')}</span>
              {x.h}
            </a>
          </li>
        ))}
      </ol>
      <p className="ka-left">
        {left} {minLabel}
      </p>
    </nav>
  );
}
