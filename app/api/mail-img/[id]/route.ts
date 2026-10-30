import sharp from 'sharp';

export const dynamic = 'force-dynamic';

/** Article pictures for e-mails, as JPEG: some mail apps can't show WebP. Cached for a year. */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  if (!/^hf_[0-9]{8}_[0-9]{6}_[a-f0-9-]{36}$/.test(params.id)) return new Response('Not found', { status: 404 });
  const res = await fetch(new URL(`/img/${params.id}-1400.webp`, req.url)).catch(() => null);
  if (!res?.ok) return new Response('Not found', { status: 404 });
  const out = await sharp(Buffer.from(await res.arrayBuffer())).resize({ width: 1000, withoutEnlargement: true }).jpeg({ quality: 72, progressive: true, mozjpeg: true }).toBuffer();
  return new Response(new Uint8Array(out), { headers: { 'content-type': 'image/jpeg', 'cache-control': 'public, max-age=31536000, s-maxage=31536000, immutable' } });
}
