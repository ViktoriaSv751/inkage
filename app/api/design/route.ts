import { logServerError } from '@/lib/errlog';
import { dataUrlToBuffer, json } from '@/lib/server';
import { aiConfigured, designPrompt, editImage, friendlyAiError, makeImage } from '@/lib/ai';
import { startUnit } from '@/lib/meter';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Text → original tattoo designs (two variants to choose from),
 * or "like this, but…": a change to an existing design (body.base).
 */
export async function POST(req: Request) {
  if (!aiConfigured()) return json({ error: 'The AI is not switched on yet.' }, 503);
  const body = await req.json().catch(() => ({}));
  const text = String(body.text || '').replace(/\s+/g, ' ').trim().slice(0, 200);
  if (text.length < 3) return json({ error: 'Describe the design in a few words.' }, 400);
  const style = ['fine-line', 'blackwork', 'traditional'].includes(body.style) ? body.style : 'other';
  let base: { buf: Buffer; mime: string } | null = null;
  try {
    base = body.base ? dataUrlToBuffer(body.base) : null;
  } catch {}
  if (base && base.buf.length > 3_000_000) return json({ error: 'These images are too large. Use smaller photos.' }, 413);
  const u = await startUnit(req, base ? 'ai design change' : 'ai design');
  if (!u.ok) return u.res;
  try {
    let images: string[];
    if (base) {
      const prompt = [
        `This is a tattoo design. Change it like this: ${text}.`,
        'Keep everything else the same: subject, composition, line style and proportions, unless the change asks otherwise.',
        'Output: black ink on a pure white background, one isolated motif centred with generous white margin, no skin, no mockup, flat like a scanned drawing.',
      ].join(' ');
      images = [await editImage([{ ...base, name: 'design.png' }], prompt, 1024, 1024)];
    } else {
      const results = await Promise.allSettled([makeImage(designPrompt(text, style)), makeImage(designPrompt(`${text} (a different take on the same idea)`, style))]);
      images = results.filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled').map((r) => r.value);
      if (!images.length) throw (results[0] as PromiseRejectedResult).reason;
    }
    return u.withCookie(json({ image: images[0], images }));
  } catch (e) {
    console.error('design failed', e);
    await logServerError('design', e);
    await u.refund();
    return u.withCookie(json({ error: friendlyAiError(e) }, 502));
  }
}
