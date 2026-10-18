import { tx, type Lang, LANG_INFO } from '@/lib/tr';
import OpenAI, { toFile } from 'openai';

export const STAGES = ['healed', 'y10', 'y30', 'y50'] as const;
export type Stage = (typeof STAGES)[number];
/** Laser removal preview after N sessions. */
export const REMOVAL = ['laser3', 'laser6', 'laser10'] as const;
export type RemovalStage = (typeof REMOVAL)[number];
const STAGE_YEARS: Record<Stage, number> = { healed: 1, y10: 10, y30: 30, y50: 50 };

type Img = { buf: Buffer; mime: string; name: string };

/** What the AI sees in the photo; drives person-specific aging. */
export type Analysis = {
  apparentAge: number;
  skinTone: string; // e.g. "light olive, Fitzpatrick III"
  bodyArea: string; // where the tattoo actually landed
  tattooStyle: 'fine-line' | 'blackwork' | 'color' | 'realism' | 'traditional' | 'other';
  hasColor: boolean;
  sunExposure: 'low' | 'medium' | 'high';
};

const DEFAULT_ANALYSIS: Analysis = {
  apparentAge: 28,
  skinTone: 'medium skin tone',
  bodyArea: 'forearm',
  tattooStyle: 'other',
  hasColor: false,
  sunExposure: 'medium',
};

// ---------------------------------------------------------------- prompts

const KEEP =
  'This is a photo edit, not a new image. Keep the exact same person, body shape, pose, hands, clothing, background, lighting, colour grading, camera angle, framing, depth of field and image grain. Do not crop, zoom, mirror or re-frame. Do not add text, watermarks or extra tattoos. The result must look like an unretouched smartphone photo.';

const STAY_ON_BODY =
  'Every line of the tattoo must be on skin: never on the background, clothing, jewellery or objects. Follow the user\'s position and size; if the overlay deliberately continues onto neighbouring skin (for example from the shoulder onto the chest), keep it there and let it wrap naturally across both areas. Only where it would leave the body entirely, pull it back onto the skin. Wrap it around the curvature of the body (lines near the edges get foreshortened as the skin turns away from the camera).';

export function freshPrompt(placement: string, size: string, extra = '') {
  const sizeText =
    size === 'small' ? 'small (about 4–6 cm across)' : size === 'large' ? 'large (covering most of that body area)' : 'medium (about 8–12 cm across)';
  return [
    'Image 1 is a real photo of a person. Image 2 is a tattoo design.',
    `Tattoo the design from image 2 onto the person's ${placement} in image 1. Size: ${sizeText}, proportionate to that body part.`,
    "Reproduce the design's exact linework, proportions, spacing and colours faithfully — do not redesign, simplify or add elements. If image 2 shows a design on someone else's skin, transfer only the design itself.",
    'Make it a real tattoo done today by a skilled artist: ink sits in the skin, not on top of it; it follows the curvature of the muscles and the perspective of the camera; it is lit by the same light and shadows as the surrounding skin; skin pores, fine hairs and texture remain visible through the ink.',
    'Fresh-tattoo details: crisp, dark, very slightly glossy lines. Do NOT add any redness, red or pink outline, halo, glow, shadow line or border around the tattoo, and do not add any line, outline, colour or shape that is not in the design; the skin around the ink stays exactly as in the photo.',
    'If that body area is not visible, place it on the closest visible area that makes anatomical sense.',
    STAY_ON_BODY,
    KEEP,
    extra,
  ].filter(Boolean).join(' ');
}

