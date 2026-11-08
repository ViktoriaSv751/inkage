// Checks hreflang on a sample of live pages: each alternate must exist (200), carry the same set of alternates
// (reciprocal) and name itself as canonical. Usage: node scripts/hreflang-check.mjs [base] [sample]
const BASE = process.argv[2] || 'https://inkage.app';
const N = Number(process.argv[3] || 40);
const get = async (u) => { const r = await fetch(u, { redirect: 'manual', headers: { 'accept-language': '' } }); return { status: r.status, html: r.status === 200 ? await r.text() : '' }; };
const alts = (html) => Object.fromEntries([...html.matchAll(/<link rel="alternate" hrefLang="([^"]+)" href="([^"]+)"/gi)].map((m) => [m[1], m[2].replace(/&amp;/g, '&')]));
const canon = (html) => (html.match(/<link rel="canonical" href="([^"]+)"/) || [])[1]?.replace(/&amp;/g, '&');
const idx = await (await fetch(BASE + '/sitemap.xml')).text();
const maps = [...idx.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace('https://inkage.app', BASE)).filter((u) => !u.includes('image-sitemap'));
let urls = [];
if (!idx.includes('<sitemapindex')) urls = [...idx.matchAll(/<url>\s*<loc>([^<]+)<\/loc>/g)].map((x) => x[1].replace(/&amp;/g, '&'));
else for (const m of maps) urls.push(...[...(await (await fetch(m)).text()).matchAll(/<url>\s*<loc>([^<]+)<\/loc>/g)].map((x) => x[1].replace(/&amp;/g, '&')));
urls = urls.filter((_, i) => i % Math.max(1, Math.floor(urls.length / N)) === 0).slice(0, N);
let problems = 0;
for (const u of urls) {
  const p = await get(u.replace('https://inkage.app', BASE));
  const a = alts(p.html), c = canon(p.html);
  const issues = [];
  if (p.status !== 200) issues.push('status ' + p.status);
  if (c !== u) issues.push('canonical ' + c);
  if (!Object.values(a).includes(u)) issues.push('not in its own hreflang set');
  for (const [h, au] of Object.entries(a).slice(0, 6)) {
    const q = await get(au.replace('https://inkage.app', BASE));
    if (q.status !== 200) issues.push(`${h} -> ${q.status}`);
    else if (!Object.values(alts(q.html)).includes(u)) issues.push(`${h} not reciprocal`);
  }
  if (issues.length) { problems++; console.log('✗', u, '|', issues.join('; ')); }
}
console.log(`checked ${urls.length} pages (6 alternates each), ${problems} with problems`);
