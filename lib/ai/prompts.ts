import { STAGE_YEARS, type Analysis, type RemovalStage, type Stage } from './types';

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

/** Instructions for a redo the user asked for ("Not right?"). */
export const REDO: Record<string, string> = {
  clothes: 'In the previous attempt part of the tattoo ended up on clothing or the background. Every line must be on bare skin.',
  design: "In the previous attempt the design was changed. Copy the design image exactly, element by element, with the same proportions and lettering.",
  anatomy: 'In the previous attempt the body was distorted. Keep hands, fingers and the body shape exactly as in the original photo.',
  fake: 'In the previous attempt the tattoo looked like a sticker or a drawing. It must look like real ink inside real skin, with skin texture showing through.',
  place: 'In the previous attempt the position or size was wrong. Match the overlay exactly: same position, size and rotation.',
};
