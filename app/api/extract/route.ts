import { dataUrlToBuffer, json } from '@/lib/server';
import { aiConfigured, editImage, extractPrompt, friendlyAiError } from '@/lib/ai';
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
    const image = await editImage([{ ...img, name: 'design.jpg' }], extractPrompt(body.color === true), 1024, 1024);
    return u.withCookie(json({ image }));
  } catch (e) {
    console.error('extract failed', e);
    await u.refund();
    return u.withCookie(json({ error: friendlyAiError(e) }, 502));
  }
}
