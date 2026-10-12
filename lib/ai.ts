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

export function freshPrompt(placement: string, size: string) {
  const sizeText =
    size === 'small' ? 'small (about 4–6 cm across)' : size === 'large' ? 'large (covering most of that body area)' : 'medium (about 8–12 cm across)';
  return [
    'Image 1 is a real photo of a person. Image 2 is a tattoo design.',
    `Tattoo the design from image 2 onto the person's ${placement} in image 1. Size: ${sizeText}, proportionate to that body part.`,
    "Reproduce the design's exact linework, proportions, spacing and colours faithfully — do not redesign, simplify or add elements. If image 2 shows a design on someone else's skin, transfer only the design itself.",
    'Make it a real tattoo done today by a skilled artist: ink sits in the skin, not on top of it; it follows the curvature of the muscles and the perspective of the camera; it is lit by the same light and shadows as the surrounding skin; skin pores, fine hairs and texture remain visible through the ink.',
    'Fresh-tattoo details: slightly raised, glossy lines; mild pink-red irritation in a thin halo around the linework; the skin is otherwise unchanged.',
    'If that body area is not visible, place it on the closest visible area that makes anatomical sense.',
    STAY_ON_BODY,
    KEEP,
  ].join(' ');
}

/** Used when the user positioned the design themselves in the editor (3 images: photo, mockup, design). */
export function placedPrompt(placement: string, colorMode: 'black' | 'color') {
  return [
    'Image 1 is a real photo of a person. Image 2 is the same photo with a flat digital overlay that shows EXACTLY where the tattoo goes, how big it is and how it is rotated. Image 3 is the original tattoo design.',
    `Turn the overlay into a real tattoo on the person's ${placement}: same position, same size, same rotation as in image 2. Use image 3 for the exact linework and details.`,
    'If image 3 shows anything besides the tattoo design itself (another person, their skin, clothes, a background), ignore all of that and transfer only the inked design.',
    colorMode === 'black'
      ? 'Use black ink only (no colours), as a skilled artist would execute this design.'
      : "Keep the design's original colours.",
    'The ink sits in the skin, follows the curvature of the muscles and the camera perspective, is lit by the same light and shadows as the surrounding skin, and lets pores, fine hairs and skin texture show through.',
    'Fresh-tattoo details: slightly raised, glossy lines and a mild pink-red halo around the linework.',
    'The final image must look like image 1 (no overlay artefacts, no flat sticker look).',
    STAY_ON_BODY,
    KEEP,
  ].join(' ');
}

