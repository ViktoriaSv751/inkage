import { SITEMAP_GROUPS, urlsetXml, xmlResponse, type SitemapGroup } from '@/lib/sitemap-data';

/** /sitemaps/pages.xml, /sitemaps/articles.xml, /sitemaps/tattoo.xml */
export const revalidate = 3600; // hourly, so scheduled articles join on their day
export const dynamicParams = false;
export function generateStaticParams() {
  return Object.keys(SITEMAP_GROUPS).map((g) => ({ name: `${g}.xml` }));
}

export async function GET(_: Request, props: { params: Promise<{ name: string }> }) {
  const params = await props.params;
  const g = params.name.replace(/\.xml$/, '') as SitemapGroup;
  const make = SITEMAP_GROUPS[g];
  if (!make) return new Response('Not found', { status: 404 });
  return xmlResponse(urlsetXml(make()));
}
