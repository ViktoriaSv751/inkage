'use client';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useApp } from '../AppProvider';
import { Uploads } from './Uploads';
import { Ideas } from './Ideas';
import { tx } from '@/lib/i18n';
import { cloud, haptic, local, lsGet, lsSet, Preview, revokeGuestShare, shares, StageKey, track } from '@/lib/store';
import { placeName } from '../create/steps';
import { PollSheet } from '../PollSheet';
import { isRemoval, Kind, Mode, PAGE, Sort } from './_parts/shared';
import { useTrash } from './_parts/useTrash';
import { TrashSheet } from './_parts/TrashSheet';
import { DeleteSheet } from './_parts/DeleteSheet';
import { PreviewDetail } from './_parts/PreviewDetail';
import { useSavedAging } from './_parts/useSavedAging';
import { GalleryFilters } from './_parts/GalleryFilters';
import { SelectionBars } from './_parts/SelectionBars';
import { PreviewGrid } from './_parts/PreviewGrid';
import { FoldersSheet, MoveSheet } from './_parts/FolderSheets';
import { CompareSheet } from './_parts/CompareSheet';

export default function GalleryPage() {
  const { ui, me, openAuth, toast } = useApp();
  const router = useRouter();
  const t = (en: string, hu: string) => tx(ui.lang, en, hu);
  const [items, setItems] = useState<Preview[] | null>(null);
  const [more, setMore] = useState(false);
  const [filter, setFilter] = useState<'all' | 'fav'>('all');
  const [open, setOpen] = useState<Preview | null>(null);
  const aging = useSavedAging(setOpen, setItems);
  const [mode, setMode] = useState<Mode>('browse');
  const [cmpOpen, setCmpOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [cmpStage, setCmpStage] = useState<StageKey>('fresh');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>(() => lsGet<Sort>('ink_gal_sort', 'new'));
  const [kind, setKind] = useState<Kind>('any');
  // previews, or the tattoo ideas saved for later (/app/gallery?view=ideas opens them)
  const [view, setView] = useState<'previews' | 'ideas'>('previews');
  useEffect(() => {
    if (new URLSearchParams(location.search).get('view') === 'ideas') setView('ideas');
  }, []);
  const pickView = (v: 'previews' | 'ideas') => {
    setView(v);
    try {
      const u = new URL(location.href);
      if (v === 'ideas') u.searchParams.set('view', 'ideas');
      else u.searchParams.delete('view');
      history.replaceState(history.state, '', u.toString());
    } catch {}
  };
  const [pollOpen, setPollOpen] = useState(false);
  const [folder, setFolder] = useState<string | null>(null);
  const [newFolder, setNewFolder] = useState('');
  const [foldersOpen, setFoldersOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [extraFolders, setExtraFolders] = useState<string[]>(() => lsGet<string[]>('ink_folders', []));
  const [rename, setRename] = useState<{ from: string; to: string } | null>(null);
  const folders = Array.from(new Set([...(items || []).map((p) => p.collection).filter(Boolean), ...extraFolders] as string[])).sort((a, b) => a.localeCompare(b));
  const reloading = useRef(false);

  const load = useCallback(async () => {
    const [c, l] = await Promise.all([me.user ? cloud.all(0, PAGE).catch(() => []) : Promise.resolve([]), local.all().catch(() => [])]);
    setMore(c.length === PAGE);
    setItems([...l, ...c].sort((a, b) => b.created_at.localeCompare(a.created_at)));
    return [...l, ...c];
    // the account id, not the object: every profile refresh made a new me.user and loaded (and counted) the gallery again
  }, [me.user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load().then((all) => {
      // a preview linked from the profile page
      const id = new URLSearchParams(location.search).get('id');
      const p = id && all.find((x) => x.id === id);
      if (p) setOpen(p);
    });
  }, [load]);
  useEffect(() => track('gallery_open'), []);
  // opening a design (or going back to the grid) starts at the top of that view
  useLayoutEffect(() => {
    // 'instant': the page has smooth scrolling on, which would stop halfway while the images load
    const top = () => window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
    top();
    const r = requestAnimationFrame(top);
    const id = setTimeout(top, 120);
    return () => (cancelAnimationFrame(r), clearTimeout(id));
  }, [open?.id]);
  useEffect(() => lsSet('ink_gal_sort', sort), [sort]);
  useEffect(() => lsSet('ink_folders', extraFolders), [extraFolders]);

  const loadMore = async () => {
    const c = await cloud.all((items || []).filter((p) => p.source === 'cloud').length, PAGE).catch(() => []);
    setMore(c.length === PAGE);
    setItems((all) => [...(all || []), ...c.filter((x) => !all?.some((y) => y.id === x.id))]);
  };
  // signed image links expire after a day; reload once if one fails
  const onImgError = () => {
    if (reloading.current || !me.user) return;
    reloading.current = true;
    load()
      .then((all) => setOpen((o) => (o && all.find((x) => x.id === o.id)) || o))
      .finally(() => setTimeout(() => (reloading.current = false), 30000));
  };

  /** Save a change; for account previews undo it on screen if the server refuses. */
  const update = async (p: Preview, x: Partial<Preview>) => {
    const next = { ...p, ...x };
    const put = (v: Preview) => {
      setItems((all) => all?.map((i) => (i.id === p.id ? v : i)) ?? null);
      setOpen((o) => (o?.id === p.id ? v : o));
    };
    put(next);
    try {
      if (p.source === 'cloud') await cloud.update(p.id, { notes: next.notes, favorite: next.favorite, collection: next.collection, done_at: next.doneAt ?? null });
      else await local.put(next);
    } catch {
      put(p);
      toast(t('Could not save the change. Check your connection and try again.', 'Nem sikerült menteni. Ellenőrizd a kapcsolatot, és próbáld újra.'));
    }
  };
  const updateMany = async (list: Preview[], x: Partial<Preview>) => {
    for (const p of list) await update(p, x);
  };

  /** Delete for real: images, vote links and Explore posts too. */
  const destroy = async (p: Preview) => {
    if (p.source === 'cloud') {
      if (!me.user) throw new Error('auth');
      await cloud.remove(me.user.id, p.id);
    } else await local.remove(p.id);
    for (const s of shares.forPreview(p.id)) if (s.kind !== 'preview') await revokeGuestShare(s.id).catch(() => false);
    shares.all().filter((s) => s.previewId === p.id).forEach((s) => shares.drop(s.id));
  };
  // deleting asks first, in a clear confirm sheet with the pictures that will go
  const [delAsk, setDelAsk] = useState<Preview[] | null>(null);
  const [delBusy, setDelBusy] = useState(false);
  const remove = (p: Preview) => setDelAsk([p]);
  const removePicked = () => {
    const list = (items || []).filter((p) => picked.includes(p.id));
    if (list.length) setDelAsk(list);
  };
  // Recently deleted: nothing is lost by accident
  const { trash, trashOpen, setTrashOpen, closeTrash, restoring, restore, purging, purge, loadTrash } = useTrash(load);
  const trashSheet = <TrashSheet open={trashOpen} onClose={closeTrash} trash={trash} restoring={restoring} purging={purging} restore={restore} purge={purge} />;
  const doDelete = async () => {
    const list = delAsk || [];
    if (!list.length) return;
    setDelBusy(true);
    let ok = 0;
    for (const p of list) {
      try {
        await destroy(p);
        ok++;
      } catch {}
    }
    setDelBusy(false);
    setDelAsk(null);
    const gone = new Set(list.map((p) => p.id));
    setItems((all) => all?.filter((i) => !gone.has(i.id)) ?? null);
    if (open && gone.has(open.id)) setOpen(null);
    if (list.length > 1) {
      await load();
      setPicked([]);
      setMode('browse');
    }
    loadTrash();
    if (!ok) return toast(t('Could not delete it. Try again.', 'Nem sikerült törölni. Próbáld újra.'));
    haptic('success');
    toast(list.length > 1 ? t(`${ok} designs deleted`, `${ok} terv törölve`) : t('Moved to Recently deleted', 'Áthelyezve a Nemrég törölt részbe'));
  };
  const delSheet = <DeleteSheet delAsk={delAsk} delBusy={delBusy} setDelAsk={setDelAsk} doDelete={doDelete} />;

  /** Start a new preview with the same design and body area. */
  const again = (p: Preview) => {
    lsSet('ink_redo', { design: p.design || null, colorMode: p.colorMode || 'black', placement: p.placement, mode: p.mode === 'removal' ? 'removal' : p.mode === 'existing' ? 'existing' : 'new' });
    track('gallery_again');
    try {
      sessionStorage.setItem('ink_fresh', '1');
    } catch {}
    router.push('/app');
  };

  const addFolder = (name: string, target?: Preview) => {
    const n = name.trim().slice(0, 30);
    if (!n) return;
    if (!folders.includes(n)) setExtraFolders((f) => [...f, n]);
    if (target) update(target, { collection: n });
    setNewFolder('');
  };
  const renameFolder = async (from: string, to: string) => {
    const n = to.trim().slice(0, 30);
    if (!n || n === from) return setRename(null);
    setExtraFolders((f) => [...f.filter((x) => x !== from), n]);
    await updateMany((items || []).filter((p) => p.collection === from), { collection: n });
    if (folder === from) setFolder(n);
    setRename(null);
  };
  const deleteFolder = async (name: string) => {
    setExtraFolders((f) => f.filter((x) => x !== name));
    await updateMany((items || []).filter((p) => p.collection === name), { collection: null });
    if (folder === name) setFolder(null);
    toast(t('Folder removed — the previews stay', 'Mappa törölve – az előnézetek megmaradnak'));
  };

  if (open)
    return (
      <>
        <PreviewDetail
          open={open}
          setOpen={setOpen}
          setItems={setItems}
          folders={folders}
          update={update}
          remove={remove}
          again={again}
          addFolder={addFolder}
          newFolder={newFolder}
          setNewFolder={setNewFolder}
          newOpen={newOpen}
          setNewOpen={setNewOpen}
          aging={aging}
        />
        {delSheet}
      </>
    );

  const norm = (x: string) => x.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const shown = (items || [])
    .filter((p) => filter === 'all' || p.favorite)
    .filter((p) => !folder || p.collection === folder)
    .filter((p) => kind === 'any' || (kind === 'removal' ? isRemoval(p) : kind === 'existing' ? p.mode === 'existing' && !isRemoval(p) : p.mode !== 'existing' && !isRemoval(p)))
    .filter((p) => !q.trim() || norm(`${placeName(p.placement, ui.lang)} ${p.placement} ${p.notes || ''} ${p.size || ''} ${p.collection || ''}`).includes(norm(q.trim())))
    .sort((a, b) =>
      sort === 'score'
        ? (b.score ?? -1) - (a.score ?? -1)
        : sort === 'old'
          ? a.created_at.localeCompare(b.created_at)
          : sort === 'place'
            ? placeName(a.placement, ui.lang).localeCompare(placeName(b.placement, ui.lang), ui.lang)
            : b.created_at.localeCompare(a.created_at)
    );
  const pair = picked.map((id) => items?.find((p) => p.id === id)).filter(Boolean) as Preview[];
  const pickedItems = (items || []).filter((p) => picked.includes(p.id));

  return (
    <>
      <div className="gal-head">
        <div>
          <p className="kicker">{items ? `${items.length}${more ? '+' : ''} ${t('saved', 'mentve')}` : '…'}</p>
          <h1 style={{ margin: 0 }}>{ui.t('gallery.title')}</h1>
        </div>
        {view === 'previews' && items && items.length > 0 && (
          <div className="row" style={{ gap: 6 }}>
            {items.length > 1 && (
              <button
                className={`chipbtn ${mode === 'compare' ? 'on' : ''}`}
                onClick={() => {
                  setMode(mode === 'compare' ? 'browse' : 'compare');
                  setPicked([]);
                }}
              >
                {mode === 'compare' ? ui.t('common.cancel') : t('Compare', 'Összehasonlítás')}
              </button>
            )}
            <button
              className={`chipbtn ${mode === 'select' ? 'on' : ''}`}
              onClick={() => {
                setMode(mode === 'select' ? 'browse' : 'select');
                setPicked([]);
              }}
            >
              {mode === 'select' ? ui.t('common.cancel') : t('Select', 'Kijelölés')}
            </button>
          </div>
        )}
      </div>

      <div className="seg galview" role="radiogroup" aria-label={t('Show', 'Mutasd')} style={{ marginTop: 12 }}>
        <button role="radio" aria-checked={view === 'previews'} className={view === 'previews' ? 'on' : ''} onClick={() => pickView('previews')}>
          {t('Previews', 'Előnézetek')}
        </button>
        <button role="radio" aria-checked={view === 'ideas'} className={view === 'ideas' ? 'on' : ''} onClick={() => pickView('ideas')}>
          💡 {t('Ideas', 'Ötletek')}
        </button>
      </div>

      {view === 'ideas' ? (
        <Ideas />
      ) : (
      <>
      <Uploads />

      {!me.user && items && items.length > 0 && (
        <button className="banner" style={{ marginTop: 12 }} onClick={() => openAuth()}>
          {t('These are saved on this device only. Sign in to keep them safe and use them everywhere →', 'Ezek csak ezen az eszközön vannak. Jelentkezz be, hogy biztonságban legyenek és mindenhol elérd →')}
        </button>
      )}

      <GalleryFilters
        items={items}
        shownCount={shown.length}
        filter={filter}
        setFilter={setFilter}
        q={q}
        setQ={setQ}
        sort={sort}
        setSort={setSort}
        kind={kind}
        setKind={setKind}
        folder={folder}
        setFolder={setFolder}
        folders={folders}
        onIdeas={() => pickView('ideas')}
        onManageFolders={() => setFoldersOpen(true)}
      />

      <SelectionBars
        mode={mode}
        picked={picked}
        setPicked={setPicked}
        shown={shown}
        pickedItems={pickedItems}
        onCompare={() => setCmpOpen(true)}
        onFavorite={() => updateMany(pickedItems, { favorite: !pickedItems.every((p) => p.favorite) })}
        onMove={() => setMoveOpen(true)}
        onDelete={removePicked}
      />

      <PreviewGrid items={items} shown={shown} mode={mode} picked={picked} setPicked={setPicked} setOpen={setOpen} update={update} onImgError={onImgError} />
      {more && (
        <button className="btn ghost wide" style={{ marginTop: 16 }} onClick={loadMore}>
          {t('Load more', 'Továbbiak betöltése')}
        </button>
      )}
      </>
      )}

      <FoldersSheet
        open={foldersOpen}
        onClose={() => (setFoldersOpen(false), setRename(null))}
        items={items}
        folders={folders}
        newFolder={newFolder}
        setNewFolder={setNewFolder}
        addFolder={addFolder}
        rename={rename}
        setRename={setRename}
        renameFolder={renameFolder}
        deleteFolder={deleteFolder}
      />

      <MoveSheet open={moveOpen} onClose={() => setMoveOpen(false)} folders={folders} pickedItems={pickedItems} updateMany={updateMany} newFolder={newFolder} setNewFolder={setNewFolder} addFolder={addFolder} />

      <CompareSheet open={mode === 'compare' && cmpOpen && pair.length >= 2} onClose={() => setCmpOpen(false)} pair={pair} cmpStage={cmpStage} setCmpStage={setCmpStage} onPoll={() => setPollOpen(true)} />
      <PollSheet open={pollOpen} onClose={() => setPollOpen(false)} initial={pair} />
      {delSheet}
      {trashSheet}
      {trash.length > 0 && (
        <p style={{ textAlign: 'center', margin: '18px 0 8px' }}>
          <button className="chipbtn" onClick={() => setTrashOpen(true)}>
            🗑 {t(`Recently deleted (${trash.length})`, `Nemrég törölt (${trash.length})`)}
          </button>{' '}
          <button className="chipbtn danger" onClick={() => purge()} disabled={!!purging}>
            {purging === 'all' ? t('Deleting…', 'Törlés…') : t('Empty it', 'Kiürítés')}
          </button>
        </p>
      )}
    </>
  );
}
