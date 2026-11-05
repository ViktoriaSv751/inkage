"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
/* Working with each user (taken over from the Boltom superadmin): a score and a stage for every account, who needs
   attention today, notes with #tags and a follow-up date, the actions on one account (each one in the admin log),
   activation, and what an active account has not done yet. Everything comes from what the app keeps for an
   account (sign-ups, sign-ins, previews, saves); the visit measurement stays anonymous. */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
/* InkAge takes no payments yet */
const paymentsOn = (_native: boolean) => false;
import { Empty, fmt, pct } from "../charts";
import { CloseX, Field, Sheet, SwipeRow, haptic, toast, usePhone } from "../phone";
import { reverify } from "../lock";
import { CELEB, Card, I, Layer, Lesson, MOCK, P, PROV, StateErr, Tbl, ago, bpDate, ch, dt, lang, n, periodWords, rpc, styleName, type D, useBlockPeriod, useRpc } from "../shared";
import { More } from "../extra";
import { Logo } from "../wow";
import { Mono, Ring, Sig } from "../ink";

/* a failed load in plain Hungarian, with a way to try again: never the browser's English, never a false "no data" */
export const huErr = (m: unknown) => { const x = String(m || ""); return /failed to fetch|networkerror|network request|load failed/i.test(x) ? "nincs kapcsolat a szerverrel." : x; };
export const LoadErr = ({ e, retry, busy, small }: { e: unknown; retry?: () => void; busy?: boolean; small?: boolean }) => <StateErr msg={huErr(e)} retry={retry} busy={busy} small={small} />;
export const PageErr = ({ e, retry, busy }: { e: unknown; retry?: () => void; busy?: boolean }) => <div className="g"><div className="s12"><LoadErr e={e} retry={retry} busy={busy} /></div></div>;

/* ---------- where an account came from, in plain words ----------
   Biztos and valószínű show the channel; a weak match does not, so it never reads as known. A tap gives the reason. */
export const CONF: Record<string, [string, string, string]> = {
  biztos: ["Tudjuk, honnan jött", "good", "A látogatásban ott a regisztrációja, vagy az előnézetei ugyanakkor készültek."],
  jo: ["Valószínűleg innen jött", "", "Egy percen belül történt a regisztráció, és semmi nem szól ellene, de nem bizonyított."],
  gyenge: ["Nem tudjuk, honnan jött", "warn", "A hozzá legközelebb eső látogatás valószínűleg másé: időben messze van, más fiók regisztrált benne, vagy Apple-belépés Android-látogatáson."],
};
export const ConfChip = ({ k }: { k?: string }) => (k && CONF[k] ? <span className={"chip " + CONF[k][1]} title={CONF[k][2]}>{CONF[k][0]}</span> : null);
export const chName = (k: string, site?: string | null) => (k === "ai" && site ? site : ch(k));
export const aiNote = (site?: string | null) => `${site ? "A " + site : "Az MI-kereső"} nem adja át, milyen kérdésre ajánlott minket; ezt egyik mérés sem láthatja.`;
const NOVISIT = "Nincs hozzá mért látogatás: az iPhone-app nem küld adatot, vagy a mérés nem látta.";
export function SrcTag({ c, conf, site, short }: { c?: string | null; conf?: string; site?: string | null; short?: boolean }) {
  const [open, setOpen] = useState(false);
  const known = !!c && conf !== "gyenge";
  const why = !c ? NOVISIT : conf === "gyenge" ? CONF.gyenge[2] : c === "ai" ? aiNote(site) : conf && CONF[conf] ? CONF[conf][2] : "";
  return (
    <span className={"src-tag" + (known ? "" : " dim")} role={why ? "button" : undefined} tabIndex={why ? 0 : undefined} onClick={(e) => { if (!why) return; e.stopPropagation(); setOpen(!open); }}>
      {known ? <><Logo k={c!} size={short ? 15 : 18} />{short && conf === "jo" ? "Valószínűleg " : ""}{chName(c!, site)}</> : "Ismeretlen forrás"}
      {!short && (conf ? <ConfChip k={conf} /> : null)}
      {open && <small className="src-why">{why}</small>}
    </span>
  );
}
/* why a sign-up did not go through, in plain words */
export const authWhy = (w?: string | null) => { const x = String(w || ""); return x === "password" ? "túl gyenge jelszó" : x === "email" ? "hibás e-mail-cím" : /already|registered/i.test(x) ? "ez a cím már regisztrálva van" : /rate|too many|security purposes/i.test(x) ? "túl sok próbálkozás, a rendszer várakoztatta" : /invalid login|credential/i.test(x) ? "rossz e-mail vagy jelszó" : /confirm/i.test(x) ? "az e-mail-cím még nincs megerősítve" : /network|fetch/i.test(x) ? "hálózati hiba" : x ? "hibaüzenet: " + x : "ismeretlen hiba"; };

/* the stages, as chips (the colour says how much attention it needs) */
export const STAGE: Record<string, [string, string, string]> = {
  uj: ["Új", "", "3 napon belül regisztrált, még nincs előnézete"],
  probalgatja: ["Régóta nem készített", "warn", "3 napnál régebben regisztrált, és nincs elkészült előnézete"],
  aktiv: ["Friss", "good", "van előnézete, és 7 napon belül járt nálunk"],
  veszelyben: ["7+ napja nem járt", "warn", "van előnézete, 7–30 napja nem járt nálunk"],
  alvo: ["Alvó", "bad", "van előnézete, 30+ napja nem járt nálunk"],
};
export const WHY: Record<string, string> = { followup: "Visszakeresés esedékes", churn: "Lemorzsolódhat", stuck: "Elakadt: nincs elkészült előnézete" };
export const scoreColor = (s: number) => (s >= 60 ? "var(--a-good)" : s >= 30 ? "var(--a-warn)" : "var(--a-bad)");
export const ScoreChip = ({ s }: { s: number }) => <span className="chip" style={{ borderColor: scoreColor(s), color: scoreColor(s), fontWeight: 800 }} title="Pontszám 0–100: kész előnézetek, tetoválásstílusok, kedvenc, későbbi visszatérés, és mennyire friss az aktivitás">{fmt(s)}</span>;
export const StageChip = ({ k }: { k: string }) => (STAGE[k] ? <span className={"chip " + STAGE[k][1]} title={STAGE[k][2]}>{STAGE[k][0]}</span> : null);

/* the features an account can have tried, in the order a new user meets them */
export const FEAT: [string, string][] = [["made", "Elkészült az előnézete"], ["second", "Két vagy több előnézet"], ["styles", "Három vagy több tetoválásstílus"], ["fav", "Kedvencet jelölt"], ["back", "Később is használta"]];
const featDone = (f: D, k: string) => (k === "made" ? n(f.made_ok) > 0 : k === "second" ? n(f.made_ok) >= 2 : k === "styles" ? n(f.styles) >= 3 : k === "fav" ? n(f.favs) > 0 : k === "back" ? !!f.returned : false);

