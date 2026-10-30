/* Three design directions for InkAge's welcome e-mail, to choose from (Hungarian, sample only). */
const ORIGIN = 'https://inkage.app';
const IMG = (f: string) => `${ORIGIN}/email/samples/${f}`;
const SANS = "-apple-system,BlinkMacSystemFont,'Helvetica Neue','Segoe UI',Helvetica,Arial,sans-serif";
const SERIF = "Georgia,'Times New Roman',serif";
const MONO = "'Courier New',Courier,monospace";
const APP = `${ORIGIN}/app`;

function shell(o: { title: string; pre: string; bg: string; scheme: 'dark' | 'light'; body: string }) {
  return `<!DOCTYPE html><html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting"><meta name="color-scheme" content="${o.scheme} only"><meta name="supported-color-schemes" content="${o.scheme} only"><title>${o.title}</title></head>
<body style="margin:0;padding:0;background:${o.bg};" bgcolor="${o.bg}"><div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${o.pre}${'&#8199;&#847;'.repeat(30)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${o.bg}" style="background:${o.bg};"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">${o.body}</table>
</td></tr></table></body></html>`;
}
const button = (label: string, bg: string, fg: string, radius: string, extra = '') =>
  `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" bgcolor="${bg}" style="background:${bg};border-radius:${radius};${extra}"><a href="${APP}" target="_blank" style="display:inline-block;padding:19px 38px;font-family:${SANS};font-size:16px;font-weight:700;color:${fg};text-decoration:none;border-radius:${radius};">${label}</a></td></tr></table>`;

/** A: a letter from your tattoo, written in 2076; the hero ages by itself. */
function letter(name: string) {
  const thumb = (k: string, l: string) => `<td width="25%" style="padding:0 3px;"><img src="${IMG(`a-${k}.jpg`)}" width="136" alt="${l}" style="display:block;width:100%;height:auto;border:0;border-radius:10px;"><div style="padding-top:8px;font-family:${SANS};font-size:22px;font-weight:800;color:#fff;letter-spacing:-.02em;">${k}</div><div style="font-family:${SANS};font-size:10px;letter-spacing:1.4px;color:#8a8a94;text-transform:uppercase;">${l}</div></td>`;
  return {
    subject: 'Ötven év múlva is rajtad leszek.',
    html: shell({
      title: 'Ötven év múlva is rajtad leszek.', pre: 'Levél a tetoválásodtól, 2076-ból.', bg: '#000000', scheme: 'dark',
      body: `
<tr><td style="padding:24px 28px 20px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="font-family:${SANS};font-size:20px;font-weight:800;letter-spacing:-.02em;color:#fff;"><img src="${ORIGIN}/brand/mark-white-96.png" width="28" height="26" alt="" style="vertical-align:-5px;border:0;margin-right:7px;">InkAge</td>
<td align="right" style="font-family:${SERIF};font-style:italic;font-size:14px;color:#a9a9b3;">2076. október 30.</td></tr></table></td></tr>
<tr><td style="font-size:0;line-height:0;"><a href="${APP}" target="_blank" style="display:block;"><img src="${IMG('a-aging.gif')}" width="600" alt="Egy tetoválás ma, majd 10, 30 és 50 év múlva" style="display:block;width:100%;height:auto;border:0;"></a></td></tr>
<tr><td style="padding:40px 32px 0;">
<div style="font-family:${SANS};font-size:12px;font-weight:700;letter-spacing:3.5px;text-transform:uppercase;color:#a896ff;">Levél 2076-ból</div>
<h1 style="margin:16px 0 0;font-family:${SANS};font-size:44px;line-height:47px;font-weight:800;letter-spacing:-.035em;color:#ffffff;">Kedves ${name},<br>én vagyok a tetoválásod.<br><span style="color:#a896ff;">Ötven évvel később.</span></h1>
<p style="margin:28px 0 0;font-family:${SERIF};font-size:20px;line-height:31px;color:#e7e7ea;">Még nem is létezem. Te pedig még dönthetsz.</p>
<p style="margin:18px 0 0;font-family:${SERIF};font-size:18px;line-height:29px;color:#b9b9c1;">Ötven év alatt a vonalaim lágyabbak lesznek, a fekete kékesszürkébe hajlik, a bőr körülöttem ráncosodik. Hogy közben szép maradok-e, az most dől el: a helyen, a méreten, a mintán.</p>
<p style="margin:18px 0 0;font-family:${SERIF};font-size:18px;line-height:29px;color:#b9b9c1;">Tölts fel egy fotót a bőrödről, válassz mintát, és egy perc múlva megmutatom magam.</p>
<p style="margin:22px 0 0;font-family:${SERIF};font-style:italic;font-size:18px;color:#e7e7ea;">Ne engem kérdezz. Nézd meg.</p>
</td></tr>
<tr><td style="padding:32px 32px 0;">${button('Megnézem a saját bőrömön &rarr;', '#ffffff', '#000000', '999px')}</td></tr>
<tr><td style="padding:46px 29px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr valign="top">${thumb('0', 'ma')}${thumb('10', 'év múlva')}${thumb('30', 'év múlva')}${thumb('50', 'év múlva')}</tr></table></td></tr>
<tr><td style="padding:44px 32px 40px;font-family:${SANS};font-size:12px;line-height:19px;color:#6f6f78;">A képek MI-példák: szimuláció inspirációnak, a valós eredmény a tetoválótól, a bőrödtől és az ápolástól is függ.<br>Azért kaptad ezt a levelet, mert most regisztráltál az InkAge-be. · <a href="${ORIGIN}" style="color:#8a8a94;">inkage.app</a></td></tr>`,
    }),
    text: `Kedves ${name}, én vagyok a tetoválásod, ötven évvel később. ${APP}`,
  };
}

