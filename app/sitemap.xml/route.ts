import { SITE_URL } from '@/lib/site';
import { SITEMAP_GROUPS, xmlResponse } from '@/lib/sitemap-data';

/** Sitemap index: one sitemap per page type (pages, articles, style × body-area pages) plus the image sitemap. */
export const revalidate = 3600; // hourly, so scheduled articles join on their day

export function GET() {
  const today = new Date().toISOString().slice(0, 10);
  const names = [...Object.keys(SITEMAP_GROUPS).map((g) => `sitemaps/${g}.xml`), 'image-sitemap.xml'];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${names.map((n) => `<sitemap><loc>${SITE_URL}/${n}</loc><lastmod>${today}</lastmod></sitemap>`).join('\n')}\n</sitemapindex>\n`;
  return xmlResponse(xml);
}
