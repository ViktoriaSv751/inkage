"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
/* Teendők: everything that wants something from her, in one list by importance: signals, messages, errors, due
   follow-ups and her own tasks. To the left: tomorrow, further: done; to the right: hide. Every row has one button that
   does it or goes there. A new kind of task: add a source to TODO_SOURCES (docs/admin-phone-api.md). */
import { useContext, useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Field, Sheet, SwipeRow, haptic, toast } from "../phone";
import { useOwnTasks } from "../phone-host";
import { AIC, FreshCtx, HUMAN, I, P, PF, SOC, ago, api, big, chime, freshOf, markSolved, n, rpc, solvedAt, type D, type Tab, useRpc, useSaved } from "../shared";
import { fmt } from "../charts";
import { Hero, Ring, Trio } from "../ink";
import { bpDay, huOn, noEmoji, signals, sigKey, useSigState, worse } from "./alerts";
import { rising, viewWord } from "./social";
import { UserDrawer } from "./users";

export type TodoItem = {
  key: string; src: string; tone: "bad" | "warn" | "good" | "info"; rank: number; t: string; s?: string; when?: string | null;
  act: { l: string; run: () => void };
  /* left out: she can still do it, the mark is kept with the Teendők list's own marks */
  done?: () => void; later?: () => void; undo?: () => void;
  /* put off by its own source (a signal, a message), until this day; unsnooze brings it back */
  snoozed?: string | null; unsnooze?: () => void;
  /* for a mark of the list itself: the figure on the card (a real worsening opens it again) and how long "Kész" holds, 14 days unless said */
  num?: number; keepDays?: number;
};
export type TodoCtx = { d: D; go: (t: Tab) => void; openUser: (id: string) => void; pend?: Set<string> };
type Mark = { until?: string; hide?: 1; done?: 1; at?: string; n?: number };

const CHANGED = "inkage:todo";
export const changed = () => dispatchEvent(new Event(CHANGED));
/* a source's list reloads when anything was marked anywhere */
export function useReload(load: () => void) { useEffect(() => { addEventListener(CHANGED, load); return () => removeEventListener(CHANGED, load); }, [load]); }