/** B: a tattoo studio's worksheet: stencil violet on cream paper. */
function stencil(name: string) {
  const V = '#4a36c9', P = '#f6f0e4';
  const row = (k: string, v: string) => `<tr><td width="96" style="padding:9px 0;border-bottom:1px solid #c9c3ee;font-family:${MONO};font-size:12px;letter-spacing:1px;color:${V};">${k}</td><td style="padding:9px 0;border-bottom:1px solid #c9c3ee;font-family:${MONO};font-size:15px;font-weight:700;color:${V};">${v}</td></tr>`;
  const step = (n: string, t: string, d: string) => `<tr valign="top"><td width="54" style="padding:0 0 22px;font-family:${SANS};font-size:36px;line-height:36px;font-weight:800;color:${V};">${n}</td><td style="padding:2px 0 22px;font-family:${SANS};font-size:17px;line-height:25px;color:#1b1740;"><b>${t}</b><br><span style="color:#5a5580;">${d}</span></td></tr>`;
  return {
    subject: 'A munkalapod elkészült.',
    html: shell({
      title: 'A munkalapod elkészült.', pre: 'Mielőtt tinta érne a bőrödhöz, vázoljuk fel.', bg: P, scheme: 'light',
      body: `
<tr><td style="padding:22px 28px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="font-family:${MONO};font-size:13px;font-weight:700;letter-spacing:2px;color:${V};">INKAGE</td>
<td align="center" style="font-family:${MONO};font-size:18px;color:${V};">+</td>
<td align="right" style="font-family:${MONO};font-size:12px;letter-spacing:1px;color:${V};">MUNKALAP N° 0001</td></tr></table></td></tr>
<tr><td style="padding:34px 28px 0;"><h1 style="margin:0;font-family:${SANS};font-size:50px;line-height:50px;font-weight:800;letter-spacing:-.04em;color:${V};">Mielőtt tinta érne a bőrödhöz, vázoljuk fel.</h1></td></tr>
<tr><td style="font-size:0;line-height:0;padding:6px 0 0;"><img src="${IMG('b-stencil.jpg')}" width="600" alt="Tetoválásminta sablonrajza lila vonalakkal" style="display:block;width:100%;height:auto;border:0;"></td></tr>
<tr><td style="padding:0 28px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${row('ÜGYFÉL', name)}${row('HELY', 'a te bőröd')}${row('MINTA', 'bármi, ami a fejedben van')}${row('ÉVEK', '0 &rarr; 10 &rarr; 30 &rarr; 50')}</table></td></tr>
<tr><td style="padding:40px 28px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${step('1', 'Fotózd le a bőröd.', 'Ott, ahová a tetoválás kerülne.')}${step('2', 'Tedd rá a mintát.', 'A sajátodat, vagy válassz a mintatárból.')}${step('3', 'Nézd meg 50 év múlva.', 'Egy perc, és látod, hogyan öregszik.')}</table></td></tr>
<tr><td style="padding:8px 28px 0;">${button('Felrakom a fotómra &rarr;', V, '#ffffff', '6px')}</td></tr>
<tr><td style="font-size:0;line-height:0;padding:40px 0 0;"><img src="${IMG('b-photo.jpg')}" width="600" alt="A kész tetoválás egy alkaron" style="display:block;width:100%;height:auto;border:0;"></td></tr>
<tr><td style="padding:26px 28px 34px;font-family:${MONO};font-size:11px;line-height:18px;color:${V};">MI-PÉLDA: szimuláció inspirációnak, a valós eredmény a tetoválótól, a bőrödtől és az ápolástól is függ.<br>Azért kaptad, mert most regisztráltál az InkAge-be. <a href="${ORIGIN}" style="color:${V};">inkage.app</a></td></tr>`,
    }),
    text: `${name}, mielőtt tinta érne a bőrödhöz, vázoljuk fel. ${APP}`,
  };
}

