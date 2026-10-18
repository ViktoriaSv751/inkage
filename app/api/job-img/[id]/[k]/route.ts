import { appSecret, userClient } from '@/lib/server';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

/** An image of a saved preview that is kept with its generation record (restored previews). */
export async function GET(_req: Request, { params }: { params: { id: string; k: string } }) {
  if (!/^[0-9a-f-]{36}$/.test(params.id) || !/^[a-z0-9]{2,12}$/.test(params.k)) return new Response('Not found', { status: 404 });
  const { data } = await userClient().rpc('job_image', { p_secret: appSecret('db'), p_id: params.id, p_k: params.k });
  const m = /^data:(image\/[a-z]+);base64,(.+)$/.exec(String(data || ''));
  if (!m) return new Response('Not found', { status: 404 });
  return new Response(Buffer.from(m[2], 'base64'), { headers: { 'content-type': m[1], 'cache-control': 'private, max-age=31536000, immutable' } });
}
