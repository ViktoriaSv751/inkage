"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Empty, TrendChart, fmt } from "../charts";
import { Logo } from "../wow";
import { toast } from "../phone";
import { Card, I, MOCK, P, ago, api, lang, n, rpc, type D, useRpc } from "../shared";

/* ---------- the inbox: every comment and store review in one list, answered from here ---------- */
const SRC: Record<string, string> = { support: "Weboldal (Írj nekünk)", instagram: "Instagram", facebook: "Facebook", youtube: "YouTube", tiktok: "TikTok", pinterest: "Pinterest", linkedin: "LinkedIn", apple: "App Store", google: "Google Play" };
const STARS = (r: number) => "★★★★★".slice(0, r) + "☆☆☆☆☆".slice(0, 5 - r);
const TAG: Record<string, [string, string]> = { "kérdés": ["Kérdés", "sky"], "ötlet": ["Ötlet", "lilac"], "dicséret": ["Dicséret", "mint"], "panasz": ["Panasz", "butter"], "hiba": ["Hiba", "pink"] };
/* what each place accepts (Google Play cut a longer answer silently at 350) */
const LIMIT: Record<string, number> = { support: 20000, google: 350, apple: 5970, instagram: 2200, facebook: 8000, youtube: 10000 };
/* only these platforms let a comment be hidden from here */
const CAN_HIDE = new Set(["instagram", "facebook", "youtube"]);
/* replies in the brand's voice: warm, short, tegező in Hungarian */
const TPL: { l: string; hu: string; en: string }[] = [
  { l: "Köszönöm", hu: "Nagyon köszönöm, hogy írtál! 💛 Örülök, hogy tetszik az InkAge, és sok szép tetoválást kívánok.", en: "Thank you so much for writing! 💛 So glad you like InkAge, and good luck with your tattoo." },
  { l: "Kérdésre", hu: "Köszönöm a kérdést! Röviden: ", en: "Thanks for asking! In short: " },
  { l: "Hibára", hu: "Nagyon sajnálom, hogy ez történt! Írnál a hello@inkage.app címre pár szót arról, milyen telefonon és mikor jött elő? Gyorsan javítjuk.", en: "I'm so sorry this happened! Could you write to hello@inkage.app with your phone model and when it happened? We'll fix it quickly." },
  { l: "Panaszra", hu: "Köszönöm, hogy megírtad, ez sokat segít. Dolgozom rajta, hogy jobb legyen.", en: "Thank you for telling me, it really helps. I'm working on making it better." },
];
/* the website's messages get e-mail answers: longer, and a few that come up again and again */
const TPL_MAIL: { l: string; hu: string; en: string }[] = [
  { l: "Belépési segítség", hu: "Szia! Köszönöm, hogy írtál. A belépéshez nyisd meg az inkage.app/belepes oldalt, és ugyanazzal a módszerrel lépj be, amivel regisztráltál (e-mail, Google vagy Apple). Ha nem emlékszel a jelszóra, az „Elfelejtett jelszó” gombbal kérj újat: a levél pár percen belül megérkezik (nézd meg a Spam mappát is).\n\nViktória, InkAge", en: "Hi! Thanks for writing. To sign in, open inkage.app/belepes and use the same method you signed up with (e-mail, Google or Apple). If you don't remember the password, tap \"Forgot password\": the e-mail arrives within a few minutes (please check your spam folder too).\n\nViktória, InkAge" },
  { l: "Fiók törölve", hu: "Szia! A kérésedre töröltük az InkAge-fiókodat és minden hozzá tartozó adatot (feltöltött bőrfotók, mentett előnézetek, videók). Ha bármikor újra kipróbálnád, szívesen látunk.\n\nViktória, InkAge", en: "Hi! As you asked, we have deleted your InkAge account and all its data (uploaded skin photos, saved previews, videos). You're welcome back any time.\n\nViktória, InkAge" },
  { l: "Javítottuk", hu: "Szia! Köszönöm, hogy szóltál: megtaláltuk a hibát, és már javítottuk. Ha újra kipróbálod, már működnie kell; ha mégsem, írj nyugodtan.\n\nViktória, InkAge", en: "Hi! Thanks for letting us know: we found the bug and it's fixed now. If you try again it should work; if not, just reply.\n\nViktória, InkAge" },
  { l: "Több infó kell", hu: "Szia! Köszönöm az üzenetet. Hogy segíteni tudjak: milyen telefonon vagy gépen, melyik böngészőben vagy appban történt, melyik lépésnél (fotófeltöltés, minta, előnézet, öregítés), és pontosan mit láttál? Egy képernyőkép is sokat segít.\n\nViktória, InkAge", en: "Hi! Thanks for your message. To help: which phone or computer, which browser or app, at which step (photo upload, design, preview, aging), and what exactly did you see? A screenshot helps a lot.\n\nViktória, InkAge" },
];

