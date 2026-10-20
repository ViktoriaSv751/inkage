'use client';
import Link from 'next/link';
import { useApp } from '../../AppProvider';
import { Icon } from '../../ui';
import { tx } from '@/lib/i18n';
import type { Preview } from '@/lib/store';
import { placeName } from '../../create/steps';
import { isRemoval, thumb, type Mode } from './shared';

/** The tiles: loading placeholders, the empty state, or the saved previews. */
export function PreviewGrid({
  items,
  shown,
  mode,
  picked,
  setPicked,
  setOpen,
  update,
  onImgError,
}: {
  items: Preview[] | null;
  shown: Preview[];
  mode: Mode;
  picked: string[];
  setPicked: (v: string[]) => void;
  setOpen: (p: Preview) => void;
  update: (p: Preview, x: Partial<Preview>) => void;
  onImgError: () => void;
}) {
  const { ui } = useApp();
  const t = (en: string, hu: string) => tx(ui.lang, en, hu);
  return items === null ? (
    <div className="galgrid">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="tile ph" />
      ))}
    </div>
  ) : items.length === 0 ? (
    <div className="gal-empty">
      <span className="gal-empty-ico" aria-hidden="true">
        <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><path d="M16.5 13.5v6M13.5 16.5h6" /></svg>
      </span>
      <h2>{t('No previews yet', 'Még nincs előnézeted')}</h2>
      <p className="sub">{ui.t('gallery.empty')}</p>
      <ol className="gal-steps">
        <li><b>1</b>{t('Take a photo of the spot', 'Fotózd le a helyet')}</li>
        <li><b>2</b>{t('Add any design', 'Adj hozzá egy mintát')}</li>
        <li><b>3</b>{t('See it at 10, 30 and 50 years', 'Nézd meg 10, 30 és 50 év múlva')}</li>
      </ol>
      <Link className="btn" href="/app">
        {ui.t('nav.create')}
      </Link>
    </div>
  ) : (
    <div className="galgrid">
      {shown.map((p) => {
        const n = picked.indexOf(p.id);
        return (
          <div key={p.id} className={`tile ${n >= 0 ? 'pick' : ''} ${mode === 'select' ? 'selmode' : ''}`} data-n={mode === 'compare' ? n + 1 : '✓'}>
            <button
              className="tile-hit"
              onClick={() => {
                if (mode === 'browse') return setOpen(p);
                if (n >= 0) setPicked(picked.filter((x) => x !== p.id));
                else if (mode === 'select' || picked.length < 3) setPicked([...picked, p.id]);
              }}
              aria-pressed={mode !== 'browse' ? n >= 0 : undefined}
              aria-label={`${placeName(p.placement, ui.lang)}, ${t('score', 'pontszám')} ${p.score ?? '–'}`}
            >
              {thumb(p) && <img src={thumb(p)} alt="" loading="lazy" onError={onImgError} />}
              {p.design && <img className="tile-design" src={p.design} alt="" loading="lazy" />}
              {p.doneAt && <span className="donebadge">✓ {t('Done', 'Kész')}</span>}
              {p.source === 'local' && <span className="local">{t('Device', 'Eszköz')}</span>}
              {isRemoval(p) && <span className="rmbadge">{t('Laser', 'Lézer')}</span>}
              <span className="meta">
                <span>
                  {placeName(p.placement, ui.lang)}
                  {p.collection ? <small> · {p.collection}</small> : null}
                </span>
                {p.score !== null && <b>{p.score}</b>}
              </span>
            </button>
            {mode === 'browse' && (
              <button className={`tile-fav ${p.favorite ? 'on' : ''}`} aria-label={p.favorite ? t('Remove from favorites', 'Kivétel a kedvencek közül') : t('Add to favorites', 'Kedvencekhez')} aria-pressed={p.favorite} onClick={() => update(p, { favorite: !p.favorite })}>
                {Icon.heart}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
