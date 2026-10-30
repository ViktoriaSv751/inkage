import { LANG_INFO, tx, type Lang } from './tr';

/* Dark, quiet e-mails with their own layouts: limitEmail (a meter), anniversaryEmail (one huge numeral), newsletterEmail
   (a guide with a picture), newsletterConfirmEmail (one centred card). */
const SANS = "-apple-system,BlinkMacSystemFont,'Helvetica Neue','Segoe UI',Helvetica,Arial,sans-serif";
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const qOf = (lang: Lang) => (lang === 'hu' ? '' : `?lang=${lang}`);

function page(lang: string, title: string, pre: string, body: string) {
  return `<!DOCTYPE html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting"><meta name="color-scheme" content="dark only"><meta name="supported-color-schemes" content="dark only"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:#000000;" bgcolor="#000000"><div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${esc(pre)}${'&#8199;&#847;'.repeat(30)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#000000" style="background:#000000;"><tr><td align="center" style="padding:0 16px;">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;">${body}</table></td></tr></table></body></html>`;
}
const logo = (origin: string, align = 'left') => `<tr><td align="${align}" style="padding:30px 4px 0;font-family:${SANS};font-size:18px;font-weight:800;letter-spacing:-.02em;color:#ffffff;"><img src="${origin}/brand/mark-white-96.png" width="24" height="22" alt="" style="vertical-align:-4px;border:0;margin-right:6px;">InkAge</td></tr>`;
const button = (href: string, label: string, bg = '#ffffff', fg = '#000000') => `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" bgcolor="${bg}" style="background:${bg};border-radius:12px;"><a href="${href}" target="_blank" style="display:inline-block;padding:15px 28px;font-family:${SANS};font-size:16px;font-weight:700;color:${fg};text-decoration:none;border-radius:12px;">${esc(label)}</a></td></tr></table>`;
const foot = (origin: string, text: string, unsub?: { href: string; label: string }) => `<tr><td style="padding:44px 4px 36px;font-family:${SANS};font-size:12px;line-height:19px;color:#62626c;">${esc(text)}${unsub ? `<br><a href="${unsub.href}" style="color:#8a8a94;">${esc(unsub.label)}</a> · ` : ' · '}<a href="${origin}" style="color:#8a8a94;">inkage.app</a></td></tr>`;

/** The monthly allowance: used up, or back. */
export function limitEmail(lang: Lang, o: { kind: 'reached'; used: number; limit: number; resetsAt: string } | { kind: 'restart'; limit: number; unsubscribe: string }, origin = 'https://inkage.app') {
  const T = (en: string, hu: string) => tx(lang, en, hu);
  const reached = o.kind === 'reached';
  const subject = reached ? T('You’ve used this month’s previews', 'Elérted a havi keretedet') : T('Your previews are back', 'Újraindult a havi kereted');
  const when = reached ? new Intl.DateTimeFormat(LANG_INFO[lang].locale, { month: 'long', day: 'numeric', timeZone: 'Europe/Budapest' }).format(new Date(o.resetsAt)) : '';
  const pre = reached ? T(`They start again on ${when}.`, `${when}: újraindul.`) : T(`You have ${o.limit} previews again this month.`, `Ebben a hónapban újra ${o.limit} előnézet jár.`);
  const num = reached ? `${o.used}<span style="color:#62626c;font-weight:300;"> / ${o.limit}</span>` : `0<span style="color:#62626c;font-weight:300;"> / ${o.limit}</span>`;
  const bar = reached
    ? `<td bgcolor="#a896ff" style="height:8px;background:#a896ff;border-radius:4px;font-size:1px;line-height:1px;">&nbsp;</td>`
    : `<td bgcolor="#26262c" style="height:8px;background:#26262c;border-radius:4px;font-size:1px;line-height:1px;">&nbsp;</td>`;
  const body = reached
    ? T('If you don’t want to wait: invite a friend, and you both get an extra preview when they sign up.', 'Ha nem akarsz várni: hívj meg egy barátot, és ha regisztrál, mindketten kaptok egy plusz előnézetet.')
    : T('A new spot, a new size, the design you’ve been thinking about: try them on your own skin.', 'Új hely, új méret, vagy az a minta, amin gondolkodsz: próbáld ki a saját bőrödön.');
  const q = qOf(lang);
  const cta = reached ? button(`${origin}/app/profile${q}`, T('Invite a friend', 'Meghívok egy barátot')) : button(`${origin}/app${q}`, T('Make a preview', 'Új előnézet készítése'));
  const html = page(lang, subject, pre, `${logo(origin)}
<tr><td style="padding:48px 4px 0;font-family:${SANS};font-size:64px;line-height:68px;font-weight:800;letter-spacing:-.04em;color:#ffffff;">${num}</td></tr>
<tr><td style="padding:16px 4px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${bar}</tr></table></td></tr>
<tr><td style="padding:28px 4px 0;font-family:${SANS};font-size:28px;line-height:33px;font-weight:800;letter-spacing:-.025em;color:#ffffff;">${esc(subject)}</td></tr>
${reached ? `<tr><td style="padding:10px 4px 0;font-family:${SANS};font-size:17px;line-height:26px;color:#e7e7ea;">${esc(pre)}</td></tr>` : ''}
<tr><td style="padding:12px 4px 0;font-family:${SANS};font-size:16px;line-height:25px;color:#b9b9c1;">${esc(body)}</td></tr>
<tr><td style="padding:28px 4px 0;">${cta}</td></tr>
${foot(origin, T('About your InkAge account.', 'Az InkAge-fiókoddal kapcsolatban.'), !reached ? { href: o.unsubscribe, label: T('Don’t send reminders', 'Ne küldjetek emlékeztetőt') } : undefined)}`);
  return { subject, html, text: `${subject}\n\n${pre}\n\n${body}\n\n${origin}/app${q}` };
}

