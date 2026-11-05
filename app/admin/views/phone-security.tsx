"use client";
/* The phone's own switches on the Rendszer page: the device lock, the desktop layout, continuing on a computer. */
import { useEffect, useState } from "react";
import { QR } from "../wow";
import { ALL, Card, P, type Tab } from "../shared";
import { readRecents, toast } from "../phone";
import { deskOn, lockAfter, lockAvailable, lockOff, lockOn, readLock, setDesk } from "../lock";

/* true only when the text really reached the clipboard (a browser may refuse) */
export const copyText = async (t: string) => { try { await navigator.clipboard.writeText(t); return true; } catch { return false; } };

const AFTER: [number, string][] = [[0, "Azonnal"], [1, "1 perc"], [5, "5 perc"], [15, "15 perc"]];
export function PhoneLock() {
  const [can, setCan] = useState<boolean | null>(null); const [cfg, setCfg] = useState(readLock); const [msg, setMsg] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => { lockAvailable().then(setCan); }, []);
  const on = async () => { setBusy(true); setMsg(""); const e = await lockOn(1); setBusy(false); if (e) setMsg(e); else { setCfg(readLock()); toast("Zár bekapcsolva ezen az eszközön"); } };
  const off = async () => { setBusy(true); const ok = await lockOff(); setBusy(false); if (ok) { setCfg(null); toast("Zár kikapcsolva"); } else toast("Nem sikerült kikapcsolni a zárat: az azonosítás nem sikerült."); };
  const after = (m: number) => { lockAfter(m); setCfg(readLock()); };
  return (
    <Card className="s12" eager icon={P.user} title="Ezen a telefonon" sub="Csak erre az eszközre vonatkozik, a belépésedet nem változtatja meg.">
      <div className="sec-row"><div><b>Zár Face ID-val vagy ujjlenyomattal</b><small>A belépés mellé egy plusz zár: az app megnyitásakor kéri az arcodat vagy az ujjadat. Ha nem megy, a szokásos belépéssel mindig be tudsz lépni.</small></div>
        {can === false ? <span className="chip">nem elérhető</span> : <button className={"sw" + (cfg ? " on" : "")} role="switch" aria-checked={!!cfg} aria-label="Zár" disabled={busy || can === null} onClick={cfg ? off : on}><i /></button>}</div>
      {can === false && <p className="note">Ez a böngésző vagy eszköz nem ad hozzáférést az arc- vagy ujjazonosításhoz, vagy nincs beállítva a telefonon.</p>}
      {msg && <p className="note down">{msg}</p>}
      {cfg && <div className="sec-sub"><span>Zárolás az app elhagyása után</span><div className="adm-seg sm">{AFTER.map(([m, l]) => <button key={m} aria-pressed={cfg.after === m} onClick={() => after(m)}>{l}</button>)}</div>
        <small className="mut">Törlésnél, felfüggesztésnél és kulcscserénél is újra kéri. A zár ebben a böngészőben él: az adatokat továbbra is a belépés védi.</small></div>}
    </Card>
  );
}

/* the last resort, and carrying on at a computer */
export function PhoneMore() {
  const [page, setPage] = useState<Tab>("home");
  useEffect(() => { const r = readRecents().find((x) => x.k === "page"); if (r) setPage(r.id as Tab); }, []);
  const url = `https://inkage.app/admin#${page}`;
  return (
    <>
      <Card className="s12" eager icon={P.eye} title="Folytatás gépen" sub="A gép kamerájával vagy a telefonoddal olvasd be, vagy küldd el magadnak. A link csak az oldalra visz, a géped ugyanúgy belépést kér.">
        <label className="pfield"><span>Melyik oldal</span><select className="adm-in" value={page} onChange={(e) => setPage(e.target.value as Tab)}>{ALL.filter((x) => x.k !== "more").map((x) => <option key={x.k} value={x.k}>{x.l}</option>)}</select></label>
        <div className="sec-qr"><QR text={url} size={150} /><div><code>{url.replace("https://", "")}</code>
          <div className="adm-row"><button className="adm-ibtn sm" onClick={async () => toast(await copyText(url) ? "Link másolva" : "Nem sikerült másolni: a böngésző nem engedte.")}>Másolás</button>{typeof navigator !== "undefined" && "share" in navigator && <button className="adm-ibtn sm" onClick={() => navigator.share({ url }).catch(() => {})}>Küldés magamnak</button>}</div></div></div>
      </Card>
      <Card className="s12" eager icon={P.layers} title="Gépes nézet" sub="Végső esetre, ha valami telefonon nem megy: az oldal gépes elrendezésben jelenik meg, kicsiben. Visszakapcsolni a képernyő bal felső sarkában megjelenő gombbal lehet.">
        <button className="adm-ibtn" disabled={deskOn()} onClick={() => setDesk(true)}>Gépes nézet bekapcsolása</button>
      </Card>
    </>
  );
}
