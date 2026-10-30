'use client';
import { qOf } from '@/lib/tr';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useApp } from '../../AppProvider';
import { LangPicker } from '../../../LangPicker';
import { tx } from '@/lib/i18n';
import { sb } from '@/lib/sb';
import { track } from '@/lib/store';
import { PushRow } from '../PushRow';

const ADMIN = ['vviktoriasoti@gmail.com'];

/** The Settings tab: language, notifications, install, links, data and account. */
export function SettingsCard({
  notifyOn,
  setNotifyOn,
  installed,
  install,
  busy,
  exportData,
  signOut,
  setErase,
}: {
  notifyOn: boolean;
  setNotifyOn: (v: boolean) => void;
  installed: boolean;
  install: () => void;
  busy: boolean;
  exportData: () => void;
  signOut: () => void;
  setErase: (v: boolean) => void;
}) {
  const { ui, me, toast } = useApp();
  const t = (en: string, hu: string) => tx(ui.lang, en, hu);
  const [statsOn, setStatsOn] = useState(false);
  useEffect(() => {
    try {
      setStatsOn(localStorage.getItem('ink_consent') === 'all');
    } catch {}
  }, []);
  return (
    <div className="card" style={{ marginTop: 12 }}>
      <LangPicker
        lang={ui.lang}
        variant="row"
        onPick={async (l) => {
          // saved to the account first (e-mails in that language), then the app reloads in it
          if (me.user) await Promise.resolve(sb()?.rpc('save_profile', { p_onboarding: me.onboarding ?? null, p_lang: l })).catch(() => {});
          ui.setLang(l);
        }}
      />
      {me.user && (
        <label className="list-row" style={{ cursor: 'pointer' }}>
          <span>
            {t('Tell me when friends vote', 'Szólj, ha szavaznak a linkemre')}
            <small>{t('E-mail and phone notification, at most once an hour per link', 'E-mail és telefonos értesítés, linkenként legfeljebb óránként egyszer')}</small>
          </span>
          <input
            type="checkbox"
            className="switch"
            checked={notifyOn}
            onChange={async (e) => {
              const on = e.target.checked;
              setNotifyOn(on);
              const { error } = (await sb()?.rpc('set_notify_votes', { p_on: on })) || {};
              if (error) {
                setNotifyOn(!on);
                toast(t('Could not save. Try again.', 'Nem sikerült menteni. Próbáld újra.'));
              }
            }}
          />
        </label>
      )}
      {me.user && <PushRow onInstallHelp={install} />}
      <label className="list-row" style={{ cursor: 'pointer' }}>
        <span>
          {t('Anonymous usage stats', 'Névtelen használati statisztika')}
          <small>{t('Which features get used, so we know what to improve. Never sold or shared.', 'Mely funkciókat használják, hogy tudjuk, mit fejlesszünk. Nem adjuk el és nem osztjuk meg.')}</small>
        </span>
        <input
          type="checkbox"
          className="switch"
          checked={statsOn}
          onChange={(e) => {
            const on = e.target.checked;
            setStatsOn(on);
            try {
              localStorage.setItem('ink_consent', on ? 'all' : 'essential');
              localStorage.setItem('ink_consent_at', new Date().toISOString());
            } catch {}
            if (on) track('consent_all');
          }}
        />
      </label>
      {!installed && (
        <button className="list-row" onClick={install}>
          <span>
            {ui.t('profile.install')}
            <small>{t('Opens full screen, like a normal app', 'Teljes képernyőn nyílik, mint egy rendes app')}</small>
          </span>
          <span aria-hidden="true">›</span>
        </button>
      )}
      <Link className="list-row" href={`/tudastar${qOf(ui.lang)}`}>
        <span>{t('Tattoo aging guides', 'Útmutatók a tetoválás öregedéséről')}</span>
        <span aria-hidden="true">›</span>
      </Link>
      <Link className="list-row" href="/terms">
        <span>{t('Terms', 'Felhasználási feltételek')}</span>
        <span aria-hidden="true">›</span>
      </Link>
      <Link className="list-row" href="/privacy">
        <span>{t('Privacy', 'Adatvédelem')}</span>
        <span aria-hidden="true">›</span>
      </Link>
      {me.user?.email && ADMIN.includes(me.user.email.toLowerCase()) && (
        <Link className="list-row" href="/admin">
          <span>{t('Admin dashboard', 'Admin felület')}</span>
          <span aria-hidden="true">›</span>
        </Link>
      )}
      <button className="list-row" onClick={exportData}>
        <span>
          {busy ? t('Packing your data…', 'Adatok csomagolása…') : t('Download my data', 'Adataim letöltése')}
          <small>{t('All previews with images, notes and answers, as a ZIP', 'Minden előnézet képekkel, jegyzetekkel és válaszokkal, ZIP-ben')}</small>
        </span>
        <span aria-hidden="true">›</span>
      </button>
      {me.user && (
        <>
          <button className="list-row" onClick={signOut}>
            <span>{ui.t('common.signout')}</span>
          </button>
          <button className="list-row" onClick={() => setErase(true)}>
            <span className="danger">{ui.t('profile.erase')}</span>
          </button>
        </>
      )}
    </div>
  );
}