/** A year after someone marked a preview as done. */
export function anniversaryEmail(lang: Lang, previewId: string, unsubscribe: string, origin = 'https://inkage.app') {
  const T = (en: string, hu: string) => tx(lang, en, hu);
  const q = lang === 'hu' ? '&' : `&lang=${lang}&`;
  const link = `${origin}/app/gallery?${q.slice(1)}id=${encodeURIComponent(previewId)}`;
  const subject = T('Your tattoo is one year old', 'Egy éve készült a tetoválásod');
  const pre = T('Take a photo and compare it with the preview.', 'Fotózd le, és hasonlítsd össze az előnézettel.');
  const body = T('Has it become what the preview showed? Take a photo in daylight, add it next to the preview, and you’ll see how your ink is really aging.', 'Olyan lett, mint amit az előnézet mutatott? Fotózd le nappali fényben, tedd az előnézet mellé, és meglátod, hogyan öregszik valójában.');
  const cta = T('Compare it', 'Összehasonlítom');
  const html = page(lang, subject, pre, `${logo(origin)}
<tr><td style="padding:34px 4px 0;font-family:${SANS};font-size:190px;line-height:176px;font-weight:200;letter-spacing:-.06em;color:#ffffff;">1</td></tr>
<tr><td style="padding:18px 4px 0;font-family:${SANS};font-size:30px;line-height:35px;font-weight:800;letter-spacing:-.025em;color:#ffffff;">${esc(subject)}</td></tr>
<tr><td style="padding:14px 4px 0;font-family:${SANS};font-size:17px;line-height:27px;color:#b9b9c1;">${esc(body)}</td></tr>
<tr><td style="padding:28px 4px 0;">${button(link, cta, '#5b3df5', '#ffffff')}</td></tr>
${foot(origin, T('You marked this preview as done in InkAge.', 'Az InkAge-ben megjelölted, hogy elkészült ez a tetoválás.'), { href: unsubscribe, label: T('Don’t send reminders', 'Ne küldjetek emlékeztetőt') })}`);
  return { subject, html, text: `${subject}\n\n${body}\n\n${cta}: ${link}` };
}

export type Guide = { title: string; desc: string; href: string; image: string | null };

