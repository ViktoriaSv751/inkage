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
  const [health, setHealth] = useState<{ ok: boolean; detail: any; created_at: string }[]>([]);
  const [checking, setChecking] = useState(false);
  const [extra, setExtra] = useState<any>(null);
  const loadHealth = async () => {
    const { data } = (await sb()?.rpc('admin_health')) || {};
    if (Array.isArray(data)) setHealth(data);
  };
  const checkNow = async () => {
    setChecking(true);
    await fetch('/api/health').catch(() => {});
    await loadHealth();
    setChecking(false);
  };
  const load = async () => {
    const c = sb();
    if (!c) return setErr('Not configured');
    const { data, error } = await c.rpc('admin_stats');
    if (error) setErr(/forbidden/.test(error.message) ? 'Sign in with the owner account first (Profile tab in the app).' : error.message);
    else setS(data as Stats);
  };
  useEffect(() => {
    load();
    loadHealth();
    sb()
      ?.rpc('admin_extra')
      .then(({ data }) => data && setExtra(data));
  }, []);
  const max = Math.max(1, ...(s?.daily || []).map((d) => d.previews));
  // Rough AI cost: ~1 fresh + 4 aging images + checks per preview.
  const cost = s ? (s.gen_today * 0.05 + s.aging_today * 0.04).toFixed(2) : '0';
  const funnel = s?.events_today || {};
  const steps = ['app_open', 'design_kind', 'tattoo_pick', 'extract_design', 'extract_done', 'redo', 'card_made', 'onboarding_done', 'photo_added', 'design_added', 'ai_design', 'generate_start', 'generate_done', 'generate_error', 'paywall', 'stage_y50', 'improve_start', 'resize', 'removal_start', 'video_made', 'artist_pdf', 'aftercare_ics', 'share_link', 'vote'];

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
              ['Failed previews today', funnel.generate_error ?? 0],
            ].map(([k, v]) => (
              <div key={k as string} style={{ background: '#fff6f0', borderRadius: 16, padding: 14 }}>
                <b style={{ display: 'block', fontFamily: 'var(--display)', fontSize: 36, lineHeight: 1 }}>{v}</b>
                <span style={{ fontSize: 13, color: 'var(--ink-2)', fontWeight: 600 }}>{k}</span>
              </div>
            ))}
          </div>
          {extra && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10, marginTop: 10 }}>
              {[
                ['Previews today (only)', extra.previews_today],
                ['Cut-outs / AI drawings today', extra.helpers_today],
                ['Errors today', extra.errors_today],
                ['Recovered after closing', extra.recovered_today],
                ['Waitlist e-mails', extra.waitlist],
              ].map(([k, v]) => (
                <div key={k as string} style={{ background: '#fff6f0', borderRadius: 16, padding: 14 }}>
                  <b style={{ display: 'block', fontSize: 30, lineHeight: 1 }}>{v as any}</b>
                  <span style={{ fontSize: 13, color: 'var(--ink-2)', fontWeight: 600 }}>{k}</span>
                </div>
              ))}
            </div>
          )}
          <div style={{ background: health[0] && !health[0].ok ? '#fdebeb' : '#eaf7f0', borderRadius: 16, padding: 14, marginTop: 14 }}>
            <b>AI models: {health[0] ? (health[0].ok ? 'working' : 'PROBLEM') : 'not checked yet'}</b>
            {health[0] && (
              <div style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 4 }}>
                Checked {new Date(health[0].created_at).toLocaleString()} · text: {health[0].detail?.activeText || '—'} · image: {health[0].detail?.activeImage || '—'}
                {health[0].detail?.preferredMissing?.length ? ` · missing: ${health[0].detail.preferredMissing.join(', ')}` : ''}
                {health[0].detail?.answer?.startsWith('error') ? ` · ${health[0].detail.answer}` : ''}
              </div>
            )}
            <button className="btn ghost" style={{ minHeight: 40, marginTop: 8, padding: '0 16px', fontSize: 14 }} onClick={checkNow} disabled={checking}>
              {checking ? 'Checking…' : 'Check now'}
            </button>
          </div>
          <div style={{ background: '#fff6f0', borderRadius: 16, padding: 14, marginTop: 14 }}>
            <b>Daily safety cap: {s.gen_today} / 300 AI jobs in the last 24 h</b>
            <div className={`gauge ${s.gen_today > 240 ? 'hot' : ''}`} style={{ height: 10, borderRadius: 10, background: 'rgba(21,18,43,.1)', overflow: 'hidden', marginTop: 8 }}>
              <i style={{ display: 'block', height: '100%', width: `${Math.min(100, (s.gen_today / 300) * 100)}%`, background: s.gen_today > 240 ? '#e0483b' : '#4b2bd6' }} />
            </div>
            <small style={{ color: 'var(--ink-2)' }}>When it reaches 300, new previews pause until the oldest ones drop out of the 24-hour window.</small>
          </div>
          {extra && Object.keys(extra.redo || {}).length > 0 && (
            <div style={{ background: '#fff6f0', borderRadius: 16, padding: 14, marginTop: 14 }}>
              <b>“Not right?” reasons, last 30 days</b>
              <div style={{ fontSize: 14, marginTop: 6 }}>
                {Object.entries(extra.redo).map(([k, n]) => (
                  <span key={k} style={{ marginRight: 14 }}>
                    {k}: <b>{n as any}</b>
                  </span>
                ))}
              </div>
            </div>
          )}
          {extra?.errors?.length > 0 && (
            <details style={{ background: '#fff6f0', borderRadius: 16, padding: 14, marginTop: 14 }}>
              <summary style={{ fontWeight: 700, cursor: 'pointer' }}>Latest errors ({extra.errors.length})</summary>
              <ul style={{ fontSize: 13, paddingLeft: 18, marginBottom: 0 }}>
                {extra.errors.map((e: any, i: number) => (
                  <li key={i} style={{ marginTop: 6 }}>
                    <b>{e.name}</b> · {new Date(e.created_at).toLocaleString()} · {e.props?.route || e.props?.path || ''} — {e.props?.msg || JSON.stringify(e.props)}
                  </li>
                ))}
              </ul>
            </details>
          )}
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