/** Used when the user positioned the design themselves in the editor (3 images: photo, mockup, design). */
export function placedPrompt(placement: string, colorMode: 'black' | 'color', extra = '') {
  return [
    'Image 1 is a real photo of a person. Image 2 is the same photo with a flat digital overlay that shows EXACTLY where the tattoo goes, how big it is and how it is rotated. Image 3 is the original tattoo design.',
    `Turn the overlay into a real tattoo on the person's ${placement}: same position, same size, same rotation and the same orientation as in image 2 – do not straighten, turn, tilt or flip it, even if it looks unusual. Image 3 is already turned to that final orientation. Use image 3 for the exact linework and details.`,
    'If image 3 shows anything besides the tattoo design itself (another person, their skin, clothes, a background), ignore all of that and transfer only the inked design.',
    colorMode === 'black'
      ? 'Use black ink only (no colours), as a skilled artist would execute this design.'
      : "Keep the design's original colours.",
    'The ink sits in the skin, follows the curvature of the muscles and the camera perspective, is lit by the same light and shadows as the surrounding skin, and lets pores, fine hairs and skin texture show through.',
    'Fresh-tattoo details: crisp, dark, very slightly glossy lines. Do NOT add any redness, red or pink outline, halo, glow or border around the tattoo, and never add lines, outlines or colours that are not in image 3; the skin around the ink stays exactly as in image 1.',
    'The final image must look like image 1 (no overlay artefacts, no flat sticker look).',
    STAY_ON_BODY,
    KEEP,
    extra,
  ].filter(Boolean).join(' ');
}

function inkAging(a: Analysis, years: number) {
  const fine = a.tattooStyle === 'fine-line';
  const color = a.hasColor || a.tattooStyle === 'color' || a.tattooStyle === 'realism';
  const friction = /hand|kéz|finger|ujj|palm|tenyér|wrist|csukló|foot|lábfej|feet|ankle|boka/i.test(a.bodyArea || '');
  if (years <= 1)
    return 'The tattoo is fully healed: no redness, no shine, no scabbing; the ink has settled a hair deeper into the skin so lines look very slightly softer and matte. Colours are as bright as they will ever be.';
  // calibrated to how real tattoos age: slow migration, measured in fractions of a millimetre
  const widen = years >= 50 ? 'about 0.5–1 mm' : years >= 30 ? 'about 0.3–0.6 mm' : 'about 0.1–0.3 mm';
  return [
    `After ${years} years the ink has migrated only slowly in the skin: every line is ${widen} wider than when fresh, with slightly softer edges${fine && years >= 30 ? ', and the very thinnest hairlines are a little broken or faint in places' : ''}.`,
    'The design stays clearly recognisable and keeps its shape, layout and proportions: no ink clouds, no smudges, no spreading of colour across the skin, no lines melting into blobs. When in doubt, change less, not more.',
    `Blacks look ${years >= 30 ? 'slightly lighter and a touch blue-grey or charcoal' : 'very slightly less deep'}${years >= 30 ? ' – still clearly dark' : ''}.`,
    color ? `Colours are ${years >= 30 ? 'faded and less saturated (yellows, whites and pastels faded the most, reds slightly toward brick)' : 'a little duller'}, but still the same colours.` : '',
    years >= 30 ? 'Only details finer than about 1 mm (tiny dots, very tight gaps) have started to fill in.' : 'Small details are still readable.',
    friction ? 'On hands, fingers and feet daily friction and washing fade ink faster: the tattoo is a bit lighter and patchier than elsewhere would be, but it does not spread or blur more.' : '',
    a.sunExposure === 'high' ? 'Frequent sun has faded it somewhat more than average.' : '',
    'The tattoo follows the aged skin underneath it (new fine creases, slight slackness) without moving or changing size.',
  ]
    .filter(Boolean)
    .join(' ');
}
function skinAging(a: Analysis, years: number) {
  const age = Math.round(a.apparentAge + years);
  if (years <= 1) return `The person and their skin look the same as today (about ${a.apparentAge} years old).`;
  const area = a.bodyArea || 'this body area';
  const lines: string[] = [`Age the person realistically to about ${age} years old, keeping their identity and ${a.skinTone}.`];
  if (age < 45)
    lines.push(`Skin on the ${area} is still firm, with slightly more visible texture and fine lines than today.`);
  else if (age < 60)
    lines.push(
      `Skin on the ${area} shows early aging: finer crinkling when relaxed, slightly looser elasticity, a few small sun spots or uneven pigmentation, more visible veins.`
    );
  else if (age < 75)
    lines.push(
      `Skin on the ${area} looks like a ${age}-year-old's: thinner and drier, crepey fine wrinkles, visible laxity, scattered age spots, more prominent veins and tendons, some loss of fat and muscle volume.`
    );
  else
    lines.push(
      `Skin on the ${area} looks like an elderly person's (${age}): very thin, crepey, papery skin with many fine wrinkles and folds, pronounced age spots and uneven pigmentation, prominent veins and tendons, noticeably less muscle and fat volume, perhaps a few senile purpura bruises or skin tags.`
    );
  lines.push('If the face or hair is visible, age them consistently (greying/thinning hair, facial lines) while keeping the same person.');
  return lines.join(' ');
}

