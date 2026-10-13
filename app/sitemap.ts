import type { MetadataRoute } from 'next';
import { ARTICLES } from '@/lib/articles';
import { seoSlugs } from '@/lib/seo';

const BASE = process.env.NEXT_PUBLIC_SITE_URL || 'https://inkage.vercel.app';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${BASE}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE}/app`, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${BASE}/learn`, changeFrequency: 'monthly', priority: 0.7 },
    ...ARTICLES.map((a) => ({ url: `${BASE}/learn/${a.slug}`, changeFrequency: 'monthly' as const, priority: 0.6 })),
    ...seoSlugs().map((slug) => ({ url: `${BASE}/tattoo/${slug}`, changeFrequency: 'monthly' as const, priority: 0.5 })),
    { url: `${BASE}/terms`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${BASE}/privacy`, changeFrequency: 'yearly', priority: 0.2 },
  ];
}
