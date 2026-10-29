"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
/* Napló: every admin action, who and when (nothing deletes it). Key values are never written, only their names. */
import { useState } from "react";
import { fmt } from "../charts";
import { Card, P, Tbl, dt, type D, useRpc } from "../shared";
import { ACT_L } from "./people";

const KINDS: [string, string][] = [["", "Mind"], ["fiok", "Fiókok"], ["jegyzet", "Jegyzetek"], ["valasz", "Válaszok"], ["kozlemeny", "Közlemények"], ["terv", "Tervező"], ["link", "Rövid linkek"], ["kulcs", "Kulcsok"], ["kapcsolat", "Kapcsolatok"], ["szabaly", "Riasztások"], ["biztonsag", "Biztonság"]];

export function Audit() {
  const [k, setK] = useState(""); const [page, setPage] = useState(0);
  const q = useRpc("admin_audit_list", { p_kind: k || null, p_limit: 100, p_offset: page * 100 }, [k, page]);
  const d: D = (q.d as D) || {};
  const rows: D[] = d.rows || [];
  return (
    <div className="g">
      <Card className="s12" icon={P.doc} title="Napló" sub="Minden admin-művelet: ki, mikor, mit és min. Nem törölhető. A kulcsoknál csak a kulcs neve kerül ide, az értéke soha; törölt fióknál csak az e-mail-cím domainje." right={<span className="chip gold">{fmt(d.total)} bejegyzés</span>}>
        <div className="adm-seg sm" style={{ flexWrap: "wrap" }}>{KINDS.map(([v, l]) => <button key={v} aria-pressed={k === v} onClick={() => { setK(v); setPage(0); }}>{l}</button>)}</div>
        {q.e ? <div className="alert err">{q.e}</div> : !q.d ? <div className="skel" style={{ height: 200 }} /> : (
          <Tbl name="naplo" rows={rows} csv empty="Még nincs bejegyzés." cols={[
            { k: "at", l: "Mikor", r: (x) => dt(x.at) },
            { k: "action", l: "Művelet", r: (x) => <b>{ACT_L[x.action] || x.action}</b> },
            { k: "actor", l: "Ki", r: (x) => x.actor || "–" },
            { k: "target", l: "Min", r: (x) => <small className="mut">{x.target || "–"}</small> },
            { k: "detail", l: "Részletek", r: (x) => <small>{Object.entries(x.detail || {}).filter(([, v]) => v != null && v !== "").map(([a, v]) => `${a}: ${typeof v === "object" ? JSON.stringify(v) : v}`).join(" · ") || "–"}</small> },
          ]} />
        )}
        {n100(d.total) > 100 && <div className="pager"><span>{page * 100 + 1}–{Math.min(n100(d.total), (page + 1) * 100)} / {fmt(d.total)}</span>
          <div className="adm-row"><button className="adm-ibtn" disabled={!page} onClick={() => setPage(page - 1)}>← Előző</button><button className="adm-ibtn" disabled={(page + 1) * 100 >= n100(d.total)} onClick={() => setPage(page + 1)}>Következő →</button></div></div>}
      </Card>
    </div>
  );
}
const n100 = (x: unknown) => Number(x) || 0;
