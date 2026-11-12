'use client';

export function PrintButton({ label }: { label: string }) {
  return (
    <button type="button" className="hz-print" onClick={() => window.print()}>
      {label}
    </button>
  );
}
