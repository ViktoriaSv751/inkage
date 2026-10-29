"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
/* InkAge Irányítóközpont (/admin): the owner's private dashboard. Every number comes from admin-only database functions
   (admin_dashboard, admin_social, admin_search, admin_links, admin_users); nothing here is part of the app. */
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { emailOk, passwordOk } from "@/lib/admin/validate";
import { SignatureLine } from "./visuals";
import { MOCK, useTheme } from "./shared";
import { Dashboard } from "./shell";

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
    if (MOCK) { setState("ok"); return; }
    if (!sb) { setState("login"); return; }
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { setState("login"); return; }
    /* a second step is due when an authenticator is enrolled and this session has not passed it yet */
    const { data: aal } = await sb.auth.mfa.getAuthenticatorAssuranceLevel().catch(() => ({ data: null }));
    if (aal && aal.nextLevel === "aal2" && aal.currentLevel !== "aal2") { setState("mfa"); return; }
    const { data: ok, error } = await sb.rpc("is_admin");
    /* no answer (network, a slow database) is not a "no": she stays signed in and can try again */
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
  /* signing out leaves no numbers behind in this browser: the quick-start copies and the Kérdezz conversation go too */
  const signOut = useCallback(async (msg?: string) => {
    await sb?.auth.signOut().catch(() => null);
    try { Object.keys(localStorage).filter((k) => k.startsWith("inkage.admin.cache.") || k.startsWith("inkage.admin.ask")).forEach((k) => localStorage.removeItem(k)); } catch {}
    setNote(msg || ""); setState("login");
  }, [sb]);
  const cls = "adm gate" + (light ? " light" : "");
  /* (the server draws this first screen without knowing the theme; the inline script in layout.tsx paints it right) */
  if (state === "check") return <div className={cls} suppressHydrationWarning><span className="adm-upd"><i className="adm-dot" />Ellenőrzés…</span></div>;
  if (state === "login") return <AdminLogin cls={cls} note={note} done={check} />;
  if (state === "mfa") return <MfaStep cls={cls} done={check} cancel={async () => { await sb?.auth.signOut(); setState("login"); }} />;
  if (state === "newpw") return <NewPassword cls={cls} done={() => { try { const u = new URL(location.href); u.searchParams.delete("pwreset"); history.replaceState(null, "", u.pathname + u.search + u.hash); } catch {} setState("ok"); }} />;
  return <Dashboard signOut={signOut} />;
}


