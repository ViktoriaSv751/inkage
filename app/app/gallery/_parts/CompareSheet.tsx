'use client';
import { useApp } from '../../AppProvider';
import { Sheet } from '../../ui';
import { huArticle, tx } from '@/lib/i18n';
import { Preview, StageKey, STAGES } from '@/lib/store';
import { placeName } from '../../create/steps';

/** 2 or 3 previews side by side at the same age. */
export function CompareSheet({
  open,
  onClose,
  pair,
  cmpStage,
  setCmpStage,
  onPoll,
}: {
  open: boolean;
  onClose: () => void;
  pair: Preview[];
  cmpStage: StageKey;
  setCmpStage: (v: StageKey) => void;
  onPoll: () => void;
}) {
  const { ui } = useApp();
  const t = (en: string, hu: string) => tx(ui.lang, en, hu);
  return (
    <Sheet open={open} onClose={onClose} label={t('Compare', 'Összehasonlítás')}>
      <h2>{t('Compare', 'Összehasonlítás')}</h2>
      <div className="seg" role="radiogroup" style={{ justifySelf: 'start', flexWrap: 'wrap' }}>
        {STAGES.map((k) => (
          <button key={k} role="radio" aria-checked={cmpStage === k} className={cmpStage === k ? 'on' : ''} onClick={() => setCmpStage(k)}>
            {ui.t(`stage.${k}` as any)}
          </button>
        ))}
      </div>
      <div className={`cmp ${pair.length === 3 ? 'three' : ''}`}>
        {pair.map((p) => (
          <figure key={p.id}>
            <img src={p.images[cmpStage] || p.images.fresh} alt={placeName(p.placement, ui.lang)} />
            <figcaption>
              {placeName(p.placement, ui.lang)} · {p.score ?? '–'}/100
              {!p.images[cmpStage] && <small style={{ display: 'block' }}>{t('This year isn’t made yet: this is the fresh image', 'Ehhez az évhez még nincs kép: ez a friss kép')}</small>}
            </figcaption>
          </figure>
        ))}
      </div>
      {pair.length >= 2 && (
        <button className="btn wide" style={{ marginTop: 6 }} onClick={onPoll}>
          {t('Ask friends: which one?', 'Kérdezd meg a barátaidat: melyik legyen?')}
        </button>
      )}
      {pair.length >= 2 && pair.every((p) => p.score !== null) && new Set(pair.map((p) => p.score)).size > 1 && (() => {
        const best = pair.reduce((a, b) => ((a.score || 0) >= (b.score || 0) ? a : b));
        return (
          <p className="sub">
            {t(`The ${placeName(best.placement, 'en').toLowerCase()} version should age best (${best.score}/100).`, `${huArticle(placeName(best.placement, 'hu')) === 'az' ? 'Az' : 'A'} ${placeName(best.placement, 'hu').toLowerCase()} változat öregszik várhatóan a legjobban (${best.score}/100).`)}
          </p>
        );
      })()}
    </Sheet>
  );
}
