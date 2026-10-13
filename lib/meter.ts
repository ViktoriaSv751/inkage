import { getAuthed, json } from './server';
import { guestFrom, guestHelperStart, guestRefund } from './guest';

/**
 * Counts one helper AI job (cut-out, AI design, redraw) against its own daily allowance,
 * separate from previews, so using them never eats into someone's previews.
 */
export async function startUnit(req: Request, label: string) {
  const a = await getAuthed(req);
  const g = a ? null : guestFrom(req);
  const cookie = g?.setCookie ?? null;
  const withCookie = (res: Response) => {
    if (cookie) res.headers.append('set-cookie', cookie);
    return res;
  };
  if (a) {
    const { data, error } = await a.db.rpc('helper_start', { p_label: label });
    if (error) return { ok: false as const, res: json({ error: 'Could not start your preview. Try again.' }, 500) };
    if (!data.ok)
      return {
        ok: false as const,
        res:
          data.reason === 'busy'
            ? json({ error: 'So many people are trying InkAge today that free previews are paused. Try again tomorrow.', code: 'busy' }, 429)
            : json({ error: 'You used today’s cut-outs and AI drawings. Try again tomorrow.', code: 'helper_limit' }, 429),
      };
    return { ok: true as const, owner: a.user.id, gid: data.gid as number, refund: async () => void (await a.db.rpc('refund_generation', { p_gid: data.gid })), withCookie };
  }
  const start = await guestHelperStart(g!.id, g!.ipHash, label).catch(() => null);
  if (!start) return { ok: false as const, res: withCookie(json({ error: 'Could not start your preview. Try again.' }, 500)) };
  if (!start.ok)
    return {
      ok: false as const,
      res: withCookie(
        start.reason === 'busy'
          ? json({ error: 'So many people are trying InkAge today that free previews are paused. Try again tomorrow.', code: 'busy' }, 429)
          : json({ error: 'You used today’s cut-outs and AI drawings. Try again tomorrow.', code: 'helper_limit' }, 429)
      ),
    };
  return { ok: true as const, owner: `guest:${g!.id}`, gid: start.gid!, refund: async () => void (await guestRefund(start.gid!, g!.id).catch(() => {})), withCookie };
}
