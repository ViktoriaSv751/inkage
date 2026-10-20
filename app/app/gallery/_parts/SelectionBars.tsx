'use client';
import { useApp } from '../../AppProvider';
import { tx } from '@/lib/i18n';
import type { Preview } from '@/lib/store';
import type { Mode } from './shared';

/** The bar under the filters in compare and select mode. */
export function SelectionBars({
  mode,
  picked,
  setPicked,
  shown,
  pickedItems,
  onCompare,
  onFavorite,
  onMove,
  onDelete,
}: {
  mode: Mode;
  picked: string[];
  setPicked: (v: string[]) => void;
  shown: Preview[];
  pickedItems: Preview[];
  onCompare: () => void;
  onFavorite: () => void;
  onMove: () => void;
  onDelete: () => void;
}) {
  const { ui } = useApp();
  const t = (en: string, hu: string) => tx(ui.lang, en, hu);
  return (
    <>
      {mode === 'compare' && (
        <div className="selbar">
          <p className="sub small" style={{ margin: 0 }}>{t('Pick 2 or 3 previews to compare.', 'Válassz ki 2 vagy 3 előnézetet az összehasonlításhoz.')}</p>
          <button className="btn" disabled={picked.length < 2} onClick={onCompare}>
            {t('Compare', 'Összevet')} ({picked.length})
          </button>
        </div>
      )}
      {mode === 'select' && (
        <div className="selbar">
          <p className="sub small" style={{ margin: 0 }}>
            {picked.length ? t(`${picked.length} selected`, `${picked.length} kijelölve`) : t('Tap previews to select them.', 'Koppints az előnézetekre a kijelöléshez.')}
          </p>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            <button className="chipbtn" onClick={() => setPicked(picked.length === shown.length ? [] : shown.map((p) => p.id))}>
              {picked.length === shown.length ? t('None', 'Egyik sem') : t('All', 'Mind')}
            </button>
            <button className="chipbtn" disabled={!picked.length} onClick={onFavorite}>
              ♥ {pickedItems.length && pickedItems.every((p) => p.favorite) ? t('Unfavorite', 'Kedvenc ki') : t('Favorite', 'Kedvenc')}
            </button>
            <button className="chipbtn" disabled={!picked.length} onClick={onMove}>
              📁 {t('Move', 'Mappába')}
            </button>
            <button className="chipbtn danger" disabled={!picked.length} onClick={onDelete}>
              {t('Delete', 'Törlés')}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
