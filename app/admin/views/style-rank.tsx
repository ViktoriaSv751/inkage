"use client";
/* "Melyik tetoválásstílus működik": every tattoo style's (or design's) stars next to what people really did with it, so
   weak ones can be cut later. No verdict from thin data: under 5 ratings a style is marked "kevés értékelés", and "Gyenge"
   needs at least 10 ratings with an average under 3. Data: admin_style_rank (the rows say which styles exist; nothing is
   listed in here), without her own accounts. */
import { useEffect, useMemo, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { fmt } from "../charts";
import { toast } from "../phone";
import { More } from "../extra";
import { LoadErr } from "./people";
import { CELEB, Card, P, Tbl, ago, bpDate, n, periodWords, rpc, styleName, type D, useBlockPeriod, useRpc } from "../shared";

const THIN = 5, WEAK_MIN = 10, WEAK_AVG = 3;
const avgOf = (r: D) => (r.avg == null ? null : Number(r.avg));
const stars = (v: number | null) => (v == null ? "–" : v.toLocaleString("hu-HU", { minimumFractionDigits: 1, maximumFractionDigits: 2 }));
const isThin = (r: D) => n(r.ratings) < THIN;
const isWeak = (r: D) => n(r.ratings) >= WEAK_MIN && (avgOf(r) ?? 5) < WEAK_AVG;
const Mark = ({ r }: { r: D }) => (isWeak(r) ? <span className="chip bad">Gyenge</span> : isThin(r) ? <span className="chip">kevés értékelés</span> : null);
const blank = (k: string): D => ({ k, made: 0, accounts: 0, avg: null, ratings: 0, high: 0, low: 0, favs: 0, saves: 0, repeats: 0, came_back: 0, last_at: null });

/* every style the data names (and every known one, also those nobody has used: that is an answer too): first those with
   enough ratings by their average, then the rest by how many previews were made */
function ranked(rows: D[]): D[] {
  const seen = new Map(rows.map((r) => [String(r.k), r]));
  const all = [...Object.keys(CELEB).map((k) => seen.get(k) || blank(k)), ...rows.filter((r) => !CELEB[String(r.k)])];
  return all.map((r): D => ({ ...r, style: CELEB[String(r.k)] || String(r.k) })).sort((a, b) => {
    const ta = isThin(a), tb = isThin(b);
    if (ta !== tb) return ta ? 1 : -1;
    if (!ta && avgOf(a) !== avgOf(b)) return (avgOf(b) ?? 0) - (avgOf(a) ?? 0);
    return n(b.made) - n(a.made) || String(a.style).localeCompare(String(b.style), "hu");
  });
}

/* a sample picture when the data gives one (img), otherwise the style's name in big type */
function Sample({ r }: { r: D }) {
  const name = String(r.style), [bad, setBad] = useState(false);
  if (!r.img || bad) return <span className="ix-sm-t">{name}</span>;
  return <span className="ink-sig ix-sm"><img src={String(r.img)} alt={`${name} minta`} onError={() => setBad(true)} /></span>;
}
const Stars = ({ r }: { r: D }) => <b className={"ix-st" + (isThin(r) ? " thin" : "")}>{n(r.ratings) ? `★ ${stars(avgOf(r))}` : "–"}</b>;

/* ---------- the podium: only tattoo styles with enough ratings for a verdict, by their average ---------- */
function Podium({ top, ratings, weak }: { top: D[]; ratings: number; weak: number }) {
  if (!top.length) return <div className="ix-pod-none">
    <div className="ix-pod" aria-hidden="true">{["p2", "p1", "p3"].map((x) => <div key={x} className={"ix-pd " + x}><span className="ix-plinth empty" /></div>)}</div>
    <b className="ink-h">Még üres a dobogó</b>
    <p>{weak ? "Amelyik tetoválásstílusnak elég értékelése van, az gyenge, ezért nem került ide." : ratings ? `${fmt(ratings)} értékelés érkezett, de egyik tetoválásstílusnak sincs még ${THIN}.` : `Egy tetoválásstílus ${THIN} értékelés után kerülhet ide.`}</p>
  </div>;
  const place = [top[1], top[0], top[2]], cls = ["p2", "p1", "p3"], rank = [2, 1, 3];
  return <div className="ix-pod">{place.map((r, i) => r ? <div key={String(r.k)} className={"ix-pd " + cls[i]}>
    <div className={"ix-pd-c" + (rank[i] === 1 ? " ink-flip" : "")}><Sample r={r} /><Stars r={r} /><span className="ix-pd-n">{String(r.style)}</span><small>{fmt(n(r.ratings))} értékelés</small></div>
    <span className="ix-plinth"><b>{rank[i]}</b></span>
  </div> : <div key={cls[i]} className={"ix-pd " + cls[i]}><span className="ix-plinth empty" /></div>)}</div>;
}

/* ---------- the weak styles apart. Nothing in the app can switch a style off, so the mark is a line in the Napló (admin_notes): it says so,
   and the style stays available until the code is changed ---------- */
const RETIRE = "Kivezetésre jelölve: ";
function WeakRow({ rows }: { rows: D[] }) {
  const sb = useMemo(() => supabaseBrowser(), []);
  const [notes, setNotes] = useState<D[] | null>(null); const [busy, setBusy] = useState("");
  useEffect(() => { rpc(sb, "admin_notes_list", {}).then(({ data }) => setNotes(Array.isArray(data) ? data : [])); }, [sb]);
  const noteOf = (name: string) => (notes || []).find((x) => String(x.text).startsWith(RETIRE + name + " ("));
  const mark = async (r: D) => { const name = String(r.style); setBusy(name); const text = `${RETIRE}${name} (★ ${stars(avgOf(r))}, ${fmt(n(r.ratings))} értékelés)`, { error } = await rpc(sb, "admin_note_save", { p_day: bpDate(), p_kind: "egyeb", p_text: text }); setBusy(""); if (error) { toast("Nem sikerült: " + error.message); return; } const fresh = await rpc(sb, "admin_notes_list", {}), list: D[] = Array.isArray(fresh.data) ? fresh.data : []; setNotes(list.some((x) => x.text === text) ? list : [{ id: -Date.now(), text }, ...list]); toast("Bekerült a Naplóba. A tetoválásstílus még elérhető marad."); };
  const undo = async (name: string) => { const x = noteOf(name); if (!x) return; setBusy(name); const { error } = await rpc(sb, "admin_note_delete", { p_id: x.id }); setBusy(""); if (error) { toast("Nem sikerült: " + error.message); return; } setNotes((o) => (o || []).filter((y) => y !== x)); toast("Jelölés visszavonva"); };
  if (!rows.length) return <p className="note ix-weak-0">Nincs gyenge tetoválásstílus: ehhez legalább {WEAK_MIN} értékelés és {WEAK_AVG} alatti átlag kell.</p>;
  return <section className="ix-weak" aria-label="Gyenge tetoválásstílusok">
    <h3 className="ink-h">Gyenge tetoválásstílusok</h3>
    <div className="ix-swipe">{rows.map((r) => { const name = String(r.style), on = !!noteOf(name); return <article key={String(r.k)} className={"ix-sc ix-wk" + (on ? " on" : "")}><Sample r={r} /><Stars r={r} /><span className="ix-pd-n">{name}</span><small>{fmt(n(r.ratings))} értékelés · {fmt(n(r.made))} készült</small>
      {on ? <><span className="chip">✓ Kivezetésre jelölve</span><button type="button" className="adm-ibtn sm" disabled={!!busy} onClick={() => undo(name)}>Visszavonás</button></> : <button type="button" className="adm-ibtn sm gold" disabled={!!busy || !notes} onClick={() => mark(r)}>Kivezetésre jelölöm</button>}</article>; })}</div>
    <p className="ix-honest">A jelölés a Naplóba kerül. A tetoválásstílus nem tűnik el az appból: a kivezetéshez a kódot kell módosítani.</p>
  </section>;
}

export function StyleRank() {
  const bp = useBlockPeriod();
  const { d: X, e, load, busy } = useRpc("admin_style_rank", bp.args, [bp.args.p_days, bp.args.p_from, bp.args.p_to]);
  const rows = ranked(((X?.rows || []) as D[]));
  const drawn = (X?.drawn || []) as D[];
  const [all, setAll] = useState(false), moreBtn = useRef<HTMLButtonElement>(null);
  /* closing the long grid takes hundreds of points off the page: the button stays where the finger is */
  const toggle = () => { const b = moreBtn.current, y = b?.getBoundingClientRect().top; setAll(!all); if (!all || y == null) return; requestAnimationFrame(() => { const now = moreBtn.current?.getBoundingClientRect().top; if (now != null) scrollBy({ top: now - y, behavior: "instant" as ScrollBehavior }); }); };
  /* a weak style never stands on the podium: an empty place says more */
  const top = rows.filter((r) => !isThin(r) && avgOf(r) != null && !isWeak(r)).slice(0, 3), weak = rows.filter(isWeak), rest = rows.filter((r) => !top.includes(r) && !weak.includes(r)), SHOW = 12;
  return (
    <Card className="s12 ix-styles" icon={P.spark} title="Melyik tetoválásstílus működik" right={bp.ctl} sub={`Tetoválásstílusonként (mintánként) ${periodWords(bp.p)}, a saját fiókjaid nélkül. „Kevés értékelés”: 5 alatt nincs ítélet. „Gyenge”: legalább 10 értékelés és 3 alatti átlag. Készült: elkészült előnézet. Újra: hány fiók kért ugyanarra a stílusra többször előnézetet. Visszajött: hány fiók készített később, egy másik napon is előnézetet. Mentés: képmentések, amelyekhez a stílus ismert.`}>
      {e && !X ? <LoadErr e={e} retry={load} busy={busy} /> : !X ? <div className="skel" style={{ height: 200 }} /> : <>
        <Podium top={top} ratings={n(X.ratings)} weak={weak.length} />
        <p className="note" style={{ margin: "14px 0" }}>{n(X.ratings) ? `${fmt(n(X.ratings))} értékelés ${fmt(n(X.rated_accounts))} fióktól.` : "Még nincs értékelés: a kedvencek, az ismétlések és a visszatérések már valós adatok."}</p>
        <WeakRow rows={weak} />
        <div className="ix-sgrid">{(all ? rest : rest.slice(0, SHOW)).map((r) => <article key={String(r.k)} className="ix-sc"><Sample r={r} /><Stars r={r} /><span className="ix-pd-n">{String(r.style)}</span><small>{fmt(n(r.ratings))} értékelés · {fmt(n(r.made))} készült</small>{n(r.ratings) > 0 && <Mark r={r} />}</article>)}</div>
        {rest.length > SHOW && <button type="button" ref={moreBtn} className="adm-ibtn ix-more" onClick={toggle}>{all ? "Kevesebb" : `Mind a ${fmt(rest.length)} tetoválásstílus`}</button>}
        <More label="Minden szám táblázatban">
        <Tbl name="stilusok" limit={10} rows={rows} cols={[
          { k: "style", l: "Tetoválásstílus", ph: "name", r: (r) => <>{String(r.style)} <Mark r={r} /></> },
          { k: "avg", l: "Átlag", num: true, ph: "main", r: (r) => <span style={isThin(r) ? { color: "var(--a-dim)" } : undefined}>{n(r.ratings) ? `★ ${stars(avgOf(r))}` : "–"}</span> },
          { k: "ratings", l: "Értékelés", num: true, ph: "sub" },
          { k: "high", l: "4-5 csillag", num: true },
          { k: "low", l: "1-2 csillag", num: true },
          { k: "made", l: "Készült", num: true, ph: "sub" },
          { k: "accounts", l: "Fiók", num: true },
          { k: "favs", l: "Kedvenc", num: true },
          { k: "saves", l: "Mentés", num: true },
          { k: "repeats", l: "Újra", num: true },
          { k: "came_back", l: "Visszajött", num: true },
          { k: "last_at", l: "Utoljára", r: (r) => (r.last_at ? ago(String(r.last_at)) : "–") },
        ]} />
        </More>
        {drawn.length > 0 && <p className="note" style={{ margin: "10px 0 0" }}>Saját minták (nem stílusok): {drawn.map((x) => `${styleName(x.k)} ★ ${stars(Number(x.avg_stars))} (${fmt(n(x.ratings))})`).join(" · ")}</p>}
      </>}
    </Card>
  );
}

/* one line on an account's page: the stars this person gave */
export function UserRatings({ id }: { id: string }) {
  const { d } = useRpc("admin_user_ratings", { p_user: id }, [id]);
  const list = (Array.isArray(d) ? d : []) as unknown as D[];
  if (!list.length) return null;
  return <li style={{ padding: "9px 0 9px 36px", fontSize: 14, lineHeight: 1.45, borderBottom: "1px solid var(--a-line)" }}>Értékelt: {list.map((x) => `${CELEB[x.style] || styleName(x.style)} ★${x.stars}`).join(", ")}</li>;
}