/* ---------- "Kivel foglalkozz ma" (home page and Emberek) ---------- */
export function PeopleToday({ open, max = 8 }: { open: (id: string) => void; max?: number }) {
  const sb = useMemo(() => supabaseBrowser(), []);
  const [rows, setRows] = useState<D[] | null>(null); const [e, setE] = useState(""); const [tv, setTv] = useState(0);
  useEffect(() => { let live = true; setE(""); rpc(sb, "admin_people_today").then(({ data, error }) => { if (!live) return; if (error) setE(error.message); setRows(Array.isArray(data) ? data : []); }); return () => { live = false; }; }, [sb, tv]);
  return (
    <Card className="s6" icon={P.users} title="Kivel foglalkozz ma" sub="Akiknek most a legtöbbet ér egy személyes levél: esedékes visszakeresés, aki lemorzsolódhat (rendszeresen használta, de 7 napja nem jött), és az elakadt új felhasználók (3–30 napja regisztrált, és nincs elkészült előnézete). Pontszám szerint.">
      {e ? <LoadErr e={e} retry={() => setTv((x) => x + 1)} /> : !rows ? <div className="skel" style={{ height: 120 }} /> : !rows.length ? <Empty t="Ma senkivel nincs teendő. Minden naprakész." /> : (
        <ul className="pe-today">{rows.slice(0, max).map((r) => (
          <li key={r.id}><button onClick={() => open(r.id)}>
            <Mono name={r.email} size={46} />
            <span className="pe-t-m"><b>{r.email || "–"}</b><small>{WHY[r.why] || r.why} · regisztrált {ago(r.created_at)}, aktív {ago(r.last_active_at)}{r.lang ? " · " + lang(r.lang) : ""}</small></span>
            <span className="pe-t-r"><ScoreChip s={n(r.score)} /><StageChip k={r.stage} /></span></button></li>))}
          {rows.length > max && <li className="pe-t-more">és még {rows.length - max}: a listában az „Elakadt” és a „Visszakeresés” szűrő</li>}</ul>
      )}
    </Card>
  );
}

/* ---------- activation and the features not tried yet (Emberek, Használat) ---------- */
export function Activation() {
  const sb = useMemo(() => supabaseBrowser(), []);
  const [a, setA] = useState<D | null>(null);
  /* the accounts registered in the period, the block's own picker included ("Mint fölül" by default) */
  const bp = useBlockPeriod(), { p_days, p_from, p_to } = bp.args;
  const [e, setE] = useState(""); const [tv, setTv] = useState(0);
  useEffect(() => { let live = true; setA(null); setE(""); rpc(sb, "admin_activation", { p_days, p_from, p_to }).then(({ data, error }) => { if (!live) return; if (error) setE(error.message); else setA((data as D) || {}); }); return () => { live = false; }; }, [sb, p_days, p_from, p_to, tv]);
  const b: D = a?.buckets || {};
  const total = n(a?.accounts);
  return (
    <Card className="s6" icon={P.bolt} title="Aktiválás: a regisztrációtól az első előnézetig" right={bp.ctl} sub={`Mennyi idő telik el, mire egy új fióknak elkészül az első előnézete (${periodWords(bp.p)} regisztráltak), minden eszközön.`}>
      {e ? <LoadErr e={e} retry={() => setTv((x) => x + 1)} /> : !a ? <div className="skel" style={{ height: 120 }} /> : !total ? <Empty t={`Nem volt regisztráció ${periodWords(bp.p)}.`} /> : <>
        <div className="pe-act-top">
          <Ring p={n(a.activated) / total} kind="solid" label={`${pct(n(a.activated), total)} fióknak van előnézete`}><b>{pct(n(a.activated), total)}</b></Ring>
          <div><b className="pe-big">{fmt(a.activated)} / {fmt(total)}</b><small>fióknak van előnézete · {fmt(a.made)} előnézet · {fmt(a.favs)} kedvenc</small></div>
        </div>
        <ul className="pe-vals">
          <li><span>Medián idő az első előnézetig</span><b>{a.median_hours == null ? "–" : n(a.median_hours) < 1 ? fmt(n(a.median_hours) * 60) + " perc" : n(a.median_hours) < 48 ? fmt(n(a.median_hours), 1) + " óra" : fmt(n(a.median_hours) / 24, 1) + " nap"}</b></li>
          <li><span>Használat legalább (medián)<small>az előnézetek idejéből, szünetek nélkül</small></span><b>{a.median_secs == null ? "–" : fmt(n(a.median_secs) / 60, 1) + " perc"}</b></li>
        </ul>
        <div className="actb">{([["h1", "1 órán belül"], ["d1", "1 napon belül"], ["w1", "1 héten belül"], ["later", "később"], ["never", "még nem"]] as [string, string][]).map(([k, l]) => (
          <div key={k}><span>{l}</span><i style={{ width: (n(b[k]) / total) * 100 + "%" }} /><b>{fmt(b[k])}</b></div>))}</div>
      </>}
    </Card>
  );
}
export function FeatureGaps({ open }: { open?: (id: string) => void }) {
  const sb = useMemo(() => supabaseBrowser(), []);
  const [a, setA] = useState<D | null>(null); const [sel, setSel] = useState<string | null>(null);
  const [e, setE] = useState(""); const [tv, setTv] = useState(0);
  useEffect(() => { let live = true; setE(""); rpc(sb, "admin_activation", { p_days: 0 }).then(({ data, error }) => { if (!live) return; if (error) setE(error.message); else setA((data as D) || {}); }); return () => { live = false; }; }, [sb, tv]);
  const gaps: D[] = a?.gaps || [];
  const byK = Object.fromEntries(gaps.map((g) => [g.k, g]));
  const cur = sel ? byK[sel] : null;
  return (
    <Card className="s12" icon={P.target} title="Kinek mutassuk meg" sub="Az elmúlt 30 napban aktív felhasználók közül hányan jutottak el az egyes dolgokig, és kik nem. Kattints egy sorra a névsorért: nekik érdemes egy célzott levél vagy közlemény.">
      {e ? <LoadErr e={e} retry={() => setTv((x) => x + 1)} /> : !a ? <div className="skel" style={{ height: 120 }} /> : !gaps.length ? <Empty t="Az elmúlt 30 napban nem volt aktív felhasználó." /> : <>
        <div className="rate-l">{FEAT.map(([k, l]) => { const g = byK[k] || {}; const all = n(g.have) + n(g.missing); return (
          <button key={k} className="rate-i" style={{ textAlign: "left", cursor: "pointer", background: sel === k ? "var(--a-s2)" : undefined }} onClick={() => setSel(sel === k ? null : k)}>
            <span className="rate-n"><b>{l}</b><small>{fmt(g.have)} igen · {fmt(g.missing)} még nem</small></span><span className="rate-v">{pct(n(g.have), all)}</span><i style={{ width: (all ? (n(g.have) / all) * 100 : 0) + "%", background: "var(--acc)" }} /></button>); })}</div>
        {cur && <div style={{ marginTop: 12 }}><span className="eyebrow">Még nem: {FEAT.find((x) => x[0] === sel)?.[1]}</span>
          {(cur.who || []).length ? <ul className="ptoday">{(cur.who as D[]).slice(0, 30).map((w) => <li key={w.id}>{open ? <button className="lnk" onClick={() => open(w.id)}>{w.email || "–"}</button> : <b>{w.email}</b>}<ScoreChip s={n(w.score)} /></li>)}</ul> : <p className="note">Mindenki eljutott idáig.</p>}</div>}
      </>}
    </Card>
  );
}

