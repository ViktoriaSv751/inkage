import { fromBrowser, qOf, tx } from '@/lib/tr';
import { headers } from 'next/headers';
import Link from 'next/link';
import { PUBLIC } from '@/lib/public-config';
import { Vote } from './Vote';
import { Poll } from './Poll';
import type { PollData } from '@/lib/share';

export type Share = {
  paths: { fresh?: string; y50?: string; freshB?: string; y50B?: string };
  labels?: { a?: string | null; b?: string | null };
  placement: string;
  score: number | null;
  created_at: string;
  votes: { yes: number; no: number; change: number };
};

export async function getPoll(id: string): Promise<PollData | null> {
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

export async function getShare(id: string): Promise<Share | null> {
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

/** A shared preview or poll. Inside the app (inApp, opened from Explore) it keeps the app's frame. */
export async function SharedView({ id, inApp = false }: { id: string; inApp?: boolean }) {
  const poll = id.startsWith('p') ? await getPoll(id) : null;
  if (poll) return <Poll id={id} initial={poll} inApp={inApp} />;
  const s = await getShare(id);
  if (!s) {
    const lang = fromBrowser(headers().get('accept-language') || '');
    return (
      <main className="legal" style={{ textAlign: 'center' }}>
        <h1>{tx(lang, 'This link no longer works', 'Ez a link már nem él')}</h1>
        <p>{tx(lang, 'Its owner closed or removed it, or the address is wrong.', 'A készítője lezárta vagy törölte, vagy elírás van a címben.')}</p>
        <Link className="btn" href={inApp ? '/app/explore' : `/regisztracio${qOf(lang)}`}>
          {inApp ? tx(lang, 'Back to Explore', 'Vissza a Felfedezéshez') : tx(lang, 'Register and try it', 'Regisztrálok és kipróbálom')}
        </Link>
      </main>
    );
  }
  return <Vote id={id} initial={s} inApp={inApp} />;
}
