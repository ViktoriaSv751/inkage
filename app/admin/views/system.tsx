"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useContext, useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Delta, Empty, fmt } from "../charts";
import { StatusRows } from "../wow";
import { Async, Band, Card, ERRS, FreshCtx, HIDDEN, Kpi, P, PROV, SRC_L, StateErr, Tbl, ago, api, barCell, dt, ev, fixNote, freshOf, human, markSolved, n, periodName, rpc, series, solvedAt, type D, useFlt, usePeriod, useRpc } from "../shared";
import { PushCard } from "../extra";
import { toast } from "../phone";
import { cronHu, jobState } from "./monitor";

/* ---------- system: the settings and the security (Monitoring is how things run) ---------- */
const PFS: [string, string][] = [["tiktok", "TikTok"], ["instagram", "Instagram"], ["facebook", "Facebook"], ["pinterest", "Pinterest"], ["linkedin", "LinkedIn"], ["youtube", "YouTube"]];
export function System({ d: dFiltered }: { d: D }) {
  /* errors never follow the channel / language filter: with a filter on, the page reads the unfiltered numbers */
  const { f } = useFlt(), per = usePeriod();
  const filtered = !!(f.ch || f.lang);
  const raw = useRpc(filtered ? "admin_dashboard" : "admin_fresh", filtered ? { p_days: per.days, p_from: per.p_from, p_to: per.p_to, p_ch: null, p_lang: null } : undefined, [filtered, per.days, per.p_from, per.p_to]);
  const d: D = filtered && raw.d && (raw.d as D).now ? (raw.d as D) : dFiltered;
  const [mail, setMail] = useState<D | null>(null);
  useEffect(() => { api("/api/email-status").then((r) => setMail(r.ok ? r.json : { error: true })).catch(() => setMail({ error: true })); }, []);
  const names = Array.from(new Set([...Object.keys(d.counts || {}), ...Object.keys(d.counts_prev || {})]));
  const rows = names.filter((k) => !HIDDEN.has(k)).map((k) => ({ k, n: n(d.counts?.[k]), p: n(d.counts_prev?.[k]) })).sort((a, b) => b.n - a.n);
  const maxE = Math.max(1, ...rows.map((r) => r.n));
  const ok = (v: any) => v ? <span className="chip good">működik</span> : <span className="chip bad">nincs beállítva</span>;
  const [, setTick] = useState(0);
  const sfAll = (d.signin_fail || []) as D[], sf = sfAll.filter((x) => !solvedAt(x));
  const [st, setSt] = useState<D | null>(null);
  useEffect(() => { api("/api/admin/status").then((r) => setSt(r.ok ? r.json : null)).catch(() => {}); }, []);
  const mon = useRpc("admin_monitor", undefined, []);
  const lockSt = useRpc("admin_server_lock_status", undefined, []);
  const fresh = useContext(FreshCtx);
  const cron: D[] = (mon.d as D)?.cron || [];
  const job = (k: string) => cron.find((c) => c.jobname === k);
  const st2 = (k: string) => { const c = job(k); return c ? jobState(c) : null; };
  const sync = job("admin-sync"), digest = job("admin-digest"), weekly = job("admin-weekly");
  const badJobs = cron.filter((c) => jobState(c).tone === "bad");
  const hb = (mon.d as D)?.heartbeat as string | undefined;
  const openErr = ((mon.d as D)?.errors || []).filter((x: D) => x.state === "open" || x.regressed).length;
  /* every service in one row: a key alone is not "working"; a platform is green when its last sync went through */
  const plat = (k: string, l: string) => {
    const p = fresh?.platforms?.[k], x = freshOf(fresh, k);
    return { l, ok: p ? (p.error ? false : x.ok ? true : null) : st ? (st[k] ? null : null) : null,
      note: p ? (p.error ? "a lehúzás hibára fut" : `utolsó lehúzás ${ago(p.at)}`) : st?.[k] ? "kulcsok megvannak, nincs összekapcsolva" : "nincs bekötve" };
  };
  const src = (k: string, l: string, set: boolean | undefined) => { const x = fresh?.src?.[k]; return { l, ok: x ? (x.error ? false : freshOf(fresh, k).ok ? true : null) : set ? null : null, note: x ? (x.error ? "az utolsó futás hibás" : `utoljára ${ago(x.at)}`) : set ? "beállítva, még nem futott" : "nincs beállítva" }; };
  return (
    <div className="g">
      {mon.d && !((mon.d as D)?.push?.devices || []).length && (st ? !st.email : mail ? !mail.resend_api_key : false) && (
        <div className="alert err s12"><b>Most semmilyen jelzés nem jut el hozzád.</b> Egyetlen eszköz sincs feliratkozva a telefonos értesítésekre (0 eszköz), és nincs beállítva e-mail-kulcs (<code>RESEND_API_KEY</code>). Kapcsold be az értesítést lent az „Értesítések a telefonra” kártyán ezen a telefonon, és add meg a Resend-kulcsot a <a className="lnk" href="#connect">Kapcsolatok</a> oldalon.</div>)}
      <SelfCheck />
      <Card className="s12" icon={P.check} title="Állapot" sub="Minden szolgáltatás egy sorban, a valódi működés szerint (nem csak hogy van-e kulcs). Zöld: működik; sárga: be van állítva, de még nincs friss eredmény; piros: hiba. A részletek a Monitoringban. Naponta 7 órakor (budapesti idő) egy ellenőrzés is lefut: e-mailt csak akkor küld, ha valami nem működik, hétfőn pedig akkor is, ha minden rendben."
        right={<button className="adm-ibtn sm" onClick={async () => { toast("Ellenőrzés…"); const r = await api("/api/admin/health", { method: "POST" }); toast(r.ok ? (r.json?.problems ? `${r.json.problems} probléma · e-mail: ${r.json.email}` : `Minden rendben · e-mail: ${r.json?.email}`) : r.json?.error || "Nem sikerült."); }}>Napi ellenőrzés most</button>}>
        <StatusRows rows={[
          { l: "Weboldal és app", ok: openErr === 0 ? true : openErr < 5 ? null : false, note: mon.d ? (openErr ? `${fmt(openErr)} nyitott hibacsoport` : "nincs nyitott hiba") : "ellenőrzés…", days: series(d, "errors") },
          { l: "Adatbázis és időzítő", ok: hb ? Date.now() - new Date(hb).getTime() < 15 * 60e3 : null, note: hb ? `az 5 perces mérés ${ago(hb)} futott` : "ellenőrzés…" },
          { l: "Reggeli lehúzás", ok: sync ? st2("admin-sync")!.tone === "good" ? true : st2("admin-sync")!.tone === "bad" ? false : null : null, note: sync ? `${cronHu(sync.schedule)} · ${st2("admin-sync")!.t}` : "ellenőrzés…" },
          { l: "Időzített feladatok", ok: mon.d ? !badJobs.length : null, note: mon.d ? (badJobs.length ? `${badJobs.length} hibás: ${badJobs.slice(0, 3).map((c) => c.jobname.replace("admin-", "")).join(", ")}` : `mind a ${cron.length} rendben`) : "ellenőrzés…" },
          { l: "Reggeli összefoglaló", ok: st?.digest_missing ? false : digest ? st2("admin-digest")!.tone !== "bad" : null, note: st?.digest_missing ? "ma nem ment ki" : digest ? `${cronHu(digest.schedule)} · ${st2("admin-digest")!.t}` : "ellenőrzés…" },
          { l: "Heti riport", ok: weekly ? st2("admin-weekly")!.tone !== "bad" : null, note: weekly ? `${cronHu(weekly.schedule)} · ${st2("admin-weekly")!.t}` : "–" },
          { l: "E-mail-küldés", ok: mail ? !!mail.resend_key_works : null, note: mail ? (mail.resend_key_works ? "a levelek mennek" : mail.resend_api_key ? "a Resend-kulcs nem működik" : "nincs RESEND_API_KEY: se a napi ellenőrzés, se a riasztás e-mailje nem megy ki") : "ellenőrzés…" },
          /* the lock and the second step: red until both are on (the keys and tokens are otherwise readable from a signed-in browser) */
          { l: "Kulcsok zárva a szervernek", ok: lockSt.d ? !!(lockSt.d as D).locked : null, note: lockSt.d ? ((lockSt.d as D).locked ? "bekapcsolva: a kulcsokat és a tokeneket csak a szerver olvassa" : "kikapcsolva: lent, a „Kulcsok csak a szervernek” kártyán kapcsolható be") : "ellenőrzés…" },
          { l: "Belépés (Google, Apple)", ok: sf.length ? false : true, note: sf.length ? `${fmt(sf.reduce((a, x) => a + n(x.n), 0))} sikertelen belépés` : "rendben" },
          ...PFS.map(([k, l]) => plat(k, l)),
          { l: "Google Search Console", ok: fresh?.gsc?.at ? freshOf(fresh, "gsc").ok : st ? (st.gsc ? null : null) : null, note: fresh?.gsc?.at ? `utolsó lehúzás ${ago(fresh.gsc.at)}` : st?.gsc ? "kulcs megvan, még nem futott" : "nincs bekötve" },
          src("bing", "Bing", st?.bing), src("cse", "Programmable Search", st?.cse),
          { l: "App Store", ok: fresh?.apple ? freshOf(fresh, "apple").ok : null, note: fresh?.apple ? `utolsó lehúzás ${ago(fresh.apple)}` : st?.apple ? "kulcsok megvannak, még nem futott" : "nincs bekötve" },
          { l: "Google Play", ok: fresh?.google ? freshOf(fresh, "google").ok : null, note: fresh?.google ? `utolsó lehúzás ${ago(fresh.google)}` : st?.google_play ? "kulcs megvan, még nem futott" : "nincs bekötve" },
          { l: "MI-elemzés", ok: st ? (st.ai ? true : false) : null, note: st?.ai ? `Anthropic${st.openai ? ", OpenAI" : ""}${st.perplexity ? ", Perplexity" : ""}` : "nincs MI-kulcs" },
          { l: "Telegram", ok: st ? (st.telegram ? true : null) : null, note: st?.telegram ? "beállítva" : "nincs beállítva (nem kötelező)" },
          { l: "Push-értesítés", ok: (mon.d as D)?.push ? ((mon.d as D).push.devices || []).length ? !((mon.d as D).push.devices as D[]).some((x) => n(x.fails) >= 3) : false : null, note: (mon.d as D)?.push ? (((mon.d as D).push.devices || []).length ? `${((mon.d as D).push.devices || []).length} eszköz` : "0 eszköz: egyetlen eszköz sincs feliratkozva, a jelzések senkihez nem jutnak el (lent: „Értesítések a telefonra”)") : "–" },
          { l: "E-mail-események (Resend webhook)", ok: st ? (st.resend_webhook ? true : null) : null, note: st?.resend_webhook ? "beállítva" : "nincs beállítva" },
          { l: "Elérhetőség", ok: (mon.d as D)?.uptime ? !((mon.d as D).uptime as D[]).some((u) => u.on_ !== false && u.last && !u.last.ok) : null, note: (mon.d as D)?.uptime ? `${((mon.d as D).uptime as D[]).length} cím, 5 percenként` : "–" },
        ]} />
        {mon.e && <StateErr msg={mon.e} retry={mon.load} small />}
      </Card>
      <Card className="s6" icon={P.bell} title="Értesítések a telefonra" sub="Web Push, harmadik fél nélkül: a jelzés tartalma nem megy át a push-szolgáltatón, az értesítés megjelenésekor a telefon maga kérdezi le (belépve)."><PushCard /><PushPrefs /></Card>
      <Card className="s6" icon={P.user} title="Biztonság" sub="Kétlépcsős belépés hitelesítő alkalmazással, a többi eszköz kiléptetése, automatikus kiléptetés tétlenség után, és a háttérfeladatok tokenjének cseréje."><Security /></Card>
      <Card className="s6" icon={P.user} title="Belépések" sub="Hol vagy most belépve az irányítóközpontba, és az utolsó belépések. Az eddig nem látott eszközt „új eszköz” jelöli: ha nem te voltál, léptesd ki a többi eszközt, és változtass jelszót."><Signins /></Card>
      <Card className="s6" icon={P.system} title="Hibát jeleztek a kommentekben" sub="A postafiók „Hiba” címkéjű kommentjei és véleményei az elmúlt 30 napból: ezek a felhasználók szerint nem működő dolgok."><Bugs /></Card>
      <Card className="s6" icon={P.bolt} title="Kulcsok csak a szervernek" sub="Biztonsági zár: utána a platformkulcsokat (Vault) csak a szerver olvashatja a saját tokenjével, a böngészőből belépve sem."><ServerLock /></Card>
      <Card className="s6" icon={P.clock} title="Lehúzások és összefoglalók" sub="Az utolsó futások röviden. A teljes napló, az időzített feladatok kapcsolói és a „Futtatás most” a Monitoring oldalon van.">
        <Async q={mon} h={120}>{(m) => <>
          <ul className="srv-errs">{((m.runs || []) as D[]).filter((r) => /digest|sync/.test(r.job)).slice(0, 6).map((r) => <li key={r.id} className={r.ok === false ? "bad" : ""}><b>{r.job.includes("weekly") ? "Heti riport" : r.job.includes("digest") ? "Reggeli összefoglaló" : r.job.includes("only=") ? "Lehúzás: " + (SRC_L[r.job.split("only=")[1]] || r.job.split("only=")[1]) : "Reggeli lehúzás"}</b><span>{r.ok == null ? "fut…" : r.ok ? "✓ " : "✕ "}{String(r.message || "").slice(0, 120)}</span><small>{ago(r.started_at)}{r.via === "admin" ? " · kézi" : ""}</small></li>)}</ul>
          {!((m.runs || []) as D[]).length && <Empty t="Az első futás a frissítés telepítése után jelenik meg." />}
          <div className="adm-row"><a className="adm-ibtn sm" href="#monitor">Monitoring →</a>{mail?.sending_domain && <span className="note">Feladó: {mail.from_address_domain} · {mail.sending_domain.status === "verified" ? "igazolva" : mail.sending_domain.status}</span>}</div>
        </>}</Async>
      </Card>
      <Band plain label={`Hibák ${periodName(d)}`} value={n(d.now?.errors)} now={n(d.now?.errors)} prev={n(d.prev?.errors)} invert sentence={sf.length ? <>Ebből <b>{fmt(sf.reduce((a, x) => a + n(x.n), 0))}</b> sikertelen belépés ({PROV[sf[0].provider] || sf[0].provider}): <b>{human(sf[0].why)}</b></> : <>Nincs nyitott sikertelen belépés. A mérés {d.first_event ? new Date(d.first_event).toLocaleDateString("hu-HU", { month: "long", day: "numeric" }) : "–"} óta fut.</>} />
      <Kpi kind="own" to="monitor" tone="butter" className="s4" icon={P.user} l="Sikertelen belépés" v={fmt(sf.reduce((s, x) => s + n(x.n), 0))} sub={<span>{fmt(sf.reduce((s, x) => s + n(x.sessions), 0))} embernél</span>} />
      <Kpi kind="own" to="monitor" tone="pink" className="s4" icon={P.alert} l="Nyitott hibacsoport" v={mon.d ? fmt(openErr) : "…"} sub={<a href="#monitor">a Monitoringban kezelhetők →</a>} />
      <Kpi kind="own" to="@next" tone="sky" className="s4" icon={P.calendar} l="Mérés kezdete" v={d.first_event ? new Date(d.first_event).toLocaleDateString("hu-HU", { month: "short", day: "numeric" }) : "–"} sub={<span>{fmt(d.all?.events)} esemény összesen</span>} />
      {sfAll.length > 0 && (
        <Card className="s12" icon={P.alert} title="Sikertelen belépések" sub="Amikor a Google- vagy Apple-belépés nem sikerül. Ezek valódi felhasználók, akik nem tudtak belépni. A „Megoldva” az adatbázisba kerül: a Monitoring azonos hibacsoportja is megoldott lesz, minden eszközön.">
          <Tbl rows={sfAll} cols={[
            { k: "provider", l: "Belépés", r: (x) => <span className="chip bad">{PROV[x.provider] || x.provider}</span> },
            { k: "why", l: "Hibaüzenet", r: (x) => <span className="cellwrap" style={{ display: "block" }} title={x.why || ""}><b>{human(x.why)}</b></span> },
            { k: "x", l: "Állapot", r: (x) => solvedAt(x) ? <span className="chip good">✓ {fixNote(x)}</span> : <button className="adm-ibtn sm" onClick={(e) => { e.stopPropagation(); markSolved(x); toast("Megoldottnak jelölve"); setTick((t) => t + 1); }}>Megoldva</button> },
            { k: "n", l: "Darab", num: true, r: (x) => <b>{fmt(x.n)}</b> }, { k: "sessions", l: "Ember", num: true, r: (x) => fmt(x.sessions) }, { k: "last", l: "Utoljára", r: (x) => ago(x.last) },
          ]} />
        </Card>
      )}
      <Card className="s6" icon={P.mail} title="E-mail-küldés" sub="Resend és a regisztrációs levelek állapota, élőben lekérdezve. Az app saját levelei (regisztráció, jelszó) a Vercelben megadott kulcsot használják; a Kapcsolatok oldalon megadott kulcs a reggeli összefoglalót küldi.">
        {!mail ? <div className="skel" style={{ height: 120 }} /> : mail.error ? <StateErr msg="Nem sikerült lekérdezni." retry={() => { setMail(null); api("/api/email-status").then((r) => setMail(r.ok ? r.json : { error: true })).catch(() => setMail({ error: true })); }} /> : (
          <dl className="kv">
            <dt>Resend kulcs</dt><dd>{ok(mail.resend_key_works)}</dd>
            <dt>Küldő domain</dt><dd>{mail.sending_domain ? <>{mail.sending_domain.name} <span className={"chip " + (mail.sending_domain.status === "verified" ? "good" : "warn")}>{mail.sending_domain.status}</span></> : "–"}</dd>
            <dt>Regisztráció megerősítése</dt><dd>{ok(mail.emails?.signup_confirmation)}</dd>
            <dt>Jelszó-visszaállítás</dt><dd>{ok(mail.emails?.password_reset)}</dd>
            <dt>Üdvözlő levél</dt><dd>{ok(mail.emails?.welcome)} <span style={{ color: "var(--a-dim)" }}>· {fmt(d.users?.welcome_sent)} kiküldve</span></dd>
            <dt>Jelszó megváltozott</dt><dd>{ok(mail.emails?.password_changed)}</dd>
          </dl>
        )}
      </Card>
      <Card className="s6" icon={P.layers} title="Adatok" sub="Mit mérünk és mit nem.">
        <dl className="kv">
          <dt>Mentett előnézetek</dt><dd>{fmt(d.unlocks?.with_design)} / {fmt(d.all?.unlocks)} mentett előnézet</dd>
          <dt>Adat generálva</dt><dd>{dt(d.generated_at)}</dd>
          <dt>Tesztlátogatások</dt><dd>kiszűrve (utm „test”, „qa”)</dd>
          <dt>iPhone-app</dt><dd>nem küld használati adatot (App Store 5.1.1): az iOS-felhasználók csak a regisztrációknál látszanak</dd>
        </dl>
      </Card>
      <Card className="s12" icon={P.layers} title="Minden esemény" sub={`Az összes mért esemény ${periodName(d)}, az előző időszakhoz mérve.`}>
        <Tbl rows={rows} cols={[
          { k: "k", l: "Esemény", r: (x) => <div><b style={{ color: ERRS.has(x.k) ? "var(--a-bad)" : undefined }}>{ev(x.k)}</b><div className="mut" style={{ fontSize: 11.5 }}>{x.k}</div></div> },
          { k: "n", l: "Most", num: true, r: (x) => barCell(x.n, maxE, <b>{fmt(x.n)}</b>) }, { k: "p", l: "Előtte", num: true, r: (x) => fmt(x.p) },
          { k: "d", l: "Változás", num: true, r: (x) => <Delta now={x.n} prev={x.p} invert={ERRS.has(x.k)} /> },
        ]} />
      </Card>
    </div>
  );
}

