"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
/* Visszajelzések: every rating in one place. The App Store and Google Play reviews, the stars people give their
   previews in the app (1–5, by tattoo style), and the reasons they marked on "Nem lett jó?" when they asked for a new
   preview. Replying to store reviews stays on Postafiók. */
import { useState } from "react";
import { Empty, Info, fmt } from "../charts";
import { Hero } from "../ink";
import { Logo } from "../wow";
import { Card, LANGS, P, PROV, n, styleName, type D, useRpc } from "../shared";
import { REDO } from "./inkage";

const STORE: Record<string, string> = { apple: "App Store", google: "Google Play" };
/* the app's "Nem lett jó?" reasons; a wish for the next one is shown only when the data carries it */
const WHY: Record<string, string> = { ...REDO, none: "Nem jelölt okot" };
const TUNE: Record<string, string> = { none: "Nem kért változást" };
/* the period: a preset, one day (Ma, Tegnap) or a range she picks; days are Budapest days */
type Per = { k: string; days?: number; from?: string; to?: string };
const bpDay = (off = 0) => new Date(Date.now() + off * 864e5).toLocaleDateString("sv-SE", { timeZone: "Europe/Budapest" });
const PRESETS: { k: string; l: string; p: () => Per }[] = [
  { k: "today", l: "Ma", p: () => ({ k: "today", from: bpDay(), to: bpDay() }) },
  { k: "yday", l: "Tegnap", p: () => ({ k: "yday", from: bpDay(-1), to: bpDay(-1) }) },
  { k: "7", l: "7 nap", p: () => ({ k: "7", days: 7 }) }, { k: "30", l: "30 nap", p: () => ({ k: "30", days: 30 }) },
  { k: "90", l: "90 nap", p: () => ({ k: "90", days: 90 }) }, { k: "all", l: "Összes", p: () => ({ k: "all", days: 0 }) },
];
const dayTxt = (d?: string) => (d ? new Date(d + "T12:00:00Z").toLocaleDateString("hu-HU", { year: "numeric", month: "short", day: "numeric", weekday: "short" }) : "");
const perTxt = (p: Per) => (p.from ? (p.from === p.to || !p.to ? dayTxt(p.from) : `${dayTxt(p.from)} – ${dayTxt(p.to)}`) : p.days ? `${p.days} nap` : "összes");
/* the exact moment, to the second, on Budapest time */
const at = (t?: string | null) => (t ? new Date(t).toLocaleString("hu-HU", { timeZone: "Europe/Budapest", year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "–");
const FILTERS: [string, string][] = [["all", "Mind"], ["app", "Appban"], ["apple", "App Store"], ["google", "Google Play"]];
const stars = (k: number) => "★".repeat(Math.max(0, Math.min(5, k))) + "☆".repeat(Math.max(0, 5 - Math.max(0, Math.min(5, k))));
const avgTxt = (x: unknown) => (x == null ? "–" : fmt(Number(x), 2).replace(".", ","));
const look = (r: D) => styleName(r.style);

/* five bars: how many 1, 2, 3, 4 and 5 star ratings */
function Dist({ d, total }: { d: D | null | undefined; total: number }) {
  const max = Math.max(1, ...[1, 2, 3, 4, 5].map((g) => n(d?.[g])));
  return (
    <div className="fb-dist">
      {[5, 4, 3, 2, 1].map((g) => { const v = n(d?.[g]); return (
        <div key={g} className="fb-dist-r"><span className="fb-dist-k">{g} ★</span><span className="fb-dist-bar"><i style={{ width: `${(v / max) * 100}%` }} className={g <= 2 ? "low" : g >= 4 ? "high" : ""} /></span><span className="fb-dist-v">{fmt(v)}{total ? <small> · {fmt((v / total) * 100, 0)}%</small> : null}</span></div>); })}
    </div>
  );
}

export function Feedback() {
  const [per, setPer] = useState<Per>({ k: "30", days: 30 });
  const [custom, setCustom] = useState(false);
  const [flt, setFlt] = useState("all");
  const args = per.from ? { p_days: null, p_from: per.from, p_to: per.to || per.from } : { p_days: per.days ?? 30 };
  const q = useRpc("admin_feedback", args, [per.k, per.days, per.from, per.to]);
  const d = q.d as D | null;

  if (q.e && !d) return <Card className="s12" title="Visszajelzések"><Empty t={q.e} /><button className="btn" onClick={q.load}>Újra</button></Card>;
  if (!d) return <div className="skel" style={{ height: 320 }} aria-busy="true" />;

  const stores: D[] = d.stores || [], all = d.all || {}, app = d.app || {};
  /* one list, newest first: the store reviews and the in-app ratings together */
  const items: D[] = [
    ...((d.reviews || []) as D[]).map((r) => ({ src: r.store, at: r.created_at, stars: n(r.rating), r })),
    ...((d.ratings || []) as D[]).map((r) => ({ src: "app", at: r.at, stars: n(r.stars), r })),
  ].filter((x) => flt === "all" || x.src === flt).sort((a, b) => String(b.at).localeCompare(String(a.at)));
  const low = items.filter((x) => x.stars && x.stars <= 2).length;

  return (
    <>
      <div className="s12 acc-pick" role="tablist" aria-label="Időszak">
        {PRESETS.map((x) => <button key={x.k} role="tab" aria-selected={!custom && per.k === x.k} onClick={() => { setCustom(false); setPer(x.p()); }}>{x.l}</button>)}
        <button role="tab" aria-selected={custom} onClick={() => { setCustom(true); if (!per.from) setPer({ k: "custom", from: bpDay(-6), to: bpDay() }); else setPer({ ...per, k: "custom" }); }}>Egyéni időszak</button>
      </div>
      {custom && <div className="s12 fb-range">
        <label><span>Ettől</span><input className="adm-in" type="date" max={bpDay()} value={per.from || ""} onChange={(e) => e.target.value && setPer({ k: "custom", from: e.target.value, to: per.to && per.to >= e.target.value ? per.to : e.target.value })} /></label>
        <label><span>Eddig</span><input className="adm-in" type="date" max={bpDay()} min={per.from} value={per.to || ""} onChange={(e) => e.target.value && setPer({ k: "custom", from: per.from && per.from <= e.target.value ? per.from : e.target.value, to: e.target.value })} /></label>
        <small className="mut">Egy naphoz ugyanazt a napot add meg mindkettőnek. Budapesti idő szerint, éjféltől éjfélig.</small>
      </div>}

      <div className="s12"><Hero flip label={<>Átlagos értékelés · {perTxt(per)}<Info>Az App Store, a Google Play és az appon belüli csillagok együtt (1–5). Az appban egy ember egy előnézetét egyszer értékeli; ha később átállítja, az új értéke számít. A saját és tesztfiókjaid nincsenek benne.</Info></>}
        text={all.avg == null ? "–" : avgTxt(all.avg) + " ★"} sub={`${fmt(n(all.n))} értékelés · ${fmt(n(app.n))} az appban · ${fmt(stores.reduce((s, x) => s + n(x.n), 0))} az áruházakban`} /></div>

      <Card className="s6" icon={P.spark} title="Minden értékelés csillagonként"><Dist d={all.dist} total={n(all.n)} /></Card>

      <Card className="s6" icon={P.layers} title="Hol értékeltek">
        <div className="fb-src">
          <div className="fb-src-r"><span className="fb-src-n"><span className="fb-ic">★</span><b>Az appban</b><small>{fmt(n(app.people))} ember, {fmt(n(app.n))} előnézet</small></span><span className="fb-src-v"><b>{avgTxt(app.avg)} ★</b></span></div>
          {stores.map((s) => (
            <div key={s.store} className="fb-src-r"><span className="fb-src-n"><Logo k={s.store === "apple" ? "apple" : "play"} size={18} /><b>{STORE[s.store] || s.store}</b><small>{n(s.n) ? `${fmt(n(s.n))} vélemény${n(s.open) ? ` · ${fmt(n(s.open))} válaszra vár` : ""} · utolsó: ${at(s.last_at)}` : "ebben az időszakban nincs vélemény"}</small></span><span className="fb-src-v"><b>{avgTxt(s.avg)} ★</b></span></div>
          ))}
        </div>
        <p className="note">Az áruházi véleményekre a <a href="#inbox">Postafiók</a> oldalon tudsz válaszolni.</p>
      </Card>

      <Card className="s12" icon={P.product} title="Tetoválásstílusonként az appban" sub="Melyik tetoválásstílus előnézetét hányan értékelték, és milyen átlaggal. Gyenge: 1–2 csillag, jó: 4–5 csillag. Koppints az „Időpontok” gombra: minden értékelés pontos ideje, másodpercre, budapesti idő szerint.">
        {(d.styles || []).length ? <div className="fb-styles">{(d.styles as D[]).map((s) => (
          <StyleCard key={s.kind + s.style} s={s} />
        ))}</div> : <Empty t="Ebben az időszakban nem értékeltek előnézetet az appban." />}
      </Card>

      <Card className="s12" icon={P.pen} title="Mi nem tetszett, amikor újat kértek" sub="Ha valaki a „Nem lett jó?” gombbal új előnézetet kér, az app megkérdezi, mi nem tetszett (egy kérésnél több ok is lehet). Itt a válaszok száma.">
        {n(d.why_n) ? <div className="fb-two">
          <div><h3 className="acc-h">Mi nem tetszett</h3>{((d.why || []) as D[]).map((w) => <div key={w.k} className="fb-kv"><span>{WHY[w.k] || w.k}</span><b>{fmt(n(w.n))}</b></div>)}</div>
          {((d.tune || []) as D[]).length > 0 && <div><h3 className="acc-h">Milyen legyen a következő</h3>{(d.tune as D[]).map((w) => <div key={w.k} className="fb-kv"><span>{TUNE[w.k] || w.k}</span><b>{fmt(n(w.n))}</b></div>)}</div>}
        </div> : <Empty t="Ebben az időszakban senki nem kért új előnézetet." />}
      </Card>

      <Card className="s12" icon={P.mail} title="Az összes visszajelzés" sub="Az áruházi vélemények és az appon belüli csillagok egy listában, a legújabb elöl.">
        <div className="acc-pick" role="tablist" aria-label="Forrás">
          {FILTERS.map(([k, l]) => <button key={k} role="tab" aria-selected={flt === k} onClick={() => setFlt(k)}>{l}</button>)}
          <span className="mut" style={{ alignSelf: "center", fontSize: 13, whiteSpace: "nowrap" }}>{fmt(items.length)} db{low ? ` · ${fmt(low)} gyenge` : ""}</span>
        </div>
        {items.length ? <div className="fb-list">{items.slice(0, 200).map((x, i) => (
          <div key={i} className={"fb-item" + (x.stars && x.stars <= 2 ? " low" : "")}>
            <div className="fb-item-h"><span className="fb-stars">{stars(x.stars)}</span><span className="chip">{x.src === "app" ? "Appban" : STORE[x.src] || x.src}</span><small className="mut">{at(x.at)}</small></div>
            {x.src === "app" ? <div className="fb-item-b"><b>{look(x.r)}</b><small className="mut"> · {x.r.kind === "drawn" ? "saját minta" : "tetoválásstílus"}{x.r.lang ? " · " + (LANGS[String(x.r.lang).slice(0, 2)] || x.r.lang) : ""}{x.r.provider ? " · " + (PROV[x.r.provider] || x.r.provider) : ""}</small>{x.r.first && x.r.first !== x.r.at && <small className="mut"><br />Először értékelte: {at(x.r.first)}, később átállította</small>}</div>
              : <div className="fb-item-b">{x.r.title && <b>{x.r.title}</b>}{x.r.body && <p>{x.r.body}</p>}<small className="mut">{[x.r.author, x.r.territory, x.r.lang, x.r.version && "v" + x.r.version].filter(Boolean).join(" · ")}</small>{x.r.reply ? <p className="fb-reply">Válaszod{x.r.replied_at ? ` (${at(x.r.replied_at)})` : ""}: {x.r.reply}</p> : <a className="lnk" href="#inbox">Válasz a Postafiókban →</a>}</div>}
          </div>))}</div> : <Empty t={flt === "apple" || flt === "google" ? "Ebben az időszakban nem jött vélemény ebből az áruházból." : "Ebben az időszakban nem jött visszajelzés."} />}
      </Card>
    </>
  );
}

/* one style: its average, and when each of its ratings came, to the second */
function StyleCard({ s }: { s: D }) {
  const [open, setOpen] = useState(false);
  const list: D[] = s.list || [];
  return (
    <div className="fb-style">
      <b>{look(s)}</b><span className="fb-stars">{stars(Math.round(n(s.avg)))}</span><span>{avgTxt(s.avg)} · {fmt(n(s.n))} értékelés</span>
      <small className="mut">{fmt(n(s.high))} jó · {fmt(n(s.low))} gyenge</small>
      <small className="mut">Utolsó: {at(s.last_at)}</small>
      {list.length > 0 && <button className="lnk fb-more" onClick={() => setOpen(!open)}>{open ? "Bezárás" : `Időpontok (${list.length})`}</button>}
      {open && <div className="fb-times">{list.map((r, i) => <div key={i}><span className="fb-stars">{stars(n(r.stars))}</span><span>{at(r.at)}</span>{r.first && r.first !== r.at && <small className="mut">először: {at(r.first)}</small>}</div>)}</div>}
    </div>
  );
}
