import { appSecret, json, userClient } from '@/lib/server';
import { imageModels, textModels } from '@/lib/ai';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const GEMINI = 'https://generativelanguage.googleapis.com/v1beta/models';

/** Does this model still exist for our key? (free metadata call) */
async function exists(model: string) {
  const r = await fetch(`${GEMINI}/${model}`, { headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY! } }).catch(() => null);
  return !!r?.ok;
}

/**
 * Daily model check (Vercel cron): are the AI models we rely on still there and answering?
 * A retired model once silently switched off photo checks for hours; this catches it the same day.
 */
export async function GET() {
  if (!process.env.GEMINI_API_KEY) return json({ ok: false, error: 'no key' });
  const text = textModels(), image = imageModels();
  const [textOk, imageOk] = await Promise.all([Promise.all(text.map(exists)), Promise.all(image.map(exists))]);
  const activeText = text.find((_, i) => textOk[i]) || null;
  const activeImage = image.find((_, i) => imageOk[i]) || null;
  // one tiny real call, so a quota or billing problem shows up too
  let answer = '';
  if (activeText) {
    const r = await fetch(`${GEMINI}/${activeText}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY! },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'Reply with the word OK.' }] }], generationConfig: { maxOutputTokens: 5 } }),
    }).catch(() => null);
    const d: any = await r?.json().catch(() => ({}));
    answer = r?.ok ? String(d?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim().slice(0, 20) : `error ${r?.status}: ${String(d?.error?.message || '').slice(0, 160)}`;
  }
  const preferred = { text: text[0], image: image[0] };
  const ok = !!activeText && !!activeImage && !answer.startsWith('error');
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
  return json({ ok, ...detail });
}
