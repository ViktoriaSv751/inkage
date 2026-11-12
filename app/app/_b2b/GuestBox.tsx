'use client';
import './b2b-app.css';
import { useState } from 'react';
import { useApp } from '../AppProvider';
import { tx } from '@/lib/i18n';
import { guestDraft } from '@/lib/studio';
import { track } from '@/lib/store';

/** Studio accounts, before the photo: the guest's name (optional) and the required consent tick. */
export function GuestBox({ onChange }: { onChange: (consented: boolean) => void }) {
  const { ui } = useApp();
  const t = (en: string, hu: string) => tx(ui.lang, en, hu);
  const [name, setName] = useState(() => guestDraft.get().name);
  const [ok, setOk] = useState(() => !!guestDraft.get().consentAt);
  const tick = (v: boolean) => {
    setOk(v);
    guestDraft.set({ consentAt: v ? new Date().toISOString() : null });
    onChange(v);
    if (v) track('b2b_guest_consent');
  };
  return (
    <section className="guestbox" aria-label={t('Guest', 'Vendég')}>
      <div className="gb-done">
        <h2>{t('Guest', 'Vendég')}</h2>
        {(ok || name) && (
          <button
            type="button"
            className="chipbtn"
            onClick={() => {
              guestDraft.clear();
              setName('');
              tick(false);
            }}
          >
            {t('New guest', 'Új vendég')}
          </button>
        )}
      </div>
      <input
        className="text"
        value={name}
        maxLength={80}
        autoComplete="off"
        placeholder={t('Guest name (optional)', 'Vendég neve (nem kötelező)')}
        aria-label={t('Guest name', 'Vendég neve')}
        onChange={(e) => {
          setName(e.target.value);
          guestDraft.set({ name: e.target.value });
        }}
      />
      <label className={`gb-consent ${ok ? 'on' : ''}`}>
        <input type="checkbox" checked={ok} onChange={(e) => tick(e.target.checked)} />
        <span>{t('The guest agreed that I upload their photo for the preview.', 'A vendég hozzájárult, hogy a fotóját az előnézethez feltöltsem.')}</span>
      </label>
    </section>
  );
}
