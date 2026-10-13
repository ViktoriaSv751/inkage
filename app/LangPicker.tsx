'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import './langpicker.css';

export type Lang = 'en' | 'hu';
const LANGS: { k: Lang; name: string; sub: string; flag: string }[] = [
  { k: 'hu', name: 'Magyar', sub: 'Magyarország', flag: '🇭🇺' },
  { k: 'en', name: 'English', sub: 'International', flag: '🌐' },
];

/**
 * Language button + picker sheet: a list with radio circles and a confirm step,
 * instead of switching the moment you tap.
 */
export function LangPicker({ lang, onPick, variant = 'pill', label }: { lang: Lang; onPick: (l: Lang) => void; variant?: 'pill' | 'row' | 'icon'; label?: string }) {
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<Lang>(lang);
  const [q, setQ] = useState('');
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (open) {
      setSel(lang);
      setQ('');
    }
  }, [open, lang]);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', k);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', k);
      document.body.style.overflow = '';
    };
  }, [open]);
  const T = (en: string, hu: string) => (lang === 'hu' ? hu : en);
  const cur = LANGS.find((l) => l.k === lang)!;

  return (
    <>
      {variant === 'row' ? (
        <button type="button" className="lp-row" onClick={() => setOpen(true)}>
          <span>{label || T('Language', 'Nyelv')}</span>
          <span className="lp-row-v">
            {cur.name}
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </span>
        </button>
      ) : (
        <button type="button" className={`lp-btn ${variant}`} onClick={() => setOpen(true)} aria-label={T('Language', 'Nyelv') + ': ' + cur.name}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z" />
          </svg>
          {variant === 'pill' && <span>{lang.toUpperCase()}</span>}
        </button>
      )}
      {open &&
        mounted &&
        createPortal(
          <div className="lp-wrap" role="dialog" aria-modal="true" aria-label={T('Language', 'Nyelv')}>
            <div className="lp-page">
              <header className="lp-bar">
                <button type="button" className="lp-x" aria-label={T('Back', 'Vissza')} onClick={() => setOpen(false)}>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M15 5l-7 7 7 7" />
                  </svg>
                </button>
                <h2>{T('Language', 'Nyelv')}</h2>
                <span />
              </header>
              <div className="lp-body">
                <p className="lp-lead">{T('Choose the language for InkAge. You can change it any time.', 'Válaszd ki az InkAge nyelvét. Bármikor módosíthatod.')}</p>
                <label className="lp-search">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="11" cy="11" r="7" />
                    <path d="M20 20l-4-4" />
                  </svg>
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={T('Search languages', 'Nyelv keresése')} aria-label={T('Search languages', 'Nyelv keresése')} />
                </label>
                <ul className="lp-list" role="radiogroup">
                  {LANGS.filter((l) => !q || (l.name + ' ' + l.sub).toLowerCase().includes(q.toLowerCase())).map((l) => (
                    <li key={l.k}>
                      <button type="button" role="radio" aria-checked={sel === l.k} className={sel === l.k ? 'on' : ''} onClick={() => setSel(l.k)}>
                        <span className="lp-flag" aria-hidden="true">
                          {l.flag}
                        </span>
                        <span className="lp-name">
                          <b>{l.name}</b>
                          <small>{l.sub}</small>
                        </span>
                        <span className="lp-radio" aria-hidden="true">
                          <svg viewBox="0 0 24 24">
                            <path d="M6 12.5l4 4L18 8" />
                          </svg>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="lp-note">{T('More languages are coming soon.', 'Hamarosan további nyelvek is érkeznek.')}</p>
              </div>
              <footer className="lp-actions">
                <p className="lp-terms">{T('Your choice is saved on this device.', 'A választásodat ezen az eszközön megjegyezzük.')}</p>
                <button
                  type="button"
                  className="lp-ok"
                  onClick={() => {
                    setOpen(false);
                    if (sel !== lang) onPick(sel);
                  }}
                >
                  {sel === 'hu' ? 'Mentés' : 'Save'}
                </button>
                <button type="button" className="lp-cancel" onClick={() => setOpen(false)}>
                  {T('Cancel', 'Mégse')}
                </button>
              </footer>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
