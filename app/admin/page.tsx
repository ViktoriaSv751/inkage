"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
/* InkAge Irányítóközpont (/admin): the owner's private dashboard. Every number comes from admin-only database functions
   (admin_dashboard, admin_social, admin_search, admin_links, admin_users); nothing here is part of the app. */
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { emailOk, passwordOk } from "@/lib/admin/validate";
import { SignatureLine } from "./visuals";
import { I, P } from "./shared";
import { MOCK, useTheme } from "./shared";

/* the one round button of every sign-in step; a word under it only where the arrow alone would not say what happens */
const GoBtn = ({ busy, label, word }: { busy: boolean; label: string; word?: boolean }) => <button className="lg-go" disabled={busy} aria-busy={busy || undefined} aria-label={label}><i>{busy ? <span className="spin" aria-hidden="true" /> : I(P.arrow)}</i>{word && <span>{label}</span>}</button>;
/* every sign-in screen is the same page: the signature large, a few words, the fields, the round button, one quiet way out */
const Stage = ({ cls, kicker, onSubmit, children, busy }: { cls: string; kicker?: string; onSubmit?: (e: React.FormEvent) => void; children?: React.ReactNode; busy?: boolean }) => (
  <div className={cls} suppressHydrationWarning>
    <form className="lg" onSubmit={onSubmit} aria-busy={busy || undefined} noValidate>
      <div className="lg-h"><SignatureLine text="InkAge" className="lg-sig" />{kicker && <span>{kicker}</span>}</div>
      {children}
    </form>
  </div>
);
const Fld = (p: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) => { const { label, ...rest } = p; return <label className="lg-f"><span>{label}</span><input placeholder={label} {...rest} /></label>; };
import { Dashboard } from "./shell";
import { adminLang, setAdminLang, startAdminI18n } from "./i18n";
import { cacheClear, phoneNow } from "./phone";

/* Sign-in gate: only the e-mail listed in public.admin_emails (confirmed from its own inbox) gets in.
   The check here is for the screen; every number is also refused by the database to anyone else.
   With an authenticator app switched on (Rendszer → Biztonság), the six-digit code is asked after the password.
   After a password-reset link (?pwreset=1) the new password is set right here, and the dashboard opens. */
export default function AdminPage() {
  const sb = useMemo(() => supabaseBrowser(), []);
  const { light } = useTheme();
  const [state, setState] = useState<"check" | "login" | "mfa" | "newpw" | "ok">("check");
  const [note, setNote] = useState("");
  const check = useCallback(async () => {
    /* (the sample data on the development server can show each step: ?mock=1&gate=login|mfa|newpw|check) */
    if (MOCK) { const g = new URLSearchParams(location.search).get("gate"); setState(g === "login" || g === "mfa" || g === "newpw" || g === "check" ? g : "ok"); return; }
    if (!sb) { setState("login"); return; }
    /* a phone without a connection: a session kept in this browser opens the last numbers, read only (signing out wipes them) */
    const offlineOk = async () => phoneNow() && !!(await sb.auth.getSession().catch(() => null))?.data.session;
    if (typeof navigator !== "undefined" && !navigator.onLine && await offlineOk()) { setState("ok"); return; }
    const { data: { user }, error: ue } = await sb.auth.getUser();
    if (!user) { if (ue && /fetch|network/i.test(ue.message) && await offlineOk()) { setState("ok"); return; } setState("login"); return; }
    /* a second step is due when an authenticator is enrolled and this session has not passed it yet */
    const { data: aal } = await sb.auth.mfa.getAuthenticatorAssuranceLevel().catch(() => ({ data: null }));
    if (aal && aal.nextLevel === "aal2" && aal.currentLevel !== "aal2") { setState("mfa"); return; }
    const { data: ok, error } = await sb.rpc("is_admin");
    /* no answer (network, a slow database) is not a "no": she stays signed in and can try again */
    if (error && /fetch|network/i.test(error.message) && await offlineOk()) { setState("ok"); return; }
    if (error) { setNote("Most nem sikerült ellenőrizni a belépést (hálózat vagy adatbázis). Próbáld újra egy perc múlva."); setState("login"); return; }
    if (ok === true) {
      try { if (new URLSearchParams(location.search).has("pwreset")) { setState("newpw"); return; } } catch {}
      setState("ok"); return;
    }
    await sb.auth.signOut();
    setNote("Ezzel a fiókkal nem lehet belépni.");
    setState("login");
  }, [sb]);
  useEffect(() => { check(); }, [check]);
  useEffect(() => { startAdminI18n(); }, []);
  /* signing out leaves no numbers behind in this browser: the quick-start copies and the Kérdezz conversation go too */
  const signOut = useCallback(async (msg?: string) => {
    await sb?.auth.signOut().catch(() => null);
    try { Object.keys(localStorage).filter((k) => k.startsWith("inkage.admin.cache.") || k.startsWith("inkage.admin.ask")).forEach((k) => localStorage.removeItem(k)); } catch {}
    cacheClear();
    setNote(msg || ""); setState("login");
  }, [sb]);
  const cls = "adm gate" + (light ? " light" : "");
  /* (the server draws this first screen without knowing the theme; the inline script in layout.tsx paints it right) */
  if (state === "check") return <Stage cls={cls} busy><span className="lg-wait" role="status">Ellenőrzés…</span></Stage>;
  if (state === "login") return <AdminLogin cls={cls} note={note} done={check} />;
  if (state === "mfa") return <MfaStep cls={cls} done={check} cancel={async () => { await sb?.auth.signOut(); setState("login"); }} />;
  if (state === "newpw") return <NewPassword cls={cls} done={() => { try { const u = new URL(location.href); u.searchParams.delete("pwreset"); history.replaceState(null, "", u.pathname + u.search + u.hash); } catch {} setState("ok"); }} />;
  return <Dashboard signOut={signOut} />;
}


