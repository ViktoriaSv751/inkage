"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
/* Fiókok: every TikTok and Instagram account side by side, the main InkAge ones and up to 10 more a platform
   (own extra accounts, partners abroad). InkAge takes no payments yet, so a payer figure shows only when the data has one. Each extra account has its own bio short link, so the sign-ups it brought are counted
   for it. A partner connects their own account from their own phone with an invite link. */
import { useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Empty, Info, Spark, fmt } from "../charts";
import { Hero } from "../ink";
import { Logo } from "../wow";
import { Card, P, Tbl, ago, big, dt, n, rpc, type D, useRpc } from "../shared";
import { toast } from "../phone";

const PFN: Record<string, string> = { tiktok: "TikTok", instagram: "Instagram" };
const MAX = 10;
const flag = (c?: string | null) => (c && /^[A-Z]{2}$/.test(c) ? String.fromCodePoint(...[...c].map((x) => 0x1f1a5 + x.charCodeAt(0))) : "");
const site = () => (typeof location === "undefined" || location.origin.includes("localhost") ? "https://inkage.app" : location.origin);
const bioLink = (code: string) => `inkage.app/go/${code}`;
const inviteUrl = (t: string) => `${site()}/api/invite/${t}`;
const copy = (t: string, what: string) => { if (!navigator.clipboard) { toast("Nem sikerült másolni"); return; } navigator.clipboard.writeText(t).then(() => toast(`${what} kimásolva`)).catch(() => toast("Nem sikerült másolni")); };
const PROV: Record<string, string> = { google: "Google", apple: "Apple", email: "E-mail" };
const CONF: Record<string, string> = { biztos: "biztos", jo: "valószínű", gyenge: "bizonytalan" };

function status(a: D): [string, string] {
  if (a.last_error) return ["bad", "hiba a lehúzásnál"];
  if (a.connected) return ["good", a.last_sync_at ? `frissítve ${ago(a.last_sync_at)}` : "bekötve, az első lehúzásra vár"];
  if (a.invite_open) return ["gold", `meghívó kint, ${dt(a.invite_expires_at)}-ig érvényes`];
  return ["warn", "nincs bekötve, a meghívó lejárt"];
}

const SEL_KEY = "inkage.admin.accsel";
const readSel = () => { try { return localStorage.getItem(SEL_KEY) || "all"; } catch { return "all"; } };
/* the numbers of a group of accounts added up, day by day too */
function sumOf(list: D[]) {
  const days = new Map<string, number>();
  list.forEach((a) => (a.series || []).forEach((x: D) => days.set(x.day, (days.get(x.day) || 0) + n(x.views))));
  const top = list.flatMap((a) => (a.top || []).map((t: D) => ({ ...t, acc: a.label, platform: a.platform, country: a.country }))).sort((x, y) => n(y.gained) - n(x.gained)).slice(0, 8);
  const f = list.filter((a) => a.followers != null), fb = list.filter((a) => a.followers_before != null);
  return { views: list.reduce((s, a) => s + n(a.views_period), 0), total: list.reduce((s, a) => s + n(a.views_total), 0), posts: list.reduce((s, a) => s + n(a.posts_new), 0),
    followers: f.length ? f.reduce((s, a) => s + n(a.followers), 0) : null, gained: f.length && fb.length ? f.reduce((s, a) => s + n(a.followers), 0) - fb.reduce((s, a) => s + n(a.followers_before), 0) : null,
    signups: list.reduce((s, a) => s + n(a.signups), 0), paid: list.reduce((s, a) => s + n(a.paid), 0), clicks: list.reduce((s, a) => s + n(a.clicks), 0),
    viral: list.reduce((s, a) => s + (a.top || []).filter((t: D) => t.viral).length, 0), series: [...days.entries()].sort((x, y) => x[0].localeCompare(y[0])).map(([, v]) => v), top };
}

