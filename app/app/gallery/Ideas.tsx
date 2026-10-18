'use client';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useApp } from '../AppProvider';
import { Sheet } from '../ui';
import { IdeaSheet } from '../create/IdeaSheet';
import { tx } from '@/lib/i18n';
import { haptic, lsSet, track } from '@/lib/store';
import { Upload, uploads, USE_UPLOAD_KEY } from '@/lib/uploads';

/** The gallery's Ideas: tattoo pictures saved for later (from the photo library or a link), on the account. */
export function Ideas() {
  const { ui, me, toast } = useApp();
  const router = useRouter();
  const t = (en: string, hu: string) => tx(ui.lang, en, hu);
  const [items, setItems] = useState<Upload[] | null>(null);
  const [open, setOpen] = useState<Upload | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const load = useCallback(() => {
    if (!me.user) return setItems([]);
    uploads.list('idea', 300).then(setItems, () => setItems([]));
  }, [me.user]);
  useEffect(() => load(), [load]);

  const show = (u: Upload) => {
    setOpen(u);
    setNote(u.note || '');
  };
  /** Try it on: the idea goes onto the design slot of a new preview. */
  const tryIt = (u: Upload) => {
    lsSet(USE_UPLOAD_KEY, { kind: 'design', src: u.src });
    track('idea_try');
    try {
      sessionStorage.setItem('ink_fresh', '1');
    } catch {}
    router.push('/app');
  };
  const saveNote = async (u: Upload) => {
    if ((u.note || '') === note.trim()) return;
    try {
      await uploads.setNote(u.id, note);
      setItems((all) => all?.map((x) => (x.id === u.id ? { ...x, note: note.trim() || null } : x)) ?? null);
    } catch {
      toast(t('Could not save the note. Try again.', 'Nem sikerült menteni a megjegyzést. Próbáld újra.'));
    }
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
  const host = (url?: string | null) => {
    try {
      return url ? new URL(url).hostname.replace(/^www\./, '') : '';
    } catch {
      return '';
    }
  };

  return (
    <section className="ideas" aria-label={t('Ideas', 'Ötletek')}>
      <button type="button" className="idea-btn" onClick={() => setAddOpen(true)}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
        <span>
          <b>{t('Save a new idea', 'Új ötlet mentése')}</b>
          <small>{t('From your photos or a link (Pinterest, Instagram…)', 'Fotótárból vagy linkről (Pinterest, Instagram…)')}</small>
        </span>
      </button>

      {items === null ? (
        <div className="ideas-grid">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="tile ph" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="pf-empty" style={{ marginTop: 14 }}>
          <b>{t('No ideas yet', 'Még nincs ötleted')}</b>
          <p>{t('Saw a tattoo you like? Save the picture or its link here, so it is with you at the studio — on every device.', 'Láttál egy tetoválást, ami tetszik? Mentsd ide a képet vagy a linkjét, így a szalonban is nálad lesz – minden eszközön.')}</p>
        </div>
      ) : (
        <div className="ideas-grid">
          {items.map((u) => (
            <button key={u.id} className="idea-tile" onClick={() => show(u)} aria-label={u.note || t('Tattoo idea', 'Tetoválás-ötlet')}>
              <img src={u.src} alt="" loading="lazy" />
              {u.note && <span className="idea-note">{u.note}</span>}
            </button>
          ))}
        </div>
      )}

      <Sheet open={!!open} onClose={() => (open && saveNote(open), !busy && setOpen(null))} label={t('Tattoo idea', 'Tetoválás-ötlet')}>
        {open && (
          <div className="idea-preview">
            <img src={open.src} alt="" />
            <small className="muted idea-src">
              {new Date(open.created_at).toLocaleDateString(ui.lang === 'hu' ? 'hu-HU' : 'en-GB', { dateStyle: 'medium' })}
              {open.sourceUrl && (
                <>
                  {' · '}
                  <a href={open.sourceUrl} target="_blank" rel="noopener noreferrer">
                    {host(open.sourceUrl)}
                  </a>
                </>
              )}
            </small>
            <input className="text" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} onBlur={() => saveNote(open)} placeholder={t('A note: where, how big, why…', 'Megjegyzés: hová, mekkora, miért…')} aria-label={t('Note', 'Megjegyzés')} />
            <button className="btn wide" disabled={busy} onClick={() => (saveNote(open), tryIt(open))}>
              {t('Try it on my photo', 'Kipróbálom a fotómon')}
            </button>
            <button className="btn wide ghost" disabled={busy} onClick={() => remove(open)}>
              {busy ? t('Deleting…', 'Törlés…') : t('Delete', 'Törlés')}
            </button>
          </div>
        )}
      </Sheet>

      <IdeaSheet
        open={addOpen}
        onClose={() => {
          setAddOpen(false);
          load();
        }}
      />
    </section>
  );
}
