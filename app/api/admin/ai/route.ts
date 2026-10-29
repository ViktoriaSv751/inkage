import { NextResponse } from "next/server";
import { asAdmin, call, env, log } from "@/lib/admin/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/* "Mit mondanak a számok?" on /admin: Claude reads the page's anonymous aggregates (never e-mails, names or the live
   feed; the page strips those) and writes a short Hungarian analysis with three concrete next steps.
   Needs ANTHROPIC_API_KEY (Kapcsolatok page or Vercel); one daily limit for every AI use of the dashboard
   (the page notes, Kérdezz, replies, plans, error analysis): AI_DAILY_CAP, the same number the pages show.
   Raw fetch like app/api/art-director. */
const MODEL = () => env().ADMIN_AI_MODEL || "claude-opus-5-5";
const DAILY_CAP = 120; /* keep in step with AI_DAILY in app/admin/shared.tsx */

/* midnight in Budapest, as an instant: the daily limit starts again then (not at UTC midnight) */
function bpMidnight() {
  const now = new Date();
  const off = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Budapest" })).getTime() - new Date(now.toLocaleString("en-US", { timeZone: "UTC" })).getTime();
  const [y, m, d] = now.toLocaleDateString("sv-SE", { timeZone: "Europe/Budapest" }).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) - off);
}
/* What leaves for the AI service, made safe here on the server too (the page strips it as well): no e-mail addresses,
   no names of people, and no field that holds one. */
const PERSONAL = /^(email|e_mail|name|display_name|author|user|username|full_name|me)$/i;
const EMAIL = /[\w.+-]+@[\w-]+(\.[\w-]+)+/g;
function clean(v: unknown, depth = 0): unknown {
  if (depth > 12) return null;
  if (typeof v === "string") return v.replace(EMAIL, "[e-mail]");
  if (Array.isArray(v)) return v.map((x) => clean(x, depth + 1));
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v as Record<string, unknown>).filter(([k]) => !PERSONAL.test(k)).map(([k, x]) => [k, clean(x, depth + 1)]));
  return v;
}
/* at most 60 000 characters of JSON, cut whole: the longest lists get shorter until it fits (never half a value) */
function fit(v: unknown, max = 60_000) {
  let x = v, s = JSON.stringify(x ?? {});
  for (let i = 0; s.length > max && i < 40; i++) {
    let best: unknown[] | null = null;
    const walk = (o: unknown) => { if (Array.isArray(o)) { if (!best || o.length > best.length) best = o; o.forEach(walk); } else if (o && typeof o === "object") Object.values(o).forEach(walk); };
    walk(x);
    const b = best as unknown[] | null;
    if (!b || b.length <= 1) break;
    b.length = Math.ceil(b.length / 2);
    s = JSON.stringify(x);
  }
  return s.length > max ? s.slice(0, max) : s;
}

