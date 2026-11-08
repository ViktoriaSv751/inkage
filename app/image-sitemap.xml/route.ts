import { IMG } from '@/lib/img';
import { KB } from '@/lib/kb';
import { LONG } from '@/lib/longform';
import { articleLangs } from '@/lib/article-langs';
import { pick, qOf } from '@/lib/tr';
import { SITE_URL } from '@/lib/site';

/**
 * Image sitemap for Google Images: every knowledge-base article, in each language it is written in, with its cover
 * and inline pictures (captions in that language). Next 14's sitemap.ts can't list images, so this is plain XML;
 * robots.txt points to it next to /sitemap.xml.
 */
export const dynamic = 'force-static';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const abs = (u: string) => (u.startsWith('http') ? u : `${SITE_URL}${u}`);

export function GET() {
  const rows: string[] = [];
  for (const a of LONG) {
    const m = KB[a.slug];
    if (!m) continue;
    for (const L of articleLangs(a.slug)) {
      const pics: { id: string; cap: string }[] = [{ id: m.img, cap: pick(a.title, L) }];
      for (const k of ['img2', 'img3', 'img4', 'img5', 'img6', 'img7'] as const) {
        const id = m[k], cap = a.captions[k];
        if (id && cap) pics.push({ id, cap: pick(cap, L) });
      }
      rows.push(
        `<url><loc>${esc(`${SITE_URL}/tudastar/${a.slug}${qOf(L)}`)}</loc>` +
          pics.map((p) => `<image:image><image:loc>${esc(abs(IMG(p.id, 1400)))}</image:loc><image:caption>${esc(p.cap)}</image:caption></image:image>`).join('') +
          `</url>`
      );
    }
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${rows.join('\n')}\n</urlset>\n`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
}
