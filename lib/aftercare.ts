'use client';
import { tx, type Lang } from '@/lib/tr';

export type CareStep = { day: number; en: string; hu: string };

/** A simple, widely recommended aftercare timeline (general information, not medical advice). */
export const CARE: CareStep[] = [
  { day: 0, en: 'Keep the wrap on for the time your artist said. Then wash gently with lukewarm water and fragrance-free soap, pat dry.', hu: 'A fóliát annyi ideig hagyd fent, amennyit a tetoválód mondott. Utána langyos vízzel, illatmentes szappannal finoman mosd le, és itasd szárazra.' },
  { day: 1, en: 'Wash 2–3 times a day and apply a very thin layer of fragrance-free ointment. No soaking, no sun.', hu: 'Napi 2–3-szor mosd, és kenj rá nagyon vékonyan illatmentes krémet. Ne áztasd, ne érje nap.' },
  { day: 3, en: 'It may feel tight and look shiny — normal. Keep it clean, wear loose clothes over it.', hu: 'Feszülhet és fényes lehet – ez normális. Tartsd tisztán, bő ruhát viselj rajta.' },
  { day: 5, en: 'Flaking starts. Don’t pick or scratch, even if it itches. Keep moisturising thinly.', hu: 'Elkezd hámlani. Ne kapard és ne vakard, akkor sem, ha viszket. Továbbra is vékonyan krémezd.' },
  { day: 7, en: 'Still no swimming pools, baths, sauna or tanning beds.', hu: 'Még mindig nincs uszoda, kádfürdő, szauna és szolárium.' },
  { day: 10, en: 'Most flakes are gone; it can look a bit cloudy. That is the new skin settling.', hu: 'A hámlás nagy része elmúlt, kicsit tejszerű lehet. Ez az új bőr rétege, rendeződik.' },
  { day: 14, en: 'Surface healed. Keep moisturising daily; still avoid strong sun.', hu: 'A felszín begyógyult. Krémezd naponta, és még kerüld az erős napot.' },
  { day: 21, en: 'Light exercise and normal showers are fine. Start SPF 50 whenever it sees the sun.', hu: 'Könnyű sport és normál zuhany rendben. Ha napot kap, mostantól mindig 50-es fényvédő.' },
  { day: 28, en: 'Fully healed in most cases. Check for patchy spots — many artists offer a free touch-up now.', hu: 'A legtöbb esetben teljesen begyógyult. Nézd meg, van-e foltos rész – sok tetováló ilyenkor ingyen javít.' },
];

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
