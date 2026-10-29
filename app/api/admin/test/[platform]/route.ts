import { NextResponse } from "next/server";
import { asAdmin, call, env } from "@/lib/admin/server";
import { testGsc } from "@/lib/admin/gsc";
import { PLATFORMS, testPlatform, type Platform } from "@/lib/admin/social";
import { testStores } from "@/lib/admin/stores";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

type R = { ok: boolean; msg: string };
const get = (url: string, init: RequestInit = {}) => fetch(url, { signal: AbortSignal.timeout(10_000), ...init, cache: "no-store" }).catch(() => null);

/* "Kipróbálom" on the Kapcsolatok page: does the saved key work, and does the connection answer? Plain words back, never a key.
   The AI card tries every key it has: Anthropic, OpenAI, Perplexity, the Telegram bot and its chat (getChat: nothing is sent). */
async function testAi(): Promise<R> {
  const e = env(), out: string[] = [];
  let ok = true;
  if (e.ANTHROPIC_API_KEY) {
    const r = await get("https://api.anthropic.com/v1/models?limit=1", { headers: { "x-api-key": e.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" } });
    if (r?.ok) out.push("Az Anthropic-kulcs működik."); else { ok = false; out.push(`Az Anthropic-kulcsot a szolgáltatás nem fogadta el (${r?.status ?? "nincs válasz"}).`); }
  } else { ok = false; out.push("Nincs Anthropic-kulcs."); }
  if (e.OPENAI_API_KEY) {
    const r = await get("https://api.openai.com/v1/models", { headers: { authorization: `Bearer ${e.OPENAI_API_KEY}` } });
    if (r?.ok) out.push("Az OpenAI-kulcs működik."); else { ok = false; out.push(`Az OpenAI-kulcs hibás (${r?.status ?? "nincs válasz"}).`); }
  }
  if (e.PERPLEXITY_API_KEY) {
    /* Perplexity has no free "who am I": an empty request answers 400 with a good key and 401 with a bad one */
    const r = await get("https://api.perplexity.ai/chat/completions", { method: "POST", headers: { authorization: `Bearer ${e.PERPLEXITY_API_KEY}`, "content-type": "application/json" }, body: "{}" });
    if (r && r.status !== 401 && r.status !== 403) out.push("A Perplexity-kulcs működik."); else { ok = false; out.push(`A Perplexity-kulcs hibás (${r?.status ?? "nincs válasz"}).`); }
  }
  if (e.TELEGRAM_BOT_TOKEN) {
    const r = await get(`https://api.telegram.org/bot${e.TELEGRAM_BOT_TOKEN}/getMe`);
    if (!r?.ok) { ok = false; out.push("A Telegram-bot tokenje hibás."); }
    else if (e.TELEGRAM_CHAT_ID) {
      const c = await get(`https://api.telegram.org/bot${e.TELEGRAM_BOT_TOKEN}/getChat?chat_id=${encodeURIComponent(e.TELEGRAM_CHAT_ID)}`);
      if (c?.ok) out.push("A Telegram-bot és a chat is rendben."); else { ok = false; out.push("A bot működik, de a chat-azonosítót nem találja: előbb írj a botnak egy üzenetet, és ellenőrizd a számot."); }
    } else out.push("A Telegram-bot válaszol, de nincs chat-azonosító.");
  }
  return { ok, msg: out.join(" ") };
}

/* Bing Webmaster Tools, Google Programmable Search, the e-mail sending (Resend) and its webhook, PageSpeed, Vercel */
async function testOther(p: string): Promise<R> {
  const e = env();
  if (p === "bing") {
    if (!e.BING_WMT_KEY) return { ok: false, msg: "Nincs Bing-kulcs." };
    const r = await get(`https://ssl.bing.com/webmaster/api.svc/json/GetUserSites?apikey=${e.BING_WMT_KEY}`);
    const j = r?.ok ? await r.json().catch(() => ({})) : null;
    const has = ((j?.d || []) as { Url: string }[]).some((x) => /inkage\.app/.test(x.Url));
    return !j ? { ok: false, msg: "A Bing nem fogadta el a kulcsot." } : has ? { ok: true, msg: "Működik: a inkage.app a Bing Webmaster Toolsban van." } : { ok: false, msg: "A kulcs jó, de a inkage.app még nincs hozzáadva a Bing Webmaster Toolsban." };
  }
  if (p === "cse") {
    if (!e.GOOGLE_CSE_KEY || !e.GOOGLE_CSE_ID) return { ok: false, msg: "Hiányzik a kulcs vagy a keresőmotor-azonosító." };
    const r = await get(`https://www.googleapis.com/customsearch/v1?key=${e.GOOGLE_CSE_KEY}&cx=${e.GOOGLE_CSE_ID}&q=inkage.app`);
    return r?.ok ? { ok: true, msg: "Működik: a keresés válaszol (ez a próba 1 keresést használt a napi 100-ból)." } : { ok: false, msg: `A Google ezt válaszolta: ${r?.status ?? "nincs válasz"}. Nézd meg, be van-e kapcsolva a Custom Search API.` };
  }
  if (p === "resend") {
    const out: string[] = []; let ok = true;
    if (e.RESEND_API_KEY) {
      const from = e.RESEND_FROM || "InkAge <hello@inkage.app>", dom = (from.match(/@([^>\s]+)/) || [])[1] || "";
      const r = await get("https://api.resend.com/domains", { headers: { authorization: "Bearer " + e.RESEND_API_KEY } });
      if (r?.ok) {
        const j = (await r.json().catch(() => ({}))) as { data?: { name: string; status: string }[] };
        const d = (j.data || []).find((x) => x.name === dom);
        if (d?.status === "verified") out.push(`A Resend-kulcs működik, a feladó domain (${dom}) igazolva.`); else { ok = false; out.push(`A kulcs működik, de a feladó domain (${dom || "?"}) ${d ? "még nincs igazolva" : "nincs a Resendben"}.`); }
      } else if (r?.status === 401 && /restricted/.test(await r.text().catch(() => ""))) out.push("A Resend-kulcs csak küldésre jó (ez elég); a domaint így nem látom.");
      else { ok = false; out.push(`A Resend nem fogadta el a kulcsot (${r?.status ?? "nincs válasz"}).`); }
    } else { ok = false; out.push("Nincs RESEND_API_KEY: a reggeli összefoglaló nem megy ki e-mailben."); }
    if (e.RESEND_WEBHOOK_SECRET) { if (e.RESEND_WEBHOOK_SECRET.startsWith("whsec_")) out.push("A webhook titka jó formátumú."); else { ok = false; out.push("A webhook signing secret „whsec_”-kel kezdődik."); } }
    return { ok, msg: out.join(" ") };
  }
  if (p === "psi") {
    /* a real run takes 15–40 s, longer than a test should wait: ask without a page instead. Google checks the key first,
       so a good key gets "missing url" and a bad one "API key not valid" (the daily run measures the pages) */
    if (e.PSI_API_KEY) {
      const r = await get(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?key=${encodeURIComponent(e.PSI_API_KEY)}`);
      const t = r ? await r.text().catch(() => "") : "";
      if (!r) return { ok: false, msg: "A PageSpeed nem válaszolt, próbáld újra pár perc múlva." };
      if (/API key not valid|API_KEY_INVALID|keyInvalid/i.test(t)) return { ok: false, msg: "A Google szerint ez a kulcs érvénytelen: másold ki újra a Google Cloud Credentials oldaláról." };
      if (/SERVICE_DISABLED|has not been used|is disabled/i.test(t)) return { ok: false, msg: "A kulcs jó, de a PageSpeed Insights API nincs bekapcsolva a projektben (vagy még pár percig élesedik)." };
      if (/API_KEY_SERVICE_BLOCKED|blocked/i.test(t)) return { ok: false, msg: "A kulcs ennél az API-nál le van tiltva: a kulcs API-korlátozásai között legyen ott a PageSpeed Insights API." };
      if (r.status === 429) return { ok: false, msg: "A kulcs jó, de a napi keret most elfogyott; holnap újra megy." };
      return { ok: true, msg: "A PageSpeed-kulcs működik." };
    }
    const r = await get(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent("https://inkage.app/")}&category=performance&strategy=mobile`, { signal: AbortSignal.timeout(25_000) });
    return r?.ok ? { ok: true, msg: "A PageSpeed kulcs nélkül is válaszol (kulccsal nagyobb a napi keret)." } : { ok: false, msg: `A PageSpeed ezt válaszolta: ${r?.status ?? "nincs válasz"}.` };
  }
  if (p === "vercel") {
    if (!e.VERCEL_API_TOKEN) return { ok: false, msg: "Nincs Vercel API-token." };
    const r = await get("https://api.vercel.com/v2/user", { headers: { authorization: `Bearer ${e.VERCEL_API_TOKEN}` } });
    return r?.ok ? { ok: true, msg: "A Vercel-token működik: a Monitoringban látszanak a telepítések." } : { ok: false, msg: `A Vercel nem fogadta el a tokent (${r?.status ?? "nincs válasz"}).` };
  }
  return { ok: false, msg: "Ismeretlen próba." };
}

const OTHER = ["bing", "cse", "resend", "psi", "vercel"];
/* POST: a test spends a search query and writes its result, so a link from elsewhere can never start one */
export async function POST(_req: Request, { params }: { params: Promise<{ platform: string }> }) {
  const p = (await params).platform;
  if (!["gsc", "apple", "play", "ai", ...OTHER].includes(p) && !PLATFORMS.includes(p as Platform)) return new NextResponse("Not found", { status: 404 });
  return asAdmin(async () => {
    const r: R = await (p === "gsc" ? testGsc() : p === "apple" || p === "play" ? testStores(p) : p === "ai" ? testAi() : OTHER.includes(p) ? testOther(p) : testPlatform(p as Platform))
      .catch((x) => ({ ok: false, msg: "A próba hibára futott: " + String((x as Error)?.message || x).slice(0, 160) }));
    /* the result stays, with its time (Kapcsolatok shows it on the card) */
    await call("admin_w_test_result", { p_id: p, p_ok: r.ok, p_msg: r.msg }).catch(() => null);
    return NextResponse.json({ ...r, at: new Date().toISOString() }, { headers: { "cache-control": "no-store" } });
  });
}
