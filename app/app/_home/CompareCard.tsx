'use client';
import { useApp } from '../AppProvider';
import { PollSheet } from '../PollSheet';
import { placeName } from '../create/steps';
import { tx } from '@/lib/i18n';
import { Preview } from '@/lib/store';

/** The previous finished preview next to this one, both at 50 years. */
export function CompareCard({ prev, preview, pollOpen, setPollOpen }: { prev: Preview; preview: Preview; pollOpen: boolean; setPollOpen: (v: boolean) => void }) {
  const { ui } = useApp();
  const t = (en: string, hu: string) => tx(ui.lang, en, hu);
  return (
    <div className="card" style={{ marginTop: 12 }}>
      <h2>{t('Previous vs. this one', 'Előző vs. mostani')}</h2>
      <button className="chipbtn" style={{ marginBottom: 8 }} onClick={() => setPollOpen(true)}>
        {t('Ask friends: which one?', 'Kérdezd meg a barátaidat: melyik legyen?')}
      </button>
      <PollSheet open={pollOpen} onClose={() => setPollOpen(false)} initial={[prev, preview]} />
      <p className="muted">{t('Both at 50 years.', 'Mindkettő 50 év múlva.')}</p>
      <div className="cmp">
        {[prev, preview].map((x, i) => (
          <figure key={x.id}>
            <img src={x.images.y50} alt={i ? t('This one', 'Mostani') : t('Previous', 'Előző')} />
            <figcaption>
              {i ? t('This one', 'Mostani') : t('Previous', 'Előző')} · {placeName(x.placement, ui.lang)}
              {x.sizeCm ? ` · ${x.sizeCm} cm` : ''} · {x.score ?? '–'}/100
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
