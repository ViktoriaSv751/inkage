'use client';
import { useApp } from '../../AppProvider';
import { Sheet } from '../../ui';
import { tx } from '@/lib/i18n';
import type { Preview } from '@/lib/store';
import { thumb } from './shared';

// deleting asks first, in a clear confirm sheet with the pictures that will go
export function DeleteSheet({ delAsk, delBusy, setDelAsk, doDelete }: { delAsk: Preview[] | null; delBusy: boolean; setDelAsk: (v: Preview[] | null) => void; doDelete: () => void }) {
  const { ui } = useApp();
  const t = (en: string, hu: string) => tx(ui.lang, en, hu);
  return (
    <Sheet open={!!delAsk} onClose={() => !delBusy && setDelAsk(null)} label={t('Delete', 'Törlés')}>
      <div className="del-ask">
        <div className="del-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13M10 11v6M14 11v6" /></svg>
        </div>
        <h2>{(delAsk?.length || 0) > 1 ? t(`Delete ${delAsk!.length} designs?`, `Biztosan törlöd a kijelölt ${delAsk!.length} tervet?`) : t('Delete this design?', 'Biztosan törlöd ezt a tervet?')}</h2>
        <div className="del-thumbs">
          {(delAsk || []).slice(0, 4).map((p) => (
            <span key={p.id} className="del-thumb">
              {thumb(p) && <img src={thumb(p)} alt="" />}
            </span>
          ))}
          {(delAsk?.length || 0) > 4 && <span className="del-thumb more">+{delAsk!.length - 4}</span>}
        </div>
        <p className="sub">{t('It moves to Recently deleted at the bottom of your gallery – you can bring it back from there. Its vote links are closed.', 'A galériád alján lévő „Nemrég törölt” részbe kerül – onnan bármikor visszaállíthatod. A szavazós linkjei lezárulnak.')}</p>
        <button className="btn wide danger-btn" onClick={doDelete} disabled={delBusy}>
          {delBusy ? t('Deleting…', 'Törlés…') : t('Yes, delete', 'Igen, törlöm')}
        </button>
        <button className="btn wide ghost" onClick={() => setDelAsk(null)} disabled={delBusy}>
          {t('Cancel', 'Mégse')}
        </button>
      </div>
    </Sheet>
  );
}
