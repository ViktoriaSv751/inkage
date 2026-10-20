'use client';
import Link from 'next/link';
import { useApp } from '../../AppProvider';
import { tx } from '@/lib/i18n';
import type { Preview } from '@/lib/store';
import { placeName } from '../../create/steps';

/** The Previews tab: the latest 8 and a line about your best one. */
export function PreviewsPanel({ mine, best, topPlace }: { mine: Preview[] | null; best: Preview | null; topPlace: string | null }) {
  const { ui } = useApp();
  const t = (en: string, hu: string) => tx(ui.lang, en, hu);
  return (
    <div className="pf-panel">
      {mine === null ? (
        <div className="pf-grid">
          {[0, 1, 2, 3].map((k) => (
            <div key={k} className="pf-tile skel" />
          ))}
        </div>
      ) : mine.length ? (
        <>
          <div className="pf-grid">
            {mine.slice(0, 8).map((p) => (
              <Link key={p.id} href={`/app/gallery?id=${p.id}`} className="pf-tile">
                {(p.images.fresh || p.images.y50) && <img src={p.images.fresh || p.images.y50} alt="" decoding="async" />}
                <span className="pf-tile-l">
                  <b>{placeName(p.placement, ui.lang)}</b>
                  {typeof p.score === 'number' && <small>{p.score}/100</small>}
                </span>
              </Link>
            ))}
          </div>
          {(best || topPlace) && (
            <p className="muted small" style={{ margin: '14px 2px 0' }}>
              {best && t(`Your best-aging design: ${placeName(best.placement, 'en').toLowerCase()}, ${best.size}. `, `A legjobban öregedő terved: ${placeName(best.placement, 'hu').toLowerCase()}, ${best.size}. `)}
              {topPlace && t(`Most tried spot: ${placeName(topPlace, 'en').toLowerCase()}.`, `Leggyakrabban kipróbált hely: ${placeName(topPlace, 'hu').toLowerCase()}.`)}
            </p>
          )}
          <Link className="btn ghost wide" href="/app/gallery" style={{ marginTop: 14 }}>
            {t('Open gallery', 'Galéria megnyitása')}
          </Link>
        </>
      ) : (
        <div className="pf-empty">
          <b>{t('No previews yet', 'Még nincs előnézeted')}</b>
          <p>{t('Your designs will appear here, ready to compare.', 'Itt jelennek meg a terveid, összehasonlításra készen.')}</p>
          <Link className="btn" href="/app">
            {t('Make my first preview', 'Elkészítem az elsőt')}
          </Link>
        </div>
      )}
    </div>
  );
}
