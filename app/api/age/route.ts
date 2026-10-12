import { dataUrlToBuffer, getAuthed, json, serverConfig, sha, verifyToken } from '@/lib/server';
import { agePrompt, aiConfigured, Analysis, editImage, friendlyAiError, STAGES, Stage } from '@/lib/ai';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req: Request) {
  const cfg = serverConfig();
  if (!aiConfigured() || !cfg.auth) return json({ error: 'Not set up yet.' }, 503);
  const a = await getAuthed(req);
  if (!a) return json({ error: 'Please sign in first.', code: 'auth' }, 401);

  const body = await req.json().catch(() => ({}));
  const stage = body.stage as Stage;
  if (!STAGES.includes(stage)) return json({ error: 'Bad stage' }, 400);
  const t = verifyToken<{ uid: string; gid: number; h: string; w: number; hh: number; an: Analysis; exp: number }>(body.token);
  if (!t || t.uid !== a.user.id || t.exp < Date.now()) return json({ error: 'Unlock aging to see this.', code: 'paywall' }, 402);
  if (sha(body.image || '') !== t.h) return json({ error: 'Start a new preview and try again.' }, 400);

  const { data: allowed } = await a.db.rpc('bump_age', { p_gid: t.gid });
  if (!allowed) return json({ error: 'Limit reached for this image. Start a new preview.' }, 429);

  try {
    const img = dataUrlToBuffer(body.image);
    const image = await editImage(
      [{ ...img, name: 'fresh.jpg' }],
      agePrompt(stage, t.an),
      t.w,
      t.hh
    );
    return json({ stage, image });
  } catch (e) {
    console.error('age failed', e);
    return json({ error: friendlyAiError(e) }, 502);
  }
}
