'use client';
import { tx, qOf, type Lang } from '@/lib/tr';

import { useState } from 'react';
import { api } from '@/lib/sb';
import { track } from '@/lib/store';
import { usePathname, useRouter } from 'next/navigation';
import { setLang as saveLang } from '@/lib/i18n';
import { LangPicker } from './LangPicker';

/** Monthly guides newsletter, double opt-in. */
export function FooterSignup({ lang }: { lang: Lang }) {
  const T = (en: string, hu: string) => tx(lang, en, hu);
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'' | 'busy' | 'confirm' | 'saved' | 'already' | 'err'>('');
  const ok = /\S+@\S+\.\S+/.test(email);
  const join = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ok) return setState('err');
    setState('busy');
    const r = await api<{ ok?: boolean; state?: 'confirm' | 'saved' | 'already' }>('/api/newsletter', { email: email.trim(), lang });
    setState(r.ok && r.data.state ? r.data.state : 'err');
    if (r.ok) track('footer_signup');
  };
  if (state === 'confirm' || state === 'saved' || state === 'already')
    return (
      <p className="sf-done" role="status">
        {state === 'confirm'
          ? T('Almost there — check your inbox and confirm.', 'Már csak egy lépés: nézd meg a postafiókodat, és erősítsd meg.')
          : state === 'already'
            ? T('You’re already subscribed.', 'Már fel vagy iratkozva.')
            : T('Saved. We’ll send a confirmation e-mail with the first issue.', 'Rögzítettük. Az első levéllel együtt küldünk megerősítést.')}
      </p>
    );
  return (
    <form className="sf-form" onSubmit={join}>
      <label htmlFor="sf-email" className="sr-only">
        {T('E-mail address', 'E-mail-cím')}
      </label>
      <input id="sf-email" type="email" autoComplete="email" placeholder={T('your@email.com', 'te@email.hu')} value={email} onChange={(e) => (setEmail(e.target.value), setState(''))} />
      <button disabled={state === 'busy'}>{state === 'busy' ? '…' : T('Subscribe', 'Feliratkozom')}</button>
      {state === 'err' && <small role="alert">{T('Check the e-mail address and try again.', 'Ellenőrizd az e-mail-címet, és próbáld újra.')}</small>}
    </form>
  );
}

/** Language picker in the footer; switches in place and updates the URL. */
export function FooterLang({ lang }: { lang: Lang }) {
  const router = useRouter();
  const path = usePathname() || '/';
  return (
    <LangPicker
      lang={lang}
      variant="pill"
      onPick={(l) => {
        saveLang(l);
      }}
    />
  );
}