export function Inbox() {
  const sb = useMemo(() => supabaseBrowser(), []);
  const [all, setAll] = useState(false);
  const { d, e, load } = useRpc("admin_inbox", { p_all: all }, [all]);
  /* one rule for every filter: open only, unless "lezártak is" */
  const [closed, setClosed] = useState(false); const [src, setSrc] = useState(""); const [tag, setTag] = useState("");
  const [q, setQ] = useState(""); const [since, setSince] = useState(0); const [sort, setSort] = useState<"prio" | "new" | "old" | "low">("prio");
  const [hide, setHide] = useState<string[]>([]); const [sel, setSel] = useState<string[]>([]); const [undo, setUndo] = useState<D[] | null>(null);
  if (e) return <div className="g"><div className="alert err s12">{e}</div></div>;
  const key = (x: D) => x.source + "|" + x.item_id;
  const items: D[] = ((d?.items || []) as D[]).filter((x) => !hide.includes(key(x)));
  const ql = q.trim().toLowerCase();
  const shown = items.filter((x) => (closed || !x.done) && (!src || x.source === src) && (!tag || x.tag === tag)
    && (!ql || [x.body, x.author, x.post_title].some((t) => String(t || "").toLowerCase().includes(ql)))
    && (!since || (x.created_at && Date.now() - new Date(x.created_at).getTime() < since * 864e5)))
    .sort((a, b) => sort === "new" ? String(b.created_at || "").localeCompare(String(a.created_at || "")) : sort === "old" ? String(a.created_at || "").localeCompare(String(b.created_at || "")) : sort === "low" ? n(a.rating || 6) - n(b.rating || 6) : 0);
  const tagN = (t: string) => items.filter((x) => x.tag === t && (closed || !x.done) && (!src || x.source === src)).length;
  /* the source buttons come from the database (every source, with its open count), not from the loaded page */
  const sources: D[] = (d?.sources || []) as D[];
  const srcList = sources.length ? sources : Array.from(new Set(items.map((x) => x.source))).map((k) => ({ k, open: items.filter((x) => x.source === k && !x.done).length }));
  const doneMany = async (xs: D[], on = true) => {
    if (!xs.length) return;
    if (on) setHide((h) => [...h, ...xs.map(key)]); else setHide((h) => h.filter((k) => !xs.some((x) => key(x) === k)));
    const r = MOCK ? { error: null } : xs.length === 1 ? await rpc(sb, "admin_inbox_done", { p_source: xs[0].source, p_item: xs[0].item_id, p_done: on }) : await rpc(sb, "admin_inbox_done_many", { p_items: xs.map((x) => ({ source: x.source, item_id: x.item_id })), p_done: on });
    if (r.error) { toast(r.error.message); setHide((h) => h.filter((k) => !xs.some((x) => key(x) === k))); return; }
    setSel([]); setUndo(on ? xs : null); if (!on) toast("Visszanyitva");
    /* the counter follows at once (it stayed where it was) */
    load().then(() => setHide([]));
  };
  const selected = shown.filter((x) => sel.includes(key(x)));
  const stars: D[] = (d?.stars || []) as D[];
  const starPts = Object.values(stars.reduce((m: Record<string, D>, x) => { const k = String(x.t); const o = m[k] || { t: k, s: 0, c: 0 }; o.s += n(x.avg) * n(x.n); o.c += n(x.n); m[k] = o; return m; }, {})).sort((a: D, b: D) => a.t.localeCompare(b.t)).map((x: D) => ({ t: x.t, v: x.c ? Math.round((x.s / x.c) * 100) / 100 : 0 }));
  const bugs: D[] = (d?.bugs || []) as D[], authors: D[] = (d?.authors || []) as D[];
  return (
    <div className="g">
      <section className="c s12 inbox-top">
        <div><span className="eyebrow">Postafiók</span><h2 className="ib-n">{fmt(d?.open ?? 0)} válaszra vár</h2></div>
        <div className="adm-seg sm" role="group">
          <button aria-pressed={!src} onClick={() => setSrc("")}>Minden forrás</button>
          {srcList.map((s) => <button key={s.k} aria-pressed={src === s.k} onClick={() => setSrc(src === s.k ? "" : s.k)}>{SRC[s.k] || s.k} · {fmt(s.open)}</button>)}
        </div>
        <div className="ib-tags">{Object.entries(TAG).map(([k, [l, tone]]) => <button key={k} className={"chip t-" + tone} aria-pressed={tag === k} onClick={() => setTag(tag === k ? "" : k)}>{l} · {tagN(k)}</button>)}</div>
        <div className="ib-tools">
          <input className="adm-in sm" placeholder="Keresés a szövegben, névben, posztban" value={q} onChange={(x) => setQ(x.target.value)} />
          <select className="adm-in sm" value={since} onChange={(x) => setSince(Number(x.target.value))} aria-label="Időszak"><option value={0}>Bármikor</option><option value={1}>24 óra</option><option value={7}>7 nap</option><option value={30}>30 nap</option><option value={90}>90 nap</option></select>
          <select className="adm-in sm" value={sort} onChange={(x) => setSort(x.target.value as typeof sort)} aria-label="Rendezés"><option value="prio">Fontossági sorrend</option><option value="new">Legújabb elöl</option><option value="old">Legrégebbi elöl</option><option value="low">Legrosszabb értékelés elöl</option></select>
          <label className="ck-row"><input type="checkbox" checked={closed} onChange={(x) => { setClosed(x.target.checked); if (x.target.checked) setAll(true); }} />Lezártak is</label>
        </div>
        {(selected.length > 0 || shown.some((x) => !x.done)) && <div className="ib-bulk">
          <label className="ck-row"><input type="checkbox" checked={selected.length > 0 && selected.length === shown.filter((x) => !x.done).length} onChange={(x) => setSel(x.target.checked ? shown.filter((y) => !y.done).map(key) : [])} />{selected.length ? `${selected.length} kijelölve` : "Mind kijelölése"}</label>
          {selected.length > 0 && <button className="adm-ibtn sm" onClick={() => doneMany(selected)}>{I(P.check)}Kijelöltek kész</button>}
        </div>}
      </section>
      {undo && <div className="s12 ib-undo"><span>{undo.length > 1 ? `${undo.length} elem kész` : "Kész"}</span><button className="lnk" onClick={() => { const u = undo; setUndo(null); doneMany(u, false); }}>Visszavonás</button><button className="lnk" onClick={() => setUndo(null)}>✕</button></div>}
      <section className="s8">
        {!d ? <div className="skel" style={{ height: 300 }} /> : !shown.length ? <div className="c"><Empty t={items.length ? (q || src || tag || since ? "Nincs ilyen elem a szűrésben." : "Minden megválaszolva. ✓") : "Ha bekötöd az Instagramot, a Facebookot, a YouTube-ot vagy az áruházakat, itt jelenik meg minden új komment és vélemény, és innen válaszolhatsz."} icon={P.mail} /></div>
          : <ul className="inbox">{shown.map((x) => <InboxItem key={key(x)} x={x} sel={sel.includes(key(x))} onSel={(on) => setSel((s) => (on ? [...s, key(x)] : s.filter((k) => k !== key(x))))} onDone={() => doneMany([x])} onReopen={() => doneMany([x], false)} onSent={load} />)}</ul>}
        <p className="note" style={{ marginTop: 10 }}>Elöl a 3 csillag alatti vélemények és a hibajelzések. A „Hiba” címkéjű kommentek a Rendszer oldalon is megjelennek. A TikTok-, Pinterest- és LinkedIn-kommenteket, az Instagram-említéseket és -üzeneteket a mostani bekötés nem hozza be.</p>
      </section>
      <aside className="s4 ib-side">
        {starPts.length > 1 && <Card icon={P.layers} title="Áruházi csillagok hetente" sub="A vélemények átlaga hetente, az App Store és a Google Play együtt (az utolsó 120 nap)."><TrendChart data={starPts} label="Átlag" height={140} /></Card>}
        {bugs.length > 0 && <Card icon={P.alert} title="Hibajelzések" sub="Az utolsó 30 nap kommentjei és véleményei, amelyek szerint valami nem működik.">
          <ul className="ib-bugs">{bugs.slice(0, 8).map((b) => <li key={b.source + b.item_id}><Logo k={b.source === "google" ? "play" : b.source} size={18} /><div><b>{b.author || "Névtelen"}</b><span>{String(b.body || "").slice(0, 110)}</span></div><time>{ago(b.created_at)}</time></li>)}</ul></Card>}
        {authors.length > 0 && <Card icon={P.users} title="Leggyakoribb kommentelők" sub="Akik a legtöbbször írnak: érdemes nekik külön figyelmet adni.">
          <ul className="ib-auth">{authors.slice(0, 8).map((a) => <li key={a.source + a.author}><Logo k={a.source} size={18} /><b>{a.author}</b><span>{fmt(a.n)} komment · {ago(a.last)}</span></li>)}</ul></Card>}
      </aside>
    </div>
  );
}

