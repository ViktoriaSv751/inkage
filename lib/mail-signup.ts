import { LANG_INFO, isLang } from './tr';

/* "New sign-up" notice for the owner (ADMIN_NOTIFY_EMAIL, else ALERT_EMAIL). Sent by /api/welcome together with the person's
   welcome e-mail, so it goes out once per new account, for every way of signing up. In Hungarian, the same layout as Calligra's
   notice in InkAge's colours: photo hero, large name card, icon tiles. */
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const SANS = "'Jost',Helvetica,Arial,sans-serif";
const SERIF = "'Playfair Display',Georgia,'Times New Roman',serif";
const LILAC = 'background:#a896ff;background-image:linear-gradient(100deg,#7d68e8 0%,#d8ceff 28%,#a896ff 52%,#ece6ff 72%,#8f7af0 100%);';

export type SignupInfo = { name: string; email: string; lang: string; country: string; provider: string; createdAt: string; userId: string; source: string; count: number | null };

function countryName(cc: string) {
  try {
    return cc ? new Intl.DisplayNames(['hu'], { type: 'region' }).of(cc) || cc : 'Ismeretlen';
  } catch {
    return cc || 'Ismeretlen';
  }
}
const flag = (cc: string) => (/^[A-Z]{2}$/.test(cc) ? String.fromCodePoint(...[...cc].map((c) => 0x1f1a5 + c.charCodeAt(0))) : '🌍');

