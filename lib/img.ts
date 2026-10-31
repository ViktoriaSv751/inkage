/** Pre-rendered photo widths (see scripts/prebuild-images.mjs). */
export const IMG_W = [240, 480, 640, 900, 1400, 1800] as const;
const snap = (w: number) => IMG_W.find((x) => x >= w) ?? 1800;
/** A static, CDN-cached WebP copy of a photo at (at least) width w. */
// the store apps carry no photos: they load them from the website
const IMG_HOST = process.env.NEXT_PUBLIC_NATIVE_BUNDLE ? 'https://inkage.app' : '';
export const IMG = (f: string, w = 1200) => `${IMG_HOST}/img/${f}-${snap(w)}.webp`;
/** srcset for responsive <img>, up to max width. */
export const IMGSET = (f: string, max = 1800) =>
  IMG_W.filter((w) => w <= max).map((w) => `${IMG_HOST}/img/${f}-${w}.webp ${w}w`).join(', ');

/** <img> attributes: the browser picks the smallest copy that fills `sizes` (the picture's width on the page). */
export const PIC = (f: string, sizes: string, max = 1800) => ({ src: IMG(f, max), srcSet: IMGSET(f, snap(max)), sizes });
