import { tx, isLang, type Lang } from '@/lib/tr';
import { appSecret, json, userClient } from '@/lib/server';
import { sendMail, SITE } from '@/lib/mail';
import { voteEmail } from '@/lib/mail-engage';
import { SUPABASE_URL } from '@/lib/supabase/config';
import { pushToUser } from '@/lib/push-server';

export const dynamic = 'force-dynamic';

/** Someone voted: tell the owner (at most once an hour per link, only if they want it). */
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const share = String(b.share || '').slice(0, 40);
  if (!share) return json({ ok: false }, 400);
  const { data } = await userClient().rpc('vote_notify_target', { p_secret: appSecret('db'), p_share: share });
  const t = data as { user: string; email: string | null; placement: string | null; lang: string; poll?: boolean; total?: number; leader?: { label?: string | null; votes: number; path: string } | null; paths?: Record<string, string> | null; votes: { yes: number; no: number; change: number } } | null;
  if (!t?.user) return json({ ok: true, sent: false });
  const lang: Lang = isLang(t.lang) ? t.lang : 'hu';
  const v = t.votes || { yes: 0, no: 0, change: 0 };
  const so = t.poll ? (tx(lang, `${t.total} votes so far – see which one leads`, `Eddig ${t.total} szavazat – nézd meg, melyik vezet`)) : null;
  const pushed = await pushToUser(t.user, {
    title: tx(lang, 'Someone voted on your tattoo idea', 'Szavaztak a tetoválás-tervedre'),
    body: so || (tx(lang, `So far: 👍 ${v.yes} · 👎 ${v.no} · ✏️ ${v.change}`, `Eddig: 👍 ${v.yes} · 👎 ${v.no} · ✏️ ${v.change}`)),
    url: `/v/${share}`,
    tag: `vote-${share}`,
  }).catch(() => 0);
  if (!t.email) return json({ ok: true, sent: false, pushed });
  // the picture the voters saw: the leading option of a poll, or the shared preview at 50 years
  const path = t.poll ? t.leader?.path : t.paths?.y50 || t.paths?.fresh;
  const image = !path ? null : path.startsWith('/') ? `${SITE()}${path}` : `${SUPABASE_URL}/storage/v1/object/public/shares/${path}`;
  const m = voteEmail(lang, { share, image, votes: v, poll: t.poll ? { total: Number(t.total) || 0, label: t.leader?.label, leaderVotes: t.leader?.votes || 0 } : null });
  const sent = await sendMail(t.email, m.subject, m.html, m.text);
  return json({ ok: true, sent, pushed });
}
