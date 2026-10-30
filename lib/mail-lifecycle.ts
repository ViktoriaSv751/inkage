import { tx, type Lang } from './tr';

/* Two quiet e-mails, dark like the welcome letter but plainer, each with its own look:
   previewReadyEmail: type only, no picture (no body photos in e-mails); photoReminderEmail: one example picture in a card. */
const SANS = "-apple-system,BlinkMacSystemFont,'Helvetica Neue','Segoe UI',Helvetica,Arial,sans-serif";
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function page(lang: string, title: string, pre: string, body: string) {
  return `<!DOCTYPE html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting"><meta name="color-scheme" content="dark only"><meta name="supported-color-schemes" content="dark only"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:#000000;" bgcolor="#000000"><div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${esc(pre)}${'&#8199;&#847;'.repeat(30)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#000000" style="background:#000000;"><tr><td align="center" style="padding:0 16px;">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;">${body}</table></td></tr></table></body></html>`;
}
const logo = (origin: string) => `<tr><td style="padding:30px 4px 0;font-family:${SANS};font-size:18px;font-weight:800;letter-spacing:-.02em;color:#ffffff;"><img src="${origin}/brand/mark-white-96.png" width="24" height="22" alt="" style="vertical-align:-4px;border:0;margin-right:6px;">InkAge</td></tr>`;
const button = (href: string, label: string, bg: string, fg: string) => `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" bgcolor="${bg}" style="background:${bg};border-radius:12px;"><a href="${href}" target="_blank" style="display:inline-block;padding:16px 30px;font-family:${SANS};font-size:16px;font-weight:700;color:${fg};text-decoration:none;border-radius:12px;">${esc(label)}</a></td></tr></table>`;

/** The preview finished after the person had left the app. */
export function previewReadyEmail(lang: Lang, jobId: string, origin = 'https://inkage.app') {
  const T = (en: string, hu: string) => tx(lang, en, hu);
  const q = lang === 'hu' ? '' : `&lang=${lang}`;
  const link = `${origin}/app?job=${encodeURIComponent(jobId)}${q}`;
  const subject = T('Your preview is ready', 'Elkészült az előnézeted');
  const pre = T('You closed the app before it finished, but nothing is lost.', 'Bezártad az appot, mielőtt elkészült, de semmi nem veszett el.');
  const open = T('Open my preview', 'Megnyitom az előnézetet');
  const keep = T('We keep it for two days.', 'Két napig őrizzük meg neked.');
  const dot = (y: string, on: boolean) => `<td width="20%" align="center" style="font-family:${SANS};"><div style="font-size:22px;line-height:24px;font-weight:${on ? 800 : 500};color:${on ? '#ffffff' : '#62626c'};">${y}</div><div style="margin:9px auto 0;width:10px;height:10px;border-radius:50%;background:${on ? '#a896ff' : '#2c2c33'};font-size:1px;line-height:1px;">&nbsp;</div></td>`;
  const html = page(lang, subject, pre, `${logo(origin)}
<tr><td style="padding:52px 4px 0;font-family:${SANS};font-size:38px;line-height:43px;font-weight:800;letter-spacing:-.03em;color:#ffffff;">${esc(subject)}</td></tr>
<tr><td style="padding:16px 4px 0;font-family:${SANS};font-size:17px;line-height:26px;color:#b9b9c1;">${esc(pre)}</td></tr>
<tr><td style="padding:40px 4px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${dot('0', true)}${dot('1', false)}${dot('10', false)}${dot('30', false)}${dot('50', false)}</tr></table></td></tr>
<tr><td style="padding:16px 4px 0;font-family:${SANS};font-size:14px;line-height:22px;color:#8a8a94;">${esc(T('The fresh look is done. Open it and see the years that follow, with one tap.', 'A friss kép kész. Nyisd meg, és egy koppintással jönnek a következő évek.'))}</td></tr>
<tr><td style="padding:34px 4px 0;">${button(link, open, '#5b3df5', '#ffffff')}</td></tr>
<tr><td style="padding:16px 4px 0;font-family:${SANS};font-size:13px;color:#8a8a94;">${esc(keep)}</td></tr>
<tr><td style="padding:56px 4px 36px;font-family:${SANS};font-size:12px;line-height:19px;color:#62626c;">${esc(T('You’re getting this because you started a preview in InkAge.', 'Azért kaptad, mert elindítottál egy előnézetet az InkAge-ben.'))} · <a href="${origin}" style="color:#8a8a94;">inkage.app</a></td></tr>`);
  return { subject, html, text: `${subject}\n\n${pre}\n\n${open}: ${link}\n\n${keep}` };
}