/* ---------- one account: actions, notes, features, timeline ---------- */
const HELP = {
  hu: "Szia! Köszönöm, hogy írtál. A belépéshez nyisd meg az inkage.app/belepes oldalt, és ugyanazzal a módszerrel lépj be, amivel regisztráltál (e-mail, Google vagy Apple). Ha e-mailt használtál, és nem emlékszel a jelszóra, az „Elfelejtett jelszó” gombbal kérj újat: a levél pár percen belül megérkezik (nézd meg a Spam mappát is). Ha így sem megy, írd meg, és segítek. Viktória, InkAge",
  en: "Hi! Thanks for writing. To sign in, open inkage.app/belepes and use the same method you signed up with (e-mail, Google or Apple). If you used e-mail and don't remember the password, tap \"Forgot password\" to get a new one: the e-mail arrives within a few minutes (please check your spam folder too). If it still doesn't work, just reply and I'll help. Viktória, InkAge",
};
const TL: Record<string, string> = { signup: "Regisztrált", active: "Be volt lépve (csak a nap ismert)", celeb: "Elkészült egy előnézete", celeb_bad: "Nem sikerült egy előnézet", fav: "Kedvencnek jelölt", sig_mail: "E-mailben megkapta az előnézetét", unlock: "Mentett előnézet", welcome: "Üdvözlő e-mail", confirmed: "Megerősítette az e-mailjét", note: "Jegyzet", admin: "Admin-művelet" };
export const ACT_L: Record<string, string> = {
  "fiok.kredit": "Bónusz előnézet módosítva", "fiok.felfuggesztes": "Felfüggesztve", "fiok.visszaallitas": "Visszaállítva", "fiok.torles": "Fiók törölve", "fiok.jelszo": "Jelszó-visszaállító e-mail",
  "fiok.segitseg": "Belépési segítség másolva", "fiok.email": "E-mail írása", "export.fiok": "Adatok exportálva", "jegyzet.uj": "Új jegyzet", "jegyzet.modositas": "Jegyzet módosítva", "jegyzet.kesz": "Jegyzet kész",
  "jegyzet.ujranyitas": "Jegyzet újranyitva", "jegyzet.torles": "Jegyzet törölve", "valasz.elkuldve": "Válasz elküldve", "kulcs.mentes": "Kulcs mentve", "kapcsolat.lecsatlakozas": "Platform lecsatlakoztatva",
  "meres.android_bovebb": "Android-mérés kapcsoló", "biztonsag.cron_token_csere": "Cron-token csere", "uzenet.valasz": "Válasz e-mailben",
  "terv.insert": "Terv létrehozva", "terv.update": "Terv módosítva", "terv.delete": "Terv törölve", "link.insert": "Rövid link létrehozva", "link.update": "Rövid link módosítva", "link.delete": "Rövid link törölve",
  "szabaly.insert": "Riasztási szabály létrehozva", "szabaly.update": "Riasztási szabály módosítva", "szabaly.delete": "Riasztási szabály törölve", "figyeles.insert": "Figyelt cím hozzáadva", "figyeles.update": "Figyelt cím kapcsolva", "figyeles.delete": "Figyelt cím törölve",
  "kozlemeny.insert": "Közlemény létrehozva", "kozlemeny.update": "Közlemény módosítva", "kozlemeny.delete": "Közlemény törölve",
};

/* ---------- a life as a vertical ribbon: a small icon on the line, full for what they made, outlined for the rest ---------- */
export type TlItem = { ic: string; on?: boolean; warn?: boolean; at: string; t: ReactNode; sub?: ReactNode };
export const TLine = ({ items }: { items: TlItem[] }) => <ol className="pe-tl">{items.map((y, i) => <li key={i}><span className={"pe-tl-i" + (y.on ? " on" : "") + (y.warn ? " warn" : "")} aria-hidden="true">{I(y.ic)}</span><div><time>{y.at}</time><span>{y.t}</span>{y.sub ? <small>{y.sub}</small> : null}</div></li>)}</ol>;
const TL_IC: Record<string, string> = { signup: P.user, active: P.clock, celeb: P.pen, celeb_bad: P.alert, fav: P.spark, sig_mail: P.mail, welcome: P.mail, confirmed: P.check, note: P.doc, admin: P.bolt };

