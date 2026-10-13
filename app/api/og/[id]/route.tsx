import { ImageResponse } from 'next/og';
import { PUBLIC } from '@/lib/public-config';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

/** Link preview for a vote link: fresh and 50 years side by side (WhatsApp, Messenger, iMessage…). */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const origin = new URL(req.url).origin;
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