export const stageYears = (s: Stage) => STAGE_YEARS[s];

/**
 * Age the photo to `stage`. With `fromYears` > 0 the input is already an aged image
 * (e.g. the 10-year one), so the result stays consistent across stages.
 */
export function agePrompt(stage: Stage, a: Analysis, fromYears = 0) {
  const years = STAGE_YEARS[stage];
  const delta = years - fromYears;
  const head =
    fromYears > 0
      ? `This photo shows a person with a tattoo, ${fromYears} years after it was done (the person is about ${Math.round(a.apparentAge + fromYears)} now). Show this exact same photo ${delta} years later, ${years} years after the tattoo was done. Continue from what you see: keep every change that already happened and add only the small extra change of these ${delta} years – do not exaggerate or repeat the aging that is already there.`
      : `This photo shows a person with a tattoo. Show this exact same photo ${years === 1 ? 'one year later' : `${years} years later`}.`;
  return [
    head,
    inkAging(a, years),
    skinAging(a, years),
    'The tattoo stays exactly where it is, at the same size and angle, with the same design; only aging changes it.',
    'The change must be medically and physically realistic, like real photos of people with tattoos of that age — subtle rather than dramatic, never exaggerated, cartoonish or a filter.',
    KEEP,
  ].join(' ');
}

export function removalPrompt(stage: RemovalStage, a: Analysis) {
  const n = stage === 'laser3' ? 3 : stage === 'laser6' ? 6 : 10;
  const color = a.hasColor || a.tattooStyle === 'color' || a.tattooStyle === 'realism';
  // calibrated to typical clinic results for a professional tattoo (Q-switched / picosecond laser, 6–8 weeks apart)
  const look =
    n === 3
      ? 'it is only about 20–35% lighter: the whole design is still clearly visible and readable, lines are intact but greyer and a little uneven, dense black areas are still dark'
      : n === 6
        ? 'it is roughly half as dark: the whole design is still visible as a grey, patchy version of itself, outlines are broken in places, dense areas and overlapping lines stay noticeably darker'
        : 'it is about 70–85% lighter but NOT gone: a faint grey ghost of the whole design is still visible, with darker remnants where the ink was densest; small tattoos with dense professional ink also keep visible traces';
  return [
    `This photo shows a person with a tattoo. Show the same photo after ${n} laser tattoo removal sessions, fully healed (no blisters, no redness, no scabs).`,
    `After ${n} sessions ${look}.`,
    color ? 'Colours fade unevenly: black and dark blue respond best; green, light blue, yellow and white persist much longer as faint stains.' : '',
    n === 10 ? 'The skin may show slight texture change or faint lighter patches where the ink was.' : '',
    'Small size does not make it disappear faster: it fades at the same rate, still visible.',
    `The person's age and skin (${a.skinTone}) stay the same as today; only the tattoo area changes.`,
    'The result must look like a real, honest before/after from a laser clinic – never a clean erase, never a filter, and the tattoo never vanishes completely.',
    KEEP,
  ]
    .filter(Boolean)
    .join(' ');
}