/* part: which tab of the account's page; nothing given is the whole of it */
export function UserMore({ id, email, lang: ulang, reload, part, ver: ext = 0 }: { id: string; email: string; lang?: string; reload: () => void; part?: "sig" | "path" | "notes" | "act"; ver?: number }) {
  const sb = useMemo(() => supabaseBrowser(), []);
  const [m, setM] = useState<D | null>(null); const [ver, setVer] = useState(0);
  const [nb, setNb] = useState(""); const [nt, setNt] = useState(""); const [nf, setNf] = useState(""); const [busy, setBusy] = useState("");
  const [loadE, setLoadE] = useState("");
  useEffect(() => { let live = true; setLoadE(""); rpc(sb, "admin_user_more", { p_id: id }).then(({ data, error }) => { if (!live) return; if (error) setLoadE(error.message); else setM((data as D) || {}); }); return () => { live = false; }; }, [sb, id, ver, ext]);
  const again = () => { setVer((x) => x + 1); reload(); };
  const log = (action: string, detail: D = {}) => rpc(sb, "admin_audit_note", { p_action: action, p_target: id, p_detail: detail });
  const f: D = m?.facts || {};
  const run = async (k: string, fn: () => Promise<string | null>) => { setBusy(k); try { const r = await fn(); if (r) toast(r); } catch (e) { toast(String((e as Error)?.message || e)); } setBusy(""); again(); };
  const reset = () => run("reset", async () => {
    if (!email || !sb) return "Ennek a fióknak nincs e-mail-címe.";
    if (!confirm(`Jelszó-visszaállító levelet küldesz ide: ${email}?`)) return null;
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + "/auth/callback?next=/reset-password" });
    if (error) return "Nem sikerült: " + error.message;
    await log("fiok.jelszo"); return "Elküldve: jelszó-visszaállító levél";
  });
  const help = () => run("help", async () => { const t = String(ulang || "").startsWith("hu") ? HELP.hu : HELP.en; if (!navigator.clipboard) return "Nem sikerült: ez a böngésző nem enged másolni."; await navigator.clipboard.writeText(t); await log("fiok.segitseg"); return "Belépési segítség a vágólapon"; });
  const mail = () => run("mail", async () => { await log("fiok.email"); location.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent("InkAge")}`; return null; });
  /* InkAge's bonus previews (admin_user_credit); the buttons show only when the account data carries the balance */
  const credit = (delta: number, gift = false) => run("credit", async () => {
    const reason = prompt(gift ? "Miért állítod vissza? (a naplóba kerül)" : `Miért ${delta > 0 ? "írsz jóvá" : "vonsz le"} ${Math.abs(delta)} bónusz előnézetet? (a naplóba kerül)`);
    if (reason == null) return null;
    const { data, error } = await rpc(sb, "admin_user_credit", { p_user: id, p_delta: delta, p_gift_reset: gift, p_reason: reason });
    return error ? error.message : `Kész · új egyenleg: ${fmt((data as D)?.credits)} bónusz előnézet`;
  });
  const suspend = () => run("suspend", async () => {
    if (!(await reverify())) return null;
    const on = !f.banned;
    if (on && !confirm(`Biztosan felfüggeszted? ${email} azonnal kijelentkezik mindenhol, és nem tud belépni, amíg vissza nem állítod.`)) return null;
    const reason = prompt("Indoklás (a naplóba kerül):");
    if (reason == null) return null;
    const { error } = await rpc(sb, "admin_user_suspend", { p_user: id, p_on: on, p_reason: reason });
    return error ? error.message : on ? "Felfüggesztve" : "Visszaállítva";
  });
  const exportIt = () => run("export", async () => {
    const { data, error } = await rpc(sb, "admin_user_export", { p_user: id });
    if (error) return error.message;
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: "application/json" }));
    a.download = `inkage-adatok-${id.slice(0, 8)}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 3000);
    await log("export.fiok"); return "Letöltve: a fiók összes adata (ezt küldheted el neki)";
  });
  const del = () => run("del", async () => {
    if (!(await reverify())) return null;
    const t = prompt(`A fiók és minden adata végleg törlődik (előnézetek, mentések, bónusz előnézetek, aktív napok). Nem vonható vissza.\n\nA megerősítéshez írd be a címet: ${email}`);
    if (t == null) return null;
    if (t.trim().toLowerCase() !== String(email).toLowerCase()) return "Nem egyezik a cím: nem töröltem.";
    const reason = prompt("Indoklás (pl. „a felhasználó kérte e-mailben, okt. 23.”):");
    if (reason == null) return "Mégse: nem töröltem semmit.";
    const { error } = await rpc(sb, "admin_user_delete", { p_user: id, p_reason: reason });
    return error ? error.message : "Törölve. Küldj neki visszaigazolást.";
  });
  const saveNote = () => run("note", async () => {
    if (!nb.trim() && !nt.trim() && !nf) return "Írj jegyzetet, címkét vagy dátumot.";
    const { error } = await rpc(sb, "admin_note_user_save", { p_user: id, p_body: nb.trim(), p_tags: nt.split(/[\s,]+/).filter(Boolean), p_follow: nf || null });
    if (error) return error.message;
    setNb(""); setNt(""); setNf(""); return "Jegyzet mentve";
  });
  if (part === "sig") return null;
  if (loadE && !m) return <LoadErr e={loadE} retry={() => setVer((x) => x + 1)} />;
  if (!m) return <div className="skel" style={{ height: 160 }} />;
  const tl: D[] = m.timeline || [], show = (k: string) => !part || part === k;
  return (
    <>
      {show("act") && <><div className="adm-row" style={{ gap: 6, flexWrap: "wrap" }}>
        {f.score != null && <ScoreChip s={n(f.score)} />}<StageChip k={f.stage} />
        {f.returned && <span className="chip good">később is használta</span>}{f.churn && <span className="chip warn">lemorzsolódhat</span>}{f.stuck && <span className="chip warn">elakadt</span>}
        {f.online && <span className="chip good">● most aktív</span>}{f.banned && <span className="chip bad">felfüggesztve</span>}
        {(f.tags || []).map((t: string) => <span key={t} className="chip">#{t}</span>)}
        {f.follow_up && <span className={"chip" + (String(f.follow_up) <= new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Budapest" }) ? " warn" : "")}>visszakeresés: {String(f.follow_up).slice(5).replace("-", ".")}</span>}
      </div>
      <div className="adm-row" style={{ gap: 6, flexWrap: "wrap", marginTop: 10 }}>
        <button className="adm-ibtn sm" disabled={!!busy || !email} onClick={mail}>E-mail írása</button>
        <button className="adm-ibtn sm" disabled={!!busy || !email} onClick={reset}>Jelszó-visszaállítás</button>
        <button className="adm-ibtn sm" disabled={!!busy} onClick={help}>Belépési segítség (másolás)</button>
        {f.credits != null && <>
        <button className="adm-ibtn sm" disabled={!!busy} onClick={() => credit(1)}>+1 bónusz előnézet</button>
        <button className="adm-ibtn sm" disabled={!!busy || n(f.credits) < 1} onClick={() => credit(-1)}>−1 bónusz előnézet</button>
        {f.gift && <button className="adm-ibtn sm" disabled={!!busy} onClick={() => credit(0, true)}>Visszaállítás (–)</button>}
        </>}
        <button className="adm-ibtn sm" disabled={!!busy} onClick={exportIt}>Adatok exportja</button>
        <button className="adm-ibtn sm" disabled={!!busy} onClick={suspend}>{f.banned ? "Visszaállítás" : "Felfüggesztés"}</button>
        <button className="adm-ibtn sm" style={{ color: "var(--a-bad)" }} disabled={!!busy} onClick={del}>Fiók törlése…</button>
      </div>
      <dl className="kv" style={{ marginTop: 12 }}>
        <dt>Utoljára aktív</dt><dd>{f.last_active_at ? `${dt(f.last_active_at)} (${ago(f.last_active_at)})` : "–"}</dd>
        <dt>Használat</dt><dd>{n(f.made_ok) || n(f.saved) ? <>legalább <b>{fmt(n(f.used_secs) / 60, 1)} perc</b> · {fmt(f.used_days)} napon <small className="mut">(az előnézetek idejéből; a nézelődést csak a látogatás mérése látja)</small></> : "nem készített semmit"}</dd>
        <dt>Első előnézet</dt><dd>{f.first_made_at ? <>{dt(f.first_made_at)} · {(() => { const h = (new Date(f.first_made_at).getTime() - new Date(f.created_at).getTime()) / 36e5; return h < 1 ? fmt(h * 60) + " perccel" : h < 48 ? fmt(h, 1) + " órával" : fmt(h / 24, 1) + " nappal"; })()} a regisztráció után</> : "még nincs"}</dd>
        {m.landing?.path && <><dt>Első oldala</dt><dd>{m.landing.title ? <b>{m.landing.title}</b> : null} <small className="mut">{m.landing.path} (becslés)</small></dd></>}
      </dl>
      <h3>Meddig jutott</h3>
      <div className="feat-l">{FEAT.map(([k, l]) => { const d0 = featDone(f, k); return <span key={k} className={"chip" + (d0 ? " good" : "")} title={d0 ? "igen" : "még nem"}>{d0 ? "✓ " : "○ "}{l}</span>; })}</div></>}
      {show("notes") && <><h3>Jegyzetek</h3>
      <div className="note-f">
        <textarea className="adm-in" rows={2} maxLength={1000} placeholder="Jegyzet (pl. „írt a hibáról, javítva”)" value={nb} onChange={(e) => setNb(e.target.value)} />
        <div className="adm-row"><input className="adm-in sm" style={{ flex: "1 1 160px" }} placeholder="#címkék, szóközzel" value={nt} onChange={(e) => setNt(e.target.value)} />
          <label className="mut" style={{ fontSize: 12 }}>visszakeresés <input type="date" className="adm-in sm" value={nf} onChange={(e) => setNf(e.target.value)} /></label>
          <button className="adm-ibtn gold sm" disabled={!!busy} onClick={saveNote}>Mentés</button></div>
      </div>
      {(m.notes || []).length ? <ul className="notes-l">{(m.notes as D[]).map((x) => (
        <li key={x.id} className={x.done_at ? "done" : ""}><div><b>{x.body || ((x.tags || []).length ? "Címke" : x.follow_up ? "Visszakeresés" : "Üres jegyzet")}</b><small className="mut"> · {ago(x.created_at)}{x.follow_up ? ` · visszakeresés ${String(x.follow_up).slice(5).replace("-", ".")}` : ""}{(x.tags || []).length ? " · " + (x.tags as string[]).map((t) => "#" + t).join(" ") : ""}</small></div>
          <span><button className="lnk" onClick={() => run("nd", async () => { const { error } = await rpc(sb, "admin_note_user_done", { p_id: x.id, p_done: !x.done_at }); if (error) return "Nem sikerült: " + huErr(error.message); return x.done_at ? "Újranyitva" : "Kész"; })}>{x.done_at ? "Újranyitás" : "✓ Kész"}</button>
            {" · "}<button className="lnk" onClick={() => run("nx", async () => { if (!confirm("Törlöd a jegyzetet?")) return null; const { error } = await rpc(sb, "admin_note_user_delete", { p_id: x.id }); if (error) return "Nem sikerült: " + huErr(error.message); return "Törölve"; })}>Törlés</button></span></li>))}</ul> : <p className="note">Még nincs jegyzet.</p>}</>}
      {show("path") && <><h3>Idővonal</h3>
      {tl.length ? <TLine items={tl.slice(0, 60).map((y) => ({ ic: TL_IC[y.k] || P.clock, on: y.k === "celeb", warn: y.k === "celeb_bad" || y.k === "admin", at: new Date(y.at).toLocaleString("hu-HU", y.day_only ? { month: "short", day: "numeric" } : { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }), t: `${TL[y.k] || y.k}${y.d ? ` · ${y.k === "admin" ? ACT_L[y.d] || y.d : (y.k === "celeb" || y.k === "celeb_bad") ? CELEB[y.d] || y.d : y.d}` : ""}` }))} /> : <Empty t="Még nincs esemény." />}</>}
    </>
  );
}

/* the lesson under the Emberek page's list: what the stages mean */
export function StageLesson() {
  return <More label="Mit jelent a pontszám és az életciklus?"><Lesson>A pontszám (0–100): elkészült előnézetek (legfeljebb 40), különböző tetoválásstílusok (15), kedvenc jelölése (5), későbbi napon is használta (20), mennyire friss az utolsó aktivitás (20). Életciklus: {Object.values(STAGE).map(([l, , d]) => `${l}: ${d}`).join("; ")}. „Lemorzsolódhat”: több napon használta, de 7 napja nem jött; egyszeri használatú terméknél ez ritka. A „Használat legalább” az előnézetek közti időből jön, 10 percnél hosszabb szünet nélkül, így minden eszközön mérhető, de a nézelődést nem látja. Mindez a fiókhoz tartozó adatokból jön; a látogatások mérése névtelen marad.</Lesson></More>;
}

/* ---------- the phone: details that go behind one button there, and stay as they are on a computer ---------- */
export function PhMore({ label, children }: { label?: string; children: ReactNode }) {
  return usePhone() ? <More label={label}>{children}</More> : <>{children}</>;
}

/* ---------- speaking instead of typing, where the browser can (nothing is shown where it cannot) ---------- */
const recClass = () => (typeof window === "undefined" ? null : (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null);
export function useDictate(onText: (t: string) => void) {
  const [on, setOn] = useState(false); const rec = useRef<any>(null); const cb = useRef(onText); cb.current = onText;
  useEffect(() => () => { try { rec.current?.abort(); } catch {} }, []);
  const can = !!recClass();
  const toggle = () => {
    if (on) { try { rec.current?.stop(); } catch {} return; }
    const C = recClass(); if (!C) return;
    const r = new C(); r.lang = "hu-HU"; r.interimResults = false; r.maxAlternatives = 1; rec.current = r;
    r.onresult = (e: any) => { const t = String(e.results?.[0]?.[0]?.transcript || "").trim(); if (t) cb.current(t); };
    r.onerror = (e: any) => { if (e?.error === "not-allowed" || e?.error === "service-not-allowed") toast("Nem lehet: a mikrofon nincs engedélyezve"); else if (e?.error !== "aborted" && e?.error !== "no-speech") toast("Nem sikerült a hangfelismerés"); };
    r.onend = () => setOn(false);
    try { r.start(); setOn(true); haptic(8); } catch { setOn(false); }
  };
  return { can, on, toggle };
}
export function MicBtn({ onText, label = "Mondd" }: { onText: (t: string) => void; label?: string }) {
  const v = useDictate(onText);
  if (!v.can) return null;
  return <button type="button" className={"pp-mic" + (v.on ? " on" : "")} onClick={v.toggle} aria-pressed={v.on} aria-label={v.on ? "Hallgatom, érintsd meg a befejezéshez" : label}><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg></button>;
}

/* ---------- the finished signatures: the images stay in the private bucket, links run out after 10 minutes ---------- */
const URLS = new Map<string, { u: string; at: number }>();
const thumbP = (p: string) => p.replace(/\.png$/, "") + ".t2.jpg";
const mockSig = (p: string) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 120"><rect width="200" height="120" fill="#FBFAF6"/><path d="M18 ${70 + (p.length % 9)} C50 10 66 110 90 58 S130 22 142 66 S176 74 186 48" fill="none" stroke="#1a1a1a" stroke-width="3" stroke-linecap="round"/></svg>`)}`;
/* path -> a link that works now. small: the ready preview, the full drawing only where there is no preview yet */
export function useSigUrls(paths: string[], small = true) {
  const sb = useMemo(() => supabaseBrowser(), []);
  const [, tick] = useState(0); const key = paths.join("|");
  const id = (p: string) => (small ? "s:" : "f:") + p;
  useEffect(() => {
    const fresh = (p: string) => { const c = URLS.get(id(p)); return c && Date.now() - c.at < 9 * 60e3; };
    const need = paths.filter((p) => !fresh(p)); if (!need.length) return;
    let live = true;
    (async () => {
      if (MOCK || !sb) { need.forEach((p) => URLS.set(id(p), { u: MOCK ? mockSig(p) : "", at: Date.now() })); if (live) tick((x) => x + 1); return; }
      /* InkAge keeps the finished previews in the "previews" bucket */
      const bucket = sb.storage.from("previews"), got: Record<string, string> = {};
      const ask = async (l: string[]) => { const { data } = await bucket.createSignedUrls(l, 600); (data || []).forEach((x) => { if (x.signedUrl && x.path) got[x.path] = x.signedUrl; }); };
      if (small) await ask(need.map(thumbP)).catch(() => null);
      const miss = need.filter((p) => !(small && got[thumbP(p)]));
      if (miss.length) await ask(miss).catch(() => null);
      need.forEach((p) => { const u = (small && got[thumbP(p)]) || got[p] || ""; if (u) URLS.set(id(p), { u, at: Date.now() }); });
      if (live) tick((x) => x + 1);
    })();
    return () => { live = false; };
  }, [sb, key, small]); // eslint-disable-line react-hooks/exhaustive-deps
  return (p: string) => URLS.get(id(p))?.u || "";
}
const nameCap = (x: unknown) => String(x || "").replace(/(^|\s)\S/g, (w: string) => w.toUpperCase());

/* one preview over the whole screen, the arrows and a swipe go through the rest; Esc closes only this, not the account behind it */
function SigFull({ list, at, close }: { list: D[]; at: number; close: () => void }) {
  const [i, setI] = useState(at), x = list[i] || {}, url = useSigUrls(x.path ? [x.path] : [], false), go = (d: number) => setI((o) => Math.max(0, Math.min(list.length - 1, o + d))), t0 = useRef<number | null>(null);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopImmediatePropagation(); close(); } else if (e.key === "ArrowLeft") go(-1); else if (e.key === "ArrowRight") go(1); };
    addEventListener("keydown", k, true); return () => removeEventListener("keydown", k, true);
  }, [close]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Layer>
      <div className="pe-full" role="dialog" aria-label="Az előnézet nagyban" onTouchStart={(e) => { t0.current = e.touches[0].clientX; }} onTouchEnd={(e) => { if (t0.current == null) return; const dx = e.changedTouches[0].clientX - t0.current; t0.current = null; if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1); }}>
        <div className="pe-full-h"><div><b>{nameCap(x.nm)}</b><small>{CELEB[x.style] || styleName(x.style)}{x.mono ? " · monogram" : ""} · {dt(x.at)}{x.fav ? " · kedvenc" : ""}</small></div><CloseX close={close} /></div>
        <div className="pe-full-i"><Sig u={url(x.path)} alt="Az előnézet nagyban" /></div>
        {list.length > 1 && <div className="pe-full-f"><button className="adm-ibtn" disabled={!i} onClick={() => go(-1)} aria-label="Előző">‹</button><span>{fmt(i + 1)} / {fmt(list.length)}</span><button className="adm-ibtn" disabled={i >= list.length - 1} onClick={() => go(1)} aria-label="Következő">›</button></div>}
      </div>
    </Layer>
  );
}

