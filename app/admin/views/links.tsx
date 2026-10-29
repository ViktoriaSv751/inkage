"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { BarList, CountUp, Empty, StackedColumns, TrendChart, chColor, fmt, pct } from "../charts";
import { Logo, QR } from "../wow";
import { countryName, flag } from "../visuals";
import { Band, Card, I, Kpi, P, PF, Tbl, ago, barCell, ch, n, pctCell, rpc, type D, useRpc } from "../shared";
import { storyImage } from "../extra";

/* ---------- short links ---------- */
const RANGES: [number, string][] = [[7, "7 nap"], [30, "30 nap"], [90, "90 nap"], [365, "1 év"], [0, "Összes"]];
const DEVK: Record<string, string> = { mobile: "Telefon", desktop: "Számítógép", tablet: "Tablet", "?": "Nem ismert" };
const APPK: Record<string, string> = { tiktok: "TikTok", instagram: "Instagram", facebook: "Facebook", messenger: "Messenger", pinterest: "Pinterest", linkedin: "LinkedIn", youtube: "YouTube", snapchat: "Snapchat", threads: "Threads", x: "X", telegram: "Telegram", browser: "Böngésző", "?": "Nem ismert" };

export function Links() {
  const sb = useMemo(() => supabaseBrowser(), []);
  const { d, e, load } = useRpc("admin_links", undefined, []);
  const [days, setDays] = useState(30);
  const det = useRpc("admin_links_detail", { p_days: days || 3650 }, [days]);
  const blank = { code: "", source: "tiktok", medium: "social", campaign: "", target: "/app?guest=1", note: "", post: "" };
  const [f, setF] = useState(blank); const [edit, setEdit] = useState(false); const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null); const [copied, setCopied] = useState("");
  const [sel, setSel] = useState<string | null>(null); const [allQr, setAllQr] = useState(false);
  const all: D[] = Array.isArray(d) ? d : [];
  const X: D = (det.d as D) || {}, per: D = X.per || {};
  const next = useMemo(() => String(all.reduce((m, r) => (/^\d+$/.test(r.code) ? Math.max(m, Number(r.code)) : m), 0) + 1), [all]);
  /* the period's numbers next to the all-time ones */
  const rows: D[] = all.map((r) => ({ ...r, p_clicks: n(per[r.code]?.clicks), p_sessions: n(per[r.code]?.sessions), p_scored: n(per[r.code]?.scored) }));
  const posts: D[] = X.posts || [];
  const save = async (ev: React.FormEvent) => {
    ev.preventDefault(); setMsg(null);
    const code = (f.code || next).trim().toLowerCase();
    if (!/^[a-z0-9-]{1,40}$/.test(code)) return setMsg({ ok: false, t: "A kód csak kisbetű, szám és kötőjel lehet." });
    if (!f.target.startsWith("/")) return setMsg({ ok: false, t: "A cél egy inkage.app-n belüli útvonal legyen, pl. /app?guest=1" });
    if (!edit && all.some((r) => r.code === code)) return setMsg({ ok: false, t: `A inkage.app/go/${code} már létezik: szerkeszteni a sor „Szerkesztés” gombjával tudod.` });
    const [pp, pid] = f.post ? [f.post.split("|")[0], f.post.split("|").slice(1).join("|")] : [null, null];
    const { error } = await rpc(sb, "admin_link_save", { p_code: code, p_target: f.target, p_source: f.source, p_medium: f.medium, p_campaign: f.campaign, p_note: f.note, p_post_platform: pp, p_post_id: pid });
    if (error) return setMsg({ ok: false, t: error.message });
    setF(blank); setEdit(false); setMsg({ ok: true, t: `${edit ? "Mentve" : "Kész"}: inkage.app/go/${code}${pp ? ` · ${PF[pp] || pp}-poszthoz rendelve` : ""}` }); load(); det.load();
  };
  const startEdit = (r: D) => { setEdit(true); setMsg(null); setF({ code: r.code, source: r.source || "egyeb", medium: r.medium || "social", campaign: r.campaign || "", target: r.target || "/app?guest=1", note: r.note || "", post: r.post_platform && r.post_id ? `${r.post_platform}|${r.post_id}` : "" }); document.getElementById("link-form")?.scrollIntoView({ behavior: "smooth", block: "center" }); };
  const del = async (code: string) => { if (!confirm(`Törlöd a inkage.app/go/${code} linket és a kattintásait?`)) return; await rpc(sb, "admin_link_delete", { p_code: code }); load(); det.load(); };
  const copy = (code: string) => { navigator.clipboard?.writeText(`inkage.app/go/${code}`).then(() => { setCopied(code); setTimeout(() => setCopied(""), 1500); }); };
  if (e) return <div className="alert err">{e}</div>;
  const inp = (k: "code" | "campaign" | "target" | "note", l: string, ph?: string, dis?: boolean) => <label className="lf"><span>{l}</span><input className="adm-in" value={f[k]} placeholder={ph} disabled={dis} onChange={(x) => setF({ ...f, [k]: x.target.value })} /></label>;
  const clicks = rows.reduce((s, r) => s + r.p_clicks, 0), visits = rows.reduce((s, r) => s + r.p_sessions, 0), scored = rows.reduce((s, r) => s + r.p_scored, 0);
  const maxC = Math.max(1, ...rows.map((r) => r.p_clicks));
  const hasSignups = rows.some((r) => n(r.signups) > 0);
  /* clicks a day: one colour per link (the 6 busiest), the rest together */
  const dl: D[] = X.daily || [];
  const top = Array.from(new Set([...dl].sort((a, b) => n(b.n) - n(a.n)).map((x) => x.code))).slice(0, 6);
  const dayMap = new Map<string, Record<string, number>>();
  dl.filter((x) => !sel || x.code === sel).forEach((x) => { const t = String(x.t), o = dayMap.get(t) || {}; const k = sel ? x.code : top.includes(x.code) ? x.code : "többi"; o[k] = (o[k] || 0) + n(x.n); dayMap.set(t, o); });
  const keys = sel ? [sel] : [...top, ...(dl.some((x) => !top.includes(x.code)) ? ["többi"] : [])];
  const stack = [...dayMap].sort(([a], [b]) => a.localeCompare(b)).map(([t, v]) => ({ t, v: Object.fromEntries(keys.map((k) => [k, n(v[k])])) }));
  const COL = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#9085e9", "#8F887C"];
  const dims = (dim: string) => { const m = new Map<string, number>(); ((X.dims || []) as D[]).filter((x) => x.dim === dim && (!sel || x.code === sel)).forEach((x) => m.set(x.k, (m.get(x.k) || 0) + n(x.n))); return [...m].map(([k, v]) => ({ k, n: v })).sort((a, b) => b.n - a.n); };
  const selRow = rows.find((r) => r.code === sel);
  const qrs = allQr ? rows : rows.slice(0, 6);
  return (
    <div className="g">
      <Band plain label={`Látogató a rövid linkekből · ${days ? days + " nap" : "összes"}`} value={visits} sentence={<><b>{fmt(rows.length)}</b> linkre ebben az időszakban <b>{fmt(clicks)}</b> kattintás jött, ebből <b>{fmt(scored)}</b> jutott el az előnézetig. A következő szabad kód: <b>inkage.app/go/{next}</b>.</>}
        side={<div className="adm-seg sm" role="group" aria-label="Időszak">{RANGES.map(([v, l]) => <button key={v} aria-pressed={days === v} onClick={() => setDays(v)}>{l}</button>)}</div>} />
      <Kpi kind="own" to="@next" tone="peach" className="s4" icon={P.links} l="Rövid linkek" v={<CountUp v={n(rows.length)} />} sub={`a következő: inkage.app/go/${next}`} />
      <Kpi kind="own" to="@next" tone="butter" className="s4" icon={P.bolt} l="Kattintás" v={<CountUp v={n(clicks)} />} sub={`${fmt(rows.reduce((s, r) => s + n(r.clicks), 0))} összesen · ${fmt(rows.reduce((s, r) => s + n(r.clicks_7d), 0))} az elmúlt 7 napban`} />
      <Kpi kind="own" to="@next" tone="sky" className="s4" icon={P.target} l="Előnézet a linkekből" v={<CountUp v={n(scored)} />} sub={`${pct(scored, visits)} a látogatókból`} />
      {rows.length > 0 && <section className="s12 lcards">{qrs.map((r) => (
        <div key={r.code} className="lcard">
          <div data-qr={r.code}><QR text={`https://inkage.app/go/${r.code}`} size={132} label={r.note || "Próbáld ki"} /></div>
          <div className="lc-b">
            <span className="lc-h"><Logo k={r.source || ""} size={26} /><b>inkage.app/go/{r.code}</b></span>
            <span className="mut">{[r.note, r.campaign, r.post_title].filter(Boolean).join(" · ") || "rövid link"}</span>
            <div className="lc-f"><span><b>{fmt(r.p_clicks)}</b>kattintás</span><i>→</i><span><b>{fmt(r.p_sessions)}</b>látogató</span><i>→</i><span><b>{fmt(r.p_scored)}</b>előnézet</span></div>
            <div className="adm-row" style={{ gap: 6 }}><button className="adm-ibtn sm" onClick={() => copy(r.code)}>{copied === r.code ? "Másolva ✓" : "Link másolása"}</button><button className="adm-ibtn sm" onClick={() => storyImage(r.code, r.note || "")}>Story-kép</button></div>
          </div>
        </div>
      ))}</section>}
      {rows.length > 6 && <div className="s12 adm-row" style={{ justifyContent: "center" }}><button className="adm-ibtn" onClick={() => setAllQr(!allQr)}>{allQr ? "Csak az első 6 QR-kód" : `Mind a ${fmt(rows.length)} QR-kód`}</button></div>}
      <Card className="s12" icon={edit ? P.pen : P.plus} title={edit ? `Szerkesztés: inkage.app/go/${f.code}` : "Új rövid link"} desc={<>Minden videóhoz egy saját link. Írd a videó végére és a leírásba (pl. <b>inkage.app/go/{next}</b>). Aki beírja vagy rákattint, az appba jut, és itt látod, melyik videóból jött. Ha kiválasztod a posztot is, a látogatói a Tartalom oldalon a poszthoz kötődnek akkor is, ha a link nincs a szövegében.</>}>
        <form id="link-form" onSubmit={save} className="form-g">
          {inp("code", "Kód", next, edit)}
          <label className="lf"><span>Platform</span><select className="adm-in" value={f.source} onChange={(x) => setF({ ...f, source: x.target.value })}>{["tiktok", "instagram", "youtube", "pinterest", "facebook", "linkedin", "email", "egyeb"].map((s) => <option key={s} value={s}>{ch(s) === s ? s : ch(s)}</option>)}</select></label>
          <label className="lf"><span>Típus</span><select className="adm-in" value={f.medium} onChange={(x) => setF({ ...f, medium: x.target.value })}><option value="social">Saját poszt</option><option value="partner">Partner / influencer</option><option value="email">E-mail</option><option value="print">Nyomtatott (QR)</option></select></label>
          <label className="lf" style={{ gridColumn: "span 2" }}><span>Poszt (nem kötelező)</span><select className="adm-in" value={f.post} onChange={(x) => setF({ ...f, post: x.target.value })}>
            <option value="">– nincs poszthoz rendelve –</option>
            {posts.filter((p) => f.source === "egyeb" || f.source === "email" || p.platform === f.source || `${p.platform}|${p.post_id}` === f.post).map((p) => <option key={p.platform + p.post_id} value={`${p.platform}|${p.post_id}`}>{PF[p.platform]} · {p.created_at ? new Date(p.created_at).toLocaleDateString("hu-HU", { month: "short", day: "numeric" }) : ""} · {String(p.title || "(nincs szöveg)").slice(0, 60)}{p.code ? ` (már: /go/${p.code})` : ""}</option>)}
          </select></label>
          {inp("campaign", "Kampány (nem kötelező)", "2026-10-w3")}
          {inp("target", "Hová vigyen", "/app?guest=1")}
          {inp("note", "Megjegyzés", "pl. „50 év múlva” videó")}
          <button className="adm-ibtn gold" style={{ height: 36, justifyContent: "center" }}>{I(edit ? P.check : P.plus)}{edit ? "Mentés" : "Link létrehozása"}</button>
          {edit && <button type="button" className="adm-ibtn" style={{ height: 36, justifyContent: "center" }} onClick={() => { setEdit(false); setF(blank); }}>Mégse</button>}
        </form>
        {msg && <div className={"alert " + (msg.ok ? "ok" : "err")}>{msg.t}</div>}
      </Card>
      <UtmBuilder />
      <Card className="s12" icon={P.links} title="Linkek" sub="Kattintás = megnyitották a linket (az időszakban, alatta az összes); ugyanaz a látogató 30 percen belül egyszer számít, a linkelőnézetek, robotok és előtöltések nem. Látogató és előnézet = a mi mérésünk az appban, az időszakban. Kattints egy sorra: a lent lévő grafikon és bontások arra az egy linkre szűkülnek.">
        {!d ? <div className="skel" style={{ height: 160 }} /> : <Tbl rows={rows} onRow={(r) => setSel(sel === r.code ? null : r.code)} empty="Még nincs rövid link. Hozd létre az elsőt fent." cols={[
          { k: "code", l: "Link", r: (r) => <span className="cellwrap" style={{ display: "flex", alignItems: "center", gap: 10 }}><i className="dot" style={{ width: 9, height: 9, borderRadius: 3, background: chColor(r.source || ""), flex: "none" }} /><span><b>inkage.app/go/{r.code}</b>{sel === r.code && <span className="chip gold" style={{ marginLeft: 6 }}>kiválasztva</span>} <button className="adm-ibtn sm" onClick={(x) => { x.stopPropagation(); copy(r.code); }}>{copied === r.code ? "Másolva ✓" : "Másolás"}</button><br /><span className="mut">{[ch(r.source || ""), r.campaign, r.note, r.post_title && `poszt: ${String(r.post_title).slice(0, 50)}`].filter(Boolean).join(" · ")}</span></span></span> },
          { k: "p_clicks", l: "Kattintás", num: true, r: (r) => <>{barCell(r.p_clicks, maxC)}<div className="mut" style={{ fontSize: 11 }}>{fmt(r.clicks)} összesen · {fmt(r.clicks_7d)} / 7 nap</div></> },
          { k: "p_sessions", l: "Látogató", num: true, r: (r) => <b>{fmt(r.p_sessions)}</b> },
          { k: "p_scored", l: "Előnézet", num: true, r: (r) => <>{fmt(r.p_scored)} {pctCell(r.p_scored, r.p_sessions)}</> },
          ...(hasSignups ? [{ k: "signups", l: "Regisztráció (összes)", num: true, r: (r: D) => fmt(r.signups) }] : []),
          { k: "shared", l: "Megosztott (összes)", num: true, r: (r) => fmt(r.shared) },
          { k: "last_click", l: "Utolsó kattintás", r: (r) => ago(r.last_click) },
          { k: "x", l: "", r: (r) => <span className="adm-row" style={{ gap: 6, justifyContent: "flex-end" }}><button className="adm-ibtn sm" onClick={(x) => { x.stopPropagation(); startEdit(r); }}>Szerkesztés</button><button className="adm-ibtn sm" onClick={(x) => { x.stopPropagation(); del(r.code); }}>Törlés</button></span> },
        ]} />}
      </Card>
      <Card className="s12" icon={P.traffic} title={sel ? `Kattintás naponta: inkage.app/go/${sel}` : "Kattintás naponta"} sub="Linkenként színezve (a 6 legtöbbet kattintott külön, a többi együtt); egy sorra kattintva csak az az egy link."
        right={sel ? <button className="adm-ibtn sm" onClick={() => setSel(null)}>Mind a link</button> : undefined}
        foot={!sel && keys.length > 1 ? <div className="legend">{keys.map((k, i) => <span key={k}><i className="sq" style={{ background: COL[i % COL.length] }} />{k === "többi" ? "a többi" : "/go/" + k}</span>)}</div> : undefined}>
        {det.e ? <div className="alert err">{det.e}</div> : stack.length ? (sel ? <TrendChart data={stack.map((x) => ({ t: x.t, v: n(x.v[sel]) }))} label="Kattintás" height={200} /> : <StackedColumns days={stack} keys={keys} label={(k) => (k === "többi" ? "a többi" : "/go/" + k)} color={(k) => COL[keys.indexOf(k) % COL.length]} />)
          : <Empty t="Ebben az időszakban még nem kattintottak a linkekre." icon={P.links} />}
      </Card>
      <Card className="s4" icon={P.globe} title="Ország" sub={`Ahol megnyitották${selRow ? ` a inkage.app/go/${selRow.code} linket` : " a linkeket"} (a kattintás országa; IP-cím nincs tárolva).`}>
        <BarList items={dims("country")} fmtK={(k) => (k === "?" ? "Nem ismert" : `${flag(k)} ${countryName(k)}`)} max={8} accent empty="Még nincs adat." />
      </Card>
      <Card className="s4" icon={P.user} title="Eszköz" sub="Telefon, számítógép vagy tablet.">
        <BarList items={dims("device")} fmtK={(k) => DEVK[k] || k} empty="Még nincs adat." />
      </Card>
      <Card className="s4" icon={P.social} title="Melyik appban nyitották meg" sub="Az app beépített böngészője alapján (TikTok, Instagram, Facebook, Messenger, Pinterest, LinkedIn, YouTube…); a sima böngésző „Böngésző”.">
        <BarList items={dims("kind")} fmtK={(k) => APPK[k] || k} color={(k) => chColor(k)} empty="Még nincs adat." />
      </Card>
      <Card className="s12" icon={P.users} title="Partnerek és influencerek" sub="A „Partner / influencer” típusú linkek partnerenként (a Kampány mezőbe írd a partner nevét): ki hány kattintást, látogatót, előnézetet és regisztrációt hozott.">
        <Partners />
      </Card>
    </div>
  );
}


