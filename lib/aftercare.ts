'use client';
import { tx, type Lang } from '@/lib/tr';

import { CARE, type CareStep } from './aftercare-steps';

export { CARE };
export type { CareStep };

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

/** Calendar file with one all-day reminder per step, plus a yearly sunscreen reminder each June. */
export function aftercareIcs(start: Date, lang: Lang) {
  const L = (en: string, hu: string) => tx(lang, en, hu);
  const stamp = `${ymd(new Date())}T000000Z`;
  const ev: string[] = [];
  for (const s of CARE) {
    const d = new Date(start);
    d.setDate(d.getDate() + s.day);
    const e = new Date(d);
    e.setDate(e.getDate() + 1);
    ev.push(
      [
        'BEGIN:VEVENT',
        `UID:inkage-care-${ymd(start)}-${s.day}@inkage`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${ymd(d)}`,
        `DTEND;VALUE=DATE:${ymd(e)}`,
        `SUMMARY:${esc(L(`Tattoo care – day ${s.day}`, `Tetoválás ápolása – ${s.day}. nap`))}`,
        `DESCRIPTION:${esc(L(s.en, s.hu))}`,
        'BEGIN:VALARM',
        'TRIGGER:PT9H',
        'ACTION:DISPLAY',
        `DESCRIPTION:${esc(L('Tattoo care', 'Tetoválás ápolása'))}`,
        'END:VALARM',
        'END:VEVENT',
      ].join('\r\n')
    );
  }
  const june = new Date(start.getFullYear() + (start.getMonth() >= 5 ? 1 : 0), 5, 1);
  ev.push(
    [
      'BEGIN:VEVENT',
      `UID:inkage-spf-${ymd(start)}@inkage`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${ymd(june)}`,
      'RRULE:FREQ=YEARLY',
      `SUMMARY:${esc(L('Summer is here – SPF 50 on your tattoo', 'Itt a nyár – 50-es fényvédő a tetoválásra'))}`,
      `DESCRIPTION:${esc(L('Sun is the #1 reason tattoos fade.', 'A nap a fakulás első számú oka.'))}`,
      'END:VEVENT',
    ].join('\r\n')
  );
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//InkAge//Aftercare//EN', 'CALSCALE:GREGORIAN', ...ev, 'END:VCALENDAR'].join('\r\n');
  return new Blob([ics], { type: 'text/calendar' });
}
