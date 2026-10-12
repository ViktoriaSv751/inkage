import { getAuthed, json } from './server';
import { guestFrom, guestRefund, guestStart } from './guest';

/**
 * Counts one AI job against the daily limit (signed-in user or guest device),
 * so new AI features share the same fair-use and cost cap as previews.
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
    const { data, error } = await a.db.rpc('start_generation', { p_placement: label });
    if (error) return { ok: false as const, res: json({ error: 'Could not start your preview. Try again.' }, 500) };
    if (!data.ok) return { ok: false as const, res: json({ error: 'You reached your plan limit for now.', code: 'paywall' }, 402) };
    return { ok: true as const, owner: a.user.id, gid: data.gid as number, refund: async () => void (await a.db.rpc('refund_generation', { p_gid: data.gid })), withCookie };
  }
  const start = await guestStart(g!.id, g!.ipHash, label).catch(() => null);
  if (!start) return { ok: false as const, res: withCookie(json({ error: 'Could not start your preview. Try again.' }, 500)) };
  if (!start.ok)
    return {
      ok: false as const,
      res: withCookie(
        start.reason === 'busy'
          ? json({ error: 'So many people are trying InkAge today that free previews are paused. Try again tomorrow.', code: 'busy' }, 429)
          : json({ error: 'You used your free preview.', code: 'paywall' }, 402)
      ),
    };
  return { ok: true as const, owner: `guest:${g!.id}`, gid: start.gid!, refund: async () => void (await guestRefund(start.gid!, g!.id).catch(() => {})), withCookie };
}