function Partners() {
  const { d } = useRpc("admin_partners", undefined, []);
  return <Tbl name="partnerek" rows={Array.isArray(d) ? d : []} empty="Még nincs partnerlink. Hozz létre egyet fent „Partner / influencer” típussal, a kampányhoz a partner nevével." cols={[
    { k: "partner", l: "Partner", r: (r) => <b>{r.partner}</b> }, { k: "links", l: "Link", num: true }, { k: "clicks", l: "Kattintás", num: true, r: (r) => fmt(r.clicks) },
    { k: "sessions", l: "Látogató", num: true, r: (r) => <b>{fmt(r.sessions)}</b> }, { k: "scored", l: "Előnézet", num: true, r: (r) => <>{fmt(r.scored)} {pctCell(n(r.scored), n(r.sessions))}</> },
    { k: "signups", l: "Regisztráció", num: true, r: (r) => fmt(r.signups) },
  ]} />;
}


/* ---------- share links ---------- */
export function ShareLinks() {
  const sb = useMemo(() => supabaseBrowser(), []);
  const { d, load } = useRpc("admin_share_list", undefined, []);
  const [label, setLabel] = useState(""); const [days, setDays] = useState(30); const [made, setMade] = useState(""); const [copied, setCopied] = useState("");
  const url = (t: string) => `${location.origin}/r/${t}`;
  const create = async () => { const { data } = await rpc(sb, "admin_share_create", { p_label: label || "Növekedési pillanatkép", p_days: days }); if (data) { setMade(String(data)); setLabel(""); load(); } };
  const del = async (t: string) => { if (!confirm("Visszavonod ezt a linket? Aki megkapta, többé nem tudja megnyitni.")) return; await rpc(sb, "admin_share_delete", { p_token: t }); load(); };
  const copy = (t: string) => navigator.clipboard?.writeText(url(t)).then(() => { setCopied(t); setTimeout(() => setCopied(""), 1500); });
  const rows: D[] = Array.isArray(d) ? d : [];
  return (
    <>
      <div className="form-g" style={{ gridTemplateColumns: "1fr 160px auto" }}>
        <label className="lf"><span>Kinek / mire</span><input className="adm-in" placeholder="pl. Hiventures pályázat" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={60} /></label>
        <label className="lf"><span>Érvényes</span><select className="adm-in" value={days} onChange={(e) => setDays(Number(e.target.value))}>{[7, 30, 90, 365].map((x) => <option key={x} value={x}>{x} napig</option>)}</select></label>
        <button className="adm-ibtn gold" style={{ height: 36 }} onClick={create}>{I(P.share)}Link készítése</button>
      </div>
      {made && <div className="alert ok">Kész: <b>{url(made)}</b> <button className="lnk" onClick={() => copy(made)}>{copied === made ? "Másolva ✓" : "Másolás"}</button> · <a className="lnk" href={"/r/" + made} target="_blank" rel="noreferrer">Megnyitás ↗</a></div>}
      <Tbl name="megosztott-linkek" csv={false} rows={rows} empty="Még nincs megosztott link." cols={[
        { k: "label", l: "Név", r: (r) => <b>{r.label}</b> },
        { k: "created_at", l: "Készült", r: (r) => ago(r.created_at) },
        { k: "expires_at", l: "Lejár", r: (r) => (new Date(r.expires_at) < new Date() ? <span className="chip">lejárt</span> : new Date(r.expires_at).toLocaleDateString("hu-HU", { month: "short", day: "numeric" })) },
        { k: "views", l: "Megnyitás", num: true, r: (r) => <>{fmt(r.views)}<div className="mut" style={{ fontSize: 11 }}>{r.last_view ? ago(r.last_view) : ""}</div></> },
        { k: "x", l: "", r: (r) => <span className="adm-row" style={{ gap: 6, justifyContent: "flex-end" }}><button className="adm-ibtn sm" onClick={() => copy(r.token)}>{copied === r.token ? "Másolva ✓" : "Link másolása"}</button><button className="adm-ibtn sm" onClick={() => del(r.token)}>Visszavonás</button></span> },
      ]} />
    </>
  );
}

