'use client';
import { useEffect, useState } from 'react';
import { useApp } from '../AppProvider';
import { tx } from '@/lib/i18n';
import { authHeader } from '@/lib/sb';
import { disablePush, enablePush, pushState, PushState } from '@/lib/push';

/** Profile > Settings: phone notifications on/off + test. */
export function PushRow({ onInstallHelp }: { onInstallHelp: () => void }) {
  const { ui, toast } = useApp();
  const t = (en: string, hu: string) => tx(ui.lang, en, hu);
  const [st, setSt] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    pushState().then(setSt);
  }, []);
  if (!st || st === 'unsupported') return null;

  const sub =
    st === 'needs-install'
      ? t('On iPhone: first add InkAge to your Home Screen, then open it from there', 'iPhone-on: előbb tedd ki az InkAge-et a Főképernyőre, és onnan nyisd meg')
      : st === 'denied'
        ? t('Blocked – allow it in your phone’s Settings > Notifications > InkAge', 'Letiltva – engedélyezd a telefon Beállítások > Értesítések > InkAge menüjében')
        : t('Votes on your links and healing-plan reminders', 'Szavazatok a linkjeidre és a gyógyulási emlékeztetők');

  return (
    <>
      <label className="list-row" style={{ cursor: 'pointer' }}>
        <span>
          {t('Phone notifications', 'Értesítések a telefonra')}
          <small>{sub}</small>
        </span>
        <input
          type="checkbox"
          className="switch"
          checked={st === 'on'}
          disabled={busy}
          onChange={async (e) => {
            if (st === 'needs-install') {
              e.preventDefault();
              onInstallHelp();
              return;
            }
            setBusy(true);
            if (e.target.checked) {
              const r = await enablePush();
              setSt(r);
              if (r === 'on') toast(t('Notifications are on', 'Értesítések bekapcsolva'));
              else if (r === 'denied') toast(t('Notifications are blocked in your settings', 'Az értesítések le vannak tiltva a beállításokban'));
            } else {
              await disablePush();
              setSt('off');
            }
            setBusy(false);
          }}
        />
      </label>
      {st === 'on' && (
        <button
          className="list-row"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await enablePush();
            const r = await fetch('/api/push-test', { method: 'POST', headers: { 'content-type': 'application/json', ...(await authHeader()) }, body: JSON.stringify({ lang: ui.lang }) })
              .then((x) => x.json())
              .catch(() => ({}));
            setBusy(false);
            toast(r?.sent ? t('Test sent – it arrives in a few seconds', 'Teszt elküldve – pár másodperc múlva megérkezik') : t('Could not send. Turn notifications off and on again.', 'Nem sikerült. Kapcsold ki, majd be az értesítéseket.'));
          }}
        >
          <span>
            {t('Send a test notification', 'Teszt értesítés küldése')}
            <small>{t('If it does not arrive: check Focus / Do Not Disturb', 'Ha nem jön meg: nézd meg a Fókusz / Ne zavarjanak módot')}</small>
          </span>
          <span aria-hidden="true">›</span>
        </button>
      )}
    </>
  );
}
