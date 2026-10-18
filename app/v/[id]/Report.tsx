'use client';
import { type Lang } from '@/lib/tr';

import { useState } from 'react';
import { sb } from '@/lib/sb';
import { anonId, track } from '@/lib/store';
import { tx } from '@/lib/i18n';

const REASONS: [string, string, string][] = [
  ['nudity', 'Nudity or sexual content', 'Meztelenség vagy szexuális tartalom'],
  ['minor', 'Shows a minor', 'Kiskorú látható rajta'],
  ['hate', 'Hate or harassment', 'Gyűlöletkeltő vagy zaklató'],
  ['violence', 'Violence', 'Erőszak'],
  ['copyright', 'Copies someone else’s work', 'Más alkotását másolja'],
  ['spam', 'Spam', 'Kéretlen reklám'],
  ['other', 'Something else', 'Egyéb'],
];

/** "Report this picture" – required for user-generated and AI content in the app stores. */
export function Report({ id, lang }: { id: string; lang: Lang }) {
  const t = (en: string, hu: string) => tx(lang, en, hu);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');

  const send = async () => {
    if (!reason) return;
    setState('busy');
    const { error } = (await sb()?.rpc('report_share', { p_share: id, p_reason: reason, p_note: note || null, p_reporter: anonId() })) || { error: true };
    track('report', { reason });
    if (!error) fetch('/api/report-notify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ share: id }) }).catch(() => {});
    setState(error ? 'error' : 'done');
  };

  if (!open)
    return (
      <p className="fine" style={{ textAlign: 'center' }}>
        <button type="button" onClick={() => setOpen(true)} style={{ background: 'none', border: 0, padding: 8, textDecoration: 'underline', color: 'inherit', font: 'inherit', cursor: 'pointer' }}>
          {t('Report this picture', 'Kép jelentése')}
        </button>
      </p>
    );

  return (
    <div role="dialog" aria-label={t('Report this picture', 'Kép jelentése')} style={{ background: '#fff6f0', color: '#1a1a1a', borderRadius: 18, padding: 18, marginTop: 20 }}>
      {state === 'done' ? (
        <>
          <b>{t('Thanks, we got your report.', 'Köszönjük, megkaptuk a jelentést.')}</b>
          <p style={{ margin: '6px 0 0' }}>{t('We review it within 24 hours and remove the picture if it breaks the rules.', '24 órán belül átnézzük, és ha szabályt sért, eltávolítjuk.')}</p>
        </>
      ) : (
        <>
          <b>{t('What is wrong with it?', 'Mi a gond vele?')}</b>
          <div style={{ display: 'grid', gap: 6, margin: '10px 0' }}>
            {REASONS.map(([k, en, hu]) => (
              <label key={k} style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}>
                <input type="radio" name="report-reason" value={k} checked={reason === k} onChange={() => setReason(k)} />
                {t(en, hu)}
              </label>
            ))}
          </div>
          <textarea
            value={note}
            maxLength={500}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('Anything else? (optional)', 'Még valami? (nem kötelező)')}
            rows={2}
            style={{ width: '100%', borderRadius: 12, padding: 10, border: '1px solid #ddd', font: 'inherit' }}
          />
          {state === 'error' && <p style={{ color: '#c0392b' }}>{t('Could not send. Try again.', 'Nem sikerült elküldeni. Próbáld újra.')}</p>}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button className="btn" disabled={!reason || state === 'busy'} onClick={send}>
              {t('Send report', 'Jelentés küldése')}
            </button>
            <button className="btn ghost" onClick={() => setOpen(false)}>
              {t('Cancel', 'Mégse')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
