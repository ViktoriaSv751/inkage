'use client';
import { loadImage } from './client';

export type Placement = { x: number; y: number; w: number; rot: number; mirror: boolean };

/**
 * Clean a design image: knock out a light background, trim empty borders,
 * and measure how much fine detail it has (0..1).
 */
export async function processDesign(src: string, mode: 'black' | 'color') {
  const img = await loadImage(src);
  const max = 900;
  const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const W = Math.round(img.naturalWidth * s);
  const H = Math.round(img.naturalHeight * s);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(img, 0, 0, W, H);
  const d = ctx.getImageData(0, 0, W, H);
  const p = d.data;

  // estimate background from the border pixels
  let br = 0, bg = 0, bb = 0, n = 0;
  for (let x = 0; x < W; x += 4) for (const y of [0, H - 1]) { const i = (y * W + x) * 4; br += p[i]; bg += p[i + 1]; bb += p[i + 2]; n++; }
  for (let y = 0; y < H; y += 4) for (const x of [0, W - 1]) { const i = (y * W + x) * 4; br += p[i]; bg += p[i + 1]; bb += p[i + 2]; n++; }
  br /= n; bg /= n; bb /= n;
  const hasTransparency = (() => { for (let i = 3; i < p.length; i += 4 * 97) if (p[i] < 250) return true; return false; })();

  let minX = W, minY = H, maxX = 0, maxY = 0, ink = 0;
  const alpha = new Uint8Array(W * H);
  for (let i = 0, k = 0; i < p.length; i += 4, k++) {
    let a: number;
    if (hasTransparency) a = p[i + 3] / 255;
    else {
      const dist = Math.sqrt((p[i] - br) ** 2 + (p[i + 1] - bg) ** 2 + (p[i + 2] - bb) ** 2);
      a = Math.max(0, Math.min(1, (dist - 28) / 90));
    }
    if (mode === 'black') {
      const lum = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2];
      const v = Math.round(Math.min(lum, 70) * 0.35);
      p[i] = p[i + 1] = p[i + 2] = v;
    }
    p[i + 3] = Math.round(a * 255);
    alpha[k] = a > 0.35 ? 1 : 0;
    if (alpha[k]) {
      ink++;
      const x = k % W, y = (k / W) | 0;
      if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  ctx.putImageData(d, 0, 0);

  // detail: share of ink pixels that sit on an edge (thin lines → high)
  let edge = 0;
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const k = y * W + x;
    if (alpha[k] && (!alpha[k - 1] || !alpha[k + 1] || !alpha[k - W] || !alpha[k + W])) edge++;
  }
  const detail = ink ? Math.min(1, (edge / ink) * 1.6) : 0.4;

  if (maxX <= minX || maxY <= minY) { minX = 0; minY = 0; maxX = W - 1; maxY = H - 1; }
  const pad = 6;
  const cx = Math.max(0, minX - pad), cy = Math.max(0, minY - pad);
  const cw = Math.min(W - cx, maxX - minX + pad * 2), ch = Math.min(H - cy, maxY - minY + pad * 2);
  const out = document.createElement('canvas');
  out.width = cw;
  out.height = ch;
  out.getContext('2d')!.drawImage(c, cx, cy, cw, ch, 0, 0, cw, ch);
  return { dataUrl: out.toDataURL('image/png'), ratio: ch / cw, detail };
}

/** Draws the design onto the photo where the user placed it (the "rough overlay" the AI refines). */
export async function composeMockup(photoSrc: string, designSrc: string, pl: Placement) {
  const [ph, ds] = await Promise.all([loadImage(photoSrc), loadImage(designSrc)]);
  const c = document.createElement('canvas');
  c.width = ph.naturalWidth;
  c.height = ph.naturalHeight;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(ph, 0, 0);
  const w = pl.w * c.width;
  const h = (w * ds.naturalHeight) / ds.naturalWidth;
  ctx.save();
  ctx.translate(pl.x * c.width, pl.y * c.height);
  ctx.rotate((pl.rot * Math.PI) / 180);
  if (pl.mirror) ctx.scale(-1, 1);
  ctx.globalAlpha = 0.9;
  ctx.globalCompositeOperation = 'multiply';
  ctx.drawImage(ds, -w / 2, -h / 2, w, h);
  ctx.restore();
  return c.toDataURL('image/jpeg', 0.88);
}
