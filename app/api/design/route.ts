import { json } from '@/lib/server';
import { aiConfigured, designPrompt, friendlyAiError, makeImage } from '@/lib/ai';
import { startUnit } from '@/lib/meter';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/** Text → original tattoo design. */
export async function POST(req: Request) {
  if (!aiConfigured()) return json({ error: 'The AI is not switched on yet.' }, 503);
  const body = await req.json().catch(() => ({}));
  const text = String(body.text || '').replace(/\s+/g, ' ').trim().slice(0, 200);
  if (text.length < 3) return json({ error: 'Describe the design in a few words.' }, 400);
  const style = ['fine-line', 'blackwork', 'traditional'].includes(body.style) ? body.style : 'other';
  const u = await startUnit(req, 'ai design');
  if (!u.ok) return u.res;
  try {
    const image = await makeImage(designPrompt(text, style));
    return u.withCookie(json({ image }));
  } catch (e) {
    console.error('design failed', e);
    await u.refund();
    return u.withCookie(json({ error: friendlyAiError(e) }, 502));
  }
}
