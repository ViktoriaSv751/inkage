import { dataUrlToBuffer, json } from '@/lib/server';
import { aiConfigured, checkPhoto } from '@/lib/ai';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(req: Request) {
  if (!aiConfigured()) return json({ ok: true, code: 'ok', area: '' });
  const body = await req.json().catch(() => ({}));
  let photo;
  try {
    photo = dataUrlToBuffer(body.photo);
  } catch {
    return json({ ok: false, code: 'unknown' }, 400);
  }
  if (photo.buf.length > 3_000_000) return json({ ok: false, code: 'unknown' }, 413);
  const placement = String(body.placement || 'forearm').slice(0, 60);
  return json(await checkPhoto({ ...photo, name: 'photo.jpg' }, placement));
}