/* the signals: "Kész" and "Holnap" are the same marks as on the Jelzések page */
function useAlertItems({ d, go, pend }: TodoCtx): TodoItem[] {
  const list = signals(d), S = useSigState(list);
  if (S.server == null) pend?.add("alerts");
  const RANK = { bad: 90, warn: 60, good: 25, info: 15 } as const, SRC = { bad: "Hiba", warn: "Figyelem", good: "Jó hír", info: "Tipp" } as const;
  /* the failed sign-ins are one fault with the error groups of the same kind: closing it closes both */
  const fails = [...((d.signin_fail || []) as D[]), ...signinGroups(d)].filter((x) => !solvedAt(x));
  return list.filter((x) => !S.hidden(x) || S.laterUntil(x)).map((x) => ({
    key: "alert:" + sigKey(x), src: SRC[x.c], tone: x.c, rank: RANK[x.c], t: x.t, s: x.s, when: S.since(x),
    act: x.to ? { l: "Megnézem", run: () => go(x.to!) } : { l: "Rendben", run: () => { S.mark(x, "done"); changed(); } },
    done: () => { S.mark(x, "done"); if (SIGNIN_SIG.test(x.t)) fails.forEach(markSolved); }, later: () => S.mark(x, "later"), undo: () => S.mark(x, "open"),
    snoozed: S.laterUntil(x), unsnooze: () => S.mark(x, "open"),
  }));
}
const SIGNIN_SIG = /sikertelen .*belépés/;
const signinGroups = (d: D) => ((d.error_groups || []) as D[]).filter((x) => x.name === "signin_failed" || x.name === "auth_error");
/* "Holnap" on a message: hers only, nobody sees it. The Postafiók and this list read the same mark */
export function useInboxLater() {
  const [later, setLater] = useSaved<Record<string, string>>("phone_inbox_later", {});
  const today = bpDay();
  const put = (k: string, on: boolean) => { setLater((o) => Object.fromEntries([...Object.entries(o).filter(([x, v]) => v > today && x !== k), ...(on ? [[k, bpDay(1)]] : [])])); changed(); };
  return { until: (k: string) => (later[k] > today ? later[k] : null), put };
}
/* messages, comments, reviews: "Kész" closes them in the Postafiók too */
function useInboxItems({ go, pend }: TodoCtx): TodoItem[] {
  const sb = useMemo(() => supabaseBrowser(), []);
  const q = useRpc("admin_inbox", { p_all: false }, []); useReload(q.load);
  const L = useInboxLater();
  if (!q.d) pend?.add("inbox");
  const items: D[] = ((q.d?.items || []) as D[]).filter((x) => !x.done);
  const set = (x: D, on: boolean) => rpc(sb, "admin_inbox_done", { p_source: x.source, p_item: x.item_id, p_done: on }).then(({ error }) => { if (error) toast("Nem sikerült menteni"); changed(); });
  return items.map((x) => {
    const urgent = x.tag === "hiba" || x.tag === "panasz" || (x.rating != null && n(x.rating) <= 2), lk = x.source + "|" + x.item_id;
    return { key: `inbox:${x.source}:${x.item_id}`, src: urgent ? "Panasz" : x.source === "support" ? "Üzenet" : "Komment", tone: urgent ? "warn" : "info", rank: urgent ? 80 : x.source === "support" ? 72 : 50,
      t: `${x.author || "Névtelen"}: ${String(x.body || "").slice(0, 90)}`, s: x.post_title ? String(x.post_title).slice(0, 80) : undefined, when: x.created_at,
      act: { l: "Válasz", run: () => go("inbox") }, done: () => { set(x, true); }, undo: () => { set(x, false); },
      later: () => L.put(lk, true), snoozed: L.until(lk), unsnooze: () => L.put(lk, false) } as TodoItem;
  });
}
/* errors the system saw and nobody closed yet; a failed sign-in with a signal of its own stands once, as that signal */
function useErrorItems({ d, go }: TodoCtx): TodoItem[] {
  const signal = ((d.signin_fail || []) as D[]).some((x) => !solvedAt(x));
  return ((d.error_groups || []) as D[]).filter((x) => !solvedAt(x) && !(signal && signinGroups({ error_groups: [x] }).length)).slice(0, 12).map((x) => ({
    key: "err:" + String(x.name) + ":" + String(x.msg || "").slice(0, 40), src: "Hiba", tone: "bad", rank: n(x.n) >= 5 ? 100 : 85, t: (HUMAN.find(([re]) => re.test(String(x.msg || "")))?.[1] || String(x.msg || x.name)).slice(0, 110), s: `${n(x.n)} eset`, when: x.last,
    act: { l: "Megnézem", run: () => go("monitor") }, done: () => markSolved(x),
  }));
}
/* the people she wanted to get back to, whose day has come */
function useFollowItems({ openUser, pend }: TodoCtx): TodoItem[] {
  const sb = useMemo(() => supabaseBrowser(), []);
  const q = useRpc("admin_people_today", undefined, []); useReload(q.load);
  if (!q.d) pend?.add("follow");
  const rows: D[] = (Array.isArray(q.d) ? q.d : []).filter((x: D) => x.why === "followup");
  const mark = async (id: string, on: boolean) => {
    const { data } = await rpc(sb, "admin_user_more", { p_id: id });
    const notes = ((data as D)?.notes || []).filter((x: D) => x.follow_up && (on ? !x.done_at && String(x.follow_up).slice(0, 10) <= bpDay() : x.done_at));
    await Promise.all(notes.map((x: D) => rpc(sb, "admin_note_user_done", { p_id: x.id, p_done: on }))); changed();
  };
  return rows.map((x) => ({ key: "follow:" + x.id, src: "Visszakeresés", tone: "warn", rank: 70, t: `Keresd vissza: ${x.email || "egy ember"}`, s: "Ma esedékes, a jegyzeted szerint", act: { l: "Adatlap", run: () => openUser(x.id) }, done: () => { mark(x.id, true); }, undo: () => { mark(x.id, false); } }));
}
/* what she wrote down herself */
function useOwnItems({ go, pend }: TodoCtx): TodoItem[] {
  const [tasks, setTasks, tasksReady] = useOwnTasks();
  if (!tasksReady) pend?.add("own");
  return tasks.filter((x) => !x.done_at).map((x) => {
    const done = () => setTasks((o) => o.filter((y) => y.id !== x.id));
    return { key: "own:" + x.id, src: "Saját", tone: "info", rank: 74, t: x.t, when: x.at, act: x.to ? { l: "Odamegyek", run: () => go(x.to!) } : { l: "Kész", run: () => { done(); toast("Kész · szép munka"); } }, done, undo: () => setTasks((o) => [...o, x]) };
  });
}
/* is every source delivering: the same list as the lamp on Ma */
export const useSrcs = () => {
  const f = useContext(FreshCtx);
  if (!f) return null;
  const list = ["events", ...SOC.filter((k) => f.platforms?.[k]), "gsc", ...(f.apple ? ["apple"] : []), ...(f.google ? ["google"] : []), ...(f.index ? ["index"] : [])];
  return list.map((k) => ({ k, ...freshOf(f, k) }));
};
/* what comes from the work itself: a post taking off, today's plans, accounts stuck, sources late, connections missing */
function useWorkItems({ go, pend }: TodoCtx): TodoItem[] {
  const k = bpDay();
  const soc = useRpc("admin_social", { p_days: 7 }, []), plans = useRpc("admin_plans", { p_from: k, p_to: k }, [k]), ppl = useRpc("admin_people", { p_q: "", p_limit: 1, p_offset: 0, p_filter: "all" }, []);
  const roll = useRpc("admin_rollup_status", undefined, []), ex = useRpc("admin_home_extra", { p_days: 7 }, []);
  const [st, setSt] = useState<D | null>(null);
  useEffect(() => { api("/api/admin/status").then((r) => setSt(r.ok ? r.json : {})).catch(() => setSt({})); }, []);
  const srcs = useSrcs();
  if (!soc.d || !plans.d || !st) pend?.add("work");
  const out: TodoItem[] = [], open = (t: Tab, l = "Megnézem") => ({ l, run: () => go(t) }), accs: D[] = (soc.d?.accounts || []) as D[];
  rising((soc.d?.posts || []) as D[]).slice(0, 1).forEach((p) => out.push({ key: "work:rising:" + p.platform + p.post_id, src: "Most robban", tone: "warn", rank: 88, t: `Most robban: ${String(p.title || "").slice(0, 40)}`, s: `${big(p.views)} ${viewWord(p.platform)} ${fmt(p.h, 0)} óra alatt, a szokásos ${fmt(p.x, 1)}×-ese. Válaszolj a kommentekre most.`, act: open("inbox", "Postafiók") }));
  ((Array.isArray(plans.d) ? plans.d : []) as D[]).filter((p) => p.status !== "kint").forEach((p) => out.push({ key: "work:plan:" + (p.id || p.title), src: "Terv", tone: "info", rank: 73, t: `Ma: ${p.title}`, s: `${p.at ? String(p.at).slice(0, 5) + " · " : ""}${(p.platforms || []).map((x: string) => PF[x] || x).join(", ")}`, act: open("planner", "Tervező") }));
  const stuck = n(ppl.d?.counts?.stuck), late = (srcs || []).filter((x) => !x.ok).length;
  if (stuck) out.push({ key: "work:stuck", src: "Emberek", tone: "warn", rank: 58, t: `${fmt(stuck)} elakadt`, s: "Legalább 3 napja regisztráltak, de még nincs előnézetük.", num: stuck, act: open("users") });
  if (late) out.push({ key: "work:late", src: "Adatok", tone: "warn", rank: 56, t: `${fmt(late)} adatforrás késik`, s: "Ezekből régebbi a szám a szokásosnál.", num: late, keepDays: 1, act: open("monitor") });
  /* every connection that is missing, not only TikTok, Instagram and Google */
  if (soc.d) {
    const miss = (["tiktok", "instagram", "facebook", "youtube", "pinterest", "linkedin"] as const).filter((x) => !accs.some((a) => a.platform === x));
    if (miss.length) out.push({ key: "work:connect", src: "Bekötés", tone: "info", rank: 30, t: `Még nincs bekötve: ${miss.map((x) => PF[x]).join(", ")}`, s: "Bekötés után a ranglistán, a megjelenésekben és a postafiókban is ott lesznek.", num: miss.length, act: open("connect", "Bekötés") });
  }
  if (st && st.gsc === false) out.push({ key: "work:gsc", src: "Bekötés", tone: "info", rank: 30, t: "Kösd be a Google-t", s: "Mit keresnek, és melyik cikked hoz kattintást a Google-ből.", act: open("connect", "Bekötés") });
  const noStore = st ? ([st.apple === false && "App Store", st.google_play === false && "Google Play"].filter(Boolean) as string[]) : [];
  if (noStore.length) out.push({ key: "work:stores", src: "Bekötés", tone: "info", rank: 30, t: `Kösd be: ${noStore.join(" és ")}`, s: "Letöltések, értékelések és a vélemények a postafiókban.", act: open("connect", "Bekötés") });
  /* the key may be set with no data yet (Bing gives its first numbers within 48 hours): then it is connected, not missing */
  if (ex.d && !ex.d.bing && roll.d && !roll.d.bing && st && st.bing === false) out.push({ key: "work:bing", src: "Bekötés", tone: "info", rank: 30, t: "Kösd be a Binget", s: "Bing Webmaster-kulcs (BING_WMT_KEY): a Bing-keresések és -kattintások is látszanak.", act: open("connect", "Bekötés") });
  return out;
}

