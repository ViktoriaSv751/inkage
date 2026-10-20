import OpenAI, { toFile } from 'openai';
import type { Img } from './types';

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

export async function geminiCall(models: string[], body: unknown) {
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

export const parts = (images: Img[]) => images.map((i) => ({ inline_data: { mime_type: i.mime, data: i.buf.toString('base64') } }));

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

/**
 * The model for the work that follows the first render (aging stages, laser sessions, cut-outs). Each preview makes
 * four aging images, so this is where most of the cost goes: GEMINI_AGE_MODEL set to a Flash image model
 * (e.g. gemini-3.1-flash-image) makes those images several times cheaper. Unset: the same models as the first render.
 */
export function secondaryImageModels() {
  const m = process.env.GEMINI_AGE_MODEL;
  return m ? [m, ...imageModels().filter((x) => x !== m)] : imageModels();
}

/** Edit a photo. Uses Gemini (Nano Banana) when configured, otherwise OpenAI. */
export async function editImage(images: Img[], prompt: string, w: number, h: number, models = imageModels()) {
  if (process.env.GEMINI_API_KEY) {
    try {
      return await geminiImage(images, prompt, w, h, models);
    } catch (e) {
      if (!process.env.OPENAI_API_KEY) throw e;
      console.warn('gemini failed, falling back to openai', e);
    }
  }
  return openaiImage(images, prompt, w, h);
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

export function friendlyAiError(e: any): string {
  const msg = String(e?.error?.message || e?.message || e);
  if (/safety|moderation|policy|rejected|blocked|SAFETY|PROHIBITED|IMAGE_SAFETY/i.test(msg))
    return 'The AI safety filter blocked this photo. Use a photo that shows only the body area, with no nudity and no minors.';
  if (/limit: 0\b|billing|insufficient|prepay|credits|depleted/i.test(msg)) return 'Previews are paused for a short while. Please try again later today.';
  if (/quota|exhausted|429|overloaded|503/i.test(msg)) return 'Lots of people are making previews right now. Try again in a minute.';
  return 'The preview could not be created. Try again, or use a clearer, well-lit photo.';
}
