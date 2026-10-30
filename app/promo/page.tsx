import { redirect } from 'next/navigation';

// /promo without a number opens the first store frame
export default function PromoIndex({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams || {})) if (typeof v === 'string') q.set(k, v);
  const s = q.toString();
  redirect(`/promo/1${s ? `?${s}` : ''}`);
}
