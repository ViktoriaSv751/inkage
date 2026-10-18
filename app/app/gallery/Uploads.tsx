'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useApp } from '../AppProvider';
import { Sheet } from '../ui';
import { tx } from '@/lib/i18n';
import { haptic, lsSet, track } from '@/lib/store';
import { Upload, uploads, USE_UPLOAD_KEY } from '@/lib/uploads';

/** Every photo and design the user added, kept on the account: the same list on every device. */
export function Uploads() {
  const { ui, me, toast } = useApp();
  const router = useRouter();
  const t = (en: string, hu: string) => tx(ui.lang, en, hu);
  const [items, setItems] = useState<Upload[] | null>(null);
  const [kind, setKind] = useState<'photo' | 'design'>('photo');
  const [open, setOpen] = useState<Upload | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!me.user) return setItems([]);
    uploads.list(undefined, 200).then(setItems, () => setItems([]));
  }, [me.user]);

  if (!items || !items.length) return null;
  const shown = items.filter((u) => u.kind === kind);

  /** Start a new design with this picture as the body photo or as the tattoo design. */
  const use = (u: Upload) => {
    lsSet(USE_UPLOAD_KEY, { kind: u.kind, src: u.src });
    track('upload_reuse', { kind: u.kind });
    try {
      sessionStorage.setItem('ink_fresh', '1');
    } catch {}
    router.push('/app');
  };
  const remove = async (u: Upload) => {
    setBusy(true);
    try {
      await uploads.remove(u.id);
      setItems((all) => all?.filter((x) => x.id !== u.id) ?? null);
      setOpen(null);
      haptic();
    } catch {
      toast(t('Could not delete it. Check your connection and try again.', 'Nem sikerült törölni. Ellenőrizd a kapcsolatot, és próbáld újra.'));
    }
    setBusy(false);
  };

  return (
    <section className="uploads" aria-label={t('My uploads', 'Feltöltött képeim')}>
      <div className="uploads-head">
        <h2>{t('My uploads', 'Feltöltött képeim')}</h2>
        <div className="row" style={{ gap: 6 }}>
          {(['photo', 'design'] as const).map((k) => (
            <button key={k} className={`chip ${kind === k ? 'on' : ''}`} onClick={() => setKind(k)}>
              {k === 'photo' ? t('Photos', 'Fotók') : t('Designs', 'Minták')} <small className="muted">{items.filter((u) => u.kind === k).length}</small>
            </button>
          ))}
        </div>
      </div>
      {shown.length ? (
        <div className="uploads-row">
          {shown.map((u) => (
            <button key={u.id} onClick={() => setOpen(u)} aria-label={kind === 'photo' ? t('Uploaded photo', 'Feltöltött fotó') : t('Uploaded design', 'Feltöltött minta')}>
              <img src={u.src} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      ) : (
        <p className="sub small" style={{ margin: '8px 0 0' }}>{kind === 'photo' ? t('No photos yet.', 'Még nincs fotód.') : t('No designs yet.', 'Még nincs mintád.')}</p>
      )}

      <Sheet open={!!open} onClose={() => !busy && setOpen(null)} label={t('Uploaded picture', 'Feltöltött kép')}>
        {open && (
          <div className="del-ask">
            <img className="upload-big" src={open.src} alt="" />
            <p className="sub small">{new Date(open.created_at).toLocaleString(ui.lang === 'hu' ? 'hu-HU' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</p>
            <button className="btn wide" disabled={busy} onClick={() => use(open)}>
              {open.kind === 'photo' ? t('New design on this photo', 'Új terv erre a fotóra') : t('Try this design', 'Ezt a mintát próbálom')}
            </button>
            <button className="btn wide ghost" disabled={busy} onClick={() => remove(open)}>
              {busy ? t('Deleting…', 'Törlés…') : t('Delete', 'Törlés')}
            </button>
          </div>
        )}
      </Sheet>
    </section>
  );
}
