'use client';
import { Recover } from './_err/Recover';

// last line of defence: anything that breaks the whole page lands here instead of a blank error
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  return (
    <html lang="hu">
      <body style={{ margin: 0 }}>
        <Recover error={error} />
      </body>
    </html>
  );
}
