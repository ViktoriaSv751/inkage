import { LANG_INFO, isLang } from './tr';

/* "New sign-up" notice for the owner (ADMIN_NOTIFY_EMAIL, else ALERT_EMAIL). Sent by /api/welcome together with the person's
   welcome e-mail, so it goes out once per new account, for every way of signing up, and only for confirmed accounts.
   In Hungarian. Works without images too (dark table layout, bgcolor everywhere). */

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export type SignupInfo = { name: string; email: string; lang: string; country: string; provider: string; createdAt: string; userId: string };

function flag(cc: string) {
  return /^[A-Z]{2}$/.test(cc) ? String.fromCodePoint(...[...cc].map((c) => 0x1f1a5 + c.charCodeAt(0))) : '🌍';
}
function countryName(cc: string) {
  try {
    return cc ? new Intl.DisplayNames(['hu'], { type: 'region' }).of(cc) || cc : 'Ismeretlen';
  } catch {
    return cc || 'Ismeretlen';
  }
}

export function signupEmail(u: SignupInfo, origin = 'https://inkage.app') {
  const when = new Date(u.createdAt || Date.now());
  const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('hu-HU', { timeZone: 'Europe/Budapest', ...o }).format(when);
  const name = u.name.trim() || u.email.split('@')[0];
  const lang = isLang(u.lang) ? LANG_INFO[u.lang].hu : u.lang || 'Ismeretlen';
  const country = countryName(u.country);
  const via = ({ email: 'E-mail és jelszó', apple: 'Apple-fiók', google: 'Google-fiók' } as Record<string, string>)[u.provider] || u.provider || 'E-mail';
  const viaIcon = ({ email: '✉️', apple: '🍎', google: '🔐' } as Record<string, string>)[u.provider] || '🔐';
  const people = `${origin}/admin#users`;
  const subject = `🎉 Új regisztráció: ${name}`;
  const pre = `${name} (${u.email}) most regisztrált az InkAge-be. ${flag(u.country)} ${country} · ${lang} · ${via}`;
  const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
  const tile = (icon: string, value: string, label: string) => `<td width="50%" valign="top" style="padding:6px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#121216" style="background:#121216;border:1px solid #26262e;border-radius:18px;"><tr><td style="padding:20px 18px;">
<div style="font-size:26px;line-height:30px;">${icon}</div>
<div style="padding-top:10px;font-family:${SANS};font-size:17px;line-height:22px;font-weight:700;color:#f5f5f7;">${value}</div>
<div style="padding-top:5px;font-family:${SANS};font-size:11px;letter-spacing:1.6px;text-transform:uppercase;color:#8a8a94;">${label}</div>
</td></tr></table></td>`;

  const html = `<!DOCTYPE html>
<html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting"><meta name="color-scheme" content="dark only"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#000000;" bgcolor="#000000">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${esc(pre)}${'&#8199;&#847;'.repeat(30)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#000000" style="background:#000000;"><tr><td align="center" style="padding:22px 0;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">

<tr><td style="padding:0 24px 18px;font-family:${SANS};font-size:20px;font-weight:800;letter-spacing:-.02em;color:#ffffff;"><img src="${origin}/brand/mark-white-96.png" width="30" height="28" alt="" style="vertical-align:-6px;border:0;margin-right:8px;">InkAge</td></tr>

<tr><td style="padding:0 24px;font-size:0;line-height:0;"><a href="${people}" target="_blank" style="display:block;"><img src="${origin}/email/signup-hero.jpg" width="552" alt="Egy tetoválás ma és 50 év múlva" style="display:block;width:100%;height:auto;border:0;border-radius:22px 22px 0 0;"></a></td></tr>

<tr><td style="padding:0 24px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#17123a" style="background:#17123a;background-image:linear-gradient(160deg,#2a1f7a 0%,#100c28 70%);border-radius:0 0 22px 22px;"><tr><td align="center" style="padding:30px 22px 32px;">
<div style="font-family:${SANS};font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#b4a6ff;">&#10022;&nbsp; Új regisztráció &nbsp;&#10022;</div>
<div style="padding-top:14px;font-family:${SANS};font-size:36px;line-height:42px;font-weight:800;letter-spacing:-.02em;color:#ffffff;">${esc(name)}</div>
<div style="padding-top:10px;font-family:${SANS};font-size:16px;line-height:22px;"><a href="mailto:${esc(u.email)}" style="color:#e4e0ff;text-decoration:none;">${esc(u.email)}</a></div>
</td></tr></table></td></tr>

<tr><td style="padding:16px 18px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>${tile(flag(u.country), esc(country), 'Ország')}${tile('💬', esc(lang), 'Nyelv')}</tr>
<tr>${tile(viaIcon, esc(via), 'Regisztráció módja')}${tile('🕒', `${esc(fmt({ hour: '2-digit', minute: '2-digit' }))} <span style="font-weight:400;color:#a9a9b3;font-size:14px;">· ${esc(fmt({ month: 'long', day: 'numeric' }))}</span>`, 'Időpont (Budapest)')}</tr>
</table></td></tr>

<tr><td align="center" style="padding:28px 30px 0;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" bgcolor="#5b3df5" style="background:#5b3df5;border-radius:999px;">
<a href="${people}" target="_blank" style="display:inline-block;padding:17px 36px;font-family:${SANS};font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:999px;">Megnézem az Emberek oldalon</a>
</td></tr></table></td></tr>
<tr><td align="center" style="padding:16px 30px 0;font-family:${SANS};font-size:14px;"><a href="mailto:${esc(u.email)}" style="color:#b4a6ff;text-decoration:none;font-weight:700;">Írok neki &rarr;</a></td></tr>

<tr><td style="padding:34px 40px 0;"><div style="height:1px;background:#26262e;line-height:1px;font-size:1px;">&nbsp;</div></td></tr>
<tr><td align="center" style="padding:20px 30px 34px;font-family:${SANS};">
<p style="margin:0 0 6px;font-size:15px;font-weight:600;color:#f5f5f7;">Nézd meg, mielőtt örökre szól.</p>
<p style="margin:0;font-size:11px;line-height:18px;color:#6f6f78;">Belső értesítő az InkAge tulajdonosának · felhasználó: <span style="font-family:'Courier New',monospace;">${esc(u.userId.slice(0, 8))}</span></p>
</td></tr>
</table></td></tr></table>
</body></html>`;
  const text = `Új regisztráció az InkAge-ben\n\n${name}\n${u.email}\n\nOrszág: ${country}\nNyelv: ${lang}\nRegisztráció: ${via}\nIdőpont: ${fmt({ dateStyle: 'long', timeStyle: 'short' })}\nFelhasználó: ${u.userId}\n\n${people}`;
  return { subject, html, text };
}
