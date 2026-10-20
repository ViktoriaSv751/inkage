'use client';
import { useApp } from '../AppProvider';
import { tx } from '@/lib/i18n';
import { haptic, Preview, RemovalKey, StageKey } from '@/lib/store';

/** Artist PDF, share picture, laser preview, Explore and the healing plan. */
export function NextSteps({
  img,
  pending,
  pdf,
  pdfBusy,
  card,
  cardBusy,
  onRemoval,
  remCount,
  removalPending,
  setView,
  setPubOpen,
  setCare,
}: {
  img: Preview['images'];
  pending: StageKey[];
  pdf: () => void;
  pdfBusy: boolean;
  card: () => void;
  cardBusy: boolean;
  onRemoval?: () => void;
  remCount: number;
  removalPending: RemovalKey[];
  setView: (v: 'aging' | 'removal') => void;
  setPubOpen: (v: boolean) => void;
  setCare: (v: boolean) => void;
}) {
  const { ui } = useApp();
  const t = (en: string, hu: string) => tx(ui.lang, en, hu);
  return (
    <div className="card toolcard" style={{ marginTop: 12 }}>
      <h3>{t('Next steps', 'Következő lépések')}</h3>
      <button className="list-row" onClick={pdf} disabled={pdfBusy || !img.fresh}>
        <span>
          {pdfBusy ? t('Making the PDF…', 'PDF készül…') : t('PDF for your tattoo artist', 'PDF a tetoválódnak')}
          <small>{t('Design, size, placement, previews and notes on one page', 'Minta, méret, hely, előnézetek és jegyzetek egy oldalon')}</small>
        </span>
        <span aria-hidden="true">›</span>
      </button>
      <button className="list-row" onClick={card} disabled={cardBusy || !img.y50}>
        <span>
          {cardBusy ? t('Making the picture…', 'Kép készül…') : t('“Fresh vs. 50 years” picture', '„Friss vs. 50 év” kép')}
          <small>{t('Side by side, ready for Instagram and TikTok', 'Egymás mellett, kész Instagramra és TikTokra')}</small>
        </span>
        <span aria-hidden="true">›</span>
      </button>
      {onRemoval && (
        <button
          className="list-row"
          onClick={() => {
            setView('removal');
            haptic();
            // jump to the top so the laser preview is the first thing you see
            window.scrollTo({ top: 0, behavior: 'smooth' });
            if (!remCount && !removalPending.length) onRemoval();
          }}
          disabled={!img.fresh || pending.length > 0}
        >
          <span>
            {t('What if you regret it? Laser removal preview', 'Mi van, ha megbánod? Lézeres eltávolítás')}
            <small>{t('How it would look after 3, 6 and 10 laser sessions', 'Így nézne ki 3, 6 és 10 lézeres kezelés után')}</small>
          </span>
          <span aria-hidden="true">›</span>
        </button>
      )}
      <button className="list-row" onClick={() => setPubOpen(true)} disabled={!img.y50}>
        <span>
          {t('Share it in Explore', 'Megosztás a Felfedezésben')}
          <small>{t('Let others vote on it — reviewed by a person first', 'Mások is szavazhatnak rá – előtte egy ember átnézi')}</small>
        </span>
        <span aria-hidden="true">›</span>
      </button>
      <button className="list-row" onClick={() => setCare(true)}>
        <span>
          {t('I got it done – healing plan', 'Megcsináltattam – gyógyulási terv')}
          <small>{t('28-day aftercare reminders in your calendar', '28 napos ápolási emlékeztetők a naptáradba')}</small>
        </span>
        <span aria-hidden="true">›</span>
      </button>
    </div>
  );
}
