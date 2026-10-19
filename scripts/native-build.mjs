#!/usr/bin/env node
/* Builds the app screens that ship INSIDE the iOS / Android apps (App Store rule 4.2: not just a website).
   A static Next.js export of /app and the sign-in pages, made from a scratch copy of the project with the
   server-only parts (API, middleware, website pages) left out. The API, photos and website pages stay on
   https://inkage.app (lib/site.ts, lib/native-bundle.ts). Output: cap-native/ (Capacitor webDir).

   node scripts/native-build.mjs        then        npx cap sync      */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const work = path.join(root, '.native-build');
const out = path.join(root, 'cap-native');
const SKIP = new Set(['node_modules', '.next', '.git', 'android', 'ios', 'cap-native', 'cap-www', '.native-build', 'out', 'store', 'scripts']);

fs.rmSync(work, { recursive: true, force: true });
fs.mkdirSync(work);
for (const e of fs.readdirSync(root)) if (!SKIP.has(e)) fs.cpSync(path.join(root, e), path.join(work, e), { recursive: true });
fs.symlinkSync(path.join(root, 'node_modules'), path.join(work, 'node_modules'), 'dir');

// server-only parts
fs.rmSync(path.join(work, 'app/api'), { recursive: true, force: true });
fs.rmSync(path.join(work, 'middleware.ts'), { force: true });

// keep only the bundled routes; other route files go (their components may still be imported, so they stay)
const KEEP = new Set(['app/layout.tsx', 'app/page.tsx', 'app/app/layout.tsx', 'app/app/page.tsx', 'app/app/gallery/page.tsx', 'app/app/explore/page.tsx', 'app/app/profile/page.tsx', 'app/belepes/page.tsx', 'app/regisztracio/page.tsx', 'app/elfelejtett-jelszo/page.tsx']);
const ROUTE_FILE = /^(page|route|layout|loading|template|default|not-found|sitemap|robots|manifest|opengraph-image|twitter-image|icon|apple-icon)\.(tsx?|jsx?)$/;
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (ROUTE_FILE.test(e.name) && !KEEP.has(path.relative(work, p))) fs.rmSync(p);
  }
};
walk(path.join(work, 'app'));
// app/app/template.tsx is a client wrapper the app screens need: keep it
fs.cpSync(path.join(root, 'app/app/template.tsx'), path.join(work, 'app/app/template.tsx'));

// the store-app versions of the root layout, start page, sign-in pages and Next config
fs.cpSync(path.join(root, 'scripts/native'), work, { recursive: true });

execSync('npx next build', { cwd: work, stdio: 'inherit', env: { ...process.env, NEXT_PUBLIC_NATIVE_BUNDLE: '1', NEXT_TELEMETRY_DISABLED: '1' } });

fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(path.join(work, 'out'), out, { recursive: true });
// an offline page for when the API cannot be reached is part of the app itself
fs.cpSync(path.join(root, 'cap-www/index.html'), path.join(out, 'offline.html'));
console.log('native bundle ->', path.relative(root, out));