function inkAging(a: Analysis, years: number) {
  const fine = a.tattooStyle === 'fine-line';
  const color = a.hasColor || a.tattooStyle === 'color' || a.tattooStyle === 'realism';
  if (years <= 1)
    return 'The tattoo is fully healed: no redness, no shine, no scabbing; the ink has settled a hair deeper into the skin so lines look very slightly softer and matte. Colours are as bright as they will ever be.';
  const blur = years >= 50 ? 'strong' : years >= 30 ? 'clear' : 'subtle';
  return [
    `After ${years} years the ink has migrated in the dermis (${blur} blowout): outlines are ${
      fine ? (years >= 30 ? 'noticeably thicker and fuzzy, the thinnest lines partly broken or faded out' : 'a little thicker and softer') : years >= 30 ? 'thicker with soft edges' : 'slightly softer'
    };`,
    `blacks have shifted toward ${years >= 30 ? 'blue-grey/greenish charcoal' : 'deep charcoal'};`,
    color ? `colours are ${years >= 30 ? 'heavily faded and muddy (yellows and light colours almost gone, reds turned brick)' : 'visibly duller'};` : '',
    years >= 30 ? 'very small details and tight negative spaces have merged together;' : 'tiny details are still readable but less crisp;',
    a.sunExposure === 'high' ? 'sun exposure has faded it more than average.' : '',
    'The tattoo distorts naturally with the aged skin underneath it (follows new creases and slackness).',
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

export function agePrompt(stage: Stage, a: Analysis) {
  const years = STAGE_YEARS[stage];
  return [
    `This photo shows a person with a tattoo. Show this exact same photo ${years === 1 ? 'one year later' : `${years} years later`}.`,
    inkAging(a, years),
    skinAging(a, years),
    'The change must be medically and physically realistic — not exaggerated, not cartoonish, not a filter.',
    KEEP,
  ].join(' ');
}

export function removalPrompt(stage: RemovalStage, a: Analysis) {
  const n = stage === 'laser3' ? 3 : stage === 'laser6' ? 6 : 10;
  const look =
    n === 3
      ? 'the tattoo is clearly lighter and patchy: black has turned to a faded grey-blue, edges are uneven, some lines are broken, colours (if any) are only slightly lighter'
      : n === 6
        ? 'the tattoo is a faint, blotchy grey ghost of the design: most lines are barely visible, stubborn dense areas remain darker, colours like green, blue and yellow may persist as pale stains'
        : 'only a very faint ghost of the design remains in a few spots; the skin may show slight texture change, faint lighter (hypopigmented) or darker patches where the ink was';
  return [
    `This photo shows a person with a tattoo. Show the same photo after ${n} laser tattoo removal sessions, fully healed (no blisters, no redness).`,
    `After ${n} sessions ${look}.`,
    `The person's age and skin (${a.skinTone}) stay the same as today; only the tattoo area changes.`,
    'The result must be medically realistic, like a real before/after from a laser clinic — not a clean erase, not a filter.',
    KEEP,
  ].join(' ');
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
export function extractPrompt(color: boolean) {
  return [
    'This image shows a tattoo (it may be on a person\'s skin, photographed at an angle, with clothes and background around it).',
    'Recreate ONLY the tattoo design itself as a clean, flat, front-facing stencil, the way a tattoo artist would trace it for a client:',
    'remove the person, skin, body, hair, clothing, shadows, light reflections and background completely;',
    'undo the perspective and the curvature of the body so the design is flat and centred;',
    'keep every element, proportion and detail of the design exactly — do not add, redesign or simplify anything; complete any line that is cut off only if it is obvious.',
    color ? 'Keep the original ink colours.' : 'Use black ink only.',
    'Output: the design on a pure white background with white margin around it, nothing else in the image, no text unless it is part of the tattoo.',
  ].join(' ');
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

function imageModels() {
  return [process.env.GEMINI_IMAGE_MODEL, 'gemini-nano-banana-2.1', 'gemini-3-pro-image', 'gemini-3-pro-image-preview', 'gemini-3.1-flash-image', 'gemini-2.5-flash-image'].filter(
    (m, i, arr): m is string => !!m && arr.indexOf(m) === i
  );
}
function textModels() {
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

async function geminiImage(images: Img[], prompt: string, w: number, h: number) {
  const data = await geminiCall(imageModels(), {
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
}

/** Fast pre-check of the user's photo before we spend money on image generation. */
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
 "notAllowed": boolean (true if it shows nudity of intimate areas, or the person looks under 18),
 "visibleArea": string (the main body area visible, e.g. "inner left forearm"),
 "box": [ymin, xmin, ymax, xmax] integers 0-1000 tightly around the bare skin of the ${placement} where a tattoo could go (exclude clothing, background and other body parts), or null if that area is not visible,
 "angle": number (angle in degrees of the long axis of that body part relative to vertical, positive = leaning right; 0 if unclear)}`,
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
    if (j.notAllowed) return { ok: false, code: 'not_allowed', area: '' };
    if (j.skinVisible === false) return { ok: false, code: 'no_skin', area: String(j.visibleArea || ''), box: okBox, angle };
    if (j.sharp === false) return { ok: false, code: 'blurry', area: String(j.visibleArea || ''), box: okBox, angle };
    if (j.wellLit === false) return { ok: false, code: 'dark', area: String(j.visibleArea || ''), box: okBox, angle };
    return { ok: true, code: 'ok', area: String(j.visibleArea || placement).slice(0, 60), box: okBox, angle };
  } catch (e) {
    console.warn('photo check failed', e);
    return { ok: true, code: 'unknown', area: placement };
  }
}

/** Compares the result with the design; returns false when it should be regenerated. */
export async function qualityCheck(design: Img, result: Img): Promise<{ ok: boolean; match: number; note: string }> {
  if (!process.env.GEMINI_API_KEY) return { ok: true, match: 10, note: '' };
  try {
    const data = await geminiCall(textModels(), {
      contents: [
        {
          role: 'user',
          parts: [
            ...parts([design, result]),
            {
              text: `Image 1 is a tattoo design. Image 2 should be a realistic photo of a person with exactly that design tattooed on their skin. Reply with JSON only:
{"designMatch": integer 0-10 (10 = same design, same elements and proportions),
 "looksReal": boolean (looks like real ink in skin, not a sticker or drawing),
 "anatomyOk": boolean (no distorted hands, extra fingers or broken body parts),
 "staysOnBody": boolean (every part of the tattoo is on skin; nothing floats over the background, clothing or objects),
 "note": short string}`,
            },
          ],
        },
      ],
      generationConfig: { responseMimeType: 'application/json', temperature: 0 },
    });
    const j = JSON.parse(data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('') || '{}');
    const match = Number(j.designMatch ?? 10);
    return { ok: match >= 6 && j.looksReal !== false && j.anatomyOk !== false && j.staysOnBody !== false, match, note: String(j.note || '').slice(0, 200) };
  } catch (e) {
    console.warn('qc failed', e);
    return { ok: true, match: -1, note: 'qc unavailable' };
  }
}

export function friendlyAiError(e: any): string {
  const msg = String(e?.error?.message || e?.message || e);
  if (/safety|moderation|policy|rejected|blocked|SAFETY|PROHIBITED|IMAGE_SAFETY/i.test(msg))
    return 'The AI safety filter blocked this photo. Use a photo that shows only the body area, with no nudity and no minors.';
  if (/limit: 0\b|billing|insufficient|prepay|credits|depleted/i.test(msg)) return 'Previews are paused for a short while. Please try again later today.';
  if (/quota|exhausted|429|overloaded|503/i.test(msg)) return 'Lots of people are making previews right now. Try again in a minute.';
  return 'The preview could not be created. Try again, or use a clearer, well-lit photo.';
}
