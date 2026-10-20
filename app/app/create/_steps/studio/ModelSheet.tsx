'use client';
import { useApp } from '../../../AppProvider';
import { Sheet } from '../../../ui';
import { placeName } from '@/lib/placements';
import { SKIN_TONES } from '../constants';
import { L } from '../utils';
import type { useModelPhoto } from './useModelPhoto';

/** "Try it on a model": pick a skin tone, get a realistic stand-in photo of the body area. */
export function ModelSheet({
  placement,
  modelOpen,
  setModelOpen,
  tone,
  setTone,
  modelBusy,
  modelImg,
  modelStep,
  modelPhoto,
  useModel,
}: ReturnType<typeof useModelPhoto> & { placement: string }) {
  const { ui } = useApp();
  const t = L(ui.lang);
  return (
    <Sheet open={modelOpen} onClose={() => !modelBusy && setModelOpen(false)} label={t('Model photo', 'Modellfotó')}>
      <h2>{t('Try it on a model', 'Próbáld ki egy modellen')}</h2>
      <p className="sub">{t(`A realistic photo of a ${placeName(placement, 'en').toLowerCase()} in the skin tone you pick.`, `Élethű fotó (${placeName(placement, 'hu').toLowerCase()}) a választott bőrtónussal.`)}</p>
      <div className={`model-stage ${modelBusy ? 'busy' : ''} ${modelImg ? 'has' : ''}`} style={{ ['--tone' as any]: SKIN_TONES[(modelImg && !modelBusy ? modelImg.tone : tone) - 1] }}>
        {modelImg && !modelBusy ? (
          <img key={modelImg.src.slice(-40)} src={modelImg.src} alt={t('Model photo', 'Modellfotó')} />
        ) : (
          <div className="model-ph" aria-live="polite">
            <span className="model-glow" />
            <span className="model-silhouette" aria-hidden="true">
              <svg viewBox="0 0 60 120"><path d="M22 6c-3 18-6 40-6 62 0 20 3 36 6 46h16c3-10 6-26 6-46 0-22-3-44-6-62z" /></svg>
            </span>
            <b>
              {modelBusy
                ? [t('Setting up the light…', 'Fény beállítása…'), t('Matching your skin tone…', 'Bőrtónus illesztése…'), t('Adding skin texture…', 'Bőrtextúra hozzáadása…'), t('Almost there…', 'Mindjárt kész…')][modelStep]
                : t('Pick a skin tone', 'Válassz bőrtónust')}
            </b>
            {modelBusy && <i className="model-bar"><i style={{ width: `${25 + modelStep * 22}%` }} /></i>}
          </div>
        )}
      </div>
      <div className="tones" role="radiogroup" aria-label={t('Skin tone', 'Bőrtónus')}>
        {SKIN_TONES.map((c, i) => (
          <button key={c} role="radio" aria-checked={tone === i + 1} className={tone === i + 1 ? 'on' : ''} style={{ background: c }} disabled={modelBusy} onClick={() => setTone(i + 1)} aria-label={t(`Skin tone ${i + 1}`, `${i + 1}. bőrtónus`)} />
        ))}
      </div>
      {modelImg && !modelBusy && modelImg.tone === tone ? (
        <>
          <button className="btn wide" onClick={useModel}>
            {t('Use this photo', 'Ezt a fotót használom')}
          </button>
          <button className="btn wide ghost" style={{ marginTop: 8 }} onClick={() => modelPhoto(true)}>
            {t('Another model', 'Másik modellt kérek')}
          </button>
        </>
      ) : (
        <button className="btn wide" onClick={() => modelPhoto(false)} disabled={modelBusy}>
          {modelBusy ? t('Making the photo…', 'Fotó készül…') : t('Show me the model', 'Mutasd a modellt')}
        </button>
      )}
    </Sheet>
  );
}
