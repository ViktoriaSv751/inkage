'use client';

import Link from 'next/link';
import { seoPage } from '@/lib/seo';
import { track } from '@/lib/store';

/** "Quick facts": four illustrated rules of thumb, each linking to the full guide. */
export function QuickFacts({ lang }: { lang: 'en' | 'hu' }) {
  const t = (en: string, hu: string) => (lang === 'hu' ? hu : en);
  const q = lang === 'en' ? '?lang=en' : '';
  const areas = (['back', 'upper-arm', 'forearm', 'hand', 'finger'] as const).map((k) => {
    const p = seoPage(`fine-line-${k}`, lang);
    return { k, name: p ? (lang === 'hu' ? p.a.hu : p.a.en) : k, v: p?.medium ?? 0 };
  });
  const inks = [
    { c: '#111', n: t('Black', 'Fekete'), f: 0.92 },
    { c: '#1f4fa8', n: t('Blue', 'Kék'), f: 0.7 },
    { c: '#c62828', n: t('Red', 'Piros'), f: 0.62 },
    { c: '#f4c430', n: t('Yellow', 'Sárga'), f: 0.32 },
    { c: '#fbfbfb', n: t('White', 'Fehér'), f: 0.18 },
  ];
  return (
    <section className="qf" aria-labelledby="qf-h">
      <div className="qf-head">
        <h2 id="qf-h">{t('Quick facts', 'Gyors tények')}</h2>
        <Link href={`/tudastar${q}`} className="qf-all">
          {t('All guides', 'Összes útmutató')}
        </Link>
      </div>
      <div className="qf-grid">
        <Link href={`/tudastar/color-vs-black-ink-aging${q}`} className="qf-card ink" onClick={() => track('qf_open', { k: 'ink' })}>
          <div className="qf-vis" aria-hidden="true">
            <div className="qf-inks">
              {inks.map((x) => (
                <div key={x.n} className="qf-ink">
                  <i style={{ background: x.c }} />
                  <i style={{ background: x.c, opacity: x.f }} />
                  <span>{x.n}</span>
                </div>
              ))}
            </div>
            <div className="qf-inks-lab">
              <span>{t('Fresh', 'Friss')}</span>
              <span>{t('Years later', 'Évek múlva')}</span>
            </div>
          </div>
          <b>{t('Black lasts longest', 'A fekete tart a legtovább')}</b>
          <p>{t('Pastels, yellow and white usually fade first.', 'A pasztell, a sárga és a fehér általában fakul először.')}</p>
        </Link>

        <Link href={`/tudastar/tattoo-aftercare-sun-protection${q}`} className="qf-card sun" onClick={() => track('qf_open', { k: 'sun' })}>
          <div className="qf-vis" aria-hidden="true">
            <div className="qf-sun">
              <svg viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="22" />
                {Array.from({ length: 12 }).map((_, k) => (
                  <line key={k} x1="60" y1="20" x2="60" y2="8" transform={`rotate(${k * 30} 60 60)`} />
                ))}
              </svg>
              <span>
                SPF<b>50</b>
              </span>
            </div>
          </div>
          <b>{t('Sun is the #1 fader', 'A nap fakít a legjobban')}</b>
          <p>{t('Broad-spectrum SPF 50 once healed, reapplied in strong sun.', 'Gyógyulás után széles spektrumú 50-es fényvédő, erős napon újrakenve.')}</p>
        </Link>

        <Link href={`/tudastar/fine-line-tattoos-aging${q}`} className="qf-card lines" onClick={() => track('qf_open', { k: 'lines' })}>
          <div className="qf-vis" aria-hidden="true">
            <div className="qf-lines">
              <figure>
                <svg viewBox="0 0 80 60">
                  <path d="M10 18 C30 8, 50 28, 70 18" />
                  <path d="M10 30 C30 20, 50 40, 70 30" />
                </svg>
                <figcaption>{t('Today', 'Ma')}</figcaption>
              </figure>
              <span className="qf-arrow">→</span>
              <figure>
                <svg viewBox="0 0 80 60" className="old">
                  <path d="M10 22 C30 12, 50 32, 70 22" />
                  <path d="M10 28 C30 18, 50 38, 70 28" />
                </svg>
                <figcaption>{t('10–15 yrs', '10–15 év')}</figcaption>
              </figure>
            </div>
          </div>
          <b>{t('Keep lines ~1 mm apart', 'Hagyj kb. 1 mm-t a vonalak közt')}</b>
          <p>{t('Closer lines tend to merge within 10–15 years.', 'A közelebbi vonalak 10–15 év alatt gyakran összefolynak.')}</p>
        </Link>

        <Link href={`/tudastar/best-placement-for-tattoo-longevity${q}`} className="qf-card place" onClick={() => track('qf_open', { k: 'place' })}>
          <div className="qf-vis" aria-hidden="true">
            <ul className="qf-bars">
              {areas.map((a) => (
                <li key={a.k}>
                  <span>{a.name}</span>
                  <i>
                    <em style={{ width: `${a.v}%`, background: a.v >= 75 ? 'var(--green)' : a.v >= 60 ? 'var(--amber)' : 'var(--red)' }} />
                  </i>
                  <b>{a.v}</b>
                </li>
              ))}
            </ul>
          </div>
          <b>{t('Placement matters', 'A hely számít')}</b>
          <p>{t('Back and upper arm age best; hands and fingers fade fastest.', 'A hát és a felkar öregszik a legszebben; a kéz és az ujjak fakulnak leggyorsabban.')}</p>
        </Link>
      </div>
      <p className="qf-note">{t('Rules of thumb, not measurements. Scores: fine line at 8 cm, average sun.', 'Ökölszabályok, nem mérések. Pontszámok: fine line, 8 cm, átlagos napfény.')}</p>
    </section>
  );
}
