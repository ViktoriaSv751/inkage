"use client";
/* What guards the phone from outside the dashboard (drawn from layout.tsx, so every screen has it):
   - the device lock: Face ID or fingerprint through the browser, an extra lock on top of the normal sign-in. Off until she
     turns it on, kept in this browser only, and it never touches the sign-in itself. Whoever cannot pass it signs out and
     signs in again with the password.
   - the desktop layout on a phone, as a last resort.
   - a link shared from another app (Android home-screen app): it waits for the idea box. */
import { useEffect, useMemo, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { cacheClear, toast } from "./phone";

const LOCK = "inkage.admin.lock", LEFT = "inkage.admin.lock_left", SHUT = "inkage.admin.lock_on", DESK = "inkage.admin.desk";
export const SHARED = "inkage.admin.shared";
export type LockCfg = { id: string; after: number };
const ls = { get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k: string, v: string | null) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch {} } };
const isMock = () => { try { return process.env.NODE_ENV !== "production" && new URLSearchParams(location.search).has("mock"); } catch { return false; } };

export const readLock = (): LockCfg | null => { try { const v = JSON.parse(ls.get(LOCK) || "null"); return v?.id ? v : null; } catch { return null; } };
const rnd = (k: number) => crypto.getRandomValues(new Uint8Array(k));
const toB64 = (b: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

/* does this device have Face ID, a fingerprint or a screen lock the browser may use */
export async function lockAvailable() {
  try { return !!window.PublicKeyCredential && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(); } catch { return false; }
}
/* turning it on: the phone makes a key that stays on it and asks for the face or finger once. Returns an error text, or "" */
export async function lockOn(after: number): Promise<string> {
  try {
    const c = await navigator.credentials.create({ publicKey: {
      challenge: rnd(32), rp: { name: "InkAge Irányító" }, user: { id: rnd(16), name: "iranyito", displayName: "Irányító" },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "discouraged" }, timeout: 60000, attestation: "none" } }) as PublicKeyCredential | null;
    if (!c) return "Nem sikerült bekapcsolni.";
    ls.set(LOCK, JSON.stringify({ id: toB64(c.rawId), after })); ls.set(LEFT, String(Date.now()));
    return "";
  } catch (e) { return (e as Error)?.name === "NotAllowedError" ? "Megszakítva, a zár nem kapcsolt be." : "Ezen az eszközön most nem sikerült bekapcsolni."; }
}
let asking = false;
async function askFace(l: LockCfg): Promise<boolean> {
  asking = true;
  try {
    const a = await navigator.credentials.get({ publicKey: { challenge: rnd(32), allowCredentials: [{ type: "public-key", id: fromB64(l.id) }], userVerification: "required", timeout: 60000 } });
    /* only a passed check restarts the clock: a failed one, or leaving while locked, must not open it at the next start */
    if (a) { ls.set(LEFT, String(Date.now())); ls.set(SHUT, null); }
    return !!a;
  } catch { return false; } finally { asking = false; }
}
/* before a risky action: the face or finger again when the lock is on. With the lock off there is nothing to ask here, the action's own question stays */
export async function reverify(): Promise<boolean> {
  const l = readLock(); if (!l) return true;
  const ok = await askFace(l); if (!ok) toast("Nem sikerült azonosítani: a művelet nem futott le");
  return ok;
}
/* turning it off needs the face or finger too */
export async function lockOff(): Promise<boolean> { if (!(await reverify())) return false; ls.set(LOCK, null); ls.set(LEFT, null); ls.set(SHUT, null); return true; }
export function lockAfter(after: number) { const l = readLock(); if (l) ls.set(LOCK, JSON.stringify({ ...l, after })); }

/* ---------- the desktop layout on a phone: the page is laid out 1280 px wide, so everything falls to its desktop form ---------- */
export const deskOn = () => ls.get(DESK) === "1";
export function setDesk(on: boolean) { ls.set(DESK, on ? "1" : null); location.reload(); }

