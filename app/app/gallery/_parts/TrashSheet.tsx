'use client';
import { localeOf } from '@/lib/tr';
import { useApp } from '../../AppProvider';
import { Sheet } from '../../ui';
import { tx } from '@/lib/i18n';
import type { Preview } from '@/lib/store';
import { placeName } from '../../create/steps';
import { thumb } from './shared';

export function TrashSheet({
  open,
  onClose,
  trash,
  restoring,
  purging,
  restore,
  purge,
}: {
  open: boolean;
  onClose: () => void;
  trash: Preview[];
  restoring: string;
  purging: string;
  restore: (p: Preview) => void;
  purge: (ids?: string[]) => void;
}) {
  const { ui } = useApp();
  const t = (en: string, hu: string) => tx(ui.lang, en, hu);
  return (
    <Sheet open={open} onClose={onClose} label={t('Recently deleted', 'Nemrég törölt')}>
      <h2>{t('Recently deleted', 'Nemrég törölt')}</h2>
      <p className="sub">{t('Restore puts a design back in your gallery. Delete removes it for good.', 'A „Visszaállítás” visszateszi a galériádba, a „Törlés” véglegesen eltávolítja.')}</p>
      {trash.length > 0 && (
        <button className="btn wide danger-btn" onClick={() => purge()} disabled={!!purging}>
          {purging === 'all' ? t('Deleting…', 'Törlés…') : t(`Empty Recently deleted (${trash.length})`, `Nemrég törölt kiürítése (${trash.length})`)}
        </button>
      )}
      <div className="trash-list">
        {trash.map((p) => (
          <div key={p.id} className="trash-row">
            {thumb(p) && <img src={thumb(p)} alt="" />}
            <span>
              <b>{placeName(p.placement, ui.lang)}</b>
              <small>{new Date(p.created_at).toLocaleDateString(localeOf(ui.lang))}</small>
            </span>
            <span className="trash-acts">
              <button className="chipbtn" disabled={restoring === p.id || !!purging} onClick={() => restore(p)}>
                {restoring === p.id ? '…' : t('Restore', 'Visszaállítás')}
              </button>
              <button className="chipbtn danger" disabled={restoring === p.id || !!purging} onClick={() => purge([p.id])}>
                {purging === p.id ? '…' : t('Delete', 'Törlés')}
              </button>
            </span>
          </div>
        ))}
        {!trash.length && <p className="muted">{t('Nothing here.', 'Itt nincs semmi.')}</p>}
      </div>
    </Sheet>
  );
}
