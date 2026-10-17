'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { lsGet, lsSet, track } from '@/lib/store';
import { tx, type Lang } from '@/lib/i18n';

/** InkAge is 18+ (terms + store age rating): asked once per device before the app is used. */
export function AgeGate({ lang }: { lang: Lang }) {
  const t = (en: string, hu: string) => tx(lang, en, hu);
  const [state, setState] = useState<'unknown' | 'ok' | 'ask' | 'under'>('unknown');
  useEffect(() => {
    const v = lsGet<string | null>('ink_age_ok', null);
    setState(v === 'yes' ? 'ok' : v === 'no' ? 'under' : 'ask');
  }, []);
  if (state === 'ok' || state === 'unknown') return null;
  return (
    <div className="age-gate" role="dialog" aria-modal="true" aria-labelledby="age-gate-title">
      <div className="age-card">
        {state === 'ask' ? (
          <>
            <h2 id="age-gate-title">{t('Are you 18 or older?', 'Elmúltál 18 éves?')}</h2>
            <p>{t('InkAge is for adults. Please confirm your age to continue.', 'Az InkAge felnőtteknek szól. A folytatáshoz erősítsd meg az életkorod.')}</p>
            <div className="age-actions">
              <button
                className="btn wide"
                onClick={() => {
                  lsSet('ink_age_ok', 'yes');
                  track('age_ok');
                  setState('ok');
                }}
              >
                {t('Yes, I’m 18 or older', 'Igen, elmúltam 18')}
              </button>
              <button
                className="btn ghost wide"
                onClick={() => {
                  lsSet('ink_age_ok', 'no');
                  track('age_under');
                  setState('under');
                }}
              >
                {t('No', 'Nem')}
              </button>
            </div>
            <p className="fine">
              <Link href={lang === 'hu' ? '/terms' : '/terms?lang=en'}>{t('Terms', 'Felhasználási feltételek')}</Link>
            </p>
          </>
        ) : (
          <>
            <h2 id="age-gate-title">{t('Sorry, InkAge is 18+', 'Sajnáljuk, az InkAge 18 év feletti')}</h2>
            <p>{t('You can read our tattoo guides on the website instead.', 'A tetoválásról szóló útmutatóinkat a weboldalon olvashatod.')}</p>
            <Link className="btn wide" href={lang === 'hu' ? '/tudastar' : '/tudastar?lang=en'}>
              {t('Tattoo guides', 'Útmutatók')}
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
