import { appSecret, json, userClient } from '@/lib/server';
import { pushToUser } from '@/lib/push-server';
import { layout, sendMail, SITE } from '@/lib/mail';

export const dynamic = 'force-dynamic';

/** A picture was reported: tell the admins right away (push + e-mail), so reports are handled within 24 hours. */
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const share = String(b.share || '').slice(0, 40);
  const secret = appSecret('db');
  if (!share || !secret) return json({ ok: false }, 400);
  const { data } = await userClient().rpc('report_admin_targets', { p_secret: secret, p_share: share });
  const admins = (data || []) as { id: string; email: string }[];
  let pushed = 0;
  for (const a of admins) {
    pushed += await pushToUser(a.id, { title: 'InkAge: kép jelentve', body: 'Valaki jelentett egy megosztott képet. Nézd át 24 órán belül.', url: '/admin', tag: `report-${share}` }).catch(() => 0);
    await sendMail(
      a.email,
      'InkAge: jelentett kép',
      layout({ title: 'Jelentett kép', lines: [`Megosztás: ${share}`, '3 jelentés vagy egy „kiskorú” jelentés után a kép automatikusan elrejtődik.'], button: { href: `${SITE()}/admin`, label: 'Admin felület' }, foot: '' }),
      `${SITE()}/admin`
    ).catch(() => false);
  }
  return json({ ok: true, admins: admins.length, pushed });
}
