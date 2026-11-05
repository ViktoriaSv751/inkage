"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
/* Közlemények: a banner at the top of the app (app/app/_ui/AnnouncementBanner.tsx) — a new language, a fix, maintenance on
   Sunday. Switched on and off here, timed, for one language or every language, for the web, the store apps or both.
   Nothing is measured about who saw it; a closed banner is remembered only in that browser.
   The page is a list grouped by status; writing happens in one focused sheet, with the banner as the app will show it. */
import { useEffect, useMemo, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { CloseX, Sheet, phoneNow, toast, usePhone } from "../phone";
import { reverify } from "../lock";
import { Async, I, LANGS, Layer, P, dt, lang, rpc, type D, useRpc } from "../shared";
import { Info } from "../charts";
import { Hero } from "../ink";

const KIND: Record<string, string> = { info: "Információ", good: "Jó hír", warn: "Figyelmeztetés" };
const PLAT: Record<string, string> = { all: "Mindenhol", web: "Csak a weboldalon", app: "Csak az appokban", android: "Csak Androidon", ios: "Csak iPhone-on" };
const local = (t?: string | null) => (t ? new Date(new Date(t).getTime() - new Date(t).getTimezoneOffset() * 60e3).toISOString().slice(0, 16) : "");
const EMPTY: D = { title: "", body: "", kind: "info", lang: "", platform: "all", starts_at: "", ends_at: "", link: "", on_: true };

/* the four states she thinks in, from the same facts the app's own check uses */
type St = "run" | "sched" | "draft" | "ended";
/* off: a draft or one that ran and was switched off; the data cannot tell them apart, so the name fits both */
const ST_L: Record<St, string> = { run: "Látszik most", sched: "Időzítve", draft: "Kikapcsolva", ended: "Lejárt" };
/* filled: people see it; outline: it will come; dashed: nobody sees it; plain text: over */
const PILL: Record<St, string> = { run: "Látszik", sched: "Időzítve", draft: "Kikapcsolva", ended: "Lejárt" };
const statusOf = (a: D): St => (a.live ? "run" : !a.on_ ? "draft" : a.ends_at && new Date(a.ends_at) < new Date() ? "ended" : "sched");
const where = (a: D) => `${a.lang ? lang(a.lang) : "minden nyelv"} · ${PLAT[a.platform] || a.platform}${a.starts_at ? ` · ${dt(a.starts_at)}-tól` : ""}${a.ends_at ? ` · ${dt(a.ends_at)}-ig` : ""}`;

const stamp = (t: string) => new Date(t).toLocaleString("hu-HU", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
/* what switching it on really does: it may wait for its start, or its end may be over already */
const goneLive = (a: D) => (a.ends_at && new Date(a.ends_at) < new Date() ? `Bekapcsolva, de lejárt: ${stamp(a.ends_at)}` : a.starts_at && new Date(a.starts_at) > new Date() ? `Időzítve: ${stamp(a.starts_at)}` : null);
const askLive = (a: D) => `„${a.title}”\n\n${a.starts_at && new Date(a.starts_at) > new Date() ? `Megjelenik: ${stamp(a.starts_at)}` : "Azonnal megjelenik"} · ${a.lang ? lang(a.lang) : "minden nyelv"} · ${PLAT[a.platform] || a.platform}\n\nKözzéteszed az appban?`;

export function Announce() {
  const sb = useMemo(() => supabaseBrowser(), []);
  const q = useRpc("admin_announce_list", undefined, []);
  const [f, setF] = useState<D | null>(null); const [busy, setBusy] = useState(false);
  const save = async (on_: boolean) => {
    if (!f) return;
    const next = { ...f, on_ };
    /* on a phone it is easy to tap: said first, who sees it and when. It shows in the live app at once */
    if (phoneNow() && on_ && !confirm(askLive(f))) return;
    setBusy(true);
    const p = { ...next, starts_at: f.starts_at ? new Date(f.starts_at).toISOString() : null, ends_at: f.ends_at ? new Date(f.ends_at).toISOString() : null };
    const { error } = await rpc(sb, "admin_announce_save", { p });
    setBusy(false);
    if (error) { toast(error.message); return; }
    toast(!on_ ? "Piszkozat mentve" : goneLive(f) || (f.id ? "Közlemény mentve" : "Közlemény kint van")); setF(null); q.load();
  };
  const toggle = async (a: D) => { if (phoneNow() && !a.on_ && !confirm(askLive(a))) return; const { error } = await rpc(sb, "admin_announce_save", { p: { ...a, on_: !a.on_ } }); if (error) toast("Nem sikerült: " + error.message); else { toast(a.on_ ? "Kikapcsolva" : goneLive(a) || "Bekapcsolva"); q.load(); } };
  const del = async (a: D) => { if (!confirm(`Törlöd a közleményt? „${a.title}”`)) return; if (!(await reverify())) return; const { error } = await rpc(sb, "admin_announce_delete", { p_id: a.id }); if (error) toast(error.message); else { toast("Törölve"); setF(null); q.load(); } };
  const rows: D[] = Array.isArray(q.d) ? q.d : [];
  const open = (a: D) => setF({ ...a, starts_at: local(a.starts_at), ends_at: local(a.ends_at), lang: a.lang || "", link: a.link || "", body: a.body || "" });
  const groups: St[] = ["run", "sched", "draft", "ended"];
  const live = rows.filter((a) => a.live), star = live[0];
  return (
    <div className="io ann">
      <Hero label={<>Látszik most<Info>A közlemény azonnal megjelenik az appban: a weboldalon és a két áruházi appban is, mert azok az inkage.app/app élő oldalát mutatják. Egyszerre egy látszik (a legújabb). Új adatot nem gyűjt: hogy valaki bezárta, csak az ő eszköze jegyzi meg.</Info></>} v={live.length} sub={`${rows.length} összesen`} side={<button className="adm-ibtn gold" onClick={() => setF(EMPTY)}>{I(P.plus)}Új közlemény</button>} />
      <Async q={q} h={160}>{() => !rows.length ? <div className="io-card io-empty"><b className="io-card-t">Még nem volt közlemény</b></div> : <>
        {/* the one people see now, big, inside a phone */}
        {star && <section className="io-card ink-flip io-ann-star">
          <div className="io-ann-star-t">
            <small className="io-card-m"><span>{KIND[star.kind] || star.kind}</span><span className="io-st run">{PILL.run}</span></small>
            <b className="io-card-t">{star.title}</b>
            {star.body && <p className="io-card-s">{star.body}</p>}
            <small className="io-card-s">{where(star)}</small>
            <div className="io-card-a"><button className="adm-ibtn gold" onClick={() => open(star)}>Szerkesztés</button><button className="adm-ibtn" onClick={() => toggle(star)}>Kikapcsolás</button></div>
          </div>
          <Phone f={star} />
        </section>}
        {groups.map((g) => { const l = rows.filter((a) => statusOf(a) === g && a !== star); return !l.length ? null : (
          <section key={g} className="io-sec"><h3 className="ink-h">{ST_L[g]}</h3>
            <ul className="io-rows">{l.map((a) => (
              <li key={a.id} className="io-row">
                <button className="io-t io-open" onClick={() => open(a)}>
                  <span className={"io-st " + g}>{PILL[g]}</span>
                  <b>{a.title}</b>
                  <small>{a.body ? a.body + " · " : ""}{KIND[a.kind] || a.kind} · {where(a)}</small>
                </button>
                <button className={"sw" + (a.on_ ? " on" : "")} role="switch" aria-checked={!!a.on_} aria-label={(a.on_ ? "Kikapcsolás: " : "Bekapcsolás: ") + a.title} title={a.on_ ? "Kikapcsolás" : "Bekapcsolás"} onClick={() => toggle(a)}><i /></button>
              </li>))}</ul>
          </section>); })}
      </>}</Async>
      {f && <Compose f={f} set={setF} busy={busy} save={save} del={del} close={() => setF(null)} />}
    </div>
  );
}

/* the banner the way the app draws it, in a phone: same words, same order, the close mark in its corner */
function Phone({ f }: { f: D }) {
  return (
    <div className="io-phone" aria-label="Így látja a felhasználó">
      <span className="io-phone-notch" aria-hidden="true" />
      <div className={"io-phone-ban k-" + (f.kind || "info")}><div><b>{f.title || "A közlemény címe"}</b>{f.body && <span>{f.body}</span>}{f.link && <small className="ann-pv-l">Koppintva megnyílik: {f.link}</small>}</div><em aria-hidden="true">×</em></div>
      <i aria-hidden="true">InkAge</i>
    </div>
  );
}
/* the app edges the banner by type (app/app/app.css .ann-good / .ann-warn); here the shades of grey stand for it */
const TINT: Record<string, string> = { info: "szürke keretes", good: "zöld keretes", warn: "sárga keretes" };
function Preview({ f }: { f: D }) {
  return <div className="ann-pv"><small>Előnézet: így látszik az app tetején. Az appban a sáv {TINT[f.kind] || TINT.info}.</small><Phone f={f} /></div>;
}

function Compose({ f, set, busy, save, del, close }: { f: D; set: (x: D) => void; busy: boolean; save: (on: boolean) => void; del: (a: D) => void; close: () => void }) {
  const phone = usePhone();
  /* whatever closes the form asks first when there is unsaved text: Esc, the backdrop, the X, pulling the sheet down */
  const start = useRef(JSON.stringify(f));
  const leave = () => { if (JSON.stringify(f) !== start.current && !confirm("A változásokat nem mentetted. Elveted?")) return; close(); };
  useEffect(() => { if (phone) return; /* the phone's sheet listens to Esc itself */ const k = (e: KeyboardEvent) => { if (e.key === "Escape") leave(); }; addEventListener("keydown", k); return () => removeEventListener("keydown", k); });
  const ready = !busy && !!String(f.title || "").trim();
  const title = f.id ? "Közlemény szerkesztése" : "Új közlemény";
  const body = (
    <div className="ann-form">
      <Preview f={f} />
      <label className="ann-field"><span>Cím<small>{String(f.title || "").length}/120</small></span>
        <input className="adm-in" maxLength={120} placeholder="pl. Új: hat új nyelv" value={f.title} onChange={(e) => set({ ...f, title: e.target.value })} /></label>
      <label className="ann-field"><span>Szöveg<small>nem kötelező · {String(f.body || "").length}/500</small></span>
        <textarea className="adm-in" rows={3} maxLength={500} value={f.body} onChange={(e) => set({ ...f, body: e.target.value })} /></label>
      <div className="ann-field"><span>Típus</span>
        <div className="adm-seg">{Object.entries(KIND).map(([k, l]) => <button type="button" key={k} aria-pressed={f.kind === k} onClick={() => set({ ...f, kind: k })}>{l}</button>)}</div></div>
      <div className="ann-2">
        <label className="ann-field"><span>Nyelv</span>
          <select className="adm-in" value={f.lang || ""} onChange={(e) => set({ ...f, lang: e.target.value })}><option value="">Minden nyelv</option>{Object.keys(LANGS).filter((k) => k !== "?" && k !== "nb").map((k) => <option key={k} value={k}>{LANGS[k]}</option>)}</select></label>
        <label className="ann-field"><span>Hol</span>
          <select className="adm-in" value={f.platform} onChange={(e) => set({ ...f, platform: e.target.value })}>{Object.entries(PLAT).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
      </div>
      <div className="ann-2 ann-when">
        <label className="ann-field"><span>Kezdete</span><input type="datetime-local" className="adm-in" value={f.starts_at || ""} onChange={(e) => set({ ...f, starts_at: e.target.value })} /></label>
        <label className="ann-field"><span>Vége</span><input type="datetime-local" className="adm-in" value={f.ends_at || ""} onChange={(e) => set({ ...f, ends_at: e.target.value })} /></label>
      </div>
      <label className="ann-field"><span>Link<small>nem kötelező</small></span>
        <input className="adm-in" type="url" inputMode="url" autoCapitalize="off" placeholder="pl. /tudastar/… vagy https://…" value={f.link || ""} onChange={(e) => set({ ...f, link: e.target.value })} /></label>
    </div>
  );
  const foot = (
    <div className="ann-foot">
      {f.id && <button className="adm-ibtn ann-del" onClick={() => del(f)}>Törlés</button>}
      <button className="adm-ibtn" disabled={!ready} onClick={() => save(false)}>Piszkozat</button>
      <button className="adm-ibtn gold" disabled={!ready} onClick={() => save(true)}>{f.id ? "Mentés" : "Közzététel"}</button>
    </div>
  );
  if (phone) return <Sheet title={title} close={leave} tall foot={foot}>{body}</Sheet>;
  return (
    <Layer>
      <div className="scrim" onClick={leave} />
      <div className="drawer ann-desk" role="dialog" aria-label={title}>
        <div className="c-h"><div><h2>{title}</h2></div><CloseX close={leave} /></div>
        {body}
        {foot}
      </div>
    </Layer>
  );
}
