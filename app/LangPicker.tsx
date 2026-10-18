'use client';
import { tx, pick, LANGS as ALL, LANG_INFO, type Lang } from '@/lib/tr';
export type { Lang } from '@/lib/tr';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import './langpicker.css';
import { useScrollLock } from '@/lib/scrolllock';

import READY from '@/lib/locales/ready.json';
import { PICKER, langName } from './pickerText';
const LANGS: { k: Lang; name: string; en: string; hu: string; flag: string }[] = ALL.filter((k) => (READY as string[]).includes(k)).map((k) => ({ k, name: LANG_INFO[k].native, en: LANG_INFO[k].en, hu: LANG_INFO[k].hu, flag: LANG_INFO[k].flag }));

/**
 * Language button + picker sheet: a list with radio circles and a confirm step,
 * instead of switching the moment you tap.
 */
export function LangPicker({ lang, onPick, variant = 'pill', label }: { lang: Lang; onPick: (l: Lang) => void; variant?: 'pill' | 'row' | 'icon'; label?: string }) {
  const [open, setOpen] = useState(false);
  useScrollLock(open);
  const [sel, setSel] = useState<Lang>(lang);
  const W = PICKER[sel] || PICKER.en;
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (open) {
      setSel(lang);
    }
  }, [open, lang]);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', k);
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', k);
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, [open]);
  const T = (en: string, hu: string) => tx(lang, en, hu);
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
          <div className="lp-wrap" role="dialog" aria-modal="true" aria-label={W.language} lang={sel} onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
            <div className="lp-page">
              <header className="lp-bar">
                <button type="button" className="lp-x" aria-label={W.back} onClick={() => setOpen(false)}>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M15 5l-7 7 7 7" />
                  </svg>
                </button>
                <span className="lp-bar-t">{W.settings}</span>
                <button type="button" className="lp-x lp-close" aria-label={W.cancel} onClick={() => setOpen(false)}>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </header>
              <div className="lp-body">
                <div className="lp-hero">
                  <span className="lp-globe" aria-hidden="true">
                    <svg viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="9" />
                      <path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z" />
                    </svg>
                  </span>
                  <h2>{W.title}</h2>
                  <p>{W.sub}</p>
                </div>
                <ul className="lp-cards" role="radiogroup" aria-label={W.language}>
                  {LANGS.map((l) => (
                    <li key={l.k}>
                      <button type="button" role="radio" aria-checked={sel === l.k} className={sel === l.k ? 'on' : ''} onClick={() => setSel(l.k)}>
                        <span className="lp-flag" aria-hidden="true">
                          {l.flag}
                        </span>
                        <span className="lp-name">
                          <b>{l.name}</b>
                          <small>{langName(l.k, sel, LANG_INFO[sel].locale, sel === 'hu' ? l.hu : l.en)}</small>
                        </span>
                        {l.k === lang ? <span className="lp-cur">{W.current}</span> : <span />}
                        <span className="lp-radio" aria-hidden="true">
                          <svg viewBox="0 0 24 24">
                            <path d="M6 12.5l4 4L18 8" />
                          </svg>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="lp-note">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 21a9 9 0 1 0 0-18a9 9 0 0 0 0 18zM12 11v5M12 8h.01" />
                  </svg>
                  {W.note}
                </p>
              </div>
              <footer className="lp-actions">
                <button
                  type="button"
                  className="lp-ok"
                  disabled={sel === lang}
                  onClick={() => {
                    setOpen(false);
                    if (sel !== lang) onPick(sel);
                  }}
                >
                  {W.save}
                </button>
                <button type="button" className="lp-cancel" onClick={() => setOpen(false)}>
                  {W.cancel}
                </button>
              </footer>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
