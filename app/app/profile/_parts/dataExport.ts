import { shareOrDownload } from '@/lib/client';
import type { Preview } from '@/lib/store';

/** Packs the details and every image into a ZIP; if that fails, just the details as JSON. */
export async function packMyData(data: object, mine: Preview[] | null) {
  try {
    const { zipSync, strToU8 } = await import('fflate');
    const files: Record<string, Uint8Array> = { 'adataim.json': strToU8(JSON.stringify(data, null, 2)) };
    for (const p of mine || []) {
      const day = p.created_at.slice(0, 10);
      const all: [string, string | undefined][] = [...Object.entries(p.images), ...Object.entries(p.removal || {}), ['design', p.design], ...(p.real || []).map((r, i) => [`valodi-${i + 1}`, r.src] as [string, string])];
      for (const [k, src] of all) {
        if (!src) continue;
        try {
          const buf = new Uint8Array(await (await fetch(src)).arrayBuffer());
          files[`elonezetek/${day}-${p.id.slice(0, 6)}/${k}.${k === 'design' ? 'png' : 'jpg'}`] = buf;
        } catch {}
      }
    }
    const zip = zipSync(files, { level: 0 });
    await shareOrDownload(new Blob([zip], { type: 'application/zip' }), 'inkage-adataim.zip');
  } catch {
    await shareOrDownload(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), 'inkage-adataim.json');
  }
}
