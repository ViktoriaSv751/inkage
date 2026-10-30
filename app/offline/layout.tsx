import type { Metadata } from 'next';

// the offline fallback page is for the service worker only, never for search results
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function OfflineLayout({ children }: { children: React.ReactNode }) {
  return children;
}
