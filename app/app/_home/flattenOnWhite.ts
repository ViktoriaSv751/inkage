import { loadImage } from '@/lib/client';

/** The design on white, turned (and mirrored) exactly as placed – so the AI gets it in the final orientation. */
export async function flattenOnWhite(src: string, max = 1024, rot = 0, mirror = false) {
  const img = await loadImage(src);
  const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const pad = 0.08;
  const w = Math.round(img.naturalWidth * s), h = Math.round(img.naturalHeight * s);
  const a = (rot * Math.PI) / 180;
  const bw = Math.abs(w * Math.cos(a)) + Math.abs(h * Math.sin(a));
  const bh = Math.abs(w * Math.sin(a)) + Math.abs(h * Math.cos(a));
  const c = document.createElement('canvas');
  c.width = Math.round(bw * (1 + pad * 2));
  c.height = Math.round(bh * (1 + pad * 2));
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.translate(c.width / 2, c.height / 2);
  ctx.rotate(a);
  if (mirror) ctx.scale(-1, 1);
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  return c.toDataURL('image/png');
}
