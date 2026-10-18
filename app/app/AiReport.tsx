'use client';
import { useState } from 'react';
import { useApp } from './AppProvider';
import { Sheet } from './ui';
import { tx, trErr } from '@/lib/i18n';
import { api } from '@/lib/sb';
import { track } from '@/lib/store';

const REASONS: [string, string, string][] = [
  ['nudity', 'Nudity or sexual content', 'Meztelenség vagy szexuális tartalom'],
  ['minor', 'It shows a minor', 'Kiskorú látható rajta'],
  ['hate', 'Hateful symbol or text', 'Gyűlöletkeltő jelkép vagy szöveg'],
  ['violence', 'Violent or disturbing', 'Erőszakos vagy felkavaró'],
  ['body', 'It changed my body in a hurtful way', 'Bántó módon változtatta meg a testemet'],
  ['other', 'Something else is offensive', 'Valami más miatt sértő'],
];

/** A small JPEG of the result, so the report can be reviewed without opening anyone's private storage. */
async function thumb(src?: string): Promise<string | null> {
  if (!src) return null;
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise((ok, no) => ((img.onload = ok), (img.onerror = no), (img.src = src)));
    const s = Math.min(1, 384 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * s);
    c.height = Math.round(img.naturalHeight * s);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.7);
  } catch {
    return null;
  }
}

/** "Report inappropriate content" on an AI result – Google Play requires in-app reporting of offensive AI output. */
export function AiReport({ previewId, image }: { previewId: string; image?: string }) {
  const { ui, me, openAuth } = useApp();
  const t = (en: string, hu: string) => tx(ui.lang, en, hu);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  const [err, setErr] = useState('');

  const send = async () => {
    if (!reason) return;
    if (!me.user) return openAuth();
    setState('busy');
    const r = await api<{ ok?: boolean; error?: string }>('/api/ai-report', { ref: previewId, reason, note: note.trim() || null, thumb: await thumb(image) });
    track('ai_report', { reason });
    if (r.ok) setState('done');
    else (setState('error'), setErr(r.data.error ? trErr(ui.lang, r.data.error) : t('Could not send. Try again.', 'Nem sikerült elküldeni. Próbáld újra.')));
  };
  const close = () => (setOpen(false), state === 'done' && (setState('idle'), setReason(''), setNote('')));

  return (
    <>
      <button type="button" className="report-link" onClick={() => setOpen(true)}>
        {t('Report inappropriate content', 'Nem megfelelő tartalom jelentése')}
      </button>
      <Sheet open={open} onClose={close} label={t('Report inappropriate content', 'Nem megfelelő tartalom jelentése')}>
        {state === 'done' ? (
          <>
            <h2>{t('Thanks, we got your report', 'Köszönjük, megkaptuk a jelentést')}</h2>
            <p className="sub">{t('We review it within 24 hours and use it to make our safety filters better. You can delete this preview from your gallery at any time.', '24 órán belül átnézzük, és a biztonsági szűrőink javítására használjuk. Ezt az előnézetet bármikor törölheted a galériádból.')}</p>
            <button className="btn wide" onClick={close}>
              {t('Done', 'Kész')}
            </button>
          </>
        ) : (
          <>
            <h2>{t('What is wrong with this image?', 'Mi a gond ezzel a képpel?')}</h2>
            <p className="sub">{t('The AI made this picture. Tell us if it is offensive or breaks the rules – a small copy is sent to our team for review.', 'Ezt a képet az MI készítette. Jelezd, ha sértő vagy szabályt sért – egy kicsinyített másolatát átnézésre elküldjük a csapatunknak.')}</p>
            <div className="checklist">
              {REASONS.map(([k, en, hu]) => (
                <label key={k} className={reason === k ? 'on' : ''}>
                  <input type="radio" name="ai-report" checked={reason === k} onChange={() => setReason(k)} />
                  <span>{t(en, hu)}</span>
                </label>
              ))}
            </div>
            <textarea className="report-note" value={note} maxLength={500} rows={2} onChange={(e) => setNote(e.target.value)} placeholder={t('Anything else? (optional)', 'Még valami? (nem kötelező)')} />
            {state === 'error' && (
              <p className="fine" role="alert" style={{ color: '#c0392b' }}>
                {err}
              </p>
            )}
            <button className="btn wide" disabled={!reason || state === 'busy'} onClick={send}>
              {state === 'busy' ? '…' : t('Send report', 'Jelentés küldése')}
            </button>
          </>
        )}
      </Sheet>
    </>
  );
}
