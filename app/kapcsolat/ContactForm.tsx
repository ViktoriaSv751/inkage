'use client';
import { tx, type Lang } from '@/lib/tr';

import { useState } from 'react';
import { api } from '@/lib/sb';
import { anonId, track } from '@/lib/store';

export function ContactForm({ lang }: { lang: Lang }) {
  const T = (en: string, hu: string) => tx(lang, en, hu);
  const [kind, setKind] = useState<'question' | 'idea' | 'bug'>('question');
  const [msg, setMsg] = useState('');
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'' | 'busy' | 'done' | 'err'>('');
  const ok = msg.trim().length >= 5 && (!email || /\S+@\S+\.\S+/.test(email));
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ok) return;
    setState('busy');
    const r = await api('/api/feedback', { kind, message: msg.trim(), email: email.trim(), anon: anonId(), page: `contact · ${navigator.userAgent.slice(0, 110)}` });
    const data = r.ok;
    setState(data ? 'done' : 'err');
    if (data) track('contact_sent', { kind });
  };
  if (state === 'done')
    return (
      <p className="ip-ok" role="status">
        {T('Thank you! Your message has arrived. If you left an e-mail, we’ll reply there.', 'Köszönjük! Az üzeneted megérkezett. Ha megadtál e-mail-címet, ott válaszolunk.')}
      </p>
    );
  const kinds = [
    { k: 'question' as const, t: T('Question', 'Kérdés') },
    { k: 'idea' as const, t: T('Idea', 'Ötlet') },
    { k: 'bug' as const, t: T('Something broke', 'Hibát találtam') },
  ];
  return (
    <form className="ip-form" onSubmit={send}>
      <div className="ip-kinds" role="group" aria-label={T('Message type', 'Az üzenet típusa')}>
        {kinds.map((x) => (
          <button key={x.k} type="button" aria-pressed={kind === x.k} onClick={() => setKind(x.k)}>
            {x.t}
          </button>
        ))}
      </div>
      <label>
        {T('Your message', 'Üzeneted')}
        <textarea value={msg} onChange={(e) => setMsg(e.target.value)} maxLength={2000} placeholder={T('Tell us what’s on your mind…', 'Írd le, mi jár a fejedben…')} required />
      </label>
      <label>
        {T('E-mail (optional, if you’d like a reply)', 'E-mail (nem kötelező, ha választ szeretnél)')}
        <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={T('your@email.com', 'te@email.hu')} />
      </label>
      <small>{T('We use your e-mail only to answer this message.', 'Az e-mail-címedet csak az üzenet megválaszolására használjuk.')}</small>
      {state === 'err' && <small role="alert" style={{ color: '#c62828' }}>{T('Could not send. Please try again in a moment.', 'Nem sikerült elküldeni. Próbáld újra egy kicsit később.')}</small>}
      <button className="ip-send" disabled={!ok || state === 'busy'}>
        {state === 'busy' ? T('Sending…', 'Küldés…') : T('Send message', 'Üzenet küldése')}
      </button>
    </form>
  );
}
