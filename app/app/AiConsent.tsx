'use client';
import { qOf } from '@/lib/tr';
import { useEffect, useRef, useState } from 'react';
import { setAiConsent } from '@/lib/ai-consent';
import { useScrollLock } from '@/lib/scrolllock';
import { track } from '@/lib/store';
import { tx, type Lang } from '@/lib/i18n';

/** The one-time "may we send your photo to our AI providers?" question (App Store 5.1.2(i), Play user-data policy). */
export function AiConsent({ lang }: { lang: Lang }) {
  const t = (en: string, hu: string) => tx(lang, en, hu);
  const [open, setOpen] = useState(false);
  const waiting = useRef<((ok: boolean) => void)[]>([]);

  useEffect(() => {
    (window as any).__inkAiConsentHost = true;
    const on = (e: Event) => {
      waiting.current.push((e as CustomEvent<(ok: boolean) => void>).detail);
      setOpen(true);
    };
    window.addEventListener('ink-ai-consent', on);
    return () => {
      (window as any).__inkAiConsentHost = false;
      window.removeEventListener('ink-ai-consent', on);
    };
  }, []);
  useScrollLock(open);

  const answer = (ok: boolean) => {
    setAiConsent(ok);
    track(ok ? 'ai_consent_yes' : 'ai_consent_no');
    setOpen(false);
    waiting.current.splice(0).forEach((f) => f(ok));
  };

  if (!open) return null;
  return (
    <div className="age-gate" role="dialog" aria-modal="true" aria-labelledby="ai-consent-title">
      <div className="age-card">
        <h2 id="ai-consent-title">{t('Can we send your photo to our AI providers?', 'Elküldhetjük a fotódat az MI-szolgáltatóinknak?')}</h2>
        <p>
          {t(
            'To check your photo and draw your preview, InkAge sends the photo and the design you choose to Google Gemini (and to OpenAI if Gemini is unavailable). We send it only to create your result; the providers handle it under their own terms, as our privacy policy explains. Your previews are stored privately in your account, and you can delete everything in Profile.',
            'A fotód ellenőrzéséhez és az előnézet megrajzolásához az InkAge elküldi a fotót és a választott mintát a Google Gemininek (és ha az nem érhető el, az OpenAI-nak). Csak az eredmény elkészítéséhez küldjük el; a szolgáltatók a saját feltételeik szerint kezelik, ahogy az adatvédelmi tájékoztatóban leírjuk. Az előnézeteidet privát módon a fiókodban tároljuk, és a Profilban mindent törölhetsz.'
          )}
        </p>
        <p className="fine" style={{ textAlign: 'left' }}>
          <a href={`/privacy${qOf(lang)}`} target="_blank" rel="noreferrer">
            {t('Read the privacy policy', 'Adatvédelmi tájékoztató')}
          </a>
        </p>
        <div className="age-actions">
          <button className="btn wide" onClick={() => answer(true)}>
            {t('Allow', 'Engedélyezem')}
          </button>
          <button className="btn ghost wide" onClick={() => answer(false)}>
            {t('Not now', 'Most nem')}
          </button>
        </div>
      </div>
    </div>
  );
}
