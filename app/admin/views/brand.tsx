"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { BarList, Empty, fmt, pct } from "../charts";
import { Logo } from "../wow";
import { toast } from "../phone";
import { MultiLine } from "../extra";
import { Band, Card, Kpi, Loading, MOCK, P, PF, Tbl, ago, api, big, n, rpc, type D, useRpc } from "../shared";

/* ---------- the brand: mentions on the web, what the AI assistants recommend, the competitors' social numbers ---------- */
const SRC: Record<string, string> = { reddit: "Reddit", hackernews: "Hacker News", news: "Hírek (Google News)", youtube: "YouTube", instagram: "Instagram #inkage", tiktok: "TikTok", pinterest: "Pinterest", linkedin: "LinkedIn", x: "X", threads: "Threads", web: "Web" };
/* every assistant the weekly round may ask; the ones without a key simply have no rows */
const MODEL: Record<string, string> = { claude: "Claude", chatgpt: "ChatGPT", perplexity: "Perplexity", gemini: "Gemini", google_ai: "Google MI-összefoglaló" };
/* the next Monday morning, when the weekly AI round runs */
const nextMonday = () => { const d = new Date(); d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7)); return d.toLocaleDateString("hu-HU", { month: "short", day: "numeric", weekday: "long" }); };

export function Brand() {
  const sb = useMemo(() => supabaseBrowser(), []);
  const { d, e, load } = useRpc("admin_brand", undefined, []);
  const [busy, setBusy] = useState(""); const [pf, setPf] = useState("instagram"); const [h, setH] = useState(""); const [openA, setOpenA] = useState<D | null>(null);
  useEffect(() => { if (d && n(d.unseen)) rpc(sb, "admin_brand_seen"); }, [d, sb]);
  if (e) return <div className="g"><div className="alert err s12">{e}</div></div>;
  if (!d) return <Loading />;
  const mentions: D[] = d.mentions || [], ai: D[] = d.ai || [], comps: D[] = d.competitors || [];
  const lastDay = ai.map((x) => x.day).sort().pop();
  const latest = ai.filter((x) => x.day === lastDay);
  const share = (rows: D[]) => (rows.length ? rows.filter((x) => x.mentioned).length / rows.length : 0);
  const days = Array.from(new Set(ai.map((x) => x.day))).sort();
  const rivals = Object.entries(latest.flatMap((x) => (x.competitors || []) as string[]).reduce((m: Record<string, number>, k) => { const kk = k.replace(/\*|\[|\]/g, "").trim(); m[kk] = (m[kk] || 0) + 1; return m; }, {})).map(([k, v]) => ({ k, n: v })).sort((a, b) => b.n - a.n);
  const run = async (only: string) => { setBusy(only); const r = MOCK ? { ok: true, json: {} } : await api(`/api/admin/sync?only=${only}`, { method: "POST" }); setBusy(""); toast(r.ok ? "Kész" : r.json?.error || "Nem sikerült"); load(); };
  const add = async (ev: React.FormEvent) => { ev.preventDefault(); if (!h.trim()) return; await rpc(sb, "admin_watch_set", { p_kind: "social", p_a: pf, p_b: h, p_on: true }); setH(""); toast("Figyelve: holnap reggeltől jönnek a számai"); load(); };
  const own: D[] = d.own || [], ownDays: D[] = d.own_days || [];
  const compPfs = Array.from(new Set(comps.map((c) => c.platform as string)));
  /* her own follower line for the same days as the competitors' (the whole stretch, not one point) */
  const ownSeries = (pf: string) => { const s = ownDays.filter((x) => x.platform === pf).map((x) => ({ t: x.day, v: n(x.followers) })); return s.length ? s : own.filter((o) => o.platform === pf).map((o) => ({ t: new Date().toISOString(), v: n(o.followers) })); };
  return (
    <div className="g">
      {/* never ran: "–", not a big 0% that reads like "no assistant recommends us" */}
      {!lastDay ? <section className="band s12"><div><span className="lbl">Ajánl-e minket az MI</span><div className="num"><b>–</b><small>még nem futott: az első kör {nextMonday()} reggel indul (MI-kulcs kell hozzá a Kapcsolatok oldalon), vagy indítsd most</small></div></div>
        <div className="side"><button className="adm-ibtn gold" onClick={() => run("aivis")} disabled={!!busy}>{busy === "aivis" ? "Kérdezem… (1–2 perc)" : "Kérdezz most"}</button></div></section>
      : <Band label="Ajánl-e minket az MI" value={Math.round(share(latest) * 100)} unit="%" sentence={lastDay ? <>A legutóbbi körben ({new Date(lastDay).toLocaleDateString("hu-HU", { month: "short", day: "numeric" })}) <b>{fmt(latest.length)}</b> kérdésből <b>{fmt(latest.filter((x) => x.mentioned).length)}</b> válaszban szerepelt az InkAge (a hasonló nevű más termékek nem számítanak). Hetente, hétfőn ugyanazokat a kérdéseket tesszük fel magyarul és angolul.</>
        : <>Az MI-láthatóság még egyszer sem futott. Az első kör {nextMonday()} reggel indul (MI-kulcs kell hozzá a Kapcsolatok oldalon), vagy indítsd most a gombbal.</>}
        side={<button className="adm-ibtn gold" onClick={() => run("aivis")} disabled={!!busy}>{busy === "aivis" ? "Kérdezem… (1–2 perc)" : "Kérdezz most"}</button>} />}
      <Kpi kind="api" to="@Említések a weben" tone="sky" className="s4" icon={P.globe} l="Említés a weben" v={fmt(mentions.length)} sub={`${fmt(mentions.filter((m) => Date.now() - new Date(m.at).getTime() < 7 * 864e5).length)} az elmúlt héten`} />
      <Kpi kind="own" to="@Az ajánlás aránya" tone="lilac" className="s4" icon={P.spark} l="MI-ajánlás aránya" v={latest.length ? pct(latest.filter((x) => x.mentioned).length, latest.length) : "–"} sub={latest.length ? Object.keys(MODEL).filter((m) => latest.some((x) => x.model === m)).map((m) => MODEL[m]).join(", ") : "még nem futott"} />
      <Kpi kind="own" to="@Versenytársak a közösségi" tone="peach" className="s4" icon={P.users} l="Figyelt versenytárs" v={fmt(comps.length)} sub={compPfs.length ? compPfs.map((p) => PF[p] || p).join(", ") : "még nincs"} />

      <Card className="s12" icon={P.spark} src="aivis" title="Mit válaszolnak az MI-asszisztensek" sub="A kérdés, ajánlott-e minket, hányadikként, és kiket ajánlott helyettünk. Kattints egy sorra a teljes válaszért. OpenAI- vagy Perplexity-kulccsal (Kapcsolatok) a ChatGPT és a Perplexity is bekerül.">
        {latest.length ? <Tbl name="mi-lathatosag" rows={latest} onRow={setOpenA} cols={[
          { k: "model", l: "MI", r: (r) => MODEL[r.model] || r.model }, { k: "question", l: "Kérdés", r: (r) => <span className="cellwrap">{r.question}</span> },
          { k: "mentioned", l: "Ajánl minket", r: (r) => (r.mentioned ? <span className="chip good">✓ {r.rank ? r.rank + ". helyen" : "igen"}</span> : <span className="chip">nem</span>) },
          { k: "competitors", l: "Kiket ajánl", r: (r) => <span className="mut cellwrap">{((r.competitors || []) as string[]).slice(0, 4).join(", ") || "–"}</span> },
        ]} /> : <Empty t="Az első kör hétfő reggel fut (MI-kulcs kell hozzá), vagy kérdezz most fent." icon={P.spark} />}
      </Card>
      <Card className="s6" icon={P.traffic} src="aivis" title="Az ajánlás aránya hétről hétre" sub="A válaszok hány %-ában szerepeltünk.">
        {days.length > 1 ? <MultiLine series={Object.keys(MODEL).filter((m) => ai.some((x) => x.model === m)).map((m) => ({ k: m, l: MODEL[m], pts: days.map((dd) => ({ t: dd, v: Math.round(share(ai.filter((x) => x.day === dd && x.model === m)) * 100) })) }))} height={200} />
          : <Empty t="Két kör után látszik az alakulás." />}
      </Card>
      <Card className="s6" icon={P.users} src="aivis" title="Kiket ajánl helyettünk" sub="A legutóbbi kör válaszaiban a legtöbbször említett appok és oldalak."><BarList items={rivals} max={8} accent empty="Még nincs adat." /></Card>

      <Card className="s12" icon={P.globe} src="mentions" title="Említések a weben" sub="Reddit, Hacker News, Google News, YouTube és az Instagram #inkage: ahol az inkage.app-t (vagy az InkAge-et tetoválással együtt) említik. Minden reggel; az újakról értesítés is jön."
        right={<button className="adm-ibtn sm" onClick={() => run("watch")} disabled={!!busy}>{busy === "watch" ? "Keresés…" : "Keresés most"}</button>}>
        {mentions.length ? <ul className="mentions">{mentions.map((m) => <li key={m.source + m.id} className={m.seen ? "" : "new"}><span className="chip">{SRC[m.source] || m.source}</span><div><a href={m.url} target="_blank" rel="noreferrer"><b>{m.title || "(cím nélkül)"}</b></a>{m.snippet && <span>{String(m.snippet).slice(0, 200)}</span>}<small>{m.author ? m.author + " · " : ""}{ago(m.at)}</small></div></li>)}</ul>
          : <Empty t="Még senki nem említett minket ezeken a helyeken." icon={P.globe} />}
      </Card>

      <Card className="s12" icon={P.users} src="competitors" title="Versenytársak a közösségi oldalakon" sub="Követők, posztok és a posztonkénti átlagos kedvelés, naponta, a te számaid mellett. Instagramon a Facebook-kapcsolaton át (Business Discovery), YouTube-on a csatornád bekötésével vagy egy YouTube API-kulccsal. TikTokon nincs hozzá nyilvános API."
        right={<form className="adm-row" style={{ gap: 6 }} onSubmit={add}><select className="adm-in sm" value={pf} onChange={(x) => setPf(x.target.value)}><option value="instagram">Instagram</option><option value="youtube">YouTube</option></select><input className="adm-in sm" placeholder="@felhasználónév" value={h} onChange={(x) => setH(x.target.value)} /><button className="adm-ibtn sm gold">Figyelés</button></form>}>
        {comps.length ? <>
          <Tbl name="versenytarsak-kozosseg" rows={comps.map((c) => { const l = (c.days as D[]).slice(-1)[0] || {}, w = (c.days as D[]).find((x) => new Date(l.day).getTime() - new Date(x.day).getTime() >= 7 * 864e5) || (c.days as D[])[0] || {}; return { ...c, l, w }; })} cols={[
            { k: "handle", l: "Fiók", r: (r) => <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}><Logo k={r.platform} size={22} /><b>{r.l.name || "@" + r.handle}</b><span className="mut">@{r.handle}</span></span> },
            { k: "f", l: "Követő", num: true, r: (r) => <b>{big(r.l.followers)}</b> }, { k: "g", l: "7 nap", num: true, r: (r) => (r.w.followers != null && r.l.followers != null ? <span className={n(r.l.followers) >= n(r.w.followers) ? "up" : "down"}>{n(r.l.followers) - n(r.w.followers) >= 0 ? "+" : ""}{fmt(n(r.l.followers) - n(r.w.followers))}</span> : "–") },
            { k: "p", l: "Poszt", num: true, r: (r) => fmt(r.l.posts) }, { k: "a", l: "Átl. kedvelés", num: true, r: (r) => (r.platform === "youtube" ? `${big(r.l.avg_likes)} néz./videó` : big(r.l.avg_likes)) },
            { k: "x", l: "", r: (r) => <button className="adm-ibtn sm" onClick={async () => { await rpc(sb, "admin_watch_set", { p_kind: "social", p_a: r.platform, p_b: r.handle, p_on: false }); load(); }}>Levesz</button> },
          ]} />
          {comps.some((c) => (c.days as D[]).length > 1) && <MultiLine series={[...comps.map((c) => ({ k: c.platform + c.handle, l: "@" + c.handle, color: undefined as string | undefined, pts: (c.days as D[]).map((x) => ({ t: x.day, v: n(x.followers) })) })),
            ...compPfs.map((pf) => ({ k: "own" + pf, l: `Te (${PF[pf]})`, color: "var(--a-gold)", pts: ownSeries(pf) })).filter((x) => x.pts.length)]} height={220} />}
        </> : <Empty t="Adj hozzá 3–5 versenytársat fent." icon={P.users} />}
      </Card>
      {openA && <div className="s12 c ai-full"><div className="c-h"><div><div><h2>{MODEL[openA.model]}: {openA.question}</h2></div></div><button className="adm-ibtn" onClick={() => setOpenA(null)}>Bezárás</button></div><div className="ai-t">{String(openA.answer || "").split("\n").map((l, i) => <p key={i}>{l}</p>)}</div></div>}
    </div>
  );
}
