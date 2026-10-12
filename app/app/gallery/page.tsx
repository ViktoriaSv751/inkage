'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useApp } from '../AppProvider';
import { Icon, Sheet } from '../ui';
import { Result } from '../Result';
import { tx } from '@/lib/i18n';
import { cloud, local, Preview, StageKey, track } from '@/lib/store';
import { placeName } from '../create/steps';
import { EXAMPLE } from '../../visuals';

const thumb = (p: Preview) => p.images.y50 || p.images.y30 || p.images.fresh || '';

export default function GalleryPage() {
  const { ui, me, openAuth, toast } = useApp();
  const t = (en: string, hu: string) => tx(ui.lang, en, hu);
  const [items, setItems] = useState<Preview[] | null>(null);
  const [filter, setFilter] = useState<'all' | 'fav'>('all');
  const [open, setOpen] = useState<Preview | null>(null);
  const [comparing, setComparing] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [cmpStage, setCmpStage] = useState<StageKey>('y50');

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
    if (p.source === 'cloud') cloud.update(p.id, { notes: next.notes, favorite: next.favorite });
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
        <Result preview={open} onNotes={(notes) => update(open, { notes })} onFavorite={() => update(open, { favorite: !open.favorite })} />
      </>
    );

  const shown = (items || []).filter((p) => filter === 'all' || p.favorite);
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

      {comparing && <p className="sub small" style={{ marginTop: 10 }}>{t('Pick two designs to compare side by side.', 'Válassz ki két tervet az összehasonlításhoz.')}</p>}

      {items === null ? (
        <div className="galgrid">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="tile ph" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="empty">
          <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><path d="M16.5 13.5v6M13.5 16.5h6" /></svg>
          <p className="sub">{ui.t('gallery.empty')}</p>
          <div className="cmp" style={{ margin: '0 0 18px' }}>
            {[EXAMPLE[0], EXAMPLE[4]].map((e) => (
              <figure key={e.years}>
                <img src={e.src} alt="" />
                <figcaption>{e.years ? t('50 years later', '50 év múlva') : t('Fresh', 'Frissen')}</figcaption>
              </figure>
            ))}
          </div>
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
                  else if (picked.length < 2) setPicked([...picked, p.id]);
                }}
                aria-label={`${placeName(p.placement, ui.lang)}, ${t('score', 'pontszám')} ${p.score ?? '–'}`}
              >
                {thumb(p) && <img src={thumb(p)} alt="" loading="lazy" />}
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

      <Sheet open={comparing && pair.length === 2} onClose={() => setPicked([])} label={ui.t('gallery.compare')}>
        <h2>{ui.t('gallery.compare')}</h2>
        <div className="seg" role="radiogroup" style={{ justifySelf: 'start' }}>
          {(['fresh', 'y10', 'y50'] as StageKey[]).map((k) => (
            <button key={k} role="radio" aria-checked={cmpStage === k} className={cmpStage === k ? 'on' : ''} onClick={() => setCmpStage(k)}>
              {ui.t(`stage.${k}` as any)}
            </button>
          ))}
        </div>
        <div className="cmp">
          {pair.map((p) => (
            <figure key={p.id}>
              <img src={p.images[cmpStage] || p.images.fresh} alt={placeName(p.placement, ui.lang)} />
              <figcaption>
                {placeName(p.placement, ui.lang)} · {p.score ?? '–'}/100
              </figcaption>
            </figure>
          ))}
        </div>
        {pair.length === 2 && pair[0].score !== null && pair[1].score !== null && pair[0].score !== pair[1].score && (
          <p className="sub">
            {t(
              `The ${placeName((pair[0].score! > pair[1].score! ? pair[0] : pair[1]).placement, 'en').toLowerCase()} version should age better (+${Math.abs(pair[0].score! - pair[1].score!)} points).`,
              `A(z) ${placeName((pair[0].score! > pair[1].score! ? pair[0] : pair[1]).placement, 'hu').toLowerCase()} változat várhatóan jobban öregszik (+${Math.abs(pair[0].score! - pair[1].score!)} pont).`
            )}
          </p>
        )}
      </Sheet>
    </>
  );
}
