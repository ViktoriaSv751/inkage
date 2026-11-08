// Tells Bing, Yandex, Seznam, Naver and the other IndexNow engines which inkage.app pages exist or changed.
// Usage: node scripts/indexnow.mjs            -> every URL in the live sitemaps
//        node scripts/indexnow.mjs <url> ...   -> just these URLs
// The key file is public/e9aa7b9010c71200fa296d96bc2fab72.txt (served at https://inkage.app/e9aa7b9010c71200fa296d96bc2fab72.txt).
const KEY = 'e9aa7b9010c71200fa296d96bc2fab72';
const HOST = 'inkage.app';

async function sitemapUrls() {
  const idx = await (await fetch('https://' + HOST + '/sitemap.xml')).text();
  const maps = [...idx.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).filter((u) => !u.includes('image-sitemap'));
  const out = [];
  for (const m of maps) {
    const xml = await (await fetch(m)).text();
    out.push(...[...xml.matchAll(/<url>\s*<loc>([^<]+)<\/loc>/g)].map((x) => x[1].replace(/&amp;/g, '&')));
  }
  return out;
}

const urls = process.argv.length > 2 ? process.argv.slice(2) : await sitemapUrls();
for (let i = 0; i < urls.length; i += 10000) {
  const batch = urls.slice(i, i + 10000);
  const r = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host: HOST, key: KEY, keyLocation: 'https://' + HOST + '/' + KEY + '.txt', urlList: batch }),
  });
  console.log('IndexNow', batch.length, 'URLs ->', r.status, r.statusText);
}
