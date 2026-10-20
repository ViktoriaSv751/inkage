'use client';
import { useState } from 'react';
import { useApp } from '../../AppProvider';
import { tx } from '@/lib/i18n';
import { api } from '@/lib/sb';
import { anonId, track } from '@/lib/store';

/** The Help & feedback form; kept by the page so a draft survives switching tabs. */
export function useFeedback() {
  const { ui, me, toast } = useApp();
  const t = (en: string, hu: string) => tx(ui.lang, en, hu);
  const [fbKind, setFbKind] = useState<'bug' | 'idea' | 'question'>('idea');
  const [fbMsg, setFbMsg] = useState('');
  const [fbEmail, setFbEmail] = useState('');
  const [fbBusy, setFbBusy] = useState(false);
  const sendFeedback = async () => {
    setFbBusy(true);
    const r = await api('/api/feedback', { kind: fbKind, message: fbMsg.trim(), email: fbEmail || me.user?.email || '', anon: anonId(), page: `app · ${navigator.userAgent.slice(0, 110)}` });
    const data = r.ok;
    setFbBusy(false);
    if (data) {
      setFbMsg('');
      track('feedback_sent', { kind: fbKind });
      toast(t('Thank you! We read every message.', 'Köszönjük! Minden üzenetet elolvasunk.'));
    } else toast(t('Could not send. Try again in a bit.', 'Nem sikerült elküldeni. Próbáld újra kicsit később.'));
  };

  return { fbKind, setFbKind, fbMsg, setFbMsg, fbEmail, setFbEmail, fbBusy, sendFeedback };
}
