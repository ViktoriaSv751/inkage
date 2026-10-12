import '@fontsource/big-shoulders-display/900.css';
import '@fontsource/big-shoulders-display/700.css';
import '@fontsource/instrument-sans/400.css';
import '@fontsource/instrument-sans/600.css';
import '@fontsource/instrument-sans/700.css';
import './globals.css';
import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'InkAge – See your tattoo in 50 years',
  description: 'Upload a photo and any tattoo design. See it fresh, healed, and aged 10, 30 and 50 years – then make a time-lapse video.',
  openGraph: {
    title: 'InkAge – See your tattoo in 50 years',
    description: 'Try a tattoo on your own photo and watch it age 50 years.',
    type: 'website',
  },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#f3d6c8' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
      </head>
      <body>{children}</body>
    </html>
  );
}
