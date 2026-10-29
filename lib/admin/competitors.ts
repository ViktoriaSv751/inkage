/* Competitors from the public App Store lookup (no key, no account): name, rating, number of ratings, version,
   once a day into competitor_daily, in every country of COMPETITOR_COUNTRIES (default: hu, us, gb, de; the ratings are
   counted per country, so each country is its own row). The own app (ASC_APP_ID) is tracked alongside, marked "mine".
   ASO: where the watched apps stand in the App Store search for the words people type ("tattoo preview", "tetoválás"…), per
   country, into competitor_aso. Google Play has no public lookup, so Play competitors are not read. Server-only. */
import { call, env, log, upsert } from "./server";
import { growthRows } from "./gsc";

const COUNTRY = () => (env().COMPETITOR_COUNTRY || "hu").toLowerCase();
const COUNTRIES = () => Array.from(new Set([COUNTRY(), ...String(env().COMPETITOR_COUNTRIES || "hu,us,gb,de").toLowerCase().split(/[\s,]+/).filter((c) => /^[a-z]{2}$/.test(c))])).slice(0, 8);
/* the search words per country (ASO_TERMS overrides: "hu:tetoválás|tetoválás app;us:tattoo preview|tattoo try on") */
const TERMS = (): Record<string, string[]> => {
  const own = String(env().ASO_TERMS || "").trim();
  if (own) return Object.fromEntries(own.split(";").map((x) => x.split(":")).filter((x) => x.length === 2).map(([c, t]) => [c.trim().toLowerCase(), t.split("|").map((y) => y.trim()).filter(Boolean)]));
  return { hu: ["tetoválás", "tetoválás app", "tattoo"], us: ["tattoo preview", "tattoo try on", "tattoo aging"], gb: ["tattoo preview", "tattoo try on"], de: ["tattoo vorschau", "tattoo"] };
};
type It = { trackId: number; trackName: string; artistName: string; artworkUrl100: string; trackViewUrl: string; averageUserRating?: number; userRatingCount?: number; version?: string; formattedPrice?: string; currentVersionReleaseDate?: string };

export async function searchApps(q: string, country = COUNTRY()) {
  const r = await fetch(`https://itunes.apple.com/search?${new URLSearchParams({ term: q.slice(0, 80), entity: "software", country, limit: "12" })}`, { cache: "no-store" });
  const j = await r.json().catch(() => ({ results: [] }));
  return ((j.results || []) as It[]).map((x) => ({ app_id: String(x.trackId), name: x.trackName, developer: x.artistName, icon: x.artworkUrl100, rating: x.averageUserRating ?? null, ratings: x.userRatingCount ?? null }));
}

async function lookup(ids: string[], country = COUNTRY()) {
  if (!ids.length) return [] as It[];
  const r = await fetch(`https://itunes.apple.com/lookup?id=${ids.join(",")}&country=${country}`, { cache: "no-store" });
  const j = await r.json().catch(() => ({ results: [] }));
  return (j.results || []) as It[];
}

export async function addCompetitor(appId: string, mine = false) {
  let x: It | undefined;
  for (const c of COUNTRIES()) { [x] = await lookup([appId], c); if (x) break; }
  if (!x) throw new Error("Nincs ilyen app az App Store-ban a figyelt országokban.");
  await upsert("competitors", [{ app_id: String(x.trackId), name: x.trackName, developer: x.artistName, icon: x.artworkUrl100, url: x.trackViewUrl, mine }], "app_id");
  for (const c of COUNTRIES()) await snapshot(await lookup([appId], c), c);
}

async function snapshot(items: It[], country: string) {
  const day = new Date().toISOString().slice(0, 10);
  return upsert("competitor_daily", items.map((x) => ({ app_id: String(x.trackId), day, country, rating: x.averageUserRating ?? null, ratings: x.userRatingCount ?? null, version: x.version || null, price: x.formattedPrice || null })), "app_id,day,country");
}

/* the place of each watched app in the App Store search (first 200 results), per country and word */
async function syncAso(ids: string[]) {
  const day = new Date().toISOString().slice(0, 10), out: Record<string, unknown>[] = [];
  for (const [country, terms] of Object.entries(TERMS())) {
    for (const term of terms.slice(0, 6)) {
      const r = await fetch(`https://itunes.apple.com/search?${new URLSearchParams({ term, entity: "software", country, limit: "200" })}`, { cache: "no-store" }).catch(() => null);
      const j = r?.ok ? await r.json().catch(() => null) : null;
      if (!j) continue;
      const res = (j.results || []) as It[];
      ids.forEach((id) => { const i = res.findIndex((x) => String(x.trackId) === id); out.push({ day, country, term, app_id: id, pos: i >= 0 ? i + 1 : null }); });
    }
  }
  return growthRows("competitor_aso", out);
}

export async function syncCompetitors() {
  try {
    const own = env().ASC_APP_ID;
    if (own && /^\d+$/.test(own) && !(await call<string[]>("admin_r_competitor_ids")).includes(own)) await addCompetitor(own, true).catch(() => {});
    const ids = await call<string[]>("admin_r_competitor_ids");
    let n = 0;
    for (const c of COUNTRIES()) for (let i = 0; i < ids.length; i += 50) n += await snapshot(await lookup(ids.slice(i, i + 50), c), c);
    const aso = ids.length ? await syncAso(ids).catch(async (e) => { await log("aso", false, null, String((e as Error)?.message || e)); return 0; }) : 0;
    if (ids.length) await log("competitors", true, n, `${n} app×ország frissítve, ${aso} ASO-helyezés`);
    return ids.length ? `${n} app×ország, ${aso} ASO` : "nincs felvéve";
  } catch (e) { const m = String((e as Error)?.message || e); await log("competitors", false, null, m); return "hiba: " + m.slice(0, 100); }
}
