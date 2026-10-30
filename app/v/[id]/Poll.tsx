'use client';
import { qOf } from '@/lib/tr';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { sb } from '@/lib/sb';
import { anonId, lsGet, lsSet, shares, track } from '@/lib/store';
import { useLang, tx } from '@/lib/i18n';
import { myPolls, type PollComment, type PollData } from '@/lib/share';
import { Report } from './Report';

type Mine = { idx: number; verdict: 'yes' | 'no' | 'change' | null; commented?: boolean };
const LETTER = (i: number) => String.fromCharCode(65 + i);

/** A friend's poll: look at the designs (fresh and in 50 years), pick one, say why. */
/** inApp: opened from Explore inside the app (no site logo, the call to action stays in the app) */
export function Poll({ id, initial, inApp = false }: { id: string; initial: PollData; inApp?: boolean }) {
  const { lang } = useLang();
  const t = (en: string, hu: string) => tx(lang, en, hu);
  const [p, setP] = useState(initial);
  const [mine, setMine] = useState<Mine | null>(null);
  const [old, setOld] = useState(false);
  const [owner, setOwner] = useState(false);
  const [comments, setComments] = useState<PollComment[]>([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [big, setBig] = useState<number | null>(null);
  const single = p.options.length === 1;
  const hasOld = p.options.some((o) => o.y50);

  useEffect(() => {
    setMine(lsGet<Mine | null>(`ink_poll_${id}`, null));
    const own = shares.all().some((x) => x.id === id);
    setOwner(own);
    track('poll_view', { id, owner: own });
    if (own)
      myPolls(true)
        .then((all) => {
          const m = all.find((x) => x.share_id === id);
          if (m?.poll) setP(m.poll);
          if (m) setComments(m.comments || []);
        })
        .catch(() => {});
    // one design: show the 50-year version after a moment, that's the point
    if (initial.options.length === 1 && initial.options[0].y50) {
      const tm = setTimeout(() => setOld(true), 1800);
      return () => clearTimeout(tm);
    }
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (big === null) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && setBig(null);
    window.addEventListener('keydown', k);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', k);
      document.body.style.overflow = prev;
    };
  }, [big]);

  const cast = async (idx: number, verdict: Mine['verdict'], comment?: string) => {
    const next: Mine = { idx, verdict, commented: !!comment || (mine?.commented ?? false) };
    setMine(next);
    lsSet(`ink_poll_${id}`, next);
    if (navigator.vibrate) navigator.vibrate(10);
    const { data, error } = (await sb()?.rpc('cast_poll_vote', { p_share: id, p_idx: idx, p_verdict: verdict, p_comment: comment || null, p_voter: anonId() })) || { error: true };
    if (data) setP(data as PollData);
    if (!error && !comment) fetch('/api/vote-notify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ share: id }) }).catch(() => {});
    track(comment ? 'poll_comment' : 'poll_vote', { n: p.options.length });
    return !error;
  };

  const sendNote = async () => {
    if (!mine || !note.trim()) return;
    setBusy(true);
    await cast(mine.idx, mine.verdict, note.trim());
    setNote('');
    setBusy(false);
  };

  const total = p.total || 0;
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);
  const showRes = !!mine || owner;
  const top = Math.max(0, ...p.options.map((o) => o.votes));
  const src = (o: PollData['options'][number]) => (old && o.y50 ? o.y50 : o.fresh);
  const question = p.question || (single ? t('Should I get this tattoo?', 'Csináltassam meg ezt a tetoválást?') : t('Which one should I get?', 'Melyiket csináltassam meg?'));

  const shareOn = async () => {
    const url = location.href.split('?')[0];
    const nav: any = navigator;
    if (nav.share) await nav.share({ url, title: 'InkAge', text: `${question} 👀` }).catch(() => {});
    else await navigator.clipboard.writeText(url).catch(() => {});
  };

  const flip = hasOld && (
    <div className="flip" style={{ margin: '0 0 12px' }}>
      <button className={!old ? 'on' : ''} onClick={() => setOld(false)}>
        {t('Fresh', 'Frissen')}
      </button>
      <button className={old ? 'on' : ''} onClick={() => setOld(true)}>
        {t('In 50 years', '50 év múlva')}
      </button>
    </div>
  );

  const VERD: ['yes' | 'change' | 'no', string, string][] = [
    ['yes', t('Get it! 🔥', 'Csináltasd! 🔥'), '#4b2bd6'],
    ['change', t('Change something ✏️', 'Változtass rajta ✏️'), '#d68a1f'],
    ['no', t('Don’t do it 😬', 'Ne csináld 😬'), '#e0483b'],
  ];

  return (
    <main className="pollpage">
      {!inApp && (
      <Link href="/" className="logo" style={{ fontSize: 26 }}>
        InkAge
      </Link>
    )}
      {owner && (
        <div className="pp-owner">
          <b>{t('This is your poll', 'Ez a te szavazásod')}</b>
          <span>{t('You see the results; your own vote isn’t counted.', 'Te az eredményt látod, a saját szavazatod nem számít bele.')}</span>
          <button className="btn" onClick={shareOn}>
            {t('Send to more friends', 'Küldd el még többeknek')}
          </button>
        </div>
      )}
      <h1 className="pp-q">{question}</h1>
      <p className="pp-sub">
        {single
          ? t('Look at it fresh and in 50 years, then tell me honestly.', 'Nézd meg frissen és 50 év múlva, aztán mondd meg őszintén.')
          : showRes
            ? t('Tap another one to change your vote.', 'Másikra koppintva módosíthatod a szavazatod.')
            : t(`Tap the one you like best. ${hasOld ? 'Check the 50-year look too!' : ''}`, `Koppints arra, amelyik a legjobban tetszik. ${hasOld ? 'Nézd meg 50 év múlva is!' : ''}`)}
      </p>
      {flip}

      {single ? (
        <>
          <div className="photo-stack pp-single" onClick={() => setBig(0)} role="button" aria-label={t('Enlarge', 'Nagyítás')}>
            <img src={p.options[0].fresh} alt={t('The tattoo, fresh', 'A tetoválás frissen')} />
            {p.options[0].y50 && <img src={p.options[0].y50} alt={t('The tattoo after 50 years', 'A tetoválás 50 év múlva')} style={{ opacity: old ? 1 : 0, transition: 'opacity 1.2s' }} />}
            <div className="year-readout">
              <span className="year-num">{old ? '50' : t('NEW', 'ÚJ')}</span>
              <span className="year-unit">{old ? t('years later', 'év múlva') : t('fresh ink', 'friss tinta')}</span>
            </div>
            {p.options[0].label && <span className="real-tag">{p.options[0].label}</span>}
          </div>
          {!owner && (
            <div className="pp-verdicts">
              {VERD.map(([k, label, col]) => {
                const n = p.options[0].verdicts[k];
                const on = mine?.verdict === k;
                return (
                  <button key={k} onClick={() => cast(0, k)} className={on ? 'on' : ''} style={{ borderColor: on ? col : 'transparent' }}>
                    {showRes && <span className="pp-fill" style={{ width: `${pct(n)}%`, background: col }} />}
                    <span className="pp-row">
                      {label}
                      {showRes && <span>{pct(n)}%</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          {owner && (
            <div className="pp-verdicts">
              {VERD.map(([k, label, col]) => (
                <div key={k} className="pp-static">
                  <span className="pp-fill" style={{ width: `${pct(p.options[0].verdicts[k])}%`, background: col }} />
                  <span className="pp-row">
                    {label}
                    <span>
                      {pct(p.options[0].verdicts[k])}% · {p.options[0].verdicts[k]}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className={`pp-grid n${p.options.length}`}>
          {p.options.map((o) => {
            const on = mine?.idx === o.idx;
            const win = showRes && total > 0 && o.votes === top;
            return (
              <div key={o.idx} className={`pp-card ${on ? 'on' : ''} ${win ? 'win' : ''}`}>
                <button className="pp-img" onClick={() => (owner ? setBig(o.idx) : cast(o.idx, null))} aria-label={owner ? t('Enlarge', 'Nagyítás') : t(`Vote for ${LETTER(o.idx)}`, `Szavazok erre: ${LETTER(o.idx)}`)}>
                  <img src={src(o)} alt={o.label || LETTER(o.idx)} />
                  <span className="pp-letter">{LETTER(o.idx)}</span>
                  {on && <span className="pp-mine">✓ {t('Your vote', 'Erre szavaztál')}</span>}
                  {win && <span className="pp-crown">👑</span>}
                </button>
                <button className="pp-zoom" onClick={() => setBig(o.idx)} aria-label={t('Enlarge', 'Nagyítás')}>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                    <circle cx="11" cy="11" r="6.5" />
                    <path d="M16 16l4 4M11 8.5v5M8.5 11h5" />
                  </svg>
                </button>
                <div className="pp-foot">
                  <span className="pp-name">{o.label || `${t('Design', 'Terv')} ${LETTER(o.idx)}`}</span>
                  {showRes ? (
                    <div className="pp-bar">
                      <i style={{ width: `${pct(o.votes)}%` }} />
                      <b>{pct(o.votes)}%</b>
                    </div>
                  ) : (
                    !owner && (
                      <button className="pp-vote" onClick={() => cast(o.idx, null)}>
                        {t('This one', 'Ez tetszik')}
                      </button>
                    )
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showRes && (
        <p className="fine">
          {total ? t(`${total} vote${total === 1 ? '' : 's'} so far`, `Eddig ${total} szavazat`) : t('No votes yet.', 'Még nincs szavazat.')}
        </p>
      )}

      {mine && !owner && (
        <div className="pp-note">
          {mine.commented && !note ? (
            <p className="pp-thanks">{t('Thanks! Your message was sent. 💌', 'Köszi! Elküldtük az üzeneted. 💌')}</p>
          ) : (
            <>
              <label htmlFor="pp-note">{t('Tell them why (optional)', 'Írd meg neki, miért (nem kötelező)')}</label>
              <textarea
                id="pp-note"
                maxLength={200}
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={single ? t('e.g. a bit smaller would be better', 'pl. kicsit kisebben jobb lenne') : t('e.g. B, but on the other arm', 'pl. a B, de a másik karodon')}
              />
              <button className="btn" disabled={!note.trim() || busy} onClick={sendNote}>
                {busy ? '…' : t('Send', 'Küldés')}
              </button>
            </>
          )}
        </div>
      )}

      {owner && comments.length > 0 && (
        <div className="pp-note">
          <label>{t('What your friends wrote', 'Amit a barátaid írtak')}</label>
          <ul className="pp-comments">
            {comments.map((c, i) => (
              <li key={i}>
                <small>{single ? (c.verdict ? VERD.find((v) => v[0] === c.verdict)?.[1] : '') : LETTER(c.idx)}</small> {c.comment}
              </li>
            ))}
          </ul>
        </div>
      )}

      {big !== null && p.options[big] && (
        <div className="pp-big" onClick={() => setBig(null)} role="dialog" aria-modal="true">
          <img src={src(p.options[big])} alt="" />
          <div className="pp-big-bar" onClick={(e) => e.stopPropagation()}>
            {hasOld && p.options[big].y50 && (
              <div className="flip" style={{ flex: 1 }}>
                <button className={!old ? 'on' : ''} onClick={() => setOld(false)}>
                  {t('Fresh', 'Frissen')}
                </button>
                <button className={old ? 'on' : ''} onClick={() => setOld(true)}>
                  {t('In 50 years', '50 év múlva')}
                </button>
              </div>
            )}
            {!single && !owner && (
              <button
                className="btn"
                onClick={() => {
                  cast(big, null);
                  setBig(null);
                }}
              >
                {mine?.idx === big ? `✓ ${LETTER(big)}` : t(`Vote ${LETTER(big)}`, `Erre szavazok (${LETTER(big)})`)}
              </button>
            )}
            <button className="btn ghost" onClick={() => setBig(null)}>
              {t('Close', 'Bezár')}
            </button>
          </div>
        </div>
      )}

      <div className="pp-cta">
        <h2>{t('See your own tattoo in 50 years', 'Nézd meg a saját tetoválásod 50 év múlva')}</h2>
        <p>{inApp ? t('Upload a photo, add a design, see it fresh and in 50 years.', 'Tölts fel egy fotót, adj hozzá mintát, és nézd meg frissen és 50 év múlva.') : t('One-tap sign-up with Google or Apple.', 'Egy koppintásos regisztráció Google- vagy Apple-fiókkal.')}</p>
        <Link className="btn wide" href={inApp ? '/app' : `/regisztracio${qOf(lang)}`} onClick={() => track('share_cta')}>
          {inApp ? t('Make my own', 'Elkészítem a sajátomat') : t('Register and try it', 'Regisztrálok és kipróbálom')}
        </Link>
      </div>
      <p className="fine">{t('AI simulation for inspiration.', 'MI-szimuláció inspirációnak.')}</p>
      <Report id={id} lang={lang} />
    </main>
  );
}
