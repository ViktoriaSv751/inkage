'use client';
import { type Lang } from '@/lib/tr';

import type { PollComment, PollData } from '@/lib/share';
import { tx } from '@/lib/i18n';

const VERDICT: Record<string, [string, string]> = { yes: ['Get it 🔥', 'Csináltasd 🔥'], change: ['Change something ✏️', 'Változtass rajta ✏️'], no: ['Don’t 😬', 'Ne csináld 😬'] };

/** Results of a poll for its owner: a bar per design (or per answer with one design) and the comments. */
export function PollResults({ poll, comments, lang }: { poll: PollData; comments?: PollComment[]; lang: Lang }) {
  const t = (en: string, hu: string) => tx(lang, en, hu);
  const single = poll.options.length === 1;
  const total = poll.total || 0;
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);
  const rows = single
    ? (['yes', 'change', 'no'] as const).map((k) => ({ key: k, label: t(...VERDICT[k]), n: poll.options[0].verdicts[k], img: null as string | null }))
    : poll.options.map((o) => ({ key: String(o.idx), label: `${String.fromCharCode(65 + o.idx)} · ${o.label || ''}`, n: o.votes, img: o.y50 || o.fresh }));
  const top = Math.max(0, ...rows.map((r) => r.n));
  const label = (c: PollComment) => (single ? (c.verdict ? t(...VERDICT[c.verdict]) : '') : String.fromCharCode(65 + c.idx));
  return (
    <div>
      <div className="poll-res">
        {rows.map((r) => (
          <div key={r.key} className={`poll-bar ${total && r.n === top ? 'win' : ''}`} style={r.img ? undefined : { gridTemplateColumns: '1fr' }}>
            {r.img && <img src={r.img} alt="" />}
            <div className="track">
              <div className="fill" style={{ width: `${pct(r.n)}%` }} />
              <div className="lab">
                <span>
                  {total > 0 && r.n === top ? '👑 ' : ''}
                  {r.label}
                </span>
                <span>{total ? `${pct(r.n)}% · ${r.n}` : '0'}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      <p className="muted small" style={{ margin: '6px 0 0' }}>
        {total ? t(`${total} vote${total === 1 ? '' : 's'}`, `${total} szavazat`) : t('No votes yet — send the link to a few friends.', 'Még nincs szavazat – küldd el pár barátodnak.')}
      </p>
      {!!comments?.length && (
        <ul className="poll-comments">
          {comments.slice(0, 20).map((c, i) => (
            <li key={i}>
              {label(c) && <small>{label(c)}</small>}
              {c.comment}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