export function signupEmail(u: SignupInfo, origin = 'https://inkage.app') {
  const when = new Date(u.createdAt || Date.now());
  const stamp = new Intl.DateTimeFormat('hu-HU', { timeZone: 'Europe/Budapest', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(when);
  const day = new Intl.DateTimeFormat('hu-HU', { timeZone: 'Europe/Budapest', month: 'long', day: 'numeric' }).format(when);
  const time = new Intl.DateTimeFormat('hu-HU', { timeZone: 'Europe/Budapest', hour: '2-digit', minute: '2-digit' }).format(when);
  const name = u.name.trim() || u.email.split('@')[0];
  const lang = isLang(u.lang) ? LANG_INFO[u.lang].hu : u.lang || 'Ismeretlen';
  const country = countryName(u.country);
  const via = ({ email: 'E-mail és jelszó', apple: 'Apple-fiók', google: 'Google-fiók' } as Record<string, string>)[u.provider] || u.provider || 'E-mail';
  const people = `${origin}/admin#users`;
  const viaIcon = ({ email: '✉️', apple: '🍎', google: '🔐' } as Record<string, string>)[u.provider] || '🔐';
  const subject = `🎉 Új regisztráció: ${name}`;
  const pre = `${name} (${u.email}) most regisztrált az InkAge-ben. ${flag(u.country)} ${country} · ${lang} · ${via}`;
  const tile = (icon: string, value: string, label: string) => `<td width="50%" valign="top" style="padding:6px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #2a2638;border-radius:20px;background:#0f0d16;background-image:linear-gradient(160deg,#16131f 0%,#0b0a10 100%);"><tr><td style="padding:22px 20px 20px;">
<div style="font-size:30px;line-height:34px;">${icon}</div>
<div style="padding-top:12px;font-family:${SANS};font-size:19px;line-height:24px;font-weight:bold;color:#f5f3fb;">${value}</div>
<div style="padding-top:6px;font-family:${SANS};font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#8a8696;">${label}</div>
</td></tr></table></td>`;
  const extra = [u.count ? tile('👥', String(u.count), 'Valódi fiók most') : '', u.source ? tile('🔗', esc(u.source), 'Forrás') : ''].filter(Boolean);
  const html = `<!DOCTYPE html>
<html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting"><meta name="color-scheme" content="dark only"><meta name="supported-color-schemes" content="dark only"><title>${esc(subject)}</title>
<!--[if !mso]><!--><link href="https://fonts.googleapis.com/css2?family=Jost:wght@400;700&family=Playfair+Display:ital,wght@1,700&display=swap" rel="stylesheet"><!--<![endif]--></head>
<body style="margin:0;padding:0;background:#000000;" bgcolor="#000000">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${esc(pre)}${'&#8199;&#847;'.repeat(30)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#000000" style="background:#000000;"><tr><td align="center" style="padding:20px 0;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#000000;">
<tr><td style="padding:0;font-size:0;line-height:0;"><a href="${people}" target="_blank" style="display:block;"><img src="${origin}/email/signup-hero-v3.jpg" width="600" height="640" alt="Új tag érkezett. Valaki most csatlakozott az InkAge-hez." style="display:block;width:100%;max-width:600px;height:auto;border:0;"></a></td></tr>

<tr><td style="padding:8px 24px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-radius:26px;${LILAC}"><tr><td style="padding:1.5px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-radius:25px;background:#0c0a14;background-image:radial-gradient(120% 90% at 50% 0%,#221b3d 0%,#0c0a14 60%);"><tr><td align="center" style="padding:34px 26px 34px;">
<div style="font-family:${SANS};font-size:11px;font-weight:bold;letter-spacing:3px;text-transform:uppercase;color:#a896ff;">&#10022;&nbsp; Aki most csatlakozott &nbsp;&#10022;</div>
<div style="padding-top:16px;font-family:${SERIF};font-size:46px;line-height:52px;font-style:italic;font-weight:bold;color:#d8ceff;">${esc(name)}</div>
<div style="padding-top:12px;font-family:${SANS};font-size:17px;line-height:24px;"><a href="mailto:${esc(u.email)}" style="color:#f5f3fb;text-decoration:none;">${esc(u.email)}</a></div>
</td></tr></table></td></tr></table></td></tr>

<tr><td style="padding:18px 18px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>${tile(flag(u.country), esc(country), 'Ország')}${tile('💬', esc(lang), 'Nyelv')}</tr>
<tr>${tile(viaIcon, esc(via), 'Regisztráció módja')}${tile('🕒', `${esc(time)} <span style="font-weight:normal;color:#b5b1c0;font-size:15px;">· ${esc(day)}</span>`, 'Időpont (Budapest)')}</tr>
${extra.length ? `<tr>${extra.join('')}${extra.length === 1 ? '<td width="50%"></td>' : ''}</tr>` : ''}
</table></td></tr>

<tr><td align="center" style="padding:34px 30px 0;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" bgcolor="#a896ff" style="border-radius:40px;${LILAC}">
<a href="${people}" target="_blank" style="display:inline-block;padding:20px 42px;font-family:${SANS};font-size:15px;font-weight:bold;letter-spacing:1.6px;text-transform:uppercase;color:#120d26;text-decoration:none;border-radius:40px;">Megnézem a felhasználókat &rarr;</a>
</td></tr></table></td></tr>
<tr><td align="center" style="padding:18px 30px 0;font-family:${SANS};font-size:14px;letter-spacing:1px;"><a href="mailto:${esc(u.email)}" style="color:#a896ff;text-decoration:none;font-weight:bold;">ÍROK NEKI &rarr;</a></td></tr>

<tr><td style="padding:40px 40px 0;"><div style="height:1px;background:#26232f;line-height:1px;font-size:1px;">&nbsp;</div></td></tr>
<tr><td align="center" style="padding:24px 30px 38px;">
<p style="margin:0 0 8px;font-family:${SERIF};font-size:17px;font-style:italic;color:#f5f3fb;">Még egy ember, aki előbb megnézi, mielőtt örökre szól.</p>
<p style="margin:0;font-family:${SANS};font-size:11px;line-height:18px;color:#6c6878;">Belső értesítő az InkAge csapatának · felhasználó: <span style="font-family:'Courier New',monospace;">${esc(u.userId.slice(0, 8))}</span></p>
</td></tr>
</table></td></tr></table>
</body></html>`;
  const text = `Új regisztráció az InkAge-ben\n\n${name}\n${u.email}\n\nOrszág: ${country}\nNyelv: ${lang}\nBelépés: ${via}\nForrás: ${u.source || 'Nem ismert'}\nIdőpont: ${stamp}\n${u.count ? `Valódi fiókok: ${u.count}\n` : ''}\n${people}`;
  return { subject, html, text };
}