/* Do the numbers agree with each other? Platform totals against the posts we hold, the freshness of every source,
   the day summaries against the events, how far behind Google is, the scheduled runs and the measuring itself.
   A failed check stays on screen with "Újra" (it never just disappears). */
function SelfCheck() {
  const q = useRpc("admin_selfcheck", undefined, []);
  const rows: D[] = Array.isArray(q.d) ? q.d : [];
  const bad = rows.filter((r) => r.ok === false).length;
  const show = (v: any) => (v == null ? "–" : typeof v === "number" ? fmt(v) : /^\d{4}-\d\d-\d\dT/.test(String(v)) ? ago(String(v)) : String(v));
  return (
    <Card className="s12" icon={P.check} title="Önellenőrzés" sub="A számok egyeznek-e egymással: a platform szerinti posztszám a nálunk lévővel, a napi összesítő az eseményekkel, milyen frissek az adatok, lefutottak-e a lehúzások, és él-e a mérés."
      right={q.d ? <span className={"chip " + (bad ? "warn" : "good")}>{bad ? `${bad} eltérés` : "minden egyezik"}</span> : undefined}>
      <Async q={q} h={90}>{() => <ul className="selfck">{rows.map((r) => <li key={r.k} className={r.ok == null ? "na" : r.ok ? "ok" : "bad"}><i>{r.ok == null ? "–" : r.ok ? "✓" : "!"}</i><b>{r.what}</b><span>{show(r.found)} <small>({r.note}; elvárt: {show(r.expected)})</small></span></li>)}</ul>}</Async>
    </Card>
  );
}

