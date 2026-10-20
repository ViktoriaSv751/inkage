'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useScrollLock } from '@/lib/scrolllock';
import { Icon } from './Icon';

/**
 * Close on the finger lifting, not only on the click: in a scrolling sheet on iPhone the click after a tap is
 * sometimes swallowed. preventDefault stops the click that would follow, so it never closes twice.
 */
export function closeTap(fn: () => void) {
  let start: { x: number; y: number } | null = null;
  return {
    onTouchStart: (e: React.TouchEvent) => {
      const t = e.touches[0];
      start = e.touches.length === 1 && t ? { x: t.clientX, y: t.clientY } : null;
    },
    onTouchEnd: (e: React.TouchEvent) => {
      const t = e.changedTouches[0];
      const s = start;
      start = null;
      // only a tap: the finger barely moved (a scroll that started on the button does not close)
      if (!s || !t || Math.abs(t.clientX - s.x) > 10 || Math.abs(t.clientY - s.y) > 10) return;
      e.preventDefault();
      fn();
    },
  };
}

/** A small centred question with two answers (e.g. "Sure you want to sign out?"). */
export function Confirm({ open, title, text, yes, no, onYes, onClose, icon }: { open: boolean; title: string; text?: string; yes: string; no: string; onYes: () => void; onClose: () => void; icon?: React.ReactNode }) {
  useScrollLock(open);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  if (!open || !mounted) return null;
  return createPortal(
    <div className="cf-wrap" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="cf-box" role="alertdialog" aria-modal="true" aria-labelledby="cf-t">
        {icon && <span className="cf-ico">{icon}</span>}
        <h2 id="cf-t">{title}</h2>
        {text && <p>{text}</p>}
        <div className="cf-acts">
          <button type="button" className="btn wide" onClick={onYes} autoFocus>
            {yes}
          </button>
          <button type="button" className="btn wide ghost cf-no" onClick={onClose}>
            {no}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function Sheet({ open, onClose, children, label }: { open: boolean; onClose: () => void; children: React.ReactNode; label: string }) {
  useScrollLock(open);
  // the sheet moves into <body> only once the page runs in the browser (the server and the first render must match)
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  // iPhone: typing in a sheet pans the page for the keyboard and does not always pan it back; taps then land off
  // their buttons (the × and the buttons seem dead). While a sheet is open the page is locked at the top, so
  // whenever the keyboard goes away the page is put back there.
  useEffect(() => {
    if (!open) return;
    const back = () => {
      if (window.scrollY !== 0 || window.scrollX !== 0) window.scrollTo(0, 0);
    };
    const vv = window.visualViewport;
    const onBlur = () => setTimeout(back, 60);
    document.addEventListener('focusout', onBlur);
    vv?.addEventListener('resize', back);
    return () => {
      document.removeEventListener('focusout', onBlur);
      vv?.removeEventListener('resize', back);
    };
  }, [open]);
  if (!open) return null;
  const sheet = (
    <div className="sheet-wrap" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={label} onClick={(e) => e.stopPropagation()}>
        <div className="grab" />
        <button className="x" aria-label="Close" onClick={onClose} {...closeTap(onClose)}>
          {Icon.close}
        </button>
        {children}
      </div>
    </div>
  );
  // rendered straight into <body>: inside the photo editor (or any moving parent) a fixed sheet could shift sideways.
  return mounted ? createPortal(sheet, document.body) : sheet;
}