export async function POST(req: Request) {
  return asAdmin(async () => {
    const key = env().ANTHROPIC_API_KEY;
    if (!key) return NextResponse.json({ ok: false, error: "Nincs MI-kulcs. Add meg a Kapcsolatok oldalon (MI-elemzés és Telegram), vagy a Vercelben ANTHROPIC_API_KEY néven." }, { status: 400 });
    const since = bpMidnight();
    const used = await call<number>("admin_r_log_count", { p_source: "ai", p_since: since.toISOString() }).catch(() => 0);
    if (used >= DAILY_CAP) return NextResponse.json({ ok: false, error: `A mai keret (${DAILY_CAP} MI-hívás, minden oldal együtt) elfogyott. Éjfélkor újraindul.`, used, cap: DAILY_CAP }, { status: 429 });

    const body = (await req.json().catch(() => ({}))) as { page?: string; data?: unknown; mode?: "note" | "ask" | "reply" | "plan" | "seo" | "error" | "write" | "gap" | "why" | "caption" | "ideas" | "letter"; question?: string; history?: { q: string; a: string }[]; lang?: string };
    const data = fit(clean(body.data ?? {}));
    const mode = body.mode || "note";
    /* "Kérdezz": a question about her numbers, answered from the anonymous aggregates; "Válasz": a reply to one comment or review */
    const SYS: Record<string, string> = {
      why: "Te az InkAge (tetoválás-előnézet app: a saját bőrfotódon mutatja meg a tetoválást, és azt is, hogyan öregszik 10, 30 és 50 év alatt) adatelemzője vagy. Egy kiugró vagy visszaeső napot kapsz: a nap látogatásai, az előző két hét napi átlaga, a csatornák, a nyelvek és az aznapi posztok, mind anonim összesítők. " +
        "Csak organikus növekedés: soha ne javasolj fizetett hirdetést vagy kiemelést, és soha ne írd, hogy „ingyenes” vagy „free”. Magyarul, tegezve, Markdown nélkül, három számozott sorban: 1) a legvalószínűbb ok egy mondatban, 2) melyik szám támasztja alá (pontos értékkel), 3) mit érdemes most tenni. Ha az adat nem dönti el, mondd ki. Legfeljebb 90 szó.",
      caption: "Te az InkAge (tetoválás-előnézet app: a saját bőrfotódon mutatja meg a tetoválást, és azt is, hogyan öregszik 10, 30 és 50 év alatt; a mintát fel lehet tölteni, választani a mintatárból vagy MI-vel készíteni) közösségi szövegírója vagy. Egy poszt témáját és a legjobban működő korábbi posztok szövegét kapod. " +
        "Platformonként írj egy leírást a kért nyelven (alapból magyarul), a platform stílusában és hosszában, egy erős első mondattal, és 3–6 releváns hashtaget. Ne említs árat vagy fizetést, és ne írd, hogy „ingyenes” vagy „free”. " +
        "Csak JSON-t adj vissza, semmi mást: [{\"pf\":\"tiktok|instagram|facebook|pinterest|linkedin|youtube\",\"text\":\"…\",\"tags\":[\"#…\"]}], csak a kért platformokra.",
      ideas: "Te az InkAge (tetoválás-előnézet app: a saját bőrfotódon mutatja meg a tetoválást, és azt is, hogyan öregszik 10, 30 és 50 év alatt) tartalomstratégája vagy. A legjobban és a leggyengébben működő posztok címét és szorzóját, a Google-keresések kifejezéseit és a közönség nyelveit kapod. " +
        "Adj pontosan 10 rövid videóötletet, magyarul, amelyek a működő mintákra épülnek (organikus tartalom, nem hirdetés; ne írd, hogy „ingyenes”). Csak JSON-t adj vissza: [{\"title\":\"…\",\"hook\":\"az első mondat, ami megállítja a görgetést\",\"why\":\"miért fog működni, a számokból, egy rövid mondatban\",\"pf\":[\"tiktok\",\"instagram\"]}].",
      letter: "Te az InkAge (tetoválás-előnézet app: a saját bőrfotódon mutatja meg a tetoválást, és azt is, hogyan öregszik 10, 30 és 50 év alatt) tulajdonosának növekedési partnere vagy. Csak organikus növekedés: soha ne javasolj fizetett hirdetést vagy kiemelést, és soha ne írd, hogy „ingyenes” vagy „free”. A számok jelentése: scored = kész tetoválás-előnézet (a fő élmény), revealed = megnézte 50 év múlva, shared = megosztott (link, öregedés-videó, PDF a tetoválóművésznek), captured = bőrfotót töltött fel. A hét anonim számait kapod (és az előző hétét). Írj neki egy rövid, személyes, bátorító, de őszinte heti levelet magyarul, tegezve, Markdown nélkül: " +
        "1–2 mondat a hét lényegéről, „Ami jól ment:” 2–3 pont, „Ami nem:” 1–2 pont, „Ezen a héten:” pontosan 3 konkrét lépés. Csak a számokból dolgozz, pontos értékekkel. Legfeljebb 220 szó.",
      ask: "Te az InkAge (tetoválás-előnézet app: a saját bőrfotódon mutatja meg a tetoválást, és azt is, hogyan öregszik 10, 30 és 50 év alatt) adatelemzője vagy. A számok jelentése: scored = kész tetoválás-előnézet (a fő élmény), revealed = megnézte 50 év múlva, shared = megosztott (link, öregedés-videó, PDF a tetoválóművésznek), captured = bőrfotót töltött fel. A tulajdonos kérdez a saját számairól; magyarul, tegezve, tömören válaszolsz, " +
        "kizárólag a kapott adatokból. Ha az adat nem elég a válaszhoz, mondd meg, mi hiányzik. Számoknál add meg a pontos értéket. Legfeljebb 150 szó, Markdown nélkül. " +
        "Ha a válasz egy összevetés vagy időbeli alakulás, a szöveg után egy külön sorban adj egy grafikont így: CHART {\"type\":\"bar\" vagy \"line\",\"title\":\"…\",\"data\":[{\"k\":\"címke\",\"v\":szám}]} (legfeljebb 12 pont, csak valódi számokkal az adatokból).",
      plan: "Te az InkAge (tetoválás-előnézet app: a saját bőrfotódon mutatja meg a tetoválást, és azt is, hogyan öregszik 10, 30 és 50 év alatt) növekedési tanácsadója vagy. Csak organikus növekedés: soha ne javasolj fizetett hirdetést vagy kiemelést, és soha ne írd, hogy „ingyenes” vagy „free”. A számok jelentése: scored = kész tetoválás-előnézet (a fő élmény), revealed = megnézte 50 év múlva, shared = megosztott (link, öregedés-videó, PDF a tetoválóművésznek), captured = bőrfotót töltött fel. A múlt hét anonim számaiból írj pontosan 3 konkrét, ezen a héten elvégezhető lépést a tulajdonosnak, magyarul, tegezve. " +
        "Csak JSON-t adj vissza, semmi mást: [{\"t\":\"a lépés egy mondatban\",\"why\":\"miért, a számokból, egy rövid mondatban\",\"metric\":\"sessions|scored|signups|shared\"}]. A metric az, amin a hét végén lemérjük.",
      error: "Te az InkAge (Next.js weboldal és Capacitor-app, Supabase) fejlesztője vagy. Egy hibacsoportot kapsz: a hibaüzenet, hol fordult elő, hány embert érintett, és a látogató utolsó lépései a hiba előtt. " +
        "Magyarul, tömören: 1) a valószínű ok egy mondatban, 2) hogyan lehet ellenőrizni, 3) a javítás iránya (milyen fájlban, mit érdemes nézni), 4) mennyire sürgős. Ne találj ki kódot, amit nem láttál. Legfeljebb 150 szó, Markdown nélkül.",
      write: "Te SEO-szerkesztő vagy. A szöveget a megadott célkeresésre pontozod 0–100 között. Magyarul, tömören, Markdown nélkül, számozott sorokkal: 1) Pontszám: X/100, 2) Title-javaslat (60 karakter alatt), " +
        "3) Meta: leírás-javaslat (155 karakter alatt), 4) Hiányzó témák (3–5), 5) Alcímjavaslatok (3), 6) Olvashatóság és hossz egy mondatban. Legfeljebb 200 szó.",
      gap: "Te tartalomstratéga vagy. A versenytársak cikkcímeit és a mi oldalaink címeit kapod. Magyarul, Markdown nélkül, számozott sorokban: 8 téma, amiről a versenytársak írnak, mi még nem; mindegyikhez egy javasolt cikkcím magyarul és angolul, és hogy miért érdemes (egy rövid mondat).",
      seo: "Te SEO-szerkesztő vagy. Egy cikk majdnem az első Google-oldalon van egy keresésre. Írj magyarul, tömören: 1) új, jobb title (60 karakter alatt) a keresés nyelvén, 2) meta description (155 karakter alatt), " +
        "3) 3 alcím (H2), amit érdemes hozzáadni, 4) 2 belső link ötlete az inkage.app tudástárából (/tudastar/…), 5) egy mondat: mit hiányolhat a kereső. Markdown nélkül, számozott sorokkal, legfeljebb 170 szó.",
      reply: "Te az InkAge (tetoválás-előnézet app: a saját bőrfotódon mutatja meg a tetoválást, és azt is, hogyan öregszik 10, 30 és 50 év alatt) hangján válaszolsz egy kommentre vagy áruházi véleményre. Kedves, rövid, személyes, emberi; " +
        "a komment nyelvén válaszolj (ha magyar, magyarul). Ha panasz vagy hiba, köszönd meg, kérj elnézést, és mondd, hogy javítjuk / írjon a support@inkage.app címre. " +
        "Ne ígérj olyat, amit nem tudhatsz; ne említs árat vagy fizetést, és ne írd, hogy „ingyenes”. Legfeljebb 2 mondat, emoji legfeljebb egy. Csak a válasz szövegét írd.",
    };
    const userMsg = mode === "ask" ? `Kérdés: ${String(body.question || "").slice(0, 500)}\n${(body.history || []).map((h) => `Korábbi kérdés: ${h.q}\nVálasz: ${h.a}`).join("\n")}\nAz irányítóközpont adatai (JSON, anonim összesítők):\n${data}`
      : mode === "reply" ? `Erre válaszolj${body.lang === "en" ? " angolul" : body.lang === "hu" ? " magyarul" : ""}:\n${data}`
      : mode === "plan" ? `A múlt hét és az előtte lévő hét számai (JSON, anonim összesítők):\n${data}`
      : mode === "seo" ? `A keresés, a cikk és a számai (JSON):\n${data}`
      : mode === "why" ? `A nap (JSON):\n${data}` : mode === "caption" ? `A poszt (JSON):\n${data}` : mode === "ideas" ? `Az adatok (JSON):\n${data}` : mode === "letter" ? `A hét (JSON):\n${data}`
      : mode === "error" ? `A hibacsoport (JSON):\n${data}` : mode === "write" ? `A célkeresés és a szöveg (JSON):\n${data}` : mode === "gap" ? `A címek (JSON):\n${data}` : null;
    const system = mode !== "note" ? SYS[mode] : "Te az InkAge (tetoválás-előnézet app: a saját bőrfotódon mutatja meg a tetoválást, és azt is, hogyan öregszik 10, 30 és 50 év alatt) növekedési elemzője vagy. Csak organikus növekedés: soha ne javasolj fizetett hirdetést vagy kiemelést, és soha ne írd, hogy „ingyenes” vagy „free”. A számok jelentése: scored = kész tetoválás-előnézet (a fő élmény), revealed = megnézte 50 év múlva, shared = megosztott (link, öregedés-videó, PDF a tetoválóművésznek), captured = bőrfotót töltött fel. A tulajdonosnak írsz magyarul, tegezve, tömören. " +
      "Csak a kapott számokból dolgozz, ne találj ki adatot; ha valami kevés adatból jön, mondd ki. A cél 1 000 000 elkészült tetoválás-előnézet. " +
      "Formátum: 3–5 rövid megfigyelés (mi változott és valószínűleg miért), utána „Teendők” címmel pontosan 3 konkrét, még ezen a héten elvégezhető lépés. Markdown nélkül, sima sorokkal, legfeljebb 180 szó.";
    /* 50 seconds at most (the route has 60): a slow answer ends with a clear message, not a broken page */
    let timedOut = false;
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST", signal: AbortSignal.timeout(50_000),
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "anthropic-beta": "server-side-fallback-2026-07-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: MODEL(), max_tokens: 2000, output_config: { effort: "medium" }, fallbacks: "default", system,
        messages: [{ role: "user", content: userMsg ?? `Oldal: ${body.page || "áttekintés"}\nAz irányítóközpont adatai (JSON, anonim összesítők):\n${data}` }],
      }),
    }).catch((e) => { timedOut = /abort|timeout/i.test(String((e as Error)?.name || e)); return null; });
    if (!r) {
      await log("ai", false, null, timedOut ? "időtúllépés (50 s)" : "nem érhető el");
      return NextResponse.json({ ok: false, error: timedOut ? "Az MI 50 másodperc alatt sem válaszolt. Próbáld újra, vagy kérdezz rövidebben." : "Nem érhető el az MI-szolgáltatás." }, { status: 502 });
    }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { await log("ai", false, null, String(j?.error?.message || r.status)); return NextResponse.json({ ok: false, error: j?.error?.message || `Hiba: ${r.status}` }, { status: 502 }); }
    if (j.stop_reason === "refusal") { await log("ai", false, null, "refusal"); return NextResponse.json({ ok: false, error: "Az MI ezt most nem elemezte. Próbáld újra később." }, { status: 200 }); }
    const text = ((j.content || []) as { type: string; text?: string }[]).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
    /* the tokens go into the log (rows = output, "in:" = input): the Monitoring page adds them up for the month */
    const usage = { in: Number(j.usage?.input_tokens) || 0, out: Number(j.usage?.output_tokens) || 0 };
    await log("ai", true, usage.out || null, (mode === "note" ? body.page || "" : mode) + ` · ${j.model || MODEL()} · in:${usage.in} out:${usage.out}`);
    return NextResponse.json({ ok: true, text, model: j.model || MODEL(), usage, used: used + 1, cap: DAILY_CAP });
  });
}
