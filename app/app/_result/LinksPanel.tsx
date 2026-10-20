'use client';
import { useEffect, useMemo, useState } from 'react';
import { siteOrigin } from '@/lib/site';
import { useApp } from '../AppProvider';
import { tx } from '@/lib/i18n';
import { anonId, cloud, Preview, revokeGuestShare, shares } from '@/lib/store';
import { sb } from '@/lib/sb';
import { PollResults } from '../PollResults';
import type { PollData } from '@/lib/share';
import { closePoll } from '@/lib/share';
import type { ShareInfo } from './types';

/** The preview's vote links: results, Explore status, copy and close. */
export function LinksPanel({ preview, tick, onShared }: { preview: Preview; tick: number; onShared?: (id: string | null) => void }) {
  const { ui, me, toast } = useApp();
  const t = (en: string, hu: string) => tx(ui.lang, en, hu);
  const ids = useMemo(
    () => Array.from(new Set([preview.share_id, ...shares.forPreview(preview.id).map((x) => x.id)].filter(Boolean) as string[])),
    [preview.id, preview.share_id, tick] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const [info, setInfo] = useState<Record<string, ShareInfo>>({});
  const [posts, setPosts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState('');
  useEffect(() => {
    if (!ids.length) return;
    const s = sb();
    if (!s) return;
    let live = true;
    Promise.all(ids.map((id) => s.rpc(id.startsWith('p') ? 'get_poll' : 'get_share', { p_share: id }).then((r) => [id, r.data as ShareInfo] as const))).then((rows) => live && setInfo(Object.fromEntries(rows)));
    s.rpc('post_status', { p_shares: ids.filter((id) => !id.startsWith('p')) }).then((r) => live && setPosts((r.data as any) || {}));
    return () => {
      live = false;
    };
  }, [ids.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps
  const shown = ids.filter((id) => info[id] !== null);
  if (!shown.length) return null;
  const close = async (id: string) => {
    setBusy(id);
    try {
      if (id.startsWith('p')) {
        if (!(await closePoll(id))) throw new Error();
        shares.drop(id);
      } else if (id === preview.share_id && me.user && preview.source === 'cloud') {
        await cloud.unshare(me.user.id, preview.id);
        shares.drop(id);
        onShared?.(null);
      } else if (!(await revokeGuestShare(id))) throw new Error();
      setInfo((m) => ({ ...m, [id]: null }));
      toast(t('Link closed — it no longer opens', 'Link lezárva – már nem nyitható meg'));
    } catch {
      toast(t('Could not close the link. Try again.', 'Nem sikerült lezárni a linket. Próbáld újra.'));
    }
    setBusy('');
  };
  const withdraw = async (id: string) => {
    setBusy(id);
    const { data } = (await sb()?.rpc('withdraw_post', { p_share: id, p_anon: anonId() })) || {};
    if (data) setPosts((m) => ({ ...m, [id]: 'withdrawn' }));
    toast(data ? t('Removed from Explore', 'Eltávolítva a Felfedezésből') : t('Could not remove it. Try again.', 'Nem sikerült eltávolítani. Próbáld újra.'));
    setBusy('');
  };
  const postLabel = (st?: string) =>
    st === 'pending' ? t('Explore: waiting for review', 'Felfedezés: ellenőrzésre vár') : st === 'approved' ? t('Explore: live', 'Felfedezés: kint van') : st === 'rejected' ? t('Explore: not approved', 'Felfedezés: nem került ki') : null;
  return (
    <div className="card links-card" style={{ marginTop: 12 }}>
      <h3>{t('Your vote links', 'Szavazós linkjeid')}</h3>
      {shown.map((id) => {
        const v = info[id]?.votes;
        const total = v ? v.yes + v.no + v.change : 0;
        const pl = postLabel(posts[id]);
        const poll = id.startsWith('p') ? (info[id] as unknown as PollData | undefined) : undefined;
        return (
          <div key={id} className="link-row">
            {poll && (
              <>
                <b>{poll.question}</b>
                <PollResults poll={poll} lang={ui.lang} />
                <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                  <a className="chipbtn" href={`/v/${id}`} target="_blank" rel="noreferrer">
                    {t('Open', 'Megnyitás')}
                  </a>
                  <button
                    className="chipbtn"
                    onClick={async () => {
                      await navigator.clipboard.writeText(`${siteOrigin()}/v/${id}`).catch(() => {});
                      toast(t('Link copied', 'Link másolva'));
                    }}
                  >
                    {t('Copy link', 'Link másolása')}
                  </button>
                  <button className="chipbtn" disabled={busy === id} onClick={() => close(id)}>
                    {t('Close link', 'Link lezárása')}
                  </button>
                </div>
              </>
            )}
            {!poll && (<>
            <div className="link-votes">
              {v ? (
                <>
                  <span className="yes">👍 {v.yes}</span>
                  <span className="no">👎 {v.no}</span>
                  <span className="chg">✏️ {v.change}</span>
                </>
              ) : (
                <span className="muted small">…</span>
              )}
            </div>
            <p className="muted small" style={{ margin: '4px 0 8px' }}>
              {total ? t(`${total} vote${total === 1 ? '' : 's'} so far`, `Eddig ${total} szavazat`) : t('No votes yet', 'Még nincs szavazat')}
              {pl ? ` · ${pl}` : ''}
            </p>
            <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
              <button
                className="chipbtn"
                onClick={async () => {
                  await navigator.clipboard.writeText(`${siteOrigin()}/v/${id}`).catch(() => {});
                  toast(t('Link copied', 'Link másolva'));
                }}
              >
                {t('Copy link', 'Link másolása')}
              </button>
              {(posts[id] === 'pending' || posts[id] === 'approved') && (
                <button className="chipbtn" disabled={busy === id} onClick={() => withdraw(id)}>
                  {t('Remove from Explore', 'Levétel a Felfedezésből')}
                </button>
              )}
              <button className="chipbtn" disabled={busy === id} onClick={() => close(id)}>
                {t('Close link', 'Link lezárása')}
              </button>
            </div>
            </>)}
          </div>
        );
      })}
    </div>
  );
}
