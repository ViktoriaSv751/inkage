import { getAuthed, json, serverConfig } from '@/lib/server';
import { teaserTake } from '@/lib/teaser';

export const dynamic = 'force-dynamic';

/* After a package is bought: the teaser's sharp originals (today + 50 years, or 10 laser sessions) and the tokens to make
   the other years from them. Refused while the account has no package. */
export async function POST(req: Request) {
  if (!serverConfig().auth) return json({ error: 'Not set up yet.' }, 503);
  const a = await getAuthed(req);
  if (!a) return json({ error: 'Please sign in again.', code: 'auth' }, 401);
  const body = await req.json().catch(() => ({}));
  const gid = Number(body.gid);
  if (!Number.isFinite(gid) || gid <= 0) return json({ error: 'Bad request' }, 400);
  try {
    const r = await teaserTake(a.user.id, gid);
    if (!r.ok) return json({ error: r.reason === 'paywall' ? 'Choose a package to unlock it.' : 'This preview was not found.', code: r.reason }, r.reason === 'paywall' ? 402 : 404);
    return json(r);
  } catch (e) {
    console.error('teaser unlock failed', e);
    return json({ error: 'Could not unlock it. Try again.' }, 500);
  }
}
