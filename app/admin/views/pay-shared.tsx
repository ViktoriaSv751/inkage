"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
/* What the five Bevétel pages share: money in its currency, the names of the stores and of the products, the actions on
   one payment (refund, take back, correct the name, give by hand) and one buyer's whole story. InkAge takes no payments
   yet and has no fixed packages: every product name comes from the data (plan_name, or the plan key itself), and there
   is no invoicing (no Billingo). */
import { useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { fmt } from "../charts";
import { I, MOCK, P, ago, api, ch, dt, lang, n, rpc, type D, useRpc } from "../shared";
import { Sheet, haptic, toast } from "../phone";
import { UserDrawer } from "./users";

export const STORE_L: Record<string, string> = { stripe: "Weboldal (Stripe)", apple: "App Store", google: "Google Play", manual: "Kézi" };
export const STORE_S: Record<string, string> = { stripe: "Web", apple: "App Store", google: "Google Play", manual: "Kézi" };
/* black and white only: greys tell the places apart */
export const STORE_C: Record<string, string> = { stripe: "var(--ser-1)", apple: "var(--ser-3)", google: "var(--ser-5)", manual: "var(--ser-4)" };
/* product names: none are written in here (InkAge has no fixed packages); a name stands in this map only if one is ever
   worth a nicer label than the data's own */
export const PLAN_L: Record<string, string> = {
  /* B2B (2026-11-12): the studio and clinic plans; the trial, the bonus and a 0 Ft month are never revenue */
  b2b_trial: "Szalon próba (14 nap)", b2b_studio: "Szalon (havi)", b2b_pro: "Szalon Pro (havi)", b2b_clinic: "Klinika (havi)",
  b2b_studio_y: "Szalon (éves)", b2b_pro_y: "Szalon Pro (éves)", b2b_clinic_y: "Klinika (éves)", b2b_topup: "Szalon: extra előnézetek", b2b_bonus: "Szalon: ajándék előnézetek",
};
export const isB2B = (plan?: string | null) => String(plan || "").startsWith("b2b_");
/* the product of one row as the data names it */
export const planOf = (r: D | null | undefined) => String((r?.plan && PLAN_L[r.plan]) || r?.plan_name || r?.plan || "–");
export const planKey = (k?: string | null) => (k ? PLAN_L[k] || k : "–");
export const CHX: Record<string, string> = { iphoneapp: "iPhone-app", androidapp: "Android-app", ismeretlen: "Nem tudjuk" };
export const chName = (k?: string | null) => CHX[k || ""] || ch(k || "ismeretlen");
export const REASON_L: Record<string, string> = { card_declined: "Kártya elutasítva", insufficient_funds: "Nincs elég fedezet", expired_card: "Lejárt kártya", incorrect_cvc: "Rossz CVC-kód", incorrect_number: "Rossz kártyaszám",
  processing_error: "Feldolgozási hiba", authentication_required: "3D Secure kellett", generic_decline: "Általános elutasítás", do_not_honor: "A bank nem engedte", lost_card: "Elveszett kártya", stolen_card: "Lopott kártya",
  fraudulent: "Csalásgyanú", payment_intent_authentication_failure: "3D Secure nem sikerült", card_velocity_exceeded: "Túl sok próbálkozás", ismeretlen: "Ismeretlen ok" };
export const DISPUTE_L: Record<string, string> = { fraudulent: "Csalás (nem ő fizetett)", product_not_received: "Nem kapta meg", product_unacceptable: "Nem ezt várta", duplicate: "Kétszer fizetett", subscription_canceled: "Lemondta", credit_not_processed: "Nem kapta vissza", general: "Általános", unrecognized: "Nem ismeri fel" };

/* money in its own currency: "12,50 USD", "3 490 Ft" */
export const money = (v: number, cur = "USD") => {
  const c = (cur || "USD").toUpperCase();
  try { return new Intl.NumberFormat("hu-HU", { style: "currency", currency: c === "?" ? "USD" : c, maximumFractionDigits: c === "HUF" ? 0 : 2, minimumFractionDigits: c === "HUF" ? 0 : 2 }).format(v || 0); }
  catch { return `${fmt(Math.round((v || 0) * 100) / 100)} ${c}`; }
};
/* one currency for everything the page adds up: dollars or forints (the day's ECB rate) */
export function useCur() {
  const [cur, setCurS] = useState<"USD" | "HUF">(() => { try { return (localStorage.getItem("inkage.admin.paycur") as "USD" | "HUF") || "USD"; } catch { return "USD"; } });
  const setCur = (c: "USD" | "HUF") => { setCurS(c); try { localStorage.setItem("inkage.admin.paycur", c); } catch {} };
  return { cur, setCur };
}
export const conv = (usd: number, cur: string, huf: number) => (cur === "HUF" ? (usd || 0) * (huf || 360) : usd || 0);
export const M = (usd: number, cur: string, huf: number) => money(conv(usd, cur, huf), cur);
export const CurPick = ({ cur, set }: { cur: string; set: (c: "USD" | "HUF") => void }) => <div className="adm-seg sm" role="group" aria-label="Pénznem">{(["USD", "HUF"] as const).map((c) => <button key={c} aria-pressed={cur === c} onClick={() => set(c)}>{c === "USD" ? "$" : "Ft"}</button>)}</div>;
/* an e-mail is half hidden until tapped (someone beside her should not read the buyers' addresses) */
export function Mail({ e }: { e?: string | null }) {
  const [open, setOpen] = useState(false);
  if (!e) return <span className="mut">–</span>;
  const [u, d] = e.split("@");
  return <button type="button" className="pay-mail" onClick={(x) => { x.stopPropagation(); setOpen(!open); }} title="Koppints a teljes címért">{open ? e : `${u.slice(0, 2)}•••@${d}`}</button>;
}
export const Dot = ({ store }: { store: string }) => <span className="pay-dot" style={{ ["--pc" as any]: STORE_C[store] }}>{STORE_S[store] || store}</span>;

/* ---------- the actions on one payment ---------- */
export function PayActions({ p, close, done }: { p: D; close: () => void; done?: () => void }) {
  const sb = useMemo(() => supabaseBrowser(), []);
  const [mode, setMode] = useState<"" | "refund" | "rename" | "revoke">("");
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState(""); const [why, setWhy] = useState("requested_by_customer"); const [revoke, setRevoke] = useState(true); const [part, setPart] = useState("");
  const [name, setName] = useState(String(p.name || "")); const [confirm, setConfirm] = useState("");
  const run = async (fn: () => Promise<{ ok: boolean; msg?: string }>, ok: string) => {
    setBusy(true); haptic(8);
    const r = MOCK ? { ok: true } : await fn().catch((e) => ({ ok: false, msg: String(e?.message || e) }));
    setBusy(false);
    if (r.ok) { toast(ok); done?.(); close(); } else toast(r.msg || "Nem sikerült.");
  };
  const refund = () => run(async () => { const r = await api("/api/admin/pay", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "refund", id: p.id, reason, why, revoke, amount: part || undefined }) }); return { ok: r.ok, msg: r.json?.error }; }, "Visszatérítés elindítva: a Stripe pár perc alatt visszaadja.");
  const rename = () => run(async () => { const { error } = await rpc(sb, "admin_pay_rename", { p_id: p.id, p_name: name }); return { ok: !error, msg: error?.message.includes("name_taken") ? "Erre a névre már van vásárlása." : error?.message }; }, "A vásárlás átkerült az új névre.");
  const take = () => run(async () => { const { error } = await rpc(sb, "admin_pay_revoke", { p_id: p.id }); return { ok: !error, msg: error?.message }; }, "A vásárlást visszavetted.");
  return (
    <Sheet title={`${planOf(p)} · ${money(n(p.amount), p.currency)}`} sub={`${STORE_L[p.store] || p.store} · ${dt(p.at || p.created_at)}`} close={close}>
      <div className="pay-act-info">
        <span><b>Név:</b> <span className="cap">{p.name || "–"}</span></span>
        <span><b>Fiók:</b> <Mail e={p.email} /></span>
        {p.ch && <span><b>Honnan:</b> {chName(p.ch)}{p.account ? ` · ${p.account}` : ""}</span>}
        {p.coupon && <span><b>Kód:</b> {p.coupon}</span>}
        {p.refunded_at && <span className="bad"><b>Visszatérítve:</b> {dt(p.refunded_at)}</span>}
        {p.note && <span className="mut">{p.note}</span>}
        <code className="s11">{p.tx}</code>
      </div>
      {!mode && <div className="ps-acts pay-acts">
        {p.store === "stripe" && !p.refunded_at && <button onClick={() => setMode("refund")}>{I(P.refresh)}<span>Visszatérítés</span></button>}
        {p.store !== "stripe" && !p.refunded_at && <button disabled title="Az App Store-ban és a Google Playen a vevő kéri, az áruház dönt">{I(P.refresh)}<span>Visszatérítés: az áruházban</span></button>}
        {p.name && <button onClick={() => setMode("rename")}>{I(P.pen)}<span>Másik névre teszem</span></button>}
        <button onClick={() => setMode("revoke")}>{I(P.alert)}<span>Vásárlás visszavétele</span></button>
        <button onClick={() => { navigator.clipboard?.writeText(replyText(p)).then(() => toast("Válaszsablon a vágólapon")); }}>{I(P.mail)}<span>Válaszsablon másolása</span></button>
      </div>}
      {mode === "refund" && <div className="pay-form">
        <p className="note">A pénzt a Stripe adja vissza a vevő kártyájára (5–10 nap, mire látja). A Napló megőrzi, ki, mikor, miért.</p>
        <label className="pfield"><span>Miért?</span><select className="adm-in" value={why} onChange={(e) => setWhy(e.target.value)}><option value="requested_by_customer">A vevő kérte</option><option value="duplicate">Kétszer fizetett</option><option value="fraudulent">Csalás</option><option value="">Egyéb</option></select></label>
        <label className="pfield"><span>Megjegyzés (csak neked)</span><input className="adm-in" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="pl. rossz nevet írt be" /></label>
        <label className="pfield"><span>Csak egy része (üresen: a teljes összeg)</span><input className="adm-in" inputMode="decimal" value={part} onChange={(e) => setPart(e.target.value.replace(",", "."))} placeholder={String(p.amount)} /></label>
        <label className="pay-ck"><input type="checkbox" checked={revoke} onChange={(e) => setRevoke(e.target.checked)} /> A vásárolt hozzáférést is visszaveszem</label>
        <label className="pfield"><span>Írd be: VISSZA</span><input className="adm-in" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoCapitalize="characters" /></label>
        <div className="pay-row"><button className="adm-ibtn" onClick={() => setMode("")}>Mégse</button><button className="adm-ibtn gold" disabled={busy || confirm.trim().toUpperCase() !== "VISSZA"} onClick={refund}>{busy ? "…" : "Visszatérítem"}</button></div>
      </div>}
      {mode === "rename" && <div className="pay-form">
        <p className="note">Ha elgépelte a nevet: a vásárlás átkerül az új névre. Pénz nem mozdul.</p>
        <label className="pfield"><span>Az új név</span><input className="adm-in" value={name} onChange={(e) => setName(e.target.value)} /></label>
        <div className="pay-row"><button className="adm-ibtn" onClick={() => setMode("")}>Mégse</button><button className="adm-ibtn gold" disabled={busy || name.trim().length < 2} onClick={rename}>{busy ? "…" : "Áthelyezem"}</button></div>
      </div>}
      {mode === "revoke" && <div className="pay-form">
        <p className="note">A vevő elveszíti, amit ezzel a vásárlással kapott (pénzt ez nem ad vissza). Visszatérítés vagy kártyavita után szokás.</p>
        <div className="pay-row"><button className="adm-ibtn" onClick={() => setMode("")}>Mégse</button><button className="adm-ibtn gold" disabled={busy} onClick={take}>{busy ? "…" : "Visszaveszem"}</button></div>
      </div>}
    </Sheet>
  );
}
/* a kind first answer for the buyer, in their language when we know it is Hungarian */
export function replyText(p: D) {
  const what = planOf(p);
  return p.lang === "hu"
    ? `Szia!\n\nKöszönöm, hogy írtál. Megnéztem a vásárlásodat (${what}): a fiókodban van. Az InkAge appban a mentett előnézeteid között találod.\n\nHa bármi nem működik, írd meg, és azonnal megoldom.\n\nViktória, InkAge`
    : `Hi!\n\nThank you for writing. I checked your purchase (${what}): it is on your account. In the InkAge app, you'll find it with your saved previews.\n\nIf anything doesn't work, just reply and I'll fix it right away.\n\nViktória, InkAge`;
}

