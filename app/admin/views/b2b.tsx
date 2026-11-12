"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
/* Szalonok (B2B): the studio and clinic plans in one page (admin_b2b). The monthly income (MRR: an annual plan counts as
   its price / 12), the outreach test's road (visits with the e-mail's ref code, trials, checkouts, subscriptions), the
   running trials and subscriptions with their previews, cancellations and failed payments, the lead pipeline with its
   seven steps and notes, the ref codes of the outreach e-mails, and the webhook's problems. A studio opens with its
   story (admin_b2b_studio) and the owner's tools: more trial days, bonus previews. The owner's own test accounts are
   listed but never counted. */
import { useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { BarList, Funnel, fmt } from "../charts";
import { Card, Loading, MOCK, P, Tbl, ago, dt, n, rpc, type D, useRpc } from "../shared";
import { Hero, Trio } from "../ink";
import { Sheet, haptic, toast } from "../phone";
import { Top } from "./traffic";
import { PageErr } from "./people";
import { Mail, money } from "./pay-shared";

export const LEAD_ST: [string, string][] = [["uj", "Új"], ["kikuldve", "Kiküldve"], ["valaszolt", "Válaszolt"], ["minta", "Minta ment"], ["proba", "Próbán"], ["elofizeto", "Előfizető"], ["elutasitotta", "Nem kérte"]];
const LEAD_L = Object.fromEntries(LEAD_ST) as Record<string, string>;
const SUB_L: Record<string, string> = { trial: "Próba fut", trial_ended: "Próba lejárt", active: "Aktív", past_due: "Fizetés elakadt", canceled: "Lemondva" };
const KIND_L: Record<string, string> = { tattoo_studio: "Tetoválószalon", laser_clinic: "Lézerklinika", studio: "Tetoválószalon", clinic: "Lézerklinika" };
const ft = (v: unknown) => money(n(v), "HUF");
const day = (t?: string | null) => (t ? new Date(t).toLocaleDateString("hu-HU", { month: "short", day: "numeric" }) : "–");
const who = (r: D) => <span className="cap">{r.company || r.email || "–"}{r.own ? <small className="mut"> · saját</small> : null}</span>;

export function B2B({ days }: { days: number }) {
  const q = useRpc("admin_b2b", { p_days: days || 3650 }, [days]);
  const [open, setOpen] = useState<D | null>(null);
  const [lead, setLead] = useState<D | null>(null);
  const [lst, setLst] = useState<string>("all");
  const d = q.d;
  const leads: D[] = useMemo(() => ((d?.leads || []) as D[]), [d]);
  if (q.e && !d) return <PageErr e={q.e} retry={q.load} busy={q.busy} />;
  if (!d) return <Loading />;
  const f = d.funnel || {}, m = d.mrr || {};
  const trials: D[] = d.trials || [], subs: D[] = d.subs || [], refs: D[] = d.by_ref || [], hooks: D[] = d.webhook || [];
  const running = trials.filter((x) => x.status === "trial");
  const leaving = subs.filter((x) => x.status === "canceled" || (x.status === "active" && x.cancel_at_period_end));
  const stuck = subs.filter((x) => x.status === "past_due");
  const per = days >= 3650 || !days ? "összesen" : days === 1 ? "az elmúlt 24 órában" : `az elmúlt ${days} napban`;
  const cnt = (k: string) => leads.filter((x) => x.status === k).length;
  const shown = lst === "all" ? leads : leads.filter((x) => x.status === lst);
  const bad = hooks.filter((x) => !x.ok);

  return (
    <div className="g ix pay b2b">
      {n(d.webhook_bad_7d) > 0 && <div className="s12 alert err pay-alert" role="alert">{fmt(d.webhook_bad_7d)} hibás Stripe-értesítés a szalonoktól az elmúlt 7 napban. Lent, a „Webhook-hibák” kártyán látod, melyik.</div>}
      {stuck.length > 0 && <div className="s12 alert err pay-alert" role="alert">{fmt(stuck.length)} szalonnál elakadt a havi fizetés. A Stripe újrapróbálja; ha nem sikerül, a csomag lemondva lesz.</div>}

      <Top><Hero flip label="Havi visszatérő bevétel (MRR)" text={ft(m.huf)}
        sub={<>{fmt(m.active)} aktív előfizetés{n(m.annual) ? ` · ebből ${fmt(m.annual)} éves (az ára / 12)` : ""}{n(m.ending_huf) ? ` · ${ft(m.ending_huf)} megszűnik az időszak végén` : ""}{n(m.past_due_huf) ? ` · ${ft(m.past_due_huf)} fizetése elakadt` : ""}</>} /></Top>
      <Trio items={[
        { l: "Futó próba", v: running.length },
        { l: "Érdeklődő a listán", v: leads.length },
        { l: "Lemond / lemondta", v: leaving.length },
      ]} />

      <Card className="s7" icon={P.funnel} title="A szalonok útja" sub={`A /szalonoknak oldal ${per}: látogatók (a levelek ref-kódjával jöttek külön), próba, fizetés. A saját fiókjaid nem számítanak.`}>
        <Funnel steps={[
          { k: "v", l: "Látogató a szalonoldalon", n: n(f.visitors) },
          { k: "r", l: "Ebből a levél linkjével (ref)", n: n(f.views_ref) },
          { k: "t", l: "Próbát indított", sub: `${fmt(f.trial_ev)} gombnyomás`, n: n(f.trials) },
          { k: "c", l: "Fizetéshez ment", n: n(f.checkout_ev) },
          { k: "p", l: "Előfizető lett", sub: `${fmt(f.subscribed_ev)} visszaigazolás az oldalon`, n: n(f.paid) },
        ]} />
        <p className="note">Űrlapon jelentkezett: <b>{fmt(f.leads)}</b> · a fiókkezelőt (Stripe) megnyitotta: <b>{fmt(f.portal_ev)}</b></p>
      </Card>
      <Card className="s5" icon={P.money} title="Előfizetések csomagonként" sub="Aktív előfizetések és havi értékük. Éves csomagnál a havi érték az éves ár tizenketted része.">
        <BarList items={((m.by_plan || []) as D[]).map((x) => ({ k: x.name || x.plan, n: n(x.huf), sub: `${fmt(x.n)} szalon` }))} fmtK={(k) => k} empty="Még nincs aktív előfizetés." />
      </Card>

      <Card className="s12" icon={P.clock} title="Próbák" sub="14 nap, kártya nélkül, 20 előnézet. A lejáratkor csak a fel nem használt próba-előnézetek tűnnek el. Koppintva a szalon adatlapja nyílik, ott hosszabbíthatsz vagy adhatsz előnézetet.">
        <Tbl name="b2b-probak" rows={trials} onRow={setOpen} empty="Még senki nem indított próbát." cols={[
          { k: "company", l: "Szalon", ph: "name", r: who },
          { k: "status", l: "Állapot", ph: "sub", r: (r) => SUB_L[r.status] || r.status },
          { k: "days_left", l: "Hátravan", num: true, ph: "main", r: (r) => r.status === "trial" ? `${fmt(r.days_left)} nap` : "–" },
          { k: "used", l: "Felhasznált", num: true },
          { k: "left", l: "Maradt", num: true },
          { k: "created_at", l: "Kezdte", r: (r) => day(r.created_at) },
          { k: "trial_ends_at", l: "Lejár", r: (r) => day(r.trial_ends_at) },
          { k: "email", l: "Fiók", r: (r) => <Mail e={r.email} /> },
        ]} />
      </Card>

      <Card className="s12" icon={P.users} title="Előfizetők" sub="Csomag, havi vagy éves, a következő feltöltés napja, lemondás az időszak végén, és ebben az időszakban felhasznált előnézetek.">
        <Tbl name="b2b-elofizetok" rows={subs} onRow={setOpen} empty="Még nincs előfizető." cols={[
          { k: "company", l: "Szalon", ph: "name", r: who },
          { k: "plan_name", l: "Csomag", ph: "sub", r: (r) => r.plan_name || r.plan || "–" },
          { k: "status", l: "Állapot", r: (r) => <span className={r.status === "past_due" ? "bad" : ""}>{SUB_L[r.status] || r.status}{r.status === "active" && r.cancel_at_period_end ? " · lemondta" : ""}</span> },
          { k: "mrr_huf", l: "Havi érték", num: true, ph: "main", r: (r) => ft(r.mrr_huf) },
          { k: "current_period_end", l: "Következő feltöltés", r: (r) => r.status === "canceled" ? "–" : day(r.current_period_end) },
          { k: "used_period", l: "Felhasznált (időszak)", num: true, r: (r) => `${fmt(r.used_period)}${n(r.per_month) ? " / " + fmt(r.per_month) : ""}` },
          { k: "left", l: "Maradt", num: true },
        ]} />
      </Card>

      <Card className="s6" icon={P.alert} title="Lemondások és elakadt fizetések" sub="Aki lemondta (az időszak végéig még használja), akinél a kártya nem ment át, és aki már nem előfizető.">
        <Tbl name="b2b-lemondasok" rows={[...stuck, ...leaving]} onRow={setOpen} csv={false} empty="Senki nem mondta le, és minden fizetés átment." cols={[
          { k: "company", l: "Szalon", ph: "name", r: who },
          { k: "status", l: "Mi történt", ph: "sub", r: (r) => r.status === "past_due" ? "Fizetés elakadt" : r.status === "canceled" ? "Lemondva" : `Lemondta, ${day(r.current_period_end)}-ig használja` },
          { k: "mrr_huf", l: "Havi érték", num: true, ph: "main", r: (r) => ft(r.mrr_huf) },
          { k: "updated_at", l: "Mikor", r: (r) => ago(r.updated_at) },
        ]} />
      </Card>
      <Card className="s6" icon={P.links} title="A levelek ref-kódjai" sub="Melyik kiküldött levél linkjét nyitották meg (b2b_view), és lett-e belőle próba vagy fizetés.">
        <Tbl name="b2b-ref" rows={refs} csv={false} onRow={(r) => { const l = leads.find((x) => x.id === r.lead_id); if (l) setLead(l); }} empty="Még senki nem nyitotta meg a levelek linkjét." cols={[
          { k: "ref", l: "Kód", ph: "name", r: (r) => <><code>{r.ref}</code>{r.company ? <> · <span className="cap">{r.company}</span></> : null}</> },
          { k: "views", l: "Megnyitás", num: true, ph: "main" },
          { k: "visitors", l: "Ember", num: true },
          { k: "trial", l: "Próba / fizetés", ph: "sub", r: (r) => [r.trial ? "próba" : "", r.checkout ? "fizetéshez ment" : ""].filter(Boolean).join(" · ") || "–" },
          { k: "last_at", l: "Utoljára", r: (r) => ago(r.last_at) },
        ]} />
      </Card>

      <Card className="s12" icon={P.target} title="Érdeklődők" sub="Minden szalon és klinika, akinek írtál vagy aki jelentkezett. Koppintva állíthatod az állapotát és írhatsz megjegyzést (csak neked)."
        right={<div className="adm-seg sm pay-seg">{([["all", "Mind", leads.length], ...LEAD_ST.map(([k, l]) => [k, l, cnt(k)])] as [string, string, number][]).map(([k, l, c]) => <button key={k} aria-pressed={lst === k} onClick={() => { haptic(5); setLst(k); }}><span>{l}</span> <small>{c}</small></button>)}</div>}>
        <Tbl name="b2b-erdeklodok" rows={shown} onRow={setLead} empty="Ebben az állapotban nincs senki." cols={[
          { k: "company", l: "Szalon", ph: "name", r: (r) => <span className="cap">{r.company || "–"}</span> },
          { k: "status", l: "Állapot", ph: "main", r: (r) => LEAD_L[r.status] || r.status },
          { k: "city", l: "Város", ph: "sub", r: (r) => [r.city, KIND_L[r.kind] || r.kind].filter(Boolean).join(" · ") || "–" },
          { k: "source", l: "Honnan", r: (r) => r.source === "outreach" ? `levél${r.ref ? " " + r.ref : ""}` : "űrlap" },
          { k: "views", l: "Megnyitotta", num: true },
          { k: "sent_at", l: "Kiküldve", r: (r) => day(r.sent_at) },
          { k: "followup_due", l: "Emlékeztető", r: (r) => day(r.followup_due) },
          { k: "sub_status", l: "Fiók", r: (r) => r.sub_status ? SUB_L[r.sub_status] || r.sub_status : "–" },
          { k: "note", l: "Megjegyzés", r: (r) => r.note || "" },
          { k: "email", l: "E-mail", r: (r) => <Mail e={r.email} /> },
        ]} />
      </Card>

      <Card className="s12" icon={P.alert} title="Webhook-hibák" sub={`A Stripe szalon-értesítései közül az utolsó 50 (számlák, előfizetés-változások), ${bad.length ? `${bad.length} hibás` : "mind rendben"}. Hiba esetén a Stripe órákig újrapróbálja.`}>
        <Tbl name="b2b-webhook" rows={hooks} csv={false} empty="Még nem jött szalon-értesítés." cols={[
          { k: "ok", l: "Rendben", ph: "main", r: (r) => r.ok ? "igen" : <b className="bad">hiba</b> },
          { k: "event_type", l: "Esemény", ph: "name" },
          { k: "ref", l: "Azonosító", r: (r) => r.ref ? <code>{r.ref}</code> : "–" },
          { k: "error", l: "Hiba", ph: "sub", r: (r) => r.error || "" },
          { k: "at", l: "Mikor", r: (r) => dt(r.at) },
        ]} />
      </Card>

      {open && <StudioSheet r={open} close={() => setOpen(null)} done={q.load} />}
      {lead && <LeadSheet l={lead} close={() => setLead(null)} done={q.load} />}
    </div>
  );
}

/* one studio: its plan, previews per month, purchases, team, events, and the owner's two tools */
function StudioSheet({ r, close, done }: { r: D; close: () => void; done: () => void }) {
  const sb = useMemo(() => supabaseBrowser(), []);
  const q = useRpc("admin_b2b_studio", { p_user: r.user_id }, [r.user_id]);
  const [daysN, setDaysN] = useState("7"); const [bonus, setBonus] = useState("10"); const [note, setNote] = useState(""); const [busy, setBusy] = useState(false);
  const s: D = q.d?.sub || r;
  const run = async (fn: string, args: Record<string, unknown>, ok: string) => {
    setBusy(true); haptic(8);
    const { error } = MOCK ? { error: null } : await rpc(sb, fn, args);
    setBusy(false);
    if (error) { toast(/not_trial/.test(error.message) ? "Ez a szalon már nem próbán van." : /bad_/.test(error.message) ? "Ellenőrizd a számot." : error.message); return; }
    toast(ok); q.load(); done();
  };
  const isTrial = s.status === "trial" || s.status === "trial_ended";
  const team: D[] | null = Array.isArray(q.d?.team) ? q.d!.team : null;
  return (
    <Sheet tall title={s.company || s.email || "Szalon"} sub={`${SUB_L[s.status] || s.status || ""}${s.plan_name ? " · " + s.plan_name : ""}`} close={close}>
      {!q.d && !q.e ? <Loading /> : <>
        <div className="pay-act-info">
          <span><b>Fiók:</b> <Mail e={s.email} /></span>
          {isTrial && <span><b>Próba vége:</b> {dt(s.trial_ends_at)}</span>}
          {!isTrial && s.current_period_end && <span><b>Következő feltöltés:</b> {dt(s.current_period_end)}{s.cancel_at_period_end ? " (lemondta, ezután megszűnik)" : ""}</span>}
          <span><b>Maradt:</b> {fmt(s.left)} előnézet</span>
          {n(s.mrr_huf) > 0 && <span><b>Havi érték:</b> {ft(s.mrr_huf)}</span>}
          {q.d?.lead && <span><b>Érdeklődőként:</b> {LEAD_L[q.d.lead.status] || q.d.lead.status}{q.d.lead.ref ? ` · ${q.d.lead.ref}` : ""}</span>}
        </div>
        <h3 className="ink-h">Előnézetek havonta</h3>
        <BarList items={((q.d?.by_month || []) as D[]).map((x) => ({ k: x.month, n: n(x.previews), sub: `${fmt(x.days)} napon` }))} fmtK={(k) => k} empty="Még nem készített előnézetet." />
        <h3 className="ink-h">Csapat</h3>
        {!q.d?.team_table ? <p className="note">A csapattagok táblája még nincs az adatbázisban.</p>
          : team && team.length ? <ul className="pay-live">{team.map((t, i) => <li key={t.id ?? i}><b>{t.email || t.member || "–"}</b><span>{t.accepted_at ? "csatlakozott" : t.error ? "nem olvasható" : "meghívva"}</span><small>{t.previews_month != null ? `${fmt(t.previews_month)} előnézet ebben a hónapban` : ""}</small></li>)}</ul>
          : <p className="note">Még nincs csapattag.</p>}
        <h3 className="ink-h">Vásárlások</h3>
        <Tbl name="b2b-szalon-vasarlas" rows={(q.d?.purchases || []) as D[]} csv={false} empty="Nincs vásárlás." cols={[
          { k: "plan_name", l: "Mi", ph: "name", r: (x) => x.plan_name || x.plan },
          { k: "credits", l: "Előnézet", num: true, ph: "main" },
          { k: "amount", l: "Összeg", num: true, r: (x) => n(x.amount) ? money(n(x.amount), x.currency || "HUF") : "0 Ft" },
          { k: "created_at", l: "Mikor", ph: "sub", r: (x) => dt(x.created_at) },
        ]} />
        {((q.d?.events || []) as D[]).length > 0 && <><h3 className="ink-h">Lépései az oldalon</h3>
          <ul className="pay-live">{(q.d!.events as D[]).slice(0, 12).map((e, i) => <li key={i}><b>{e.name}</b><small>{dt(e.created_at)}</small></li>)}</ul></>}

        <h3 className="ink-h">Kézi eszközök</h3>
        {isTrial && <div className="pay-form">
          <label className="pfield"><span>Próba hosszabbítása (nap)</span><input className="adm-in" inputMode="numeric" value={daysN} onChange={(e) => setDaysN(e.target.value.replace(/\D/g, ""))} /></label>
          {s.status === "trial_ended" && <p className="note">A lejárt próba újra elindul; a lejáratkor eltűnt előnézetek nem jönnek vissza, azokat lent adhatod meg.</p>}
          <div className="pay-row"><button className="adm-ibtn gold" disabled={busy || !(n(daysN) >= 1 && n(daysN) <= 90)} onClick={() => run("admin_b2b_trial_extend", { p_user: r.user_id, p_days: n(daysN) }, "A próba meghosszabbítva.")}>{busy ? "…" : "Hosszabbítom"}</button></div>
        </div>}
        <div className="pay-form">
          <label className="pfield"><span>Ajándék előnézetek (db)</span><input className="adm-in" inputMode="numeric" value={bonus} onChange={(e) => setBonus(e.target.value.replace(/\D/g, ""))} /></label>
          <label className="pfield"><span>Miért (csak neked)</span><input className="adm-in" value={note} onChange={(e) => setNote(e.target.value)} placeholder="pl. hiba miatt, kérésre" /></label>
          <p className="note">Kézi sorként kerül a fiókba (0 Ft), bevételként nem számít, a próba lejárta sem veszi el. A Napló megőrzi.</p>
          <div className="pay-row"><button className="adm-ibtn gold" disabled={busy || !(n(bonus) >= 1 && n(bonus) <= 500)} onClick={() => run("admin_b2b_bonus", { p_user: r.user_id, p_n: n(bonus), p_note: note }, "Az előnézetek a fiókban vannak.")}>{busy ? "…" : "Hozzáadom"}</button></div>
        </div>
      </>}
    </Sheet>
  );
}

/* one lead: its step in the pipeline and a note */
function LeadSheet({ l, close, done }: { l: D; close: () => void; done: () => void }) {
  const sb = useMemo(() => supabaseBrowser(), []);
  const [st, setSt] = useState<string>(l.status || "uj"); const [note, setNote] = useState<string>(l.note || ""); const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true); haptic(8);
    const { error } = MOCK ? { error: null } : await rpc(sb, "admin_b2b_lead_set", { p_id: l.id, p_status: st, p_note: note });
    setBusy(false);
    if (error) { toast(error.message); return; }
    toast("Mentve."); done(); close();
  };
  return (
    <Sheet title={l.company || l.email} sub={[l.city, KIND_L[l.kind] || l.kind, l.source === "outreach" ? "levél" : "űrlap"].filter(Boolean).join(" · ")} close={close}>
      <div className="pay-act-info">
        <span><b>E-mail:</b> <Mail e={l.email} /></span>
        {l.name && <span><b>Név:</b> {l.name}</span>}
        {l.phone && <span><b>Telefon:</b> {l.phone}</span>}
        {l.website && <span><b>Weboldal:</b> <a className="lnk" href={l.website} target="_blank" rel="noreferrer">{l.website.replace(/^https?:\/\//, "")}</a></span>}
        {l.ref && <span><b>Ref-kód:</b> <code>{l.ref}</code> · {fmt(l.views)} megnyitás</span>}
        {l.sent_at && <span><b>Kiküldve:</b> {day(l.sent_at)}{l.followup_due ? ` · emlékeztető: ${day(l.followup_due)}` : ""}</span>}
        {l.plan && <span><b>Csomag, amit nézett:</b> {l.plan}</span>}
        {l.message && <span className="mut">{l.message}</span>}
        {l.sub_status && <span><b>Fiókja:</b> {SUB_L[l.sub_status] || l.sub_status}</span>}
      </div>
      <div className="pay-form">
        <div className="adm-seg sm pay-seg">{LEAD_ST.map(([k, t]) => <button key={k} aria-pressed={st === k} onClick={() => setSt(k)}>{t}</button>)}</div>
        <label className="pfield"><span>Megjegyzés (csak neked)</span><textarea className="adm-in" rows={3} value={note} onChange={(e) => setNote(e.target.value)} /></label>
        <div className="pay-row"><button className="adm-ibtn" onClick={close}>Mégse</button><button className="adm-ibtn gold" disabled={busy} onClick={save}>{busy ? "…" : "Mentés"}</button></div>
      </div>
    </Sheet>
  );
}

/* the B2B line on the Fizetések page: B2B plans apart from the consumer packages */
export function B2BLine({ rows, fmtMoney }: { rows: D[]; fmtMoney: (usd: number) => string }) {
  const b = rows.filter((x) => String(x.plan || "").startsWith("b2b_")), c = rows.filter((x) => !String(x.plan || "").startsWith("b2b_"));
  const sum = (r: D[], k: string) => r.reduce((a, x) => a + n(x[k]), 0);
  if (!b.length) return null;
  return (
    <Card className="s12" icon={P.users} title="Szalonok (B2B) és vásárlók külön" sub="A szalon- és klinikacsomagok bevétele ebben az időszakban, a magánvásárlók csomagjaitól külön. A próba, az ajándék és a 0 Ft-os hónap nem bevétel. Részletek a Szalonok oldalon.">
      <div className="pay-row"><span>Szalonok: <b>{fmtMoney(sum(b, "usd"))}</b> · {fmt(sum(b, "sales"))} fizetés</span><span>Vásárlók: <b>{fmtMoney(sum(c, "usd"))}</b> · {fmt(sum(c, "sales"))} fizetés</span><a className="lnk" href="#b2b">Szalonok →</a></div>
    </Card>
  );
}
