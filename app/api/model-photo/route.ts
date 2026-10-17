import { logServerError } from '@/lib/errlog';
import { json } from '@/lib/server';
import { aiConfigured, checkPhoto, dataUrlToImg, friendlyAiError, makeImage } from '@/lib/ai';
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
    const prompt = (strict: boolean) =>
      [
        `A realistic, unretouched smartphone photo of an adult's ${area}, ${tone}, natural daylight from a window.`,
        `The ${area} fills most of the frame and is photographed straight on, sharp focus, plain neutral background.`,
        `The skin of the ${area} itself is bare. No tattoos, no jewellery, no text, no watermark on it. Natural skin texture, pores and fine hairs visible.`,
        // store rules + our own: never nude. Breasts, nipples, buttocks and genitals are always covered.
        'Strictly non-nude, non-sexual: breasts, nipples, buttocks and genitals are always fully covered by plain neutral clothing (a sports bra, swimwear top, tank top or underwear) wherever they would be in the frame.',
        strict ? 'Frame tightly on the target area so that no breast, nipple, buttock or genital area is in the picture at all.' : '',
        'Only the body area, no face.',
      ].join(' ');
    let image = await makeImage(prompt(false), 768, 1024);
    // double-check the stand-in photo; one stricter retry, then give up rather than show nudity
    const check = async (img: string) => (typeof img === 'string' && img.startsWith('data:') ? checkPhoto({ ...dataUrlToImg(img), name: 'model.jpg' }, area) : null);
    if ((await check(image))?.code === 'not_allowed') {
      image = await makeImage(prompt(true), 768, 1024);
      if ((await check(image))?.code === 'not_allowed') {
        await u.refund();
        return u.withCookie(json({ error: 'Could not make a suitable stand-in photo for this area. Please use your own photo.' }, 422));
      }
    }
    return u.withCookie(json({ image }));
  } catch (e) {
    console.error('model photo failed', e);
    await logServerError('model-photo', e);
    await u.refund();
    return u.withCookie(json({ error: friendlyAiError(e) }, 502));
  }
}
