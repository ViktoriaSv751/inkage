import { tx, type Lang, LANG_INFO } from '@/lib/tr';
import type { Img } from './types';
import { geminiCall, parts, textModels } from './providers';

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
