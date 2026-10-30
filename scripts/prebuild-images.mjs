// Pre-renders every photo the site shows into small static WebP files (public/img/<id>-<w>.webp),
// so pages load them straight from the CDN instead of resizing on request.
// Anything missing (network hiccup, new image) still works through the /api/lib-img fallback.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'public', 'img');
const CDN = 'https://d8j0ntlcm91z4.cloudfront.net/user_3134IoHE3NDDMNENjF96sXtstXg/';
const WIDTHS = [480, 900, 1400, 1800];
const RX = /hf_[0-9]{8}_[0-9]{6}_[a-f0-9-]{36}/g;

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (/\.(tsx?|mjs)$/.test(e.name)) acc.push(p);
  }
  return acc;
}
const designs = new Set((fs.readFileSync(path.join(ROOT, 'lib', 'designs.ts'), 'utf8').match(RX) || []));
const ids = new Set();
// library designs are served by /api/lib-img – unless a page also shows one as a picture (/img/…), e.g. the landing page
for (const f of walk(path.join(ROOT, 'app'))) for (const m of fs.readFileSync(f, 'utf8').match(RX) || []) ids.add(m);
for (const f of walk(path.join(ROOT, 'lib'))) for (const m of fs.readFileSync(f, 'utf8').match(RX) || []) if (!designs.has(m)) ids.add(m);
fs.mkdirSync(OUT, { recursive: true });
const list = [...ids];
let done = 0, failed = 0;
const t0 = Date.now();
async function one(id) {
  if (WIDTHS.every((w) => fs.existsSync(path.join(OUT, `${id}-${w}.webp`)))) return done++;
  try {
    const ctl = AbortSignal.timeout(30000);
    const r = await fetch(CDN + id + '.png', { signal: ctl });
    if (!r.ok) throw new Error(String(r.status));
    const buf = Buffer.from(await r.arrayBuffer());
    for (const w of WIDTHS) {
      await sharp(buf).resize({ width: w, withoutEnlargement: true }).webp({ quality: 76, effort: 4 }).toFile(path.join(OUT, `${id}-${w}.webp`));
    }
    done++;
  } catch (e) {
    failed++;
    console.warn('[images] skipped', id, e?.message || e);
  }
}
const queue = [...list];
await Promise.all(Array.from({ length: 8 }, async () => { while (queue.length) await one(queue.shift()); }));
console.log(`[images] ${done}/${list.length} ready, ${failed} skipped, ${((Date.now() - t0) / 1000).toFixed(1)}s`);
