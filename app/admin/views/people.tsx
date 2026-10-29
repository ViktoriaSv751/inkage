"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
/* Working with each user (taken over from the Boltom superadmin): a score and a stage for every account, who needs
   attention today, notes with #tags and a follow-up date, the actions on one account (each one in the admin log),
   activation, and which features an active account has not tried yet. Everything comes from what the app keeps for an
   account (sign-ups, sign-ins, saved previews, bonus previews); the visit measurement stays anonymous. */
import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Empty, fmt, pct } from "../charts";
import { toast } from "../phone";
import { Card, Lesson, P, ago, dt, lang, n, periodWords, rpc, type D, useBlockPeriod } from "../shared";

/* the stages, as chips (the colour says how much attention it needs) */
export const STAGE: Record<string, [string, string, string]> = {
  uj: ["Új", "", "7 napon belül regisztrált"],
  probalgatja: ["Próbálgatja", "warn", "még nem mentett előnézetet"],
  aktiv: ["Aktív", "good", "az elmúlt 7 napban aktív volt, és már mentett előnézetet"],
  veszelyben: ["Veszélyben", "warn", "7–30 napja nem volt aktív"],
  alvo: ["Alvó", "bad", "30+ napja nem volt aktív"],
};
export const WHY: Record<string, string> = { followup: "Visszakeresés esedékes", churn: "Lemorzsolódhat", stuck: "Elakadt: még nem mentett előnézetet" };
export const scoreColor = (s: number) => (s >= 60 ? "var(--good, #1F8A4C)" : s >= 30 ? "var(--a-gold, #C9A24A)" : "var(--bad, #E5484D)");
export const ScoreChip = ({ s }: { s: number }) => <span className="chip" style={{ borderColor: scoreColor(s), color: scoreColor(s), fontWeight: 800 }} title="Pontszám 0–100: aktív napok, mentett előnézetek, mennyire friss az aktivitás, és hány alapfunkciót próbált">{fmt(s)}</span>;
export const StageChip = ({ k }: { k: string }) => (STAGE[k] ? <span className={"chip " + STAGE[k][1]} title={STAGE[k][2]}>{STAGE[k][0]}</span> : null);

/* the features an account can have tried, in the order a new user meets them */
export const FEAT: [string, string][] = [["confirm", "E-mail megerősítve"], ["unlock", "Mentett egy előnézetet"], ["gift", "–"], ["second", "Két vagy több előnézetet mentett"], ["cal", "Elkészíttette a tetoválást"], ["design", "Mintát is mentett"]];
const featDone = (f: D, k: string) => (k === "confirm" ? f.confirmed : k === "unlock" ? n(f.unl_all) > 0 : k === "gift" ? f.gift : k === "second" ? n(f.unl_all) >= 2 : k === "cal" ? f.cal : k === "design" ? f.design : false);

