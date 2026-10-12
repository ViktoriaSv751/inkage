import '@fontsource/geist-sans/400.css';
import '@fontsource/geist-sans/500.css';
import '@fontsource/geist-sans/600.css';
import '@fontsource/geist-sans/700.css';
import '@fontsource/geist-sans/800.css';
import './globals.css';
import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'InkAge – See your tattoo in 50 years',
  description: 'Upload a photo and any tattoo design. See it fresh, healed, and aged 10, 30 and 50 years – then make a time-lapse video.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'InkAge', statusBarStyle: 'default' },
  icons: { icon: '/icon.svg', apple: '/icons/apple-touch-icon.png' },
  openGraph: {
    title: 'InkAge – See your tattoo in 50 years',
    description: 'Try a tattoo on your own photo and watch it age 50 years.',
    type: 'website',
  },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#f4f4f2' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
      </head>
      <body>{children}</body>
    </html>
  );
}
