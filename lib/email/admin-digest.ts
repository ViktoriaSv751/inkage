/* The morning digest and the Sunday weekly report (app/api/admin/digest), in the house style of the other InkAge
   e-mails (admin-signup, welcome): black page, gold-framed hero card, Jost + Playfair, tables with bgcolor everywhere,
   so Gmail and iOS Mail keep the dark background instead of putting light text on white. Pure HTML, in Hungarian. */

type P = Record<string, number>;
export type Digest = { day: string; win_from?: string; win_to?: string; y: P; p: P; w: P; pw: P; all_scored: number; users: number; channels: { k: string; n: number }[]; signin_fail: number;
  best_post: { platform: string; title: string; url: string; views: number; gained: number } | null; gsc: { clicks: number; impressions: number; day: string | null };
  goals: { metric: string; period: string; target: number; value: number }[]; to: string[] };
export type Extra = { inbox_open: number; plans: { title: string; at: string | null; platforms: string[] }[]; week_plan: { t: string; done?: boolean }[] | null; week: P; prev_week: P;
  top_posts: { platform: string; title: string; url: string; views: number }[]; gsc_week: { clicks: number; impressions: number };
  /* followers: the latest count, gained in the last 7 days, since: the first day of the history used (later than a week ago while it is young) */
  followers: { platform: string; followers: number; gained?: number; since?: string }[]; errors_day?: Err[]; errors_week?: Err[] };
type Err = { name: string; provider: string | null; why: string; n: number; last: string };