/* ---------- "Kivel foglalkozz ma" (home page and Emberek) ---------- */
export function PeopleToday({ open, max = 8 }: { open: (id: string) => void; max?: number }) {
  const sb = useMemo(() => supabaseBrowser(), []);
  const [rows, setRows] = useState<D[] | null>(null); const [e, setE] = useState("");
  useEffect(() => { rpc(sb, "admin_people_today").then(({ data, error }) => { if (error) setE(error.message); setRows(Array.isArray(data) ? data : []); }); }, [sb]);
  return (
    <Card className="s6" icon={P.users} title="Kivel foglalkozz ma" sub="Akiknek most a legtöbbet ér egy személyes levél: esedékes visszakeresés, aki lemorzsolódhat (rendszeresen használta, de 7 napja nem jött), és az elakadt új felhasználók (3–30 napja regisztrált, de még nem mentett előnézetet). Pontszám szerint.">
      {e ? <div className="alert err">{e}</div> : !rows ? <div className="skel" style={{ height: 120 }} /> : !rows.length ? <Empty t="Ma senkivel nincs teendő. Minden naprakész." /> : (
        <ul className="ptoday">{rows.slice(0, max).map((r) => (
          <li key={r.id}><button className="lnk" onClick={() => open(r.id)} style={{ textAlign: "left" }}>
            <b>{r.email || "–"}</b><small className="mut"> · {WHY[r.why] || r.why} · regisztrált {ago(r.created_at)}, aktív {ago(r.last_active_at)}{r.lang ? " · " + lang(r.lang) : ""}</small></button>
            <span style={{ display: "inline-flex", gap: 6 }}><ScoreChip s={n(r.score)} /><StageChip k={r.stage} /></span></li>))}
          {rows.length > max && <li className="mut">és még {rows.length - max}: az Emberek oldalon a „Kivel foglalkozz” szűrő</li>}</ul>
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
  useEffect(() => { setA(null); rpc(sb, "admin_activation", { p_days, p_from, p_to }).then(({ data }) => setA((data as D) || {})); }, [sb, p_days, p_from, p_to]);
  const b: D = a?.buckets || {};
  const total = n(a?.accounts);
  return (
    <Card className="s6" icon={P.bolt} title="Aktiválás: a regisztrációtól az első mentett előnézetig" right={bp.ctl} sub={`Mennyi idő telik el, mire egy új felhasználó elmenti az első előnézetét (${periodWords(bp.p)} regisztráltak). Aki hamar eljut idáig, az jellemzően visszajön.`}>
      {!a ? <div className="skel" style={{ height: 120 }} /> : !total ? <Empty t={`Nem volt regisztráció ${periodWords(bp.p)}.`} /> : <>
        <div className="adm-row" style={{ gap: 18 }}>
          <div><span className="eyebrow">Már mentett</span><div style={{ fontSize: 26, fontWeight: 800 }}>{fmt(a.activated)} / {fmt(total)}</div><small className="mut">{pct(n(a.activated), total)}</small></div>
          <div><span className="eyebrow">Medián idő</span><div style={{ fontSize: 26, fontWeight: 800 }}>{a.median_hours == null ? "–" : n(a.median_hours) < 1 ? fmt(n(a.median_hours) * 60) + " perc" : n(a.median_hours) < 48 ? fmt(n(a.median_hours), 1) + " óra" : fmt(n(a.median_hours) / 24, 1) + " nap"}</div></div>
        </div>
        <div className="actb">{([["h1", "1 órán belül"], ["d1", "1 napon belül"], ["w1", "1 héten belül"], ["later", "később"], ["never", "még nem"]] as [string, string][]).map(([k, l]) => (
          <div key={k}><span>{l}</span><i style={{ width: pct(n(b[k]), total).replace("–", "0%") }} /><b>{fmt(b[k])}</b></div>))}</div>
      </>}
    </Card>
  );
}
export function FeatureGaps({ open }: { open?: (id: string) => void }) {
  const sb = useMemo(() => supabaseBrowser(), []);
  const [a, setA] = useState<D | null>(null); const [sel, setSel] = useState<string | null>(null);
  useEffect(() => { rpc(sb, "admin_activation", { p_days: 0 }).then(({ data }) => setA((data as D) || {})); }, [sb]);
  const gaps: D[] = a?.gaps || [];
  const byK = Object.fromEntries(gaps.map((g) => [g.k, g]));
  const cur = sel ? byK[sel] : null;
  return (
    <Card className="s12" icon={P.target} title="Kinek mutassuk meg" sub="Az elmúlt 30 napban aktív felhasználók közül hányan használják az egyes funkciókat, és kik nem próbálták még. Kattints egy sorra a névsorért: nekik érdemes egy célzott levél vagy közlemény.">
      {!a ? <div className="skel" style={{ height: 120 }} /> : !gaps.length ? <Empty t="Az elmúlt 30 napban nem volt aktív felhasználó." /> : <>
        <div className="rate-l">{FEAT.map(([k, l]) => { const g = byK[k] || {}; const all = n(g.have) + n(g.missing); return (
          <button key={k} className="rate-i" style={{ textAlign: "left", cursor: "pointer", background: sel === k ? "var(--a-s2)" : undefined }} onClick={() => setSel(sel === k ? null : k)}>
            <span className="rate-n"><b>{l}</b><small>{fmt(g.have)} használja · {fmt(g.missing)} még nem</small></span><span className="rate-v">{pct(n(g.have), all)}</span><i style={{ width: (all ? (n(g.have) / all) * 100 : 0) + "%", background: "var(--acc)" }} /></button>); })}</div>
        {cur && <div style={{ marginTop: 12 }}><span className="eyebrow">Még nem: {FEAT.find((x) => x[0] === sel)?.[1]}</span>
          {(cur.who || []).length ? <ul className="ptoday">{(cur.who as D[]).slice(0, 30).map((w) => <li key={w.id}>{open ? <button className="lnk" onClick={() => open(w.id)}>{w.email || "–"}</button> : <b>{w.email}</b>}<ScoreChip s={n(w.score)} /></li>)}</ul> : <p className="note">Mindenki használja.</p>}</div>}
      </>}
    </Card>
  );
}

/* ---------- one account: actions, notes, features, timeline ---------- */
const HELP = {
  hu: "Szia! Köszönöm, hogy írtál. A belépéshez nyisd meg az inkage.app/belepes oldalt, és ugyanazzal a módszerrel lépj be, amivel regisztráltál (e-mail, Google vagy Apple). Ha e-mailt használtál, és nem emlékszel a jelszóra, az „Elfelejtett jelszó” gombbal kérj újat: a levél pár percen belül megérkezik (nézd meg a Spam mappát is). Ha így sem megy, írd meg, és segítek. Viktória, InkAge",
  en: "Hi! Thanks for writing. To sign in, open inkage.app/belepes and use the same method you signed up with (e-mail, Google or Apple). If you used e-mail and don't remember the password, tap \"Forgot password\" to get a new one: the e-mail arrives within a few minutes (please check your spam folder too). If it still doesn't work, just reply and I'll help. Viktória, InkAge",
};
const TL: Record<string, string> = { signup: "Regisztrált", active: "Aktív nap", unlock: "Mentett előnézet", welcome: "Üdvözlő e-mail", confirmed: "Megerősítette az e-mailjét", note: "Jegyzet", admin: "Admin-művelet" };
export const ACT_L: Record<string, string> = {
  "fiok.kredit": "Bónusz előnézet módosítva", "fiok.felfuggesztes": "Felfüggesztve", "fiok.visszaallitas": "Visszaállítva", "fiok.torles": "Fiók törölve", "fiok.jelszo": "Jelszó-visszaállító e-mail",
  "fiok.segitseg": "Belépési segítség másolva", "fiok.email": "E-mail írása", "export.fiok": "Adatok exportálva", "jegyzet.uj": "Új jegyzet", "jegyzet.modositas": "Jegyzet módosítva", "jegyzet.kesz": "Jegyzet kész",
  "jegyzet.ujranyitas": "Jegyzet újranyitva", "jegyzet.torles": "Jegyzet törölve", "valasz.elkuldve": "Válasz elküldve", "kulcs.mentes": "Kulcs mentve", "kapcsolat.lecsatlakozas": "Platform lecsatlakoztatva",
  "meres.android_bovebb": "Android-mérés kapcsoló", "biztonsag.cron_token_csere": "Cron-token csere", "uzenet.valasz": "Válasz e-mailben",
  "terv.insert": "Terv létrehozva", "terv.update": "Terv módosítva", "terv.delete": "Terv törölve", "link.insert": "Rövid link létrehozva", "link.update": "Rövid link módosítva", "link.delete": "Rövid link törölve",
  "szabaly.insert": "Riasztási szabály létrehozva", "szabaly.update": "Riasztási szabály módosítva", "szabaly.delete": "Riasztási szabály törölve", "figyeles.insert": "Figyelt cím hozzáadva", "figyeles.update": "Figyelt cím kapcsolva", "figyeles.delete": "Figyelt cím törölve",
  "kozlemeny.insert": "Közlemény létrehozva", "kozlemeny.update": "Közlemény módosítva", "kozlemeny.delete": "Közlemény törölve",
};

export function UserMore({ id, email, lang: ulang, reload }: { id: string; email: string; lang?: string; reload: () => void }) {
  const sb = useMemo(() => supabaseBrowser(), []);
  const [m, setM] = useState<D | null>(null); const [ver, setVer] = useState(0);
  const [nb, setNb] = useState(""); const [nt, setNt] = useState(""); const [nf, setNf] = useState(""); const [busy, setBusy] = useState("");
  useEffect(() => { rpc(sb, "admin_user_more", { p_id: id }).then(({ data }) => setM((data as D) || {})); }, [sb, id, ver]);
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
  const help = () => run("help", async () => { const t = String(ulang || "").startsWith("hu") ? HELP.hu : HELP.en; await navigator.clipboard?.writeText(t); await log("fiok.segitseg"); return "Belépési segítség a vágólapon"; });
  const mail = () => run("mail", async () => { await log("fiok.email"); location.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent("InkAge")}`; return null; });
  const credit = (delta: number, gift = false) => run("credit", async () => {
    const reason = prompt(gift ? "Miért állítod vissza? (a naplóba kerül)" : `Miért ${delta > 0 ? "írsz jóvá" : "vonsz le"} ${Math.abs(delta)} bónusz előnézetet? (a naplóba kerül)`);
    if (reason == null) return null;
    const { data, error } = await rpc(sb, "admin_user_credit", { p_user: id, p_delta: delta, p_gift_reset: gift, p_reason: reason });
    return error ? error.message : `Kész · új egyenleg: ${fmt((data as D)?.credits)} bónusz előnézet`;
  });
  const suspend = () => run("suspend", async () => {
    const on = !f.banned;
    if (on && !confirm(`Biztosan felfüggeszted? ${email} azonnal kijelentkezik mindenhol, és nem tud belépni, amíg vissza nem állítod.`)) return null;
    const reason = prompt("Indoklás (a naplóba kerül):") ?? "";
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
    const t = prompt(`A fiók és minden adata végleg törlődik (mentett előnézetek, bónusz előnézetek, aktív napok). Nem vonható vissza.\n\nA megerősítéshez írd be a címet: ${email}`);
    if (t == null) return null;
    if (t.trim().toLowerCase() !== String(email).toLowerCase()) return "Nem egyezik a cím: nem töröltem.";
    const reason = prompt("Indoklás (pl. „a felhasználó kérte e-mailben, okt. 23.”):") ?? "";
    const { error } = await rpc(sb, "admin_user_delete", { p_user: id, p_reason: reason });
    return error ? error.message : "Törölve. Küldj neki visszaigazolást.";
  });
  const saveNote = () => run("note", async () => {
    if (!nb.trim() && !nt.trim() && !nf) return "Írj jegyzetet, címkét vagy dátumot.";
    const { error } = await rpc(sb, "admin_note_user_save", { p_user: id, p_body: nb.trim(), p_tags: nt.split(/[\s,]+/).filter(Boolean), p_follow: nf || null });
    if (error) return error.message;
    setNb(""); setNt(""); setNf(""); return "Jegyzet mentve";
  });
  if (!m) return <div className="skel" style={{ height: 160 }} />;
  const tl: D[] = m.timeline || [];
  return (
    <>
      <div className="adm-row" style={{ gap: 6, flexWrap: "wrap" }}>
        {f.score != null && <ScoreChip s={n(f.score)} />}<StageChip k={f.stage} />
        {f.churn && <span className="chip warn">lemorzsolódhat</span>}{f.stuck && <span className="chip warn">elakadt</span>}
        {f.online && <span className="chip good">● most aktív</span>}{f.banned && <span className="chip bad">felfüggesztve</span>}
        {(f.tags || []).map((t: string) => <span key={t} className="chip">#{t}</span>)}
        {f.follow_up && <span className={"chip" + (String(f.follow_up) <= new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Budapest" }) ? " warn" : "")}>visszakeresés: {String(f.follow_up).slice(5).replace("-", ".")}</span>}
      </div>
      <div className="adm-row" style={{ gap: 6, flexWrap: "wrap", marginTop: 10 }}>
        <button className="adm-ibtn sm" disabled={!!busy || !email} onClick={mail}>E-mail írása</button>
        <button className="adm-ibtn sm" disabled={!!busy || !email} onClick={reset}>Jelszó-visszaállítás</button>
        <button className="adm-ibtn sm" disabled={!!busy} onClick={help}>Belépési segítség (másolás)</button>
        <button className="adm-ibtn sm" disabled={!!busy} onClick={() => credit(1)}>+1 bónusz előnézet</button>
        <button className="adm-ibtn sm" disabled={!!busy || n(f.credits) < 1} onClick={() => credit(-1)}>−1 bónusz előnézet</button>
        {f.gift && <button className="adm-ibtn sm" disabled={!!busy} onClick={() => credit(0, true)}>Visszaállítás (–)</button>}
        <button className="adm-ibtn sm" disabled={!!busy} onClick={exportIt}>Adatok exportja</button>
        <button className="adm-ibtn sm" disabled={!!busy} onClick={suspend}>{f.banned ? "Visszaállítás" : "Felfüggesztés"}</button>
        <button className="adm-ibtn sm" style={{ color: "var(--bad, #E5484D)" }} disabled={!!busy} onClick={del}>Fiók törlése…</button>
      </div>
      <dl className="kv" style={{ marginTop: 12 }}>
        <dt>Utoljára aktív</dt><dd>{f.last_active_at ? `${dt(f.last_active_at)} (${ago(f.last_active_at)})` : "–"}</dd>
        <dt>Aktív napok</dt><dd>{fmt(f.days30)} az elmúlt 30 napban · előtte {fmt(f.days_prev30)}</dd>
        <dt>Első mentett előnézet</dt><dd>{f.first_unlock_at ? <>{dt(f.first_unlock_at)} · {(() => { const h = (new Date(f.first_unlock_at).getTime() - new Date(f.created_at).getTime()) / 36e5; return h < 1 ? fmt(h * 60) + " perccel" : h < 48 ? fmt(h, 1) + " órával" : fmt(h / 24, 1) + " nappal"; })()} a regisztráció után</> : "még nincs"}</dd>
        {m.landing?.path && <><dt>Első oldala</dt><dd>{m.landing.title ? <b>{m.landing.title}</b> : null} <small className="mut">{m.landing.path}</small></dd></>}
      </dl>
      <h3>Funkciók</h3>
      <div className="feat-l">{FEAT.map(([k, l]) => { const d0 = featDone(f, k); return <span key={k} className={"chip" + (d0 ? " good" : "")} title={d0 ? "használta" : "még nem: érdemes megmutatni neki"}>{d0 ? "✓ " : "○ "}{l}</span>; })}</div>
      {FEAT.some(([k]) => !featDone(f, k)) && <p className="note">Érdemes megmutatni neki: {FEAT.filter(([k]) => !featDone(f, k)).map(([, l]) => l.toLowerCase()).join(", ")}.</p>}
      <h3>Jegyzetek</h3>
      <div className="note-f">
        <textarea className="adm-in" rows={2} maxLength={1000} placeholder="Jegyzet (pl. „írt a hibáról, javítva”)" value={nb} onChange={(e) => setNb(e.target.value)} />
        <div className="adm-row"><input className="adm-in sm" style={{ flex: "1 1 160px" }} placeholder="#címkék, szóközzel" value={nt} onChange={(e) => setNt(e.target.value)} />
          <label className="mut" style={{ fontSize: 12 }}>visszakeresés <input type="date" className="adm-in sm" value={nf} onChange={(e) => setNf(e.target.value)} /></label>
          <button className="adm-ibtn gold sm" disabled={!!busy} onClick={saveNote}>Mentés</button></div>
      </div>
      {(m.notes || []).length ? <ul className="notes-l">{(m.notes as D[]).map((x) => (
        <li key={x.id} className={x.done_at ? "done" : ""}><div><b>{x.body || "(csak címke)"}</b><small className="mut"> · {ago(x.created_at)}{x.follow_up ? ` · visszakeresés ${String(x.follow_up).slice(5).replace("-", ".")}` : ""}{(x.tags || []).length ? " · " + (x.tags as string[]).map((t) => "#" + t).join(" ") : ""}</small></div>
          <span><button className="lnk" onClick={() => run("nd", async () => { await rpc(sb, "admin_note_user_done", { p_id: x.id, p_done: !x.done_at }); return x.done_at ? "Újranyitva" : "Kész"; })}>{x.done_at ? "Újranyitás" : "✓ Kész"}</button>
            {" · "}<button className="lnk" onClick={() => run("nx", async () => { if (!confirm("Törlöd a jegyzetet?")) return null; await rpc(sb, "admin_note_user_delete", { p_id: x.id }); return "Törölve"; })}>Törlés</button></span></li>))}</ul> : <p className="note">Még nincs jegyzet.</p>}
      <h3>Idővonal</h3>
      {tl.length ? <ol className="tline">{tl.slice(0, 60).map((y, i) => (
        <li key={i} className={y.k === "unlock" ? "gold" : y.k === "admin" ? "bad" : ""}><time>{new Date(y.at).toLocaleString("hu-HU", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</time>
          <span>{TL[y.k] || y.k}{y.d ? ` · ${y.k === "admin" ? ACT_L[y.d] || y.d : y.d}` : ""}</span></li>))}</ol> : <Empty t="Még nincs esemény." />}
    </>
  );
}

/* the lesson under the Emberek page's list: what the stages mean */
export function StageLesson() {
  return <Lesson>A pontszám (0–100): aktív napok az elmúlt 30 napban (legfeljebb 40), mentett előnézetek az elmúlt 30 napban (25), mennyire friss az utolsó aktivitás (20), és 3–3 pont minden kipróbált alapfunkcióért (15). Életciklus: {Object.values(STAGE).map(([l, , d]) => `${l}: ${d}`).join("; ")}. „Lemorzsolódhat”: rendszeresen használta, de 7 napja nem jött. Mindez a fiókhoz tartozó adatokból jön; a látogatások mérése névtelen marad.</Lesson>;
}
