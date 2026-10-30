import { getAuthed, json, quota, serverConfig } from '@/lib/server';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export async function GET(req: Request) {
  if (!serverConfig().auth) return json({ user: null });
  const a = await getAuthed(req);
  if (!a) return json({ user: null });
  return json({ user: { id: a.user.id, email: a.user.email }, ...(await quota(a.db)) });
}
