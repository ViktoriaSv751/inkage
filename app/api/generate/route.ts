import { dataUrlToBuffer, getAuthed, json, serverConfig, sha, signToken } from '@/lib/server';
import { aiConfigured, analyse, dataUrlToImg, editImage, freshPrompt, friendlyAiError } from '@/lib/ai';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req: Request) {
  const cfg = serverConfig();
  if (!aiConfigured()) return json({ error: 'The AI is not switched on yet.' }, 503);
  if (!cfg.auth) return json({ error: 'Accounts are not set up yet.' }, 503);

  const a = await getAuthed(req);
  if (!a) return json({ error: 'Please sign in first.', code: 'auth' }, 401);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Bad request' }, 400);
  }
  const placement = String(body.placement || 'forearm').slice(0, 80).replace(/[^\p{L}\p{N} ,'()-]/gu, '');
  const size = ['small', 'medium', 'large'].includes(body.size) ? body.size : 'medium';
  let photo, design;
  try {
    photo = dataUrlToBuffer(body.photo);
    design = dataUrlToBuffer(body.design);
  } catch {
    return json({ error: 'Add both images again and retry.' }, 400);
  }
  if (photo.buf.length > 3_000_000 || design.buf.length > 3_000_000) return json({ error: 'These images are too large. Use smaller photos.' }, 413);

  // Reserve a preview first, so parallel requests can't go over the plan limit.
  const { data: start, error } = await a.db.rpc('start_generation', { p_placement: placement });
  if (error) return json({ error: 'Could not start your preview. Try again.' }, 500);
  if (!start.ok) {
    return json(
      { error: start.plan === 'free' ? 'You used your free preview.' : 'You reached your plan limit for now.', code: 'paywall', plan: start.plan },
      402
    );
  }

  try {
    const w = Number(body.w) || 1024;
    const h = Number(body.h) || 1024;
    const image = await editImage(
      [
        { ...photo, name: 'photo.jpg' },
        { ...design, name: 'design.png' },
      ],
      freshPrompt(placement, size),
      w,
      h
    );
    const analysis = start.canAge ? await analyse(dataUrlToImg(image)) : null;
    const token = start.canAge ? signToken({ uid: a.user.id, gid: start.gid, h: sha(image), w, hh: h, an: analysis, exp: Date.now() + 3600e3 }) : null;
    return json({ image, token, age: analysis?.apparentAge ?? null, canAge: start.canAge, remaining: start.remaining - 1, plan: start.plan });
  } catch (e) {
    console.error('generate failed', e);
    await a.db.rpc('refund_generation', { p_gid: start.gid });
    return json({ error: friendlyAiError(e) }, 502);
  }
}
