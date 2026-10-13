import { logServerError } from '@/lib/errlog';
import { dataUrlToBuffer, json } from '@/lib/server';
import { aiConfigured, dataUrlToImg, editImage, extractCheck, extractPrompt, friendlyAiError } from '@/lib/ai';
import { startUnit } from '@/lib/meter';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/** Cut just the tattoo design out of an uploaded photo. */
export async function POST(req: Request) {
  if (!aiConfigured()) return json({ error: 'The AI is not switched on yet.' }, 503);
  const body = await req.json().catch(() => ({}));
  let img;
  try {
    img = dataUrlToBuffer(body.image);
  } catch {
    return json({ error: 'Add both images again and retry.' }, 400);
  }
  if (img.buf.length > 3_000_000) return json({ error: 'These images are too large. Use smaller photos.' }, 413);
  const u = await startUnit(req, 'extract design');
  if (!u.ok) return u.res;
  try {
    const src = { ...img, name: 'design.jpg' };
    const color = body.color === true;
    // cut out, then check it against the photo: same design, nothing extra left in. One targeted retry if not.
    let image = await editImage([src], extractPrompt(color), 1024, 1024);
    let check = await extractCheck(src, dataUrlToImg(image));
    if (!check.ok) {
      console.warn('extract check failed, retrying', check);
      const again = await editImage([src], extractPrompt(color, check.fix), 1024, 1024).catch(() => null);
      if (again) {
        const c2 = await extractCheck(src, dataUrlToImg(again));
        if (c2.match >= check.match) ((image = again), (check = c2));
      }
    }
    return u.withCookie(json({ image, match: check.match }));
  } catch (e) {
    console.error('extract failed', e);
    await logServerError('extract', e);
    await u.refund();
    return u.withCookie(json({ error: friendlyAiError(e) }, 502));
  }
}