/* ---------- give a purchase by hand (a fault, a gift) ----------
   InkAge has no fixed packages: the product key is typed, with the keys already seen in the data offered */
export function GrantSheet({ user, email, plans, close, done }: { user?: string; email?: string; plans?: string[]; close: () => void; done?: () => void }) {
  const sb = useMemo(() => supabaseBrowser(), []);
  const [plan, setPlan] = useState(plans?.[0] || ""); const [name, setName] = useState(""); const [note, setNote] = useState(""); const [uid, setUid] = useState(user || ""); const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    const { error } = MOCK ? { error: null } : await rpc(sb, "admin_pay_grant", { p_user: uid.trim(), p_plan: plan.trim(), p_name: name, p_note: note || null });
    setBusy(false);
    if (error) { toast(/invalid input syntax for type uuid/.test(error.message) ? "A fiók azonosítója nem jó." : error.message); return; }
    toast("A vásárlás a vevő fiókjában van."); done?.(); close();
  };
  return (
    <Sheet title="Vásárlás kézzel" sub={email || "egy fióknak, pénz nélkül"} close={close} foot={<button className="adm-ibtn gold" disabled={busy || plan.trim().length < 1 || uid.trim().length < 30} onClick={go}>{busy ? "…" : "Megadom"}</button>}>
      <p className="note">Ha valaki fizetett, de nem kapta meg (lásd Fizetési hibák), vagy ajándékba. Bevételként nem számít, a Naplóban megmarad.</p>
      {!user && <label className="pfield"><span>A fiók azonosítója (az ember adatlapjáról)</span><input className="adm-in" value={uid} onChange={(e) => setUid(e.target.value)} placeholder="xxxxxxxx-xxxx-…" /></label>}
      <label className="pfield"><span>Termék (a kulcsa, ahogy a fizetési adatban áll)</span><input className="adm-in" list="pay-plans" value={plan} onChange={(e) => setPlan(e.target.value)} placeholder="a termék kulcsa" />
        <datalist id="pay-plans">{(plans || []).map((k) => <option key={k} value={k}>{planKey(k)}</option>)}</datalist></label>
      <label className="pfield"><span>Milyen névre (ha a termék névhez tartozik)</span><input className="adm-in" value={name} onChange={(e) => setName(e.target.value)} placeholder="Kovács Anna" /></label>
      <label className="pfield"><span>Miért (csak neked)</span><input className="adm-in" value={note} onChange={(e) => setNote(e.target.value)} placeholder="pl. fizetett, de nem jött meg" /></label>
    </Sheet>
  );
}