export function InboxItem({ x, onDone, onSent, onReopen, sel, onSel, startOpen }: { x: D; onDone: () => void; onSent: () => void; onReopen?: () => void; sel?: boolean; onSel?: (on: boolean) => void; startOpen?: boolean }) {
  const sb = useMemo(() => supabaseBrowser(), []);
  const [open, setOpen] = useState(!!startOpen); const [text, setText] = useState(""); const [busy, setBusy] = useState<"" | "ai" | "send" | "mod">(""); const [sent, setSent] = useState<string | null>(null);
  const [lng, setLng] = useState<"auto" | "hu" | "en">("auto"); const [hidden, setHidden] = useState<boolean>(!!x.hidden); const [liked, setLiked] = useState<boolean>(!!x.liked);
  const lim = LIMIT[x.source];
  const mod = async (action: "hide" | "unhide" | "like") => {
    /* hiding acts on the platform itself: asked first */
    if (action === "hide" && !confirm(`Elrejted ezt a kommentet a(z) ${SRC[x.source] || x.source} oldalon? Ott sem fogja látni senki (később visszahozható).`)) return;
    setBusy("mod");
    const r = MOCK ? { ok: true, json: { ok: true } } : await api("/api/admin/inbox", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ source: x.source, id: x.item_id, action }) });
    setBusy("");
    if (!r.ok || !r.json?.ok) { toast(r.json?.error || "Nem sikerült."); return; }
    if (action === "like") { setLiked(true); toast("Kedvelve"); } else { setHidden(action === "hide"); toast(action === "hide" ? "Elrejtve a platformon" : "Újra látható"); }
  };
  const review = x.kind === "review", mail = x.source === "support";
  /* a website message counts as read once it is opened here (the "új" chip goes away) */
  const [seen, setSeen] = useState<boolean>(!mail || !!x.seen_at); const [tagM, setTagM] = useState<string>(x.tag || "");
  const markSeen = () => { if (!seen && !MOCK) { setSeen(true); rpc(sb, "admin_inbox_seen", { p_source: x.source, p_item: x.item_id }); } };
  const setTag = async (t: string) => { setTagM(t === "nincs" ? "" : t); const { error } = await rpc(sb, "admin_inbox_tag_set", { p_source: x.source, p_item: x.item_id, p_tag: t || null }); if (error) toast(error.message); else toast("Címke frissítve"); };
  const hu = lng === "hu" || (lng === "auto" && String(x.lang || "").startsWith("hu"));
  /* the suggestion knows the post, the language, the stars, and for Apple the country and the app version */
  const suggest = async () => {
    setBusy("ai");
    const r = await api("/api/admin/ai", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode: "reply", lang: lng === "auto" ? (x.lang ? (String(x.lang).startsWith("hu") ? "hu" : "en") : undefined) : lng,
      data: { source: SRC[x.source] || x.source, kind: review ? "áruházi vélemény" : "komment", rating: x.rating, text: x.body, post: x.post_title, author: x.author, nyelv: x.lang, orszag: x.territory, verzio: x.version, hossz_max: lim, tag: x.tag } }) });
    setBusy(""); if (r.ok && r.json?.text) setText(lim ? String(r.json.text).slice(0, lim) : r.json.text); else toast(r.json?.error || "Az MI most nem válaszolt.");
  };
  const send = async (t0?: string) => {
    const t = (t0 ?? text).trim(); if (!t) return;
    if (lim && t.length > lim) { toast(`Legfeljebb ${lim} karakter mehet ide.`); return; }
    /* a public answer (or an e-mail), which can't be taken back from here: asked first, with the exact text */
    if (!confirm(mail ? `E-mail megy ki ide: ${x.email}\n\n„${t}”\n\nElküldöd, és lezárod az üzenetet?` : `Nyilvános válasz megy ki ide: ${SRC[x.source] || x.source}\n\n„${t}”\n\nElküldöd?`)) return;
    setBusy("send");
    const r = MOCK ? { ok: true, json: { ok: true } } : await api("/api/admin/reply", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ source: x.source, id: x.item_id, text: t }) });
    setBusy("");
    if (r.ok && r.json?.ok) {
      /* answered at once on our side too: a store review no longer looks open after a reload */
      if (!MOCK) await rpc(sb, "admin_inbox_replied", { p_source: x.source, p_item: x.item_id, p_text: t });
      setSent(t); setOpen(false); toast(mail ? "Elküldve e-mailben és lezárva" : "Válasz elküldve"); onSent();
    } else toast(r.json?.error || "Nem sikerült elküldeni.");
  };
  const reply = sent || x.reply;
  const meta = [x.lang && lang(x.lang), x.territory, x.version && `v${x.version}`].filter(Boolean).join(" · ");
  return (
    <li className={"ib-i" + (x.done || reply ? " done" : "") + (!seen ? " unread" : "")} onClick={markSeen}>
      <div className="ib-h">
        {onSel && !x.done && !reply && <input type="checkbox" className="ib-ck" checked={!!sel} onChange={(e) => onSel(e.target.checked)} aria-label="Kijelölés" />}
        {mail ? <span className="ib-mail" aria-hidden>{I(P.mail)}</span> : <Logo k={x.source === "apple" ? "apple" : x.source === "google" ? "play" : x.source} size={30} />}
        <b>{x.author || (mail ? x.email : "Névtelen")}</b>{mail && x.author && <small className="mut">{x.email}</small>}
        {!seen && <span className="chip gold">új</span>}
        {review && x.rating ? <span className="ib-stars">{STARS(Number(x.rating))}</span> : null}
        {tagM && TAG[tagM] && <span className={"chip t-" + TAG[tagM][1]}>{TAG[tagM][0]}</span>}
        {!review && <select className="ib-tagsel" value={tagM} onChange={(e) => setTag(e.target.value || "nincs")} aria-label="Címke" onClick={(e) => e.stopPropagation()}><option value="">címke…</option>{Object.entries(TAG).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</select>}
        {hidden && <span className="chip">elrejtve</span>}{liked && <span className="chip">♥ kedvelve</span>}
        <span className="ib-src">{SRC[x.source] || x.source}{x.created_at ? " · " + ago(x.created_at) : ""}{meta ? " · " + meta : ""}</span>
      </div>
      {review && x.post_title ? <b className="ib-title">{x.post_title}</b> : null}
      <p className="ib-body">{x.body || "(szöveg nélkül)"}</p>
      {!review && (x.post_title || x.post_thumb) && <a className="ib-post" href={x.post_url || undefined} target="_blank" rel="noreferrer">{x.post_thumb && <img src={x.post_thumb} alt="" referrerPolicy="no-referrer" />}<span>{x.post_title || "a poszt"}</span></a>}
      {reply && <div className="ib-reply"><span>Válaszod</span>{reply}</div>}
      {(x.done || reply) && onReopen && !sent && <div className="ib-act"><button className="lnk" onClick={onReopen}>Visszanyitás</button></div>}
      {!reply && !x.done && !open && <div className="ib-act">
        {/* LinkedIn's comments can't be answered from here (its API does not allow it): no button that would only fail */}
        {x.source !== "linkedin" && <button className="adm-ibtn gold sm" onClick={() => setOpen(true)}>{I(P.pen)}Válasz</button>}
        {x.source !== "linkedin" && !mail && <button className="adm-ibtn sm" disabled={busy !== ""} onClick={() => send(hu ? TPL[0].hu : TPL[0].en)} title="Rövid köszönő válasz (előtte megkérdezi)">♥ Köszönöm</button>}
        {mail && <button className="adm-ibtn sm" onClick={() => { navigator.clipboard?.writeText(x.body || ""); toast("Az üzenet a vágólapon"); }}>Másolás</button>}
        <button className="adm-ibtn sm" onClick={onDone}>Kész, nem kell válasz</button>
        {!review && CAN_HIDE.has(x.source) && <button className="adm-ibtn sm" disabled={busy !== ""} onClick={() => mod(hidden ? "unhide" : "hide")}>{hidden ? "Megjelenítés" : "Elrejtés"}</button>}
        {x.source === "facebook" && !liked && <button className="adm-ibtn sm" disabled={busy !== ""} onClick={() => mod("like")}>♥ Kedvelés</button>}
      </div>}
      {open && <div className="ib-form">
        <div className="ib-tpl">{(mail ? TPL_MAIL : TPL).map((t) => <button key={t.l} className="chip" onClick={() => setText((hu ? t.hu : t.en).slice(0, lim || 99999))}>{t.l}</button>)}</div>
        <textarea className="adm-in" rows={3} value={text} maxLength={lim} onChange={(e) => setText(e.target.value)} placeholder="A válaszod…" autoFocus />
        <div className="ib-act">
          <button className="adm-ibtn sm" onClick={suggest} disabled={busy !== ""}>{busy === "ai" ? "Írom…" : "✦ MI-javaslat"}</button>
          <div className="adm-seg sm" title="A javaslat nyelve"><button aria-pressed={lng === "auto"} onClick={() => setLng("auto")}>Auto</button><button aria-pressed={lng === "hu"} onClick={() => setLng("hu")}>HU</button><button aria-pressed={lng === "en"} onClick={() => setLng("en")}>EN</button></div>
          {lim && <span className={"ib-cnt" + (text.length > lim * 0.9 ? " warn" : "")}>{text.length} / {lim}</span>}
          <span style={{ flex: 1 }} />
          <button className="adm-ibtn sm" onClick={() => setOpen(false)}>Mégse</button>
          <button className="adm-ibtn gold sm" onClick={() => send()} disabled={busy !== "" || !text.trim()}>{busy === "send" ? "Küldés…" : "Küldés"}</button>
        </div>
      </div>}
    </li>
  );
}
