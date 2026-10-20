'use client';
import { sb } from './sb';

/* Signed links to private pictures, reused while they are valid. A new link each time means a new address,
   so the browser downloads the same picture again on every visit; reusing it lets the picture come from cache. */
const KEY = 'ink_signed_v1';
const LIFE = 60 * 60 * 24 * 7; // a week
type Memo = Record<string, [string, number]>; // path -> [url, expires (ms)]
let memo: Memo | null = null;

function load(): Memo {
  if (memo) return memo;
  try {
    memo = JSON.parse(localStorage.getItem(KEY) || '{}') || {};
  } catch {
    memo = {};
  }
  return memo!;
}
function save() {
  try {
    const m = load();
    const now = Date.now();
    for (const [p, [, e]] of Object.entries(m)) if (e < now) delete m[p];
    const keys = Object.keys(m);
    if (keys.length > 1500) for (const p of keys.slice(0, keys.length - 1500)) delete m[p];
    localStorage.setItem(KEY, JSON.stringify(m));
  } catch {}
}

/** Signed links for paths in the private "previews" bucket, in the same order ('' when one failed). */
export async function signPaths(paths: string[]): Promise<string[]> {
  const m = load();
  const fresh = Date.now() + 1000 * 60 * 60 * 24; // still valid for at least a day
  const need = [...new Set(paths.filter((p) => !(m[p] && m[p][1] > fresh)))];
  if (need.length) {
    const s = sb();
    if (s) {
      for (let i = 0; i < need.length; i += 200) {
        const part = need.slice(i, i + 200);
        const { data } = await s.storage.from('previews').createSignedUrls(part, LIFE);
        const exp = Date.now() + LIFE * 1000 - 60000;
        part.forEach((p, j) => {
          const u = data?.[j]?.signedUrl;
          if (u) m[p] = [u, exp];
        });
      }
      save();
    }
  }
  return paths.map((p) => m[p]?.[0] || '');
}

/** Forget a path's link (the picture was replaced or removed). */
export function forgetSigned(paths: string[]) {
  const m = load();
  paths.forEach((p) => delete m[p]);
  save();
}
