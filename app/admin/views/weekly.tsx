"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
/* Heti tölcsér (admin_weekly_funnel): week by week from the first page view to the second active day, and what helps or
   blocks it: the articles that bring no taps, where the new accounts come from, the intro goal, the preview errors and
   the "Your designs" picker. Own, reviewer and tester accounts are left out. The page has its own 4 / 8 / 12 weeks. */
import { useState } from "react";
import { BarList, Empty, Funnel, Info, fmt, pct } from "../charts";
import { Card, Lesson, Loading, P, n, type D, useRpc } from "../shared";
import { Hero, Trio } from "../ink";
import { TRows, Top } from "./traffic";
import { LoadErr, PhMore } from "./people";

const SQL_FILE = "supabase/2026-11-06-admin-funnel.sql";
const SRC: Record<string, [string, string]> = {
  google: ["Google", "a Google keresőből (utm vagy hivatkozó oldal)"], ai: ["ChatGPT és MI-asszisztensek", "chatgpt.com, Perplexity, Gemini, Copilot, claude.ai"],
  store: ["Áruházi app", "forrás nélkül, az Android- vagy iPhone-appból"], social: ["Közösségi oldalak", "TikTok, Instagram, Pinterest, Facebook és a többi"],
  direct: ["Közvetlen és egyéb", "link nélkül, más oldalról, vagy nincs elmentett forrás"],
};
const GOAL: Record<string, string> = { new: "Új tetoválást tervez", existing: "Meglévő tetoválását nézi", removal: "Eltávolítást nézi", explore: "Csak körülnéz", "–": "Nem válaszolt" };
const FROM: Record<string, string> = { idea: "Mentett ötlet", preview: "Már kipróbált minta", design: "Feltöltött minta", library: "Mintatár", "?": "nincs megadva" };
const REASON: Record<string, string> = { offline: "Nincs internet", paused: "Az MI-szolgáltatás szünetel (kredit, számlázás)", busy: "Túl sokan vannak (foglalt)", no_image: "Nem készült kép", photo: "A fotóval van gond", timeout: "Lejárt az idő", other: "Egyéb" };
const KIND: Record<string, string> = { tudastar: "Tudástár", tattoo: "Tetoválás-oldal", learn: "Learn (angol)" };
const wkL = (w: string) => new Date(String(w).slice(0, 10) + "T12:00:00").toLocaleDateString("hu-HU", { month: "short", day: "numeric" }) + " –";
const rate = (a: unknown, b: unknown) => (n(b) ? pct(n(a), n(b)) : "–");
const missing = (e: string) => /nincs telepítve|PGRST202|could not find|does not exist/i.test(e);

