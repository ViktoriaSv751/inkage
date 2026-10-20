'use client';
import { useApp } from '../../../AppProvider';
import type { Design, TattooPick } from '../types';
import { L } from '../utils';

/** The picture next to what was cut out of it, with "cut again" / "other tattoo" / "use as is". */
export function CutCompare({
  design,
  busy,
  pick,
  setPick,
  extract,
  applyDesign,
}: {
  design: Design;
  busy: boolean;
  pick: TattooPick | null;
  setPick: (p: TattooPick) => void;
  extract: (raw: string, mode: Design['mode']) => void;
  applyDesign: (raw: string, mode: Design['mode'], libId?: string) => void;
}) {
  const { ui } = useApp();
  const t = L(ui.lang);
  return (
    <div className={`cmpcut ${design.match !== undefined && design.match >= 0 && design.match < 7 ? 'warn' : ''}`}>
      <figure>
        <img src={design.original} alt="" />
        <figcaption>{t('Your picture', 'A képed')}</figcaption>
      </figure>
      <span className="cmp-arrow" aria-hidden="true">→</span>
      <figure className="cut">
        <img src={design.ink} alt="" />
        <figcaption>{t('Cut out', 'Kivágva')}</figcaption>
      </figure>
      <div className="cmpcut-txt">
        <b>
          {design.match !== undefined && design.match >= 0 && design.match < 7
            ? t('Check it — it may differ', 'Nézd meg – eltérhet')
            : t('Only the tattoo, nothing else', 'Csak a tetoválás, semmi más')}
        </b>
        <div className="row" style={{ gap: 4 }}>
          <button className="link" disabled={busy} onClick={() => extract(design.original!, design.mode)}>
            {t('Cut again', 'Újra')}
          </button>
          {pick && (
            <button className="link" disabled={busy} onClick={() => setPick({ ...pick, open: true })}>
              {t('Other tattoo', 'Másik tetoválás')}
            </button>
          )}
          <button className="link" disabled={busy} onClick={() => applyDesign(design.original!, design.mode)}>
            {t('Use as is', 'Eredeti kép')}
          </button>
        </div>
      </div>
    </div>
  );
}
