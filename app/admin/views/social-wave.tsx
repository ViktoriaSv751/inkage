"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Delta, Empty, fmt } from "../charts";
import { Logo } from "../wow";
import { Card, I, Layer, MOCK, P, PF, SOC, ago, big, n, rpc, type D } from "../shared";
import { toast } from "../phone";

/* Közösségi oldal, 1. hullám: which platforms send data (the coverage bar), reach by platform for today / 3 / 7 / 30 days,
   every post on one timeline, and posts added by hand for the platforms not connected yet. */

const imp = (pf: string) => pf === "pinterest" || pf === "linkedin";
const vword = (pf: string) => (imp(pf) ? "megjelenés" : "megtekintés");
export const isManual = (p: D) => String(p.post_id || "").startsWith("m:");

/* why a platform sends nothing yet, in one line (the Kapcsolatok page has the steps) */
const WHY: Record<string, string> = {
  instagram: "a Meta-belépés ellenőrzése után köthető be",
  facebook: "a Meta-belépés ellenőrzése után köthető be",
  pinterest: "a Pinterest-hozzáférés jóváhagyására vár",
  linkedin: "céges LinkedIn-oldal kell hozzá",
  youtube: "a Google-projekt kiválasztása után köthető be",
  tiktok: "a Kapcsolatok oldalon köthető be",
};