/** Redraw a design so it ages better: thicker key lines, fewer tiny details, more breathing room. */
export function improvePrompt(sizeCm: number | null) {
  return [
    'The image is a tattoo design. Redraw it as a skilled tattoo artist would, so that it still looks clean and readable after 30+ years in the skin.',
    `It will be tattooed${sizeCm ? ` at about ${Math.round(sizeCm)} cm wide` : ''}, so: make the main outlines bolder (equivalent to a 5–7 round-liner), remove or merge details that sit closer than about 1 mm, open up tight negative spaces, simplify tiny shading into a few solid or clean areas.`,
    'Keep the same subject, composition, proportions and character — it must be clearly the same design, just built to last.',
    'Output: black ink line art on a pure white background, centred with white margin, no text, no skin, no shadows, flat like a scanned drawing.',
  ].join(' ');
}

/** Pull just the tattoo out of a photo (e.g. a Pinterest picture of a tattoo on someone's arm). */
export function extractPrompt(color: boolean, feedback = '') {
  return [
    'This image shows a tattoo (it may be on a person\'s skin, photographed at an angle, with clothes and background around it).',
    'Recreate ONLY the tattoo design itself as a clean, flat, front-facing stencil, the way a tattoo artist would trace it for a client:',
    'remove the person, skin, body, hair, clothing, jewellery, shadows, light reflections and background completely;',
    'only lines and fills that were made with tattoo ink belong to the design: leave out skin folds and wrinkles, the outline of the arm or body, freckles, moles, pores, veins, hair, nails, scars, redness, sleeve or strap edges, and any text, watermark, sticker or app interface that is not part of the tattoo itself;',
    'do not add a frame, border, outline of the body part or any background shape around the design;',
    'if parts of other tattoos are visible at the edges, leave them out: only the one tattoo in the centre of the image;',
    'undo the perspective and the curvature of the body so the design is flat and centred;',
    'keep every element, proportion, line weight and detail of the design exactly as it is: do not add, redesign, beautify or simplify anything; complete a line that is cut off only if it is obvious;',
    'keep any lettering exactly as written (same letters, same spelling).',
    color ? 'Keep the original ink colours.' : 'Use black ink only.',
    'Output: the design on a pure white background with white margin around it, nothing else in the image.',
    feedback ? `The previous attempt had this problem, fix it: ${feedback}` : '',
  ]
    .filter(Boolean)
    .join(' ');
}

/** New design from a text description. */
export function designPrompt(text: string, style: string) {
  const st =
    style === 'fine-line'
      ? 'delicate fine-line style with single-needle linework'
      : style === 'blackwork'
        ? 'bold blackwork style with solid black areas'
        : style === 'traditional'
          ? 'bold American traditional style with thick outlines'
          : 'clean linework style that will age well';
  return [
    `Create an original tattoo flash design: ${text}.`,
    `Style: ${st}.`,
    'Make it tattoo-ready and long-lasting: confident lines, no microscopic details, readable at 6–10 cm.',
    'Output: black ink on a pure white background, one isolated motif centred with generous white margin, no text or lettering unless explicitly asked, no skin, no mockup, flat like a scanned drawing.',
  ].join(' ');
}

/** Pure text-to-image (no input photo). */
export async function makeImage(prompt: string, w = 1024, h = 1024) {
  return editImage([], prompt, w, h);
}
/** A fresh image from text with the quick models (falls back to the usual ones). */
export async function makeImageFast(prompt: string, w = 1024, h = 1024) {
  if (process.env.GEMINI_API_KEY) {
    try {
      return await geminiImage([], prompt, w, h, fastImageModels());
    } catch (e) {
      if (!process.env.OPENAI_API_KEY) throw e;
    }
  }
  return openaiImage([], prompt, w, h);
}

