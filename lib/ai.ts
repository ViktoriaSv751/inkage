import OpenAI, { toFile } from 'openai';

export const STAGES = ['healed', 'y10', 'y30', 'y50'] as const;
export type Stage = (typeof STAGES)[number];
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
  return [process.env.GEMINI_TEXT_MODEL, 'gemini-2.5-flash', 'gemini-3-flash'].filter((m, i, arr): m is string => !!m && arr.indexOf(m) === i);
}

async function geminiCall(models: string[], body: unknown) {
  let lastErr: any;
  for (const model of models) {
    const res = await fetch(`${GEMINI}/${model}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY! },
      body: JSON.stringify(body),
    });
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

export function friendlyAiError(e: any): string {
  const msg = String(e?.error?.message || e?.message || e);
  if (/safety|moderation|policy|rejected|blocked|SAFETY|PROHIBITED|IMAGE_SAFETY/i.test(msg))
    return 'The AI safety filter blocked this photo. Use a photo that shows only the body area, with no nudity and no minors.';
  if (/limit: 0\b|billing|insufficient/i.test(msg)) return 'Previews are paused for a short while. Please try again later today.';
  if (/quota|exhausted|429|overloaded|503/i.test(msg)) return 'Lots of people are making previews right now. Try again in a minute.';
  return 'The preview could not be created. Try again, or use a clearer, well-lit photo.';
}
