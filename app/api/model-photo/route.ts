import sharp from 'sharp';
import { logServerError } from '@/lib/errlog';
import { appSecret, json, userClient } from '@/lib/server';
import { aiConfigured, checkPhoto, dataUrlToImg, friendlyAiError, makeImageFast } from '@/lib/ai';
import { startUnit } from '@/lib/meter';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const TONES: Record<string, string> = {
  1: 'very fair, light pink skin (Fitzpatrick I-II)',
  2: 'light beige skin (Fitzpatrick II-III)',
  3: 'medium olive skin (Fitzpatrick III-IV)',
  4: 'brown skin (Fitzpatrick IV-V)',
  5: 'dark brown skin (Fitzpatrick V-VI)',
};
// areas where clothing matters: the stand-in photo is checked for nudity before it's shown
const RISKY = /chest|breast|rib|side|stomach|belly|abdomen|hip|back|spine|shoulder blade|thigh|buttock|glute|pelvi|torso|sternum|collar|waist/i;

const jpeg = async (dataUrl: string) => {
  const buf = Buffer.from(dataUrl.split(',')[1] || '', 'base64');
  const out = await sharp(buf).rotate().resize({ width: 900, height: 1200, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 84, mozjpeg: true }).toBuffer();
  return `data:image/jpeg;base64,${out.toString('base64')}`;
};

/** "I don't have a good photo": a realistic stand-in photo of that body area, in the chosen skin tone. */
export async function POST(req: Request) {
  if (!aiConfigured()) return json({ error: 'The AI is not switched on yet.' }, 503);
  const body = await req.json().catch(() => ({}));
  const area = String(body.area || 'inner forearm').replace(/[^\p{L}\p{N} ,'()-]/gu, '').slice(0, 80);
  const toneN = Math.min(5, Math.max(1, Number(body.tone) || 3));
  const tone = TONES[String(toneN)];
  const fresh = !!body.fresh;
  const secret = appSecret('db');
  const db = userClient();

  // ready ones first: instant
  if (!fresh && secret) {
    const { data } = await db.rpc('model_photo_get', { p_secret: secret, p_area: area, p_tone: toneN, p_not: Number(body.not) || null });
    if (data?.image) return json({ image: data.image, id: data.id, cached: true });
  }

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
    let image = await jpeg(await makeImageFast(prompt(false), 768, 1024));
    // double-check where clothing matters; one stricter retry, then give up rather than show nudity
    if (RISKY.test(area)) {
      const check = async (img: string) => checkPhoto({ ...dataUrlToImg(img), name: 'model.jpg' }, area);
      if ((await check(image))?.code === 'not_allowed') {
        image = await jpeg(await makeImageFast(prompt(true), 768, 1024));
        if ((await check(image))?.code === 'not_allowed') {
          await u.refund();
          return u.withCookie(json({ error: 'Could not make a suitable stand-in photo for this area. Please use your own photo.' }, 422));
        }
      }
    }
    // kept for the next person who asks for the same area and tone
    const id = secret ? (await db.rpc('model_photo_put', { p_secret: secret, p_area: area, p_tone: toneN, p_image: image })).data : null;
    return u.withCookie(json({ image, id }));
  } catch (e) {
    console.error('model photo failed', e);
    await logServerError('model-photo', e);
    await u.refund();
    return u.withCookie(json({ error: friendlyAiError(e) }, 502));
  }
}