/* ---------- which signals reach the phone, and when not ---------- */
const KINDS: [string, string][] = [["evening", "Esti összefoglaló (21:00)"], ["viral", "Gyorsan terjedő poszt (első 3 óra)"], ["rising", "Robbanó poszt"], ["inbox", "Új komment, vélemény"], ["record", "Rekordnap"], ["errors", "Hibahullám"], ["account", "Hibás kapcsolat"], ["index", "Kiesett a Google-ből"],
  ["mention", "Új említés"], ["rule", "Riasztási szabály"], ["expiry", "Lejáró kapcsolat"], ["cert", "Tanúsítvány, domain"], ["run", "Hibás futás"], ["sync", "Hibás lehúzás"], ["digest", "Elmaradt összefoglaló"], ["heartbeat", "Leállt mérés"], ["publish", "Publikálás"]];
function PushPrefs() {
  const sb = useMemo(() => supabaseBrowser(), []);
  const q = useRpc("admin_push_prefs", undefined, []);
  const [p, setP] = useState<{ off: string[]; quiet: { from: string; to: string } | null; batch?: number } | null>(null);
  useEffect(() => { if (q.d) setP({ off: Array.isArray((q.d as D).off) ? (q.d as D).off : [], quiet: (q.d as D).quiet || null, batch: Number((q.d as D).batch) || 0 }); else if (q.e) setP({ off: [], quiet: null }); }, [q.d, q.e]);
  const save = async (x: typeof p) => { if (!x) return; setP(x); const r = await rpc(sb, "admin_push_prefs_save", { p: x }); toast(r.error ? "Nem sikerült: " + r.error.message : "Mentve"); };
  if (!p) return <div className="skel" style={{ height: 80 }} />;
  return (
    <div className="push-prefs">
      <h4>Miről szóljon</h4>
      <div className="pick-list">{KINDS.map(([k, l]) => <button key={k} aria-pressed={!p.off.includes(k)} onClick={() => save({ ...p, off: p.off.includes(k) ? p.off.filter((x) => x !== k) : [...p.off, k] })}>{l}</button>)}</div>
      <h4>Csendes órák</h4>
      <div className="adm-row">
        <button className={"sw" + (p.quiet ? " on" : "")} role="switch" aria-checked={!!p.quiet} aria-label="Csendes órák" onClick={() => save({ ...p, quiet: p.quiet ? null : { from: "22:00", to: "07:00" } })}><i /></button>
        {p.quiet ? <><input className="adm-in sm" type="time" value={p.quiet.from} onChange={(e) => save({ ...p, quiet: { ...p.quiet!, from: e.target.value } })} aria-label="Kezdete" /><span>–</span><input className="adm-in sm" type="time" value={p.quiet.to} onChange={(e) => save({ ...p, quiet: { ...p.quiet!, to: e.target.value } })} aria-label="Vége" /></> : <span className="note">kikapcsolva</span>}
      </div>
      <p className="note">Csendes órákban a jelzések megmaradnak, és a végén egyszerre érkeznek (budapesti idő). A próba mindig átmegy.</p>
      <h4>Összevonás</h4>
      <div className="adm-seg sm" role="group">{[[0, "Azonnal"], [15, "15 percenként"], [30, "30 percenként"], [60, "Óránként"]].map(([m, l]) => <button key={m} aria-pressed={(p.batch || 0) === m} onClick={() => save({ ...p, batch: m as number })}>{l}</button>)}</div>
      <p className="note">Sok apró jelzés helyett egy rezgés: a megadott időn belül csak egyszer szól a telefon, és akkor minden addigi jelzés egyszerre jön. A gyorsan terjedő poszt, a leállt mérés és a próba mindig azonnal szól.</p>
    </div>
  );
}