function AdminLogin({ cls, note, done }: { cls: string; note: string; done: () => void }) {
  const sb = useMemo(() => supabaseBrowser(), []);
  const [mode, setMode] = useState<"in" | "setup" | "forgot">("in");
  const [email, setEmail] = useState(""); const [pw, setPw] = useState(""); const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState<{ k: "err" | "ok"; t: string } | null>(note ? { k: "err", t: note } : null);
  useEffect(() => { if (note) setMsg({ k: "err", t: note }); }, [note]);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setMsg(null);
    if (!sb) return setMsg({ k: "err", t: "Nincs adatbázis-kapcsolat." });
    if (!emailOk(email)) return setMsg({ k: "err", t: "Adj meg egy érvényes e-mail-címet." });
    setBusy(true);
    try {
      if (mode === "forgot") {
        /* the link brings her back here (not to the app), where the new password is set */
        await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: location.origin + "/auth/callback?next=" + encodeURIComponent("/admin?pwreset=1") });
        setMsg({ k: "ok", t: `Ha a(z) ${email.trim()} címhez tartozik fiók, küldtünk rá egy levelet. A benne lévő link ide hoz vissza, ahol megadhatod az új jelszót.` });
        return;
      }
      if (mode === "in") {
        const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password: pw });
        if (error) return setMsg({ k: "err", t: /confirm/i.test(error.message) ? "Előbb erősítsd meg a címed: kattints a levélben kapott linkre." : "Hibás e-mail-cím vagy jelszó." });
        done(); return;
      }
      if (!passwordOk(pw)) return setMsg({ k: "err", t: "A jelszó legalább 8 karakter legyen, kis- és nagybetűvel és számmal." });
      if (pw !== pw2) return setMsg({ k: "err", t: "A két jelszó nem egyezik." });
      /* the page does not tell whether an address is the admin's (anyone could test addresses with it): every address gets
         the same answer, and only the admin's opens the dashboard after confirming it (is_admin, in the database) */
      const { data, error } = await sb.auth.signUp({ email: email.trim(), password: pw, options: { data: { display_name: "Admin" }, emailRedirectTo: location.origin + "/auth/callback?next=/admin" } });
      if (error || (data.user && !data.user.identities?.length)) return setMsg({ k: "err", t: "Ehhez a címhez már van jelszó. Lépj be vele, vagy kérj újat az „Elfelejtett jelszó” gombbal." });
      if (data.session) { done(); return; }
      setMsg({ k: "ok", t: `Ha ez a cím jogosult, küldtünk rá egy megerősítő levelet. Kattints a benne lévő linkre, és utána ezzel a jelszóval mindig be tudsz lépni.` });
      setMode("in"); setPw(""); setPw2("");
    } finally { setBusy(false); }
  };
  return (
    <div className={cls}>
      <form className="gate-card login-card" onSubmit={submit}>
        <SignatureLine text="InkAge" className="login-sig" />
        <span className="eyebrow" style={{ textAlign: "center" }}>Irányítóközpont</span>
        {/* InkAge: the owner's account signs in with Google (the same sign-in as in the app; it comes back here) */}
        {mode === "in" && <>
          <button type="button" className="btn" onClick={async () => {
            const { oauthParams } = await import("@/lib/auth-help");
            const { error } = (await sb?.auth.signInWithOAuth({ provider: "google", options: { redirectTo: location.origin + "/admin", queryParams: oauthParams("google") } })) || {};
            if (error) setMsg({ k: "err", t: "A Google-belépés most nem indult el. Próbáld újra, vagy lépj be az appban (inkage.app/app), és utána nyisd meg ezt az oldalt." });
          }}>Belépés Google-lel</button>
          <p className="note" style={{ textAlign: "center", margin: 0 }}>vagy e-mail-címmel és jelszóval:</p>
        </>}
        {mode !== "forgot" && <div className="adm-seg" role="group">
          <button type="button" aria-pressed={mode === "in"} onClick={() => { setMode("in"); setMsg(null); }}>Belépés</button>
          <button type="button" aria-pressed={mode === "setup"} onClick={() => { setMode("setup"); setMsg(null); }}>Első belépés</button>
        </div>}
        {mode === "setup" && <p className="note">Add meg az admin e-mail-címed és a jelszót, amivel ezentúl belépsz. A megerősítő levél ebbe a postafiókba érkezik.</p>}
        {mode === "forgot" && <p className="note">Add meg az admin e-mail-címed: küldünk egy linket, amivel új jelszót adhatsz meg.</p>}
        <label className="lf"><span>E-mail-cím</span><input className="adm-in" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        {mode !== "forgot" && <label className="lf"><span>{mode === "setup" ? "Új jelszó" : "Jelszó"}</span><input className="adm-in" type="password" autoComplete={mode === "setup" ? "new-password" : "current-password"} value={pw} onChange={(e) => setPw(e.target.value)} required /></label>}
        {mode === "setup" && <label className="lf"><span>Jelszó még egyszer</span><input className="adm-in" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} required /></label>}
        {msg && <div className={"alert " + msg.k} role={msg.k === "err" ? "alert" : "status"}>{msg.t}</div>}
        <button className="btn" disabled={busy} aria-busy={busy || undefined}>{busy && <span className="spin" aria-hidden="true" />}{mode === "setup" ? "Jelszó beállítása" : mode === "forgot" ? "Link küldése" : "Belépés"}</button>
        {mode === "in" && <button type="button" className="note lnk-btn" onClick={() => { setMode("forgot"); setMsg(null); }}>Elfelejtett jelszó</button>}
        {mode === "forgot" && <button type="button" className="note lnk-btn" onClick={() => { setMode("in"); setMsg(null); }}>← Vissza a belépéshez</button>}
      </form>
    </div>
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
    <div className={cls}>
      <form className="gate-card login-card" onSubmit={submit}>
        <SignatureLine text="InkAge" className="login-sig" />
        <span className="eyebrow" style={{ textAlign: "center" }}>Második lépés</span>
        <p className="note">Írd be a hitelesítő alkalmazásban (pl. Google Authenticator, 1Password) látható hatjegyű kódot.</p>
        <label className="lf"><span>Kód</span><input className="adm-in" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} autoFocus required /></label>
        {msg && <div className="alert err" role="alert">{msg}</div>}
        <button className="btn" disabled={busy} aria-busy={busy || undefined}>{busy && <span className="spin" aria-hidden="true" />}Belépés</button>
        <button type="button" className="note lnk-btn" onClick={cancel}>← Másik fiók / vissza</button>
      </form>
    </div>
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
    const { error } = (await sb?.auth.updateUser({ password: pw })) || { error: null };
    setBusy(false);
    if (error) return setMsg(/same|different/i.test(error.message) ? "Az új jelszó nem lehet ugyanaz, mint a régi." : "Nem sikerült menteni. Kérj új linket az „Elfelejtett jelszó” gombbal.");
    done();
  };
  return (
    <div className={cls}>
      <form className="gate-card login-card" onSubmit={submit}>
        <SignatureLine text="InkAge" className="login-sig" />
        <span className="eyebrow" style={{ textAlign: "center" }}>Új jelszó</span>
        <label className="lf"><span>Új jelszó</span><input className="adm-in" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} required /></label>
        <label className="lf"><span>Még egyszer</span><input className="adm-in" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} required /></label>
        {msg && <div className="alert err" role="alert">{msg}</div>}
        <button className="btn" disabled={busy} aria-busy={busy || undefined}>{busy && <span className="spin" aria-hidden="true" />}Mentés és belépés</button>
        <button type="button" className="note lnk-btn" onClick={done}>Most nem</button>
      </form>
    </div>
  );
}
