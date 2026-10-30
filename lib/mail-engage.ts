import { CARE } from './aftercare-steps';
import { LANG_INFO, tx, type Lang } from './tr';

/* Three more dark, quiet e-mails, each with its own layout: voteEmail (a score line under the picture), careEmail (a dated
   timeline, no picture) and launchEmail (centred, two store buttons). */
const SANS = "-apple-system,BlinkMacSystemFont,'Helvetica Neue','Segoe UI',Helvetica,Arial,sans-serif";
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function page(lang: string, title: string, pre: string, body: string) {
  return `<!DOCTYPE html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting"><meta name="color-scheme" content="dark only"><meta name="supported-color-schemes" content="dark only"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:#000000;" bgcolor="#000000"><div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${esc(pre)}${'&#8199;&#847;'.repeat(30)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#000000" style="background:#000000;"><tr><td align="center" style="padding:0 16px;">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;">${body}</table></td></tr></table></body></html>`;
}
const logo = (origin: string, align = 'left') => `<tr><td align="${align}" style="padding:30px 4px 0;font-family:${SANS};font-size:18px;font-weight:800;letter-spacing:-.02em;color:#ffffff;"><img src="${origin}/brand/mark-white-96.png" width="24" height="22" alt="" style="vertical-align:-4px;border:0;margin-right:6px;">InkAge</td></tr>`;
const button = (href: string, label: string, bg: string, fg: string, border = bg) => `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" bgcolor="${bg}" style="background:${bg};border:1px solid ${border};border-radius:12px;"><a href="${href}" target="_blank" style="display:inline-block;padding:15px 28px;font-family:${SANS};font-size:16px;font-weight:700;color:${fg};text-decoration:none;border-radius:12px;">${esc(label)}</a></td></tr></table>`;

export type VoteMail = { share: string; image?: string | null; poll?: { total: number; label?: string | null; leaderVotes: number } | null; votes?: { yes: number; no: number; change: number } | null };

/** Someone voted on a shared design (at most once an hour per link). */
export function voteEmail(lang: Lang, v: VoteMail, origin = 'https://inkage.app') {
  const T = (en: string, hu: string) => tx(lang, en, hu);
  const q = lang === 'hu' ? '' : `?lang=${lang}`;
  const link = `${origin}/v/${v.share}${q}`;
  const subject = T('Your friends are voting on your tattoo', 'Szavaztak a tervedre');
  const see = T('See the results', 'Eredmények megnézése');
  const off = T('Turn these off under Profile > Settings.', 'Ezeket az értesítéseket a Profil > Beállítások alatt kapcsolhatod ki.');
  const num = (n: number, l: string, on: boolean) => `<td width="33%" align="center" style="padding:20px 4px;font-family:${SANS};border-left:1px solid #26262c;"><div style="font-size:38px;line-height:42px;font-weight:800;letter-spacing:-.03em;color:${on ? '#ffffff' : '#a9a9b3'};">${n}</div><div style="padding-top:4px;font-size:12px;line-height:17px;color:#8a8a94;">${esc(l)}</div></td>`;
  const y = v.votes || { yes: 0, no: 0, change: 0 };
  const top = Math.max(y.yes, y.no, y.change);
  const score = v.poll
    ? `<tr><td style="padding:22px 4px 0;font-family:${SANS};"><div style="font-size:12px;font-weight:700;letter-spacing:2.4px;text-transform:uppercase;color:#a896ff;">${esc(T('In the lead', 'Most ez vezet'))}</div>${v.poll.label ? `<div style="padding-top:6px;font-size:22px;line-height:28px;font-weight:700;color:#ffffff;">${esc(v.poll.label)}</div>` : ''}<div style="padding-top:6px;font-size:15px;line-height:23px;color:#b9b9c1;">${esc(T(`${v.poll.leaderVotes} of ${v.poll.total} votes`, `${v.poll.total} szavazatból ${v.poll.leaderVotes}`))}</div></td></tr>`
    : `<tr><td style="padding:14px 0 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #26262c;border-bottom:1px solid #26262c;"><tr>${num(y.yes, T('Love it', 'Tetszik'), y.yes === top && top > 0)}${num(y.no, T('Don’t do it', 'Ne csináld'), y.no === top && top > 0)}${num(y.change, T('Change something', 'Változtatnék'), y.change === top && top > 0)}</tr></table></td></tr>`;
  const html = page(lang, subject, T('See what they think before it’s permanent.', 'Nézd meg, mit gondolnak, mielőtt örökre szól.'), `${logo(origin)}
<tr><td style="padding:34px 4px 0;font-family:${SANS};font-size:34px;line-height:39px;font-weight:800;letter-spacing:-.03em;color:#ffffff;">${esc(subject)}</td></tr>
${v.image ? `<tr><td style="padding:24px 0 0;font-size:0;line-height:0;"><a href="${link}" target="_blank" style="display:block;"><img src="${v.image}" width="560" alt="${esc(T('Your design', 'A terved'))}" style="display:block;width:100%;height:auto;max-height:560px;object-fit:cover;border:0;border-radius:16px;background:#141418;"></a></td></tr>` : ''}
${score}
<tr><td style="padding:28px 4px 0;">${button(link, see, '#ffffff', '#000000')}</td></tr>
<tr><td style="padding:44px 4px 36px;font-family:${SANS};font-size:12px;line-height:19px;color:#62626c;">${esc(off)} · <a href="${origin}" style="color:#8a8a94;">inkage.app</a></td></tr>`);
  return { subject, html, text: `${subject}\n\n${see}: ${link}\n\n${off}` };
}

