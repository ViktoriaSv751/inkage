import { ImageResponse } from 'next/og';
import { PUBLIC } from '@/lib/public-config';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

/** Link preview for a vote link: fresh and 50 years side by side (WhatsApp, Messenger, iMessage…). */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const origin = new URL(req.url).origin;
  if (/^p[a-f0-9]{10}$/.test(params.id)) return pollOg(origin, params.id);
  const r = await fetch(`${PUBLIC.supabaseUrl}/rest/v1/rpc/get_share`, {
    method: 'POST',
    headers: { apikey: PUBLIC.supabaseAnonKey, Authorization: `Bearer ${PUBLIC.supabaseAnonKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ p_share: params.id }),
    cache: 'no-store',
  }).catch(() => null);
  const s: any = r?.ok ? await r.json() : null;
  const abs = (u?: string) => (u ? (u.startsWith('/') ? origin + u : u) : '');
  const ab = !!s?.paths?.y50B;
  const fresh = abs(ab ? s?.paths?.y50 : s?.paths?.fresh), old = abs(ab ? s?.paths?.y50B : s?.paths?.y50);
  if (!fresh || !old) return new Response('Not found', { status: 404 });
  const labels = ab ? [`A · ${s.labels?.a || ''}`.slice(0, 28), `B · ${s.labels?.b || ''}`.slice(0, 28)] : ['FRISS · FRESH', '50 ÉV · 50 YEARS'];
  const tag = (txt: string) => (
    <div style={{ position: 'absolute', left: 22, top: 22, background: 'rgba(0,0,0,.6)', color: '#fff', fontSize: 30, fontWeight: 700, padding: '8px 20px', borderRadius: 40 }}>{txt}</div>
  );
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: '#0d0b14', padding: 24, gap: 16 }}>
        {[
          [fresh, labels[0]],
          [old, labels[1]],
        ].map(([src, label]) => (
          <div key={label} style={{ flex: 1, display: 'flex', position: 'relative', borderRadius: 24, overflow: 'hidden' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} width={564} height={582} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
            {tag(label)}
          </div>
        ))}
        <div style={{ position: 'absolute', right: 44, bottom: 40, background: '#fff', color: '#000', fontSize: 26, fontWeight: 800, padding: '8px 18px', borderRadius: 30 }}>InkAge</div>
      </div>
    ),
    { width: 1200, height: 630, headers: { 'cache-control': 'public, max-age=3600, s-maxage=86400' } }
  );
}

/** Poll preview: up to 3 designs side by side (or fresh + 50 years for a single one). */
async function pollOg(origin: string, id: string) {
  const r = await fetch(`${PUBLIC.supabaseUrl}/rest/v1/rpc/get_poll`, {
    method: 'POST',
    headers: { apikey: PUBLIC.supabaseAnonKey, Authorization: `Bearer ${PUBLIC.supabaseAnonKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ p_share: id }),
    cache: 'no-store',
  }).catch(() => null);
  const p: any = r?.ok ? await r.json() : null;
  if (!p?.options?.length) return new Response('Not found', { status: 404 });
  const o = p.options as { idx: number; label: string | null; fresh: string; y50: string | null }[];
  const tiles: [string, string][] =
    o.length === 1
      ? o[0].y50
        ? [[origin + o[0].fresh, 'FRISS · FRESH'], [origin + o[0].y50, '50 ÉV · 50 YEARS']]
        : [[origin + o[0].fresh, (o[0].label || '').slice(0, 28)]]
      : o.slice(0, 3).map((x) => [origin + x.fresh, `${String.fromCharCode(65 + x.idx)}${x.label ? ` · ${x.label}` : ''}`.slice(0, 24)]);
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: '#0d0b14', padding: 24, gap: 16 }}>
        {tiles.map(([src, label]) => (
          <div key={src} style={{ flex: 1, display: 'flex', position: 'relative', borderRadius: 24, overflow: 'hidden' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} width={Math.round(1152 / tiles.length)} height={582} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
            {label && <div style={{ position: 'absolute', left: 18, top: 18, background: 'rgba(0,0,0,.6)', color: '#fff', fontSize: 28, fontWeight: 700, padding: '8px 18px', borderRadius: 40 }}>{label}</div>}
          </div>
        ))}
        <div style={{ position: 'absolute', right: 44, bottom: 40, background: '#fff', color: '#000', fontSize: 26, fontWeight: 800, padding: '8px 18px', borderRadius: 30 }}>InkAge · Szavazz! · Vote!</div>
      </div>
    ),
    { width: 1200, height: 630, headers: { 'cache-control': 'public, max-age=600, s-maxage=3600' } }
  );
}