/* ---------- one buyer from the first visit to now ---------- */
export function BuyerDrawer({ id, close }: { id: string; close: () => void }) {
  const q = useRpc("admin_pay_customer", { p_user: id }, [id]);
  const [act, setAct] = useState<D | null>(null); const [grant, setGrant] = useState(false); const [user, setUser] = useState(false);
  if (user) return <UserDrawer id={id} close={() => setUser(false)} />;
  const d = q.d;
  const items: { at: string; t: string; s?: string; tone?: string; p?: D }[] = [];
  if (d) {
    if (d.origin?.created_at) items.push({ at: d.origin.created_at, t: "Regisztrált", s: [chName(d.origin.ch), d.origin.lang ? lang(d.origin.lang) : "", d.origin.src?.land || ""].filter(Boolean).join(" · ") });
    for (const p of d.purchases || []) items.push({ at: p.created_at, t: `${p.store === "manual" ? "Kézi vásárlás" : "Fizetett"}: ${planOf(p)} · ${money(n(p.amount), p.currency)}`, s: [STORE_S[p.store], p.name_norm, p.coupon ? "kód: " + p.coupon : "", p.first_buy ? "első vásárlás" : ""].filter(Boolean).join(" · "), tone: "good", p: { ...p, at: p.created_at, name: p.name_norm, tx: p.tx } });
    for (const p of d.purchases || []) if (p.refunded_at) items.push({ at: p.refunded_at, t: `Visszatérítve: ${money(n(p.refund_usd), "USD")}`, tone: "bad" });
    for (const k of d.claims || []) items.push({ at: k.at, t: `Felhasználta: ${k.style}`, s: k.name });
    for (const s of d.ratings || []) items.push({ at: s.at, t: `${"★".repeat(n(s.stars))}${"☆".repeat(5 - n(s.stars))} értékelés`, s: s.style, tone: n(s.stars) <= 2 ? "bad" : undefined });
    for (const e of d.events || []) items.push({ at: e.at, t: e.kind === "expired" ? "Félbehagyott fizetés" : e.kind === "failed" ? `Sikertelen fizetés: ${REASON_L[e.reason] || e.reason || ""}` : e.kind, tone: "bad" });
    items.sort((a, b) => a.at.localeCompare(b.at));
  }
  const ltv = (d?.purchases || []).filter((p: D) => p.store !== "manual").reduce((s: number, p: D) => s + n(p.usd) - n(p.refund_usd), 0);
  return (
    <Sheet tall title="Vevő" sub={d?.user?.email ? <Mail e={d.user.email} /> : "…"} close={close} foot={<div className="pay-row"><button className="adm-ibtn" onClick={() => setUser(true)}>Az ember teljes adatlapja</button><button className="adm-ibtn gold" onClick={() => setGrant(true)}>Vásárlás kézzel</button></div>}>
      {!d ? <div className="skel" style={{ height: 200 }} /> : <>
        <div className="pay-conv"><div><b>{money(ltv, "USD")}</b><small>összesen fizetett</small></div><div><b>{fmt((d.purchases || []).filter((p: D) => p.store !== "manual").length)}</b><small>vásárlás</small></div>
          <div><b>{fmt((d.claims || []).length)}</b><small>felhasználás</small></div><div><b>{d.user?.created_at ? ago(d.user.created_at) : "–"}</b><small>regisztrált</small></div></div>
        <ol className="pay-tl">{items.map((x, i) => <li key={i} className={x.tone || ""} onClick={x.p ? () => setAct(x.p!) : undefined}><time>{dt(x.at)}</time><b>{x.t}</b>{x.s && <small>{x.s}</small>}</li>)}</ol>
      </>}
      {act && <PayActions p={act} close={() => setAct(null)} done={q.load} />}
      {grant && <GrantSheet user={id} email={d?.user?.email} close={() => setGrant(false)} done={q.load} />}
    </Sheet>
  );
}