/** C: extreme close-up, very few words: skin and ink. */
function macro(name: string) {
  const half = (f: string, l: string, pad: string) => `<td width="50%" style="${pad}"><img src="${IMG(f)}" width="300" alt="${l}" style="display:block;width:100%;height:auto;border:0;"><div style="padding-top:10px;font-family:${SANS};font-size:11px;letter-spacing:2.4px;text-transform:uppercase;color:#8a8a94;">${l}</div></td>`;
  return {
    subject: 'Közelebbről.',
    html: shell({
      title: 'Közelebbről.', pre: 'A tinta a bőrben él. Így néz ki 50 év múlva.', bg: '#0a0a0b', scheme: 'dark',
      body: `
<tr><td style="font-size:0;line-height:0;"><a href="${APP}" target="_blank" style="display:block;"><img src="${IMG('c-macro.jpg')}" width="600" alt="Egy finom vonalas tetoválás egészen közelről" style="display:block;width:100%;height:auto;border:0;"></a></td></tr>
<tr><td style="padding:44px 32px 0;">
<div style="font-family:${SANS};font-size:13px;letter-spacing:.2px;color:#a9a9b3;">${name}, ez ma így néz ki.</div>
<div style="padding-top:6px;font-family:${SANS};font-size:150px;line-height:138px;font-weight:200;letter-spacing:-.06em;color:#ffffff;">50</div>
<div style="padding-top:2px;font-family:${SANS};font-size:30px;line-height:36px;font-weight:300;letter-spacing:-.02em;color:#ffffff;">év múlva nem így.</div>
</td></tr>
<tr><td style="padding:40px 32px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr valign="top">${half('c-0.jpg', 'Ma', 'padding-right:5px;')}${half('c-50.jpg', '50 év múlva', 'padding-left:5px;')}</tr></table></td></tr>
<tr><td style="padding:38px 32px 0;font-family:${SANS};font-size:19px;line-height:30px;font-weight:300;color:#d9d9de;">A tinta a bőrben él. Szétterül, lágyul, öregszik veled. Az InkAge a saját fotódon mutatja meg, hogyan, még mielőtt örökre szólna.</td></tr>
<tr><td style="padding:32px 32px 0;">${button('Nézd meg közelről', '#5b3df5', '#ffffff', '4px')}</td></tr>
<tr><td style="padding:50px 32px 38px;font-family:${SANS};font-size:12px;line-height:19px;color:#6f6f78;"><img src="${ORIGIN}/brand/mark-white-96.png" width="22" height="20" alt="InkAge" style="border:0;display:block;margin-bottom:12px;">A képek MI-példák: szimuláció inspirációnak, a valós eredmény a tetoválótól, a bőrödtől és az ápolástól is függ.<br>Azért kaptad, mert most regisztráltál az InkAge-be. · <a href="${ORIGIN}" style="color:#8a8a94;">inkage.app</a></td></tr>`,
    }),
    text: `${name}, ez ma így néz ki. 50 év múlva nem így. ${APP}`,
  };
}

export const SAMPLES = { a: letter, b: stencil, c: macro } as const;