/* ---------- security: two-step sign-in, the other devices, idle sign-out, the background token ---------- */
function Security() {
  const sb = useMemo(() => supabaseBrowser(), []);
  const [f, setF] = useState<D[] | null>(null); const [enr, setEnr] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState(""); const [msg, setMsg] = useState(""); const [idle, setIdle] = useState("0");
  const tok = useRpc("admin_token_age", undefined, []);
  const loadF = () => sb?.auth.mfa.listFactors().then(({ data }) => setF(((data?.totp || []) as D[]))).catch(() => setF([]));
  useEffect(() => { loadF(); try { setIdle(localStorage.getItem("inkage.admin.idle") || "0"); } catch {} }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const verified = (f || []).filter((x) => x.status === "verified");
  const enroll = async () => {
    setMsg(""); if (!sb) return;
    /* an unfinished earlier try is removed first (Supabase keeps only one unverified authenticator) */
    for (const x of (f || []).filter((y) => y.status !== "verified")) await sb.auth.mfa.unenroll({ factorId: x.id }).catch(() => null);
    const { data, error } = await sb.auth.mfa.enroll({ factorType: "totp", friendlyName: "Irányítóközpont " + new Date().toISOString().slice(0, 10) });
    if (error || !data) { setMsg("Nem sikerült: " + (error?.message || "")); return; }
    setEnr({ id: data.id, qr: (data as any).totp?.qr_code || "", secret: (data as any).totp?.secret || "" });
  };
  const verify = async () => {
    if (!sb || !enr) return;
    const { error } = await sb.auth.mfa.challengeAndVerify({ factorId: enr.id, code: code.trim() });
    if (error) { setMsg("Hibás kód. Írd be az alkalmazásban most látható hat számjegyet."); return; }
    setEnr(null); setCode(""); toast("Kétlépcsős belépés bekapcsolva"); loadF();
  };
  const off = async (id: string) => { if (!sb || !confirm("Kikapcsolod a kétlépcsős belépést? Utána elég a jelszó.")) return; const { error } = await sb.auth.mfa.unenroll({ factorId: id }); if (error) setMsg(error.message); else { toast("Kikapcsolva"); loadF(); } };
  const others = async () => { if (!sb || !confirm("Kiléptetsz minden más eszközt? Ez az eszköz belépve marad.")) return; const { error } = await sb.auth.signOut({ scope: "others" }); toast(error ? "Nem sikerült: " + error.message : "A többi eszköz kiléptetve"); };
  const rotate = async () => { if (!confirm("Új tokent kapnak a háttérfeladatok? A régi azonnal érvényét veszti; a következő ütemezett hívás már az újat használja.")) return; const r = await rpc(sb, "admin_cron_token_rotate"); toast(r.error ? "Nem sikerült: " + r.error.message : "Új token kész"); tok.load(); };
  const setI = (v: string) => { setIdle(v); try { localStorage.setItem("inkage.admin.idle", v); } catch {} toast(v === "0" ? "Automatikus kiléptetés ki" : `Kiléptetés ${v} perc tétlenség után (az oldal újratöltésétől)`); };
  return (
    <div className="sec">
      <h4>Kétlépcsős belépés</h4>
      {f === null ? <div className="skel" style={{ height: 40 }} /> : verified.length ? <p className="note"><span className="chip good">✓ bekapcsolva</span> Belépéskor a jelszó után a hitelesítő alkalmazás kódját is kérjük. <button className="lnk" onClick={() => off(verified[0].id)}>kikapcsolás</button></p>
        : enr ? <div className="mfa-enr">
          {enr.qr && <img src={enr.qr} alt="QR-kód a hitelesítő alkalmazáshoz" width={168} height={168} />}
          <p className="note">Olvasd be a QR-kódot a hitelesítő alkalmazással (Google Authenticator, 1Password, Authy), vagy írd be ezt a kulcsot: <code>{enr.secret}</code></p>
          <div className="adm-row"><input className="adm-in sm" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="6 számjegy" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} /><button className="adm-ibtn gold sm" onClick={verify} disabled={code.length !== 6}>Bekapcsolás</button><button className="lnk" onClick={() => setEnr(null)}>Mégse</button></div>
        </div>
        : <div className="adm-row"><span className="note">Ki van kapcsolva: a belépéshez a jelszó elég.</span><button className="adm-ibtn sm" onClick={enroll}>Bekapcsolás</button></div>}
      {msg && <p className="note down">{msg}</p>}
      <h4>Eszközök</h4>
      <div className="adm-row"><button className="adm-ibtn sm" onClick={others}>Többi eszköz kiléptetése</button></div>
      <h4>Kiléptetés tétlenség után</h4>
      <div className="adm-seg sm">{[["0", "Ki"], ["30", "30 perc"], ["60", "1 óra"], ["240", "4 óra"]].map(([v, l]) => <button key={v} aria-pressed={idle === v} onClick={() => setI(v)}>{l}</button>)}</div>
      <h4>Háttérfeladatok tokenje</h4>
      <p className="note">Ezzel hívja a Supabase időzítője a szervert. {tok.d && (tok.d as D).cron ? <>Utoljára cserélve: {dt((tok.d as D).cron)}.</> : null} <button className="lnk" onClick={rotate}>Csere most</button></p>
    </div>
  );
}