const ANALYSIS_PROMPT = `You are analysing a photo for a tattoo-aging simulator. Reply with JSON only, no prose:
{"apparentAge": number (best estimate of the person's current age in years, 16-90),
 "skinTone": string (short description incl. Fitzpatrick type, e.g. "light olive, Fitzpatrick III"),
 "bodyArea": string (where the tattoo is, e.g. "inner left forearm"),
 "tattooStyle": one of "fine-line","blackwork","color","realism","traditional","other",
 "hasColor": boolean,
 "sunExposure": one of "low","medium","high" (how sun-exposed this body area usually is)}`;

// ---------------------------------------------------------------- providers

export function dataUrlToImg(dataUrl: string): Img {
  const m = /^data:(image\/[a-z+]+);base64,(.+)$/i.exec(dataUrl);
  if (!m) throw new Error('Invalid image');
  return { mime: m[1], buf: Buffer.from(m[2], 'base64'), name: 'img' };
}

export function aiConfigured() {
  return !!(process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY);
}

const GEMINI = 'https://generativelanguage.googleapis.com/v1beta/models';

export function imageModels() {
  return [process.env.GEMINI_IMAGE_MODEL, 'gemini-nano-banana-2.1', 'gemini-3-pro-image', 'gemini-3-pro-image-preview', 'gemini-3.1-flash-image', 'gemini-2.5-flash-image'].filter(
    (m, i, arr): m is string => !!m && arr.indexOf(m) === i
  );
}
export function textModels() {
  return [process.env.GEMINI_TEXT_MODEL, 'gemini-3.8-flash', 'gemini-flash-latest', 'gemini-2.5-flash'].filter((m, i, arr): m is string => !!m && arr.indexOf(m) === i);
}

async function geminiCall(models: string[], body: unknown) {
  let lastErr: any;
  for (const model of models) {
    let res = await fetch(`${GEMINI}/${model}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY! },
      body: JSON.stringify(body),
    });
    if ((res.status === 429 || res.status === 503) && !(await res.clone().text()).includes('limit: 0')) {
      // short, busy moment: wait and try once more
      await new Promise((r) => setTimeout(r, 2500));
      res = await fetch(`${GEMINI}/${model}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY! },
        body: JSON.stringify(body),
      });
    }
    const data: any = await res.json().catch(() => ({}));
    if (res.ok) return data;
    lastErr = new Error(data?.error?.message || `Gemini ${res.status}`);
    // try the next model only when this one doesn't exist for this key
    console.warn(`gemini ${model} failed: ${res.status} ${lastErr.message.slice(0, 300)}`);
    // try the next model when this one doesn't exist for this key or has no quota on this plan
    const noQuota = res.status === 429 && /limit: 0\b/.test(lastErr.message);
    if (res.status !== 404 && !noQuota && !/not found|not supported|unknown model/i.test(lastErr.message)) throw lastErr;
  }
  throw lastErr;
}

const parts = (images: Img[]) => images.map((i) => ({ inline_data: { mime_type: i.mime, data: i.buf.toString('base64') } }));

function aspectFor(w: number, h: number) {
  const r = w / h;
  const opts: [string, number][] = [
    ['1:1', 1], ['3:4', 0.75], ['4:3', 1.333], ['2:3', 0.667], ['3:2', 1.5], ['4:5', 0.8], ['5:4', 1.25], ['9:16', 0.5625], ['16:9', 1.778],
  ];
  return opts.reduce((best, o) => (Math.abs(o[1] - r) < Math.abs(best[1] - r) ? o : best))[0];
}

/** The quick image models first: for stand-in photos speed matters more than the last bit of detail. */
export function fastImageModels() {
  return [process.env.GEMINI_FAST_IMAGE_MODEL, 'gemini-3.1-flash-image', 'gemini-2.5-flash-image', ...imageModels()].filter((m, i, arr): m is string => !!m && arr.indexOf(m) === i);
}

