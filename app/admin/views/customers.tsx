"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
/* Vevők: every account that paid (admin_pay_customers): what each one is worth, where they came from, whether they
   used what they bought and liked it, and their whole story one tap away. InkAge takes no payments yet: the page stays
   empty (and says so) until the first buyer; product names come from the data. */
import { useState } from "react";
import { BarList, Empty, fmt, pct } from "../charts";
import { Card, Lesson, Loading, P, Tbl, ago, lang, n, type D, useRpc } from "../shared";
import { Hero, Trio } from "../ink";
import { countryName } from "../visuals";
import { Top } from "./traffic";
import { PageErr } from "./people";
import { BuyerDrawer, CurPick, M, Mail, STORE_S, chName, planKey, useCur } from "./pay-shared";

export function Customers({ days }: { days: number }) {
  const [qs, setQs] = useState(""); const [term, setTerm] = useState("");
  const q = useRpc("admin_pay_customers", { p_days: days || 3650, p_q: term || null }, [days, term]);
  const fx = useRpc("admin_payments", { p_days: 1 }, []);
  const huf = n(fx.d?.fx?.huf) || 360;
  const { cur, setCur } = useCur();
  const $ = (usd: number) => M(usd, cur, huf);
  const [u, setU] = useState<string | null>(null);
  const [only, setOnly] = useState<"all" | "repeat" | "multi" | "unused" | "unhappy" | "refund">("all");
  const d = q.d;
  if (q.e && !d) return <PageErr e={q.e} retry={q.load} busy={q.busy} />;
  if (!d) return <Loading />;
  const rows: D[] = (d.rows || []).filter((r: D) => only === "all" || (only === "repeat" ? n(r.sales) > 1 : only === "multi" ? n(r.names) > 1 : only === "unused" ? !n(r.claims) && n(r.sales) > 0 : only === "unhappy" ? n(r.low_after) > 0 && n(r.low_after) <= 2 : n(r.refunds) > 0));
  return (
    <div className="g ix pay">
      <Top><Hero flip label="Egy vevő átlagosan ennyit hozott" text={d.ltv == null ? "–" : $(n(d.ltv))} sub={<>{n(d.n) ? <>{fmt(d.n)} vevő ebben az időszakban · {fmt(d.repeat)} vett többször · {fmt(d.multi_name)} több névre</> : "Még nincs vevő: az InkAge még nem fogad fizetést."}</>} side={<CurPick cur={cur} set={setCur} />} /></Top>
      <Trio items={[
        { l: "Megvette, de nem használta", v: n(d.unused), run: () => setOnly("unused") },
        { l: "Elégedetlen (1–2 csillag)", v: n(d.unhappy), run: () => setOnly("unhappy") },
        { l: "Több névre vett", v: n(d.multi_name), run: () => setOnly("multi") },
      ]} />
      {n(d.unused) > 0 && <Lesson><b>{fmt(d.unused)} vevő még nem használta</b>, amit vett. Ők kérik vissza a legkönnyebben a pénzt: írj nekik egy rövid segítő üzenetet (a vevő adatlapján a fizetésre koppintva van kész válaszsablon).</Lesson>}
      <Card className="s7" icon={P.traffic} title="Melyik csatorna vevője ér többet" sub="Egy vevő átlagos értéke (minden vásárlása, a visszatérítések nélkül) a regisztrációt hozó csatorna szerint. Nem a legtöbb vevő a fontos, hanem a legtöbb pénz egy vevőre.">
        <BarList items={((d.ltv_by_ch || []) as D[]).map((x) => ({ k: chName(x.ch), n: n(x.ltv), sub: `${fmt(x.buyers)} vevő · összesen ${$(n(x.usd))}` }))} fmtK={(k) => k} empty="Még nincs vevő." />
      </Card>
      <Card className="s5" icon={P.users} title="Ajándék-ötlet" sub="Akik egynél több névre vettek: valószínűleg valaki másnak is (párjuknak, barátjuknak). Ha sokan vannak, megéri egy „Ajándékozd meg” lehetőség.">
        <div className="pay-conv"><div><b>{fmt(d.multi_name)}</b><small>vevő vett több névre</small></div><div><b>{pct(n(d.multi_name), Math.max(1, n(d.n)))}</b><small>a vevők közül</small></div></div>
      </Card>
      <Card className="s12" icon={P.doc} title="Minden vevő" sub="Koppints egy vevőre: az útja az első látogatástól (honnan jött, mit vett, mit használt, hány csillagot adott), és onnan visszatérítés, név javítása, kézi vásárlás. Keresés e-mail címre vagy névre."
        right={<div className="pay-row"><form onSubmit={(e) => { e.preventDefault(); setTerm(qs.trim()); }}><input className="adm-in sm" value={qs} onChange={(e) => setQs(e.target.value)} placeholder="Keresés: e-mail vagy név" aria-label="Keresés a vevők között" /></form>
          <div className="adm-seg sm pay-seg">{([["all", "Mind"], ["repeat", "Többször"], ["multi", "Több név"], ["unused", "Nem használta"], ["unhappy", "Elégedetlen"], ["refund", "Visszatérített"]] as const).map(([k, l]) => <button key={k} aria-pressed={only === k} onClick={() => setOnly(k)}>{l}</button>)}</div></div>}>
        {rows.length ? <Tbl name="vevok" rows={rows} onRow={(r) => setU(String(r.user_id))} cols={[
          { k: "email", l: "Fiók", ph: "name", r: (r) => <Mail e={r.email} /> },
          { k: "usd", l: "Összesen", num: true, ph: "main", r: (r) => <b>{$(n(r.usd) - n(r.refund_usd))}</b> },
          { k: "sales", l: "Vásárlás", num: true },
          { k: "plans", l: "Termék", r: (r) => ((r.plans || []) as string[]).map((p) => planKey(p)).join(", ") },
          { k: "names_list", l: "Név", ph: "sub", r: (r) => <span className="cap">{((r.names_list || []) as string[]).join(", ")}</span> },
          { k: "ch", l: "Honnan", ph: "hide", r: (r) => r.account || chName(r.ch) },
          { k: "stores", l: "Hol", ph: "hide", r: (r) => ((r.stores || []) as string[]).map((s) => STORE_S[s] || s).join(", ") },
          { k: "claims", l: "Használat", num: true, ph: "hide", r: (r) => n(r.claims) ? fmt(r.claims) : <span className="bad">0</span> },
          { k: "stars", l: "Csillag", num: true, ph: "hide", r: (r) => r.stars == null ? <span className="mut">–</span> : <span className={n(r.low_after) && n(r.low_after) <= 2 ? "bad" : ""}>{r.stars}</span> },
          { k: "lang", l: "Nyelv", ph: "hide", r: (r) => (r.lang ? lang(r.lang) : "–") },
          { k: "country", l: "Ország", ph: "hide", r: (r) => (r.country ? countryName(r.country) : "–") },
          { k: "last_at", l: "Utoljára", ph: "hide", r: (r) => ago(r.last_at) },
        ]} /> : <Empty t={term ? "Nincs ilyen vevő." : "Még nincs vevő."} />}
      </Card>
      {u && <BuyerDrawer id={u} close={() => setU(null)} />}
    </div>
  );
}
