'use client';
import { tx, qOf, localeOf, type Lang } from '@/lib/tr';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { KbItem } from '@/lib/kb-server';
import { track } from '@/lib/store';

export function KbList({ items, lang }: { items: KbItem[]; lang: Lang }) {
  const T = (en: string, hu: string) => tx(lang, en, hu);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'new' | 'old' | 'short'>('new');
  const [cat, setCat] = useState<string>('');
  const cats = useMemo(() => {
    const n: Record<string, number> = {};
    items.forEach((i) => (n[i.cat] = (n[i.cat] || 0) + 1));
    return Object.entries(n).sort((a, b) => a[0].localeCompare(b[0], lang));
  }, [items, lang]);
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const shown = items
    .filter((i) => !cat || i.cat === cat)
    .filter((i) => !q.trim() || norm(`${i.title} ${i.desc} ${i.cat}`).includes(norm(q.trim())))
    .sort((a, b) => (sort === 'short' ? a.min - b.min : sort === 'old' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)));
  const date = (iso: string) => new Date(iso + 'T12:00:00Z').toLocaleDateString(localeOf(lang), { year: 'numeric', month: 'long', day: 'numeric' });
  const sfx = qOf(lang);

  return (
    <section className="kb-wrap">
      <div className="kb-controls">
        <label className="kb-label" htmlFor="kb-q">
          {T('Search by title', 'Keresés cím szerint')}
        </label>
        <input id="kb-q" className="kb-search" type="search" placeholder={T('What are you looking for: fine line, sun, size…', 'Írd be, mit keresel: fine line, nap, méret…')} value={q} onChange={(e) => setQ(e.target.value)} />

        <span className="kb-label">{T('Sort', 'Rendezés')}</span>
        <div className="kb-chips" role="radiogroup">
          {(
            [
              ['new', T('Newest', 'Legújabb')],
              ['old', T('Oldest', 'Legrégebbi')],
              ['short', T('Shortest', 'Legrövidebb')],
            ] as const
          ).map(([k, l]) => (
            <button key={k} role="radio" aria-checked={sort === k} className={`kb-chip ${sort === k ? 'on' : ''}`} onClick={() => setSort(k)}>
              {l}
            </button>
          ))}
        </div>

        <span className="kb-label">{T('Categories', 'Kategóriák')}</span>
        <div className="kb-chips" role="radiogroup">
          <button role="radio" aria-checked={!cat} className={`kb-chip ${!cat ? 'on' : ''}`} onClick={() => setCat('')}>
            {T('All', 'Mind')} <small>{items.length}</small>
          </button>
          {cats.map(([c, n]) => (
            <button key={c} role="radio" aria-checked={cat === c} className={`kb-chip ${cat === c ? 'on' : ''}`} onClick={() => setCat(cat === c ? '' : c)}>
              {c} <small>{n}</small>
            </button>
          ))}
        </div>
        <p className="kb-count">{T(`${shown.length} article${shown.length === 1 ? '' : 's'}.`, `${shown.length} cikk.`)}</p>
      </div>

      <div className="kb-list">
        {shown.map((i, n) => (
          <article key={i.slug} className={`kb-item ${n === 0 && !q && !cat ? 'lead' : ''}`}>
            <Link href={`/tudastar/${i.slug}${sfx}`} className="kb-img" aria-hidden="true" tabIndex={-1} onClick={() => track('kb_open', { slug: i.slug })}>
              <img src={i.img} alt="" loading={n < 2 ? 'eager' : 'lazy'} />
            </Link>
            <div className="kb-text">
              <p className="kb-meta">
                <span className="kb-pill">{i.cat}</span>
                <span>
                  {i.min} {T('min read', 'perc olvasás')}
                </span>
                <span>{date(i.date)}</span>
              </p>
              <h2>
                <Link href={`/tudastar/${i.slug}${sfx}`} onClick={() => track('kb_open', { slug: i.slug })}>
                  {i.title}
                </Link>
              </h2>
              <p className="kb-desc">{i.desc}</p>
              <Link className="kb-more" href={`/tudastar/${i.slug}${sfx}`}>
                {T('Read it', 'Elolvasom')} <span aria-hidden="true">→</span>
              </Link>
            </div>
          </article>
        ))}
        {!shown.length && <p className="kb-empty">{T('Nothing found. Try another word.', 'Nincs találat. Próbálj másik szót.')}</p>}
      </div>
    </section>
  );
}
