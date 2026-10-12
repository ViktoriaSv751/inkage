import { dataUrlToBuffer, getAuthed, json, serverConfig, sha, signToken } from '@/lib/server';
import { aiConfigured, analyse, dataUrlToImg, editImage, freshPrompt, friendlyAiError } from '@/lib/ai';
import { guestFrom, guestRefund, guestStart } from '@/lib/guest';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function withCookie(res: Response, cookie: string | null) {
  if (cookie) res.headers.append('set-cookie', cookie);
  return res;
}

export async function POST(req: Request) {
  const cfg = serverConfig();
  if (!aiConfigured()) return json({ error: 'The AI is not switched on yet.' }, 503);
  if (!cfg.auth) return json({ error: 'The app is not fully set up yet.' }, 503);

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

  // Signed-in user, or a guest (first preview without an account).
  const a = await getAuthed(req);
  const guest = a ? null : guestFrom(req);
  let gid: number;
  let canAge: boolean;
  let remaining: number | null = null;
  let plan: string = 'guest';
  let owner: string;

  if (a) {
    const { data: start, error } = await a.db.rpc('start_generation', { p_placement: placement });
    if (error) return json({ error: 'Could not start your preview. Try again.' }, 500);
    if (!start.ok) {
      return json({ error: start.plan === 'free' ? 'You used your free preview.' : 'You reached your plan limit for now.', code: 'paywall', plan: start.plan }, 402);
    }
    gid = start.gid;
    canAge = start.canAge || start.plan === 'free'; // the free preview includes the aging stages too
    remaining = start.remaining - 1;
    plan = start.plan;
    owner = a.user.id;
  } else {
    const g = guest!;
    const start = await guestStart(g.id, g.ipHash, placement).catch(() => null);
    if (!start) return withCookie(json({ error: 'Could not start your preview. Try again.' }, 500), g.setCookie);
    if (!start.ok) {
      return withCookie(
        start.reason === 'busy'
          ? json({ error: 'So many people are trying InkAge today that free previews are paused. Try again tomorrow.', code: 'busy' }, 429)
          : json({ error: 'You used your free preview.', code: 'paywall', plan: 'guest' }, 402),
        g.setCookie
      );
    }
    gid = start.gid!;
    canAge = true;
    owner = `guest:${g.id}`;
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
    const analysis = await analyse(dataUrlToImg(image));
    const token = signToken({ uid: owner, gid, h: sha(image), w, hh: h, an: analysis, exp: Date.now() + 3600e3 });
    return withCookie(json({ image, token, age: analysis.apparentAge, canAge, remaining, plan }), guest?.setCookie ?? null);
  } catch (e) {
    console.error('generate failed', e);
    if (a) await a.db.rpc('refund_generation', { p_gid: gid });
    else await guestRefund(gid, guest!.id).catch(() => {});
    return withCookie(json({ error: friendlyAiError(e) }, 502), guest?.setCookie ?? null);
  }
}
