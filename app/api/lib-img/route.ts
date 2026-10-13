import sharp from 'sharp';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const CDN = 'https://d8j0ntlcm91z4.cloudfront.net/user_3134IoHE3NDDMNENjF96sXtstXg/';

/**
 * Library designs served from our own domain: small, cached at the edge for a year,
 * so the design picker fills instantly instead of waiting on the external host.
 * ?f=<file>&w=<width>  (w = 240 for thumbnails; omit for the full design)
 */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const f = u.searchParams.get('f') || '';
  if (!/^hf_[0-9]{8}_[0-9]{6}_[a-f0-9-]{36}\.png$/.test(f)) return new Response('Not found', { status: 404 });
  const w = Math.min(1200, Math.max(0, Number(u.searchParams.get('w')) || 0));
  const res = await fetch(CDN + f).catch(() => null);
  if (!res?.ok) return new Response('Not found', { status: 404 });
  const buf = Buffer.from(await res.arrayBuffer());
  const out = w ? await sharp(buf).resize({ width: w, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer() : await sharp(buf).png({ compressionLevel: 9 }).toBuffer();
  return new Response(out, {
    headers: {
      'content-type': w ? 'image/webp' : 'image/png',
      'cache-control': 'public, max-age=31536000, s-maxage=31536000, immutable',
    },
  });
}