export function Accounts({ days }: { days: number }) {
  const sb = useMemo(() => supabaseBrowser(), []);
  const d0 = Math.max(1, Math.min(365, days || 7));
  const q = useRpc("admin_extra_overview", { p_days: d0 }, [d0]);
  /* which account (or group) the page is about: kept for the next visit */
  const [sel, setSelRaw] = useState<string>(readSel);
  const setSel = (k: string) => { setSelRaw(k); try { localStorage.setItem(SEL_KEY, k); } catch {} window.scrollTo({ top: 0, behavior: "smooth" }); };
  const [made, setMade] = useState<{ label: string; code: string; invite: string } | null>(null);
  const accs: D[] = (q.d as D)?.accounts || [];

  if (q.e && !q.d) return <Card className="s12" title="Fiókok"><Empty t={q.e} /><button className="btn" onClick={q.load}>Újra</button></Card>;
  if (!q.d) return <div className="skel" style={{ height: 320 }} aria-busy="true" />;

  const per = (p: string) => accs.filter((a) => !a.main && a.platform === p).length;
  const plats = ["tiktok", "instagram"].filter((p) => accs.filter((a) => a.platform === p).length > 1);
  const cur = accs.find((a) => a.k === sel) || null;
  const group = cur ? null : sel === "pf:tiktok" || sel === "pf:instagram" ? accs.filter((a) => a.platform === sel.slice(3)) : accs;
  const groupName = sel === "pf:tiktok" ? "az összes TikTok-fiókon" : sel === "pf:instagram" ? "az összes Instagram-fiókon" : "az összes fiókon";

  return (
    <>
      {/* the picker: every account, or all of them added up; one tap, on the phone too */}
      <div className="s12 acc-pick" role="tablist" aria-label="Fiók">
        <button role="tab" aria-selected={!cur && group === accs} onClick={() => setSel("all")}>Összes fiók</button>
        {plats.map((p) => <button key={p} role="tab" aria-selected={sel === "pf:" + p} onClick={() => setSel("pf:" + p)}><Logo k={p} size={16} />{PFN[p]} összesen</button>)}
        {accs.map((a) => <button key={a.k} role="tab" aria-selected={sel === a.k} onClick={() => setSel(a.k)}><Logo k={a.platform} size={16} />{flag(a.country)} {a.label}</button>)}
      </div>

      {cur ? <>
        <div className="s12"><Hero flip label={<>{flag(cur.country)} {cur.label} · megtekintés · {d0} nap</>} v={n(cur.views_period)}
          sub={`${cur.followers == null ? "–" : fmt(cur.followers)} követő · ${fmt(n(cur.posts_new))} új poszt · ${fmt(n(cur.signups))} regisztráció${n(cur.paid) ? ` · ${fmt(n(cur.paid))} fizető` : ""}`} /></div>
        <Detail a={cur} days={d0} sb={sb} reload={q.load} close={() => setSel("all")} />
      </> : group && <Group list={group} name={groupName} days={d0} pick={setSel} />}

      {!cur && <NewAccount sb={sb} counts={{ tiktok: per("tiktok"), instagram: per("instagram") }} onMade={(m) => { setMade(m); q.load(); }} />}
      {made && <Card className="s12" icon={P.check} title={`${made.label}: kész`}>
        <p className="note">Két dolog kell hozzá. <b>1.</b> A meghívó linket küldd el a fiók gazdájának: ő a saját telefonján nyitja meg, és ott köti be a fiókját (te ne lépj be a fiókjába). <b>2.</b> A bio-linket tegye a profilja bio-jába: az ezen érkező regisztrációk ehhez a fiókhoz számítanak.</p>
        <div className="acc-links">
          <LinkRow l="Meghívó link (14 napig, egyszer)" v={inviteUrl(made.invite)} what="Meghívó link" />
          <LinkRow l="Bio-link" v={bioLink(made.code)} what="Bio-link" />
        </div>
        <button className="lnk" onClick={() => setMade(null)}>Bezárás</button>
      </Card>}

      {!cur && <Card className="s12" icon={P.eye} title="Mit ad ki a TikTok és az Instagram"><p className="note">Fiókonként: a követők száma, és minden poszt megtekintése, lájkja, kommentszáma és megosztása (Instagramon a 30 napnál fiatalabb posztok elérése és mentése is). <b>Nem adják ki</b> külső rendszernek, hogy kik a nézők (ország, kor, nem), és hogy kik kommentelnek; ezt csak a fiók gazdája látja a TikTok Studióban, illetve az Instagram statisztikáiban. A számok óránként frissülnek. A fiók gazdája a hozzáférést bármikor visszavonhatja a TikTok vagy az Instagram beállításaiban.</p></Card>}
    </>
  );
}

