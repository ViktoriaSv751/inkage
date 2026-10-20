'use client';
import { useState } from 'react';
import { useApp } from '../AppProvider';
import { Sheet } from '../ui';
import { tx } from '@/lib/i18n';
import { track } from '@/lib/store';
import { REDO_REASONS } from './constants';

/** "Not right?": tick what went wrong and make it again. */
export function RedoSheet({
  redoOpen,
  setRedoOpen,
  onRedo,
}: {
  redoOpen: boolean;
  setRedoOpen: (v: boolean) => void;
  onRedo?: (reasons: string[]) => void;
}) {
  const { ui } = useApp();
  const t = (en: string, hu: string) => tx(ui.lang, en, hu);
  const [why, setWhy] = useState<string[]>([]);
  if (!onRedo) return null;
  return (
    <Sheet open={redoOpen} onClose={() => setRedoOpen(false)} label={t('Not right?', 'Nem lett jó?')}>
      <h2>{t('What went wrong?', 'Mi nem jó?')}</h2>
      <p className="sub">{t('Tick what you see — the next try avoids exactly that.', 'Jelöld be, amit látsz – az új próbálkozás pont ezt kerüli el.')}</p>
      <div className="checklist">
        {REDO_REASONS.map(([k, en, hu]) => (
          <label key={k} className={why.includes(k) ? 'on' : ''}>
            <input type="checkbox" checked={why.includes(k)} onChange={() => setWhy(why.includes(k) ? why.filter((x) => x !== k) : [...why, k])} />
            <span>{t(en, hu)}</span>
          </label>
        ))}
      </div>
      <button
        className="btn wide"
        disabled={!why.length}
        onClick={() => {
          setRedoOpen(false);
          track('redo', { why: why.join(',') });
          onRedo(why);
          setWhy([]);
        }}
      >
        {t('Make it again', 'Készítsd el újra')}
      </button>
      <p className="fine">{t('Your feedback also helps us improve InkAge.', 'A visszajelzésed az InkAge fejlesztését is segíti.')}</p>
    </Sheet>
  );
}
