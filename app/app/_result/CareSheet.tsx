'use client';
import { useState } from 'react';
import { useApp } from '../AppProvider';
import { Sheet } from '../ui';
import { tx } from '@/lib/i18n';
import { track } from '@/lib/store';
import { shareOrDownload } from '@/lib/client';
import { aftercareIcs, CARE } from '@/lib/aftercare';

export function CareSheet({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone?: (date: string) => void }) {
  const { ui, toast, me } = useApp();
  const t = (en: string, hu: string) => tx(ui.lang, en, hu);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  return (
    <Sheet open={open} onClose={onClose} label={t('Healing plan', 'Gyógyulási terv')}>
      <h2>{t('Healing plan', 'Gyógyulási terv')}</h2>
      <p className="sub">{t('When did you get it?', 'Mikor készült?')}</p>
      <input id="care-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      <ol className="care-list">
        {CARE.map((s) => (
          <li key={s.day}>
            <b>{t(`Day ${s.day}`, `${s.day}. nap`)}</b> {t(s.en, s.hu)}
          </li>
        ))}
      </ol>
      <button
        className="btn wide"
        onClick={async () => {
          onDone?.(new Date(date + 'T12:00:00').toISOString());
          // in the store apps: native reminders on the phone itself
          if ((window as any).Capacitor?.isNativePlatform?.()) {
            track('aftercare_local');
            const n = await import('@/lib/native')
              .then((m) => m.scheduleCareLocal(date, CARE.map((s) => ({ day: s.day, text: t(s.en, s.hu) })), (d) => t(`Healing plan · day ${d}`, `Gyógyulási terv · ${d}. nap`)))
              .catch(() => 0);
            if (n > 0) return void toast(t(`${n} reminders set on this phone`, `${n} emlékeztető beállítva a telefonodon`));
            toast(t('Allow notifications in Settings to get the reminders, or use the calendar file.', 'Engedélyezd az értesítéseket a Beállításokban, vagy használd a naptárfájlt.'));
          }
          track('aftercare_ics');
          await shareOrDownload(aftercareIcs(new Date(date + 'T09:00:00'), ui.lang), 'inkage-aftercare.ics');
          toast(t('Open the file to add the reminders to your calendar', 'Nyisd meg a fájlt, és bekerülnek az emlékeztetők a naptáradba'));
          if (me?.user) {
            // phone reminders too, after the calendar file (never blocks it)
            // only when notifications are already on (Profile > Settings); no surprise permission prompt here
            const native = !!(window as any).Capacitor?.isNativePlatform?.();
            const st = await (native ? import('@/lib/native').then((m) => m.nativePushState()) : import('@/lib/push').then((m) => m.pushState())).catch(() => 'off');
            if (st === 'on') {
              const n = await import('@/lib/push').then((m) =>
                m.scheduleCare(date, CARE.map((s) => ({ day: s.day, text: t(s.en, s.hu) })), (d) => t(`Healing plan · day ${d}`, `Gyógyulási terv · ${d}. nap`))
              );
              if (n > 0) toast(t(`${n} reminders will also arrive on your phone`, `${n} emlékeztető a telefonodra is megérkezik`));
            }
          }
        }}
      >
        {t('Add reminders to my calendar', 'Emlékeztetők a naptáramba')}
      </button>
      <p className="fine">{t('General aftercare tips, not medical advice. Follow your tattoo artist’s instructions, and see a doctor if you notice signs of infection.', 'Általános utókezelési tippek, nem orvosi tanács. Kövesd a tetoválód utasításait, és fordulj orvoshoz, ha fertőzés jeleit látod.')}</p>
    </Sheet>
  );
}
