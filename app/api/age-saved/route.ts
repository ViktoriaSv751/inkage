import sharp from 'sharp';
import { logServerError } from '@/lib/errlog';
import { getAuthed, json, serverConfig } from '@/lib/server';
import { agePrompt, aiConfigured, analyse, Analysis, editImage, friendlyAiError, secondaryImageModels, STAGES, Stage, stageYears } from '@/lib/ai';
import { DEFAULT_ANALYSIS } from '@/lib/ai/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const ID = /^[a-f0-9-]{36}$/;
const BUCKET = 'previews';
// the nearest saved image to continue from, so the stages stay consistent with each other
const FROM: Record<Stage, string[]> = { healed: ['fresh'], y10: ['fresh'], y30: ['y10', 'fresh'], y50: ['y30', 'y10', 'fresh'] };
const isStored = (p: unknown): p is string => typeof p === 'string' && !!p && !p.startsWith('job:');

/** One aging stage of a preview saved in the gallery. The image comes from the account's own storage, and the result goes back there. */
export async function POST(req: Request) {
  if (!aiConfigured() || !serverConfig().auth) return json({ error: 'Not set up yet.' }, 503);
  const a = await getAuthed(req);
  if (!a) return json({ error: 'Please sign in again.', code: 'auth' }, 401);

  const body = await req.json().catch(() => ({}));
  const stage = body.stage as Stage;
  const id = String(body.id || '');
  if (!STAGES.includes(stage) || !ID.test(id)) return json({ error: 'Bad stage' }, 400);

  const { data: row } = await a.db.from('previews').select('paths, analysis, report, deleted_at').eq('id', id).maybeSingle();
  if (!row || row.deleted_at) return json({ error: 'Start a new preview and try again.' }, 404);
  const paths = (row.paths || {}) as Record<string, string>;
  if (paths[stage]) return json({ error: 'Already done' }, 409);
  const key = FROM[stage].find((k) => isStored(paths[k]));
  // an older image still on its way to storage: the gallery moves it when it loads
  if (!key) return json({ error: 'Please try again in a minute.' }, 409);

  const { data: gid } = await a.db.rpc('start_saved_aging', { p_preview: id });
  if (!gid) return json({ error: 'Start a new preview and try again.' }, 404);
  const { data: allowed } = await a.db.rpc('bump_age', { p_gid: gid });
  if (!allowed) return json({ error: 'Limit reached for this image. Start a new preview.' }, 429);

  try {
    const { data: file, error } = await a.db.storage.from(BUCKET).download(paths[key]);
    if (error || !file) throw error || new Error('image not found');
    const buf = Buffer.from(await file.arrayBuffer());
    const meta = await sharp(buf).metadata();
    const img = { buf, mime: file.type || 'image/jpeg', name: 'fresh.jpg' };

    // saved previews keep only the age: the rest of the analysis is made once, when it is first needed
    let an = row.analysis as (Partial<Analysis> & Record<string, unknown>) | null;
    if (!an?.skinTone) {
      const found = await analyse(img);
      an = { ...found, ...(an || {}) };
      await a.db.from('previews').update({ analysis: an }).eq('id', id).then(() => {}, () => {});
    }
    const sun = (row.report as any)?.input?.sun;
    const analysis: Analysis = { ...DEFAULT_ANALYSIS, ...an, ...(sun ? { sunExposure: sun } : {}) };

    const from = key === 'fresh' ? 0 : stageYears(key as Stage);
    const image = await editImage([img], agePrompt(stage, analysis, from), meta.width || 1024, meta.height || 1024, secondaryImageModels());

    // saved right here, so closing the app doesn't lose it
    const m = /^data:(image\/[a-z+]+);base64,(.+)$/i.exec(image);
    if (!m) throw new Error('Invalid image');
    const small = await sharp(Buffer.from(m[2], 'base64')).resize({ width: 1080, height: 1080, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
    const path = `${a.user.id}/${id}/${stage}.jpg`;
    const up = await a.db.storage.from(BUCKET).upload(path, small, { contentType: 'image/jpeg', upsert: true, cacheControl: '604800' });
    if (up.error) throw up.error;
    const added = await a.db.rpc('add_preview_paths', { p_id: id, p_paths: { [stage]: path } });
    if (added.error) throw added.error;
    return json({ stage, image });
  } catch (e) {
    console.error('saved aging failed', e);
    await logServerError('age-saved', e);
    return json({ error: friendlyAiError(e) }, 502);
  }
}
