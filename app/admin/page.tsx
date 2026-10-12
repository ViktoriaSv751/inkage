'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { sb } from '@/lib/sb';

type Stats = {
  users: number;
  gen_today: number;
  gen_7d: number;
  guest_today: number;
  aging_today: number;
  saved: number;
  shares: number;
  votes: number;
  paid: number;
  events_today: Record<string, number>;
  daily: { day: string; previews: number; aging: number }[];
};

export default function Admin() {
  const [s, setS] = useState<Stats | null>(null);
  const [err, setErr] = useState('');
  const load = async () => {
    const c = sb();
    if (!c) return setErr('Not configured');
    const { data, error } = await c.rpc('admin_stats');
    if (error) setErr(/forbidden/.test(error.message) ? 'Sign in with the owner account first (Profile tab in the app).' : error.message);
    else setS(data as Stats);
  };
  useEffect(() => {
    load();
  }, []);
  const max = Math.max(1, ...(s?.daily || []).map((d) => d.previews));
  // Rough AI cost: ~1 fresh + 4 aging images + checks per preview.
  const cost = s ? (s.gen_today * 0.05 + s.aging_today * 0.04).toFixed(2) : '0';
  const funnel = s?.events_today || {};
  const steps = ['app_open', 'onboarding_done', 'photo_added', 'design_added', 'generate_start', 'generate_done', 'stage_y50', 'video_made', 'share_link', 'vote'];

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '20px 16px 60px', position: 'relative', zIndex: 1 }}>
      <p>
        <Link href="/app/profile">← App</Link>
      </p>
      <h1 style={{ fontSize: 56 }}>Dashboard</h1>
      {err && <p className="err">{err}</p>}
      {s && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
            {[
              ['Users', s.users],
              ['Previews today', s.gen_today],
              ['of them guests', s.guest_today],
              ['Previews 7 days', s.gen_7d],
              ['Aging images today', s.aging_today],
              ['Saved previews', s.saved],
              ['Share links', s.shares],
              ['Votes', s.votes],
              ['Paid users', s.paid],
              ['Est. AI cost today', `$${cost}`],
            ].map(([k, v]) => (
              <div key={k as string} style={{ background: '#fff6f0', borderRadius: 16, padding: 14 }}>
                <b style={{ display: 'block', fontFamily: 'var(--display)', fontSize: 36, lineHeight: 1 }}>{v}</b>
                <span style={{ fontSize: 13, color: 'var(--ink-2)', fontWeight: 600 }}>{k}</span>
              </div>
            ))}
          </div>
          <h2 style={{ fontFamily: 'var(--display)', textTransform: 'uppercase', marginTop: 30 }}>Previews, last 14 days</h2>
          <div style={{ display: 'flex', alignItems: 'end', gap: 4, height: 140, background: '#fff6f0', borderRadius: 16, padding: '24px 10px 10px' }}>
            {s.daily.map((d) => (
              <div key={d.day} title={`${d.day}: ${d.previews}`} style={{ flex: 1, height: `${(d.previews / max) * 100}%`, background: 'var(--violet)', borderRadius: '6px 6px 0 0', minHeight: 2, position: 'relative' }}>
                <span style={{ position: 'absolute', bottom: '100%', left: 0, right: 0, textAlign: 'center', fontSize: 11, fontWeight: 700 }}>{d.previews}</span>
              </div>
            ))}
          </div>
          <h2 style={{ fontFamily: 'var(--display)', textTransform: 'uppercase', marginTop: 30 }}>Funnel, last 24 hours</h2>
          <div style={{ background: '#fff6f0', borderRadius: 16, padding: 14 }}>
            {steps.map((k) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(21,18,43,.08)' }}>
                <span>{k}</span>
                <b>{funnel[k] ?? 0}</b>
              </div>
            ))}
          </div>
          <button className="btn" style={{ marginTop: 20 }} onClick={load}>
            Refresh
          </button>
        </>
      )}
    </main>
  );
}
