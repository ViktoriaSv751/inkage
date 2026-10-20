'use client';
import { qOf } from '@/lib/tr';

import Link from 'next/link';
import { useApp } from '../../AppProvider';
import { tx } from '@/lib/i18n';
import type { Preview } from '@/lib/store';
import type { Tab } from './ProfileTabs';

/** Top of the profile: share and settings buttons, picture, name, account actions and your numbers. */
export function ProfileHeader({
  displayName,
  initial,
  mine,
  avg,
  invite,
  setTab,
  openEdit,
  signOut,
  setErase,
}: {
  displayName: string;
  initial: string;
  mine: Preview[] | null;
  avg: number | null;
  invite: () => void;
  setTab: (v: Tab) => void;
  openEdit: () => void;
  signOut: () => void;
  setErase: (v: boolean) => void;
}) {
  const { ui, me, profile } = useApp();
  const t = (en: string, hu: string) => tx(ui.lang, en, hu);
  const meta = profile;
  return (
    <>
      <div className="pf-tools">
        {me.user && (
          <button className="iconbtn" aria-label={t('Share invite link', 'Meghívó link megosztása')} onClick={invite}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 15V3M7 8l5-5 5 5M5 13v7h14v-7" />
            </svg>
          </button>
        )}
        <button className="iconbtn" aria-label={t('Settings', 'Beállítások')} onClick={() => setTab('settings')}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
            <circle cx="16" cy="7" r="2" />
            <circle cx="10" cy="17" r="2" />
          </svg>
        </button>
      </div>

      <div className="pf-id">
        <div className="pf-avatar">
          {meta.avatar ? <img src={meta.avatar} alt="" /> : <span>{me.user ? initial : '✦'}</span>}
          <i className={`pf-badge ${me.user ? 'on' : ''}`} aria-hidden="true">
            {me.user ? (
              <svg viewBox="0 0 24 24">
                <path d="M6 12.5l4 4L18 8" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24">
                <path d="M12 6v12M6 12h12" />
              </svg>
            )}
          </i>
        </div>
        <h1>{me.user ? displayName : ''}</h1>
        <p className="pf-sub">{me.user ? me.user.email : t('Sign in to keep your designs on every device', 'Jelentkezz be, hogy minden eszközön meglegyenek a terveid')}</p>
        {me.user ? (
          <div className="pf-acts">
            <button className="pf-edit" onClick={openEdit}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4" />
              </svg>
              {t('Edit profile', 'Szerkesztés')}
            </button>
            <button className="pf-edit" onClick={signOut}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10" />
              </svg>
              {t('Sign out', 'Kijelentkezés')}
            </button>
            <button className="pf-edit danger" onClick={() => setErase(true)}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13" />
              </svg>
              {t('Delete account', 'Fiók törlése')}
            </button>
          </div>
        ) : (
          <Link className="pf-edit dark" href={`/belepes${qOf(ui.lang)}`}>
            {ui.t('common.signin')}
          </Link>
        )}
        <div className="pf-stats">
          <div>
            <b>{mine ? mine.length : '–'}</b>
            <span>{t('saved', 'mentve')}</span>
          </div>
          <div>
            <b>{avg ?? '–'}</b>
            <span>{t('avg. score', 'átlag pont')}</span>
          </div>
          <div>
            <b>{me.user ? Math.max(0, me.remaining ?? 0) : '–'}</b>
            <span>{t('left this month', 'maradt e hónapban')}</span>
          </div>
          <div>
            <b>{me.bonus ?? 0}</b>
            <span>{t('bonus', 'bónusz')}</span>
          </div>
        </div>
      </div>
    </>
  );
}