/* ---------- a tagged link for a campaign: the same utm names everywhere, so the Források page groups them ---------- */
function UtmBuilder() {
  const [f, setF] = useState({ url: "https://inkage.app/app", src: "", med: "social", camp: "", cont: "" });
  const slug = (x: string) => x.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  let url = ""; try { const u = new URL(f.url.trim()); if (f.src) u.searchParams.set("utm_source", slug(f.src)); if (f.med) u.searchParams.set("utm_medium", slug(f.med)); if (f.camp) u.searchParams.set("utm_campaign", slug(f.camp)); if (f.cont) u.searchParams.set("utm_content", slug(f.cont)); url = u.toString(); } catch {}
  const set = (p: Partial<typeof f>) => setF((o) => ({ ...o, ...p }));
  return (
    <Card className="s12" icon={P.links} title="UTM-link készítő" sub="Egy kampány vagy partner linkje egységes címkékkel (forrás, közeg, kampány, tartalom). A Források oldal ezek alapján csoportosít; a nevek kisbetűsek, ékezet nélkül, kötőjellel. Rövid linket (inkage.app/go/…) a fenti űrlappal csinálhatsz, az olvashatóbb a bióban.">
      <div className="utm-g">
        <label className="lf"><span>Cél-oldal</span><input className="adm-in" value={f.url} onChange={(e) => set({ url: e.target.value })} /></label>
        <label className="lf"><span>Forrás (utm_source)</span><input className="adm-in" value={f.src} placeholder="pl. instagram, hirlevel, partner-nev" onChange={(e) => set({ src: e.target.value })} /></label>
        <label className="lf"><span>Közeg (utm_medium)</span><select className="adm-in" value={f.med} onChange={(e) => set({ med: e.target.value })}>{["social", "bio", "story", "email", "cpc", "partner", "qr", "print"].map((m) => <option key={m} value={m}>{m}</option>)}</select></label>
        <label className="lf"><span>Kampány (utm_campaign)</span><input className="adm-in" value={f.camp} placeholder="pl. oszi-kihivas" onChange={(e) => set({ camp: e.target.value })} /></label>
        <label className="lf"><span>Tartalom (utm_content, nem kötelező)</span><input className="adm-in" value={f.cont} placeholder="pl. video-12" onChange={(e) => set({ cont: e.target.value })} /></label>
      </div>
      {url && f.src ? <div className="utm-out"><code>{url}</code><div className="adm-row"><button className="adm-ibtn sm gold" onClick={() => { navigator.clipboard?.writeText(url); }}>Másolás</button></div><QR text={url} size={120} /></div>
        : <p className="note">Add meg legalább a forrást, és itt a kész link, QR-kóddal.</p>}
    </Card>
  );
}
