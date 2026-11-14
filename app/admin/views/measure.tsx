"use client";
/* Two measuring aids (2026-11-14):
   BotNote: how many robot visits the visit numbers leave out (admin_bots_removed; the rule lives once in SQL, admin_bot_visits).
   WeeklyCohorts: accounts by sign-up week and how far each week's accounts got (admin_cohorts_weekly). */
import { Info, fmt, pct } from "../charts";
import { Card, P, n, useRpc, type D } from "../shared";
import { TRows, per } from "./traffic";

const BOT_RULE = "Robotnak számít a látogatás, ha Kínából jött, nincs forrása (se hivatkozó oldal, se utm-jelölés), és csak oldalmegnyitás van benne, egyetlen oldalon (az ugyanannak az oldalnak az újratöltése is ide tartozik). Ezek egyik látogatásszámban sincsenek benne; ha a látogatás később mást is csinál, azonnal visszakerül.";

/** "robotok kiszűrve: N" under a visit number. today: since Budapest midnight (the live page), otherwise the page's period. */
export function BotNote({ d, today, className = "note s12" }: { d: D; today?: boolean; className?: string }) {
  const q = useRpc("admin_bots_removed", per(d), [d.days, d.from, d.to, d.filter?.from]);
  const b = q.d as D | null;
  if (!b) return null;
  const v = today ? n(b.today) : n(b.n);
  return (
    <p className={className} style={{ margin: "-4px 0 0" }}>
      {today ? `ma robotok kiszűrve: ${fmt(v)}` : `robotok kiszűrve: ${fmt(v)} látogatás`}
      <Info>{BOT_RULE} {today ? `Az elmúlt órában ${fmt(n(b.hour))}.` : `Az előző időszakban ${fmt(n(b.prev))}.`}</Info>
    </p>
  );
}

const COLS: [string, string][] = [["photo", "Fotót töltött fel"], ["paywall", "Látta a fizetőfalat"], ["got", "Teasert vagy előnézetet kapott"], ["plan", "Csomagra bökött"], ["checkout", "Stripe-ot nyitott"], ["bought", "Vásárolt"]];

/** Weekly sign-up cohorts: each column counts the week's accounts that ever did it, with its % of the accounts. */
export function WeeklyCohorts() {
  const q = useRpc("admin_cohorts_weekly", { p_weeks: 8 }, []);
  const c = q.d as D | null;
  const rows = ((c?.rows || []) as D[]);
  const an: D = c?.anon || {};
  const tot = rows.reduce((o: D, r) => { ["accounts", ...COLS.map((x) => x[0])].forEach((k) => (o[k] = n(o[k]) + n(r[k]))); return o; }, {});
  return (
    <Card className="s12" icon={P.calendar} title="Heti kohorsz"
      sub={<>A fiókok a regisztráció hete szerint (az elmúlt 8 hét, budapesti idő, hétfőtől), a saját és tesztfiókok nélkül. Minden oszlop: a hét fiókjai közül hányan jutottak el idáig valaha, és a fiókok hány %-a.<Info>A fotó (photo_added), a fizetőfal (paywall_open, paywall_hit), a csomag (plan_pick) és a Stripe (checkout_open, checkout_start) eseményekből jön, ezek csak akkor köthetők fiókhoz, ha a látogató elfogadta a statisztikai sütiket és be volt lépve. A süti nélküli (névtelen) események senkihez nem köthetők, ezért itt nem számítanak. Az előnézet, a teaser és a vásárlás adatbázis-tény, minden fióknál látszik (a fotót az is jelzi, ha kapott teasert vagy előnézetet). Vásárlás: valódi fizetés, kézi jóváírás nélkül. {`Névtelenül ugyanebben a 8 hétben: ${fmt(n(an.plan))} csomagválasztás, ${fmt(n(an.checkout))} Stripe-megnyitás, ${fmt(n(an.paywall))} fizetőfal.`}</Info></>}>
      {q.e && !c ? <p className="note">{q.e}</p> : !c ? <div className="skel" style={{ height: 200 }} aria-busy="true" /> : (
        <TRows name="heti-kohorsz" all rows={[...rows, { wk: "", accounts: tot.accounts, ...Object.fromEntries(COLS.map(([k]) => [k, tot[k]])), total: true }]} empty="Még nincs fiók ebben a 8 hétben." cols={[
          { k: "wk", l: "Hét", r: (r) => (r.total ? <b>Összesen</b> : new Date(r.wk).toLocaleDateString("hu-HU", { month: "short", day: "numeric" }) + " –") },
          { k: "accounts", l: "Fiók", num: true, r: (r) => <b>{fmt(r.accounts)}</b> },
          ...COLS.map(([k, l]) => ({ k, l, num: true, r: (r: D) => <>{fmt(r[k])} <small className="mut">{n(r.accounts) ? pct(n(r[k]), n(r.accounts)) : "–"}</small></> })),
        ]} />
      )}
    </Card>
  );
}
