"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "../phone";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Spark, fmt } from "../charts";
import { Logo, NowSteps } from "../wow";
import { Globe, LANG_LAND, Orbs, flag } from "../visuals";
import { DayReplay } from "./visual";
import { Card, ERRS, FILES, HIDDEN, I, MOCK, P, PF, QSTEP, QVAL, ago, api, big, ch, chime, dt, ev, n, type D, OWN_LINK, rpc, useFlt } from "../shared";
import { viewWord } from "./social";
import { InboxItem } from "./inbox";

/* the windows the page counts in, said once (they were four, and none was written down) */
const W = { now: 5, globe: 15, curve: 30 };
/* the feed's event types, for the filter */
const KINDS: Record<string, [string, (x: D) => boolean]> = {
  all: ["Mind", () => true], web: ["Weboldal", (x) => x.name === "landing_view" || x.name === "cta_click"], app: ["App", (x) => x.name === "app_open" || x.name === "flow_step" || x.name.startsWith("quiz")],
  score: ["Előnézet", (x) => x.name === "flow_step" && x.props?.step === "score"], share: ["Megosztás", (x) => x.name.startsWith("share") || x.name === "reveal_share"],
  signup: ["Regisztráció", (x) => x.name === "signup"], err: ["Hiba", (x) => ERRS.has(x.name)],
};

