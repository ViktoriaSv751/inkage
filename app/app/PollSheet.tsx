'use client';

import { siteOrigin } from '@/lib/site';
import { useEffect, useMemo, useState } from 'react';
import { useApp } from './AppProvider';
import { Sheet } from './ui';
import { tx, trErr } from '@/lib/i18n';
import { cloud, haptic, local, Preview, shares, track } from '@/lib/store';
import { createPoll } from '@/lib/share';
import { placeName } from './create/steps';

const MAX = 4;

/** "Ask friends": pick which designs go on the vote link, write the question, send it. */
export function PollSheet({ open, onClose, initial }: { open: boolean; onClose: () => void; initial: Preview[] }) {
  const { ui, me, toast } = useApp();
  const t = (en: string, hu: string) => tx(ui.lang, en, hu);
  const [all, setAll] = useState<Preview[] | null>(null);
  const [sel, setSel] = useState<string[]>([]);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [question, setQuestion] = useState('');
  const [qTouched, setQTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [made, setMade] = useState<string | null>(null);
  const [more, setMore] = useState(false);

  // fresh state every time it opens
  useEffect(() => {
    if (!open) return;
    setSel(initial.filter((p) => p.images.fresh || p.images.y50).slice(0, MAX).map((p) => p.id));
    setLabels({});
    setQuestion('');
    setQTouched(false);
    setMade(null);
    setMore(false);
    let live = true;
    (async () => {
      const mine = await local.all().catch(() => [] as Preview[]);
      const fromCloud = me.user ? await cloud.all(0, 60).catch(() => [] as Preview[]) : [];
      const map = new Map<string, Preview>();
      for (const p of [...initial, ...fromCloud, ...mine]) if (!map.has(p.id) && (p.images.fresh || p.images.y50)) map.set(p.id, p);
      if (live) setAll([...map.values()]);
    })();
    return () => {
      live = false;
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const byId = useMemo(() => new Map((all || initial).map((p) => [p.id, p])), [all, initial]);
  const picked = sel.map((id) => byId.get(id)).filter(Boolean) as Preview[];
  const defLabel = (p: Preview, i: number) => {
    const base = `${placeName(p.placement, ui.lang)}${p.sizeCm ? ` ${p.sizeCm} cm` : ''}`;
    // same place twice: tell them apart by letter
    const dup = picked.filter((x) => placeName(x.placement, ui.lang) === placeName(p.placement, ui.lang)).length > 1;
    return dup || !base.trim() ? `${String.fromCharCode(65 + i)}${base.trim() ? ` · ${base}` : ''}` : base;
  };
  const defQuestion = picked.length > 1 ? t('Which one should I get?', 'Melyiket csináltassam meg?') : t('Should I get this tattoo?', 'Csináltassam meg ezt a tetoválást?');
  const q = qTouched ? question : defQuestion;
  const SUGGEST = picked.length > 1
    ? [t('Which one should I get?', 'Melyiket csináltassam meg?'), t('Which placement is better?', 'Melyik helyen jobb?'), t('Which size?', 'Melyik méret legyen?')]
    : [t('Should I get this tattoo?', 'Csináltassam meg ezt a tetoválást?'), t('Is this too big?', 'Nem túl nagy?'), t('Would this suit me?', 'Illik hozzám?')];

  const toggle = (id: string) => {
    haptic('tap');
    setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= MAX ? (toast(t(`Up to ${MAX} designs`, `Legfeljebb ${MAX} terv`)), s) : [...s, id]));
  };

  const url = made ? `${siteOrigin()}/v/${made}` : '';
  const send = async () => {
    const nav: any = navigator;
    track('share_link', { id: made });
    if (nav.share) await nav.share({ url, title: 'InkAge', text: `${q} 👀` }).catch(() => {});
    else copy();
  };
  const copy = async () => {
    await navigator.clipboard.writeText(url).catch(() => {});
    toast(t('Link copied — send it to your friends', 'Link másolva – küldd el a barátaidnak'));
  };

  const make = async () => {
    if (!picked.length) return;
    setBusy(true);
    try {
      const items = picked.map((p, i) => ({ p, label: (labels[p.id] ?? defLabel(p, i)).trim() || defLabel(p, i) }));
      const id = await createPoll(items, q);
      shares.add({ id, at: new Date().toISOString(), label: q, previewIds: picked.map((p) => p.id), kind: 'poll' });
      setMade(id);
      haptic('success');
    } catch (e: any) {
      toast(trErr(ui.lang, e?.message));
    }
    setBusy(false);
  };

  const extra = (all || []).filter((p) => !initial.some((x) => x.id === p.id));
  const shown = more ? [...initial, ...extra] : [...initial, ...extra.filter((p) => sel.includes(p.id))];
  // how it looks now (fresh), like the gallery; the years are part of the poll itself
  const thumb = (p: Preview) => p.images.fresh || p.images.healed || p.images.y10 || p.images.y50;

  return (
    <Sheet open={open} onClose={onClose} label={t('Ask friends', 'Kérdezd meg a barátaidat')}>
      {!made ? (
        <>
          <h2>{t('Ask your friends', 'Kérdezd meg a barátaidat')}</h2>
          <p className="muted" style={{ margin: '6px 0 12px' }}>
            {t('Pick 1–4 designs. With one, friends say “get it / change / don’t”. With more, they pick their favourite.', 'Válassz 1–4 tervet. Egynél a barátaid azt mondják: „csináltasd / változtass / ne”. Többnél kiválasztják a kedvencüket.')}
          </p>
          <div className="poll-pick">
            {shown.map((p) => {
              const i = sel.indexOf(p.id);
              return (
                <button key={p.id} type="button" className={`poll-thumb ${i >= 0 ? 'on' : ''}`} onClick={() => toggle(p.id)} aria-pressed={i >= 0}>
                  <img src={thumb(p)} alt={placeName(p.placement, ui.lang)} />
                  <span className="poll-check">{i >= 0 ? String.fromCharCode(65 + i) : ''}</span>
                  <span className="poll-cap">{placeName(p.placement, ui.lang)}</span>
                </button>
              );
            })}
            {!more && extra.length > 0 && (
              <button type="button" className="poll-thumb poll-more" onClick={() => setMore(true)}>
                <span>+</span>
                <small>{t('More designs', 'Több terv')}</small>
              </button>
            )}
          </div>
          {all === null && <p className="muted small">{t('Loading your designs…', 'Terveid betöltése…')}</p>}

          {picked.length > 0 && (
            <>
              <label className="poll-label">{t('Your question', 'A kérdésed')}</label>
              <input
                className="text"
                value={q}
                maxLength={140}
                onChange={(e) => {
                  setQTouched(true);
                  setQuestion(e.target.value);
                }}
              />
              <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                {SUGGEST.map((s) => (
                  <button key={s} type="button" className={`chipbtn ${q === s ? 'on' : ''}`} onClick={() => (setQTouched(true), setQuestion(s))}>
                    {s}
                  </button>
                ))}
              </div>
              {picked.length > 1 && (
                <>
                  <label className="poll-label">{t('Names friends will see', 'Ezt a nevet látják a barátaid')}</label>
                  {picked.map((p, i) => (
                    <div key={p.id} className="poll-name">
                      <b>{String.fromCharCode(65 + i)}</b>
                      <input className="text" maxLength={60} value={labels[p.id] ?? defLabel(p, i)} onChange={(e) => setLabels((m) => ({ ...m, [p.id]: e.target.value }))} />
                    </div>
                  ))}
                </>
              )}
            </>
          )}
          <button className="btn wide" style={{ marginTop: 16 }} disabled={!picked.length || busy} onClick={make}>
            {busy
              ? t('Making the link…', 'Link készítése…')
              : picked.length > 1
                ? t(`Make a vote link with ${picked.length} designs`, `Szavazós link ${picked.length} tervvel`)
                : picked.length
                  ? t('Make the vote link', 'Szavazós link készítése')
                  : t('Pick at least one design', 'Válassz legalább egy tervet')}
          </button>
          <p className="fine">{t('Anyone with the link can vote, no sign-up. You can close it any time.', 'Bárki szavazhat, akinek elküldöd, regisztráció nélkül. Bármikor lezárhatod.')}</p>
        </>
      ) : (
        <div className="poll-made">
          <div className="poll-ok">✓</div>
          <h2 style={{ margin: '8px 0 4px' }}>{t('Your vote link is ready', 'Kész a szavazós linked')}</h2>
          <p className="muted">{t('Send it to friends. You’ll see the results and their comments under Profile › My vote links.', 'Küldd el a barátaidnak. Az eredményt és a megjegyzéseiket a Profil › Szavazós linkjeim alatt látod.')}</p>
          <div className="poll-url">{url.replace(/^https?:\/\//, '')}</div>
          <button className="btn wide" onClick={send}>
            {t('Send to friends', 'Küldés a barátaidnak')}
          </button>
          <div className="row" style={{ gap: 8, marginTop: 8 }}>
            <button className="btn ghost" style={{ flex: 1 }} onClick={copy}>
              {t('Copy link', 'Link másolása')}
            </button>
            <a className="btn ghost" style={{ flex: 1 }} href={url} target="_blank" rel="noreferrer">
              {t('Open', 'Megnyitás')}
            </a>
          </div>
        </div>
      )}
    </Sheet>
  );
}