function AdminLogin({ cls, note, done }: { cls: string; note: string; done: () => void }) {
  const sb = useMemo(() => supabaseBrowser(), []);
  const [mode, setMode] = useState<"in" | "forgot">("in");
  const [email, setEmail] = useState(""); const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState<{ k: "err" | "ok"; t: string } | null>(note ? { k: "err", t: note } : null);
  useEffect(() => { if (note) setMsg({ k: "err", t: note }); }, [note]);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setMsg(null);
    if (!sb) return setMsg({ k: "err", t: "Nincs adatbázis-kapcsolat." });
    if (!emailOk(email)) return setMsg({ k: "err", t: "Adj meg egy érvényes e-mail-címet." });
    if (mode === "in" && !pw) return setMsg({ k: "err", t: "Írd be a jelszót." });
    setBusy(true);
    try {
      if (mode === "forgot") {
        /* InkAge: the app's own new-password page (an address Supabase already accepts); a Google-only account gets a password this way too */
        const { error } = await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: location.origin + "/uj-jelszo" });
        if (error && /fetch|network/i.test(error.message)) return setMsg({ k: "err", t: "Nincs kapcsolat. Próbáld újra." });
        setMsg({ k: "ok", t: `Ha a(z) ${email.trim()} címhez tartozik fiók, küldtünk rá egy linket. Add meg vele a jelszót, utána nyisd meg újra az inkage.app/admin oldalt.` });
        return;
      }
      const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password: pw });
      if (error) return setMsg({ k: "err", t: /fetch|network/i.test(error.message) ? "Nincs kapcsolat. Próbáld újra." : /confirm/i.test(error.message) ? "Előbb erősítsd meg a címed: kattints a levélben kapott linkre." : "Hibás e-mail-cím vagy jelszó. Ha Google-lel regisztráltál, a „Belépés Google-lel” gombot használd." });
      done();
    } catch { setMsg({ k: "err", t: "Nincs kapcsolat. Próbáld újra." }); } finally { setBusy(false); }
  };
  /* InkAge: the owner's account signs in with Google (the same sign-in as in the app; it comes back here) */
  const google = async () => {
    setMsg(null);
    const { oauthParams } = await import("@/lib/auth-help");
    const { error } = (await sb?.auth.signInWithOAuth({ provider: "google", options: { redirectTo: location.origin + "/admin", queryParams: oauthParams("google") } })) || {};
    if (error) setMsg({ k: "err", t: "A Google-belépés most nem indult el. Próbáld újra, vagy lépj be az appban (inkage.app/app), és utána nyisd meg ezt az oldalt." });
  };
  return (
    <Stage cls={cls} kicker={mode === "forgot" ? "Új jelszó kérése" : "Irányítóközpont"} onSubmit={submit}>
      {mode === "in" && <button type="button" className="lg-oauth" onClick={google}>Belépés Google-lel</button>}
      <div className="lg-fs">
        <Fld label="E-mail-cím" type="email" inputMode="email" autoCapitalize="off" autoCorrect="off" spellCheck={false} autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
        {mode !== "forgot" && <Fld label="Jelszó" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} />}
      </div>
      {msg && <p className={"lg-msg " + msg.k} role={msg.k === "err" ? "alert" : "status"}>{msg.t}</p>}
      <GoBtn busy={busy} label={mode === "forgot" ? "Link küldése" : "Belépés"} word={mode === "forgot"} />
      <button type="button" className="lg-lnk" onClick={() => { setMode(mode === "in" ? "forgot" : "in"); setMsg(null); }}>{mode === "in" ? "Elfelejtett jelszó" : "Vissza a belépéshez"}</button>
      <button type="button" className="lg-lnk lg-lang" data-noi18n onClick={() => setAdminLang(adminLang() === "en" ? "hu" : "en")}>{adminLang() === "en" ? "Magyarul" : "English"}</button>
    </Stage>
  );
}