/** One reminder, a day after signing up, for people who haven't added a photo yet. */
export function photoReminderEmail(lang: Lang, unsubscribe: string, origin = 'https://inkage.app') {
  const T = (en: string, hu: string) => tx(lang, en, hu);
  const q = lang === 'hu' ? '' : `?lang=${lang}`;
  const link = `${origin}/app${q}`;
  const subject = T('One photo is missing', 'Egy fotó hiányzik');
  const pre = T('One picture of your skin is enough. In a minute you’ll see it fresh and 50 years later.', 'Elég egy kép a bőrödről. Egy perc múlva látod frissen és 50 év múlva.');
  const body = T('You signed up, but your photo hasn’t arrived yet. One picture of the spot where the tattoo would go is enough, and in a minute you’ll see it fresh and 50 years later.', 'Regisztráltál, de a fotód még nem érkezett meg. Elég egy kép arról a helyről, ahová a tetoválás kerülne, és egy perc múlva látod frissen és 50 év múlva.');
  const cta = T('Add my photo', 'Feltöltöm a fotómat');
  const off = T('Don’t send reminders', 'Ne küldjetek emlékeztetőt');
  const tip = (t: string) => `<tr><td width="24" valign="top" style="padding:7px 0;font-family:${SANS};font-size:15px;color:#a896ff;">&#10003;</td><td style="padding:7px 0;font-family:${SANS};font-size:15px;line-height:22px;color:#d9d9de;">${esc(t)}</td></tr>`;
  const html = page(lang, subject, pre, `${logo(origin)}
<tr><td style="padding:24px 0 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#141418" style="background:#141418;border-radius:20px;">
<tr><td style="font-size:0;line-height:0;"><img src="${origin}/email/reminder-v2.jpg" width="560" height="323" alt="${esc(T('An example: a tattoo on a forearm', 'Példa: tetoválás egy alkaron'))}" style="display:block;width:100%;height:auto;border:0;border-radius:20px 20px 0 0;background:#1d1d22;"></td></tr>
<tr><td style="padding:30px 28px 0;font-family:${SANS};font-size:32px;line-height:37px;font-weight:800;letter-spacing:-.025em;color:#ffffff;">${esc(subject)}</td></tr>
<tr><td style="padding:14px 28px 0;font-family:${SANS};font-size:16px;line-height:25px;color:#b9b9c1;">${esc(body)}</td></tr>
<tr><td style="padding:20px 28px 0;"><table role="presentation" cellpadding="0" cellspacing="0" border="0">${tip(T('In daylight', 'Nappali fényben'))}${tip(T('Sharp and close up', 'Élesen, közelről'))}${tip(T('Only the body area in the picture', 'Csak a testrész legyen a képen'))}</table></td></tr>
<tr><td style="padding:24px 28px 30px;">${button(link, cta, '#ffffff', '#000000')}</td></tr>
</table></td></tr>
<tr><td style="padding:26px 4px 36px;font-family:${SANS};font-size:12px;line-height:19px;color:#62626c;">${esc(T('The picture is an AI example.', 'A kép MI-példa.'))} ${esc(T('This is the only reminder of this kind.', 'Ebből csak ez az egy emlékeztető megy ki.'))}<br><a href="${unsubscribe}" style="color:#8a8a94;">${esc(off)}</a> · <a href="${origin}" style="color:#8a8a94;">inkage.app</a></td></tr>`);
  return { subject, html, text: `${subject}\n\n${body}\n\n${cta}: ${link}\n\n${off}: ${unsubscribe}` };
}