/** The monthly guide: one article with its picture, two more as plain links. */
export function newsletterEmail(lang: Lang, main: Guide, more: Guide[], unsubscribe: string, origin = 'https://inkage.app') {
  const T = (en: string, hu: string) => tx(lang, en, hu);
  const month = new Intl.DateTimeFormat(LANG_INFO[lang].locale, { month: 'long', timeZone: 'Europe/Budapest' }).format(new Date());
  const kicker = `${T('Monthly guide', 'Havi útmutató')} · ${month}`;
  const read = T('Read the guide', 'Elolvasom');
  const off = T('Unsubscribe', 'Leiratkozás');
  const rows = more.map((g) => `<tr><td style="padding:16px 0;border-top:1px solid #26262c;font-family:${SANS};"><a href="${g.href}" style="font-size:17px;line-height:24px;font-weight:700;color:#ffffff;text-decoration:none;">${esc(g.title)} &rarr;</a><div style="padding-top:4px;font-size:14px;line-height:21px;color:#8a8a94;">${esc(g.desc)}</div></td></tr>`).join('');
  const html = page(lang, main.title, main.desc, `${logo(origin)}
<tr><td style="padding:30px 4px 0;font-family:${SANS};font-size:12px;font-weight:700;letter-spacing:2.4px;text-transform:uppercase;color:#a896ff;">${esc(kicker)}</td></tr>
<tr><td style="padding:12px 4px 0;font-family:${SANS};font-size:34px;line-height:39px;font-weight:800;letter-spacing:-.03em;color:#ffffff;">${esc(main.title)}</td></tr>
${main.image ? `<tr><td style="padding:22px 0 0;font-size:0;line-height:0;"><a href="${main.href}" target="_blank" style="display:block;"><img src="${main.image}" width="560" alt="" style="display:block;width:100%;height:auto;border:0;border-radius:16px;background:#141418;"></a></td></tr>` : ''}
<tr><td style="padding:20px 4px 0;font-family:${SANS};font-size:17px;line-height:27px;color:#b9b9c1;">${esc(main.desc)}</td></tr>
<tr><td style="padding:24px 4px 0;">${button(main.href, read)}</td></tr>
${rows ? `<tr><td style="padding:40px 4px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table></td></tr>` : ''}
${foot(origin, T('You’re getting this because you subscribed on inkage.app.', 'Azért kapod, mert feliratkoztál az inkage.app oldalon.'), { href: unsubscribe, label: off })}`);
  return { subject: main.title, html, text: `${kicker}\n\n${main.title}\n${main.desc}\n${main.href}\n\n${more.map((g) => `${g.title}\n${g.href}`).join('\n\n')}\n\n${off}: ${unsubscribe}` };
}

/** Double opt-in for the monthly guide. */
export function newsletterConfirmEmail(lang: Lang, confirm: string, unsubscribe: string, origin = 'https://inkage.app') {
  const T = (en: string, hu: string) => tx(lang, en, hu);
  const subject = T('Confirm your subscription – InkAge', 'Erősítsd meg a feliratkozást – InkAge');
  const line = T('Once a month we send a new guide on keeping tattoos looking good. If this was you, please confirm:', 'Havonta egyszer küldünk egy új útmutatót arról, hogyan marad szép a tetoválás. Ha te voltál, erősítsd meg:');
  const cta = T('Confirm subscription', 'Feliratkozás megerősítése');
  const html = page(lang, subject, line, `${logo(origin, 'center')}
<tr><td style="padding:28px 0 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#141418" style="background:#141418;border-radius:20px;"><tr><td align="center" style="padding:40px 28px;">
<div style="font-family:${SANS};font-size:30px;line-height:35px;font-weight:800;letter-spacing:-.025em;color:#ffffff;">${esc(T('One more click', 'Még egy kattintás'))}</div>
<div style="padding-top:12px;font-family:${SANS};font-size:16px;line-height:25px;color:#b9b9c1;">${esc(line)}</div>
<div style="padding-top:24px;">${button(confirm, cta)}</div>
</td></tr></table></td></tr>
<tr><td align="center" style="padding:24px 4px 36px;font-family:${SANS};font-size:12px;line-height:19px;color:#62626c;">${esc(T('If this wasn’t you, just ignore this e-mail.', 'Ha nem te voltál, hagyd figyelmen kívül ezt a levelet.'))}<br><a href="${unsubscribe}" style="color:#8a8a94;">${esc(T('Unsubscribe', 'Leiratkozás'))}</a></td></tr>`);
  return { subject, html, text: `${line}\n\n${cta}: ${confirm}` };
}
