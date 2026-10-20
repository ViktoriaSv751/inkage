'use client';
import { useApp } from '../../../AppProvider';
import { Sheet } from '../../../ui';
import { L } from '../utils';

/** A design from a link (Pinterest, Instagram, any image address). */
export function LinkSheet({
  linkOpen,
  setLinkOpen,
  link,
  setLink,
  linkBusy,
  fromLink,
}: {
  linkOpen: boolean;
  setLinkOpen: (o: boolean) => void;
  link: string;
  setLink: (l: string) => void;
  linkBusy: boolean;
  fromLink: (url: string) => void;
}) {
  const { ui } = useApp();
  const t = L(ui.lang);
  return (
    <Sheet open={linkOpen} onClose={() => setLinkOpen(false)} label={t('Design from a link', 'Minta linkről')}>
      <h2>{t('Design from a link', 'Minta linkről')}</h2>
      <p className="sub">{t('Paste a Pinterest, Instagram or image link. Only the tattoo will be used.', 'Illessz be Pinterest-, Instagram- vagy képlinket. Csak a tetoválást használjuk fel belőle.')}</p>
      <input id="design-link" type="url" inputMode="url" placeholder="https://…" value={link} onChange={(e) => setLink(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && fromLink(link)} />
      <button className="btn wide" onClick={() => fromLink(link)} disabled={linkBusy || !link.trim()}>
        {linkBusy ? t('Loading…', 'Betöltés…') : t('Load the picture', 'Kép betöltése')}
      </button>
    </Sheet>
  );
}