/** The healing plan, with real dates, once someone says they had the tattoo done. */
export function careEmail(lang: Lang, startDate: string, origin = 'https://inkage.app') {
  const T = (en: string, hu: string) => tx(lang, en, hu);
  const q = lang === 'hu' ? '' : `?lang=${lang}`;
  const start = new Date(`${startDate}T12:00:00Z`);
  const fmt = new Intl.DateTimeFormat(LANG_INFO[lang].locale, { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const subject = T('Your healing plan', 'A gyógyulási terved');
  const pre = T('Day by day, from today until it’s fully healed.', 'Napról napra, a teljes gyógyulásig.');
  const rows = CARE.map((s, i) => {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + s.day);
    const line = i === CARE.length - 1 ? '' : 'border-left:1px solid #2f2f37;';
    return `<tr valign="top"><td width="74" align="right" style="padding:0 14px 26px 0;font-family:${SANS};font-size:13px;line-height:20px;color:#8a8a94;white-space:nowrap;">${esc(fmt.format(d))}</td><td width="1" style="${line}font-size:1px;line-height:1px;"><div style="width:9px;height:9px;margin:5px 0 0 -5px;border-radius:50%;background:#a896ff;font-size:1px;line-height:1px;">&nbsp;</div></td><td style="padding:0 0 26px 16px;font-family:${SANS};"><div style="font-size:15px;line-height:20px;font-weight:700;color:#ffffff;">${esc(T(`Day ${s.day}`, `${s.day}. nap`))}</div><div style="padding-top:3px;font-size:15px;line-height:23px;color:#b9b9c1;">${esc(T(s.en, s.hu))}</div></td></tr>`;
  }).join('');
  const note = T('General aftercare tips, not medical advice. Follow your tattoo artist’s instructions, and see a doctor if you notice signs of infection.', 'Általános utókezelési tippek, nem orvosi tanács. Kövesd a tetoválód utasításait, és fordulj orvoshoz, ha fertőzés jeleit látod.');
  const html = page(lang, subject, pre, `${logo(origin)}
<tr><td style="padding:40px 4px 0;font-family:${SANS};font-size:34px;line-height:39px;font-weight:800;letter-spacing:-.03em;color:#ffffff;">${esc(subject)}</td></tr>
<tr><td style="padding:12px 4px 0;font-family:${SANS};font-size:16px;line-height:25px;color:#b9b9c1;">${esc(pre)}</td></tr>
<tr><td style="padding:34px 0 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table></td></tr>
<tr><td style="padding:6px 4px 0;font-family:${SANS};font-size:14px;line-height:22px;color:#d9d9de;"><b>${esc(T('After that:', 'Utána:'))}</b> ${esc(T('SPF 50 whenever it sees the sun. Sun is the #1 reason tattoos fade.', '50-es fényvédő, ha napot kap. A nap a fakulás első számú oka.'))}</td></tr>
<tr><td style="padding:28px 4px 0;">${button(`${origin}/app/gallery${q}`, T('Open my gallery', 'Megnyitom a galériámat'), '#141418', '#ffffff', '#3a3a44')}</td></tr>
<tr><td style="padding:44px 4px 36px;font-family:${SANS};font-size:12px;line-height:19px;color:#62626c;">${esc(note)}</td></tr>`);
  const text = `${subject}\n\n${CARE.map((s) => `${T(`Day ${s.day}`, `${s.day}. nap`)}: ${T(s.en, s.hu)}`).join('\n')}\n\n${note}`;
  return { subject, html, text };
}

/** The apps are in the stores. One send, to people who agreed to e-mails, when the owner decides. */
export function launchEmail(lang: Lang, links: { ios: string; play: string; unsubscribe: string }, origin = 'https://inkage.app') {
  const T = (en: string, hu: string) => tx(lang, en, hu);
  const subject = T('InkAge is on your phone now', 'Az InkAge már a telefonodon is');
  const pre = T('Now in the App Store and on Google Play. Same account, same designs.', 'Mostantól az App Store-ban és a Google Playen is. Ugyanaz a fiók, ugyanazok a tervek.');
  const shot = (f: string, l: string) => `<td width="50%" style="padding:0 4px;"><img src="${origin}/email/welcome/${f}" width="200" height="227" alt="${esc(l)}" style="display:block;width:100%;height:auto;border:0;border-radius:16px;background:#141418;"><div style="padding-top:8px;font-family:${SANS};font-size:12px;color:#8a8a94;">${esc(l)}</div></td>`;
  const off = T('Don’t send news like this', 'Ne küldjetek ilyen híreket');
  const html = page(lang, subject, pre, `${logo(origin, 'center')}
<tr><td align="center" style="padding:44px 4px 0;font-family:${SANS};font-size:38px;line-height:43px;font-weight:800;letter-spacing:-.03em;color:#ffffff;">${esc(subject)}</td></tr>
<tr><td align="center" style="padding:14px 12px 0;font-family:${SANS};font-size:17px;line-height:26px;color:#b9b9c1;">${esc(pre)}</td></tr>
<tr><td align="center" style="padding:30px 0 0;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:0 5px;">${button(links.ios, 'App Store', '#ffffff', '#000000')}</td><td style="padding:0 5px;">${button(links.play, 'Google Play', '#ffffff', '#000000')}</td></tr></table></td></tr>
<tr><td align="center" style="padding:40px 40px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:420px;"><tr valign="top">${shot('y0.jpg', T('today', 'ma'))}${shot('y50.jpg', T('50 years later', '50 év múlva'))}</tr></table></td></tr>
<tr><td align="center" style="padding:44px 4px 36px;font-family:${SANS};font-size:12px;line-height:19px;color:#62626c;">${esc(T('The pictures are AI examples.', 'A képek MI-példák.'))}<br><a href="${links.unsubscribe}" style="color:#8a8a94;">${esc(off)}</a> · <a href="${origin}" style="color:#8a8a94;">inkage.app</a></td></tr>`);
  return { subject, html, text: `${subject}\n\n${pre}\n\nApp Store: ${links.ios}\nGoogle Play: ${links.play}\n\n${off}: ${links.unsubscribe}` };
}
