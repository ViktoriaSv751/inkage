'use client';
import { useApp } from '../../AppProvider';
import { tx } from '@/lib/i18n';
import type { Preview } from '@/lib/store';
import type { Kind, Sort } from './shared';

/** Favorites switch, search, sort, type chips and folder chips above the grid. */
export function GalleryFilters({
  items,
  shownCount,
  filter,
  setFilter,
  q,
  setQ,
  sort,
  setSort,
  kind,
  setKind,
  folder,
  setFolder,
  folders,
  onIdeas,
  onManageFolders,
}: {
  items: Preview[] | null;
  shownCount: number;
  filter: 'all' | 'fav';
  setFilter: (v: 'all' | 'fav') => void;
  q: string;
  setQ: (v: string) => void;
  sort: Sort;
  setSort: (v: Sort) => void;
  kind: Kind;
  setKind: (v: Kind) => void;
  folder: string | null;
  setFolder: (v: string | null) => void;
  folders: string[];
  onIdeas: () => void;
  onManageFolders: () => void;
}) {
  const { ui } = useApp();
  const t = (en: string, hu: string) => tx(ui.lang, en, hu);
  const sortLabel: Record<Sort, string> = { new: t('Newest', 'Legújabb'), old: t('Oldest', 'Legrégebbi'), score: t('Best score', 'Legjobb pontszám'), place: t('Body area', 'Testrész') };
  return (
    <>
      {items && items.length > 0 && (
        <div className="seg" style={{ marginTop: 14 }} role="radiogroup">
          <button role="radio" aria-checked={filter === 'all'} className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>
            {ui.t('gallery.all')}
          </button>
          <button role="radio" aria-checked={filter === 'fav'} className={filter === 'fav' ? 'on' : ''} onClick={() => setFilter('fav')}>
            ♥ {ui.t('gallery.favorites')} {items.some((p) => p.favorite) ? `(${items.filter((p) => p.favorite).length})` : ''}
          </button>
        </div>
      )}

      {items && items.length > 1 && (
        <div className="galtools">
          <input className="text" type="search" id="gal-search" placeholder={t('Search: body area, notes, folder…', 'Keresés: testrész, jegyzet, mappa…')} value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            <label className="sortsel">
              <span className="sr-only">{t('Sort', 'Rendezés')}</span>
              <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
                {(Object.keys(sortLabel) as Sort[]).map((k) => (
                  <option key={k} value={k}>
                    {sortLabel[k]}
                  </option>
                ))}
              </select>
            </label>
            {(['any', 'new', 'existing', 'removal'] as const).map((k) => (
              <button key={k} className={`chip ${kind === k ? 'on' : ''}`} onClick={() => setKind(k)}>
                {k === 'any' ? t('All types', 'Mind') : k === 'new' ? t('New designs', 'Új minták') : k === 'existing' ? t('My tattoos', 'Meglévő tetoválásaim') : t('Removal', 'Eltávolítás')}
              </button>
            ))}
            <button className="chip" onClick={onIdeas}>
              💡 {t('Ideas', 'Ötletek')}
            </button>
          </div>
        </div>
      )}
      {items && items.length > 0 && (
        <div className="row" style={{ gap: 6, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {folders.length > 0 && (
            <button className={`chip ${!folder ? 'on' : ''}`} onClick={() => setFolder(null)}>
              {t('All folders', 'Minden mappa')}
            </button>
          )}
          {folders.map((f) => (
            <button key={f} className={`chip ${folder === f ? 'on' : ''}`} onClick={() => setFolder(folder === f ? null : f)}>
              📁 {f} <small className="muted">{(items || []).filter((p) => p.collection === f).length}</small>
            </button>
          ))}
          <button className="chip ghostchip" onClick={onManageFolders}>
            {folders.length ? t('Manage folders', 'Mappák kezelése') : t('+ Folder', '+ Mappa')}
          </button>
        </div>
      )}

      {items && items.length > 0 && shownCount === 0 &&
        (filter === 'fav' && !q && !folder && kind === 'any' ? (
          <div className="pf-empty" style={{ marginTop: 16 }}>
            <b>{t('No favorites yet', 'Még nincs kedvenced')}</b>
            <p>{t('Tap the heart on any preview — here in the grid or inside it — and it shows up here.', 'Koppints a szívre bármelyik előnézeten – itt a rácsban vagy megnyitva –, és itt fog megjelenni.')}</p>
            <button className="btn ghost" onClick={() => setFilter('all')}>
              {t('Show all', 'Az összes mutatása')}
            </button>
          </div>
        ) : (
          <p className="sub" style={{ marginTop: 16 }}>{t('Nothing matches. Try another search or filter.', 'Nincs találat. Próbálj más keresést vagy szűrőt.')}</p>
        ))}
    </>
  );
}
