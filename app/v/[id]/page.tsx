import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import { PUBLIC } from '@/lib/public-config';
import { Vote } from './Vote';
import { Poll } from './Poll';
import type { PollData } from '@/lib/share';

export const dynamic = 'force-dynamic';

export type Share = {
  paths: { fresh?: string; y50?: string; freshB?: string; y50B?: string };
  labels?: { a?: string | null; b?: string | null };
  placement: string;
  score: number | null;
  created_at: string;
  votes: { yes: number; no: number; change: number };
};

async function getPoll(id: string): Promise<PollData | null> {
  if (!/^p[a-f0-9]{10}$/.test(id)) return null;
  try {
    const r = await fetch(`${PUBLIC.supabaseUrl}/rest/v1/rpc/get_poll`, {
      method: 'POST',
      headers: { apikey: PUBLIC.supabaseAnonKey, Authorization: `Bearer ${PUBLIC.supabaseAnonKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ p_share: id }),
      cache: 'no-store',
    });
    if (!r.ok) return null;
    return (await r.json()) as PollData | null;
  } catch {
    return null;
  }
}

async function getShare(id: string): Promise<Share | null> {
  if (id.startsWith('p')) return null;
  try {
    const r = await fetch(`${PUBLIC.supabaseUrl}/rest/v1/rpc/get_share`, {
      method: 'POST',
      headers: { apikey: PUBLIC.supabaseAnonKey, Authorization: `Bearer ${PUBLIC.supabaseAnonKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ p_share: id }),
      cache: 'no-store',
    });
    if (!r.ok) return null;
    return (await r.json()) as Share | null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const host = headers().get('x-forwarded-host') || headers().get('host') || 'inkage.vercel.app';
  if (params.id.startsWith('p')) {
    const p = await getPoll(params.id);
    const hu = /^hu/i.test(headers().get('accept-language') || '');
    const n = p?.options.length || 1;
    const title = `${p?.question || (n > 1 ? (hu ? 'Melyiket csináltassam meg?' : 'Which one should I get?') : hu ? 'Csináltassam meg ezt a tetoválást?' : 'Should I get this tattoo?')} 👀`;
    const description = hu ? 'Nézd meg, és szavazz – egy koppintás, regisztráció nélkül.' : 'Take a look and vote – one tap, no sign-up.';
    const og = p ? [`https://${host}/api/og/${params.id}`] : undefined;
    return { title, description, robots: { index: false }, openGraph: { title, description, images: og?.map((url) => ({ url, width: 1200, height: 630 })) }, twitter: { card: 'summary_large_image', title, description, images: og } };
  }
  const s = await getShare(params.id);
  const abs = (u?: string) => (u && u.startsWith('/') ? `https://${host}${u}` : u);
  if (s) s.paths = { fresh: abs(s.paths.fresh), y50: abs(s.paths.y50), freshB: abs(s.paths.freshB), y50B: abs(s.paths.y50B) };
  const hu = /^hu/i.test(headers().get('accept-language') || '');
  const title = hu ? 'Csináltassam meg ezt a tetoválást? 👀' : 'Should I get this tattoo? 👀';
  const description = hu ? 'Nézd meg frissen és 50 év múlva, aztán szavazz. InkAge-dzsel készült.' : 'See how it looks fresh and after 50 years, then vote. Made with InkAge.';
  return {
    title,
    description,
    robots: { index: false },
    openGraph: { title, description, images: s?.paths.y50 ? [{ url: `https://${host}/api/og/${params.id}`, width: 1200, height: 630 }] : undefined },
    twitter: { card: 'summary_large_image', title, description, images: s?.paths.y50 ? [`https://${host}/api/og/${params.id}`] : undefined },
  };
}

export default async function SharePage({ params }: { params: { id: string } }) {
  const poll = params.id.startsWith('p') ? await getPoll(params.id) : null;
  if (poll) return <Poll id={params.id} initial={poll} />;
  const s = await getShare(params.id);
  if (!s)
    return (
      <main className="legal" style={{ textAlign: 'center' }}>
        <h1>Ez a link már nem él</h1>
        <p>A készítője lezárta vagy törölte, vagy elírás van a címben.</p>
        <p className="muted small" lang="en">This vote link was closed or removed, or the address is wrong.</p>
        <Link className="btn" href="/app">
          Kipróbálom a saját fotómon
        </Link>
      </main>
    );
  return <Vote id={params.id} initial={s} />;
}
