import { LANG_INFO, tx, type Lang } from './tr';

/* The welcome e-mail: a letter from the person's tattoo, written 50 years from now. Sent once per account by /api/welcome.
   The hero ages by itself (mail apps that don't animate, like Outlook, show its first frame). The numbers in the pictures
   are the only text in them, so one set of images serves every language. */
const IMG = (origin: string, f: string) => `${origin}/email/welcome/${f}`;
const SANS = "-apple-system,BlinkMacSystemFont,'Helvetica Neue','Segoe UI',Helvetica,Arial,sans-serif";
const SERIF = "Georgia,'Times New Roman',serif";
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function welcomeEmail(firstName: string, lang: Lang, origin = 'https://inkage.app') {
  const T = (en: string, hu: string) => tx(lang, en, hu);
  const q = lang === 'hu' ? '' : `?lang=${lang}`;
  const app = `${origin}/app${q}`;
  const name = firstName.trim();
  const future = new Date();
  future.setFullYear(future.getFullYear() + 50);
  const dateline = new Intl.DateTimeFormat(LANG_INFO[lang].locale, { year: 'numeric', month: 'long', day: 'numeric' }).format(future);
  const subject = T('I’ll still be on you in fifty years.', 'Ötven év múlva is rajtad leszek.');
  const pre = T('A letter from your tattoo, written fifty years from now.', 'Levél a tetoválásodtól, ötven évvel későbbről.');
  const kicker = T('A letter from the future', `Levél ${future.getFullYear()}-${[1, 2, 4, 5, 7, 9].includes(future.getFullYear() % 10) ? 'ből' : 'ból'}`);
  const hello = name ? T(`Dear ${esc(name)},`, `Kedves ${esc(name)},`) : T('Hello,', 'Szia,');
  const who = T('I’m your tattoo.', 'én vagyok a tetoválásod.');
  const later = T('Fifty years later.', 'Ötven évvel később.');
  const p1 = T('I don’t even exist yet. And you can still decide.', 'Még nem is létezem. Te pedig még dönthetsz.');
  const p2 = T('Over fifty years my lines will soften, the black will turn blue-grey, the skin around me will wrinkle. Whether I stay beautiful is being decided now: the spot, the size, the design.', 'Ötven év alatt a vonalaim lágyabbak lesznek, a fekete kékesszürkébe hajlik, a bőr körülöttem ráncosodik. Hogy közben szép maradok-e, az most dől el: a helyen, a méreten, a mintán.');
  const p3 = T('Upload a photo of your skin, choose a design, and in a minute I’ll show you what I become.', 'Tölts fel egy fotót a bőrödről, válassz mintát, és egy perc múlva megmutatom magam.');
  const p4 = T('Don’t ask me. See for yourself.', 'Ne engem kérdezz. Nézd meg.');
  const cta = T('See it on my own skin', 'Megnézem a saját bőrömön');
  const today = T('today', 'ma');
  const years = T('years later', 'év múlva');
  const note = T('The pictures are AI examples: a simulation for inspiration. Real results also depend on your artist, your skin and aftercare.', 'A képek MI-példák: szimuláció inspirációnak, a valós eredmény a tetoválótól, a bőrödtől és az ápolástól is függ.');
  const why = T('You’re getting this because you just signed up for InkAge.', 'Azért kaptad ezt a levelet, mert most regisztráltál az InkAge-be.');
  const thumb = (k: string, l: string) => `<td width="25%" valign="top" style="padding:0 3px;"><img src="${IMG(origin, `y${k}.jpg`)}" width="136" alt="${esc(`${k} ${l}`)}" style="display:block;width:100%;height:auto;border:0;border-radius:10px;"><div style="padding-top:8px;font-family:${SANS};font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-.02em;">${k}</div><div style="font-family:${SANS};font-size:10px;letter-spacing:1.2px;color:#8a8a94;text-transform:uppercase;">${esc(l)}</div></td>`;

  const html = `<!DOCTYPE html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting"><meta name="color-scheme" content="dark only"><meta name="supported-color-schemes" content="dark only"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#000000;" bgcolor="#000000"><div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${esc(pre)}${'&#8199;&#847;'.repeat(30)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#000000" style="background:#000000;"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
<tr><td style="padding:24px 28px 20px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="font-family:${SANS};font-size:20px;font-weight:800;letter-spacing:-.02em;color:#ffffff;"><img src="${origin}/brand/mark-white-96.png" width="28" height="26" alt="" style="vertical-align:-5px;border:0;margin-right:7px;">InkAge</td>
<td align="right" style="font-family:${SERIF};font-style:italic;font-size:14px;color:#a9a9b3;">${esc(dateline)}</td></tr></table></td></tr>
<tr><td style="font-size:0;line-height:0;"><a href="${app}" target="_blank" style="display:block;"><img src="${IMG(origin, 'aging.gif')}" width="600" alt="${esc(T('A tattoo today, then 1, 10, 30 and 50 years later', 'Egy tetoválás ma, majd 1, 10, 30 és 50 év múlva'))}" style="display:block;width:100%;height:auto;border:0;"></a></td></tr>
<tr><td style="padding:40px 32px 0;">
<div style="font-family:${SANS};font-size:12px;font-weight:700;letter-spacing:3.5px;text-transform:uppercase;color:#a896ff;">${esc(kicker)}</div>
<h1 style="margin:16px 0 0;font-family:${SANS};font-size:42px;line-height:46px;font-weight:800;letter-spacing:-.035em;color:#ffffff;">${hello}<br>${esc(who)}<br><span style="color:#a896ff;">${esc(later)}</span></h1>
<p style="margin:28px 0 0;font-family:${SERIF};font-size:20px;line-height:31px;color:#e7e7ea;">${esc(p1)}</p>
<p style="margin:18px 0 0;font-family:${SERIF};font-size:18px;line-height:29px;color:#b9b9c1;">${esc(p2)}</p>
<p style="margin:18px 0 0;font-family:${SERIF};font-size:18px;line-height:29px;color:#b9b9c1;">${esc(p3)}</p>
<p style="margin:22px 0 0;font-family:${SERIF};font-style:italic;font-size:18px;color:#e7e7ea;">${esc(p4)}</p>
</td></tr>
<tr><td style="padding:32px 32px 0;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" bgcolor="#ffffff" style="background:#ffffff;border-radius:999px;"><a href="${app}" target="_blank" style="display:inline-block;padding:19px 38px;font-family:${SANS};font-size:16px;font-weight:700;color:#000000;text-decoration:none;border-radius:999px;">${esc(cta)} &rarr;</a></td></tr></table></td></tr>
<tr><td style="padding:46px 29px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr valign="top">${thumb('0', today)}${thumb('10', years)}${thumb('30', years)}${thumb('50', years)}</tr></table></td></tr>
<tr><td style="padding:44px 32px 40px;font-family:${SANS};font-size:12px;line-height:19px;color:#6f6f78;">${esc(note)}<br>${esc(why)} · <a href="${origin}${q}" style="color:#8a8a94;">inkage.app</a></td></tr>
</table></td></tr></table></body></html>`;
  const text = `${name ? T(`Dear ${name},`, `Kedves ${name},`) : T('Hello,', 'Szia,')} ${who} ${later}\n\n${p1}\n\n${p2}\n\n${p3}\n\n${p4}\n\n${cta}: ${app}\n\n${note}`;
  return { subject, html, text };
}
