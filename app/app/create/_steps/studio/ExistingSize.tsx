'use client';
import { useApp } from '../../../AppProvider';
import { L } from '../utils';

/** Existing tattoo / removal: what the preview shows, and the rough size of the tattoo. */
export function ExistingSize({
  removal,
  existingCm,
  setExistingCm,
}: {
  removal: boolean;
  existingCm?: number | null;
  setExistingCm?: (n: number | null) => void;
}) {
  const { ui } = useApp();
  const t = L(ui.lang);
  return (
    <div className="card" style={{ marginTop: 16 }}>
      <h3>{removal ? t('How big is the tattoo?', 'Mekkora a tetoválás?') : t('See your tattoo in 10, 30 and 50 years', 'Nézd meg a tetoválásod 10, 30 és 50 év múlva')}</h3>
      <p className="muted small">{removal ? t('Optional — it helps us estimate how the ink responds. Black usually fades fastest under the laser.', 'Nem kötelező – segít megbecsülni, hogyan reagál a tinta. A fekete általában a leggyorsabban halványul a lézer alatt.') : t('Upload a clear photo of a tattoo you already have. You can also preview laser removal afterwards.', 'Tölts fel éles fotót egy meglévő tetoválásodról. Utána a lézeres eltávolítást is megnézheted.')}</p>
      {setExistingCm && (
        <>
          <b style={{ display: 'block', fontSize: 14, margin: '10px 0 6px' }}>{t('Roughly how big is it? (makes the score more accurate)', 'Kb. mekkora? (pontosabb lesz a pontszám)')}</b>
          <div className="cmrow">
            {[3, 5, 8, 12, 20].map((c) => (
              <button key={c} className={`chip ${existingCm === c ? 'on' : ''}`} onClick={() => setExistingCm(existingCm === c ? null : c)}>
                {c === 20 ? '20+ cm' : `${c} cm`}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
