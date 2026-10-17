import { userClient } from '@/lib/server';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

/** Images of a poll option. */
export async function GET(_req: Request, { params }: { params: { id: string; idx: string; k: string } }) {
  if (!/^p[a-f0-9]{10}$/.test(params.id) || !/^[0-3]$/.test(params.idx) || !['fresh', 'y50'].includes(params.k)) return new Response('Not found', { status: 404 });
  const { data } = await userClient().rpc('poll_img', { p_share: params.id, p_idx: Number(params.idx), p_k: params.k });
  const m = /^data:(image\/[a-z]+);base64,(.+)$/.exec(String(data || ''));
  if (!m) return new Response('Not found', { status: 404 });
  return new Response(Buffer.from(m[2], 'base64'), {
    headers: { 'content-type': m[1], 'cache-control': 'public, max-age=31536000, immutable' },
  });
}
