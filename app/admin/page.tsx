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
  events_today: Record<string, number>;
  daily: { day: string; previews: number; aging: number }[];
};

export default function Admin() {
  const [s, setS] = useState<Stats | null>(null);
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');
  const [health, setHealth] = useState<{ ok: boolean; detail: any; created_at: string }[]>([]);
  const [checking, setChecking] = useState(false);
  const [extra, setExtra] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const loadPosts = () => sb()?.rpc('admin_posts').then(({ data }) => Array.isArray(data) && setPosts(data));
  const moderate = async (id: number, ok: boolean) => {
    await sb()?.rpc('moderate_post', { p_id: id, p_ok: ok });
    setPosts((p) => p.filter((x) => x.id !== id));
  };
  const [reports, setReports] = useState<any[]>([]);
  const loadReports = () => sb()?.rpc('admin_reports').then(({ data }) => Array.isArray(data) && setReports(data));
  const actReport = async (share: string, hide: boolean) => {
    await sb()?.rpc('admin_report_action', { p_share: share, p_hide: hide });
    setReports((r) => r.filter((x) => x.share_id !== share));
  };
  const [feedback, setFeedback] = useState<any[]>([]);
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
    loadPosts();
    loadReports();
    sb()
      ?.rpc('admin_feedback')
      .then(({ data }) => Array.isArray(data) && setFeedback(data));
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
              ['Est. AI cost today', `$${cost}`],
              ['Failed previews today', funnel.generate_error ?? 0],
            ].map(([k, v]) => (
              <div key={k as string} style={{ background: '#fff6f0', borderRadius: 16, padding: 14 }}>
                <b style={{ display: 'block', fontFamily: 'var(--display)', fontSize: 36, lineHeight: 1 }}>{v}</b>
                <span style={{ fontSize: 13, color: 'var(--ink-2)', fontWeight: 600 }}>{k}</span>
              </div>
            ))}
          </div>
          {extra && extra.waitlist > 0 && (
            <button
              className="btn"
              style={{ marginTop: 10 }}
              onClick={async () => {
                const { api } = await import('@/lib/sb');
                const r = await api<{ sent?: number; more?: boolean; error?: string }>('/api/admin-waitlist', {});
                setNote(r.ok ? `Elküldve: ${r.data.sent}${r.data.more ? ' (van még, kattints újra)' : ''}` : r.data.error || 'Hiba');
              }}
            >
              Várólista értesítése: újra lehet előnézetet készíteni
            </button>
          )}
          {note && <p role="status" style={{ margin: '8px 0 0', fontWeight: 600 }}>{note}</p>}
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
          {reports.length > 0 && (
            <div style={{ background: '#ffe9e6', borderRadius: 16, padding: 14, marginTop: 14 }}>
              <b>Reported pictures ({reports.length})</b>
              <p style={{ fontSize: 13, color: 'var(--ink-2)', margin: '4px 0 10px' }}>Answer within 24 hours. 3 reports, or one “minor” report, hide a picture automatically until you decide.</p>
              <div style={{ display: 'grid', gap: 12 }}>
                {reports.map((r) => (
                  <div key={r.share_id} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <img src={r.paths?.fresh} alt="" style={{ width: 80, height: 100, objectFit: 'cover', borderRadius: 10, background: '#ddd' }} />
                    <img src={r.paths?.y50} alt="" style={{ width: 80, height: 100, objectFit: 'cover', borderRadius: 10, background: '#ddd' }} />
                    <div style={{ flex: 1, fontSize: 13 }}>
                      <b>{r.n} report{r.n === 1 ? '' : 's'}{r.hidden ? ' · hidden now' : ''}</b>
                      <div>{(r.items || []).map((i: any) => i.reason + (i.note ? `: ${i.note}` : '')).join(' · ')}</div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                        <button className="btn" style={{ minHeight: 36, padding: '0 14px', fontSize: 14 }} onClick={() => actReport(r.share_id, true)}>Remove</button>
                        <button className="btn ghost" style={{ minHeight: 36, padding: '0 14px', fontSize: 14 }} onClick={() => actReport(r.share_id, false)}>Keep</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {posts.length > 0 && (
            <div style={{ background: '#fff6f0', borderRadius: 16, padding: 14, marginTop: 14 }}>
              <b>Explore: waiting for review ({posts.length})</b>
              <p style={{ fontSize: 13, color: 'var(--ink-2)', margin: '4px 0 10px' }}>Approve only if there is no face, nudity, minors, private details or someone else’s artwork shown as theirs.</p>
              <div style={{ display: 'grid', gap: 12 }}>
                {posts.map((p) => (
                  <div key={p.id} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <img src={p.share?.paths?.fresh} alt="" style={{ width: 80, height: 100, objectFit: 'cover', borderRadius: 10 }} />
                    <img src={p.share?.paths?.y50} alt="" style={{ width: 80, height: 100, objectFit: 'cover', borderRadius: 10 }} />
                    <div style={{ flex: 1, fontSize: 13 }}>
                      <b>{p.caption || '—'}</b>
                      <div>{p.share?.placement} · {new Date(p.created_at).toLocaleString()}</div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                        <button className="btn" style={{ minHeight: 36, padding: '0 14px', fontSize: 14 }} onClick={() => moderate(p.id, true)}>Approve</button>
                        <button className="btn ghost" style={{ minHeight: 36, padding: '0 14px', fontSize: 14 }} onClick={() => moderate(p.id, false)}>Reject</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {feedback.length > 0 && (
            <details style={{ background: '#fff6f0', borderRadius: 16, padding: 14, marginTop: 14 }}>
              <summary style={{ fontWeight: 700, cursor: 'pointer' }}>Feedback from users ({feedback.length})</summary>
              <ul style={{ fontSize: 13, paddingLeft: 18, marginBottom: 0 }}>
                {feedback.map((f: any, i: number) => (
                  <li key={i} style={{ marginTop: 6 }}>
                    <b>{f.kind}</b> · {new Date(f.created_at).toLocaleString()} {f.email ? `· ${f.email}` : ''} — {f.message}
                  </li>
                ))}
              </ul>
            </details>
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