/* ---------- where she is signed in ---------- */
function Signins() {
  const q = useRpc("admin_signins", undefined, []);
  const [known, setKnown] = useState<string[] | null>(null);
  useEffect(() => { try { setKnown(JSON.parse(localStorage.getItem("inkage.admin.knowndev") || "null")); } catch { setKnown(null); } }, []);
  const ua = (u: string) => /iPhone/.test(u) ? "iPhone" : /iPad/.test(u) ? "iPad" : /Android/.test(u) ? "Android" : /Mac OS/.test(u) ? "Mac" : /Windows/.test(u) ? "Windows" : /Vercel|node|undici/i.test(u) ? "Szerver (a saját lekérdezései)" : u ? u.slice(0, 40) : "ismeretlen";
  const keyOf = (x: D) => ua(String(x.ua || "")) + "|" + String(x.ip || "").split(".").slice(0, 2).join(".");
  /* the first visit learns the devices seen so far; later a new device (kind + network) is marked until she accepts it */
  useEffect(() => {
    if (!q.d || known !== null) return;
    const k = Array.from(new Set(((q.d.sessions || []) as D[]).map(keyOf)));
    setKnown(k); try { localStorage.setItem("inkage.admin.knowndev", JSON.stringify(k)); } catch {}
  }, [q.d, known]); // eslint-disable-line react-hooks/exhaustive-deps
  const accept = (x: D) => { const k = Array.from(new Set([...(known || []), keyOf(x)])); setKnown(k); try { localStorage.setItem("inkage.admin.knowndev", JSON.stringify(k)); } catch {} };
  return (
    <Async q={q} h={120}>{(d) => <>
      <ul className="signins">{((d.sessions || []) as D[]).map((x, i) => { const isNew = known && !x.this && !/Szerver/.test(ua(String(x.ua || ""))) && !known.includes(keyOf(x));
        return <li key={i}><b>{ua(x.ua)}</b>{x.this && <span className="chip good">ez az eszköz</span>}{isNew && <><span className="chip bad">új eszköz</span><button className="lnk" onClick={() => accept(x)}>ismerős</button></>}<span className="mut">{x.ip || ""} · utoljára {ago(x.updated_at)}</span></li>; })}</ul>
      {((d.log || []) as D[]).length > 0 && <><h4>Napló</h4><ul className="signins">{(d.log as D[]).slice(0, 8).map((x, i) => <li key={i}><span>{({ login: "Belépés", logout: "Kilépés", user_recovery_requested: "Jelszó-visszaállítás kérve", user_updated_password: "Jelszó megváltoztatva", user_signedup: "Regisztráció", mfa_challenge_verified: "Kétlépcsős kód elfogadva" } as D)[x.action] || x.action}</span><span className="mut">{x.ip || ""} · {dt(x.at)}</span></li>)}</ul></>}
    </>}</Async>
  );
}

