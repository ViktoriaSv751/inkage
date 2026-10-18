import { tx, isLang } from '@/lib/tr';
import { dataUrlToBuffer, json } from '@/lib/server';
import { aiConfigured, findTattoos } from '@/lib/ai';

export const dynamic = 'force-dynamic';
export const maxDuration = 40;

/** What kind of picture is this design upload, and where are the tattoos in it? (cheap text call, not metered) */
export async function POST(req: Request) {
  if (!aiConfigured()) return json({ kind: null, tattoos: [] });
  const body = await req.json().catch(() => ({}));
  let img;
  try {
    img = dataUrlToBuffer(body.image);
  } catch {
    return json({ kind: null, tattoos: [] }, 400);
  }
  if (img.buf.length > 3_000_000) return json({ kind: null, tattoos: [] }, 413);
  const found = await findTattoos({ ...img, name: 'design.jpg' }, isLang(body.lang) ? body.lang : 'en');
  return json(found || { kind: null, tattoos: [] });
}
