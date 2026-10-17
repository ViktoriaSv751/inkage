'use client';

import { useEffect, useState } from 'react';
import { useApp } from '../AppProvider';
import { tx } from '@/lib/i18n';
import { sb } from '@/lib/sb';
import { cloud, revokeGuestShare, shares as reg } from '@/lib/store';
import { placeName } from '../create/steps';
import { closePoll, myPolls, type MyPoll } from '@/lib/share';
import { PollResults } from '../PollResults';

type Row = { id: string; label: string; at: string; kind: string; previewId?: string | null; votes?: { yes: number; no: number; change: number } | null };

/** Every vote link you made (this device + your account), with results. */
export function MyShares() {
  const { ui, me, toast } = useApp();
  const t = (en: string, hu: string) => tx(ui.lang, en, hu);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState('');
  const [polls, setPolls] = useState<MyPoll[]>([]);
  useEffect(() => {
    myPolls(!!me.user).then(setPolls).catch(() => {});
  }, [me.user]);
  useEffect(() => {
    const s = sb();
    if (!s) return setRows([]);
    (async () => {
      const out = new Map<string, Row>();
      if (me.user) {
        const { data } = await s.rpc('my_shares');
        for (const r of (data as any[]) || []) out.set(r.share_id, { id: r.share_id, label: placeName(r.placement || '', ui.lang), at: r.created_at, kind: r.kind, previewId: r.preview_id, votes: r.share?.votes ?? null });
      }
      const local = reg.all().filter((x) => !out.has(x.id) && x.kind !== 'poll');
      const got = await Promise.all(local.map((x) => s.rpc('get_share', { p_share: x.id }).then((r) => [x, r.data as any] as const)));
      for (const [x, d] of got) if (d) out.set(x.id, { id: x.id, label: x.label, at: x.at, kind: x.kind, previewId: x.previewId, votes: d.votes ?? null });
      setRows([...out.values()].sort((a, b) => b.at.localeCompare(a.at)));
    })().catch(() => setRows([]));
  }, [me.user, ui.lang]);
  if ((!rows || rows.length === 0) && polls.length === 0) return null;
  const closeP = async (id: string) => {
    setBusy(id);
    if (await closePoll(id)) {
      reg.drop(id);
      setPolls((all) => all.filter((x) => x.share_id !== id));
      toast(t('Link closed', 'Link lezárva'));
    } else toast(t('Could not close the link. Try again.', 'Nem sikerült lezárni. Próbáld újra.'));
    setBusy('');
  };
  const close = async (r: Row) => {
    setBusy(r.id);
    try {
      if (r.kind === 'preview' && r.previewId && me.user) await cloud.unshare(me.user.id, r.previewId);
      else if (!(await revokeGuestShare(r.id))) throw new Error();
      reg.drop(r.id);
      setRows((all) => all?.filter((x) => x.id !== r.id) ?? null);
      toast(t('Link closed', 'Link lezárva'));
    } catch {
      toast(t('Could not close the link. Try again.', 'Nem sikerült lezárni. Próbáld újra.'));
    }
    setBusy('');
  };
  return (
    <div className="card links-card" style={{ marginTop: 12 }}>
      <h2>{t('My vote links', 'Szavazós linkjeim')}</h2>
      <p className="muted small" style={{ marginTop: -4 }}>{t('What your friends said, and the links you can still close.', 'Mit mondtak a barátaid, és mely linkeket zárhatod még le.')}</p>
      {polls.map((m) => (
        <div key={m.share_id} className="link-row">
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <b>{m.question || t('Vote', 'Szavazás')}</b>
            <span className="muted small">{new Date(m.created_at).toLocaleDateString(ui.lang === 'hu' ? 'hu-HU' : 'en-GB')}</span>
          </div>
          {m.poll && <PollResults poll={m.poll} comments={m.comments} lang={ui.lang} />}
          <div className="row" style={{ gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            <button
              className="chipbtn"
              onClick={async () => {
                const url = `${location.origin}/v/${m.share_id}`;
                const nav: any = navigator;
                if (nav.share) await nav.share({ url, title: 'InkAge', text: `${m.question || ''} 👀` }).catch(() => {});
                else {
                  await navigator.clipboard.writeText(url).catch(() => {});
                  toast(t('Link copied', 'Link másolva'));
                }
              }}
            >
              {t('Send again', 'Küldés újra')}
            </button>
            <a className="chipbtn" href={`/v/${m.share_id}`} target="_blank" rel="noreferrer">
              {t('Open', 'Megnyitás')}
            </a>
            <button className="chipbtn" disabled={busy === m.share_id} onClick={() => closeP(m.share_id)}>
              {t('Close link', 'Link lezárása')}
            </button>
          </div>
        </div>
      ))}
      {(rows || []).map((r) => {
        const v = r.votes;
        const total = v ? v.yes + v.no + v.change : 0;
        return (
          <div key={r.id} className="link-row">
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <b>
                {r.kind === 'ab' ? t('Which one? ', 'Melyik? ') : ''}
                {r.label}
              </b>
              <span className="muted small">{new Date(r.at).toLocaleDateString(ui.lang === 'hu' ? 'hu-HU' : 'en-GB')}</span>
            </div>
            <div className="link-votes" style={{ marginTop: 8 }}>
              <span>👍 {v?.yes ?? 0}</span>
              <span>👎 {v?.no ?? 0}</span>
              <span>✏️ {v?.change ?? 0}</span>
              <span className="muted">{total ? t(`${total} votes`, `${total} szavazat`) : t('no votes yet', 'még nincs szavazat')}</span>
            </div>
            <div className="row" style={{ gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              <button
                className="chipbtn"
                onClick={async () => {
                  await navigator.clipboard.writeText(`${location.origin}/v/${r.id}`).catch(() => {});
                  toast(t('Link copied', 'Link másolva'));
                }}
              >
                {t('Copy link', 'Link másolása')}
              </button>
              <a className="chipbtn" href={`/v/${r.id}`} target="_blank" rel="noreferrer">
                {t('Open', 'Megnyitás')}
              </a>
              <button className="chipbtn" disabled={busy === r.id} onClick={() => close(r)}>
                {t('Close link', 'Link lezárása')}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
