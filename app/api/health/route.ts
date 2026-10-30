import { appSecret, json, userClient } from '@/lib/server';
import { imageModels, textModels } from '@/lib/ai';
import { isAdmin } from '@/lib/admin/server';
import { SUPABASE_KEY, SUPABASE_URL } from '@/lib/supabase/config';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const maxDuration = 60;

const GEMINI = 'https://generativelanguage.googleapis.com/v1beta/models';

/** Does this model still exist for our key? (free metadata call) */
async function exists(model: string) {
  const r = await fetch(`${GEMINI}/${model}`, { headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY! } }).catch(() => null);
  return !!r?.ok;
}

/**
 * Who may run the check: it makes a real (paid) Gemini call, so not the public.
 *  - Vercel's daily cron: "Authorization: Bearer $CRON_SECRET" (Vercel sends it when CRON_SECRET is set in the project)
 *  - the database's own cron token (the same one pg_cron uses for /api/admin/*), checked by admin_cron_ok
 *  - the signed-in owner ("Ellenőrzés most" on /admin → InkAge)
 * Anyone else gets a plain 404. The uptime monitor watches /api/config, not this.
 */
async function allowed(req: Request) {
  const auth = req.headers.get('authorization') || '';
  const cron = process.env.CRON_SECRET;
  if (cron && auth === `Bearer ${cron}`) return true;
  const tok = auth.match(/^Bearer ([0-9a-f]{64})$/)?.[1];
  if (tok) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/admin_cron_ok`, {
      method: 'POST', headers: { apikey: SUPABASE_KEY, 'content-type': 'application/json' }, body: JSON.stringify({ p_token: tok }), cache: 'no-store',
    }).catch(() => null);
    if (r?.ok && (await r.json().catch(() => false)) === true) return true;
  }
  return isAdmin().catch(() => false);
}

/**
 * Daily model check (the database cron "inkage-model-check" calls it with its token): are the AI models we rely on still there and answering?
 * A retired model once silently switched off photo checks for hours; this catches it the same day.
 * Answers HTTP 503 when something is wrong, so any monitor reading the status code sees it too.
 */
export async function GET(req: Request) {
  if (!(await allowed(req))) return new Response('Not found', { status: 404 });
  if (!process.env.GEMINI_API_KEY) return json({ ok: false, error: 'no key' }, 503);
  const text = textModels(), image = imageModels();
  const [textOk, imageOk] = await Promise.all([Promise.all(text.map(exists)), Promise.all(image.map(exists))]);
  const activeText = text.find((_, i) => textOk[i]) || null;
  const activeImage = image.find((_, i) => imageOk[i]) || null;
  // one tiny real call, so a quota or billing problem shows up too
  let answer = '';
  let answered = false;
  if (activeText) {
    const r = await fetch(`${GEMINI}/${activeText}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY! },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'Reply with the word OK.' }] }], generationConfig: { maxOutputTokens: 256 } } /* thinking models spend tokens before answering: 5 left the answer empty */),
    }).catch(() => null);
    const d: any = await r?.json().catch(() => ({}));
    if (r?.ok) {
      answer = String(d?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim().slice(0, 20);
      /* an empty answer (blocked, cut off, no candidates) is a failure too, not "working" */
      answered = !!answer;
      if (!answered) answer = `error: empty answer${d?.candidates?.[0]?.finishReason ? ` (${d.candidates[0].finishReason})` : ''}${d?.promptFeedback?.blockReason ? ` (blocked: ${d.promptFeedback.blockReason})` : ''}`;
    } else answer = `error ${r?.status ?? 'no response'}: ${String(d?.error?.message || '').slice(0, 160)}`;
  }
  const preferred = { text: text[0], image: image[0] };
  const ok = !!activeText && !!activeImage && answered;
  const detail = {
    activeText,
    activeImage,
    preferredMissing: [!textOk[0] && preferred.text, !imageOk[0] && preferred.image].filter(Boolean),
    answer,
  };
  await userClient().rpc('health_add', { p_secret: appSecret('db'), p_ok: ok && !detail.preferredMissing.length, p_detail: detail }).then(() => {}, () => {});

  // e-mail alert when something is wrong (needs RESEND_API_KEY and ALERT_EMAIL in Vercel)
  if ((!ok || detail.preferredMissing.length) && process.env.RESEND_API_KEY && process.env.ALERT_EMAIL) {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: process.env.ALERT_FROM || 'InkAge <onboarding@resend.dev>',
        to: process.env.ALERT_EMAIL,
        subject: ok ? 'InkAge: a preferred AI model is gone (running on a fallback)' : 'InkAge: AI models are NOT working',
        text: JSON.stringify(detail, null, 2),
      }),
    }).catch(() => {});
  }
  return json({ ok, ...detail }, ok ? 200 : 503);
}
