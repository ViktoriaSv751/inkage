"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
/* Közlemények — NOT LIVE YET: the app does not read public_announcements, so nothing written here is shown to anyone.
   The page says so at the top (and the menu marks it "nem működik még") until the banner is built into the app.
   Planned: a banner at the top of the app (and the website's app pages) — a new language, a fix, maintenance on
   Sunday. Switched on and off here, timed, for one language or every language, for the web, the store apps or both.
   Nothing is measured about who saw it; a closed banner is remembered only in that browser. */
import { useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Empty } from "../charts";
import { toast } from "../phone";
import { Async, Card, I, LANGS, Lesson, P, dt, lang, rpc, type D, useRpc } from "../shared";

const KIND: Record<string, [string, string]> = { info: ["Információ", ""], good: ["Jó hír", "good"], warn: ["Figyelmeztetés", "warn"] };
const PLAT: Record<string, string> = { all: "Mindenhol", web: "Csak a weboldalon", app: "Csak az appokban", android: "Csak Androidon", ios: "Csak iPhone-on" };
const local = (t?: string | null) => (t ? new Date(new Date(t).getTime() - new Date(t).getTimezoneOffset() * 60e3).toISOString().slice(0, 16) : "");
const EMPTY: D = { title: "", body: "", kind: "info", lang: "", platform: "all", starts_at: "", ends_at: "", link: "", on_: true };

