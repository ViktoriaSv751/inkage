'use client';
import { localeOf } from '@/lib/tr';
import type { Dispatch, SetStateAction } from 'react';
import { useApp } from '../../AppProvider';
import { Icon } from '../../ui';
import { Result } from '../../Result';
import { HealDiary, RealVsPreview } from '../AfterCare';
import { huArticle, tx } from '@/lib/i18n';
import { haptic, Preview } from '@/lib/store';
import { placeName } from '../../create/steps';
import { isRemoval } from './shared';
import type { useSavedAging } from './useSavedAging';

/** One saved preview, opened from the grid. */
export function PreviewDetail({
  open,
  setOpen,
  setItems,
  folders,
  update,
  remove,
  again,
  addFolder,
  newFolder,
  setNewFolder,
  newOpen,
  setNewOpen,
  aging,
}: {
  open: Preview;
  setOpen: Dispatch<SetStateAction<Preview | null>>;
  setItems: Dispatch<SetStateAction<Preview[] | null>>;
  folders: string[];
  update: (p: Preview, x: Partial<Preview>) => void;
  remove: (p: Preview) => void;
  again: (p: Preview) => void;
  addFolder: (name: string, target?: Preview) => void;
  newFolder: string;
  setNewFolder: (v: string) => void;
  newOpen: boolean;
  setNewOpen: (v: boolean) => void;
  aging: ReturnType<typeof useSavedAging>;
}) {
  const { ui, me, toast } = useApp();
  const t = (en: string, hu: string) => tx(ui.lang, en, hu);
  return (
    <>
      <div className="detail-top">
        <button className="iconbtn" aria-label={ui.t('common.back')} onClick={() => setOpen(null)}>
          {Icon.back}
        </button>
        <h1>{placeName(open.placement, ui.lang)}</h1>
        <button className="iconbtn" aria-label={t('Delete', 'Törlés')} onClick={() => remove(open)}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13" /></svg>
        </button>
      </div>
      <p className="sub small">
        {new Date(open.created_at).toLocaleDateString(localeOf(ui.lang), { year: 'numeric', month: 'short', day: 'numeric' })} · {open.size}
        {open.source === 'local' && ` · ${t('on this device only', 'csak ezen az eszközön')}`}
      </p>
      <div className="card detail-meta">
        <div className="row" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <b>{open.doneAt ? t(`Got it done · ${new Date(open.doneAt).toLocaleDateString('en-GB')}`, `Megcsináltattam · ${new Date(open.doneAt).toLocaleDateString('hu-HU')}`) : t('Did you get this one?', 'Ezt csináltattad meg?')}</b>
          <button className={`chipbtn ${open.doneAt ? 'on' : ''}`} onClick={() => update(open, { doneAt: open.doneAt ? null : new Date().toISOString() })}>
            {open.doneAt ? t('Undo', 'Visszavon') : t('✓ I got it done', '✓ Megcsináltattam')}
          </button>
        </div>
        <div className="folderbox">
          <div className="folderbox-head">
            <span className="folderbox-ico" aria-hidden="true">📁</span>
            <div>
              <b>{t('Folder', 'Mappa')}</b>
              <small>{open.collection ? t(`In “${open.collection}”`, `Ebben a mappában: „${open.collection}”`) : t('Not in a folder yet', 'Még nincs mappában')}</small>
            </div>
          </div>
          <div className="folderchips">
            {folders.map((f) => {
              const on = open.collection === f;
              return (
                <button
                  key={f}
                  className={`folderchip ${on ? 'on' : ''}`}
                  aria-pressed={on}
                  onClick={() => {
                    update(open, { collection: on ? null : f });
                    haptic();
                    toast(on ? t(`Removed from “${f}”`, `Kivéve a(z) „${f}” mappából`).replace('a(z) ', huArticle(f) + ' ') : t(`Added to “${f}” ✓`, `Hozzáadva a(z) „${f}” mappához ✓`).replace('a(z) ', huArticle(f) + ' '));
                  }}
                >
                  <span aria-hidden="true">{on ? '✓' : '📁'}</span> {f}
                </button>
              );
            })}
            {!newOpen && (
              <button className="folderchip add" onClick={() => setNewOpen(true)}>
                + {t('New folder', 'Új mappa')}
              </button>
            )}
          </div>
          {newOpen && (
            <form
              className="newfolder big"
              onSubmit={(e) => {
                e.preventDefault();
                const n = newFolder.trim();
                if (!n) return;
                addFolder(n, open);
                setNewOpen(false);
                haptic('success');
                toast(t(`Folder “${n}” created and added ✓`, `„${n}” mappa létrehozva, a terv benne van ✓`));
              }}
            >
              <input className="text" id="new-folder" autoFocus placeholder={t('Folder name, e.g. Arm ideas', 'Mappa neve, pl. Kar ötletek')} maxLength={30} value={newFolder} onChange={(e) => setNewFolder(e.target.value)} />
              <button className="btn" disabled={!newFolder.trim()}>{t('Create', 'Létrehoz')}</button>
              <button type="button" className="chipbtn" onClick={() => (setNewOpen(false), setNewFolder(''))}>{t('Cancel', 'Mégse')}</button>
            </form>
          )}
        </div>
        <button className="chipbtn" style={{ marginTop: 10 }} onClick={() => again(open)}>
          {Icon.rotate} {t('New preview with this design', 'Új előnézet ezzel a mintával')}
        </button>
      </div>
      <HealDiary preview={open} />
      <RealVsPreview
        preview={open}
        onChange={(v) => {
          setOpen(v);
          setItems((all) => all?.map((i) => (i.id === v.id ? v : i)) ?? null);
        }}
      />
      <Result
        preview={open}
        onNotes={(notes) => update(open, { notes })}
        onFavorite={() => update(open, { favorite: !open.favorite })}
        onShared={(sid) => {
          const v = { ...open, share_id: sid };
          setOpen(v);
          setItems((all) => all?.map((i) => (i.id === v.id ? v : i)) ?? null);
        }}
        onDone={(d) => update(open, { doneAt: d })}
        startView={isRemoval(open) ? 'removal' : 'aging'}
        gallery
        onAging={open.source === 'cloud' && me.user ? () => void aging.start(open) : undefined}
        pending={aging.pending[open.id] || []}
        failed={aging.failed[open.id] || []}
        onRetryStage={() => void aging.start(open)}
        reveal={aging.wasStarted(open.id)}
      />
    </>
  );
}
