'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useApp } from '../AppProvider';
import { Icon, Sheet } from '../ui';
import { Result } from '../Result';
import { tx } from '@/lib/i18n';
import { cloud, local, Preview, StageKey, track } from '@/lib/store';
import { placeName } from '../create/steps';
import { abShare, shareVoteLink } from '@/lib/share';
import { trErr } from '@/lib/i18n';

const thumb = (p: Preview) => p.images.y50 || p.images.y30 || p.images.fresh || '';

export default function GalleryPage() {
  const { ui, me, openAuth, toast } = useApp();
  const t = (en: string, hu: string) => tx(ui.lang, en, hu);
  const [items, setItems] = useState<Preview[] | null>(null);
  const [filter, setFilter] = useState<'all' | 'fav'>('all');
  const [open, setOpen] = useState<Preview | null>(null);
  const [comparing, setComparing] = useState(false);
  const [cmpOpen, setCmpOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [cmpStage, setCmpStage] = useState<StageKey>('y50');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'new' | 'score'>('new');
  const [kind, setKind] = useState<'any' | 'new' | 'existing'>('any');
  const [abBusy, setAbBusy] = useState(false);
  const [folder, setFolder] = useState<string | null>(null);
  const [newFolder, setNewFolder] = useState('');
  const folders = Array.from(new Set((items || []).map((p) => p.collection).filter(Boolean) as string[])).sort();

  const load = useCallback(async () => {
    const [c, l] = await Promise.all([me.user ? cloud.all().catch(() => []) : Promise.resolve([]), local.all().catch(() => [])]);
    setItems([...l, ...c].sort((a, b) => b.created_at.localeCompare(a.created_at)));
  }, [me.user]);

  useEffect(() => {
    load();
    track('gallery_open');
  }, [load]);

  const update = (p: Preview, x: Partial<Preview>) => {
    const next = { ...p, ...x };
    setItems((all) => all?.map((i) => (i.id === p.id ? next : i)) ?? null);
    if (open?.id === p.id) setOpen(next);
    if (p.source === 'cloud') cloud.update(p.id, { notes: next.notes, favorite: next.favorite, collection: next.collection, done_at: next.doneAt ?? null });
    else local.put(next);
  };

  const remove = async (p: Preview) => {
    if (!confirmDelete()) return;
    if (p.source === 'cloud') await cloud.hide(p.id);
    else await local.remove(p.id);
    setItems((all) => all?.filter((i) => i.id !== p.id) ?? null);
    setOpen(null);
    toast(t('Deleted', 'Törölve'));
  };
  // a soft in-app confirm (no browser dialogs)
  const [armed, setArmed] = useState(false);
  const confirmDelete = () => {
    if (armed) {
      setArmed(false);
      return true;
    }
    setArmed(true);
    toast(t('Tap delete again to confirm', 'Koppints újra a törléshez'));
    setTimeout(() => setArmed(false), 3000);
    return false;
  };

  if (open)
    return (
      <>
        <div className="detail-top">
          <button className="iconbtn" aria-label={ui.t('common.back')} onClick={() => setOpen(null)}>
            {Icon.back}
          </button>
          <h1>{placeName(open.placement, ui.lang)}</h1>
          <button className="iconbtn" aria-label={t('Delete', 'Törlés')} onClick={() => remove(open)} style={armed ? { background: 'var(--fresh)', color: '#fff' } : undefined}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13" /></svg>
          </button>
        </div>
        <p className="sub small">
          {new Date(open.created_at).toLocaleDateString(ui.lang === 'hu' ? 'hu-HU' : 'en-GB', { year: 'numeric', month: 'short', day: 'numeric' })} · {open.size}
          {open.source === 'local' && ` · ${t('on this device only', 'csak ezen az eszközön')}`}
        </p>
        <div className="card detail-meta">
          <div className="row" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
            <b>{open.doneAt ? t(`Got it done · ${new Date(open.doneAt).toLocaleDateString('en-GB')}`, `Megcsináltattam · ${new Date(open.doneAt).toLocaleDateString('hu-HU')}`) : t('Did you get this one?', 'Ezt csináltattad meg?')}</b>
            <button className={`chipbtn ${open.doneAt ? 'on' : ''}`} onClick={() => update(open, { doneAt: open.doneAt ? null : new Date().toISOString() })}>
              {open.doneAt ? t('Undo', 'Visszavon') : t('✓ I got it done', '✓ Megcsináltattam')}
            </button>
          </div>
          <div className="folderrow">
            <span>{t('Folder', 'Mappa')}</span>
            {folders.map((f) => (
              <button key={f} className={`chip ${open.collection === f ? 'on' : ''}`} onClick={() => update(open, { collection: open.collection === f ? null : f })}>
                {f}
              </button>
            ))}
            <input
              className="text"
              id="new-folder"
              placeholder={t('+ New folder', '+ Új mappa')}
              maxLength={30}
              value={newFolder}
              onChange={(e) => setNewFolder(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newFolder.trim()) {
                  update(open, { collection: newFolder.trim() });
                  setNewFolder('');
                }
              }}
              onBlur={() => {
                if (newFolder.trim()) {
                  update(open, { collection: newFolder.trim() });
                  setNewFolder('');
                }
              }}
            />
          </div>
        </div>
        <Result preview={open} onNotes={(notes) => update(open, { notes })} onFavorite={() => update(open, { favorite: !open.favorite })} />
      </>
    );

  const norm = (x: string) => x.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const shown = (items || [])
    .filter((p) => filter === 'all' || p.favorite)
    .filter((p) => !folder || p.collection === folder)
    .filter((p) => kind === 'any' || (kind === 'existing' ? p.mode === 'existing' : p.mode !== 'existing'))
    .filter((p) => !q.trim() || norm(`${placeName(p.placement, ui.lang)} ${p.placement} ${p.notes || ''} ${p.size || ''}`).includes(norm(q.trim())))
    .sort((a, b) => (sort === 'score' ? (b.score ?? -1) - (a.score ?? -1) : b.created_at.localeCompare(a.created_at)));
  const pair = picked.map((id) => items?.find((p) => p.id === id)).filter(Boolean) as Preview[];

  return (
    <>
      <div className="gal-head">
        <div>
          <p className="kicker">{items ? `${items.length} ${t('saved', 'mentve')}` : '…'}</p>
          <h1 style={{ margin: 0 }}>{ui.t('gallery.title')}</h1>
        </div>
        {items && items.length > 1 && (
          <button
            className={`chipbtn ${comparing ? 'on' : ''}`}
            onClick={() => {
              setComparing(!comparing);
              setPicked([]);
            }}
          >
            {comparing ? ui.t('common.cancel') : ui.t('gallery.compare')}
          </button>
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
            ♥ {ui.t('gallery.favorites')}
          </button>
        </div>
      )}

      {items && items.length > 2 && (
        <div className="galtools">
          <input className="text" type="search" id="gal-search" placeholder={t('Search: body area, notes…', 'Keresés: testrész, jegyzet…')} value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="row" style={{ gap: 6 }}>
            <button className={`chip ${sort === 'score' ? 'on' : ''}`} onClick={() => setSort(sort === 'score' ? 'new' : 'score')}>
              {sort === 'score' ? t('Best score first', 'Legjobb pontszám elöl') : t('Newest first', 'Legújabb elöl')}
            </button>
            {(['any', 'new', 'existing'] as const).map((k) => (
              <button key={k} className={`chip ${kind === k ? 'on' : ''}`} onClick={() => setKind(k)}>
                {k === 'any' ? t('All types', 'Mind') : k === 'new' ? t('New designs', 'Új minták') : t('My tattoos', 'Meglévő tetoválásaim')}
              </button>
            ))}
          </div>
        </div>
      )}
      {folders.length > 0 && (
        <div className="row" style={{ gap: 6, marginTop: 10 }}>
          <button className={`chip ${!folder ? 'on' : ''}`} onClick={() => setFolder(null)}>
            {t('All folders', 'Minden mappa')}
          </button>
          {folders.map((f) => (
            <button key={f} className={`chip ${folder === f ? 'on' : ''}`} onClick={() => setFolder(folder === f ? null : f)}>
              📁 {f}
            </button>
          ))}
        </div>
      )}
      {items && items.length > 0 && shown.length === 0 && <p className="sub" style={{ marginTop: 16 }}>{t('Nothing matches. Try another search.', 'Nincs találat. Próbálj mást keresni.')}</p>}

      {comparing && (
        <div className="row" style={{ marginTop: 10, alignItems: 'center', justifyContent: 'space-between' }}>
          <p className="sub small" style={{ margin: 0 }}>{t('Pick 2 or 3 designs to compare.', 'Válassz ki 2 vagy 3 tervet az összehasonlításhoz.')}</p>
          <button className="btn" style={{ minHeight: 40, padding: '0 16px', fontSize: 15 }} disabled={picked.length < 2} onClick={() => setCmpOpen(true)}>
            {t('Compare', 'Összevet')} ({picked.length})
          </button>
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
              <button
                key={p.id}
                className={`tile ${n >= 0 ? 'pick' : ''}`}
                data-n={n + 1}
                onClick={() => {
                  if (!comparing) return setOpen(p);
                  if (n >= 0) setPicked(picked.filter((x) => x !== p.id));
                  else if (picked.length < 3) setPicked([...picked, p.id]);
                }}
                aria-label={`${placeName(p.placement, ui.lang)}, ${t('score', 'pontszám')} ${p.score ?? '–'}`}
              >
                {thumb(p) && <img src={thumb(p)} alt="" loading="lazy" />}
                {p.design && <img className="tile-design" src={p.design} alt="" loading="lazy" />}
                {p.doneAt && <span className="donebadge">✓ {t('Done', 'Kész')}</span>}
                {p.source === 'local' && <span className="local">{t('Device', 'Eszköz')}</span>}
                {p.favorite && (
                  <span className="fav">
                    {Icon.heart}
                  </span>
                )}
                <span className="meta">
                  <span>{placeName(p.placement, ui.lang)}</span>
                  {p.score !== null && <b>{p.score}</b>}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <Sheet open={comparing && cmpOpen && pair.length >= 2} onClose={() => setCmpOpen(false)} label={ui.t('gallery.compare')}>
        <h2>{ui.t('gallery.compare')}</h2>
        <div className="seg" role="radiogroup" style={{ justifySelf: 'start' }}>
          {(['fresh', 'y10', 'y50'] as StageKey[]).map((k) => (
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
        {pair.length === 2 && pair.every((p) => p.images.y50) && (
          <button
            className="btn wide"
            style={{ marginTop: 6 }}
            disabled={abBusy}
            onClick={async () => {
              setAbBusy(true);
              try {
                const lab = (p: Preview) => `${placeName(p.placement, ui.lang)}${p.sizeCm ? ` ${p.sizeCm} cm` : ''}`;
                const id = await abShare(pair[0], pair[1], lab(pair[0]), lab(pair[1]));
                await shareVoteLink(id, t('Which tattoo should I get? 👀', 'Melyik tetoválást csináltassam? 👀'), () => toast(t('Link copied — send it to your friends', 'Link másolva – küldd el a barátaidnak')));
              } catch (e: any) {
                toast(trErr(ui.lang, e?.message));
              }
              setAbBusy(false);
            }}
          >
            {abBusy ? '…' : t('Ask friends: which one?', 'Kérdezd meg a barátaidat: melyik legyen?')}
          </button>
        )}
        {pair.length >= 2 && pair.every((p) => p.score !== null) && new Set(pair.map((p) => p.score)).size > 1 && (() => {
          const best = pair.reduce((a, b) => ((a.score || 0) >= (b.score || 0) ? a : b));
          return (
            <p className="sub">
              {t(`The ${placeName(best.placement, 'en').toLowerCase()} version should age best (${best.score}/100).`, `A(z) ${placeName(best.placement, 'hu').toLowerCase()} változat öregszik várhatóan a legjobban (${best.score}/100).`)}
            </p>
          );
        })()}
      </Sheet>
    </>
  );
}
