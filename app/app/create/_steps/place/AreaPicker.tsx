'use client';
import { useApp } from '../../../AppProvider';
import { Sheet } from '../../../ui';
import { isCustom, placeName } from '@/lib/placements';
import { BodyMap } from '../../BodyMap';
import { L } from '../utils';

/** The chosen body area above the photo; tapping it opens the body map. */
export function AreaButton({ idx, placement, onOpen }: { idx: number; placement: string; onOpen: () => void }) {
  const { ui } = useApp();
  const t = L(ui.lang);
  return (
    <button className="areabtn" onClick={onOpen}>
      <span className="areanum">{idx >= 0 ? idx + 1 : '•'}</span>
      <span className="areaname">
        <small>{t('Body area', 'Testrész')}</small>
        {placeName(placement, ui.lang)}
      </span>
      <span className="areachg">{t('Change', 'Módosítás')}</span>
    </button>
  );
}

/** The body map in a sheet, to change the body area. */
export function AreaSheet({
  open,
  setMapOpen,
  placement,
  setPlacement,
}: {
  open: boolean;
  setMapOpen: (o: boolean) => void;
  placement: string;
  setPlacement: (p: string) => void;
}) {
  const { ui } = useApp();
  const t = L(ui.lang);
  return (
    <Sheet open={open} onClose={() => setMapOpen(false)} label={t('Body area', 'Testrész')}>
      <h2>{t('Where will it go?', 'Hová kerül?')}</h2>
      <BodyMap
        value={placement}
        onChange={(v) => {
          setPlacement(v);
          if (!isCustom(v)) setMapOpen(false);
        }}
      />
      {isCustom(placement) && (
        <button className="btn wide" onClick={() => setMapOpen(false)}>
          {t('Done', 'Kész')}
        </button>
      )}
    </Sheet>
  );
}
