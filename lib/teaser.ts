/* The teaser (2026-11-12): an account without a package gets one preview made, but sees only a watermarked "today"
   image and a blurred 50-year image (or 10 laser sessions). The sharp originals are kept in public.teasers (db secret
   only) and handed out once the account has bought a package; the teaser then counts as the first bought preview.
   Server only. */
import sharp from 'sharp';
import { appSecret, userClient } from './server';

const parse = (dataUrl: string) => Buffer.from(dataUrl.split(',')[1] || '', 'base64');
const out = (buf: Buffer) => `data:image/jpeg;base64,${buf.toString('base64')}`;

/** a smaller copy with a repeated diagonal "InkAge preview" mark: shows the design on their skin, not a usable picture */
export async function watermark(dataUrl: string) {
  const img = sharp(parse(dataUrl)).rotate();
  const meta = await img.metadata();
  const w = Math.min(720, meta.width || 720);
  const h = Math.round(w * ((meta.height || w) / (meta.width || w)));
  const step = Math.round(w / 3.2);
  const font = Math.round(w / 17);
  let marks = '';
  for (let y = -h; y < h * 2; y += step) for (let x = -w; x < w * 2; x += step * 1.6) marks += `<text x="${x}" y="${y}">InkAge preview</text>`;
  const svg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><g transform="rotate(-28 ${w / 2} ${h / 2})" font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="${font}" fill="#ffffff" fill-opacity="0.38" stroke="#000000" stroke-opacity="0.18" stroke-width="1">${marks}</g></svg>`
  );
  const buf = await img.resize(w, h).composite([{ input: svg, top: 0, left: 0 }]).jpeg({ quality: 72 }).toBuffer();
  return out(buf);
}

/** too blurred to use, clear enough to see that it worked: the shape of the arm and that the ink has changed */
export async function blur(dataUrl: string) {
  const img = sharp(parse(dataUrl)).rotate();
  const meta = await img.metadata();
  const w = Math.min(480, meta.width || 480);
  const buf = await img.resize(w).blur(9).modulate({ brightness: 0.95 }).jpeg({ quality: 60 }).toBuffer();
  return out(buf);
}

export async function teaserSave(a: { user: string; gid: number; stage: string; fresh: string; aged: string | null; freshToken: string | null; agedToken: string | null }) {
  const { error } = await userClient().rpc('teaser_save', {
    p_key: appSecret('db'), p_user: a.user, p_gid: a.gid, p_stage: a.stage, p_fresh: a.fresh, p_aged: a.aged, p_fresh_token: a.freshToken, p_aged_token: a.agedToken,
  });
  if (error) throw new Error(`teaser_save: ${error.message}`);
}

export async function teaserTake(user: string, gid: number) {
  const { data, error } = await userClient().rpc('teaser_take', { p_key: appSecret('db'), p_user: user, p_gid: gid });
  if (error) throw new Error(`teaser_take: ${error.message}`);
  return data as { ok: boolean; reason?: string; stage?: string; fresh?: string; aged?: string | null; freshToken?: string | null; agedToken?: string | null };
}
