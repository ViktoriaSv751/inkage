'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { sb } from '@/lib/sb';
import { lsGet, lsSet, track } from '@/lib/store';
import { tx, type Lang } from '@/lib/i18n';

/** InkAge is 18+ (terms + store age rating). Asked once: remembered on this device and, when signed in,
    on the account – so it never comes back on another device or after signing in again. */
export function AgeGate({ lang, userId }: { lang: Lang; userId: string | null }) {
  const t = (en: string, hu: string) => tx(lang, en, hu);
  const [state, setState] = useState<'unknown' | 'ok' | 'ask' | 'under'>('unknown');

  useEffect(() => {
    let off = false;
    const local = lsGet<string | null>('ink_age_ok', null);
    if (local === 'yes') {
      setState('ok');
      // answered here before signing in: keep it on the account too
      if (userId) sb()?.rpc('set_age_confirmed')?.then(() => {}, () => {});
      return;
    }
    if (local === 'no') return setState('under');
    // signed in (or a session is being restored): maybe already confirmed on another device
    (async () => {
      const s = sb();
      const { data } = (await s?.auth.getSession()) || { data: { session: null } };
      if (off) return;
      if (!data.session) return setState('ask');
      const r = await Promise.resolve(s?.rpc('age_confirmed')).catch(() => null);
      if (off) return;
      if (r?.data === true) {
        lsSet('ink_age_ok', 'yes');
        setState('ok');
      } else setState('ask');
    })();
    return () => {
      off = true;
    };
  }, [userId]);

  const open = state === 'ask' || state === 'under';
  // a fixed, non-scrolling page behind the dialog
  useEffect(() => {
    if (!open) return;
    const h = document.documentElement, b = document.body;
    const prev = [h.style.overflow, b.style.overflow];
    h.style.overflow = 'hidden';
    b.style.overflow = 'hidden';
    return () => {
      h.style.overflow = prev[0];
      b.style.overflow = prev[1];
    };
  }, [open]);

  if (!open) return null;
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
                  sb()?.auth.getSession().then(({ data }) => data.session && sb()?.rpc('set_age_confirmed').then(() => {}, () => {}));
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
