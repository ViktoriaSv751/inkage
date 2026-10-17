import { appSecret, getAuthed, json, userClient } from '@/lib/server';
import { guestFrom } from '@/lib/guest';

export const dynamic = 'force-dynamic';

const ok = (s: any) => typeof s === 'string' && /^data:image\/jpeg;base64,/.test(s) && s.length < 700_000;

/** A poll: 1–4 of your designs on one link, friends pick one (or say yes / change / no to a single one). */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const g = guestFrom(req);
  const a = await getAuthed(req);
  // close a poll made on this device or by this account
  const close = url.searchParams.get('close');
  if (close) {
    const { data, error } = await userClient().rpc('close_poll', { p_secret: appSecret('db'), p_share: close.slice(0, 20), p_guest: g.id, p_user: a?.user.id ?? null });
    return error ? json({ error: 'Could not close the link. Try again.' }, 500) : data ? json({ ok: true }) : json({ error: 'Link not found.' }, 404);
  }
  // results for polls made as a guest on this device
  if (url.searchParams.get('mine')) {
    const { data } = await userClient().rpc('my_polls', { p_secret: appSecret('db'), p_guest: g.id });
    return json({ polls: data || [] });
  }
  const body = await req.json().catch(() => ({}));
  const raw: any[] = Array.isArray(body.options) ? body.options.slice(0, 4) : [];
  if (!raw.length) return json({ error: 'Pick at least one design.' }, 400);
  if (raw.some((o) => !ok(o?.fresh) || (o.y50 != null && !ok(o.y50)))) return json({ error: 'An image is missing or too big. Try again.' }, 400);
  const options = raw.map((o) => ({
    label: String(o.label || '').slice(0, 60),
    placement: String(o.placement || '').slice(0, 200),
    score: Number.isFinite(Number(o.score)) ? String(Math.round(Number(o.score))) : '',
    fresh: o.fresh,
    y50: o.y50 || null,
  }));
  const { data, error } = await userClient().rpc('create_poll', {
    p_secret: appSecret('db'),
    p_guest: g.id,
    p_user: a?.user.id ?? null,
    p_question: String(body.question || '').trim().slice(0, 140) || null,
    p_options: options,
  });
  const res = error
    ? json({ error: /limit/.test(error.message) ? 'You shared a lot today. Try again tomorrow.' : 'Sharing failed. Try again.' }, /limit/.test(error.message) ? 429 : 500)
    : json({ id: data });
  if (g.setCookie) res.headers.append('set-cookie', g.setCookie);
  return res;
}
