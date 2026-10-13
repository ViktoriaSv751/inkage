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
  // Is this a photo (tattoo on someone's skin, busy background) rather than a clean drawing?
  let varSum = 0, vn = 0;
  const acc = (i: number) => { varSum += (p[i] - br) ** 2 + (p[i + 1] - bg) ** 2 + (p[i + 2] - bb) ** 2; vn++; };
  for (let x = 0; x < W; x += 4) for (const y of [0, H - 1]) acc((y * W + x) * 4);
  for (let y = 0; y < H; y += 4) for (const x of [0, W - 1]) acc((y * W + x) * 4);
  const borderStd = Math.sqrt(varSum / Math.max(1, vn) / 3);
  const bgLum = 0.299 * br + 0.587 * bg + 0.114 * bb;
  // skin-like or busy border, or a mid-tone background → treat as a photo
  const skinLike = br > bg && bg > bb && br - bb > 25 && bgLum > 60 && bgLum < 235;
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
  // lots of 'ink' covering the frame is another sign of a photo
  const coverage = ink / (W * H);
  const photoLike = !hasTransparency && (borderStd > 28 || skinLike || bgLum < 200 || coverage > 0.55);
  return { dataUrl: out.toDataURL('image/png'), ratio: ch / cw, detail, photoLike };
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

/** Crop a box ([top, left, bottom, right] fractions) out of an image, with a little margin. */
export async function cropImage(src: string, box: [number, number, number, number], pad = 0.05, max = 1024) {
  const img = await loadImage(src);
  const W = img.naturalWidth, H = img.naturalHeight;
  const [t, l, b, r] = box;
  const ph = (b - t) * pad + 0.01, pw = (r - l) * pad + 0.01;
  const x0 = Math.max(0, (l - pw) * W), y0 = Math.max(0, (t - ph) * H);
  const x1 = Math.min(W, (r + pw) * W), y1 = Math.min(H, (b + ph) * H);
  const cw = Math.max(8, x1 - x0), ch = Math.max(8, y1 - y0);
  const s = Math.min(1, max / Math.max(cw, ch));
  const c = document.createElement('canvas');
  c.width = Math.round(cw * s);
  c.height = Math.round(ch * s);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(img, x0, y0, cw, ch, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.92);
}

export type Skin = [number, number][][];

/** Draw the bare-skin outlines (optionally grown a bit) as white on black. */
function drawSkin(ctx: CanvasRenderingContext2D, skin: Skin, W: number, H: number, grow: number) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#fff';
  ctx.lineJoin = 'round';
  ctx.lineWidth = grow * 2;
  for (const poly of skin) {
    ctx.beginPath();
    poly.forEach(([x, y], i) => (i ? ctx.lineTo(x * W, y * H) : ctx.moveTo(x * W, y * H)));
    ctx.closePath();
    ctx.fill();
    if (grow > 0) ctx.stroke();
  }
}

/** The design drawn where the user placed it, on a canvas the size of (a scaled) photo. */
async function drawPlaced(ctx: CanvasRenderingContext2D, design: string, pl: Placement, W: number, H: number, margin = 0) {
  const ds = await loadImage(design);
  const w = pl.w * W;
  const h = (w * ds.naturalHeight) / ds.naturalWidth;
  ctx.save();
  ctx.translate(pl.x * W, pl.y * H);
  ctx.rotate((pl.rot * Math.PI) / 180);
  if (pl.mirror) ctx.scale(-1, 1);
  if (margin) {
    const m = Math.max(w, h) * margin;
    ctx.fillStyle = '#fff';
    ctx.fillRect(-w / 2 - m, -h / 2 - m, w + m * 2, h + m * 2);
  } else ctx.drawImage(ds, -w / 2, -h / 2, w, h);
  ctx.restore();
}

/** Share of the design's ink that lands off the skin (on clothes or the background), 0..1. */
export async function offSkin(photo: { w: number; h: number }, design: string, pl: Placement, skin: Skin) {
  const W = 240, H = Math.max(8, Math.round((240 * photo.h) / photo.w));
  const a = document.createElement('canvas');
  a.width = W;
  a.height = H;
  const ax = a.getContext('2d')!;
  await drawPlaced(ax, design, pl, W, H);
  const b = document.createElement('canvas');
  b.width = W;
  b.height = H;
  const bx = b.getContext('2d')!;
  drawSkin(bx, skin, W, H, W * 0.012);
  const ink = ax.getImageData(0, 0, W, H).data;
  const sk = bx.getImageData(0, 0, W, H).data;
  let total = 0, off = 0;
  // ink that falls outside the photo counts as off the body too
  for (let i = 0; i < ink.length; i += 4) {
    if (ink[i + 3] < 90) continue;
    total++;
    if (sk[i] < 128) off++;
  }
  return total ? off / total : 0;
}

/**
 * Where the AI may change the photo: the placed design plus a margin, limited to the skin
 * when we know where the skin is. Everything else gets the original pixels back on the server.
 */
export async function pasteMask(photo: { w: number; h: number }, design: string, pl: Placement, skin?: Skin | null) {
  const W = Math.min(640, photo.w), H = Math.round((W * photo.h) / photo.w);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  await drawPlaced(ctx, design, pl, W, H, 0.22);
  if (skin?.length) {
    const s = document.createElement('canvas');
    s.width = W;
    s.height = H;
    const sx = s.getContext('2d')!;
    drawSkin(sx, skin, W, H, Math.hypot(W, H) * 0.04);
    // only trust the skin outline when it agrees with the placement (covers most of it)
    const area = ctx.getImageData(0, 0, W, H).data;
    const sk = sx.getImageData(0, 0, W, H).data;
    let inA = 0, both = 0;
    for (let i = 0; i < area.length; i += 16) if (area[i] > 128) ((inA++), sk[i] > 128 && both++);
    if (inA && both / inA >= 0.6) {
      ctx.globalCompositeOperation = 'multiply';
      ctx.drawImage(s, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
    }
  }
  return c.toDataURL('image/png');
}

/** A dark veil over everything that isn't skin, shown while dragging the design. */
export function skinVeil(skin: Skin, w: number, h: number) {
  const W = 320, H = Math.max(8, Math.round((320 * h) / w));
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = 'rgba(20, 12, 60, 0.55)';
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = '#000';
  for (const poly of skin) {
    ctx.beginPath();
    poly.forEach(([x, y], i) => (i ? ctx.lineTo(x * W, y * H) : ctx.moveTo(x * W, y * H)));
    ctx.closePath();
    ctx.fill();
  }
  return c.toDataURL('image/png');
}