/* all of an account's finished previews on its page; a tap shows one over the whole screen */
const Five = ({ v }: { v: number }) => <span className="pe-stars" role="img" aria-label={`${fmt(v)} csillag az 5-ből`}>{"★".repeat(v)}<i>{"★".repeat(5 - v)}</i></span>;
const styleKey = (s: unknown) => String(s === "a" || s === "b" ? "brush" : s);
export function SigGallery({ id, list }: { id: string; list?: D[] }) {
  const q = useRpc("admin_people_sigs", { p_ids: [id], p_each: 60 }, [id]);
  /* the stars are kept per style, so every signature of a style shows the stars that person gave the style */
  const rq = useRpc("admin_user_ratings", { p_user: id }, [id]);
  const rated = useMemo(() => { const m = new Map<string, number>(); ((Array.isArray(rq.d) ? rq.d : []) as D[]).filter((x) => x.kind !== "drawn").forEach((x) => { const k = styleKey(x.style); if (!m.has(k)) m.set(k, n(x.stars)); }); return m; }, [rq.d]);
  const row: D = (Array.isArray(q.d) ? q.d[0] : null) || {};
  /* the account's record of each signature says whether it was a monogram; the image list does not */
  const monos = new Set(((list || []) as D[]).filter((c) => c.initials).map((c) => c.created_at));
  const sigs: D[] = ((row.sigs || []) as D[]).map((x) => ({ ...x, mono: monos.has(x.at) }));
  const url = useSigUrls(sigs.map((x) => x.path as string));
  const [big, setBig] = useState<number | null>(null);
  if (q.e && !q.d) return <LoadErr e={q.e} retry={q.load} busy={q.busy} />;
  if (!q.d) return <div className="skel" style={{ height: 96 }} />;
  return (
    <section className="pe-gal">
      <h3 className="ink-h">Előnézetei{n(row.total) ? <em>{fmt(row.total)}</em> : null}</h3>
      {sigs.length ? <div className="pe-gal-g">{sigs.map((x, i) => (
        <div key={x.path} className="pe-gal-t"><Sig u={url(x.path)} alt={"Nagyban: " + styleName(x.style)} onClick={() => setBig(i)} />{x.fav && <i aria-label="kedvenc">♥</i>}<small>{rated.has(styleKey(x.style)) && <Five v={rated.get(styleKey(x.style))!} />}{CELEB[x.style] || styleName(x.style)}{x.mono ? " · monogram" : ""}</small></div>))}</div>
        : <p className="note">Még nincs elkészült előnézete.</p>}
      {n(row.total) > sigs.length && <p className="note">A legutóbbi {fmt(sigs.length)} kép látszik, összesen {fmt(row.total)} van.</p>}
      {n(row.font_saved) > 0 && <p className="note">További {fmt(row.font_saved)} régebbi mentése van, azokról nem készült kép, ezért nem láthatók itt.</p>}
      {rated.size > 0 && <p className="note">A csillagot tetoválásstílusonként adja: egy stílus minden előnézetén ugyanaz látszik.</p>}
      {big != null && <SigFull list={sigs} at={big} close={() => setBig(null)} />}
    </section>
  );
}