export function Weekly() {
  const [weeks, setWeeks] = useState(8);
  const { d, e, load, busy } = useRpc("admin_weekly_funnel", { p_weeks: weeks }, [weeks]);
  const pick = <div className="adm-seg sm">{[4, 8, 12].map((k) => <button key={k} aria-pressed={weeks === k} onClick={() => setWeeks(k)}>{k} hét</button>)}</div>;
  if (e && !d) return missing(e)
    ? <div className="g"><Lesson>Ehhez az oldalhoz még nincs fent az adatbázis-függvény. Futtasd le a <code>{SQL_FILE}</code> fájlt a Supabase SQL-szerkesztőjében (egyszer, egészben), utána frissítsd az oldalt.</Lesson></div>
    : <div className="g"><div className="s12"><LoadErr e={e} retry={load} busy={busy} /></div></div>;
  if (!d) return <Loading />;
  const W: D[] = d.weeks || [];
  /* the last whole week heads the page (the running one is still filling up); with one week only, that one */
  const last: D = W[1] || W[0] || {}, before: D = W[2] || {};
  const tot = (k: string) => W.reduce((s, x) => s + n(x[k]), 0);
  const arts: D[] = d.articles || [], flagged = arts.filter((a) => a.flag);
  const srcs: D[] = d.sources || [], goals: D[] = d.goals || [], errs: D[] = d.err_reasons || [], credit: D[] = d.credit_days || [], retry: D[] = d.retry_why || [], from: D[] = d.pick_from || [];
  const errWeeks = W.slice(0, Math.min(W.length, 8));
  const steps = [
    { k: "visits", l: "Látogatás", sub: "oldalmegtekintés, cookie nélkül (látogató-nap)", n: tot("visits") },
    { k: "cta", l: "Gombra kattintott", sub: "regisztráció / kipróbálás gomb", n: tot("cta_visits"), prev: tot("visits") },
    { k: "reg", l: "Megnyitotta a /regisztracio oldalt", n: tot("reg_visits"), prev: tot("cta_visits") },
    { k: "signups", l: "Új fiók", sub: "minden eszközről, az appokból is", n: tot("signups"), prev: tot("reg_visits") },
    { k: "made", l: "Elkészült az első előnézet", sub: "az ugyanazon a héten regisztráltak közül", n: tot("made"), prev: tot("signups") },
    { k: "day2", l: "Aktív egy 2. napon is", sub: "esemény, előnézet vagy mentés két külön napon", n: tot("day2"), prev: tot("made") },
  ];
  return (
    <div className="g ix">
      <Top pc><Hero flip label={<>Látogatásból új fiók, múlt héten<Info>A legutóbbi lezárt hét ({wkL(last.w || "")} vasárnapig): <b>{fmt(last.signups)}</b> új fiók <b>{fmt(last.visits)}</b> látogatásra. A látogatás cookie nélküli mérés, és naponta új azonosítót kap, ezért egy ember több napon több látogatásnak számít. Az új fiókok között az áruházi appokból jöttek is benne vannak, a látogatásokban nem: ez az arány ezért felfelé torzít. A saját, a tesztelő és az áruházi ellenőrző fiókok nincsenek benne.</Info></>}
        v={n(last.visits) ? (n(last.signups) / n(last.visits)) * 100 : 0} d={1} unit="%"
        sub={before.w ? <>előtte {rate(before.signups, before.visits)}</> : undefined}
        side={<Trio items={[{ l: "látogatás", v: fmt(last.visits) }, { l: "új fiók", v: fmt(last.signups) }, { l: "első előnézet", v: fmt(last.made) }]} />} /></Top>
      {flagged.length > 0 && <Lesson><b>{fmt(flagged.length)}</b> cikk vagy oldal kapott legalább 200 megtekintést az elmúlt {fmt(d.weeks_n)} hétben, de egyetlen gombnyomást sem: {flagged.slice(0, 3).map((a) => a.path).join(", ")}{flagged.length > 3 ? " …" : ""}. Ezeknél a gomb helye vagy szövege a legolcsóbb javítás.</Lesson>}

      <Card eager className="s12" icon={P.funnel} title="A tölcsér, összesen" right={pick} sub={`Az elmúlt ${fmt(d.weeks_n)} hét összesen (a folyó héttel együtt). Az első három lépés látogatásokat számol (weboldal, cookie nélkül), a többi fiókokat: az előnézet és a 2. nap azokat, akik ugyanebben az időszakban regisztráltak, akármikor tették meg. Az áruházi appokból regisztrálók a fiókoknál benne vannak, a látogatásoknál nem, ezért a fiók-lépés lehet nagyobb az előzőnél.`}>
        <Funnel steps={steps} accentK="made" />
      </Card>

      <Card className="s12" icon={P.calendar} title="Hétről hétre" sub="Hétfőtől vasárnapig, budapesti idő szerint; a legfelső sor a folyó hét, még nem teljes. A % mindig az előző lépéshez képest. A fiók-lépések (előnézet, 2. nap) a héten regisztráltakat követik, ezért a friss heteknél még nőhetnek.">
        <TRows all dense name="heti-tolcser" rows={W} empty="Még nincs adat." cols={[
          { k: "w", l: "Hét", r: (r) => <b>{wkL(r.w)}</b> },
          { k: "visits", l: "Látogatás", num: true, r: (r) => <><b>{fmt(r.visits)}</b> <small className="mut">{fmt(r.views)} oldal</small></> },
          { k: "cta_visits", l: "Gomb", num: true, r: (r) => <>{fmt(r.cta_visits)} <small className="mut">{rate(r.cta_visits, r.visits)}</small></> },
          { k: "reg_visits", l: "/regisztracio", num: true, r: (r) => <>{fmt(r.reg_visits)} <small className="mut">{rate(r.reg_visits, r.cta_visits)}</small></> },
          { k: "signups", l: "Új fiók", num: true, r: (r) => <><b>{fmt(r.signups)}</b> <small className="mut">{rate(r.signups, r.reg_visits)}</small></> },
          { k: "made", l: "Első előnézet", num: true, r: (r) => <>{fmt(r.made)} <small className="mut">{rate(r.made, r.signups)}</small></> },
          { k: "day2", l: "2. nap", num: true, r: (r) => <>{fmt(r.day2)} <small className="mut">{rate(r.day2, r.signups)}</small></> },
          { k: "day2_used", l: "Később is használta", num: true, r: (r) => <>{fmt(r.day2_used)} <small className="mut">{rate(r.day2_used, r.signups)}</small></> },
        ]} />
      </Card>

      <PhMore label="Cikkek, források, célok, hibák, mintaválasztó">
      <Card className="s12" icon={P.doc} title="Cikkek: megtekintés és gombnyomás" sub={`Minden /tudastar/…, /tattoo/… és /learn/… oldal az elmúlt ${fmt(d.weeks_n)} hétben, a megtekintések szerint. Gombnyomás: a regisztráció / kipróbálás gomb ezen az oldalon. Jelölve: legalább 200 megtekintés és egy gombnyomás sem.`}>
        <TRows name="cikk-konverzio" rows={arts} empty="Még nincs cikkmegtekintés." cols={[
          { k: "path", l: "Oldal", r: (r) => <span className="ix-tr-id"><span><b>{r.path}</b><small>{KIND[r.kind] || r.kind}{r.flag ? " · " : ""}{r.flag && <span className="chip warn">200+ megtekintés, 0 gomb</span>}</small></span></span> },
          { k: "views", l: "Megtekintés", num: true, r: (r) => <b>{fmt(r.views)}</b> },
          { k: "visits", l: "Látogatás", num: true, r: (r) => fmt(r.visits) },
          { k: "clicks", l: "Gombnyomás", num: true, r: (r) => fmt(r.clicks) },
          { k: "rate", l: "Arány", num: true, r: (r) => rate(r.click_visits, r.visits) },
        ]} />
      </Card>

      <Card className="s7" icon={P.traffic} title="Új fiókok forrás szerint" sub={`Az elmúlt ${fmt(d.weeks_n)} hét új fiókjai a fiókhoz mentett forrás szerint (profiles.signup_source: utm_source, a hivatkozó oldal, az első oldal). A forrás csak a statisztikát elfogadóknál mentődik el; akinél nincs, az a „Közvetlen és egyéb” csoportba kerül, és külön számoljuk. Áruházi app: forrás nélkül, és a fiók eseményei az Android- vagy iPhone-appból jöttek (az iPhone-app nem mindig küld eseményt, ezért ez alsó becslés).`}>
        <TRows all name="forras-fiok" rows={srcs} empty="Ebben az időszakban nem volt regisztráció." cols={[
          { k: "k", l: "Forrás", r: (r) => <span className="ix-tr-id"><span><b>{(SRC[r.k] || [r.k])[0]}</b><small>{(SRC[r.k] || ["", ""])[1]}{n(r.nosrc) ? ` · ${fmt(r.nosrc)} fióknál nincs mentett forrás` : ""}</small></span></span> },
          { k: "n", l: "Új fiók", num: true, r: (r) => <b>{fmt(r.n)}</b> },
          { k: "made", l: "Előnézetet készített", num: true, r: (r) => <>{fmt(r.made)} <small className="mut">{rate(r.made, r.n)}</small></> },
          { k: "day2", l: "2. nap", num: true, r: (r) => <>{fmt(r.day2)} <small className="mut">{rate(r.day2, r.n)}</small></> },
        ]} />
      </Card>
      <Card className="s5" icon={P.globe} title="A források részletesen" sub="Ami a csoportok mögött van: a hivatkozó oldal, vagy ha az nincs, az utm_source, ahogy érkezett. Mellette, hányan készítettek előnézetet.">
        <BarList items={((d.source_detail || []) as D[]).map((x) => ({ k: `${x.k} (${(SRC[x.grp] || [x.grp])[0]})`, n: n(x.n), sub: `${fmt(x.made)} előnézet` }))} max={10} empty="Még nincs regisztráció." />
      </Card>

      <Card className="s6" icon={P.target} title="A bevezető cél és az előnézet" sub={`Mit választottak az első kérdésnél (profiles.onboarding → goal) az elmúlt ${fmt(d.weeks_n)} hét új fiókjai, és közülük hányan készítettek előnézetet. Aki a kérdések előtt regisztrált, vagy kihagyta, az „Nem válaszolt”.`}>
        <TRows all name="cel-elonezet" rows={goals} empty="Még nincs válasz." cols={[
          { k: "k", l: "Cél", r: (r) => <b>{GOAL[r.k] || r.k}</b> },
          { k: "n", l: "Fiók", num: true, r: (r) => fmt(r.n) },
          { k: "made", l: "Előnézet", num: true, r: (r) => <>{fmt(r.made)} <small className="mut">{rate(r.made, r.n)}</small></> },
          { k: "day2", l: "2. nap", num: true, r: (r) => <>{fmt(r.day2)} <small className="mut">{rate(r.day2, r.n)}</small></> },
        ]} />
      </Card>

      <Card className="s6" icon={P.alert} title="Előnézet-hibák" sub="Hányszor nem sikerült egy előnézet (generate_error) a megkezdettekhez (generate_start) képest, hetente. Csak a statisztikát elfogadók látogatásaiból; a havi korlát elérése nem hiba, az nincs benne.">
        <TRows all name="hiba-hetente" rows={errWeeks} empty="Még nincs adat." cols={[
          { k: "w", l: "Hét", r: (r) => <b>{wkL(r.w)}</b> },
          { k: "gen_starts", l: "Indított", num: true, r: (r) => fmt(r.gen_starts) },
          { k: "gen_errors", l: "Hiba", num: true, r: (r) => <b>{fmt(r.gen_errors)}</b> },
          { k: "err_rate", l: "Arány", num: true, r: (r) => <span className={n(r.gen_starts) >= 10 && n(r.gen_errors) / n(r.gen_starts) > 0.1 ? "down" : ""}>{rate(r.gen_errors, r.gen_starts)}</span> },
          { k: "gen_retries", l: "Újrapróbálás", num: true, r: (r) => fmt(r.gen_retries) },
          { k: "credit_out", l: "MI-kredit elfogyott", num: true, r: (r) => (n(r.credit_out) ? <b className="down">{fmt(r.credit_out)}</b> : "0") },
        ]} />
        {retry.length > 0 && <p className="note">Automatikus újrapróbálás oka: {retry.map((x) => `${REASON[x.k] || x.k}: ${fmt(x.n)}`).join(", ")}.</p>}
      </Card>
      <Card className="s12" icon={P.alert} title="A hibák oka" sub={`Az ok, amit az app küld (2026-11-06 óta); a régebbi hibáknál a HTTP-kódból és az üzenetből soroljuk be ugyanígy (0 = nincs internet; „paused / credit / billing” = szünetel; „Lots of people” = foglalt; „could not be created / IMAGE_OTHER” = nem készült kép). Az elmúlt ${fmt(d.weeks_n)} hét, hetenként; az első hét-oszlop a folyó hét. Alatta a leggyakoribb üzenetek.`}>
        {errs.length ? <TRows all dense name="hiba-okok" rows={errs} cols={[
          { k: "k", l: "Ok", r: (r) => <span className="ix-tr-id"><span><b>{REASON[r.k] || r.k}</b><small>utoljára {new Date(r.last).toLocaleString("hu-HU", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}{((r.msgs || []) as D[]).length ? " · " + ((r.msgs || []) as D[]).map((m) => `${m.msg} (${fmt(m.n)})`).join(" · ") : ""}</small></span></span> },
          { k: "n", l: "Összesen", num: true, r: (r) => <b>{fmt(r.n)}</b> },
          ...errWeeks.slice(0, 6).map((x) => ({ k: "w_" + String(x.w).slice(0, 10), l: wkL(x.w), num: true, r: (r: D) => fmt(n((r.wk || {})[String(x.w).slice(0, 10)])) })),
        ]} /> : <Empty t="Nem volt előnézet-hiba ebben az időszakban." />}
      </Card>

      <Card className="s12" icon={P.bolt} title="MI-szolgáltató: elfogyott a kredit" sub={`Szerverhiba „credits are depleted” üzenettel, naponta (budapesti nap), az elmúlt ${fmt(d.weeks_n)} hétben. 2026-10-18-án ez okozta a legtöbb sikertelen előnézetet: ilyenkor senkinek nem készül előnézet, amíg fel nem töltöd a kreditet.`}
        noData={credit.length ? undefined : "Nem fogyott el a kredit ebben az időszakban."}>
        {credit.length ? <BarList items={credit.map((x) => ({ k: String(x.t).slice(0, 10), n: n(x.n) }))} fmtK={(k) => new Date(k + "T12:00:00").toLocaleDateString("hu-HU", { month: "short", day: "numeric", weekday: "short" })} max={14} /> : <Empty t="Nem fogyott el a kredit ebben az időszakban." />}
      </Card>

      <Card className="s12" icon={P.layers} title="„Your designs” mintaválasztó" sub={`A + gomb után nyíló választó (mentett ötletek, kipróbált minták, feltöltések, mintatár): hányszor nyitották meg, és honnan választottak mintát.${d.pick_since ? ` Mérés: ${new Date(d.pick_since).toLocaleDateString("hu-HU", { month: "short", day: "numeric" })} óta.` : ""} Az „Új minta”, a „Meglévő tetoválás” és az „Eltávolítás” gomb itt nem küld eseményt, ezért nincs benne.`}>
        <div className="mini-stats" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
          <div className="mini"><span>Megnyitás</span><b>{fmt(tot("pick_open"))}</b><small>{fmt(tot("pick_visits"))} látogatásban</small></div>
          <div className="mini"><span>Mintát választott</span><b>{fmt(tot("pick_design"))}</b><small>{rate(tot("pick_design"), tot("pick_open"))} a megnyitásokhoz</small></div>
          <div className="mini"><span>Múlt héten</span><b>{fmt(last.pick_open)}</b><small>megnyitás · {fmt(last.pick_design)} választás</small></div>
        </div>
        <BarList items={from.map((x) => ({ k: x.k, n: n(x.n), sub: `${fmt(x.visits)} látogatás` }))} fmtK={(k) => FROM[k] || k} empty="Még senki nem választott mintát a választóból." />
      </Card>
      </PhMore>
    </div>
  );
}