export function Announce() {
  const sb = useMemo(() => supabaseBrowser(), []);
  const q = useRpc("admin_announce_list", undefined, []);
  const [f, setF] = useState<D>(EMPTY); const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    const p = { ...f, starts_at: f.starts_at ? new Date(f.starts_at).toISOString() : null, ends_at: f.ends_at ? new Date(f.ends_at).toISOString() : null };
    const { error } = await rpc(sb, "admin_announce_save", { p });
    setBusy(false);
    if (error) { toast(error.message); return; }
    toast(f.id ? "Közlemény mentve (az app még nem mutatja)" : "Elmentve – az app még nem mutatja"); setF(EMPTY); q.load();
  };
  const toggle = async (a: D) => { const { error } = await rpc(sb, "admin_announce_save", { p: { ...a, on_: !a.on_ } }); if (error) toast(error.message); else { toast(a.on_ ? "Kikapcsolva" : "Bekapcsolva"); q.load(); } };
  const del = async (a: D) => { if (!confirm(`Törlöd a közleményt? „${a.title}”`)) return; const { error } = await rpc(sb, "admin_announce_delete", { p_id: a.id }); if (error) toast(error.message); else { toast("Törölve"); q.load(); } };
  const rows: D[] = Array.isArray(q.d) ? q.d : [];
  return (
    <div className="g">
      <section className="lesson s12" style={{ borderLeftColor: "#d9534f" }}><span className="ls-i">{I(P.alert)}</span><p><b>Nem működik még:</b> az app jelenleg <b>nem mutatja</b> a közleményeket, se a weboldalon, se az áruházi appokban. Amit itt közzéteszel, el van mentve, de senki nem látja, amíg a sáv be nem kerül az appba.</p></section>
      <Card className="s5" icon={P.bell} title={f.id ? "Közlemény szerkesztése" : "Új közlemény"} sub="(Még nem jelenik meg az appban.) Sáv lesz az app tetején. Rövid legyen: egy cím és egy-két mondat. A nyelvet választva csak azok látják, akik azon a nyelven használják az appot.">
        <div className="ann-f">
          <input className="adm-in" maxLength={120} placeholder="Cím (pl. „Új: hat új nyelv”)" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          <textarea className="adm-in" rows={3} maxLength={500} placeholder="Szöveg (nem kötelező)" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
          <div className="adm-row">
            <select className="adm-in sm" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>{Object.entries(KIND).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</select>
            <select className="adm-in sm" value={f.lang || ""} onChange={(e) => setF({ ...f, lang: e.target.value })}><option value="">Minden nyelv</option>{Object.keys(LANGS).filter((k) => k !== "?" && k !== "nb").map((k) => <option key={k} value={k}>{LANGS[k]}</option>)}</select>
            <select className="adm-in sm" value={f.platform} onChange={(e) => setF({ ...f, platform: e.target.value })}>{Object.entries(PLAT).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          </div>
          <div className="adm-row">
            <label className="mut" style={{ fontSize: 12 }}>Kezdete <input type="datetime-local" className="adm-in sm" value={f.starts_at || ""} onChange={(e) => setF({ ...f, starts_at: e.target.value })} /></label>
            <label className="mut" style={{ fontSize: 12 }}>Vége <input type="datetime-local" className="adm-in sm" value={f.ends_at || ""} onChange={(e) => setF({ ...f, ends_at: e.target.value })} /></label>
          </div>
          <input className="adm-in" placeholder="Link (nem kötelező, pl. /tudastar/… vagy https://…)" value={f.link || ""} onChange={(e) => setF({ ...f, link: e.target.value })} />
          <div className={"ann-prev k-" + f.kind}><b>{f.title || "A közlemény címe"}</b>{f.body && <span>{f.body}</span>}</div>
          <div className="adm-row"><button className="adm-ibtn gold" disabled={busy || !f.title.trim()} onClick={save}>{I(P.check)}{f.id ? "Mentés" : "Mentés (még nem jelenik meg)"}</button>{f.id && <button className="adm-ibtn" onClick={() => setF(EMPTY)}>Mégse</button>}</div>
        </div>
      </Card>
      <Card className="s7" icon={P.doc} title="Közlemények" sub={`${rows.filter((a) => a.live).length} aktív (az app még nem mutatja) · ${rows.length} összesen`}>
        <Async q={q} h={160}>{() => !rows.length ? <Empty t="Még nem volt közlemény." /> : (
          <ul className="ann-l">{rows.map((a) => (
            <li key={a.id}>
              <div><b>{a.title}</b> <span className={"chip " + KIND[a.kind]?.[1]}>{KIND[a.kind]?.[0]}</span> {a.live ? <span className="chip warn" title="Be van kapcsolva és az időszakában van, de az app még nem mutatja">aktív (az app nem mutatja)</span> : !a.on_ ? <span className="chip">kikapcsolva</span> : a.ends_at && new Date(a.ends_at) < new Date() ? <span className="chip">lejárt</span> : <span className="chip warn">időzítve</span>}
                <small className="mut" style={{ display: "block" }}>{a.lang ? lang(a.lang) : "minden nyelv"} · {PLAT[a.platform] || a.platform}{a.starts_at ? ` · ${dt(a.starts_at)}-tól` : ""}{a.ends_at ? ` · ${dt(a.ends_at)}-ig` : ""}</small>
                {a.body && <small style={{ display: "block" }}>{a.body}</small>}</div>
              <span className="adm-row" style={{ gap: 8 }}><button className="lnk" onClick={() => toggle(a)}>{a.on_ ? "Kikapcsolás" : "Bekapcsolás"}</button><button className="lnk" onClick={() => setF({ ...a, starts_at: local(a.starts_at), ends_at: local(a.ends_at), lang: a.lang || "", link: a.link || "" })}>Szerkesztés</button><button className="lnk" onClick={() => del(a)}>Törlés</button></span>
            </li>))}</ul>)}</Async>
      </Card>
      <div className="s12"><Lesson>Ha a sáv bekerül az appba, a közlemény a weboldalon és a két áruházi appban is megjelenik majd, mert azok a inkage.app/app élő oldalát mutatják. Egyszerre egy látszik (a legújabb). Az „aktív” jelölés csak azt jelenti, hogy be van kapcsolva és az időszakában van – az app még nem mutatja.</Lesson></div>
    </div>
  );
}