function Bugs() {
  const q = useRpc("admin_inbox", { p_all: true }, []);
  return (
    <Async q={q} h={100}>{(d) => { const rows: D[] = d.bugs || [];
      return rows.length ? <ul className="bugs">{rows.slice(0, 8).map((x) => <li key={x.source + x.item_id}><b>{x.author || "Névtelen"}</b><span>{String(x.body || "").slice(0, 140)}</span><small>{({ instagram: "Instagram", facebook: "Facebook", youtube: "YouTube", apple: "App Store", google: "Google Play" } as D)[x.source] || x.source} · {ago(x.created_at)}</small></li>)}</ul>
        : <Empty t="Nincs hibajelzés a kommentekben és a véleményekben." icon={P.check} />; }}</Async>
  );
}

/* the keys locked to the server: a token here, the same in Vercel (ADMIN_SERVER_TOKEN), then one click */
function ServerLock() {
  const sb = useMemo(() => supabaseBrowser(), []);
  const q = useRpc("admin_server_lock_status", undefined, []);
  const [tok, setTok] = useState(""); const [msg, setMsg] = useState("");
  const make = async () => { const { data, error } = await rpc(sb, "admin_server_token"); if (error) setMsg(error.message); else setTok(String(data || "")); q.load(); };
  const lock = async () => { setMsg("Ellenőrzés…"); const r = await api("/api/admin/lock", { method: "POST" }); setMsg(r.ok ? "Kész: a kulcsokat mostantól csak a szerver olvassa." : r.json?.error || "Nem sikerült."); q.load(); };
  return (
    <Async q={q} h={80}>{(d) => d.locked ? <p className="note"><span className="chip good">✓ bekapcsolva</span> A kulcsokat csak a szerver olvashatja.</p> : (
      <div className="lock">
        <ol className="lock-s">
          <li>{tok ? <span className="conn-copy"><code>{tok}</code><button className="lnk" onClick={() => { navigator.clipboard?.writeText(tok); setMsg("Másolva"); }}>Másolás</button></span> : <button className="adm-ibtn sm" onClick={make}>{d.token ? "A token újra megmutatása" : "Token készítése"}</button>}</li>
          <li>A Vercelben (signa → Settings → Environment Variables) új változó: <b>ADMIN_SERVER_TOKEN</b>, értéke a fenti token; utána egy új telepítés (Redeploy).</li>
          <li><button className="adm-ibtn gold sm" onClick={lock}>Zár bekapcsolása</button> — csak akkor kapcsol be, ha a szerver tényleg ugyanazt a tokent kapta.</li>
        </ol>
        {msg && <p className="note">{msg}</p>}
      </div>
    )}</Async>
  );
}
