'use client';
import { useState } from 'react';

/** "Put this map on your site": the iframe code with a copy button. */
export function EmbedCode({ code, title, copy, done }: { code: string; title: string; copy: string; done: string }) {
  const [ok, setOk] = useState(false);
  return (
    <details className="pm-code">
      <summary>{title}</summary>
      <textarea readOnly value={code} rows={3} onFocus={(e) => e.currentTarget.select()} />
      <button
        type="button"
        onClick={() => {
          navigator.clipboard?.writeText(code).then(() => setOk(true), () => {});
        }}
      >
        {ok ? done : copy}
      </button>
    </details>
  );
}
