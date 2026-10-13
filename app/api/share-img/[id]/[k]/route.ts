import { userClient } from '@/lib/server';

export const dynamic = 'force-dynamic';

/** Images of a guest's vote link. */
export async function GET(_req: Request, { params }: { params: { id: string; k: string } }) {
  if (!/^g[a-f0-9]{10}$/.test(params.id) || !['fresh', 'y50'].includes(params.k)) return new Response('Not found', { status: 404 });
  const { data } = await userClient().rpc('get_guest_img', { p_share: params.id, p_k: params.k });
  const m = /^data:(image\/[a-z]+);base64,(.+)$/.exec(String(data || ''));
  if (!m) return new Response('Not found', { status: 404 });
  return new Response(Buffer.from(m[2], 'base64'), {
    headers: { 'content-type': m[1], 'cache-control': 'public, max-age=31536000, immutable' },
  });
}
