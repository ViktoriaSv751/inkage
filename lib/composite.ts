import sharp from 'sharp';

/**
 * Paste-back: keep the original photo everywhere except where the tattoo may go.
 * `mask` is white where the AI is allowed to change the photo (the placed design plus a margin, on skin).
 * If the AI re-framed the photo (outside the mask it no longer lines up), we keep its image untouched.
 */
export async function pasteBack(photo: Buffer, result: Buffer, mask: Buffer) {
  const meta = await sharp(photo).metadata();
  const W = meta.width || 1024;
  const H = meta.height || 1024;
  const [ph, res, m] = await Promise.all([
    sharp(photo).rotate().resize(W, H, { fit: 'fill' }).removeAlpha().raw().toBuffer(),
    sharp(result).resize(W, H, { fit: 'fill' }).removeAlpha().raw().toBuffer(),
    sharp(mask)
      .resize(W, H, { fit: 'fill' })
      .greyscale()
      .blur(Math.max(1.5, W / 140))
      .raw()
      .toBuffer(),
  ]);
  const ch = m.length === W * H ? 1 : Math.round(m.length / (W * H));

  // How well does the AI image line up with the original outside the tattoo area?
  let sum = 0, n = 0, inside = 0;
  for (let i = 0; i < W * H; i += 5) {
    const a = m[i * ch];
    if (a > 8) {
      inside++;
      continue;
    }
    const k = i * 3;
    sum += (Math.abs(ph[k] - res[k]) + Math.abs(ph[k + 1] - res[k + 1]) + Math.abs(ph[k + 2] - res[k + 2])) / 3;
    n++;
  }
  const diff = n ? sum / n : 99;
  const share = inside / ((W * H) / 5);
  // nothing to protect, mask covers almost everything, or the AI moved the picture: leave it as is
  if (n < 400 || share > 0.85 || diff > 21) return { image: null as Buffer | null, diff, applied: false };

  const out = Buffer.alloc(W * H * 3);
  for (let i = 0; i < W * H; i++) {
    const a = m[i * ch] / 255;
    const k = i * 3;
    out[k] = res[k] * a + ph[k] * (1 - a);
    out[k + 1] = res[k + 1] * a + ph[k + 1] * (1 - a);
    out[k + 2] = res[k + 2] * a + ph[k + 2] * (1 - a);
  }
  const image = await sharp(out, { raw: { width: W, height: H, channels: 3 } }).jpeg({ quality: 90, mozjpeg: true }).toBuffer();
  return { image, diff, applied: true };
}