/* a group of accounts added up: the totals, the accounts one under the other (a tap opens one), the best posts of all of them */
function Group({ list, name, days, pick }: { list: D[]; name: string; days: number; pick: (k: string) => void }) {
  const t = sumOf(list);
  return (
    <>
      <div className="s12"><Hero flip label={<>Megtekintés {name} · {days} nap<Info>A posztok megtekintései az időszakban (a poszt mostani száma mínusz az időszak előtti napé), a kiválasztott fiókok összege. Regisztráció: akinek a regisztráció előtti látogatása a fiók saját bio-linkjén jött (inkage.app/go/…); a fő fiókoknál a TikTok-, illetve Instagram-csatorna többi regisztrációja. A TikTok a saját böngészőjéből nem mondja meg, honnan jött a látogató, ezért a bio-link nélküli látogatás „közvetlen” marad.</Info></>}
        v={t.views} sub={`${fmt(list.length)} fiók · ${fmt(t.signups)} regisztráció${t.paid ? ` · ${fmt(t.paid)} fizető` : ""}`} /></div>
      <Card className="s12" icon={P.users} title="Összesítve">
        <div className="acc-kpis">
          <div className="mini"><span>Követő</span><b>{t.followers == null ? "–" : fmt(t.followers)}</b>{t.gained ? <small>{t.gained > 0 ? "+" : ""}{fmt(t.gained)} az időszakban</small> : null}</div>
          <div className="mini"><span>Megtekintés · {days} nap</span><b>{big(t.views)}</b></div>
          <div className="mini"><span>Összes megtekintés</span><b>{big(t.total)}</b></div>
          <div className="mini"><span>Új poszt</span><b>{big(t.posts)}</b></div>
          <div className="mini"><span>Virális poszt</span><b>{big(t.viral)}</b></div>
          <div className="mini"><span>Regisztráció</span><b>{big(t.signups)}</b></div>
          {t.paid > 0 && <div className="mini"><span>Fizető</span><b>{big(t.paid)}</b></div>}
        </div>
        {t.series.length > 1 && <><h3 className="acc-h">Megtekintés naponta, összesen</h3><Spark values={t.series} h={60} /></>}
      </Card>
      <Card className="s12" icon={P.social} title="Fiókonként" sub="Koppints egy fiókra: csak az ő számai, posztjai és regisztrációi. Virális: legalább 1000 megtekintés és a fiók szokásos (medián) posztjának legalább ötszöröse.">
        {list.length ? <div className="acc-rows">{[...list].sort((x, y) => n(y.views_period) - n(x.views_period)).map((a) => { const [c, st] = status(a); const v = (a.top || []).filter((x: D) => x.viral).length; return (
          <button key={a.k} className="acc-row" onClick={() => pick(a.k)}>
            <span className="acc-row-h"><Logo k={a.platform} size={20} /><span><b>{flag(a.country)} {a.label}</b>{a.main && <span className="chip" style={{ marginLeft: 6 }}>fő fiók</span>}<br /><small className="mut">{a.username ? "@" + a.username : "még nincs bekötve"} · <span className={"chip " + c}>{st}</span></small></span><span className="acc-chev">›</span></span>
            <span className="acc-row-n"><span><b>{fmt(n(a.views_period))}</b><small>megtekintés</small></span><span><b>{a.followers == null ? "–" : fmt(a.followers)}</b><small>követő</small></span><span><b>{fmt(n(a.posts_new))}</b><small>új poszt</small></span><span><b>{v || "–"}</b><small>virális</small></span><span><b>{fmt(n(a.signups))}</b><small>regisztráció</small></span><span><b>{fmt(n(a.paid))}</b><small>fizető</small></span></span>
          </button>); })}</div> : <Empty t="Még nincs bekötött fiók." />}
      </Card>
      <Card className="s12" icon={P.spark} title="Legjobb posztok, minden fiókról">
        {t.top.length ? <div className="acc-posts">{t.top.map((p: D) => <Post key={p.acc + p.post_id} t={p} who={`${flag(p.country)} ${p.acc}`} />)}</div> : <Empty t="Még nincs poszt ebben az időszakban." />}
      </Card>
    </>
  );
}

