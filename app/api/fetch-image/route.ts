import dns from 'dns/promises';
import net from 'net';
import sharp from 'sharp';
import { json } from '@/lib/server';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const maxDuration = 30;

/** Never fetch from private / local networks (the link comes from a user). */
function privateIp(ip: string): boolean {
  if (ip.startsWith('::ffff:')) ip = ip.slice(7);
  if (net.isIPv6(ip)) return ip === '::1' || ip === '::' || /^f[cd]/i.test(ip) || /^fe[89ab]/i.test(ip);
  const [a, b] = ip.split('.').map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}
async function safeUrl(raw: string) {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' || u.username || u.password || (u.port && u.port !== '443')) return null;
  if (net.isIP(u.hostname)) return null;
  const addrs = await dns.lookup(u.hostname, { all: true }).catch(() => []);
  if (!addrs.length || addrs.some((a) => privateIp(a.address))) return null;
  return u;
}
async function get(u: URL) {
  const ctl = new AbortController();
  const tm = setTimeout(() => ctl.abort(), 9000);
  try {
    // follow redirects by hand so every hop is checked
    let url = u;
    for (let i = 0; i < 4; i++) {
      const r = await fetch(url, { redirect: 'manual', signal: ctl.signal, headers: { 'user-agent': 'Mozilla/5.0 (compatible; InkAgeBot/1.0)', accept: 'text/html,image/*' } });
      if (r.status >= 300 && r.status < 400 && r.headers.get('location')) {
        const next = await safeUrl(new URL(r.headers.get('location')!, url).toString());
        if (!next) return null;
        url = next;
        continue;
      }
      return r;
    }
    return null;
  } finally {
    clearTimeout(tm);
  }
}
async function readCapped(r: Response, max: number) {
  const reader = r.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let n = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    n += value.length;
    if (n > max) return null;
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

/** A design from a link (Pinterest, Instagram, any image URL): returns the picture as a small JPEG. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const first = await safeUrl(String(body.url || '').trim());
  if (!first) return json({ error: 'That link can’t be opened. Copy the image itself, or save it and upload it.' }, 400);
  let r = await get(first).catch(() => null);
  if (!r?.ok) return json({ error: 'That link can’t be opened. Copy the image itself, or save it and upload it.' }, 400);
  let type = r.headers.get('content-type') || '';
  if (type.includes('text/html')) {
    // a page: use its preview image (og:image), which is how Pinterest and Instagram share pictures
    const html = (await readCapped(r, 2_000_000))?.toString('utf8') || '';
    const m = /<meta[^>]+(?:property|name)=["'](?:og:image(?::secure_url)?|twitter:image)["'][^>]*content=["']([^"']+)["']/i.exec(html) || /<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["'](?:og:image|twitter:image)["']/i.exec(html);
    const img = m && (await safeUrl(new URL(m[1].replace(/&amp;/g, '&'), first).toString()));
    if (!img) return json({ error: 'We couldn’t find a picture on that page. Copy the image itself, or save it and upload it.' }, 422);
    r = await get(img).catch(() => null);
    if (!r?.ok) return json({ error: 'That link can’t be opened. Copy the image itself, or save it and upload it.' }, 400);
    type = r.headers.get('content-type') || '';
  }
  if (!type.startsWith('image/')) return json({ error: 'That link isn’t a picture.' }, 415);
  const buf = await readCapped(r, 12_000_000);
  if (!buf) return json({ error: 'That picture is too large.' }, 413);
  try {
    const out = await sharp(buf).rotate().resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true }).flatten({ background: '#ffffff' }).jpeg({ quality: 88 }).toBuffer();
    return json({ image: `data:image/jpeg;base64,${out.toString('base64')}` });
  } catch {
    return json({ error: 'That picture could not be opened.' }, 415);
  }
}
