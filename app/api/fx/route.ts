import { NextResponse } from 'next/server';

/* The day's dollar → forint rate (ECB) for the "kb. … Ft" guide the packages page shows Hungarian visitors next to the
   dollar price. Calligra keeps the rate daily (calligra.me/api/fx, same owner); one public number, cached for an hour.
   Any failure answers null and the page shows the dollar price alone. */
export const revalidate = 3600;

export async function GET() {
  let huf: number | null = null;
  let day: string | null = null;
  try {
    const r = await fetch('https://calligra.me/api/fx', { next: { revalidate: 3600 }, signal: AbortSignal.timeout(4000) });
    const j = await r.json();
    if (Number(j?.huf) > 100 && Number(j?.huf) < 1000) {
      huf = Number(j.huf);
      day = j.day ?? null;
    }
  } catch {}
  return NextResponse.json({ huf, day }, { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } });
}
