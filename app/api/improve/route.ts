import { logServerError } from '@/lib/errlog';
import { dataUrlToBuffer, json } from '@/lib/server';
import { aiConfigured, editImage, friendlyAiError, improvePrompt } from '@/lib/ai';
import { startUnit } from '@/lib/meter';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** "Make it last": redraws a design with bolder lines and fewer tiny details. */
export async function POST(req: Request) {
  if (!aiConfigured()) return json({ error: 'The AI is not switched on yet.' }, 503);
  const body = await req.json().catch(() => ({}));
  let design;
  try {
    design = dataUrlToBuffer(body.design);
  } catch {
    return json({ error: 'Add both images again and retry.' }, 400);
  }
  if (design.buf.length > 3_000_000) return json({ error: 'These images are too large. Use smaller photos.' }, 413);
  const u = await startUnit(req, 'improve design');
  if (!u.ok) return u.res;
  try {
    const sizeCm = Number(body.sizeCm) > 0 ? Number(body.sizeCm) : null;
    const image = await editImage([{ ...design, name: 'design.png' }], improvePrompt(sizeCm), 1024, 1024);
    return u.withCookie(json({ image }));
  } catch (e) {
    console.error('improve failed', e);
    await logServerError('improve', e);
    await u.refund();
    return u.withCookie(json({ error: friendlyAiError(e) }, 502));
  }
}
