'use client';

import { useState } from 'react';
import { sb } from '@/lib/sb';
import { track } from '@/lib/store';
import { usePathname, useRouter } from 'next/navigation';
import { setLang as saveLang } from '@/lib/i18n';
import { LangPicker } from './LangPicker';

/** E-mail sign-up in the footer (uses the same list as the waitlist). */
export function FooterSignup({ lang }: { lang: 'en' | 'hu' }) {
  const T = (en: string, hu: string) => (lang === 'hu' ? hu : en);
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'' | 'busy' | 'done' | 'err'>('');
  const ok = /\S+@\S+\.\S+/.test(email);
  const join = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ok) return;
    setState('busy');
    const { data } = (await sb()?.rpc('join_waitlist', { p_email: email.trim(), p_lang: lang })) || {};
    setState(data ? 'done' : 'err');
    if (data) track('footer_signup');
  };
  if (state === 'done')
    return (
      <p className="sf-done" role="status">
        {T('You’re on the list. See you in your inbox.', 'Felírtunk. Hamarosan jelentkezünk.')}
      </p>
    );
  return (
    <form className="sf-form" onSubmit={join}>
      <label htmlFor="sf-email" className="sr-only">
        {T('E-mail address', 'E-mail-cím')}
      </label>
      <input id="sf-email" type="email" autoComplete="email" placeholder={T('your@email.com', 'te@email.hu')} value={email} onChange={(e) => (setEmail(e.target.value), setState(''))} />
      <button disabled={!ok || state === 'busy'}>{state === 'busy' ? '…' : T('Subscribe', 'Feliratkozom')}</button>
      {state === 'err' && <small role="alert">{T('Check the e-mail address and try again.', 'Ellenőrizd az e-mail-címet, és próbáld újra.')}</small>}
    </form>
  );
}

/** Language picker in the footer; switches in place and updates the URL. */
export function FooterLang({ lang }: { lang: 'en' | 'hu' }) {
  const router = useRouter();
  const path = usePathname() || '/';
  return (
    <LangPicker
      lang={lang}
      variant="pill"
      onPick={(l) => {
        saveLang(l);
        router.push(`${path}${l === 'en' ? '?lang=en' : ''}`);
      }}
    />
  );
}
