'use client';
import { useApp } from '../../../AppProvider';
import { track } from '@/lib/store';
import { IdeaSheet } from '../../IdeaSheet';
import { L } from '../utils';

/** New / existing / removal switch, the "save a tattoo idea" entry and the removal note. */
export function ModeSwitch({
  existing,
  removal,
  setMode,
  ideaOpen,
  setIdeaOpen,
  designFromFile,
}: {
  existing: boolean;
  removal: boolean;
  setMode?: (m: 'new' | 'existing' | 'removal') => void;
  ideaOpen: boolean;
  setIdeaOpen: (o: boolean) => void;
  designFromFile: (f: File | Blob, src: string) => unknown;
}) {
  const { ui } = useApp();
  const t = L(ui.lang);
  return (
    <>
      {setMode && (
        <div className="seg modeseg" role="radiogroup" aria-label={t('What do you want to see?', 'Mit szeretnél látni?')}>
          <button role="radio" aria-checked={!existing} className={!existing ? 'on' : ''} onClick={() => setMode('new')}>
            {t('New tattoo', 'Új tetoválás')}
          </button>
          <button role="radio" aria-checked={existing && !removal} className={existing && !removal ? 'on' : ''} onClick={() => setMode('existing')}>
            {t('Existing', 'Meglévő')}
          </button>
          <button role="radio" aria-checked={removal} className={removal ? 'on' : ''} onClick={() => setMode('removal')}>
            {t('Removal', 'Eltávolítás')}
          </button>
        </div>
      )}
      {setMode && (
        <button type="button" className="idea-btn" onClick={() => (setIdeaOpen(true), track('idea_open'))}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.4 1 1.1 1 1.8V16h5v-.3c0-.7.4-1.4 1-1.8A6 6 0 0 0 12 3z" /></svg>
          <span>
            <b>{t('Save a tattoo idea', 'Tetoválás-ötlet mentése')}</b>
            <small>{t('From your photos or a link, to your gallery', 'Fotótárból vagy linkről, a galériádba')}</small>
          </span>
        </button>
      )}
      <IdeaSheet
        open={ideaOpen}
        onClose={() => setIdeaOpen(false)}
        onTry={(blob) => {
          setMode?.('new');
          designFromFile(blob, 'idea');
        }}
      />
      {removal && (
        <div className="rm-note">
          <b>{t('Laser removal preview', 'Lézeres eltávolítás előnézete')}</b>
          <p>{t('Add a photo of the tattoo you are thinking of removing. We show it after 3, 6 and 10 laser sessions — an estimate to talk through with a dermatologist or clinic, not a medical opinion.', 'Töltsd fel annak a tetoválásnak a fotóját, amit eltávolítanál. Megmutatjuk 3, 6 és 10 lézeres kezelés után – becslés, amit bőrgyógyásszal vagy klinikával érdemes átbeszélni, nem orvosi vélemény.')}</p>
        </div>
      )}
    </>
  );
}