export function AdminGuards() {
  const sb = useMemo(() => supabaseBrowser(), []);
  const [locked, setLocked] = useState(false); const [fail, setFail] = useState(false); const [desk, setDeskS] = useState(false);
  const isLocked = useRef(false), checked = useRef(false);
  useEffect(() => {
    /* only with a sign-in behind it: the sign-in screen is never locked */
    const check = async () => {
      const open = () => { isLocked.current = false; setLocked(false); checked.current = true; document.documentElement.removeAttribute("data-adm-locked"); };
      const l = readLock(); if (!l) { open(); return; }
      const left = Number(ls.get(LEFT)) || 0;
      /* once locked it stays locked until a face or finger passes, through any number of restarts */
      if (ls.get(SHUT) !== "1" && left && Date.now() - left <= l.after * 60e3) { open(); return; }
      ls.set(SHUT, "1"); isLocked.current = true; setLocked(true); checked.current = true;
      if (!isMock()) { const s = await sb?.auth.getSession().catch(() => null); if (!s?.data.session) { ls.set(SHUT, null); open(); } }
    };
    check();
    /* the time of leaving counts only when it was open */
    const hide = () => { if (!asking && !isLocked.current && document.visibilityState === "hidden") ls.set(LEFT, String(Date.now())); };
    const back = () => { if (!asking && document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", hide); document.addEventListener("visibilitychange", back); addEventListener("pagehide", hide);
    return () => { document.removeEventListener("visibilitychange", hide); document.removeEventListener("visibilitychange", back); removeEventListener("pagehide", hide); };
  }, [sb]);
  useEffect(() => { if (locked) document.documentElement.setAttribute("data-adm-locked", "1"); else if (checked.current) document.documentElement.removeAttribute("data-adm-locked"); }, [locked]);
  /* the old discreet mode is gone: a phone that had it on gets everything back */
  useEffect(() => { ls.set("inkage.admin.discreet", null); document.documentElement.removeAttribute("data-adm-discreet"); }, []);
  /* the desktop layout, only on a small screen; there is always a way back */
  useEffect(() => {
    if (!deskOn() || screen.width > 980) return;
    setDeskS(true);
    /* the page's own tag may arrive after this runs: set for a few seconds, every copy of it */
    const want = `width=1280, initial-scale=${(screen.width / 1280).toFixed(3)}, minimum-scale=0.1`;
    const put = () => document.querySelectorAll('meta[name="viewport"]').forEach((m) => { if (m.getAttribute("content") !== want) m.setAttribute("content", want); });
    put(); const t = setInterval(put, 300), e = setTimeout(() => clearInterval(t), 4000);
    return () => { clearInterval(t); clearTimeout(e); };
  }, []);
  /* a link shared from another app: kept for the idea box, and the address is cleaned at once */
  useEffect(() => {
    const u = new URL(location.href), g = (k: string) => u.searchParams.get(k) || "";
    if (!["share_url", "share_text", "share_title"].some((k) => u.searchParams.has(k))) return;
    const text = g("share_text"), url = g("share_url") || text.match(/https?:\/\/\S+/)?.[0] || "";
    ls.set(SHARED, JSON.stringify({ url: url.slice(0, 500), text: [g("share_title"), text.replace(url, "").trim()].filter(Boolean).join(" · ").slice(0, 300) }));
    ["share_url", "share_text", "share_title"].forEach((k) => u.searchParams.delete(k));
    history.replaceState(null, "", u.pathname + u.search + "#planner"); dispatchEvent(new HashChangeEvent("hashchange")); dispatchEvent(new Event("adm-shared"));
  }, []);
  const unlock = async () => { const l = readLock(); if (!l) { setLocked(false); return; } setFail(false); if (await askFace(l)) { isLocked.current = false; setLocked(false); } else setFail(true); };
  /* the way out for a phone whose face or finger does not pass: the normal sign-in, with the password */
  const leave = async () => { await sb?.auth.signOut().catch(() => null); cacheClear(); ls.set(LOCK, null); ls.set(LEFT, null); ls.set(SHUT, null); location.reload(); };
  return (
    <>
      {locked && <div className="adm-lock lg" role="dialog" aria-modal="true" aria-label="Zárolva">
        <div className="lg-h">
          <svg className="lg-sig" viewBox="0 0 520 150" aria-hidden="true"><text x="10" y="112" className="sig-s">InkAge</text><text x="10" y="112" className="sig-f">InkAge</text></svg>
          <span>Zárolva</span>
        </div>
        {fail && <p className="lg-msg err" role="alert">Nem sikerült. Próbáld újra.</p>}
        <button className="lg-go" onClick={unlock} aria-label="Feloldás Face ID-val, ujjlenyomattal vagy a telefon zárkódjával">
          <i><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" fillRule="evenodd" d="M12 2a5 5 0 0 1 5 5v3h1a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h1V7a5 5 0 0 1 5-5zm0 2.200A2.800 2.800 0 0 0 9.200 7v3h5.600V7A2.800 2.800 0 0 0 12 4.200zM11 14v4h2v-4z" /></svg></i>
          <span>Feloldás</span>
        </button>
        <button className="lg-lnk" onClick={leave}>Kilépés, és belépés jelszóval</button>
      </div>}
      {desk && <DeskBack />}
    </>
  );
}

/* the way back from the desktop layout: always the same size in the corner of what is really on screen, however far the page is zoomed */
function DeskBack() {
  const [st, setSt] = useState<React.CSSProperties>({});
  useEffect(() => {
    const v = window.visualViewport; if (!v) return;
    const f = () => setSt({ left: v.offsetLeft + 10 / v.scale, top: v.offsetTop + 10 / v.scale, fontSize: 14 / v.scale, padding: `${10 / v.scale}px ${14 / v.scale}px`, borderRadius: 12 / v.scale });
    f(); v.addEventListener("resize", f); v.addEventListener("scroll", f); const t = setInterval(f, 1000);
    return () => { v.removeEventListener("resize", f); v.removeEventListener("scroll", f); clearInterval(t); };
  }, []);
  return <button className="adm-desk-back" style={st} onClick={() => setDesk(false)}>Vissza a telefonos nézetre</button>;
}
