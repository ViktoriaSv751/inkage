import { appSecret, json, userClient } from '@/lib/server';
import { layout, sendMail, SITE } from '@/lib/mail';
import { pushToUser } from '@/lib/push-server';

export const dynamic = 'force-dynamic';

/** Someone voted: tell the owner (at most once an hour per link, only if they want it). */
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const share = String(b.share || '').slice(0, 40);
  if (!share) return json({ ok: false }, 400);
  const { data } = await userClient().rpc('vote_notify_target', { p_secret: appSecret('db'), p_share: share });
  const t = data as { user: string; email: string | null; placement: string | null; lang: string; votes: { yes: number; no: number; change: number } } | null;
  if (!t?.user) return json({ ok: true, sent: false });
  const hu = t.lang !== 'en';
  const v = t.votes || { yes: 0, no: 0, change: 0 };
  const pushed = await pushToUser(t.user, {
    title: hu ? 'Szavaztak a tetoválás-tervedre' : 'Someone voted on your tattoo idea',
    body: hu ? `Eddig: 👍 ${v.yes} · 👎 ${v.no} · ✏️ ${v.change}` : `So far: 👍 ${v.yes} · 👎 ${v.no} · ✏️ ${v.change}`,
    url: `/v/${share}`,
    tag: `vote-${share}`,
  }).catch(() => 0);
  if (!t.email) return json({ ok: true, sent: false, pushed });
  const sent = await sendMail(
    t.email,
    hu ? 'Szavaztak a tetoválás-tervedre' : 'Someone voted on your tattoo idea',
    layout({
      title: hu ? 'Új szavazat érkezett' : 'A new vote came in',
      lines: [hu ? `Eddig: 👍 ${v.yes} · 👎 ${v.no} · ✏️ ${v.change}` : `So far: 👍 ${v.yes} · 👎 ${v.no} · ✏️ ${v.change}`],
      button: { href: `${SITE()}/v/${share}`, label: hu ? 'Eredmények megnézése' : 'See the results' },
      foot: hu ? 'Ezeket az értesítéseket a Profil > Beállítások alatt kapcsolhatod ki.' : 'Turn these off under Profile > Settings.',
    }),
    `${SITE()}/v/${share}`
  );
  return json({ ok: true, sent, pushed });
}
