import { loadImage } from '@/lib/client';

export const toBlob = async (src: string) => (await fetch(src)).blob();

/** A saved preview with a small "inkage.app" mark in the lower right corner, so a shared picture says where it came from. */
export async function withMark(src: string): Promise<Blob> {
  try {
    const img = await loadImage(src);
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const x = c.getContext('2d')!;
    x.drawImage(img, 0, 0);
    const fs = Math.max(14, Math.round(c.width * 0.026));
    x.font = `600 ${fs}px 'Geist Sans', system-ui, sans-serif`;
    x.textAlign = 'right';
    x.textBaseline = 'bottom';
    x.shadowColor = 'rgba(0,0,0,.55)';
    x.shadowBlur = fs * 0.4;
    x.fillStyle = 'rgba(255,255,255,.82)';
    x.fillText('inkage.app', c.width - fs * 0.9, c.height - fs * 0.7);
    return await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('blob'))), 'image/jpeg', 0.92));
  } catch {
    return toBlob(src); // a cross-origin or broken image is saved as it is
  }
}

/** Small JPEG for links (kept under ~450 KB). */
export async function smallJpeg(src: string, max = 900) {
  const img = await loadImage(src);
  const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * s);
  c.height = Math.round(img.naturalHeight * s);
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  let q = 0.82, out = c.toDataURL('image/jpeg', q);
  while (out.length > 450_000 && q > 0.4) out = c.toDataURL('image/jpeg', (q -= 0.12));
  return out;
}

/** "Fresh vs. 50 years" picture for Instagram / TikTok photo posts (1080×1350). */
export async function makeCard(fresh: string, old: string, o: { left: string; right: string; title: string; score: string | null }) {
  const [a, b] = await Promise.all([loadImage(fresh), loadImage(old)]);
  const W = 1080, H = 1350;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const x = c.getContext('2d')!;
  x.fillStyle = '#0d0b14';
  x.fillRect(0, 0, W, H);
  const pad = 36, gap = 16, top = 190, ih = H - top - 150;
  const iw = (W - pad * 2 - gap) / 2;
  const draw = (img: HTMLImageElement, dx: number) => {
    const r = Math.max(iw / img.naturalWidth, ih / img.naturalHeight);
    const sw = iw / r, sh = ih / r;
    x.save();
    x.beginPath();
    (x as any).roundRect ? (x as any).roundRect(dx, top, iw, ih, 28) : x.rect(dx, top, iw, ih);
    x.clip();
    x.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, dx, top, iw, ih);
    x.restore();
  };
  draw(a, pad);
  draw(b, pad + iw + gap);
  x.fillStyle = '#fff';
  x.textBaseline = 'alphabetic';
  x.font = `800 64px 'Geist Sans', system-ui, sans-serif`;
  x.fillText(o.title, pad, 120);
  const tag = (txt: string, dx: number) => {
    x.font = `700 34px 'Geist Sans', system-ui, sans-serif`;
    const w = x.measureText(txt).width + 36;
    x.fillStyle = 'rgba(0,0,0,.6)';
    x.beginPath();
    (x as any).roundRect ? (x as any).roundRect(dx + 18, top + 18, w, 56, 28) : x.rect(dx + 18, top + 18, w, 56);
    x.fill();
    x.fillStyle = '#fff';
    x.fillText(txt, dx + 36, top + 58);
  };
  tag(o.left, pad);
  tag(o.right, pad + iw + gap);
  x.font = `600 32px 'Geist Sans', system-ui, sans-serif`;
  x.fillStyle = 'rgba(255,255,255,.75)';
  if (o.score) x.fillText(o.score, pad, H - 64);
  x.textAlign = 'right';
  x.fillStyle = '#fff';
  x.fillText('inkage.app', W - pad, H - 64);
  return new Promise<Blob>((res) => c.toBlob((bl) => res(bl!), 'image/jpeg', 0.9));
}
