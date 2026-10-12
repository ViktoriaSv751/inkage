import type { Metadata } from 'next';
import Link from 'next/link';
import { PUBLIC } from '@/lib/public-config';
import { Vote } from './Vote';

export const dynamic = 'force-dynamic';

export type Share = {
  paths: { fresh?: string; y50?: string };
  placement: string;
  score: number | null;
  created_at: string;
  votes: { yes: number; no: number; change: number };
};

async function getShare(id: string): Promise<Share | null> {
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
  const s = await getShare(params.id);
  const title = 'Should I get this tattoo? 👀';
  const description = 'See how it looks fresh and after 50 years, then vote. Made with InkAge.';
  return {
    title,
    description,
    robots: { index: false },
    openGraph: { title, description, images: s?.paths.y50 ? [{ url: s.paths.y50 }] : undefined },
    twitter: { card: 'summary_large_image', title, description, images: s?.paths.y50 ? [s.paths.y50] : undefined },
  };
}

export default async function SharePage({ params }: { params: { id: string } }) {
  const s = await getShare(params.id);
  if (!s)
    return (
      <main className="legal" style={{ textAlign: 'center' }}>
        <h1>Not found</h1>
        <p>This preview was removed or the link is wrong.</p>
        <Link className="btn" href="/app">
          Try InkAge
        </Link>
      </main>
    );
  return <Vote id={params.id} initial={s} />;
}
