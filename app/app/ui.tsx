'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { sb } from '@/lib/sb';
import { haptic } from '@/lib/store';
import { useApp } from './AppProvider';
import { tx } from '@/lib/i18n';

export const Icon = {
  plus: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
  ),
  grid: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></svg>
  ),
  compass: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" /><path d="M15.5 8.5l-2 5-5 2 2-5z" /></svg>
  ),
  user: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="9" r="3.5" /><path d="M5 20c1.2-3.6 4-5 7-5s5.8 1.4 7 5" /></svg>
  ),
  camera: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l2-2.5h6L17 8h3v11H4z" /><circle cx="12" cy="13.5" r="3.5" /></svg>
  ),
  image: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="14" rx="2" /><circle cx="9" cy="10" r="1.6" /><path d="M5 18l5-5 4 4 2-2 3 3" /></svg>
  ),
  clip: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="4" width="10" height="4" rx="1" /><path d="M7 6H5v14h14V6h-2" /></svg>
  ),
  heart: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" /></svg>
  ),
  share: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V4M8 8l4-4 4 4M5 12v8h14v-8" /></svg>
  ),
  video: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="6" width="12" height="12" rx="2" /><path d="M15.5 10.5l5-3v9l-5-3z" /></svg>
  ),
  download: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M8 11l4 4 4-4M5 20h14" /></svg>
  ),
  back: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
  ),
  close: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
  ),
  rotate: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12a7 7 0 1 1-2.1-5M19 4v4h-4" /></svg>
  ),
  mirror: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18M9 7L4 17h5zM15 7l5 10h-5z" /></svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
  ),
  zoom: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6" /><path d="M20 20l-4.5-4.5M11 8v6M8 11h6" /></svg>
  ),
};

export function BottomNav() {
  const path = usePathname();
  const { ui } = useApp();
  const items = [
    { href: '/app', label: ui.t('nav.create'), icon: Icon.plus },
    { href: '/app/gallery', label: ui.t('nav.gallery'), icon: Icon.grid },
    { href: '/app/explore', label: ui.t('nav.explore'), icon: Icon.compass },
    { href: '/app/profile', label: ui.t('nav.profile'), icon: Icon.user },
  ];
  return (
    <nav className="tabbar" aria-label="Main">
      {items.map((it) => {
        const on = it.href === '/app' ? path === '/app' : path?.startsWith(it.href);
        return (
          <Link key={it.href} href={it.href} className={on ? 'on' : ''} aria-current={on ? 'page' : undefined} onClick={() => haptic()}>
            {it.icon}
            <span>{it.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function Sheet({ open, onClose, children, label }: { open: boolean; onClose: () => void; children: React.ReactNode; label: string }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="sheet-wrap" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={label} onClick={(e) => e.stopPropagation()}>
        <div className="grab" />
        <button className="x" aria-label="Close" onClick={onClose}>
          {Icon.close}
        </button>
        {children}
      </div>
    </div>
  );
}

export function AuthSheet() {
  const { authOpen, closeAuth, authReason, ui, refreshMe, toast } = useApp();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const L = (en: string, hu: string) => tx(ui.lang, en, hu);

  const send = async () => {
    const s = sb();
    if (!s) return;
    setBusy(true);
    setErr('');
    const { error } = await s.auth.signInWithOtp({ email, options: { emailRedirectTo: `${location.origin}/app/profile`, shouldCreateUser: true } });
    setBusy(false);
    if (error) return setErr(/rate/i.test(error.message) ? L('Too many emails right now. Wait a minute and try again.', 'Most túl sok e-mail ment ki. Várj egy percet, és próbáld újra.') : error.message);
    setSent(true);
  };
  const verify = async () => {
    setBusy(true);
    setErr('');
    const { error } = await sb()!.auth.verifyOtp({ email, token: code.trim(), type: 'email' });
    setBusy(false);
    if (error) return setErr(L('That code did not work. Use the newest email.', 'Ez a kód nem jó. A legfrissebb e-mailt használd.'));
    closeAuth();
    setSent(false);
    setCode('');
    await refreshMe();
    toast(L('Signed in', 'Bejelentkezve'));
  };

  return (
    <Sheet open={authOpen} onClose={closeAuth} label="Sign in">
      <h2>{sent ? L('Check your email', 'Nézd meg az e-mailjeidet') : L('Keep your designs', 'Őrizd meg a terveidet')}</h2>
      {!sent ? (
        <>
          <p className="sub">{authReason || L('Sign in to save your previews on every device. We’ll email you a 6-digit code.', 'Jelentkezz be, hogy minden eszközön meglegyenek a terveid. Küldünk egy 6 jegyű kódot.')}</p>
          <input id="auth-email" type="email" autoComplete="email" placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} />
          <button className="btn wide" disabled={busy || !/\S+@\S+\.\S+/.test(email)} onClick={send}>
            {busy ? '…' : L('Email me a code', 'Kérem a kódot')}
          </button>
        </>
      ) : (
        <>
          <p className="sub">{L(`Enter the code we sent to ${email}, or tap the link in the email.`, `Írd be a kódot, amit a(z) ${email} címre küldtünk, vagy koppints a levélben lévő linkre.`)}</p>
          <input id="auth-code" inputMode="numeric" autoComplete="one-time-code" placeholder="123456" value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && verify()} />
          <button className="btn wide" disabled={busy || code.trim().length < 6} onClick={verify}>
            {busy ? '…' : L('Continue', 'Tovább')}
          </button>
          <button className="btn ghost wide" onClick={() => setSent(false)}>
            {L('Use a different email', 'Másik e-mail-cím')}
          </button>
        </>
      )}
      {err && <p className="err">{err}</p>}
    </Sheet>
  );
}

/** Shown when the free preview is used up (payments come later). */
export function OutOfPreviews({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { me, ui, openAuth, toast } = useApp();
  const link = me.user ? `${typeof location !== 'undefined' ? location.origin : ''}/?ref=${me.user.id}` : '';
  return (
    <Sheet open={open} onClose={onClose} label="Out of previews">
      <h2>{ui.t('paywall.used')}</h2>
      <p className="sub">{ui.t('paywall.sub')}</p>
      {me.user ? (
        <>
          <div className="copybox">
            <input id="ref-link" readOnly value={link} onFocus={(e) => e.target.select()} />
          </div>
          <button
            className="btn wide"
            onClick={async () => {
              try {
                if ((navigator as any).share) await (navigator as any).share({ url: link, title: 'InkAge' });
                else {
                  await navigator.clipboard.writeText(link);
                  toast(ui.t('profile.copied'));
                }
              } catch {}
            }}
          >
            {ui.t('profile.invite')}
          </button>
        </>
      ) : (
        <button className="btn wide" onClick={() => { onClose(); openAuth(tx(ui.lang, 'Sign in to get your invite link — every friend who joins gives you both a free preview.', 'Jelentkezz be a meghívó linkedért – minden csatlakozó barát után mindketten kaptok egy ingyenes előnézetet.')); }}>
          {tx(ui.lang, 'Sign in to get your invite link', 'Bejelentkezés a meghívó linkért')}
        </button>
      )}
    </Sheet>
  );
}