/* ---------- writing, a note, a date to come back: each from a row or the account's page; nothing goes out by itself ---------- */
type Tpl = { k: string; l: string; hu: string; en: string };
const TPL: Tpl[] = [
  { k: "stuck", l: "Elakadt", hu: "Szia! Viktória vagyok, az InkAge készítője. Láttam, hogy regisztráltál, de még nem készült el az előnézeted. Elakadtál valahol? Írd meg nyugodtan, és segítek.\n\nViktória", en: "Hi! I'm Viktória, the maker of InkAge. I saw you signed up, but your preview isn't ready yet. Did you get stuck somewhere? Just tell me, and I'll help.\n\nViktória" },
  { k: "thanks", l: "Visszajelzés", hu: "Szia! Viktória vagyok, az InkAge készítője. Köszönöm, hogy kipróbáltad. Egy kérdésem lenne: mi tetszett, és mi nem működött? Egy-két mondat is sokat segít.\n\nViktória", en: "Hi! I'm Viktória, the maker of InkAge. Thank you for trying it. One question: what did you like, and what didn't work? A sentence or two helps a lot.\n\nViktória" },
  { k: "login", l: "Belépés", hu: HELP.hu, en: HELP.en },
  { k: "fixed", l: "Hiba javítva", hu: "Szia! Köszönöm, hogy jelezted a hibát. Kijavítottuk, most már működnie kell. Ha mégsem, írd meg, és megnézem.\n\nViktória", en: "Hi! Thank you for reporting the problem. It's fixed now, so it should work. If it doesn't, just tell me and I'll look into it.\n\nViktória" },
];
export function ReplySheet({ id, email, ulang, made, close }: { id: string; email: string; ulang?: string; made?: number; close: () => void }) {
  const sb = useMemo(() => supabaseBrowser(), []);
  const hu = String(ulang || "").startsWith("hu");
  const [k, setK] = useState(n(made) ? "thanks" : "stuck");
  const body = (x: string) => { const t = TPL.find((y) => y.k === x)!; return hu ? t.hu : t.en; };
  const [text, setText] = useState(body(k));
  const pick = (x: string) => { setK(x); setText(body(x)); };
  const open = async () => { await rpc(sb, "admin_audit_note", { p_action: "fiok.email", p_target: id, p_detail: { sablon: k } }); location.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent("InkAge")}&body=${encodeURIComponent(text)}`; close(); };
  return (
    <Sheet title="Írás neki" sub={`A saját leveleződ nyílik meg ezzel a szöveggel, onnan te küldöd el.${!hu ? ` A fiók nyelve ${lang(ulang || "?")}, ezért angol a szöveg.` : ""}`} close={close} tall foot={<button className="adm-ibtn gold" disabled={!email || !text.trim()} onClick={open}>Megnyitás a levelezőben</button>}>
      <div className="ps-opts">{TPL.map((t) => <button key={t.k} aria-pressed={k === t.k} onClick={() => pick(t.k)}>{t.l}</button>)}</div>
      <Field label="A levél szövege" hint={email || "Ennek a fióknak nincs e-mail-címe."}><textarea className="adm-in pp-ta" rows={9} value={text} onChange={(e) => setText(e.target.value)} /></Field>
    </Sheet>
  );
}
export function NoteSheet({ id, close, done }: { id: string; close: () => void; done?: () => void }) {
  const sb = useMemo(() => supabaseBrowser(), []);
  const [t, setT] = useState(""); const [busy, setBusy] = useState(false);
  const save = async () => { setBusy(true); const { error } = await rpc(sb, "admin_note_user_save", { p_user: id, p_body: t.trim(), p_tags: [], p_follow: null }); setBusy(false); if (error) { toast("Nem sikerült: " + error.message); return; } toast("Jegyzet mentve"); done?.(); close(); };
  return (
    <Sheet title="Jegyzet" close={close} foot={<button className="adm-ibtn gold" disabled={busy || !t.trim()} onClick={save}>Mentés</button>}>
      <div className="pp-withmic"><textarea className="adm-in pp-ta" rows={4} maxLength={1000} autoFocus placeholder={recClass() ? "Írd vagy mondd" : "Jegyzet"} value={t} onChange={(e) => setT(e.target.value)} /><MicBtn label="Jegyzet hangról" onText={(x) => setT((o) => (o ? o + " " : "") + x)} /></div>
      {recClass() ? <p className="note">A hangot a telefonod böngészője alakítja szöveggé, ehhez a saját szolgáltatását használhatja.</p> : null}
    </Sheet>
  );
}
const addDays = (k: number) => { const x = new Date(bpDate() + "T12:00:00Z"); x.setUTCDate(x.getUTCDate() + k); return x.toISOString().slice(0, 10); };
export function FollowSheet({ id, close, done }: { id: string; close: () => void; done?: () => void }) {
  const sb = useMemo(() => supabaseBrowser(), []);
  const [v, setV] = useState("");
  const save = async (day: string) => { const { error } = await rpc(sb, "admin_note_user_save", { p_user: id, p_body: "", p_tags: [], p_follow: day }); if (error) { toast("Nem sikerült: " + error.message); return; } toast("Visszakeresés beállítva: " + day.slice(5).replace("-", ".")); done?.(); close(); };
  return (
    <Sheet title="Mikor keressem vissza?" sub="Azon a napon megjelenik a Visszakeresés szűrőben." close={close}>
      <div className="ps-opts">{([[1, "Holnap"], [3, "3 nap múlva"], [7, "Egy hét múlva"], [30, "Egy hónap múlva"]] as [number, string][]).map(([k, l]) => <button key={k} onClick={() => save(addDays(k))}>{l}</button>)}</div>
      <Field label="Vagy egy nap"><input className="adm-in" type="date" value={v} onChange={(e) => setV(e.target.value)} /></Field>
      {v && <button className="adm-ibtn gold" onClick={() => save(v)}>Beállítás</button>}
    </Sheet>
  );
}
export type PAct = { k: "mail" | "note" | "follow"; x: D };
export function ActSheets({ a, close, done }: { a: PAct | null; close: () => void; done?: () => void }) {
  if (!a) return null;
  if (a.k === "mail") return <ReplySheet id={a.x.id} email={a.x.email || ""} ulang={a.x.lang} made={a.x.made_ok} close={close} />;
  if (a.k === "note") return <NoteSheet id={a.x.id} close={close} done={done} />;
  return <FollowSheet id={a.x.id} close={close} done={done} />;
}

/* ---------- the list on a phone: name, the signatures' small images, state, where they came from ---------- */
const fold = (x: unknown) => String(x || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
export const nameOf = (x: D) => String(x.name || "").trim() || String(x.email || "").replace(/@.*/, "") || "névtelen";
export const SrcLine = ({ x }: { x: D }) => <span className="pp-src"><SrcTag c={x.ch} conf={x.conf} site={x.ai_site} short /></span>;
/* wall: everyone as a square with a signature (a favourite first, otherwise the newest), the Sora-style view of the same list */
/* how the account signs in: the one thing about a sign-up's device we do know */
export const ProvIc = ({ p }: { p?: string }) => (p ? <span className="pe-prov" title={"Belépés: " + (PROV[p] || p)} role="img" aria-label={"Belépés: " + (PROV[p] || p)}><Logo k={p} size={20} /></span> : null);
/* a day as the album's heading */
const dayName = (k: string) => { const today = bpDate(), y = bpDate(new Date(Date.now() - 864e5)); return k === today ? "Ma" : k === y ? "Tegnap" : new Date(k + "T12:00:00").toLocaleDateString("hu-HU", { month: "long", day: "numeric", weekday: "long" }); };
export function PeopleCards({ rows, open, abc, reload, wall, days }: { rows: D[]; open: (id: string) => void; abc?: boolean; reload?: () => void; wall?: boolean; days?: boolean }) {
  const ids = rows.map((r) => r.id as string);
  /* the database answers 200 accounts at a time: a longer list is asked in parts */
  const [sd, setSd] = useState<D[] | null>(null), key = ids.join();
  useEffect(() => { if (!ids.length) return; let live = true; const sb = supabaseBrowser();
    (async () => { const out: D[] = []; for (let i = 0; i < ids.length; i += 200) { const r = await rpc(sb, "admin_people_sigs", { p_ids: ids.slice(i, i + 200), p_each: 3 }); if (Array.isArray(r.data)) out.push(...(r.data as D[])); } if (live) setSd(out); })();
    return () => { live = false; }; }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const q = { d: sd };
  const sigs = useMemo(() => new Map(((Array.isArray(q.d) ? q.d : []) as D[]).map((x) => [x.id, x])), [q.d]);
  const url = useSigUrls(((Array.isArray(q.d) ? q.d : []) as D[]).flatMap((x) => (x.sigs || []).map((y: D) => y.path as string)));
  const [act, setAct] = useState<PAct | null>(null);
  const list = useMemo(() => (abc ? [...rows].sort((a, b) => fold(nameOf(a)).localeCompare(fold(nameOf(b)))) : rows), [rows, abc]);
  const letters = abc && !days ? Array.from(new Set(list.map((r) => fold(nameOf(r)).slice(0, 1).toUpperCase()).filter(Boolean))) : [];
  const ref = useRef<HTMLUListElement>(null);
  const seenW = new Set<string>();
  const jump = (L: string) => { (ref.current?.querySelector(`[data-l="${L}"]`) as HTMLElement | null)?.scrollIntoView({ block: "center", behavior: "smooth" }); haptic(5); };
  const seen = new Set<string>();
  const tile = (x: D) => { const L = fold(nameOf(x)).slice(0, 1).toUpperCase(), first = abc && !seenW.has(L); seenW.add(L); const ss: D[] = sigs.get(x.id)?.sigs || [], top = ss.find((y) => y.fav) || ss[0];
    return <li key={x.id} data-l={first ? L : undefined}><button className="pe-tile" onClick={() => open(x.id)} aria-label={`${nameOf(x)}: ${fmt(x.made_ok)} előnézet`}>
      {top ? <Sig u={url(top.path)} alt="" /> : !q.d && n(x.made_ok) ? <Sig u="" alt="" /> : <span className="pe-tile-0"><Mono name={nameOf(x)} size={64} /></span>}
      <ProvIc p={x.provider} />
      <span className="pe-tile-t"><b>{nameOf(x)}{x.online && <i className="pe-on" title="Most aktív" />}</b><small>{n(x.made_ok) ? `${fmt(x.made_ok)} előnézet` : "nincs előnézete"} · {ago(x.created_at)}</small></span>
    </button></li>; };
  /* the album: the same squares under the day they signed up, newest first */
  const album = days ? Array.from(list.reduce((m: Map<string, D[]>, x: D) => { const k = bpDate(new Date(x.created_at)); m.set(k, [...(m.get(k) || []), x]); return m; }, new Map<string, D[]>())).sort((a, b) => (a[0] < b[0] ? 1 : -1)) : [];
  return (
    <>
      {days ? <div className="pe-album">{album.map(([k, l]) => <section key={k}><h3 className="pe-day"><b>{dayName(k)}</b><small>{fmt(l.length)} fiók</small></h3><ul className="pe-wall">{l.map(tile)}</ul></section>)}</div> :
      wall ? <ul className="pe-wall" ref={ref}>{list.map(tile)}</ul> :
      <ul className="pp-l" ref={ref}>{list.map((x) => { const L = fold(nameOf(x)).slice(0, 1).toUpperCase(), first = abc && !seen.has(L); seen.add(L); const s: D = sigs.get(x.id) || {};
        return (
          <li key={x.id} data-l={first ? L : undefined}>
            <SwipeRow keep labels={{ later: "Jegyzet", done: "Írás", hide: "Visszakeres" }} later={() => setAct({ k: "note", x })} done={() => (x.email ? setAct({ k: "mail", x }) : toast("Nem lehet: nincs e-mail-címe"))} hide={() => setAct({ k: "follow", x })} open={() => open(x.id)}>
              <div className="pp-c" role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") open(x.id); }}>
                <Mono name={nameOf(x)} badge={n(x.made_ok) || null} size={52} />
                <div className="pp-m">
                  <b>{nameOf(x)}{x.online && <i className="pp-on" title="Most aktív" />}</b>
                  <span className="pp-st"><StageChip k={x.stage} />{x.churn && <span className="chip warn">lemorzsolódhat</span>}{x.banned && <span className="chip bad">felfüggesztve</span>}{x.paid && <span className="chip gold">fizetett</span>}<ProvIc p={x.provider} /><SrcLine x={x} /></span>
                </div>
                <div className="pp-r"><b>{fmt(x.made_ok)}</b><small>előnézet · {ago(x.created_at)}</small></div>
                {(s.sigs || []).length > 0 && <div className="pp-th">{(s.sigs as D[]).map((y) => <Sig key={y.path} u={url(y.path)} alt="" />)}{n(s.total) > 3 && <em>+{fmt(n(s.total) - 3)}</em>}</div>}
              </div>
            </SwipeRow>
          </li>); })}</ul>}
      {letters.length > 1 && <div className="pt-az" aria-label="Ugrás betűre">{letters.map((L) => <button key={L} onClick={() => jump(L)}>{L}</button>)}</div>}
      <ActSheets a={act} close={() => setAct(null)} done={reload} />
    </>
  );
}

/* ---------- today's sign-ups, how many reached a signature ---------- */
export const bpMidnight = () => { const now = new Date(), off = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Budapest" })).getTime() - new Date(now.toLocaleString("en-US", { timeZone: "UTC" })).getTime(); return new Date(Date.parse(bpDate() + "T00:00:00Z") - off).toISOString(); };
export function ActivationToday() {
  const from = useMemo(bpMidnight, []);
  const q = useRpc("admin_activation", { p_days: 0, p_from: from, p_to: null }, [from]);
  const a: D = (q.d as D) || {}, tot = n(a.accounts), act = n(a.activated);
  if (q.e && !q.d) return <div className="s12"><LoadErr e={q.e} retry={q.load} busy={q.busy} /></div>;
  if (!q.d) return <div className="skel s12" style={{ height: 84 }} />;
  return (
    <section className="pe-today-c">
      {tot > 0 && <Ring p={act / tot} kind="seg" label={`${pct(act, tot)} ért el az előnézetig`}><b>{pct(act, tot)}</b></Ring>}
      <div><span>Mai regisztrálók</span>{tot ? <b className="pe-big">{fmt(act)} / {fmt(tot)}</b> : <b className="pe-big">Ma még senki</b>}<small>{tot ? <>ért el az előnézetig{a.median_hours != null ? <> · medián {n(a.median_hours) < 1 ? fmt(n(a.median_hours) * 60) + " perc" : fmt(n(a.median_hours), 1) + " óra"}</> : null}. A frisseknek még lehet idejük.</> : "Budapesti nap, a saját és tesztfiókjaid nélkül."}</small></div>
    </section>
  );
}

/* ---------- who has paid, once the payments are on ---------- */
export function Payers({ open }: { open: (id: string) => void }) {
  const q = useRpc("admin_payers", undefined, []);
  const rows: D[] = Array.isArray(q.d) ? q.d : [];
  const on = paymentsOn(false) || paymentsOn(true);
  const plans = rows.reduce((m: Record<string, number>, r) => { const k = r.plan || r.product || "?"; m[k] = (m[k] || 0) + 1; return m; }, {});
  return (
    <Card className="s12" icon={P.bolt} title="Fizetők" noData={q.d && !rows.length ? (on ? "Még nincs vásárlás." : "A fizetés most nincs bekapcsolva, ezért nincs kit mutatni. Az első vásárlással itt megjelenik a lista.") : undefined}>
      {q.e && !q.d ? <LoadErr e={q.e} retry={q.load} busy={q.busy} /> : !q.d ? <div className="skel" style={{ height: 80 }} /> : !rows.length ? <Empty t={on ? "Még nincs vásárlás." : "A fizetés most nincs bekapcsolva."} /> : <>
        <div className="adm-row" style={{ gap: 6, flexWrap: "wrap" }}>{Object.entries(plans).map(([k, c]) => <span key={k} className="chip">{k}: {fmt(c)}</span>)}</div>
        <Tbl name="fizetok" csv={false} rows={rows} onRow={(r) => r.user_id && open(r.user_id)} cols={[{ k: "email", l: "Fiók", ph: "name", r: (r) => r.email || "törölt fiók" }, { k: "amount", l: "Összeg", num: true, ph: "main", r: (r) => (r.amount == null ? "–" : `${fmt(r.amount, 2)} ${r.currency || ""}`) }, { k: "plan", l: "Csomag", ph: "sub", r: (r) => r.plan || r.product || "–" }, { k: "at", l: "Mikor", ph: "sub", r: (r) => ago(r.at) }]} />
      </>}
    </Card>
  );
}

/* ---------- two accounts that may be one person: only a suggestion, nothing is merged ---------- */
const WHYD: Record<string, string> = { mail: "Ugyanaz a postafiók, másképp írva", local: "Ugyanaz az e-mail eleje, más szolgáltatónál", name: "Ugyanaz a teljes név", sig: "Ugyanarra a teljes névre készült előnézet" };
export function DupeSheet({ p, open, close }: { p: D; open: (id: string) => void; close: () => void }) {
  const r = (l: string, f: (x: D) => ReactNode) => <tr><th>{l}</th><td>{f(p.a)}</td><td>{f(p.b)}</td></tr>;
  return (
    <Sheet title="Lehet, hogy ugyanaz az ember" sub={`${WHYD[p.why] || ""}. Csak egy közös nézet: egyik fiók adata sem változik.`} close={close} tall>
      <div className="pp-cmp"><table><tbody>
        {r("Fiók", (x) => <button className="lnk" onClick={() => { close(); open(x.id); }}>{x.email}</button>)}
        {r("Belépés", (x) => PROV[x.provider] || x.provider)}{r("Regisztrált", (x) => ago(x.created_at))}{r("Aktív", (x) => (x.last_active_at ? ago(x.last_active_at) : "–"))}{r("Előnézet", (x) => fmt(x.made_ok))}{r("Eltárolt", (x) => fmt(x.saved))}
      </tbody></table></div>
      <p className="note">Együtt: {fmt(n(p.a.made_ok) + n(p.b.made_ok))} előnézet, {fmt(n(p.a.saved) + n(p.b.saved))} eltárolt. Ez csak valószínűsítés, nem bizonyíték.</p>
    </Sheet>
  );
}
export function Dupes({ open }: { open: (id: string) => void }) {
  const q = useRpc("admin_people_dupes", undefined, []);
  const rows: D[] = Array.isArray(q.d) ? q.d : []; const [cur, setCur] = useState<D | null>(null);
  const none = "Most nincs ilyen gyanú. Azonos postafiókot és azonos nevet keresünk.";
  return (
    <Card className="s12" icon={P.users} title="Kétfiókos gyanú" noData={q.d && !rows.length ? none : undefined}>
      {q.e && !q.d ? <LoadErr e={q.e} retry={q.load} busy={q.busy} /> : !q.d ? <div className="skel" style={{ height: 60 }} /> : !rows.length ? <Empty t={none} /> : <ul className="pp-dupe">{rows.slice(0, 10).map((p, i) => <li key={i}><button onClick={() => setCur(p)}><b>{String(p.a.email).replace(/@.*/, "")} · {String(p.b.email).replace(/@.*/, "")}</b><small>{WHYD[p.why]}</small></button></li>)}</ul>}
      {cur && <DupeSheet p={cur} open={open} close={() => setCur(null)} />}
    </Card>
  );
}
export function DupeHint({ id, open }: { id: string; open: (id: string) => void }) {
  const q = useRpc("admin_people_dupes", undefined, []); const [cur, setCur] = useState<D | null>(null);
  const hits = (Array.isArray(q.d) ? q.d : []).filter((p: D) => p.a?.id === id || p.b?.id === id);
  if (!hits.length) return null;
  return <><button className="pp-hint" onClick={() => setCur(hits[0])}>Lehet, hogy ugyanaz az ember, mint {String((hits[0].a.id === id ? hits[0].b : hits[0].a).email).replace(/@.*/, "")} ›</button>{cur && <DupeSheet p={cur} open={open} close={() => setCur(null)} />}</>;
}
