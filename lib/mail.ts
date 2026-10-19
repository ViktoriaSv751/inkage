// Transactional e-mail through Resend (needs RESEND_API_KEY; MAIL_FROM on a verified domain).
export const mailReady = () => !!process.env.RESEND_API_KEY;
const FROM = () => process.env.MAIL_FROM || process.env.ALERT_FROM || 'InkAge <onboarding@resend.dev>';
export const SITE = () => process.env.SITE_URL || 'https://inkage.app';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** A clean, light e-mail with one button. */
export function layout(o: { title: string; lines: string[]; button?: { href: string; label: string }; foot?: string }) {
  const p = o.lines.map((l) => `<p style="margin:0 0 14px;font-size:16px;line-height:1.55;color:#3a3a42">${esc(l)}</p>`).join('');
  const btn = o.button
    ? `<p style="margin:22px 0 6px"><a href="${o.button.href}" style="display:inline-block;background:#5b3df5;color:#fff;text-decoration:none;font-weight:700;padding:14px 26px;border-radius:999px;font-size:16px">${esc(o.button.label)}</a></p>`
    : '';
  return `<!doctype html><html><body style="margin:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f7;padding:28px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border-radius:24px;padding:32px 28px">
<tr><td>
<p style="margin:0 0 22px;font-weight:800;font-size:20px;letter-spacing:-.02em;color:#000">● InkAge</p>
<h1 style="margin:0 0 16px;font-size:26px;line-height:1.15;letter-spacing:-.02em;color:#000">${esc(o.title)}</h1>
${p}${btn}
<p style="margin:26px 0 0;font-size:13px;line-height:1.5;color:#8a8a93">${esc(o.foot || 'InkAge · AI previews for inspiration, not a guarantee.')}</p>
</td></tr></table></td></tr></table></body></html>`;
}

export async function sendMail(to: string | string[], subject: string, html: string, text: string, replyTo?: string) {
  if (!mailReady()) return false;
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: FROM(), to, subject, html, text, ...(replyTo ? { reply_to: replyTo } : {}) }),
  }).catch(() => null);
  return !!r?.ok;
}
