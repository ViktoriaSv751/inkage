'use client';
import './b2b-app.css';
import { useEffect, useState } from 'react';
import { useApp } from '../AppProvider';
import { tx } from '@/lib/i18n';
import { localeOf } from '@/lib/tr';
import type { Preview } from '@/lib/store';
import type { Studio } from '@/lib/studio';
import { SendSheet } from './SendSheet';

/** On a saved preview (studio accounts): the guest's name, a short note, the date and the consent, and "Send to the guest". */
export function GuestCard({ preview, items, studio, update }: { preview: Preview; items: Preview[]; studio: Studio; update: (p: Preview, x: Partial<Preview>) => void }) {
  const { ui } = useApp();
  const t = (en: string, hu: string) => tx(ui.lang, en, hu);
  const [name, setName] = useState(preview.guestName || '');
  const [note, setNote] = useState(preview.guestNote || '');
  const [send, setSend] = useState(false);
  useEffect(() => {
    setName(preview.guestName || '');
    setNote(preview.guestNote || '');
  }, [preview.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const when = (s: string) => new Date(s).toLocaleString(localeOf(ui.lang), { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const save = () => {
    const n = name.trim().slice(0, 80) || null;
    const k = note.trim().slice(0, 500) || null;
    if (n === (preview.guestName || null) && k === (preview.guestNote || null)) return;
    update(preview, { guestName: n, guestNote: k });
  };
  return (
    <div className="card guestcard">
      <label>
        {t('Guest name', 'Vendég neve')}
        <input className="text" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} onBlur={save} placeholder={t('e.g. Anna K.', 'pl. Kovács Anna')} />
      </label>
      <label>
        {t('Note', 'Megjegyzés')}
        <textarea className="text" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} onBlur={save} placeholder={t('Size, appointment, what they asked for…', 'Méret, időpont, mit kért…')} />
      </label>
      <p className="gc-meta">
        {t('Made', 'Készült')}: {when(preview.created_at)}
        {preview.guestConsentAt ? ` · ${t('consent ticked', 'hozzájárulás kipipálva')}: ${when(preview.guestConsentAt)}` : ''}
      </p>
      {preview.source === 'cloud' && (
        <button className="btn wide dark gc-send" onClick={() => (save(), setSend(true))}>
          {t('Send to the guest', 'Elküldöm a vendégnek')}
        </button>
      )}
      <SendSheet open={send} onClose={() => setSend(false)} preview={{ ...preview, guestName: name.trim() || null }} items={items} studio={studio} />
    </div>
  );
}