/* every list that feeds Teendők; the order here is fixed for the lifetime of the page. Ma, Áttekintés, the badge and this page all read this one list */
export const TODO_SOURCES: { k: string; l: string; use: (c: TodoCtx) => TodoItem[] }[] = [
  { k: "alerts", l: "Jelzések", use: useAlertItems },
  { k: "inbox", l: "Postafiók", use: useInboxItems },
  { k: "errors", l: "Hibák", use: useErrorItems },
  { k: "follow", l: "Visszakeresés", use: useFollowItems },
  { k: "own", l: "Saját", use: useOwnItems },
  { k: "work", l: "Munka", use: useWorkItems },
];

/* all sources together, without what she put away, the most important first.
   The one main number everywhere is open.length: "Teendő". Anything else (sürgős, hiba, jelzés) is a named part of it */
export function useTodoItems(ctx: TodoCtx) {
  const [marks, setMarks, marksReady] = useSaved<Record<string, Mark>>("phone_todo_state", {});
  /* every source says here while it has not answered: an empty list counts only when all of them did */
  const pend = new Set<string>();
  const all = TODO_SOURCES.flatMap((s) => s.use({ ...ctx, pend })); // eslint-disable-line react-hooks/rules-of-hooks
  const today = bpDay();
  const held = (x: TodoItem) => { const m = marks[x.key]; if (!m?.done) return false; if (x.num != null && m.n != null && worse(m.n, x.num)) return false; return !m.at || (Date.parse(today) - Date.parse(m.at)) / 864e5 < (x.keepDays ?? 14); };
  const put = (x: TodoItem) => { const m = marks[x.key]; return !!x.snoozed || (!!m && (!!m.hide || (!!m.until && m.until > today))); };
  const open = all.filter((x) => !held(x) && !put(x)).sort((a, b) => b.rank - a.rank || String(b.when || "").localeCompare(String(a.when || "")));
  const away = all.filter((x) => !held(x) && put(x)), closed = all.filter((x) => held(x));
/* the marks stay small: only those of tasks that still exist, plus the newest few */
  const setMark = (k: string, m: Mark | null) => setMarks((o) => { const x = { ...o }; if (m) x[k] = { ...m, at: bpDay() }; else delete x[k]; const es = Object.entries(x); return es.length > 90 ? Object.fromEntries(es.sort((a, b) => String(b[1].at || "").localeCompare(String(a[1].at || ""))).slice(0, 80)) : x; });
  /* one door for "Kész", "Holnap" and "Elrejt", wherever the card stands */
  const act = (x: TodoItem, how: "done" | "later" | "hide") => {
    if (how === "done") { if (x.done) x.done(); else { setMark(x.key, { done: 1, n: x.num }); toast("Kész · szép munka"); } chime(880); }
    else if (how === "later") { if (x.later) x.later(); else { setMark(x.key, { until: bpDay(1) }); toast("Holnap újra szól"); } }
    else { setMark(x.key, { hide: 1 }); toast("Elrejtve"); }
    changed();
  };
  const restore = (x: TodoItem) => { setMark(x.key, null); if (x.snoozed) x.unsnooze?.(); changed(); };
  return { open, away, closed, marks, setMark, act, restore, ready: marksReady && !pend.size };
}
export type TodoState = ReturnType<typeof useTodoItems>;