/* ---------- live ---------- */
export function Live({ d: d0 }: { d: D }) {
  const { f: flt } = useFlt();
  const seen = useRef<Set<string>>(new Set());
  const first = useRef(true);
  const sbx = useMemo(() => supabaseBrowser(), []);
  /* the page's own poll: it follows the channel and language filter (the shared poll does not), and brings the
     per-minute curve of every event, the short-link clicks and the post behind each link */
  const [lv, setLv] = useState<D | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () => rpc(sbx, "admin_live", { p_ch: flt.ch || null, p_lang: flt.lang || null }).then(({ data }) => { if (alive && data) setLv(data as D); });
    load(); const t = setInterval(() => { if (document.visibilityState === "visible") load(); }, 10_000);
    return () => { alive = false; clearInterval(t); };
  }, [sbx, flt.ch, flt.lang]);
  const filtered = !!(flt.ch || flt.lang);
  const d: D = lv && (filtered || lv.live) ? { ...d0, live: lv.live, live_now: lv.live_now, live_hour: lv.live_hour, ...(filtered ? { today: lv.today } : {}) } : d0;
  /* new events arrive the moment they happen (Supabase Realtime, admin-only read policy); the 10 s poll is the fallback */
  const [rt, setRt] = useState<D[]>([]); const [on, setOn] = useState(false);
  const [sound, setSound] = useState(false); const [paused, setPaused] = useState<D[] | null>(null); const [kind, setKind] = useState("all");
  useEffect(() => { try { setSound(localStorage.getItem("inkage.admin.sound") === "1"); } catch {} }, []);
  useEffect(() => { try { localStorage.setItem("inkage.admin.sound", sound ? "1" : "0"); } catch {} }, [sound]);
  /* "Ez én voltam": the visit leaves every number at once (here right away, everywhere at the next refresh) */
  const [mine, setMine] = useState<string[]>([]); const [own, setOwn] = useState<D[]>([]); const [ownAll, setOwnAll] = useState(false);
  const ownRef = useRef<Set<string>>(new Set()); const uid = useRef<string | null>(null);
  const loadOwn = () => rpc(sbx, "admin_own_list").then(({ data }) => { const l = Array.isArray(data) ? data : []; setOwn(l); ownRef.current = new Set(l.map((o: D) => o.s)); });
  useEffect(() => { loadOwn(); if (sbx && !MOCK) sbx.auth.getUser().then(({ data }) => { uid.current = data.user?.id || null; }); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (MOCK) return; const sb = supabaseBrowser(); if (!sb) return;
    const c = sb.channel("admin-live").on("postgres_changes", { event: "INSERT", schema: "public", table: "events" }, (pl: { new: D }) => {
      const e = pl.new || {}; const src = e.props?.src || {}, ses = String(e.session || "");
      if (/test/i.test(src.us || "") || ["qa", "qa2", "scoretest", "rec", "test"].includes(src.uc || "")) return;
      /* her own visits stay out of the stream too, not only after the next refresh: a marked visit, or one where she is signed in */
      if (ownRef.current.has(ses.slice(-6)) || (uid.current && e.user_id === uid.current)) return;
      if (flt.lang && String(e.lang || "").slice(0, 2) !== flt.lang.slice(0, 2)) return;
      setRt((o) => [{ created_at: e.created_at, name: e.name, props: { ...(e.props || {}), src: undefined }, src, path: e.path, lang: e.lang, s: ses.slice(-6), sid: ses.slice(-12) }, ...o].slice(0, 80));
    }).subscribe((st: string) => setOn(st === "SUBSCRIBED"));
    return () => { sb.removeChannel(c); };
  }, [flt.lang]);
  const markMine = async (x: { s: string; sid?: string; at?: string }, on2 = true) => {
    if (on2) setMine((m) => [...m, x.s]); else setMine((m) => m.filter((y) => y !== x.s));
    const r = await rpc(sbx, "admin_mark_own_short", { p_short: x.sid || x.s, p_on: on2, ...(x.at ? { p_at: x.at } : {}) });
    if ((r.data as D)?.ambiguous) toast("Több látogatás végződik így: nyisd meg az eseményt, és onnan jelöld");
    else toast(on2 ? "Kizárva: ez a látogatás nem számít sehol" : "Visszavéve");
    loadOwn();
  };
  const thisDevice = typeof localStorage !== "undefined" && (() => { try { return localStorage.getItem("inkage.own") === "1"; } catch { return false; } })();
  const polled: D[] = d.live || [];
  const newest = polled[0]?.created_at || "";
  /* the channel filter cannot be checked on a raw realtime row (its channel is computed in the database): filtered, the poll alone feeds the list */
  /* a realtime row of a visit the hourly rules marked as a machine never shows (the poll already leaves them out) */
  const bots = new Set<string>(((lv?.bots || []) as string[]));
  const live: D[] = [...(filtered && flt.ch ? [] : rt.filter((x) => x.created_at > newest && !bots.has(x.s))), ...polled].filter((x: D) => !HIDDEN.has(x.name) && !mine.includes(x.s)).slice(0, 80);
  /* "Szünet": the list stands still while you read it; the numbers above keep counting */
  const items: D[] = (paused || live).filter((x) => (KINDS[kind] || KINDS.all)[1](x));
  const fresh = new Set<string>();
  items.forEach((x) => { const id = x.created_at + x.name + x.s; if (!first.current && !seen.current.has(id)) fresh.add(id); });
  useEffect(() => {
    /* a soft chime for each new preview, a brighter one for a sign-up (only when switched on) */
    if (sound && fresh.size && !paused) { const nw = items.filter((x) => fresh.has(x.created_at + x.name + x.s)); const tone = nw.some((x) => x.name === "signup") ? 880 : nw.some((x) => x.name === "flow_step" && x.props?.step === "score") ? 660 : 0; if (tone) chime(tone); }
    items.forEach((x) => seen.current.add(x.created_at + x.name + x.s)); first.current = false;
  });
  const codes: D = lv?.codes || {};
  const postOf = (s: D) => (s?.ux && codes[s.ux] ? codes[s.ux] : null);
  const desc = (x: D) => {
    const p = x.props || {}, parts: string[] = [];
    if (p.step) parts.push(QSTEP[p.step] || p.step); if (p.value) parts.push(QVAL[p.value] || p.value);
    if (p.kind) parts.push(p.kind); if (p.k) parts.push(FILES[p.k] || p.k); if (p.cta) parts.push(p.cta); if (p.page) parts.push(p.page === "start" ? "/app" : p.page);
    if (p.msg || p.why) parts.push(p.msg || p.why);
    const s = x.src || {}, po = postOf(s); if (s.us) parts.push("← " + ch(s.us) + (po ? ` „${String(po.title || "").slice(0, 30)}”` : s.ux ? " / " + s.ux : "")); else if (s.from) parts.push("← " + s.from);
    return parts.join(" · ") || x.path || "";
  };
  const kindOf = (x: D) => ERRS.has(x.name) ? ["bad", P.alert] : x.name === "signup" ? ["good", P.user] : x.name === "flow_step" && x.props?.step === "score" ? ["gold", P.target] : x.name === "landing_view" ? ["", P.eye] : x.name.startsWith("share") ? ["gold", P.share] : ["", P.bolt];
  /* where the people of the last 5 minutes are: their last step */
  const lastBy = new Map<string, D>(); live.filter((x) => Date.now() - new Date(x.created_at).getTime() < W.now * 60e3).forEach((x) => { if (!lastBy.has(x.s)) lastBy.set(x.s, x); });
  const stepName = (x: D) => x.name === "flow_step" ? (({ name: "Fotót választ", score: "Előnézetet nézi", scan: "Előnézet készül", reveal: "Öregedést nézi" } as D)[x.props?.step] || "Az appban") : x.name === "landing_view" ? "Weboldalt olvas" : x.name.startsWith("quiz") ? "Bevezető kérdések" : x.name.startsWith("share") ? "Megoszt" : "Az appban";
  const nowSteps = Object.entries([...lastBy.values()].reduce((m: Record<string, number>, x) => { const k = stepName(x); m[k] = (m[k] || 0) + 1; return m; }, {})).map(([l, c]) => ({ l, n: c as number })).sort((a, b) => b.n - a.n);
  /* the globe: the visitors of the last 15 minutes, each language area as heavy as its visitors */
  const pinN: Record<string, number> = {};
  live.filter((x) => Date.now() - new Date(x.created_at).getTime() < W.globe * 60e3 && x.lang).forEach((x) => { const a2 = (LANG_LAND[String(x.lang).slice(0, 2)] || [])[0]; if (a2) pinN[a2] = (pinN[a2] || 0) + 1; });
  const livePins = Object.entries(pinN).map(([a2, c]) => ({ a2, n: c }));
  /* the feed by visitor: one row per anonymous visit, its path in order, the important steps lit */
  const [byVisit, setByVisit] = useState(true);
  const visits = [...items.reduce((m, x) => { const k = x.s || "?"; const g = m.get(k) || []; g.push(x); m.set(k, g); return m; }, new Map<string, D[]>()).entries()].map(([k, ev2]) => ({ k, ev: [...ev2].reverse() })).sort((a, b) => (b.ev[b.ev.length - 1]?.created_at || "").localeCompare(a.ev[a.ev.length - 1]?.created_at || ""));
  const [more, setMore] = useState(false);
  const short = (x: D) => x.name === "landing_view" ? "Weboldal" : x.name === "app_open" ? "App" : x.name === "flow_step" ? (QSTEP[x.props?.step] || ({ score: "Előnézet", scan: "Előnézet készül", reveal: "50 év múlva" } as D)[x.props?.step] || "Lépés") : x.name.startsWith("quiz") ? "Kérdések" : x.name === "signup" ? "Regisztráció" : x.name.startsWith("share") ? "Megosztás" : ERRS.has(x.name) ? "Hiba" : ev(x.name);
  /* per minute from the database: every event of the last 30 minutes, not only the 80 the list holds */
  const perMin: number[] = Array.isArray(lv?.per_min) ? lv!.per_min.map(n) : Array.from({ length: W.curve }, (_, i) => { const t1 = Date.now() - (W.curve - 1 - i) * 60e3; return live.filter((x) => { const t = new Date(x.created_at).getTime(); return t <= t1 && t > t1 - 60e3; }).length; });
  const clicks: D[] = lv?.clicks || [];
  return (
    <div className="g">
      <section className="c s12">
        <div className="livegrid">
          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            <div><span className="eyebrow"><i className="adm-dot" style={{ display: "inline-block", marginRight: 8, verticalAlign: "middle" }} />Élő · {new Date().toLocaleTimeString("hu-HU", { hour: "2-digit", minute: "2-digit" })}{filtered ? " · szűrve" : ""}</span>
              <h1 style={{ marginTop: 10 }}>{fmt(d.live_now)} ember most</h1>
              <p className="note" style={{ fontSize: 14, marginTop: 8 }}>„Most”: az elmúlt {W.now} percben. Az elmúlt órában <b>{fmt(d.live_hour)}</b> látogatás, ma eddig <b>{fmt(d.today?.sessions)}</b>. A földgömbön az elmúlt {W.globe} perc látogatóinak nyelvterülete villog (becslés a nyelvből, a pont annál erősebb, minél többen jöttek onnan); húzd az ujjaddal a forgatáshoz.</p></div>
            <Orbs items={[{ l: "most az oldalon", v: n(d.live_now), tone: "a" }, { l: "előnézet ma", v: n(d.today?.scored), tone: "b" }, { l: "rövidlink-kattintás ma", v: n(lv?.clicks_today), tone: "c" }]} />
            <NowSteps steps={nowSteps} />
            <div style={{ height: 70 }}><Spark values={perMin} h={70} /></div>
            <span className="note">Események percenként, az elmúlt {W.curve} percben (minden esemény, nem csak a lista 80 sora). A lépések: az elmúlt {W.now} perc látogatóinak utolsó lépése.</span>
          </div>
          <Globe pins={livePins} size={460} />
        </div>
      </section>
      <LivePosts />
      {clicks.length > 0 && <Card className="s12" icon={P.links} title="Rövidlink-kattintások élőben" sub="Az elmúlt óra kattintásai a inkage.app/go/… linkekre (a saját eszközödről jövők nélkül), és melyik poszt linkje volt.">
        <ul className="lc">{clicks.slice(0, 12).map((c, i) => <li key={c.code + c.at + i}><Logo k={c.source || "link"} size={20} /><div><b>/go/{c.code}{c.title ? ` · ${String(c.title).slice(0, 50)}` : c.note ? ` · ${String(c.note).slice(0, 50)}` : ""}</b><span>{[c.country && `${flag(String(c.country).toUpperCase())} ${c.country}`, c.device].filter(Boolean).join(" · ")}</span></div><time>{ago(c.at)}</time></li>)}</ul>
      </Card>}
      <Card className="s12" icon={P.user} title="Saját látogatások kizárva" sub="A megjelölt eszközeidről nem megy adat, és a „Ez én voltam” gombbal megjelölt látogatásaid egyik számba sem kerülnek bele (élő, források, tölcsér, tartalom, rövid linkek); a saját és tesztfiókjaid a fiók- és regisztrációszámokból maradnak ki. A fiókkal belépve tett látogatást a fiók magában nem zárja ki: ehhez az eszközt kell megjelölni. Az Instagram és a TikTok saját böngészője külön eszköznek számít: küldd el magadnak a linket, és nyisd meg ott egyszer.">
        <div className="ownbox">
          <div className="own-st"><span className={"chip " + (thisDevice || MOCK ? "good" : "warn")}>{thisDevice || MOCK ? "✓ ez az eszköz ki van zárva" : "ez az eszköz még számít"}</span><span className="note">{fmt(own.length)} látogatás megjelölve sajátként</span></div>
          <div className="own-link"><code>{OWN_LINK}</code><button className="adm-ibtn sm" onClick={() => { navigator.clipboard?.writeText(OWN_LINK); toast("Link másolva"); }}>Másolás</button>
            {typeof navigator !== "undefined" && "share" in navigator && <button className="adm-ibtn sm" onClick={() => navigator.share?.({ url: OWN_LINK, title: "InkAge · saját eszköz" }).catch(() => {})}>Küldés…</button>}</div>
          <OwnAccounts reload={loadOwn} />
          {own.length > 0 && <ul className="own-l">{(ownAll ? own : own.slice(0, 8)).map((o) => <li key={o.s + o.at}><span className="chip">#{o.s}</span><span>{fmt(o.events)} esemény · {ago(o.first)}</span><button className="lnk" onClick={() => markMine({ s: o.s, at: o.first }, false)}>visszavesz</button></li>)}</ul>}
          {own.length > 8 && <button className="lnk" onClick={() => setOwnAll(!ownAll)}>{ownAll ? "Kevesebb" : `Mind a ${own.length} →`}</button>}
        </div>
      </Card>
      <Card className="s12" icon={P.play} title="A nap visszajátszása" sub="Egy nap (az elmúlt 7 közül) 10 perces lépésekben: húzd a csúszkát vagy játszd le, és nézd, mikor jöttek a látogatók, mikor jutottak el az előnézetig és a regisztrációig, honnan jöttek, és mikor ment ki egy poszt. Jól látszik, mit mozdított meg egy videó.">
        <DayReplay />
      </Card>
      <Card className="s12" icon={P.live} title="Élő eseményfolyam" sub="Az utolsó 80 esemény. Fotó, minta és e-mail nélkül; a „#” egy névtelen látogatás rövid azonosítója, a „←” mögött a forrás és a rövid link posztja. A hang gombbal halk jelzést kapsz minden új előnézetnél; a Szünet megállítja a listát, amíg olvasod."
        right={<><button className={"adm-ibtn sm" + (paused ? " on" : "")} onClick={() => setPaused(paused ? null : live)}>{paused ? "▶ Tovább" : "❚❚ Szünet"}</button><button className={"adm-ibtn sm" + (sound ? " on" : "")} onClick={() => setSound(!sound)}>{sound ? "🔔 Hang be" : "🔕 Hang ki"}</button><span className={"chip " + (on ? "good" : "")}>{on ? "● élő kapcsolat" : "10 mp-es frissítés"}</span></>}>
        <div className="adm-row" style={{ gap: 8 }}>
          <div className="adm-seg sm"><button aria-pressed={byVisit} onClick={() => setByVisit(true)}>Látogatónként</button><button aria-pressed={!byVisit} onClick={() => setByVisit(false)}>Időrendben</button></div>
          <div className="adm-seg sm" role="group" aria-label="Eseménytípus">{Object.entries(KINDS).map(([k, [l]]) => <button key={k} aria-pressed={kind === k} onClick={() => setKind(k)}>{l}</button>)}</div>
        </div>
        {byVisit && <ul className="visits">
          {(more ? visits : visits.slice(0, 20)).map((g) => { const last = g.ev[g.ev.length - 1], src = g.ev.find((x) => x.src?.us || x.src?.from)?.src || {}, po = postOf(src), imp = g.ev.some((x) => x.name === "signup") ? "good" : g.ev.some((x) => ERRS.has(x.name)) ? "bad" : g.ev.some((x) => x.name === "flow_step" && x.props?.step === "score") ? "gold" : "";
            const path = g.ev.map(short).filter((t, i, a) => t !== a[i - 1]);
            return (
              <li key={g.k} className={imp + (fresh.has(last.created_at + last.name + last.s) ? " new" : "")}>
                <div className="vh"><span className="chip">#{g.k}</span>{src.us ? <span className="vsrc"><Logo k={src.us} size={18} />{ch(src.us)}{po ? <em className="vpost"> · {String(po.title || "").slice(0, 40)}</em> : null}</span> : src.from ? <span className="vsrc">{src.from}</span> : <span className="vsrc dim">ismeretlen forrás</span>}{last.lang && <span className="vl">{flag((LANG_LAND[String(last.lang).slice(0, 2)] || [])[0])}</span>}<time>{ago(last.created_at)}</time>
                  <button className="mine-b" onClick={() => markMine({ s: g.k, sid: g.ev.find((x) => x.sid)?.sid, at: last.created_at })} title="A saját látogatásom: ne számítson sehol">Ez én voltam</button></div>
                <div className="vp">{path.map((t, i) => <span key={i} className={t === "Regisztráció" ? "good" : t === "Hiba" ? "bad" : t === "Előnézet" ? "gold" : ""}>{t}</span>)}</div>
              </li>
            ); })}
        </ul>}
        {byVisit && visits.length > 20 && <button className="lnk" onClick={() => setMore(!more)}>{more ? "Kevesebb" : `Mind a ${visits.length} látogatás →`}</button>}
        {!byVisit && <ul className="feed">
          {items.map((x, i) => { const id = x.created_at + x.name + x.s; const [cls, icon] = kindOf(x); return (
            <li key={id + "#" + i} className={fresh.has(id) ? "new" : ""}>
              <time title={dt(x.created_at)}>{new Date(x.created_at).toLocaleTimeString("hu-HU", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</time>
              <span className={"fi " + cls}>{I(icon)}</span>
              <span className="nm">{ev(x.name)}</span>
              <span className="pr">{desc(x)}</span>
              <span className="chip">#{x.s || "–"}{x.lang ? " · " + String(x.lang).toUpperCase() : ""}</span>
            </li>
          ); })}
        </ul>}
        {!items.length && <p className="note">{kind === "all" ? "Még nincs esemény." : "Ilyen esemény most nincs a listában."}</p>}
      </Card>
    </div>
  );
}

/* ---------- the main posts, counting live, and the newest comments ----------
   The platforms are no longer asked every 5 minutes from here (the hourly sync keeps them fresh, and a button asks
   once more); the hourly snapshots give the pace: views in the last hour, and a post running far above its platform. */
function LivePosts() {
  const sb = useMemo(() => supabaseBrowser(), []);
  const [ps, setPs] = useState<D[] | null>(null); const [ib, setIb] = useState<D[]>([]); const [busy, setBusy] = useState(false); const [ibN, setIbN] = useState(0);
  /* "+N since you opened it" survives a reload: the first numbers of this visit are kept for the browser tab */
  const base = useRef<Record<string, number>>({});
  useEffect(() => { try { base.current = JSON.parse(sessionStorage.getItem("inkage.admin.livebase") || "{}"); } catch {} }, []);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const [{ data }, { data: inb }] = await Promise.all([rpc(sb, "admin_live_posts"), rpc(sb, "admin_inbox", { p_all: true })]);
      if (!alive) return;
      const l = Array.isArray(data) ? (data as D[]) : [];
      l.forEach((p) => { const k = p.platform + p.post_id; if (base.current[k] == null) base.current[k] = n(p.views); });
      try { sessionStorage.setItem("inkage.admin.livebase", JSON.stringify(base.current)); } catch {}
      setPs(l); setIb((((inb as D)?.items || []) as D[]).filter((x) => !x.done).slice(0, 8));
    };
    load();
    const t = setInterval(() => { if (document.visibilityState === "visible") load(); }, 60_000);
    return () => { alive = false; clearInterval(t); };
  }, [sb, ibN]);
  /* asking the platforms now: at most once per 3 minutes from any open page (the same guard as the social pages) */
  const syncNow = async () => {
    let last = 0; try { last = Number(localStorage.getItem("inkage.admin.socsync") || 0); } catch {}
    if (Date.now() - last < 3 * 60e3) { toast("Pár perce frissült: várj egy kicsit"); return; }
    try { localStorage.setItem("inkage.admin.socsync", String(Date.now())); } catch {}
    setBusy(true); if (!MOCK) await api("/api/admin/sync?only=social", { method: "POST" }); setBusy(false); setIbN((x) => x + 1); toast("Frissítve a platformokról");
  };
  /* a post's last hour against the usual last hour on its platform (the median of its posts that moved) */
  const med: Record<string, number> = {};
  for (const pf of Array.from(new Set((ps || []).map((p) => p.platform)))) { const v = (ps || []).filter((p) => p.platform === pf && n(p.gain_h) > 0).map((p) => n(p.gain_h)).sort((a, b) => a - b); if (v.length) med[pf] = v[Math.floor(v.length / 2)]; }
  const hot = (p: D) => (med[p.platform] && n(p.gain_h) >= 3 * med[p.platform] && n(p.gain_h) >= 50 ? n(p.gain_h) / med[p.platform] : 0);
  const posts = [...(ps || [])].sort((a, b) => hot(b) - hot(a) || n(b.gain_h) - n(a.gain_h) || n(b.gain_d) - n(a.gain_d)).slice(0, 6);
  const [reply, setReply] = useState<D | null>(null);
  return (
    <>
      <Card className="s7" icon={P.eye} src={["tiktok", "instagram", "facebook", "pinterest", "linkedin", "youtube"]} title="A fő posztok élőben" sub="A friss és a most is mozgó posztjaid, a platform saját mértékegységében (TikTok, Instagram, YouTube: megtekintés; Pinterest, LinkedIn: megjelenés). „/óra”: az elmúlt óra növekedése az óránkénti pillanatképekből; 🔥: a platformod szokásos óránkénti tempójának legalább háromszorosa. A zöld szám: ennyi jött, mióta ma megnyitottad."
        right={<button className="adm-ibtn sm" onClick={syncNow} disabled={busy}>{I(P.refresh)}{busy ? "Frissítés…" : "Frissítés most"}</button>}>
        {ps == null ? <div className="skel" style={{ height: 160 }} /> : posts.length ? <div className="lp">{posts.map((p) => { const d0 = n(p.views) - n(base.current[p.platform + p.post_id]), x = hot(p);
          return <a key={p.platform + p.post_id} className={"lp-i" + (x ? " hot" : "")} href={p.url || undefined} target="_blank" rel="noreferrer"><Logo k={p.platform} size={26} /><span className="lp-t">{x ? "🔥 " : ""}{String(p.title || PF[p.platform]).slice(0, 50)}</span><b>{big(p.views)}</b>{d0 > 0 && <em>+{fmt(d0)}</em>}
            <small>{viewWord(p.platform)}{p.gain_h != null ? ` · +${big(Math.max(0, n(p.gain_h)))}/óra` : ""}{p.gain_d != null ? ` · +${big(Math.max(0, n(p.gain_d)))}/nap` : ""}{x ? ` · a szokásos ${fmt(x, 1)}×-e` : ""} · {big(p.likes)} ♥ · {big(p.comments)} komment</small>
            {Array.isArray(p.hourly) && p.hourly.length > 2 && <span className="lp-sp"><Spark values={(p.hourly as number[]).map(n)} h={22} /></span>}</a>; })}</div>
          : <p className="note">A bekötött platformok friss posztjai itt pörögnek.</p>}
      </Card>
      <Card className="s5" icon={P.mail} title="Friss kommentek és vélemények" sub="A legújabb megválaszolatlan kommentek és áruházi vélemények, percenként frissül. Innen is válaszolhatsz. A TikTok-, Pinterest- és LinkedIn-kommenteket a platformok API-ja nem adja (a TikTok csak üzleti fiókkal).">
        {ib.length ? <ul className="lc">{ib.map((x) => <li key={x.source + x.item_id}><Logo k={x.source === "google" ? "play" : x.source} size={20} /><div><b>{x.author || "Névtelen"}{x.kind === "review" && x.rating ? ` · ${"★".repeat(n(x.rating))}` : ""}</b><span>{String(x.body || "").slice(0, 90)}</span></div><time>{ago(x.created_at)}</time><button className="lnk" onClick={() => setReply(x)}>Válasz</button></li>)}</ul> : <p className="note">Nincs megválaszolatlan komment.</p>}
        {reply && <ul className="inbox lc-reply"><InboxItem x={reply} onDone={() => { setReply(null); setIbN((k) => k + 1); }} onSent={() => { setReply(null); setIbN((k) => k + 1); }} startOpen /></ul>}
        <a className="lnk" href="#inbox">Postafiók →</a>
      </Card>
    </>
  );
}

/* ---------- her own accounts: a visit where she is signed in with one of these never counts ---------- */
function OwnAccounts({ reload }: { reload: () => void }) {
  const sb = useMemo(() => supabaseBrowser(), []);
  const [d, setD] = useState<D | null>(null); const [e, setE] = useState("");
  const load = () => rpc(sb, "admin_own_accounts_list").then(({ data }) => setD(data || null));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const add = async (ev2: React.FormEvent) => { ev2.preventDefault(); const r = await rpc(sb, "admin_own_account_set", { p_email: e, p_on: true }); if (r.error) { toast("Ez nem e-mail-cím."); return; } setE(""); toast("Ez a fiók kimarad a fiók- és regisztrációszámokból"); load(); reload(); };
  /* removing gives the account's visits back to the numbers (the database update does it) */
  const del = async (x: string) => { if (!confirm(`${x}: a látogatásai újra számítanak. Biztos?`)) return; await rpc(sb, "admin_own_account_set", { p_email: x, p_on: false }); toast("Levéve: a látogatásai újra számítanak"); load(); reload(); };
  return (
    <div className="own-acc">
      <span className="note">Saját és tesztfiókjaid: egyik fiók-, regisztráció- és megtartásszámba sem kerülnek bele. A látogatásaikat viszont csak az eszköz megjelölése zárja ki (a mérés fiókot nem küld), ezért nyisd meg a fenti linket minden eszközödön.</span>
      <div className="own-chips">{((d?.admin || []) as string[]).map((x) => <span key={x} className="chip gold">{x}</span>)}{((d?.extra || []) as string[]).map((x) => <span key={x} className="chip">{x}<button className="lnk" onClick={() => del(x)} aria-label="Levesz"> ✕</button></span>)}</div>
      <form className="adm-row" onSubmit={add}><input className="adm-in sm" style={{ flex: "1 1 220px" }} type="email" placeholder="másik saját e-mail-címed" value={e} onChange={(x) => setE(x.target.value)} /><button className="adm-ibtn sm">Hozzáadás</button></form>
    </div>
  );
}

