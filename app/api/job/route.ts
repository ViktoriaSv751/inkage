import { getAuthed, json } from '@/lib/server';
import { guestFrom } from '@/lib/guest';
import { jobGet } from '@/lib/jobs';

export const dynamic = 'force-dynamic';

/** Pick up the results of a preview that was running when the app was closed. */
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get('id') || '';
  if (!/^[a-f0-9-]{36}$/.test(id)) return json({ data: null }, 400);
  const a = await getAuthed(req);
  const owner = a ? a.user.id : `guest:${guestFrom(req).id}`;
  const data = await jobGet(id, owner).catch((e) => (console.warn('job get threw', e), null));
  if (!data) console.log('job not found', { id, who: owner.slice(0, 12) });
  return json({ data });
}
