import { DEFAULT_ANALYSIS, type Analysis, type Img } from './types';
import { geminiCall, parts, textModels } from './providers';

const ANALYSIS_PROMPT = `You are analysing a photo for a tattoo-aging simulator. Reply with JSON only, no prose:
{"apparentAge": number (best estimate of the person's current age in years, 16-90),
 "skinTone": string (short description incl. Fitzpatrick type, e.g. "light olive, Fitzpatrick III"),
 "bodyArea": string (where the tattoo is, e.g. "inner left forearm"),
 "tattooStyle": one of "fine-line","blackwork","color","realism","traditional","other",
 "hasColor": boolean,
 "sunExposure": one of "low","medium","high" (how sun-exposed this body area usually is)}`;

export async function analyse(image: Img): Promise<Analysis> {
  if (!process.env.GEMINI_API_KEY) return DEFAULT_ANALYSIS;
  try {
    const data = await geminiCall(textModels(), {
      contents: [{ role: 'user', parts: [...parts([image]), { text: ANALYSIS_PROMPT }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
    });
    const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('') || '{}';
    const j = JSON.parse(text);
    return {
      apparentAge: Math.min(90, Math.max(16, Number(j.apparentAge) || DEFAULT_ANALYSIS.apparentAge)),
      skinTone: String(j.skinTone || DEFAULT_ANALYSIS.skinTone).slice(0, 80),
      bodyArea: String(j.bodyArea || DEFAULT_ANALYSIS.bodyArea).slice(0, 60),
      tattooStyle: ['fine-line', 'blackwork', 'color', 'realism', 'traditional'].includes(j.tattooStyle) ? j.tattooStyle : 'other',
      hasColor: !!j.hasColor,
      sunExposure: ['low', 'medium', 'high'].includes(j.sunExposure) ? j.sunExposure : 'medium',
    };
  } catch (e) {
    console.warn('analysis failed', e);
    return DEFAULT_ANALYSIS;
  }
}

// ---------------------------------------------------------------- checks

export type PhotoCheck = {
  ok: boolean;
  code: 'ok' | 'no_skin' | 'blurry' | 'dark' | 'not_allowed' | 'unknown';
  area: string;
  /** where the chosen body area's bare skin is in the photo, as fractions [top, left, bottom, right] */
  box?: [number, number, number, number] | null;
  /** angle of the limb's long axis in degrees (0 = vertical), when it's clear */
  angle?: number | null;
  /** rough outlines of the bare skin in the photo, as [x, y] fractions */
  skin?: [number, number][][] | null;
}

/** Turn [[y, x], ...] in 0-1000 into [[x, y], ...] fractions; drop junk. */
function polys(v: any): [number, number][][] | null {
  if (!Array.isArray(v)) return null;
  const out = v
    .filter((p: any) => Array.isArray(p) && p.length >= 3)
    .slice(0, 6)
    .map((p: any[]) =>
      p
        .filter((q) => Array.isArray(q) && q.length >= 2 && q.every((n: any) => Number.isFinite(Number(n))))
        .slice(0, 80)
        .map((q) => [Math.min(1, Math.max(0, Number(q[1]) / 1000)), Math.min(1, Math.max(0, Number(q[0]) / 1000))] as [number, number])
    )
    .filter((p: [number, number][]) => p.length >= 3);
  return out.length ? out : null;
}

/** Fast pre-check of the user's photo before we spend money on image generation. */
/** Server-side safety check of what goes into a preview, run alongside the generation (adds no waiting time).
 *  Blocks sexual content and minors in the photo, and hateful, extremist or sexual designs – Google Play requires
 *  AI apps to prevent restricted content, not only to let people report it. If the check itself fails it is tried once
 *  more, then the preview stops (fails closed) instead of letting anything through. */
export async function inputSafety(photo: Img | null, design: Img | null, retry = true): Promise<{ block: 'photo' | 'design' | null }> {
  if (!process.env.GEMINI_API_KEY || (!photo && !design)) return { block: null };
  try {
    const imgs = [photo, design].filter(Boolean) as Img[];
    const data = await geminiCall(textModels(), {
      contents: [
        {
          role: 'user',
          parts: [
            ...parts(imgs),
            {
              text: `${photo ? 'Image 1 is a body photo' : ''}${photo && design ? ', image 2' : 'The image'} ${design ? 'is a tattoo design the user wants to try on' : ''}. Reply with JSON only:
{${photo ? '"photoNotAllowed": boolean (true if the photo shows exposed genitals, exposed buttocks, a female nipple or areola, sexual activity, or a person who looks under 18),' : ''}
 ${design ? '"designNotAllowed": boolean (true ONLY if the design is clearly a hate symbol (e.g. swastika used as Nazi symbol, SS runes, white-power or terrorist emblems), praises violent extremism, or is sexually explicit; ordinary tattoo motifs such as skulls, weapons, religious symbols, nudes in classic art style, text and logos are fine)' : ''}}`,
            },
          ],
        },
      ],
      generationConfig: { responseMimeType: 'application/json', temperature: 0 },
    });
    const j = JSON.parse(data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('') || '{}');
    if (typeof (photo ? j.photoNotAllowed : j.designNotAllowed) !== 'boolean') throw new Error('safety check: no answer');
    return { block: j.photoNotAllowed ? 'photo' : j.designNotAllowed ? 'design' : null };
  } catch (e) {
    console.warn('input safety check failed', e);
    if (retry) return inputSafety(photo, design, false);
    throw new Error('The safety check could not run');
  }
}

export async function checkPhoto(photo: Img, placement: string, retry = true): Promise<PhotoCheck> {
  if (!process.env.GEMINI_API_KEY) return { ok: true, code: 'ok', area: placement };
  try {
    const data = await geminiCall(textModels(), {
      contents: [
        {
          role: 'user',
          parts: [
            ...parts([photo]),
            {
              text: `A user wants to preview a tattoo on their "${placement}". Check this photo and reply with JSON only:
{"skinVisible": boolean (is bare skin of a body area suitable for a tattoo clearly visible?),
 "sharp": boolean, "wellLit": boolean,
 "notAllowed": boolean (true if it shows exposed genitals, exposed buttocks, female breasts with a visible nipple or areola, any sexual content, or if the person looks under 18; a bare male chest or a covered chest is fine),
 "visibleArea": string (the main body area visible, e.g. "inner left forearm"),
 "box": [ymin, xmin, ymax, xmax] integers 0-1000 tightly around the bare skin of the ${placement} where a tattoo could go (exclude clothing, background and other body parts), or null if that area is not visible,
 "angle": number (angle in degrees of the long axis of that body part relative to vertical, positive = leaning right; 0 if unclear),
 "skin": array of up to 3 polygons, each an array of 6-16 [y, x] points (integers 0-1000) tracing the outline of a visible bare-skin region of the body (arms, legs, torso, back, neck, hands); exclude clothing, hair, jewellery, watches and the background; [] if none}`,
            },
          ],
        },
      ],
      generationConfig: { responseMimeType: 'application/json', temperature: 0 },
    });
    const j = JSON.parse(data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('') || '{}');
    const box =
      Array.isArray(j.box) && j.box.length === 4 && j.box.every((v: any) => Number.isFinite(Number(v)))
        ? (j.box.map((v: any) => Math.min(1, Math.max(0, Number(v) / 1000))) as [number, number, number, number])
        : null;
    const okBox = box && box[2] - box[0] > 0.04 && box[3] - box[1] > 0.04 ? box : null;
    const angle = Number.isFinite(Number(j.angle)) ? Math.max(-90, Math.min(90, Number(j.angle))) : null;
    const skin = polys(j.skin);
    if (j.notAllowed) return { ok: false, code: 'not_allowed', area: '' };
    if (j.skinVisible === false) return { ok: false, code: 'no_skin', area: String(j.visibleArea || ''), box: okBox, angle, skin };
    if (j.sharp === false) return { ok: false, code: 'blurry', area: String(j.visibleArea || ''), box: okBox, angle, skin };
    if (j.wellLit === false) return { ok: false, code: 'dark', area: String(j.visibleArea || ''), box: okBox, angle, skin };
    return { ok: true, code: 'ok', area: String(j.visibleArea || placement).slice(0, 60), box: okBox, angle, skin };
  } catch (e) {
    console.warn('photo check failed', e);
    // the long JSON sometimes comes back broken: one more try (not after a timeout – the user is waiting)
    if (retry && e instanceof SyntaxError) return checkPhoto(photo, placement, false);
    return { ok: true, code: 'unknown', area: placement };
  }
}