async function geminiImage(images: Img[], prompt: string, w: number, h: number, models = imageModels()) {
  const data = await geminiCall(models, {
    contents: [{ role: 'user', parts: [...parts(images), { text: prompt }] }],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig: { aspectRatio: aspectFor(w, h), imageSize: process.env.GEMINI_IMAGE_SIZE || '1K' },
    },
  });
  const cand = data?.candidates?.[0];
  const img = cand?.content?.parts?.find((p: any) => p.inlineData || p.inline_data);
  const inline = img?.inlineData || img?.inline_data;
  if (!inline?.data) {
    const reason = cand?.finishReason || data?.promptFeedback?.blockReason || 'no image';
    throw new Error(`Image not returned (${reason})`);
  }
  return `data:${inline.mimeType || inline.mime_type || 'image/png'};base64,${inline.data}`;
}

let oai: OpenAI | null = null;
async function openaiImage(images: Img[], prompt: string, w: number, h: number) {
  if (!oai) oai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const r = w / h;
  const size = r > 1.2 ? '1536x1024' : r < 0.83 ? '1024x1536' : '1024x1024';
  if (!images.length) {
    const g: any = await oai.images.generate({ model: process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1', prompt, size, quality: 'high', output_format: 'png' } as any);
    const b = g.data?.[0]?.b64_json;
    if (!b) throw new Error('No image returned');
    return `data:image/png;base64,${b}`;
  }
  const files = await Promise.all(images.map((i) => toFile(i.buf, i.name, { type: i.mime })));
  const res: any = await oai.images.edit({
    model: process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1',
    image: files.length === 1 ? files[0] : files,
    prompt,
    size,
    quality: process.env.OPENAI_IMAGE_QUALITY || 'high',
    input_fidelity: 'high',
    output_format: 'jpeg',
    output_compression: 88,
  } as any);
  const b64 = res.data?.[0]?.b64_json;
  if (!b64) throw new Error('No image returned');
  return `data:${b64.startsWith('iVBOR') ? 'image/png' : 'image/jpeg'};base64,${b64}`;
}

/** Edit a photo. Uses Gemini (Nano Banana) when configured, otherwise OpenAI. */
export async function editImage(images: Img[], prompt: string, w: number, h: number) {
  if (process.env.GEMINI_API_KEY) {
    try {
      return await geminiImage(images, prompt, w, h);
    } catch (e) {
      if (!process.env.OPENAI_API_KEY) throw e;
      console.warn('gemini failed, falling back to openai', e);
    }
  }
  return openaiImage(images, prompt, w, h);
}

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
 *  AI apps to prevent restricted content, not only to let people report it. Fails open if the check itself fails. */
export async function inputSafety(photo: Img | null, design: Img | null): Promise<{ block: 'photo' | 'design' | null }> {
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
    return { block: j.photoNotAllowed ? 'photo' : j.designNotAllowed ? 'design' : null };
  } catch (e) {
    console.warn('input safety check failed', e);
    return { block: null };
  }
}

export async function checkPhoto(photo: Img, placement: string): Promise<PhotoCheck> {
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
 "skin": array of up to 4 polygons, each an array of 8-40 [y, x] points (integers 0-1000) tracing the outline of a visible bare-skin region of the body (arms, legs, torso, back, neck, hands); exclude clothing, hair, jewellery, watches and the background; [] if none}`,
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
    return { ok: true, code: 'unknown', area: placement };
  }
}

export type QC = { ok: boolean; match: number; note: string; fix: string };

/** Compares the result with the design; returns false when it should be regenerated, with what to fix. */
export async function qualityCheck(design: Img, result: Img, mockup?: Img | null): Promise<QC> {
  if (!process.env.GEMINI_API_KEY) return { ok: true, match: 10, note: '', fix: '' };
  try {
    const data = await geminiCall(textModels(), {
      contents: [
        {
          role: 'user',
          parts: [
            ...parts(mockup ? [design, result, mockup] : [design, result]),
            {
              text: `Image 1 is a tattoo design. Image 2 should be a realistic photo of a person with exactly that design tattooed on their skin.${mockup ? ' Image 3 is the same photo with a flat overlay showing exactly where the user placed the design, how big and how it is turned.' : ''} Reply with JSON only:
{"designMatch": integer 0-10 (10 = same design, same elements and proportions),${mockup ? '\n "samePlacement": boolean (the tattoo in image 2 has the same position, size and rotation/orientation as the overlay in image 3; false if it is turned, tilted, flipped, moved or resized noticeably),' : ''}
 "looksReal": boolean (looks like real ink in skin, not a sticker or drawing),
 "anatomyOk": boolean (no distorted hands, extra fingers or broken body parts),
 "staysOnBody": boolean (every part of the tattoo is on skin; nothing is printed on clothing, jewellery, the background or objects),
 "note": short string describing the biggest problem, or ""}`,
            },
          ],
        },
      ],
      generationConfig: { responseMimeType: 'application/json', temperature: 0 },
    });
    const j = JSON.parse(data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('') || '{}');
    const match = Number(j.designMatch ?? 10);
    const fix = [
      match < 6 ? 'the design was changed: copy the design image line by line, same elements, proportions and lettering' : '',
      j.looksReal === false ? 'it looked like a sticker or drawing: the ink must sit inside the skin with pores and texture showing through' : '',
      j.anatomyOk === false ? 'the body was distorted: keep hands, fingers and the body shape exactly as in the photo' : '',
      j.staysOnBody === false ? 'part of the tattoo was on clothing or the background: keep every line on bare skin only' : '',
      mockup && j.samePlacement === false ? 'the tattoo was turned, moved or resized: it must have exactly the position, size and rotation of the overlay in image 2, do not straighten it' : '',
    ]
      .filter(Boolean)
      .join('; ');
    // a combined score so the better of two candidates can be picked
    const score = match + (mockup && j.samePlacement === false ? -5 : 0) + (j.looksReal === false ? -3 : 0) + (j.anatomyOk === false ? -4 : 0) + (j.staysOnBody === false ? -4 : 0);
    return { ok: !fix, match: score, note: String(j.note || '').slice(0, 200), fix };
  } catch (e) {
    console.warn('qc failed', e);
    return { ok: true, match: -1, note: 'qc unavailable', fix: '' };
  }
}

/** What kind of picture was uploaded as the design, and where the tattoos are in it. */
export type Found = { kind: 'design' | 'photo'; tattoos: { box: [number, number, number, number]; label: string }[] };
export async function findTattoos(image: Img, lang: Lang): Promise<Found | null> {
  if (!process.env.GEMINI_API_KEY) return null;
  try {
    const data = await geminiCall(textModels(), {
      contents: [
        {
          role: 'user',
          parts: [
            ...parts([image]),
            {
              text: `Someone uploaded this image as the tattoo design they want. Reply with JSON only:
{"kind": "design" if it is a clean drawing, flash sheet, stencil or digital design on a plain background with nothing else; "photo" if it is a photograph or screenshot that also shows a person, skin, body parts, clothing, a room, scenery or app interface,
 "tattoos": array (max 8) of every separate tattoo design visible, largest first, each {"box": [ymin, xmin, ymax, xmax] integers 0-1000 tightly around that one design, "label": 2-4 word description in ${LANG_INFO[lang].en} (for example "${tx(lang, 'rose on the forearm', 'rózsa az alkaron')}")}}`,
            },
          ],
        },
      ],
      generationConfig: { responseMimeType: 'application/json', temperature: 0 },
    });
    const j = JSON.parse(data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('') || '{}');
    const tattoos = (Array.isArray(j.tattoos) ? j.tattoos : [])
      .map((t: any) => ({
        box: Array.isArray(t?.box) && t.box.length === 4 ? (t.box.map((v: any) => Math.min(1, Math.max(0, Number(v) / 1000))) as [number, number, number, number]) : null,
        label: String(t?.label || '').slice(0, 40),
      }))
      .filter((t: any) => t.box && t.box.every(Number.isFinite) && t.box[2] - t.box[0] > 0.02 && t.box[3] - t.box[1] > 0.02)
      .slice(0, 8);
    return { kind: j.kind === 'design' ? 'design' : 'photo', tattoos };
  } catch (e) {
    console.warn('find tattoos failed', e);
    return null;
  }
}

/** Is the cut-out the same design as in the photo, with nothing extra left in? */
export async function extractCheck(original: Img, cut: Img): Promise<{ match: number; ok: boolean; fix: string }> {
  if (!process.env.GEMINI_API_KEY) return { match: 10, ok: true, fix: '' };
  try {
    const data = await geminiCall(textModels(), {
      contents: [
        {
          role: 'user',
          parts: [
            ...parts([original, cut]),
            {
              text: `Image 1 shows a tattoo (maybe on skin, with surroundings). Image 2 should be exactly that tattoo design redrawn flat on white, with nothing else. Reply with JSON only:
{"designMatch": integer 0-10 (10 = every element, proportion, line weight and letter is the same),
 "extra": boolean (image 2 still contains skin, the outline of a body part, skin folds, clothing, background, another tattoo, a frame or anything else that was not tattooed ink in image 1),
 "problem": short string naming what is missing, added or changed, or ""}`,
            },
          ],
        },
      ],
      generationConfig: { responseMimeType: 'application/json', temperature: 0 },
    });
    const j = JSON.parse(data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('') || '{}');
    const match = Math.max(0, Math.min(10, Number(j.designMatch ?? 10)));
    const fix = [j.extra ? 'the result still contained things that are not the tattoo (skin, body, clothing, background or another tattoo); remove them' : '', match < 7 ? `the design was not copied faithfully (${String(j.problem || 'details changed').slice(0, 120)})` : '']
      .filter(Boolean)
      .join('; ');
    return { match: j.extra ? Math.min(match, 5) : match, ok: !fix, fix };
  } catch (e) {
    console.warn('extract check failed', e);
    return { match: -1, ok: true, fix: '' };
  }
}

/** Instructions for a redo the user asked for ("Not right?"). */
export const REDO: Record<string, string> = {
  clothes: 'In the previous attempt part of the tattoo ended up on clothing or the background. Every line must be on bare skin.',
  design: "In the previous attempt the design was changed. Copy the design image exactly, element by element, with the same proportions and lettering.",
  anatomy: 'In the previous attempt the body was distorted. Keep hands, fingers and the body shape exactly as in the original photo.',
  fake: 'In the previous attempt the tattoo looked like a sticker or a drawing. It must look like real ink inside real skin, with skin texture showing through.',
  place: 'In the previous attempt the position or size was wrong. Match the overlay exactly: same position, size and rotation.',
};

export function friendlyAiError(e: any): string {
  const msg = String(e?.error?.message || e?.message || e);
  if (/safety|moderation|policy|rejected|blocked|SAFETY|PROHIBITED|IMAGE_SAFETY/i.test(msg))
    return 'The AI safety filter blocked this photo. Use a photo that shows only the body area, with no nudity and no minors.';
  if (/limit: 0\b|billing|insufficient|prepay|credits|depleted/i.test(msg)) return 'Previews are paused for a short while. Please try again later today.';
  if (/quota|exhausted|429|overloaded|503/i.test(msg)) return 'Lots of people are making previews right now. Try again in a minute.';
  return 'The preview could not be created. Try again, or use a clearer, well-lit photo.';
}