/* ---------- which platforms send data ---------- */
/* while the platforms' state loads, or when it could not load: never "nothing is connected", which would not be true */
function NoState({ err, retry, h }: { err?: string; retry?: () => void; h: number }) {
  return err ? <div className="alert err s12">Nem sikerült betölteni: {err} {retry && <button className="lnk" onClick={retry}>Újra</button>}</div> : <div className="skel s12" style={{ height: h }} />;
}
export function Coverage({ r, pick, add, err, retry }: { r: D | null; pick: (pf: string) => void; add: (pf: string) => void; err?: string; retry?: () => void }) {
  if (!r) return <NoState err={err} retry={retry} h={120} />;
  const ps: D[] = r.platforms || SOC.map((platform) => ({ platform }));
  const on = ps.filter((p) => p.connected), off = ps.filter((p) => !p.connected);
  return (
    <section className="c s12 cov">
      <div className="cov-h">
        <span className="eyebrow">Adatforrások</span>
        <span className="cov-sum">{on.length ? <>Bekötve: <b>{on.map((p) => PF[p.platform]).join(", ")}</b></> : "Még nincs bekötött platform"}{off.length ? <> · Nincs bekötve: {off.map((p) => PF[p.platform]).join(", ")}</> : null}</span>
      </div>
      <div className="cov-l">
        {ps.map((p) => {
          const st = p.connected ? (p.last_error ? "bad" : "ok") : n(p.manual) ? "man" : "off";
          return (
            <div key={p.platform} className={"cov-i " + st}>
              <button className="cov-b" onClick={() => pick(p.platform)} title={`${PF[p.platform]} posztjai a listában`}>
                <Logo k={p.platform} size={26} />
                <span><b>{PF[p.platform]}</b>
                  <small>{p.connected ? (p.last_error ? "hiba a lehúzáskor" : `bekötve · frissítve ${ago(p.last_sync_at)}`) : WHY[p.platform]}</small>
                  <small>{fmt(n(p.posts))} poszt{n(p.manual) ? ` (${fmt(n(p.manual))} kézzel)` : ""}{p.last_post ? ` · utolsó ${ago(p.last_post)}` : ""}</small></span>
              </button>
              <div className="cov-a">
                {!p.connected && <a className="lnk" href="#connect">Bekötés</a>}
                <button className="lnk" onClick={() => add(p.platform)}>+ Poszt kézzel</button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ---------- reach by platform: today, 3, 7, 30 days ---------- */
const WIN: [number, string][] = [[1, "Ma"], [3, "3 nap"], [7, "7 nap"], [30, "30 nap"]];
type M = "reach" | "visits" | "posts";
export function ReachMatrix({ r, pick, add, err, retry }: { r: D | null; pick: (pf: string) => void; add: (pf: string) => void; err?: string; retry?: () => void }) {
  const [m, setM] = useState<M>("reach");
  const cells: D[] = r?.cells || [];
  const plats: D[] = r?.platforms || [];
  const cell = (pf: string, k: number, per: "now" | "prev") => cells.find((c) => c.platform === pf && c.k === k && c.per === per) || {};
  /* the number a platform reports for reach: impressions where it counts those (Pinterest, LinkedIn), else views
     (what its posts gathered; the account's own day numbers when posts give none) */
  const val = (pf: string, k: number, per: "now" | "prev"): { v: number | null; part?: boolean; extra?: number | null } => {
    const c = cell(pf, k, per);
    if (m === "visits") return { v: n(c.visits) };
    if (m === "posts") return { v: n(c.posts) };
    if (imp(pf)) return { v: c.imps ?? c.views ?? null };
    const v = c.views ?? c.acc_views ?? null;
    return { v, part: c.views != null && !!c.partial, extra: c.imps };
  };
  const hasData = (pf: string) => { const p = plats.find((x) => x.platform === pf); return !!p && (p.connected || n(p.posts) > 0); };
  const total = (k: number, per: "now" | "prev", kind: "view" | "imp") => {
    const list = SOC.filter((pf) => (m !== "reach" ? kind === "view" : kind === "imp" ? imp(pf) : !imp(pf)));
    const vs = list.map((pf) => val(pf, k, per)).filter((x) => x.v != null);
    return { v: vs.length ? vs.reduce((t, x) => t + n(x.v), 0) : null, part: vs.some((x) => x.part) };
  };
  const snap = plats.map((p) => p.snap_since).filter(Boolean).sort()[0];
  const Cell = ({ now, prev }: { now: { v: number | null; part?: boolean; extra?: number | null }; prev: { v: number | null; part?: boolean } }) => (
    <td className="num">
      {now.v == null ? <span className="mut">–</span> : <b title={now.part ? `Legalább ennyi: a régebbi posztok napi pillanatképei ${snap ? new Date(snap + "T12:00").toLocaleDateString("hu-HU", { month: "short", day: "numeric" }) + "-tól" : "nemrég"} vannak meg, ami előtte gyűlt, az nem számolható szét napokra.` : undefined}>{now.part ? "≥ " : ""}{big(now.v)}</b>}
      {now.v != null && prev.v != null && !now.part && !prev.part ? <div><Delta now={n(now.v)} prev={n(prev.v)} /></div> : null}
      {m === "reach" && now.extra != null ? <div className="mut" style={{ fontSize: 11 }}>+{big(now.extra)} megjelenés</div> : null}
    </td>
  );
  return (
    <Card className="s12" icon={P.eye} title="Elérés platformonként"
      sub={<>Minden platform egy sorban, a mai napra, az utolsó 3, 7 és 30 napra (budapesti napok), mellette a változás az előző ugyanilyen hosszú időszakhoz. <b>Elérés</b>: a TikTok, Instagram, Facebook és YouTube a megtekintést adja (amit a posztjaid az időszakban gyűjtöttek), a Pinterest és a LinkedIn a megjelenést; a kettőt nem adjuk össze. A <b>≥</b> jel: legalább ennyi, mert a régebbi posztok napi pillanatképe még csak rövid ideje van meg. <b>Látogató</b>: a mi mérésünk (rövid link, bio, hivatkozó). <b>Poszt</b>: hány poszt ment ki. Ez a kártya a fejléc időszakától független.</>}
      right={<div className="adm-seg sm" role="group">{([["reach", "Elérés"], ["visits", "Látogató"], ["posts", "Poszt"]] as [M, string][]).map(([k, l]) => <button key={k} aria-pressed={m === k} onClick={() => setM(k)}>{l}</button>)}</div>}>
      {!r ? (err ? <div className="alert err">Nem sikerült betölteni: {err} {retry && <button className="lnk" onClick={retry}>Újra</button>}</div> : <div className="skel" style={{ height: 220 }} />) : (
        <div className="tw"><table className="tb reach-t">
          <thead><tr><th>Platform</th>{WIN.map(([k, l]) => <th key={k} className="num">{l}</th>)}<th /></tr></thead>
          <tbody>
            {SOC.map((pf) => {
              const ok = hasData(pf);
              return (
                <tr key={pf} className={ok ? "" : "dim"}>
                  <td><button className="reach-pf" onClick={() => pick(pf)}><Logo k={pf} size={22} /><span><b>{PF[pf]}</b><small>{m === "reach" ? vword(pf) : m === "visits" ? "látogató" : "poszt"}</small></span></button></td>
                  {ok || m === "visits" ? WIN.map(([k]) => <Cell key={k} now={val(pf, k, "now")} prev={val(pf, k, "prev")} />)
                    : <td colSpan={4} className="mut reach-off">Nincs adat: {WHY[pf]}.</td>}
                  <td className="reach-a">{!ok && <><a className="lnk" href="#connect">Bekötés</a> <button className="lnk" onClick={() => add(pf)}>+ kézzel</button></>}</td>
                </tr>
              );
            })}
            {m === "reach" ? <>
              <tr className="tot"><td><b>Megtekintés összesen</b></td>{WIN.map(([k]) => <Cell key={k} now={total(k, "now", "view")} prev={total(k, "prev", "view")} />)}<td /></tr>
              <tr className="tot"><td><b>Megjelenés összesen</b><br /><small className="mut">Pinterest, LinkedIn</small></td>{WIN.map(([k]) => <Cell key={k} now={total(k, "now", "imp")} prev={total(k, "prev", "imp")} />)}<td /></tr>
            </> : <tr className="tot"><td><b>Összesen</b></td>{WIN.map(([k]) => <Cell key={k} now={total(k, "now", "view")} prev={total(k, "prev", "view")} />)}<td /></tr>}
          </tbody>
        </table></div>
      )}
    </Card>
  );
}

/* ---------- every post on one timeline, newest first, day by day ---------- */
const bpDay = (t: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Budapest", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(t));
const dayTitle = (k: string) => {
  const today = bpDay(new Date().toISOString()), diff = Math.round((Date.parse(today + "T12:00:00Z") - Date.parse(k + "T12:00:00Z")) / 864e5);
  const d = new Date(k + "T12:00:00").toLocaleDateString("hu-HU", { month: "long", day: "numeric", weekday: "long" });
  return diff === 0 ? "Ma · " + d : diff === 1 ? "Tegnap · " + d : d;
};
const STEP = 60;
export function Timeline({ posts, onOpen, onEdit }: { posts: D[]; onOpen: (p: D) => void; onEdit: (p: D) => void }) {
  const [shown, setShown] = useState(STEP);
  const sorted = useMemo(() => [...posts].filter((p) => p.created_at).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)), [posts]);
  const days = useMemo(() => {
    const out: { k: string; list: D[] }[] = [];
    sorted.slice(0, shown).forEach((p) => { const k = bpDay(p.created_at); const g = out[out.length - 1]; if (g && g.k === k) g.list.push(p); else out.push({ k, list: [p] }); });
    return out;
  }, [sorted, shown]);
  return (
    <div className="tl">
      {days.map(({ k, list }) => (
        <section key={k} className="tl-d">
          <h4><span>{dayTitle(k)}</span><small>{fmt(list.length)} poszt · {Array.from(new Set(list.map((p) => PF[p.platform]))).join(", ")}</small></h4>
          <ul>{list.map((p) => (
            <li key={p.platform + p.post_id} className="tl-i">
              <button className="tl-b" onClick={() => onOpen(p)}>
                <span className="tl-img">{p.thumb ? <img src={p.thumb} alt="" referrerPolicy="no-referrer" loading="lazy" /> : <Logo k={p.platform} size={26} />}</span>
                <span className="tl-t"><span className="tl-m"><Logo k={p.platform} size={14} />{PF[p.platform]} · {new Date(p.created_at).toLocaleTimeString("hu-HU", { timeZone: "Europe/Budapest", hour: "2-digit", minute: "2-digit" })}{isManual(p) && <span className="chip">kézzel felvéve</span>}</span>
                  <span className="tl-x">{p.title || "(nincs szöveg)"}</span></span>
                <span className="tl-v"><b>{p.views == null ? "–" : big(p.views)}</b><small>{vword(p.platform)}</small></span>
              </button>
              {isManual(p) ? <button className="adm-ibtn sm" onClick={() => onEdit(p)}>Szerkesztés</button> : p.url ? <a className="adm-ibtn sm" href={p.url} target="_blank" rel="noreferrer">Megnyitás ↗</a> : null}
            </li>))}</ul>
        </section>
      ))}
      {sorted.length > shown && <div className="adm-row" style={{ justifyContent: "center", marginTop: 12 }}><button className="adm-ibtn" onClick={() => setShown(shown + STEP)}>Korábbiak ({fmt(sorted.length - shown)} poszt van még)</button></div>}
    </div>
  );
}

/* ---------- a post added by hand ---------- */
export const pfOfUrl = (u: string): string | null => {
  const h = (() => { try { return new URL(u.trim()).hostname.replace(/^(www|m|vm|vt)\./, ""); } catch { return ""; } })();
  return /tiktok\.com$/.test(h) ? "tiktok" : /instagram\.com$/.test(h) ? "instagram" : /(facebook\.com|fb\.watch|fb\.com)$/.test(h) ? "facebook"
    : /(pinterest\.[a-z.]+|pin\.it)$/.test(h) ? "pinterest" : /(linkedin\.com|lnkd\.in)$/.test(h) ? "linkedin" : /(youtube\.com|youtu\.be)$/.test(h) ? "youtube" : null;
};
const KINDS: Record<string, [string, string][]> = {
  tiktok: [["video", "Videó"], ["image", "Fotó"]], instagram: [["reel", "Reels"], ["image", "Kép"], ["carousel_album", "Körhinta"], ["story", "Story"]],
  facebook: [["video", "Videó"], ["reel", "Reels"], ["image", "Kép"], ["link", "Link"], ["post", "Poszt"]], pinterest: [["pin", "Pin"], ["video", "Videós pin"]],
  linkedin: [["post", "Poszt"], ["video", "Videó"], ["document", "Dokumentum"], ["image", "Kép"]], youtube: [["short", "Shorts"], ["video", "Videó"]],
};
const localInput = (t?: string) => { const d = t ? new Date(t) : new Date(); const z = new Date(d.getTime() - d.getTimezoneOffset() * 6e4); return z.toISOString().slice(0, 16); };
const num = (s: string) => (s.trim() === "" ? null : Math.max(0, Math.round(Number(s.replace(/[\s.]/g, "").replace(",", ".")) || 0)));

export function ManualPost({ init, close, saved }: { init: D; close: () => void; saved: () => void }) {
  const sb = useMemo(() => supabaseBrowser(), []);
  const edit = isManual(init);
  const [v, setV] = useState<D>({ platform: init.platform || "", url: init.url || "", at: localInput(init.created_at), title: init.title || "", kind: init.kind || "",
    views: init.views ?? "", likes: init.likes ?? "", comments: init.comments ?? "", shares: init.shares ?? "", saves: init.saves ?? "" });
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const set = (p: D) => setV((o) => ({ ...o, ...p }));
  const onUrl = (u: string) => { const pf = pfOfUrl(u); set({ url: u, ...(pf && !edit ? { platform: pf, kind: v.platform === pf ? v.kind : "" } : {}) }); };
  const pf = v.platform as string;
  const save = async () => {
    setErr("");
    if (!pf) return setErr("Válaszd ki a platformot.");
    if (!/^https?:\/\//i.test(String(v.url).trim())) return setErr("Másold be a poszt teljes linkjét (https://…).");
    setBusy(true);
    const views = num(String(v.views));
    const { error } = MOCK ? { error: null } : await rpc(sb, "admin_post_manual_save", { p_platform: pf, p_url: String(v.url).trim(), p_created_at: new Date(v.at).toISOString(), p_title: v.title || null, p_kind: v.kind || null,
      p_views: views, p_likes: num(String(v.likes)), p_comments: num(String(v.comments)), p_shares: num(String(v.shares)), p_saves: num(String(v.saves)), p_impressions: imp(pf) ? views : null, p_post_id: edit ? init.post_id : null });
    setBusy(false);
    if (error) return setErr(error.message.replace(/^.*?:\s*(?=[A-ZÁÉÍÓÖŐÚÜŰ])/, ""));
    toast(edit ? "Poszt frissítve" : "Poszt hozzáadva"); saved(); close();
  };
  const del = async () => {
    if (!confirm("Biztosan törlöd ezt a kézzel felvett posztot?")) return;
    setBusy(true); const { error } = MOCK ? { error: null } : await rpc(sb, "admin_post_manual_delete", { p_platform: init.platform, p_post_id: init.post_id }); setBusy(false);
    if (error) return setErr(error.message); toast("Poszt törölve"); saved(); close();
  };
  return (
    <Layer>
      <div className="scrim" onClick={close} />
      <aside className="drawer" role="dialog" aria-label="Poszt kézzel">
        <div className="c-h"><div><div><span className="eyebrow">{pf ? PF[pf] : "Közösségi poszt"}</span><h2 style={{ fontSize: 20, marginTop: 6 }}>{edit ? "Kézzel felvett poszt" : "Poszt hozzáadása kézzel"}</h2></div></div><button className="adm-ibtn" onClick={close}>Bezárás</button></div>
        <p className="note">Arra az esetre, ha a platform még nincs bekötve: így is ott a poszt az idővonalon, a naptárban és a ranglistán. A számokat a platform alkalmazásából olvasd le, és bármikor frissítheted (minden mentés a napi pillanatkép is). Amikor a platformot bekötöd, a valódi poszt magától átveszi a helyét, a rövid linkjével együtt.</p>
        <label className="lf"><span>A poszt linkje</span><input className="adm-in" value={v.url} onChange={(e) => onUrl(e.target.value)} placeholder="https://www.instagram.com/reel/…" inputMode="url" autoFocus={!edit} /></label>
        <div className="lf"><span>Platform</span><div className="pf-pick">{SOC.map((s) => <button key={s} type="button" aria-pressed={pf === s} disabled={edit && s !== pf} onClick={() => set({ platform: s, kind: "" })}><Logo k={s} size={20} />{PF[s]}</button>)}</div></div>
        <div className="form-2">
          <label className="lf"><span>Mikor ment ki</span><input className="adm-in" type="datetime-local" value={v.at} max={localInput()} onChange={(e) => set({ at: e.target.value })} /></label>
          <label className="lf"><span>Típus</span><select className="adm-in" value={v.kind} onChange={(e) => set({ kind: e.target.value })}><option value="">–</option>{(KINDS[pf] || []).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        </div>
        <label className="lf"><span>Szöveg (az első sor elég)</span><textarea className="adm-in" rows={2} value={v.title} maxLength={500} onChange={(e) => set({ title: e.target.value })} /></label>
        <div className="form-2">
          <label className="lf"><span>{imp(pf) ? "Megjelenés" : "Megtekintés"}</span><input className="adm-in" inputMode="numeric" value={v.views} onChange={(e) => set({ views: e.target.value })} placeholder="pl. 1200" /></label>
          {pf !== "pinterest" && <label className="lf"><span>Kedvelés</span><input className="adm-in" inputMode="numeric" value={v.likes} onChange={(e) => set({ likes: e.target.value })} /></label>}
          <label className="lf"><span>Komment</span><input className="adm-in" inputMode="numeric" value={v.comments} onChange={(e) => set({ comments: e.target.value })} /></label>
          <label className="lf"><span>Megosztás</span><input className="adm-in" inputMode="numeric" value={v.shares} onChange={(e) => set({ shares: e.target.value })} /></label>
          <label className="lf"><span>Mentés</span><input className="adm-in" inputMode="numeric" value={v.saves} onChange={(e) => set({ saves: e.target.value })} /></label>
        </div>
        {err && <div className="alert err">{err}</div>}
        <div className="adm-row">
          <button className="adm-ibtn gold" onClick={save} disabled={busy}>{busy ? "Mentés…" : "Mentés"}</button>
          {edit && <button className="adm-ibtn" onClick={del} disabled={busy}>Törlés</button>}
          {v.url && /^https?:\/\//.test(v.url) && <a className="adm-ibtn" href={v.url} target="_blank" rel="noreferrer">Megnyitás ↗</a>}
        </div>
      </aside>
    </Layer>
  );
}

/* the empty state of a platform without posts: why, and the two ways forward */
export function PfEmpty({ pf, connected, add }: { pf: string; connected: boolean; add: (pf: string) => void }) {
  return (
    <Empty title={`${PF[pf]}: nincs poszt`} t={connected ? `A(z) ${PF[pf]} be van kötve, de ebben a nézetben nincs posztja. Válassz hosszabb időszakot, vagy nézd az Idővonalat (minden poszt, időszaktól függetlenül).` : `A(z) ${PF[pf]} még nincs bekötve (${WHY[pf]}), ezért a posztjai nem jönnek be maguktól. Addig kézzel is felveheted őket a linkjükkel.`} icon={P.social}>
      <div className="adm-row" style={{ justifyContent: "center" }}>{!connected && <a className="adm-ibtn gold" href="#connect">Bekötés</a>}<button className="adm-ibtn" onClick={() => add(pf)}>{I(P.plus)}Poszt kézzel</button></div>
    </Empty>
  );
}