/* the number on the bottom tab: the same as the list's */
export function TodoBadge({ d, go }: { d: D; go: (t: Tab) => void }) {
  const { open } = useTodoItems({ d, go, openUser: () => {} });
  return open.length ? <span className="cnt">{open.length}</span> : null;
}

export function Todo({ d, go }: { d: D; go: (t: Tab) => void }) {
  const [user, setUser] = useState<string | null>(null);
  const T = useTodoItems({ d, go, openUser: setUser });
  const [gone, setGone] = useState<string[]>([]); const [det, setDet] = useState<TodoItem | null>(null); const [away, setAway] = useState(false);
  const [undo, setUndo] = useState<{ l: string; run: () => void } | null>(null);
  const [nw, setNw] = useState(""); const [, setTasks] = useOwnTasks();
  /* what got done on this list today, and the days the list reached zero: kept with her settings, from the first use on */
  const today = bpDay(), yesterday = bpDay(-1);
  const [dayLog, setDayLog, dayReady] = useSaved<{ day?: string; done?: string[] }>("phone_todo_day", {});
  const [streak, setStreak, streakReady] = useSaved<{ last?: string; n?: number; best?: number }>("phone_todo_streak", {});
  const doneToday = dayLog.day === today ? dayLog.done || [] : [];
  const logDone = (k: string, on: boolean) => setDayLog((o) => { const was = o.day === today ? o.done || [] : []; return { day: today, done: (on ? [...was.filter((x) => x !== k), k] : was.filter((x) => x !== k)).slice(-200) }; });
  useEffect(() => { if (!undo) return; const t = setTimeout(() => setUndo(null), 6000); return () => clearTimeout(t); }, [undo]);
  const list = T.open.filter((x) => !gone.includes(x.key));
  useEffect(() => {
    if (!T.ready || !streakReady || list.length || streak.last === today) return;
    const n2 = streak.last === yesterday ? n(streak.n) + 1 : 1;
    setStreak({ last: today, n: n2, best: Math.max(n(streak.best), n2) });
  }, [T.ready, streakReady, list.length, streak.last]); // eslint-disable-line react-hooks/exhaustive-deps
  const streakN = streak.last === today || streak.last === yesterday ? n(streak.n) : 0;
  const dayN = doneToday.length, dayAll = dayN + list.length;
  const put = (x: TodoItem, how: "done" | "later" | "hide") => {
    setGone((g) => [...g, x.key]); setDet(null);
    if (how === "done") logDone(x.key, true);
    T.act(x, how);
    const canUndo = how === "hide" || how === "later" && !x.later || how === "done" && (!x.done || x.undo);
    setUndo(canUndo || x.undo ? { l: how === "done" ? "Kész" : how === "later" ? "Holnap újra szól" : "Elrejtve", run: () => {
      setGone((g) => g.filter((k) => k !== x.key)); T.setMark(x.key, null);
      if (how === "done") logDone(x.key, false);
      if (how === "later" && x.unsnooze) x.unsnooze(); else if ((how === "done" && x.done) || (how === "later" && x.later)) x.undo?.();
      changed(); setUndo(null); haptic(6);
    } } : null);
    if (!canUndo && !x.undo) toast(how === "done" ? "Kész · szép munka" : "Holnap újra szól");
  };
  const add = () => { const t = nw.trim(); if (!t) return; setTasks((o) => [...o, { id: String(Date.now()), t: t.slice(0, 200), at: new Date().toISOString() }].slice(-40)); setNw(""); haptic(8); };
  /* the buttons that simply finish a task go through the same door as "Kész", so they count too */
  const doIt = (x: TodoItem) => { if (x.act.l === "Kész" || x.act.l === "Rendben") put(x, "done"); else x.act.run(); };
  const top = list[0], rest = list.slice(1);
  const count = (t: TodoItem["tone"]) => list.filter((x) => x.tone === t).length;
  return (
    <div className="g io">
      <div className="s12 io-small"><Hero label="Teendő vár rád" v={list.length} side={<Trio items={[{ l: "ebből hiba", v: count("bad") }, { l: "ebből figyelem", v: count("warn") }, { l: "későbbre téve", v: T.away.length, run: T.away.length ? () => setAway(true) : undefined }]} />} /></div>
      {(dayAll > 0 || streakN > 0) && <section className="s12 io-day" aria-label="A mai nap">
        {dayReady && <Ring p={dayAll ? dayN / dayAll : 1} kind="seg" size={64} label={`Ma elintézve: ${dayN} a ${dayAll}-ből`}><b>{dayN}</b></Ring>}
        <div className="io-t"><b>{dayAll ? `Ma elintézve: ${dayN} / ${dayAll}` : "Ma nincs teendő"}</b><small>{streakN ? `${streakN} napja nullázod a listát${n(streak.best) > streakN ? ` · a legjobb: ${n(streak.best)}` : ""}` : "A sorozat mostantól számít"}</small></div>
      </section>}
      {/* the deck: the most important one, big and white; done or tomorrow brings up the next */}
      {top ? <section className={"s12 io-deck n" + Math.min(2, rest.length)} aria-label="A legfontosabb teendő">
        <SwipeRow key={top.key} done={() => put(top, "done")} later={() => put(top, "later")} hide={() => put(top, "hide")} open={() => setDet(top)}>
          <article className={"io-card ink-flip " + top.tone}>
            <small className="io-card-m"><span>{top.src}{top.when ? ` · ${ago(top.when)}` : ""}</span><span>1 / {list.length}</span></small>
            <b className="io-card-t">{noEmoji(top.t)}</b>
            {top.s && <p className="io-card-s">{top.s}</p>}
            <div className="io-card-a" onClick={(e) => e.stopPropagation()}>
              <button className="adm-ibtn gold" onClick={() => doIt(top)}>{top.act.l}</button>
              {top.act.l !== "Kész" && top.act.l !== "Rendben" && <button className="adm-ibtn" onClick={() => put(top, "done")}>{I(P.check)}Kész</button>}
              <button className="adm-ibtn" onClick={() => put(top, "later")}>Holnap</button>
              <button className="adm-ibtn" onClick={() => put(top, "hide")}>Elrejt</button>
            </div>
          </article>
        </SwipeRow>
      </section> : <section className="s12 io-card io-done ink-flip"><span aria-hidden="true">{I(P.check)}</span><b className="io-card-t">Ma mindennel kész vagy</b>{T.away.length > 0 && <p className="io-card-s">{T.away.length} dolog vár későbbre.</p>}</section>}
      {rest.length > 0 && <section className="s12 io-sec"><h3 className="ink-h">Utána jön · {rest.length}</h3><ul className="io-rows">
        {rest.map((x) => (
          <li key={x.key}><SwipeRow done={() => put(x, "done")} later={() => put(x, "later")} hide={() => put(x, "hide")} open={() => setDet(x)}>
            <div className={"io-row go " + x.tone}><span className="io-ic">{I(AIC[x.tone])}</span>
              <div className="io-t"><b>{noEmoji(x.t)}</b><small>{x.src}{x.when ? ` · ${ago(x.when)}` : ""}{x.s ? ` · ${x.s}` : ""}</small></div>
              <button className="io-pill" onClick={(e) => { e.stopPropagation(); doIt(x); }}>{x.act.l}</button></div>
          </SwipeRow></li>
        ))}
      </ul></section>}
      {T.away.length + T.closed.length > 0 && <button className="s12 io-pill wide" onClick={() => setAway(true)}>Későbbre téve · {T.away.length}{T.closed.length ? ` · kész · ${T.closed.length}` : ""}</button>}
      <section className="s12 io-new"><input className="adm-in" value={nw} maxLength={200} placeholder="Új teendő…" enterKeyHint="done" onChange={(e) => setNw(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} aria-label="Új teendő" />{nw.trim() && <button className="adm-ibtn gold" onClick={add}>Hozzáad</button>}</section>
      <Routine go={go} />
      {undo && <div className="io-undo" role="status"><span>{undo.l}</span><button onClick={undo.run}>Visszavon</button></div>}
      {det && <Sheet title={det.src} close={() => setDet(null)} foot={<div className="ps-row"><button className="adm-ibtn gold" onClick={() => { const x = det; setDet(null); doIt(x); }}>{det.act.l}</button><button className="adm-ibtn" onClick={() => put(det, "done")}>Kész</button><button className="adm-ibtn" onClick={() => put(det, "later")}>Holnap</button><button className="adm-ibtn" onClick={() => put(det, "hide")}>Elrejt</button></div>}>
        <p className="ps-p"><b>{noEmoji(det.t)}</b></p>{det.s && <p className="ps-p">{det.s}</p>}{det.when && <p className="ps-p mut">{ago(det.when)}</p>}
      </Sheet>}
      {away && <Sheet title="Későbbre téve" close={() => setAway(false)}>
        <ul className="io-rows">{[...T.away, ...T.closed].map((x) => { const u = x.snoozed || T.marks[x.key]?.until, shut = T.closed.includes(x);
          return <li key={x.key} className="io-row"><div className="io-t"><b>{noEmoji(x.t)}</b><small>{shut ? "kész" : u ? `${u === bpDay(1) ? "holnap" : huOn(u)} újra szól` : "elrejtve"}</small></div><button className="io-pill" onClick={() => { T.restore(x); setGone((g) => g.filter((k) => k !== x.key)); }}>Vissza</button></li>; })}</ul>
      </Sheet>}
      {user && <UserDrawer id={user} close={() => setUser(null)} changed={changed} />}
    </div>
  );
}

/* ---------- the daily routine: ticks start over every day ---------- */
type RoutineItem = { k: string; l: string; to?: Tab };
const ROUTINE: RoutineItem[] = [{ k: "index", l: "Indexelés kérése a Google-ben", to: "seo" }, { k: "reddit", l: "Reddit: mai szálak, válaszok" }, { k: "pinterest", l: "Pinterest: a mai pinek", to: "planner" }];
type RoutineState = { day?: string; done?: string[]; items?: RoutineItem[] };
function Routine({ go }: { go: (t: Tab) => void }) {
  const [s, setS] = useSaved<RoutineState>("phone_todo_routine", {});
  const [edit, setEdit] = useState(false); const [nw, setNw] = useState("");
  const today = bpDay(), items = s.items || ROUTINE, done = s.day === today ? s.done || [] : [];
  const toggle = (k: string) => { haptic(8); setS({ ...s, day: today, done: done.includes(k) ? done.filter((x) => x !== k) : [...done, k] }); };
  const nDone = done.filter((k) => items.some((x) => x.k === k)).length;
  return (
    <section className="c s12 io-rt">
      <div className="io-rt-h"><Ring p={nDone / Math.max(1, items.length)} kind="seg" size={84}><b>{nDone}/{items.length}</b></Ring><h2>Napi rutin</h2><button className="io-pill" onClick={() => setEdit(true)}>Szerkesztés</button></div>
      <ul className="io-rows">{items.map((x) => <li key={x.k} className={"io-row" + (done.includes(x.k) ? " on" : "")}><button className="io-ck" role="checkbox" aria-checked={done.includes(x.k)} onClick={() => toggle(x.k)}><i>{done.includes(x.k) && I(P.check)}</i><span>{x.l}</span></button>{x.to && <button className="io-pill" onClick={() => go(x.to!)} aria-label={"Odamegyek: " + x.l}>Odamegyek</button>}</li>)}</ul>
      {edit && <Sheet title="Napi rutin" close={() => setEdit(false)}>
        <ul className="io-rows">{items.map((x) => <li key={x.k} className="io-row"><div className="io-t"><b>{x.l}</b></div><button className="io-pill" onClick={() => setS({ ...s, items: items.filter((y) => y.k !== x.k) })}>Törlés</button></li>)}</ul>
        <Field label="Új lépés"><input className="adm-in" value={nw} maxLength={80} onChange={(e) => setNw(e.target.value)} placeholder="pl. Quora: két válasz" /></Field>
        <button className="adm-ibtn gold" disabled={!nw.trim()} onClick={() => { setS({ ...s, items: [...items, { k: "r" + Date.now(), l: nw.trim() }].slice(0, 12) }); setNw(""); }}>Hozzáad</button>
      </Sheet>}
    </section>
  );
}
