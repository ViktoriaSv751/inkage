import { logServerError } from '@/lib/errlog';
import { dataUrlToBuffer, getAuthed, json, serverConfig, sha, signToken, verifyToken } from '@/lib/server';
import { agePrompt, aiConfigured, secondaryImageModels, Analysis, editImage, friendlyAiError, REMOVAL, RemovalStage, removalPrompt, STAGES, Stage, stageYears } from '@/lib/ai';
import { guestBumpAge, guestFrom } from '@/lib/guest';
import { jobPut } from '@/lib/jobs';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req: Request) {
  if (!aiConfigured() || !serverConfig().auth) return json({ error: 'Not set up yet.' }, 503);

  const body = await req.json().catch(() => ({}));
  const stage = body.stage as Stage | RemovalStage;
  const isRemoval = (REMOVAL as readonly string[]).includes(stage);
  if (!STAGES.includes(stage as Stage) && !isRemoval) return json({ error: 'Bad stage' }, 400);
  const t = verifyToken<{ uid: string; gid: number; h: string; w: number; hh: number; an: Analysis; y?: number; exp: number }>(body.token);
  if (!t || t.exp < Date.now()) return json({ error: 'This preview expired. Start a new one.' }, 402);
  if (sha(body.image || '') !== t.h) return json({ error: 'Start a new preview and try again.' }, 400);

  let allowed = false;
  if (t.uid.startsWith('guest:')) {
    const g = guestFrom(req);
    if (`guest:${g.id}` !== t.uid) return json({ error: 'Start a new preview and try again.' }, 403);
    allowed = await guestBumpAge(t.gid, g.id);
  } else {
    const a = await getAuthed(req);
    if (!a || a.user.id !== t.uid) return json({ error: 'Please sign in again.', code: 'auth' }, 401);
    const { data } = await a.db.rpc('bump_age', { p_gid: t.gid });
    allowed = !!data;
  }
  if (!allowed) return json({ error: 'Limit reached for this image. Start a new preview.' }, 429);

  try {
    const img = dataUrlToBuffer(body.image);
    // The input may be an already aged image (chained stages stay consistent with each other).
    const from = Number(t.y) || 0;
    if (!isRemoval && from >= stageYears(stage as Stage)) return json({ error: 'Start a new preview and try again.' }, 400);
    if (isRemoval && from > 0) return json({ error: 'Start a new preview and try again.' }, 400);
    const image = await editImage([{ ...img, name: 'fresh.jpg' }], isRemoval ? removalPrompt(stage as RemovalStage, t.an) : agePrompt(stage as Stage, t.an, from), t.w, t.hh, secondaryImageModels());
    // a token for this image, so the next stage can continue from it
    const token = isRemoval ? null : signToken({ ...t, h: sha(image), y: stageYears(stage as Stage) });
    await jobPut(body.job, t.uid, stage, { image, token });
    return json({ stage, image, token });
  } catch (e) {
    console.error('age failed', e);
    await logServerError('age', e);
    return json({ error: friendlyAiError(e) }, 502);
  }
}