function Post({ t, who }: { t: D; who?: string }) {
  return (
    <a className="acc-post" href={t.url || undefined} target="_blank" rel="noreferrer">
      {t.thumb ? <img src={t.thumb} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" /> : <span className="acc-nothumb" />}
      <span><b>{fmt(n(t.gained))}</b> új megtekintés{t.viral && <span className="chip good" style={{ marginLeft: 6 }}>virális</span>}{who && <small className="mut"> · {who}</small>}<br />
        <small className="mut">{fmt(n(t.views))} össz. · {fmt(n(t.likes))} lájk · {fmt(n(t.comments))} komment · {fmt(n(t.shares))} megosztás · {dt(t.created_at)}</small><br />
        <small>{String(t.title || "").slice(0, 110)}</small></span>
    </a>
  );
}

function LinkRow({ l, v, what }: { l: string; v: string; what: string }) {
  return <div className="pfield"><span>{l}</span><div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}><code style={{ wordBreak: "break-all" }}>{v}</code><button className="btn sm" onClick={() => copy(v, what)}>Másolás</button></div></div>;
}

function NewAccount({ sb, counts, onMade }: { sb: any; counts: Record<string, number>; onMade: (m: { label: string; code: string; invite: string }) => void }) {
  const [p, setP] = useState("tiktok"), [label, setLabel] = useState(""), [cc, setCc] = useState(""), [busy, setBusy] = useState(false), [err, setErr] = useState("");
  const full = counts[p] >= MAX;
  const go = async () => {
    setErr(""); setBusy(true);
    const { data, error } = await rpc(sb, "admin_extra_create", { p_platform: p, p_label: label.trim(), p_country: cc.trim() || null });
    setBusy(false);
    if (error) { setErr(error.message.replace(/^.*?:\s*/, "")); return; }
    onMade({ label: label.trim(), code: (data as D).code, invite: (data as D).invite }); setLabel(""); setCc("");
  };
  return (
    <Card className="s12" icon={P.plus} title="Új fiók bekötése" desc={<>TikTokból és Instagramból is legfeljebb {MAX} további fiók lehet a fő InkAge-fiók mellett (most: TikTok {counts.tiktok}/{MAX}, Instagram {counts.instagram}/{MAX}). A név csak neked szól (pl. „Partner”, „Partner DE”). Az ország kétbetűs kód (HU, DE, ES…), a bio-link kódjába is bekerül.</>}>
      <div className="acc-form">
        <label className="pfield"><span>Platform</span><select className="adm-in" value={p} onChange={(e) => setP(e.target.value)}><option value="tiktok">TikTok</option><option value="instagram">Instagram</option></select></label>
        <label className="pfield"><span>Név</span><input className="adm-in" value={label} maxLength={60} placeholder="pl. Partner DE" onChange={(e) => setLabel(e.target.value)} /></label>
        <label className="pfield"><span>Ország</span><input className="adm-in" value={cc} maxLength={2} placeholder="DE" style={{ textTransform: "uppercase", width: 80 }} onChange={(e) => setCc(e.target.value.replace(/[^a-z]/gi, "").toUpperCase())} /></label>
        <button className="btn" disabled={busy || full || !label.trim()} onClick={go}>{busy ? "Készül…" : full ? `Megvan a ${MAX} fiók` : "Létrehozás"}</button>
      </div>
      {err && <p className="err-t">{err}</p>}
    </Card>
  );
}

