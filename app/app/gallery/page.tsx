'use client';
import { localeOf } from '@/lib/tr';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useApp } from '../AppProvider';
import { Icon, Sheet } from '../ui';
import { Result } from '../Result';
import { HealDiary, RealVsPreview } from './AfterCare';
import { huArticle, tx } from '@/lib/i18n';
import { cloud, haptic, local, lsGet, lsSet, Preview, revokeGuestShare, shares, StageKey, STAGES, track } from '@/lib/store';
import { placeName } from '../create/steps';
import { PollSheet } from '../PollSheet';
import { trErr } from '@/lib/i18n';

// the card shows how it looks now (fresh); the years are one tap away in the detail view
const thumb = (p: Preview) => p.images.fresh || p.images.y10 || p.images.y50 || p.removal?.laser10 || '';
const PAGE = 120;
type Sort = 'new' | 'old' | 'score' | 'place';
type Kind = 'any' | 'new' | 'existing' | 'removal';
const isRemoval = (p: Preview) => p.mode === 'removal' || (!!p.removal && !p.images.y10 && !p.images.y50);

export default function GalleryPage() {
  const { ui, me, openAuth, toast } = useApp();
  const router = useRouter();
  const t = (en: string, hu: string) => tx(ui.lang, en, hu);
  const [items, setItems] = useState<Preview[] | null>(null);
  const [more, setMore] = useState(false);
  const [filter, setFilter] = useState<'all' | 'fav'>('all');
  const [open, setOpen] = useState<Preview | null>(null);
  const [mode, setMode] = useState<'browse' | 'compare' | 'select'>('browse');
  const [cmpOpen, setCmpOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [cmpStage, setCmpStage] = useState<StageKey>('y50');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>(() => lsGet<Sort>('ink_gal_sort', 'new'));
  const [kind, setKind] = useState<Kind>('any');
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
  }, [me.user]);

  useEffect(() => {
    load().then((all) => {
      // a preview linked from the profile page
      const id = new URLSearchParams(location.search).get('id');
      const p = id && all.find((x) => x.id === id);
      if (p) setOpen(p);
    });
    track('gallery_open');
  }, [load]);
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
  const [trash, setTrash] = useState<Preview[]>([]);
  const [trashOpen, setTrashOpen] = useState(false);
  const [restoring, setRestoring] = useState('');
  const loadTrash = useCallback(() => {
    if (me.user) cloud.trash().then(setTrash).catch(() => {});
  }, [me.user]);
  useEffect(() => loadTrash(), [loadTrash]);
  const restore = async (p: Preview) => {
    setRestoring(p.id);
    try {
      if (!(await cloud.restore(p.id))) throw new Error();
      setTrash((x) => x.filter((y) => y.id !== p.id));
      await load();
      haptic('success');
      toast(t('Restored to your gallery', 'Visszaállítva a galériádba'));
    } catch {
      toast(t('Could not restore it. Try again.', 'Nem sikerült visszaállítani. Próbáld újra.'));
    }
    setRestoring('');
  };
  // emptying it is for good, in one tap; a single design can go for good from its own row
  const [purging, setPurging] = useState('');
  const purge = async (ids?: string[]) => {
    setPurging(ids ? ids[0] : 'all');
    try {
      await cloud.purgeTrash(ids);
      const left = ids ? trash.filter((p) => !ids.includes(p.id)) : [];
      setTrash(left);
      if (!left.length) setTrashOpen(false);
      haptic('success');
      toast(ids ? t('Deleted for good', 'Végleg törölve') : t('Recently deleted emptied', 'A Nemrég törölt kiürítve'));
    } catch {
      toast(t('Could not delete it. Try again.', 'Nem sikerült törölni. Próbáld újra.'));
    }
    setPurging('');
  };
  const closeTrash = () => setTrashOpen(false);
  const trashSheet = (
    <Sheet open={trashOpen} onClose={closeTrash} label={t('Recently deleted', 'Nemrég törölt')}>
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
  const delSheet = (
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
  const sortLabel: Record<Sort, string> = { new: t('Newest', 'Legújabb'), old: t('Oldest', 'Legrégebbi'), score: t('Best score', 'Legjobb pontszám'), place: t('Body area', 'Testrész') };

  return (
    <>
      <div className="gal-head">
        <div>
          <p className="kicker">{items ? `${items.length}${more ? '+' : ''} ${t('saved', 'mentve')}` : '…'}</p>
          <h1 style={{ margin: 0 }}>{ui.t('gallery.title')}</h1>
        </div>
        {items && items.length > 0 && (
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

      {!me.user && items && items.length > 0 && (
        <button className="banner" style={{ marginTop: 12 }} onClick={() => openAuth()}>
          {t('These are saved on this device only. Sign in to keep them safe and use them everywhere →', 'Ezek csak ezen az eszközön vannak. Jelentkezz be, hogy biztonságban legyenek és mindenhol elérd →')}
        </button>
      )}

      {items && items.length > 0 && (
        <div className="seg" style={{ marginTop: 14 }} role="radiogroup">
          <button role="radio" aria-checked={filter === 'all'} className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>
            {ui.t('gallery.all')}
          </button>
          <button role="radio" aria-checked={filter === 'fav'} className={filter === 'fav' ? 'on' : ''} onClick={() => setFilter('fav')}>
            ♥ {ui.t('gallery.favorites')} {items.some((p) => p.favorite) ? `(${items.filter((p) => p.favorite).length})` : ''}
          </button>
        </div>
      )}

      {items && items.length > 1 && (
        <div className="galtools">
          <input className="text" type="search" id="gal-search" placeholder={t('Search: body area, notes, folder…', 'Keresés: testrész, jegyzet, mappa…')} value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            <label className="sortsel">
              <span className="sr-only">{t('Sort', 'Rendezés')}</span>
              <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
                {(Object.keys(sortLabel) as Sort[]).map((k) => (
                  <option key={k} value={k}>
                    {sortLabel[k]}
                  </option>
                ))}
              </select>
            </label>
            {(['any', 'new', 'existing', 'removal'] as const).map((k) => (
              <button key={k} className={`chip ${kind === k ? 'on' : ''}`} onClick={() => setKind(k)}>
                {k === 'any' ? t('All types', 'Mind') : k === 'new' ? t('New designs', 'Új minták') : k === 'existing' ? t('My tattoos', 'Meglévő tetoválásaim') : t('Removal', 'Eltávolítás')}
              </button>
            ))}
          </div>
        </div>
      )}
      {items && items.length > 0 && (
        <div className="row" style={{ gap: 6, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {folders.length > 0 && (
            <button className={`chip ${!folder ? 'on' : ''}`} onClick={() => setFolder(null)}>
              {t('All folders', 'Minden mappa')}
            </button>
          )}
          {folders.map((f) => (
            <button key={f} className={`chip ${folder === f ? 'on' : ''}`} onClick={() => setFolder(folder === f ? null : f)}>
              📁 {f} <small className="muted">{(items || []).filter((p) => p.collection === f).length}</small>
            </button>
          ))}
          <button className="chip ghostchip" onClick={() => setFoldersOpen(true)}>
            {folders.length ? t('Manage folders', 'Mappák kezelése') : t('+ Folder', '+ Mappa')}
          </button>
        </div>
      )}

      {items && items.length > 0 && shown.length === 0 &&
        (filter === 'fav' && !q && !folder && kind === 'any' ? (
          <div className="pf-empty" style={{ marginTop: 16 }}>
            <b>{t('No favorites yet', 'Még nincs kedvenced')}</b>
            <p>{t('Tap the heart on any preview — here in the grid or inside it — and it shows up here.', 'Koppints a szívre bármelyik előnézeten – itt a rácsban vagy megnyitva –, és itt fog megjelenni.')}</p>
            <button className="btn ghost" onClick={() => setFilter('all')}>
              {t('Show all', 'Az összes mutatása')}
            </button>
          </div>
        ) : (
          <p className="sub" style={{ marginTop: 16 }}>{t('Nothing matches. Try another search or filter.', 'Nincs találat. Próbálj más keresést vagy szűrőt.')}</p>
        ))}

      {mode === 'compare' && (
        <div className="selbar">
          <p className="sub small" style={{ margin: 0 }}>{t('Pick 2 or 3 previews to compare.', 'Válassz ki 2 vagy 3 előnézetet az összehasonlításhoz.')}</p>
          <button className="btn" disabled={picked.length < 2} onClick={() => setCmpOpen(true)}>
            {t('Compare', 'Összevet')} ({picked.length})
          </button>
        </div>
      )}
      {mode === 'select' && (
        <div className="selbar">
          <p className="sub small" style={{ margin: 0 }}>
            {picked.length ? t(`${picked.length} selected`, `${picked.length} kijelölve`) : t('Tap previews to select them.', 'Koppints az előnézetekre a kijelöléshez.')}
          </p>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            <button className="chipbtn" onClick={() => setPicked(picked.length === shown.length ? [] : shown.map((p) => p.id))}>
              {picked.length === shown.length ? t('None', 'Egyik sem') : t('All', 'Mind')}
            </button>
            <button className="chipbtn" disabled={!picked.length} onClick={() => updateMany(pickedItems, { favorite: !pickedItems.every((p) => p.favorite) })}>
              ♥ {pickedItems.length && pickedItems.every((p) => p.favorite) ? t('Unfavorite', 'Kedvenc ki') : t('Favorite', 'Kedvenc')}
            </button>
            <button className="chipbtn" disabled={!picked.length} onClick={() => setMoveOpen(true)}>
              📁 {t('Move', 'Mappába')}
            </button>
            <button className="chipbtn danger" disabled={!picked.length} onClick={removePicked}>
              {t('Delete', 'Törlés')}
            </button>
          </div>
        </div>
      )}

      {items === null ? (
        <div className="galgrid">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="tile ph" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="gal-empty">
          <span className="gal-empty-ico" aria-hidden="true">
            <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><path d="M16.5 13.5v6M13.5 16.5h6" /></svg>
          </span>
          <h2>{t('No previews yet', 'Még nincs előnézeted')}</h2>
          <p className="sub">{ui.t('gallery.empty')}</p>
          <ol className="gal-steps">
            <li><b>1</b>{t('Take a photo of the spot', 'Fotózd le a helyet')}</li>
            <li><b>2</b>{t('Add any design', 'Adj hozzá egy mintát')}</li>
            <li><b>3</b>{t('See it at 10, 30 and 50 years', 'Nézd meg 10, 30 és 50 év múlva')}</li>
          </ol>
          <Link className="btn" href="/app">
            {ui.t('nav.create')}
          </Link>
        </div>
      ) : (
        <div className="galgrid">
          {shown.map((p) => {
            const n = picked.indexOf(p.id);
            return (
              <div key={p.id} className={`tile ${n >= 0 ? 'pick' : ''} ${mode === 'select' ? 'selmode' : ''}`} data-n={mode === 'compare' ? n + 1 : '✓'}>
                <button
                  className="tile-hit"
                  onClick={() => {
                    if (mode === 'browse') return setOpen(p);
                    if (n >= 0) setPicked(picked.filter((x) => x !== p.id));
                    else if (mode === 'select' || picked.length < 3) setPicked([...picked, p.id]);
                  }}
                  aria-pressed={mode !== 'browse' ? n >= 0 : undefined}
                  aria-label={`${placeName(p.placement, ui.lang)}, ${t('score', 'pontszám')} ${p.score ?? '–'}`}
                >
                  {thumb(p) && <img src={thumb(p)} alt="" loading="lazy" onError={onImgError} />}
                  {p.design && <img className="tile-design" src={p.design} alt="" loading="lazy" />}
                  {p.doneAt && <span className="donebadge">✓ {t('Done', 'Kész')}</span>}
                  {p.source === 'local' && <span className="local">{t('Device', 'Eszköz')}</span>}
                  {isRemoval(p) && <span className="rmbadge">{t('Laser', 'Lézer')}</span>}
                  <span className="meta">
                    <span>
                      {placeName(p.placement, ui.lang)}
                      {p.collection ? <small> · {p.collection}</small> : null}
                    </span>
                    {p.score !== null && <b>{p.score}</b>}
                  </span>
                </button>
                {mode === 'browse' && (
                  <button className={`tile-fav ${p.favorite ? 'on' : ''}`} aria-label={p.favorite ? t('Remove from favorites', 'Kivétel a kedvencek közül') : t('Add to favorites', 'Kedvencekhez')} aria-pressed={p.favorite} onClick={() => update(p, { favorite: !p.favorite })}>
                    {Icon.heart}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
      {more && (
        <button className="btn ghost wide" style={{ marginTop: 16 }} onClick={loadMore}>
          {t('Load more', 'Továbbiak betöltése')}
        </button>
      )}

      <Sheet open={foldersOpen} onClose={() => (setFoldersOpen(false), setRename(null))} label={t('Folders', 'Mappák')}>
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

      <Sheet open={moveOpen} onClose={() => setMoveOpen(false)} label={t('Move to folder', 'Mappába helyezés')}>
        <h2>{t('Move to folder', 'Mappába helyezés')}</h2>
        <div className="folderlist">
          {folders.map((f) => (
            <button
              key={f}
              className="list-row"
              onClick={async () => {
                setMoveOpen(false);
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
              setMoveOpen(false);
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
            setMoveOpen(false);
            await updateMany(pickedItems, { collection: n });
          }}
        >
          <input className="text" placeholder={t('New folder', 'Új mappa')} maxLength={30} value={newFolder} onChange={(e) => setNewFolder(e.target.value)} />
          <button className="btn" disabled={!newFolder.trim()}>
            {t('Create and move', 'Létrehozás és áthelyezés')}
          </button>
        </form>
      </Sheet>

      <Sheet open={mode === 'compare' && cmpOpen && pair.length >= 2} onClose={() => setCmpOpen(false)} label={t('Compare', 'Összehasonlítás')}>
        <h2>{t('Compare', 'Összehasonlítás')}</h2>
        <div className="seg" role="radiogroup" style={{ justifySelf: 'start', flexWrap: 'wrap' }}>
          {STAGES.map((k) => (
            <button key={k} role="radio" aria-checked={cmpStage === k} className={cmpStage === k ? 'on' : ''} onClick={() => setCmpStage(k)}>
              {ui.t(`stage.${k}` as any)}
            </button>
          ))}
        </div>
        <div className={`cmp ${pair.length === 3 ? 'three' : ''}`}>
          {pair.map((p) => (
            <figure key={p.id}>
              <img src={p.images[cmpStage] || p.images.fresh} alt={placeName(p.placement, ui.lang)} />
              <figcaption>
                {placeName(p.placement, ui.lang)} · {p.score ?? '–'}/100
              </figcaption>
            </figure>
          ))}
        </div>
        {pair.length >= 2 && (
          <button className="btn wide" style={{ marginTop: 6 }} onClick={() => setPollOpen(true)}>
            {t('Ask friends: which one?', 'Kérdezd meg a barátaidat: melyik legyen?')}
          </button>
        )}
        {pair.length >= 2 && pair.every((p) => p.score !== null) && new Set(pair.map((p) => p.score)).size > 1 && (() => {
          const best = pair.reduce((a, b) => ((a.score || 0) >= (b.score || 0) ? a : b));
          return (
            <p className="sub">
              {t(`The ${placeName(best.placement, 'en').toLowerCase()} version should age best (${best.score}/100).`, `${huArticle(placeName(best.placement, 'hu')) === 'az' ? 'Az' : 'A'} ${placeName(best.placement, 'hu').toLowerCase()} változat öregszik várhatóan a legjobban (${best.score}/100).`)}
            </p>
          );
        })()}
      </Sheet>
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
