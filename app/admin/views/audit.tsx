"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
/* Napló: every admin action, who and when (nothing deletes it). Key values are never written, only their names. */
import { useState } from "react";
import { Info, fmt } from "../charts";
import { Hero } from "../ink";
import { Card, P, type D, useRpc } from "../shared";
import { usePhone } from "../phone";
import { ACT_L } from "./people";

const KINDS: [string, string][] = [["", "Mind"], ["fiok", "Fiókok"], ["jegyzet", "Jegyzetek"], ["valasz", "Válaszok"], ["kozlemeny", "Közlemények"], ["terv", "Tervező"], ["link", "Rövid linkek"], ["kulcs", "Kulcsok"], ["kapcsolat", "Kapcsolatok"], ["szabaly", "Riasztások"], ["biztonsag", "Biztonság"]];

export function Audit() {
  const [k, setK] = useState(""); const [page, setPage] = useState(0); const phone = usePhone();
  const q = useRpc("admin_audit_list", { p_kind: k || null, p_limit: 100, p_offset: page * 100 }, [k, page]);
  const d: D = (q.d as D) || {};
  const rows: D[] = d.rows || [];
  return (
    <div className="g io">
      <div className="s12"><Hero label={<>Bejegyzés a naplóban<Info>Minden admin-művelet: ki, mikor, mit és min. Nem törölhető. A kulcsoknál csak a kulcs neve kerül ide, az értéke soha; törölt fióknál csak az e-mail-cím domainje.</Info></>} v={n100(d.total)} /></div>
      <div className="s12 io-scroll" role="group" aria-label="Művelet fajtája">{KINDS.map(([v, l]) => <button key={v} className="io-src" aria-pressed={k === v} onClick={() => { setK(v); setPage(0); }}>{l}</button>)}</div>
      <Card eager className="s12" icon={P.doc} title="Műveletek">
        {q.e ? <div className="alert err">{q.e}</div> : !q.d ? <div className="skel" style={{ height: 200 }} /> : (
          rows.length ? <><div className="tw-tools"><span>{fmt(rows.length)} sor</span><button className="lnk" onClick={() => download(rows)}>CSV ⤓</button></div><ol className="io-tl">{rows.map((x, i) => { const day = new Date(x.at).toLocaleDateString("hu-HU", { year: "numeric", month: "long", day: "numeric" }), head = !i || new Date(rows[i - 1].at).toLocaleDateString("hu-HU", { year: "numeric", month: "long", day: "numeric" }) !== day, det = detail(x);
            return <li key={String(x.id ?? x.at) + i}>{head && <h4>{day}</h4>}<time>{new Date(x.at).toLocaleTimeString("hu-HU", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</time><b>{ACT_L[x.action] || x.action}</b><span>{x.actor || "–"}{x.target ? ` → ${x.target}` : ""}</span>{det && <small>{det}</small>}</li>; })}</ol></> : <p className="note">Még nincs bejegyzés.</p>
        )}
        {phone && <a className="lnk" href="#monitor">Időzített feladatok: Monitoring oldal →</a>}
        {n100(d.total) > 100 && <div className="pager"><span>{page * 100 + 1}–{Math.min(n100(d.total), (page + 1) * 100)} / {fmt(d.total)}</span>
          <div className="adm-row"><button className="adm-ibtn" disabled={!page} onClick={() => setPage(page - 1)}>← Előző</button><button className="adm-ibtn" disabled={(page + 1) * 100 >= n100(d.total)} onClick={() => setPage(page + 1)}>Következő →</button></div></div>}
      </Card>
    </div>
  );
}
const n100 = (x: unknown) => Number(x) || 0;
const detail = (x: D) => Object.entries(x.detail || {}).filter(([, v]) => v != null && v !== "").map(([a, v]) => `${a}: ${typeof v === "object" ? JSON.stringify(v) : v}`).join(" · ");
/* the same file the table gave: every column, this page's rows */
function download(rows: D[]) {
  const q = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const body = [["Mikor", "Művelet", "Ki", "Min", "Részletek"].map(q).join(","), ...rows.map((x) => [x.at, ACT_L[x.action] || x.action, x.actor, x.target, detail(x)].map(q).join(","))].join("\n");
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["\ufeff" + body], { type: "text/csv;charset=utf-8" })); a.download = `naplo-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
