import { tx, isLang } from '@/lib/tr';
import { logServerError } from '@/lib/errlog';
import { dataUrlToBuffer, getAuthed, json, serverConfig, sha, signToken } from '@/lib/server';
import { aiConfigured, analyse, dataUrlToImg, editImage, freshPrompt, friendlyAiError, placedPrompt, QC, qualityCheck, REDO } from '@/lib/ai';
import { pasteBack } from '@/lib/composite';
import { jobPut } from '@/lib/jobs';
import { longevity } from '@/lib/score';
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
  const placement = String(body.placement || 'forearm').slice(0, 200).replace(/[^\p{L}\p{N} ,'()-]/gu, '');
  const size = ['small', 'medium', 'large'].includes(body.size) ? body.size : 'medium';
  const existing = body.mode === 'existing';
  let photo, design;
  try {
    photo = dataUrlToBuffer(body.photo);
    design = existing ? photo : dataUrlToBuffer(body.design);
  } catch {
    return json({ error: 'Add both images again and retry.' }, 400);
  }
  if (photo.buf.length > 3_000_000 || design.buf.length > 3_000_000 || String(body.mask || '').length > 1_500_000) return json({ error: 'These images are too large. Use smaller photos.' }, 413);

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
    // an account is needed to use InkAge (free after sign-up)
    if (process.env.ALLOW_GUESTS !== '1') return json({ error: 'Sign in to continue.', code: 'auth' }, 401);
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
    let mockup: { buf: Buffer; mime: string } | null = null;
    try {
      mockup = body.mockup ? dataUrlToBuffer(body.mockup) : null;
    } catch {}
    const colorMode = body.colorMode === 'color' ? 'color' : 'black';
    const designImg = { ...design, name: 'design.png' };
    let mask: Buffer | null = null;
    try {
      mask = body.mask ? dataUrlToBuffer(body.mask).buf : null;
    } catch {}
    // what the user said was wrong last time ("Not right?")
    const redo = (Array.isArray(body.redo) ? body.redo : []).map((k: any) => REDO[String(k)]).filter(Boolean).join(' ');
    const run = (fix = '') => {
      const extra = [redo, fix ? `A previous attempt had these problems, avoid them: ${fix}.` : ''].filter(Boolean).join(' ');
      return mockup
        ? editImage([{ ...photo, name: 'photo.jpg' }, { ...mockup, name: 'mockup.jpg' }, designImg], placedPrompt(placement, colorMode, extra), w, h)
        : editImage([{ ...photo, name: 'photo.jpg' }, designImg], freshPrompt(placement, size, extra), w, h);
    };
    // Paste-back: outside the tattoo area the original photo's pixels are kept, so clothes, face and background can't change.
    const protect = async (img: string) => {
      if (!mask) return img;
      try {
        const r = await pasteBack(photo.buf, dataUrlToImg(img).buf, mask);
        console.log('paste-back', { applied: r.applied, diff: Math.round(r.diff * 10) / 10 });
        return r.image ? `data:image/jpeg;base64,${r.image.toString('base64')}` : img;
      } catch (e) {
        console.warn('paste-back failed', e);
        return img;
      }
    };

    let image: string;
    let qc: QC = { ok: true, match: 10, note: '', fix: '' };
    let analysis;
    if (existing) {
      // The user already has this tattoo: today's photo IS the fresh stage.
      image = body.photo;
      analysis = await analyse(dataUrlToImg(image));
    } else {
      // Generate, then check against the design (and analyse the skin at the same time).
      image = await protect(await run());
      let [q, an] = await Promise.all([qualityCheck(designImg, dataUrlToImg(image), mockup ? { ...mockup, name: 'mockup.jpg' } : null), analyse(dataUrlToImg(image))]);
      if (!q.ok) {
        // One new candidate, told exactly what went wrong; keep the better of the two.
        // (Two parallel candidates made a failed check cost three paid images.)
        console.warn('qc failed, retrying with feedback', q);
        const more = await Promise.all(
          [0].map(async () => {
            const img = await run(q.fix).catch(() => null);
            if (!img) return null;
            const safe = await protect(img);
            return { img: safe, q: await qualityCheck(designImg, dataUrlToImg(safe), mockup ? { ...mockup, name: 'mockup.jpg' } : null) };
          })
        );
        for (const c of more) if (c && c.q.match > q.match) ((image = c.img), (q = c.q));
      }
      qc = q;
      analysis = an;
    }

    // the age the user told us beats a guess from a photo of an arm
    const AGE: Record<string, number> = { '18-24': 21, '25-34': 30, '35-44': 40, '45-54': 50, '55+': 60 };
    if (AGE[body.ageHint]) analysis = { ...analysis, apparentAge: AGE[body.ageHint] };
    const lang = isLang(body.lang) ? body.lang : 'en';
    const sun = ['low', 'medium', 'high'].includes(body.sun) ? body.sun : analysis.sunExposure;
    const input = {
      style: analysis.tattooStyle,
      hasColor: existing ? analysis.hasColor : colorMode === 'color' && analysis.hasColor,
      sun,
      placement: `${placement} ${analysis.bodyArea}`,
      sizeCm: Number.isFinite(Number(body.sizeCm)) && Number(body.sizeCm) > 0 ? Number(body.sizeCm) : null,
      detail: Number.isFinite(Number(body.detail)) ? Math.min(1, Math.max(0, Number(body.detail))) : null,
      age: analysis.apparentAge,
    };
    // the inputs travel with the report, so the app can show the same design's score on other body areas
    const report = { ...longevity(input, lang), input };
    const token = signToken({ uid: owner, gid, h: sha(image), w, hh: h, an: { ...analysis, sunExposure: sun }, y: 0, exp: Date.now() + 3 * 3600e3 });
    const out = { image, token, age: analysis.apparentAge, analysis, report, qc: qc.match, qcNote: qc.ok ? '' : qc.note, canAge, remaining, plan };
    // keep it for a while, in case the app was closed while we were working
    await jobPut(body.job, owner, 'fresh', out);
    return withCookie(json(out), guest?.setCookie ?? null);
  } catch (e) {
    console.error('generate failed', e);
    await logServerError('generate', e);
    await jobPut(body.job, owner, 'error', friendlyAiError(e));
    if (a) await a.db.rpc('refund_generation', { p_gid: gid });
    else await guestRefund(gid, guest!.id).catch(() => {});
    return withCookie(json({ error: friendlyAiError(e) }, 502), guest?.setCookie ?? null);
  }
}
