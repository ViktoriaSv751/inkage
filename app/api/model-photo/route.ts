import { logServerError } from '@/lib/errlog';
import { json } from '@/lib/server';
import { aiConfigured, friendlyAiError, makeImage } from '@/lib/ai';
import { startUnit } from '@/lib/meter';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const TONES: Record<string, string> = {
  1: 'very fair, light pink skin (Fitzpatrick I-II)',
  2: 'light beige skin (Fitzpatrick II-III)',
  3: 'medium olive skin (Fitzpatrick III-IV)',
  4: 'brown skin (Fitzpatrick IV-V)',
  5: 'dark brown skin (Fitzpatrick V-VI)',
};

/** "I don't have a good photo": a realistic stand-in photo of that body area, in the chosen skin tone. */
export async function POST(req: Request) {
  if (!aiConfigured()) return json({ error: 'The AI is not switched on yet.' }, 503);
  const body = await req.json().catch(() => ({}));
  const area = String(body.area || 'inner forearm').replace(/[^\p{L}\p{N} ,'()-]/gu, '').slice(0, 80);
  const tone = TONES[String(body.tone)] || TONES[3];
  const u = await startUnit(req, 'model photo');
  if (!u.ok) return u.res;
  try {
    const image = await makeImage(
      [
        `A realistic, unretouched smartphone photo of an adult's bare ${area}, ${tone}, natural daylight from a window.`,
        `The ${area} fills most of the frame and is photographed straight on, sharp focus, plain neutral background.`,
        'No tattoos, no jewellery, no text, no watermark, nothing covering the skin. Natural skin texture, pores and fine hairs visible.',
        'Only the body area, no face.',
      ].join(' '),
      768,
      1024
    );
    return u.withCookie(json({ image }));
  } catch (e) {
    console.error('model photo failed', e);
    await logServerError('model-photo', e);
    await u.refund();
    return u.withCookie(json({ error: friendlyAiError(e) }, 502));
  }
}
