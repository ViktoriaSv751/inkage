// Smoke test: node scripts/smoke.mjs https://inkage.vercel.app
// Opens the app as a phone, goes through the first-run questions and checks every tab renders.
import { chromium } from 'playwright';
const base = process.argv[2] || 'http://localhost:3000';
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'en-US' })).newPage();
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
const check = async (name, fn) => {
  try {
    await fn();
    console.log('ok  ', name);
  } catch (e) {
    console.log('FAIL', name, e.message);
    process.exitCode = 1;
  }
};
await check('landing', async () => { await p.goto(base + '/'); await p.getByText('50 years').first().waitFor(); });
await check('onboarding', async () => {
  await p.goto(base + '/app');
  await p.getByRole('button', { name: 'Yes, I’m 18+' }).click();
  await p.getByRole('button', { name: 'Skip' }).click();
  await p.getByText('Body area').first().waitFor();
});
for (const path of ['/app/gallery', '/app/explore', '/app/profile', '/learn', '/terms', '/privacy'])
  await check(path, async () => { const r = await p.goto(base + path); if (!r || r.status() >= 400) throw new Error('status ' + r?.status()); });
if (errors.length) { console.log('page errors:', errors); process.exitCode = 1; }
await b.close();
