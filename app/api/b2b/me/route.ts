import { getAuthed, json } from '@/lib/server';

export const dynamic = 'force-dynamic';

/* The signed-in account's B2B state for /szalonoknak (null = never started). */
export async function GET(req: Request) {
  const a = await getAuthed(req);
  if (!a) return json({ signedIn: false });
  const { data } = await a.db.from('b2b_subs').select('company, tax_number, plan, status, trial_ends_at, current_period_end, cancel_at_period_end').eq('user_id', a.user.id).maybeSingle();
  return json({ signedIn: true, email: a.user.email, sub: data ?? null });
}
