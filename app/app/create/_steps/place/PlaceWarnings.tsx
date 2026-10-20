'use client';
import { useApp } from '../../../AppProvider';
import { L } from '../utils';

/** Off the skin, past the detected body part, or too fine for its size. */
export function PlaceWarnings({
  off,
  out,
  thin,
  cm,
  onFit,
  remember,
}: {
  off: number;
  out: boolean;
  thin: boolean;
  cm: number;
  onFit?: () => void;
  remember: () => void;
}) {
  const { ui } = useApp();
  const t = L(ui.lang);
  return (
    <>
      {off > 0.08 && (
        <div className="warnbox" role="alert">
          <span>⚠️</span>
          <span>
            <b>{t(`About ${Math.round(off * 100)}% of it is off the skin`, `Kb. ${Math.round(off * 100)}%-a nem bőrre esik`)}</b>{' '}
            {t('(on clothes or the background, shaded in the photo). A tattoo can only go on skin — that part will be left out.', '(ruhára vagy a háttérre – a fotón sötétítve látod). Tetoválás csak bőrre kerülhet, ez a rész kimarad.')}
            {onFit && (
              <button className="inline-fix" onClick={() => (remember(), onFit())}>
                {t('Fit it to the body part', 'Igazítsd a testrészre')}
              </button>
            )}
          </span>
        </div>
      )}
      {out && off <= 0.08 && (
        <div className="notebox" role="note">
          <span>
            <b>{t('It reaches past the detected body part.', 'Túlnyúlik a felismert testrészen.')}</b>{' '}
            {t('That’s fine if you want it there — it will continue onto the neighbouring skin, never onto clothes or the background.', 'Ha így szeretnéd, maradhat – a szomszédos bőrre folytatódik, ruhára vagy a háttérre soha.')}
            {onFit && (
              <button className="inline-fix" onClick={onFit}>
                {t('Fit it to the body part', 'Igazítsd a testrészre')}
              </button>
            )}
          </span>
        </div>
      )}

      {thin && (
        <div className="warnbox" role="note">
          <span>⚠️</span>
          <span>
            <b>{t('Very fine detail for this size.', 'Nagyon apró részletek ehhez a mérethez.')}</b>{' '}
            {t(
              `Lines this close together usually merge within 10 years. Try at least ${Math.ceil(Math.max(7, cm * 1.4))} cm — the preview will show you why.`,
              `Ilyen közeli vonalak 10 éven belül általában összefolynak. Próbáld legalább ${Math.ceil(Math.max(7, cm * 1.4))} cm-esre – az előnézet megmutatja, miért.`
            )}
          </span>
        </div>
      )}
    </>
  );
}
