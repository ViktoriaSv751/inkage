import { LANG_INFO, isLang } from './tr';

/* "New sign-up" notice for the owner (ADMIN_NOTIFY_EMAIL, else ALERT_EMAIL). Sent by /api/welcome together with the person's
   welcome e-mail, so it goes out once per new account, for every way of signing up. In Hungarian, in the welcome e-mail's look:
   black page, big type, a serif line, hairline rows instead of boxes. Reads fine with images off too. */
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const SANS = "-apple-system,BlinkMacSystemFont,'Helvetica Neue','Segoe UI',Helvetica,Arial,sans-serif";
const SERIF = "Georgia,'Times New Roman',serif";

export type SignupInfo = { name: string; email: string; lang: string; country: string; provider: string; createdAt: string; userId: string; source: string; count: number | null };

function countryName(cc: string) {
  try {
    return cc ? new Intl.DisplayNames(['hu'], { type: 'region' }).of(cc) || cc : 'Ismeretlen';
  } catch {
    return cc || 'Ismeretlen';
  }
}
const flag = (cc: string) => (/^[A-Z]{2}$/.test(cc) ? `${String.fromCodePoint(...[...cc].map((c) => 0x1f1a5 + c.charCodeAt(0)))} ` : '');

export function signupEmail(u: SignupInfo, origin = 'https://inkage.app') {
  const when = new Date(u.createdAt || Date.now());
  const stamp = new Intl.DateTimeFormat('hu-HU', { timeZone: 'Europe/Budapest', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(when);
  const name = u.name.trim() || u.email.split('@')[0];
  const lang = isLang(u.lang) ? LANG_INFO[u.lang].hu : u.lang || 'Ismeretlen';
  const country = countryName(u.country);
  const via = ({ email: 'E-mail és jelszó', apple: 'Apple-fiók', google: 'Google-fiók' } as Record<string, string>)[u.provider] || u.provider || 'E-mail';
  const people = `${origin}/admin#users`;
  const subject = `Új regisztráció: ${name}`;
  const pre = `${name} most csatlakozott az InkAge-hez. ${country} · ${lang} · ${via}`;
  const row = (k: string, v: string) => `<tr><td width="112" style="padding:15px 0;border-top:1px solid #26262c;font-family:${SANS};font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#8a8a94;">${k}</td><td style="padding:15px 0;border-top:1px solid #26262c;font-family:${SANS};font-size:17px;font-weight:600;color:#ffffff;">${v}</td></tr>`;
  const html = `<!DOCTYPE html><html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting"><meta name="color-scheme" content="dark only"><meta name="supported-color-schemes" content="dark only"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#000000;" bgcolor="#000000"><div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${esc(pre)}${'&#8199;&#847;'.repeat(30)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#000000" style="background:#000000;"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
<tr><td style="padding:24px 28px 20px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="font-family:${SANS};font-size:20px;font-weight:800;letter-spacing:-.02em;color:#ffffff;"><img src="${origin}/brand/mark-white-96.png" width="28" height="26" alt="" style="vertical-align:-5px;border:0;margin-right:7px;">InkAge</td>
<td align="right" style="font-family:${SERIF};font-style:italic;font-size:14px;color:#a9a9b3;">${esc(stamp)}</td></tr></table></td></tr>
<tr><td style="font-size:0;line-height:0;"><a href="${people}" target="_blank" style="display:block;"><img src="${origin}/email/signup-hero.jpg" width="600" alt="Egy tetoválás közelről: ma és 50 év múlva" style="display:block;width:100%;height:auto;border:0;"></a></td></tr>
<tr><td style="padding:40px 32px 0;">
<div style="font-family:${SANS};font-size:12px;font-weight:700;letter-spacing:3.5px;text-transform:uppercase;color:#a896ff;">Új regisztráció</div>
<h1 style="margin:16px 0 0;font-family:${SANS};font-size:52px;line-height:54px;font-weight:800;letter-spacing:-.04em;color:#ffffff;">${esc(name)}</h1>
<div style="padding-top:6px;font-family:${SANS};font-size:30px;line-height:36px;font-weight:800;letter-spacing:-.03em;color:#a896ff;">most csatlakozott.</div>
<p style="margin:20px 0 0;font-family:${SERIF};font-size:19px;line-height:28px;"><a href="mailto:${esc(u.email)}" style="color:#e7e7ea;text-decoration:none;">${esc(u.email)}</a></p>
</td></tr>
${u.count ? `<tr><td style="padding:34px 32px 0;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td valign="middle" style="font-family:${SANS};font-size:84px;line-height:80px;font-weight:200;letter-spacing:-.05em;color:#ffffff;padding-right:16px;">${u.count}</td><td valign="middle" style="font-family:${SERIF};font-style:italic;font-size:18px;line-height:25px;color:#b9b9c1;">valódi fiók most<br>az InkAge-ben.</td></tr></table></td></tr>` : ''}
<tr><td style="padding:34px 32px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${row('Ország', `${flag(u.country)}${esc(country)}`)}${row('Nyelv', esc(lang))}${row('Belépés', esc(via))}${row('Forrás', esc(u.source || 'Nem ismert'))}
<tr><td colspan="2" style="border-top:1px solid #26262c;font-size:1px;line-height:1px;">&nbsp;</td></tr></table></td></tr>
<tr><td style="padding:32px 32px 0;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" bgcolor="#ffffff" style="background:#ffffff;border-radius:999px;"><a href="${people}" target="_blank" style="display:inline-block;padding:18px 34px;font-family:${SANS};font-size:15px;font-weight:700;color:#000000;text-decoration:none;border-radius:999px;">Megnézem az Emberek oldalon &rarr;</a></td></tr></table></td></tr>
<tr><td style="padding:20px 32px 0;font-family:${SANS};font-size:15px;font-weight:700;"><a href="mailto:${esc(u.email)}" style="color:#a896ff;text-decoration:none;">Írok neki &rarr;</a></td></tr>
<tr><td style="padding:44px 32px 38px;"><p style="margin:0 0 8px;font-family:${SERIF};font-style:italic;font-size:17px;color:#e7e7ea;">Még egy ember, aki előbb megnézi, mielőtt örökre szól.</p><p style="margin:0;font-family:${SANS};font-size:11px;line-height:18px;color:#6f6f78;">Belső értesítő az InkAge tulajdonosának · felhasználó: ${esc(u.userId.slice(0, 8))}</p></td></tr>
</table></td></tr></table></body></html>`;
  const text = `Új regisztráció az InkAge-ben\n\n${name}\n${u.email}\n\nOrszág: ${country}\nNyelv: ${lang}\nBelépés: ${via}\nForrás: ${u.source || 'Nem ismert'}\nIdőpont: ${stamp}\n${u.count ? `Valódi fiókok: ${u.count}\n` : ''}\n${people}`;
  return { subject, html, text };
}
