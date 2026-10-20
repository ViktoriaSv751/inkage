'use client';
import { useApp } from '../../../AppProvider';
import type { Layer } from '../types';
import { L } from '../utils';

/** The tattoos on the photo as chips, plus "add another" / "duplicate". */
export function LayerBar({
  layers,
  cur,
  extras,
  setActive,
  setSel,
  setAddOpen,
  duplicateLayer,
}: {
  layers: Layer[];
  cur: number;
  extras: Layer[];
  setActive: (i: number) => void;
  setSel: (s: boolean) => void;
  setAddOpen: (o: boolean) => void;
  duplicateLayer: (i: number) => void;
}) {
  const { ui } = useApp();
  const t = L(ui.lang);
  return (
    <div className="layer-bar">
      {layers.length > 1 && (
        <div className="layer-chips" role="group" aria-label={t('Tattoos on the photo', 'Tetoválások a fotón')}>
          {layers.map((L1, i) => (
            <button key={i} type="button" className={`layer-chip ${i === cur ? 'on' : ''}`} onClick={() => (setActive(i), setSel(true))}>
              <img src={L1.design.ink} alt="" /> {i + 1}.
            </button>
          ))}
        </div>
      )}
      {extras.length < 5 && (
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="chipbtn add-layer" onClick={() => setAddOpen(true)}>
            + {t('Add another tattoo', 'Még egy tetoválás hozzáadása')}
          </button>
          <button type="button" className="chipbtn add-layer" onClick={() => duplicateLayer(cur)}>
            ⧉ {layers.length > 1 ? t(`Duplicate no. ${cur + 1}`, `${cur + 1}. duplikálása`) : t('Duplicate', 'Duplikálás')}
          </button>
        </div>
      )}
    </div>
  );
}