function Detail({ a, days, sb, reload, close }: { a: D; days: number; sb: any; reload: () => void; close: () => void }) {
  const [inv, setInv] = useState<string | null>(null), [edit, setEdit] = useState(false), [label, setLabel] = useState(a.label), [cc, setCc] = useState(a.country || "");
  const series: number[] = (a.series || []).map((x: D) => n(x.views));
  const newInvite = async () => { const { data, error } = await rpc(sb, "admin_extra_new_invite", { p_id: a.k }); if (error) toast("Nem sikerült: " + error.message); else { setInv(String(data)); reload(); } };
  const save = async () => { const { error } = await rpc(sb, "admin_extra_update", { p_id: a.k, p_label: label, p_country: cc || null }); if (error) toast("Nem sikerült: " + error.message.replace(/^.*?:\s*/, "")); else { setEdit(false); reload(); } };
  const del = async () => {
    if (!confirm(`Törlöd a(z) „${a.label}” fiókot és minden lehúzott számát? A bio-linkje megmarad és tovább működik.`)) return;
    const { error } = await rpc(sb, "admin_extra_delete", { p_id: a.k }); if (error) toast("Nem sikerült: " + error.message); else { close(); reload(); }
  };
  return (
    <div className="s12" id="acc-detail">
      <Card icon={P.social} title={`${flag(a.country)} ${a.label}${a.username ? " · @" + a.username : ""}`} sub={a.main ? "A fő InkAge-fiók: a részletes számai a Tartalom oldalon vannak. Regisztrációnak itt a csatorna azon regisztrációi számítanak, amelyek nem egy további fiók bio-linkjén jöttek." : `Bio-link: ${bioLink(a.code || "")}. Az ezen a linken érkező látogatók regisztrációi számítanak ehhez a fiókhoz.`}
        right={<button className="lnk" onClick={close}>← Összes fiók</button>}>
        <div className="acc-kpis">
          <div className="mini"><span>Követő</span><b>{a.followers == null ? "–" : fmt(a.followers)}</b></div>
          <div className="mini"><span>Megtekintés · {days} nap</span><b>{big(n(a.views_period))}</b></div>
          <div className="mini"><span>Összes megtekintés</span><b>{big(n(a.views_total))}</b></div>
          <div className="mini"><span>Poszt</span><b>{big(n(a.posts_total))}</b><small>{fmt(n(a.posts_new))} új</small></div>
          <div className="mini"><span>Regisztráció</span><b>{big(n(a.signups))}</b><small>{fmt(n(a.signups_sure))} biztos</small></div>
          {n(a.paid) > 0 && <div className="mini"><span>Fizető</span><b>{big(n(a.paid))}</b></div>}
          {a.code && <div className="mini"><span>Link-kattintás</span><b>{big(n(a.clicks))}</b><small>{fmt(n(a.visits))} látogató</small></div>}
        </div>
        {series.length > 1 && <><h3 className="acc-h">Megtekintés naponta</h3><Spark values={series} h={60} /></>}
        {a.last_error && <p className="err-t">Utolsó hiba: {String(a.last_error).slice(0, 200)}</p>}

        <h3 className="acc-h">Legjobb posztok az időszakban</h3>
        {(a.top || []).length ? <div className="acc-posts">{(a.top || []).map((t: D) => <Post key={t.post_id} t={t} />)}</div> : <Empty t="Még nincs poszt ebben az időszakban." />}

        <h3 className="acc-h">Akik ezen a fiókon keresztül regisztráltak</h3>
        {(a.recent || []).length ? <Tbl name="fiok-regisztraciok" csv={false} rows={a.recent}
          cols={[{ k: "created_at", l: "Mikor", r: (r: D) => dt(r.created_at) }, { k: "lang", l: "Nyelv", r: (r: D) => r.lang || "–" }, { k: "provider", l: "Belépés", r: (r: D) => PROV[r.provider] || r.provider || "–" },
            { k: "conf", l: "Mennyire tudjuk", r: (r: D) => CONF[r.conf] || r.conf || "–" }]} />
          : <Empty t={a.main ? "Ebben az időszakban nem jött regisztráció, ami biztosan ebből a csatornából jött." : "Még senki nem regisztrált a bio-linkjén keresztül. Ellenőrizd, hogy a bio-link a profilban van-e."} />}

        {!a.main && <div className="acc-actions">
          <a className="btn" href={`/api/admin/connect/${a.platform}?slot=${a.k}`}>{a.connected ? "Újrakötöm én" : "Bekötöm én (a saját telefonomon)"}</a>
          <button className="btn" onClick={newInvite}>Új meghívó link</button>
          <button className="btn" onClick={() => copy(bioLink(a.code || ""), "Bio-link")}>Bio-link másolása</button>
          <button className="btn" onClick={() => setEdit(!edit)}>Átnevezés</button>
          <button className="btn danger" onClick={del}>Törlés</button>
        </div>}
        {!a.main && <p className="mut" style={{ fontSize: 13 }}>„Bekötöm én”: csak a te saját fiókjaidhoz. Egy külföldi fióknál küldd a meghívó linket, hogy a gazdája a saját telefonján kösse be: így a TikTok nem lát magyar belépést a fiókjában.</p>}
        {inv && <LinkRow l="Új meghívó link (14 napig, egyszer; a régi már nem működik)" v={inviteUrl(inv)} what="Meghívó link" />}
        {edit && <div className="acc-form">
          <label className="pfield"><span>Név</span><input className="adm-in" value={label} maxLength={60} onChange={(e) => setLabel(e.target.value)} /></label>
          <label className="pfield"><span>Ország</span><input className="adm-in" value={cc} maxLength={2} style={{ width: 80 }} onChange={(e) => setCc(e.target.value.replace(/[^a-z]/gi, "").toUpperCase())} /></label>
          <button className="btn" onClick={save}>Mentés</button>
        </div>}
      </Card>
    </div>
  );
}
