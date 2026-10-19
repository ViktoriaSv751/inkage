// Renders the store marketing frames from /promo/<n> (see app/promo) into PNGs.
// node scripts/promo-shots.mjs [baseUrl] [outDir]
import { chromium } from 'playwright';
import fs from 'node:fs';
const base = process.argv[2] || 'https://inkage.app';
const out = process.argv[3] || 'promo-out';
fs.mkdirSync(out, { recursive: true });
const formats = [
  { name: 'ios', w: 430, h: 932, s: 3 },        // 1290×2796 (App Store 6.9")
  { name: 'ios63', w: 402, h: 874, s: 3 },      // 1206×2622 (App Store 6.3")
  { name: 'play', w: 405, h: 720, s: 1080 / 405 }, // 1080×1920 (Google Play phone)
];
const b = await chromium.launch();
for (const lang of ['en', 'hu']) {
  for (const f of formats) {
    const ctx = await b.newContext({ viewport: { width: f.w, height: f.h }, deviceScaleFactor: f.s });
    const p = await ctx.newPage();
    for (let n = 1; n <= 6; n++) {
      await p.goto(`${base}/promo/${n}?lang=${lang}`, { waitUntil: 'networkidle' });
      await p.evaluate(() => document.fonts.ready);
      await p.waitForTimeout(400);
      await p.screenshot({ path: `${out}/${f.name}-${lang}-${n}.png` });
    }
    await ctx.close();
  }
  const ctx = await b.newContext({ viewport: { width: 1024, height: 500 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.goto(`${base}/promo/feature?lang=${lang}`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(400);
  await p.screenshot({ path: `${out}/feature-${lang}.png` });
  await ctx.close();
}
await b.close();
console.log('done');