export const nf = (x: number) => (Number(x) || 0).toLocaleString("hu-HU");
export const ch = (a: number, b: number) => (!b ? (a ? "új" : "–") : `${a >= b ? "▲" : "▼"} ${Math.abs(Math.round(((a - b) / b) * 100))}%`);
const CH: Record<string, string> = { androidapp: "Android-app", tiktok: "TikTok", instagram: "Instagram", google: "Google", facebook: "Facebook", pinterest: "Pinterest", youtube: "YouTube", ai: "MI-keresők", közvetlen: "Közvetlen / ismeretlen", hivatkozás: "Más weboldal", email: "E-mail" };
const PFN: Record<string, string> = { tiktok: "TikTok", instagram: "Instagram", facebook: "Facebook", pinterest: "Pinterest", linkedin: "LinkedIn", youtube: "YouTube" };
const esc = (t: string) => String(t || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
/* a post's address in a link: only https, escaped (it comes from the platforms) */
const url = (u: string, site: string) => (/^https:\/\//i.test(String(u || "")) ? esc(u) : `${site}/admin#social`);

export function todo(d: Digest) {
  const t: string[] = [];
  if (d.signin_fail) t.push(`${nf(d.signin_fail)} sikertelen belépés az elmúlt 24 órában: nézd meg a Rendszer lapot.`);
  if (d.y.sessions >= 20 && d.y.sessions > d.p.sessions * 1.5) t.push(`Forgalmi kiugrás az elmúlt 24 órában (${ch(d.y.sessions, d.p.sessions)}): érdemes gyorsan új videót tenni utána.`);
  const direct = d.channels.find((c) => c.k === "közvetlen")?.n || 0, all = d.channels.reduce((s, c) => s + c.n, 0);
  if (all >= 20 && direct / all > 0.6) t.push("A látogatók nagy része forrás nélkül jön: tegyél inkage.app/go/… rövid linket a videókba.");
  return t;
}

/* the errors in words: what happened, where, how many times */
const ERR: Record<string, string> = { signin_failed: "Sikertelen belépés", auth_error: "Belépési hiba", client_error: "Hiba az appban", storage_full: "Megtelt a tárhely" };
const PROV: Record<string, string> = { google: "Google", apple: "Apple", email: "e-mail" };
/* known messages, explained */
const why = (w: string) => /scopes without modifying the main activity/i.test(w) ? "Android-app: a Google-belépés beállítása hiányos (MainActivity), a gomb nem működik" : w;

/* ---- the building blocks ---- */
const SANS = "'Jost',Helvetica,Arial,sans-serif";
const SERIF = "'Playfair Display',Georgia,'Times New Roman',serif";
const GOLD = "background:#d8b46a;background-image:linear-gradient(100deg,#a87a2e 0%,#f3d896 28%,#cfa04a 52%,#fbe7b0 72%,#c09040 100%);";
const BG = "#000000", CARD = "#100e0a", LINE = "#2e2920", INK = "#f7f3ea", MUTED = "#8f877a", SOFT = "#b9b2a5", GOLDC = "#d8b46a", UP = "#5fd39a", DOWN = "#ff8a73";
const T = `role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"`;

/* the change against the earlier period as a small coloured pill; lowGood: fewer is better (errors) */
function chip(a: number, b: number, lowGood = false) {
  const s = ch(a, b);
  if (s === "–") return `<span style="font-family:${SANS};font-size:12px;color:${MUTED};">–</span>`;
  const good = s === "új" ? !lowGood : lowGood ? a <= b : a >= b;
  const [fg, bg] = good ? [UP, "#0f2a1d"] : [DOWN, "#2e1510"];
  return `<span style="display:inline-block;padding:3px 9px;border-radius:20px;background:${bg};font-family:${SANS};font-size:12px;font-weight:bold;line-height:16px;color:${fg};white-space:nowrap;">${s}</span>`;
}
/* a dark card; the content goes inside */
const card = (inner: string, pad = "22px 22px") => `<table ${T} bgcolor="${CARD}" style="border:1px solid ${LINE};border-radius:20px;background:${CARD};background-image:linear-gradient(160deg,#17140e 0%,#0c0b08 100%);"><tr><td style="padding:${pad};">${inner}</td></tr></table>`;
/* a section's small gold title, outside the cards */
const label = (t: string) => `<tr><td style="padding:30px 30px 10px;font-family:${SANS};font-size:11px;font-weight:bold;letter-spacing:3px;text-transform:uppercase;color:${GOLDC};">${t}</td></tr>`;
const block = (inner: string) => `<tr><td style="padding:0 24px;">${inner}</td></tr>`;
/* a thin progress bar, at least a sliver when the value isn't 0 */
function bar(v: number, max: number, color = GOLDC) {
  const pct = !v ? 0 : Math.max(2, Math.min(100, Math.round((v / Math.max(1, max)) * 100)));
  return `<table ${T} bgcolor="#221e17" style="border-radius:6px;background:#221e17;"><tr>${pct ? `<td width="${pct}%" height="6" bgcolor="${color}" style="height:6px;border-radius:6px;font-size:0;line-height:0;${color === GOLDC ? GOLD : `background:${color};`}">&nbsp;</td>` : ""}<td height="6" style="height:6px;font-size:0;line-height:0;">&nbsp;</td></tr></table>`;
}
/* one tile of the 2×2 grid */
const tile = (l: string, a: number, b: number, lowGood = false) => `<td width="50%" valign="top" style="padding:6px;">${card(`
<div style="font-family:${SANS};font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${MUTED};">${l}</div>
<div style="padding-top:10px;font-family:${SANS};font-size:34px;line-height:38px;font-weight:bold;color:${INK};">${nf(a)}</div>
<div style="padding-top:10px;">${chip(a, b, lowGood)} <span style="font-family:${SANS};font-size:12px;color:${MUTED};">&nbsp;előtte ${nf(b)}</span></div>`, "20px 18px 18px")}</td>`;
/* a row of a list inside a card: left text, right value */
const line = (left: string, right: string, first = false) => `<tr><td style="padding:${first ? "0" : "12px"} 0 0;${first ? "" : `border-top:1px solid ${LINE};`}"><table ${T}><tr>
<td style="padding-top:${first ? "0" : "12px"};font-family:${SANS};font-size:15px;line-height:21px;color:${INK};">${left}</td>
<td align="right" style="padding-top:${first ? "0" : "12px"};padding-left:12px;font-family:${SANS};font-size:15px;line-height:21px;font-weight:bold;color:${INK};white-space:nowrap;">${right}</td></tr></table></td></tr>`;
const button = (href: string, t: string) => `<tr><td align="center" style="padding:36px 30px 0;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" bgcolor="${GOLDC}" style="border-radius:40px;${GOLD}">
<a href="${href}" target="_blank" style="display:inline-block;padding:19px 40px;font-family:${SANS};font-size:14px;font-weight:bold;letter-spacing:1.6px;text-transform:uppercase;color:#1a1206;text-decoration:none;border-radius:40px;">${t} &rarr;</a></td></tr></table></td></tr>`;

function page(o: { subject: string; pre: string; kicker: string; title: string; sub: string; body: string; foot: string }) {
  return `<!DOCTYPE html>
<html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light only"><title>${esc(o.subject)}</title>
<!--[if !mso]><!--><link href="https://fonts.googleapis.com/css2?family=Jost:wght@400;700&family=Playfair+Display:ital,wght@1,700&display=swap" rel="stylesheet"><!--<![endif]-->
<style>body{margin:0;padding:0;background:${BG}} a{text-decoration:none}</style></head>
<body style="margin:0;padding:0;background:${BG};" bgcolor="${BG}">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${esc(o.pre)}${"&#8199;&#847;".repeat(30)}</div>
<table ${T} bgcolor="${BG}" style="background:${BG};"><tr><td align="center" style="padding:20px 0;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="${BG}" style="width:100%;max-width:600px;background:${BG};">
<tr><td align="center" style="padding:30px 30px 0;font-family:${SANS};font-size:11px;font-weight:bold;letter-spacing:3px;text-transform:uppercase;color:${GOLDC};">&#10022;&nbsp; ${o.kicker} &nbsp;&#10022;</td></tr>
<tr><td align="center" style="padding:14px 30px 0;font-family:${SERIF};font-size:40px;line-height:46px;font-style:italic;font-weight:bold;color:#f3d896;">${o.title}</td></tr>
<tr><td align="center" style="padding:10px 30px 0;font-family:${SANS};font-size:14px;line-height:20px;color:${SOFT};">${o.sub}</td></tr>
${o.body}
<tr><td style="padding:44px 40px 0;"><div style="height:1px;background:#2a2722;line-height:1px;font-size:1px;">&nbsp;</div></td></tr>
<tr><td align="center" style="padding:24px 30px 38px;">
<p style="margin:0 0 8px;font-family:${SERIF};font-size:17px;font-style:italic;color:${INK};">Lásd, milyen lesz a tetoválásod ma és 50 év múlva.</p>
<p style="margin:0;font-family:${SANS};font-size:11px;line-height:18px;color:#6f685c;">${o.foot}</p>
</td></tr>
</table></td></tr></table>
</body></html>`;
}

/* a card listing the errors (kind, provider, message, count); nothing when there were none */
function errors(list: Err[] | undefined, when: string) {
  if (!list?.length) return label(`Hibák · ${when}`) + block(card(`<div style="font-family:${SANS};font-size:15px;color:${UP};font-weight:bold;">✓&nbsp; Nem volt hiba.</div>`, "18px 22px"));
  return label(`Hibák · ${when}`) + block(card(`<table ${T}>${list.map((e, i) => line(`<span style="color:${DOWN};font-weight:bold;">${esc(ERR[e.name] || e.name)}${e.provider ? ` · ${esc(PROV[e.provider] || e.provider)}` : ""}</span>${e.why ? `<br><span style="font-size:13px;line-height:19px;color:${SOFT};">${esc(why(e.why))}</span>` : ""}`, `${nf(e.n)}×`, !i)).join("")}</table>`));
}

/* the hero: yesterday's finished tattoo previews, gold-framed, with the road to a million */
function hero(d: Digest) {
  const MIL = 1_000_000;
  return `<tr><td style="padding:30px 24px 0;"><table ${T} style="border-radius:26px;${GOLD}"><tr><td style="padding:1.5px;">
<table ${T} bgcolor="#0d0b07" style="border-radius:25px;background:#0d0b07;background-image:radial-gradient(120% 90% at 50% 0%,#2a2212 0%,#0d0b07 60%);"><tr><td align="center" style="padding:32px 28px 30px;">
<div style="font-family:${SANS};font-size:11px;font-weight:bold;letter-spacing:3px;text-transform:uppercase;color:${GOLDC};">Kész előnézet · 24 óra</div>
<div style="padding-top:8px;font-family:${SERIF};font-size:88px;line-height:96px;font-style:italic;font-weight:bold;color:#f3d896;">${nf(d.y.scored)}</div>
<div style="padding-top:2px;">${chip(d.y.scored, d.p.scored)} <span style="font-family:${SANS};font-size:13px;color:${MUTED};">&nbsp;előtte 24 óra: ${nf(d.p.scored)}</span></div>
<table ${T} style="margin-top:26px;"><tr><td style="padding-bottom:8px;font-family:${SANS};font-size:13px;color:${SOFT};">Úton az egymillióhoz</td>
<td align="right" style="padding-bottom:8px;font-family:${SANS};font-size:13px;font-weight:bold;color:${INK};white-space:nowrap;">${nf(d.all_scored)} <span style="font-weight:normal;color:${MUTED};">/ 1 000 000</span></td></tr>
<tr><td colspan="2">${bar(d.all_scored, MIL)}</td></tr>
<tr><td colspan="2" style="padding-top:10px;font-family:${SANS};font-size:12px;color:${MUTED};">${nf(d.users)} fiók összesen</td></tr></table>
</td></tr></table></td></tr></table></td></tr>`;
}

export function digestEmail(d: Digest, x: Extra | undefined, site: string, tz = "Europe/Budapest") {
  const subject = `InkAge · az elmúlt 24 óra: ${nf(d.y.scored)} előnézet, ${nf(d.y.sessions)} látogatás`;
  /* the window, e.g. "október 23., 9:00 – október 24., 9:00" (older data without it: the day before) */
  const at = (t: string) => new Date(t).toLocaleString("hu-HU", { timeZone: tz, month: "long", day: "numeric", hour: "numeric", minute: "2-digit" });
  const span = d.win_from && d.win_to ? `${at(d.win_from)} – ${at(d.win_to)}` : d.day;
  const t = todo(d);
  const chans = [...d.channels].sort((a, b) => b.n - a.n), top = chans[0]?.n || 1;
  const body = [
    hero(d),
    label("Az előtte lévő 24 órához mérve"),
    `<tr><td style="padding:0 18px;"><table ${T}><tr>${tile("Látogatás", d.y.sessions, d.p.sessions)}${tile("Regisztráció", d.y.signups, d.p.signups)}</tr>
<tr>${tile("Megosztás", d.y.shared, d.p.shared)}${tile("Hibák", d.y.errors, d.p.errors, true)}</tr></table></td></tr>`,
    t.length ? label("Ma teendő") + t.map((s) => `<tr><td style="padding:0 24px 10px;"><table ${T} bgcolor="#1a150c" style="border-radius:16px;background:#1a150c;border:1px solid #4a3c20;"><tr>
<td width="4" bgcolor="${GOLDC}" style="border-radius:16px 0 0 16px;${GOLD}">&nbsp;</td>
<td style="padding:15px 18px;font-family:${SANS};font-size:15px;line-height:22px;color:${INK};">${esc(s)}</td></tr></table></td></tr>`).join("") : "",
    chans.length ? label("Honnan jöttek") + block(card(`<table ${T}>${chans.map((c, i) => `<tr><td style="padding:${i ? "14px" : "0"} 0 0;"><table ${T}><tr>
<td style="padding-bottom:7px;font-family:${SANS};font-size:15px;color:${INK};">${esc(CH[c.k] || c.k)}</td><td align="right" style="padding-bottom:7px;font-family:${SANS};font-size:15px;font-weight:bold;color:${INK};">${nf(c.n)}</td></tr>
<tr><td colspan="2">${bar(c.n, top)}</td></tr></table></td></tr>`).join("")}</table>`)) : "",
    d.best_post ? label("Legjobb poszt") + block(card(`<div style="font-family:${SANS};font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${MUTED};">${esc(PFN[d.best_post.platform] || d.best_post.platform)}</div>
<div style="padding-top:8px;font-family:${SANS};font-size:17px;line-height:24px;font-weight:bold;"><a href="${url(d.best_post.url, site)}" style="color:${INK};text-decoration:none;">${esc((d.best_post.title || "poszt").slice(0, 90))}</a></div>
<div style="padding-top:12px;font-family:${SANS};font-size:14px;color:${SOFT};"><b style="color:${UP};">+${nf(d.best_post.gained)}</b> új megtekintés · ${nf(d.best_post.views)} összesen &nbsp;<a href="${url(d.best_post.url, site)}" style="color:${GOLDC};font-weight:bold;">Megnyitom &rarr;</a></div>`)) : "",
    errors(x?.errors_day, "az elmúlt 24 óra"),
    button(`${site}/admin`, "Irányítóközpont"),
  ].join("\n");

  const pre = `${nf(d.y.scored)} előnézet (${ch(d.y.scored, d.p.scored)}), ${nf(d.y.sessions)} látogatás, ${nf(d.y.signups)} regisztráció. Összesen ${nf(d.all_scored)} / 1 000 000.`;
  const html = page({ subject, pre, kicker: "Reggeli összefoglaló", title: "Az elmúlt 24 óra", sub: esc(span), body, foot: `Belső értesítő az InkAge csapatának · minden reggel 6-kor, ott, ahol vagy (most: ${esc(tz.replace(/_/g, " "))}). Az időzóna magától átáll, amikor máshol megnyitod az Irányítóközpontot.` });
  return { subject, html, text: text(d, site) };
}

/* Sunday evening: the last 7 days on one page (its button opens the Heti riport on the week that is ending) */
export function weeklyEmail(x: Extra, site: string) {
  const w = x.week || {}, pw = x.prev_week || {};
  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
  const hd = (day: string) => new Date(day + "T12:00:00Z").toLocaleDateString("hu-HU", { timeZone: "Europe/Budapest", month: "long", day: "numeric" });
  const subject = `InkAge · a hét: ${nf(w.scored)} előnézet, ${nf(w.sessions)} látogatás`;
  const body = [
    `<tr><td style="padding:24px 18px 0;"><table ${T}><tr>${tile("Látogatás", w.sessions, pw.sessions)}${tile("Előnézet", w.scored, pw.scored)}</tr>
<tr>${tile("Regisztráció", w.signups, pw.signups)}${tile("Hibák", w.errors, pw.errors, true)}</tr></table></td></tr>`,
    label("Google") + block(card(`<table ${T}>${line("Kattintás", nf(x.gsc_week?.clicks), true)}${line("Megjelenés", nf(x.gsc_week?.impressions))}</table>`)),
    x.followers.length ? label("Követők · a héten") + block(card(`<table ${T}>${x.followers.map((f, i) => line(`${esc(PFN[f.platform] || f.platform)}<br><span style="font-size:13px;color:${MUTED};">${nf(f.followers)} követő összesen${f.since && f.since > weekAgo ? ` · mérés ${hd(f.since)} óta` : ""}</span>`,
      `<span style="color:${(f.gained || 0) > 0 ? UP : (f.gained || 0) < 0 ? DOWN : MUTED};">${(f.gained || 0) > 0 ? "+" : ""}${nf(f.gained || 0)}</span>`, !i)).join("")}</table>`)) : "",
    errors(x.errors_week, "az elmúlt 7 nap"),
    x.top_posts.length ? label("A hét posztjai") + block(card(`<table ${T}>${x.top_posts.map((p, i) => line(`<span style="color:${MUTED};font-size:12px;letter-spacing:1px;text-transform:uppercase;">${esc(PFN[p.platform] || p.platform)}</span><br><a href="${url(p.url, site)}" style="color:${INK};text-decoration:none;">${esc((p.title || "poszt").slice(0, 70))}</a>`, nf(p.views), !i)).join("")}</table>`)) : "",
    x.week_plan?.length ? label("A heti terv") + block(card(`<table ${T}>${x.week_plan.map((s, i) => line(`<span style="color:${s.done ? UP : GOLDC};font-weight:bold;">${s.done ? "✓" : "○"}</span>&nbsp; <span style="color:${s.done ? MUTED : INK};">${esc(s.t)}</span>`, "", !i)).join("")}</table>`)) : "",
    button(`${site}/admin#report`, "A teljes riport"),
  ].join("\n");
  const pre = `${nf(w.scored)} előnézet (${ch(w.scored, pw.scored)}), ${nf(w.sessions)} látogatás (${ch(w.sessions, pw.sessions)}), ${nf(w.signups)} regisztráció az elmúlt 7 napban.`;
  return { subject, html: page({ subject, pre, kicker: "Heti riport", title: "Az elmúlt 7 nap", sub: "InkAge · az előző héthez mérve", body, foot: "Belső értesítő az InkAge csapatának · minden vasárnap este" }) };
}

export function text(d: Digest, site: string) {
  const t = todo(d);
  return [`InkAge · az elmúlt 24 óra`, `Kész előnézet: ${nf(d.y.scored)} (${ch(d.y.scored, d.p.scored)})`, `Látogatás: ${nf(d.y.sessions)} (${ch(d.y.sessions, d.p.sessions)}) · Regisztráció: ${nf(d.y.signups)}`,
    `Megosztás: ${nf(d.y.shared)} · Hibák: ${nf(d.y.errors)}`,
    ...(t.length ? ["Teendő:", ...t.map((x) => "• " + x)] : []), `${site}/admin`].join("\n");
}
