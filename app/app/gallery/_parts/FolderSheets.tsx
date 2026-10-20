'use client';
import { useApp } from '../../AppProvider';
import { Sheet } from '../../ui';
import { tx } from '@/lib/i18n';
import type { Preview } from '@/lib/store';

/** Create, rename and remove folders. */
export function FoldersSheet({
  open,
  onClose,
  items,
  folders,
  newFolder,
  setNewFolder,
  addFolder,
  rename,
  setRename,
  renameFolder,
  deleteFolder,
}: {
  open: boolean;
  onClose: () => void;
  items: Preview[] | null;
  folders: string[];
  newFolder: string;
  setNewFolder: (v: string) => void;
  addFolder: (name: string) => void;
  rename: { from: string; to: string } | null;
  setRename: (v: { from: string; to: string } | null) => void;
  renameFolder: (from: string, to: string) => void;
  deleteFolder: (name: string) => void;
}) {
  const { ui } = useApp();
  const t = (en: string, hu: string) => tx(ui.lang, en, hu);
  return (
    <Sheet open={open} onClose={onClose} label={t('Folders', 'Mappák')}>
      <h2>{t('Folders', 'Mappák')}</h2>
      <form
        className="newfolder"
        onSubmit={(e) => {
          e.preventDefault();
          addFolder(newFolder);
        }}
      >
        <input className="text" id="folder-add" placeholder={t('New folder name', 'Új mappa neve')} maxLength={30} value={newFolder} onChange={(e) => setNewFolder(e.target.value)} />
        <button className="btn" disabled={!newFolder.trim()}>
          {t('Create', 'Létrehozás')}
        </button>
      </form>
      <div className="folderlist">
        {folders.length === 0 && <p className="sub small">{t('No folders yet.', 'Még nincs mappa.')}</p>}
        {folders.map((f) => (
          <div key={f} className="folderitem">
            {rename?.from === f ? (
              <form
                className="newfolder"
                onSubmit={(e) => {
                  e.preventDefault();
                  renameFolder(f, rename.to);
                }}
              >
                <input className="text" autoFocus maxLength={30} value={rename.to} onChange={(e) => setRename({ from: f, to: e.target.value })} aria-label={t('Folder name', 'Mappa neve')} />
                <button className="chipbtn">{t('Save', 'Mentés')}</button>
              </form>
            ) : (
              <>
                <span>
                  📁 <b>{f}</b> <small className="muted">{(items || []).filter((p) => p.collection === f).length}</small>
                </span>
                <span className="row" style={{ gap: 6 }}>
                  <button className="chipbtn" onClick={() => setRename({ from: f, to: f })}>
                    {t('Rename', 'Átnevezés')}
                  </button>
                  <button className="chipbtn" onClick={() => deleteFolder(f)}>
                    {t('Remove', 'Törlés')}
                  </button>
                </span>
              </>
            )}
          </div>
        ))}
      </div>
    </Sheet>
  );
}

/** Move the selected previews into a folder (or out of every folder). */
export function MoveSheet({
  open,
  onClose,
  folders,
  pickedItems,
  updateMany,
  newFolder,
  setNewFolder,
  addFolder,
}: {
  open: boolean;
  onClose: () => void;
  folders: string[];
  pickedItems: Preview[];
  updateMany: (list: Preview[], x: Partial<Preview>) => Promise<void>;
  newFolder: string;
  setNewFolder: (v: string) => void;
  addFolder: (name: string) => void;
}) {
  const { ui, toast } = useApp();
  const t = (en: string, hu: string) => tx(ui.lang, en, hu);
  return (
    <Sheet open={open} onClose={onClose} label={t('Move to folder', 'Mappába helyezés')}>
      <h2>{t('Move to folder', 'Mappába helyezés')}</h2>
      <div className="folderlist">
        {folders.map((f) => (
          <button
            key={f}
            className="list-row"
            onClick={async () => {
              onClose();
              await updateMany(pickedItems, { collection: f });
              toast(t(`Moved to ${f}`, `Áthelyezve: ${f}`));
            }}
          >
            <span>📁 {f}</span>
            <span aria-hidden="true">›</span>
          </button>
        ))}
        <button
          className="list-row"
          onClick={async () => {
            onClose();
            await updateMany(pickedItems, { collection: null });
          }}
        >
          <span>{t('No folder', 'Mappa nélkül')}</span>
          <span aria-hidden="true">›</span>
        </button>
      </div>
      <form
        className="newfolder"
        style={{ marginTop: 12 }}
        onSubmit={async (e) => {
          e.preventDefault();
          const n = newFolder.trim();
          if (!n) return;
          addFolder(n);
          onClose();
          await updateMany(pickedItems, { collection: n });
        }}
      >
        <input className="text" placeholder={t('New folder', 'Új mappa')} maxLength={30} value={newFolder} onChange={(e) => setNewFolder(e.target.value)} />
        <button className="btn" disabled={!newFolder.trim()}>
          {t('Create and move', 'Létrehozás és áthelyezés')}
        </button>
      </form>
    </Sheet>
  );
}