/* the second step: the six digits of the authenticator app */
function MfaStep({ cls, done, cancel }: { cls: string; done: () => void; cancel: () => void }) {
  const sb = useMemo(() => supabaseBrowser(), []);
  const [code, setCode] = useState(""); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setMsg("");
    if (!sb) return;
    if (!/^\d{6}$/.test(code.trim())) return setMsg("A kód hat számjegy.");
    setBusy(true);
    try {
      const { data: f } = await sb.auth.mfa.listFactors();
      const factor = (f?.totp || []).find((x: any) => x.status === "verified");
      if (!factor) { setMsg("Nincs beállított hitelesítő alkalmazás."); return; }
      const { error } = await sb.auth.mfa.challengeAndVerify({ factorId: factor.id, code: code.trim() });
      if (error) { setMsg("Hibás vagy lejárt kód. Írd be az alkalmazásban most látható számot."); return; }
      done();
    } finally { setBusy(false); }
  };
  return (
    <Stage cls={cls} kicker="A hitelesítő alkalmazás kódja" onSubmit={submit}>
      <div className="lg-fs"><Fld label="Hatjegyű kód" className="lg-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} autoFocus /></div>
      {msg && <p className="lg-msg err" role="alert">{msg}</p>}
      <GoBtn busy={busy} label="Belépés" />
      <button type="button" className="lg-lnk" onClick={cancel}>Másik fiók</button>
    </Stage>
  );
}

/* after the reset link: the new password, here */
function NewPassword({ cls, done }: { cls: string; done: () => void }) {
  const sb = useMemo(() => supabaseBrowser(), []);
  const [pw, setPw] = useState(""); const [pw2, setPw2] = useState(""); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setMsg("");
    if (!passwordOk(pw)) return setMsg("A jelszó legalább 8 karakter legyen, kis- és nagybetűvel és számmal.");
    if (pw !== pw2) return setMsg("A két jelszó nem egyezik.");
    setBusy(true);
    const { error } = await (sb?.auth.updateUser({ password: pw }) ?? Promise.resolve({ error: null })).catch(() => ({ error: { message: "" } }));
    setBusy(false);
    if (error) return setMsg(/same|different/i.test(error.message) ? "Az új jelszó nem lehet ugyanaz, mint a régi." : "Nem sikerült menteni. Kérj új linket az „Elfelejtett jelszó” gombbal.");
    done();
  };
  return (
    <Stage cls={cls} kicker="Új jelszó" onSubmit={submit}>
      <div className="lg-fs">
        <Fld label="Új jelszó" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
        <Fld label="Még egyszer" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
      </div>
      {msg && <p className="lg-msg err" role="alert">{msg}</p>}
      <GoBtn busy={busy} label="Mentés és belépés" word />
      <button type="button" className="lg-lnk" onClick={done}>Most nem</button>
    </Stage>
  );
}
