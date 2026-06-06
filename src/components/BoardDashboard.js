import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function fmt(d) {
  if (!d) return '—';
  return new Date(d + 'T12:00:00').toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtMoney(n) {
  if (!n) return '$0';
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000)    return `$${(n / 1000).toFixed(0)}k`;
  return `$${n}`;
}

function getPeriodStart(p) {
  const now = new Date();
  if (p === 'month')   return new Date(now.getFullYear(), now.getMonth(), 1);
  if (p === 'quarter') return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
  if (p === 'year')    return new Date(now.getFullYear(), 0, 1);
  return null; // 'all' — no start boundary
}

const PERIODS = [
  { key: 'month',   label: 'This Month' },
  { key: 'quarter', label: 'This Quarter' },
  { key: 'year',    label: 'This Year' },
  { key: 'all',     label: 'All Time' },
];

const PERIOD_LABEL = { month: 'This Month', quarter: 'This Quarter', year: 'This Year', all: 'All Time' };

function Stars({ rating }) {
  if (!rating) return <span style={{ color: 'var(--text3)' }}>—</span>;
  const r = Math.round(rating);
  return <span style={{ color: '#f4a400', letterSpacing: 1 }}>{'★'.repeat(r)}{'☆'.repeat(5 - r)}</span>;
}

function SectionTitle({ icon, title, count, note }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, paddingBottom: 8, borderBottom: '2px solid var(--brand)' }}>
      <span style={{ fontSize: 18 }}>{icon}</span>
      <span style={{ fontFamily: 'Playfair Display, serif', fontSize: 17, fontWeight: 600, color: 'var(--brand)' }}>{title}</span>
      {count !== undefined && (
        <span style={{ fontSize: 12, background: 'var(--brand)', color: '#fff', borderRadius: 20, padding: '1px 9px', fontWeight: 600, marginLeft: 4 }}>{count}</span>
      )}
      {note && <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 4 }}>{note}</span>}
    </div>
  );
}

const STATUS_STYLES = {
  researching:   { bg: '#f0ecf8', color: '#6b42a8' },
  'in-progress': { bg: '#e8eef8', color: '#1a4a8a' },
  submitted:     { bg: '#fdf0dc', color: '#7a4f00' },
  approved:      { bg: '#e8f4ef', color: '#1a4a3a' },
  declined:      { bg: '#fdecea', color: '#7a1a1a' },
  reporting:     { bg: '#e8f8f4', color: '#0a5a48' },
};

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function BoardDashboard({ onNavigate }) {
  const [d, setD]         = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod]   = useState('year');

  useEffect(() => { fetchAll(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchAll() {
    setLoading(true);
    const [bookRes, projRes, actRes, grantRes, remRes, assetRes, taskRes, feedRes, settingsRes] = await Promise.all([
      supabase.from('bookings').select('id, occasion, start_date, end_date, guests, status').order('start_date'),
      supabase.from('projects').select('id, name, status, progress, lead, due_date, created_at'),
      supabase.from('meeting_actions').select('id, description, assigned_to, due_date, status').neq('status', 'Completed'),
      supabase.from('grants').select('id, name, funder, amount, status, deadline').order('deadline'),
      supabase.from('service_reminders').select('id, type, due_date, asset_id').order('due_date'),
      supabase.from('assets').select('id, name'),
      supabase.from('tasks').select('id, title, due_date, status, priority').neq('status', 'cancelled').neq('status', 'completed'),
      supabase.from('booking_feedback').select('rating_overall, experience, created_at').order('created_at', { ascending: false }),
      supabase.from('marae_settings').select('marae_name').single(),
    ]);
    setD({
      bookings:  bookRes.data   || [],
      projects:  projRes.data   || [],
      actions:   actRes.data    || [],
      grants:    grantRes.data  || [],
      reminders: remRes.data    || [],
      assets:    assetRes.data  || [],
      tasks:     taskRes.data   || [],
      feedback:  feedRes.data   || [],
      maraeName: settingsRes.data?.marae_name || 'Our Marae',
    });
    setLoading(false);
  }

  if (loading) return <div className="loading">Loading board overview...</div>;
  if (!d) return null;

  // ─── BASE DATES ────────────────────────────────────────────────────────────

  const today    = new Date(); today.setHours(0, 0, 0, 0);
  const todayStr = new Date().toISOString().split('T')[0];
  const in14     = new Date(today); in14.setDate(in14.getDate() + 14);
  const in60     = new Date(today); in60.setDate(in60.getDate() + 60);

  // ─── PERIOD FILTER ─────────────────────────────────────────────────────────

  const periodStart = getPeriodStart(period);

  function inPeriod(val) {
    if (!periodStart) return true;
    if (!val) return false;
    const str = typeof val === 'string' ? (val.includes('T') ? val : val + 'T12:00:00') : val.toISOString();
    return new Date(str) >= periodStart;
  }

  // Period-scoped data
  const periodBookings      = d.bookings.filter(b => b.status === 'approved' && inPeriod(b.start_date));
  const periodFeedback      = d.feedback.filter(f => inPeriod(f.created_at));
  const periodFeedbackScores = periodFeedback.filter(f => f.rating_overall);
  const periodApprovedGrants = d.grants.filter(g => g.status === 'approved' && inPeriod(g.deadline));
  const periodProjects      = d.projects.filter(p => p.status === 'active' && inPeriod(p.created_at));
  const periodUpcoming      = periodBookings.filter(b => b.start_date >= todayStr).slice(0, 5);
  const periodPipeline      = d.grants.filter(g => !['approved','declined'].includes(g.status) && inPeriod(g.deadline));
  const periodComments      = periodFeedback.filter(f => f.experience).slice(0, 3);

  // ─── PERIOD-INDEPENDENT (always current-state) ─────────────────────────────

  const assetMap = {};
  d.assets.forEach(a => { assetMap[a.id] = a.name; });

  const overdueReminders  = d.reminders.filter(r => r.due_date && new Date(r.due_date + 'T12:00:00') < today);
  const assetsWithOverdue = new Set(overdueReminders.map(r => r.asset_id));
  const compliantPct      = d.assets.length ? Math.round(((d.assets.length - assetsWithOverdue.size) / d.assets.length) * 100) : 100;
  const upcomingReminders = d.reminders.filter(r => r.due_date && new Date(r.due_date + 'T12:00:00') <= in60).sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
  const actionsSorted     = [...d.actions].sort((a, b) => {
    const ao = a.due_date && new Date(a.due_date + 'T12:00:00') < today;
    const bo = b.due_date && new Date(b.due_date + 'T12:00:00') < today;
    return ao === bo ? 0 : ao ? -1 : 1;
  });

  // ─── ALERTS (always current — not period-filtered) ─────────────────────────

  const overdueTasks    = d.tasks.filter(t => t.due_date && new Date(t.due_date + 'T12:00:00') < today);
  const urgentGrants    = d.grants.filter(g => g.deadline && !['approved','declined'].includes(g.status) && new Date(g.deadline + 'T12:00:00') >= today && new Date(g.deadline + 'T12:00:00') <= in14);
  const pendingBookings = d.bookings.filter(b => b.status === 'pending');

  const ALERTS = [
    overdueTasks.length     && { label: `${overdueTasks.length} overdue task${overdueTasks.length !== 1 ? 's' : ''}`,  level: 'red',   tab: 'tasks' },
    overdueReminders.length && { label: `${overdueReminders.length} overdue service reminder${overdueReminders.length !== 1 ? 's' : ''}`, level: 'red', tab: 'assets' },
    urgentGrants.length     && { label: `${urgentGrants.length} grant deadline${urgentGrants.length !== 1 ? 's' : ''} within 14 days`, level: 'amber', tab: 'grants' },
    pendingBookings.length  && { label: `${pendingBookings.length} booking${pendingBookings.length !== 1 ? 's' : ''} awaiting approval`, level: 'amber', tab: 'bookings' },
  ].filter(Boolean);

  // ─── KPI TILES (period-filtered) ───────────────────────────────────────────

  const avgRating        = periodFeedbackScores.length ? (periodFeedbackScores.reduce((s, f) => s + f.rating_overall, 0) / periodFeedbackScores.length) : null;
  const approvedGrantsAmt = periodApprovedGrants.reduce((s, g) => s + (g.amount || 0), 0);
  const pl               = PERIOD_LABEL[period];

  const KPI_TILES = [
    { label: `Bookings — ${pl}`,    value: periodBookings.length,           icon: '📅', bg: '#e8eef8', color: '#1a4a8a' },
    { label: `Avg Rating — ${pl}`,  value: avgRating ? `${Number(avgRating).toFixed(1)} ★` : '—', icon: '⭐', bg: '#fdf8dc', color: '#7a5a00' },
    { label: 'Active Projects',     value: periodProjects.length,           icon: '📋', bg: '#e8f4ef', color: 'var(--brand)' },
    { label: 'Open Actions',        value: d.actions.length,                icon: '✅', bg: d.actions.length > 0 ? '#fdf0dc' : '#f5f5f5', color: d.actions.length > 0 ? 'var(--warning)' : 'var(--text3)' },
    { label: `Grants — ${pl}`,      value: fmtMoney(approvedGrantsAmt),     icon: '💰', bg: '#e8f4ef', color: 'var(--brand)' },
    { label: 'Assets Compliant',    value: `${compliantPct}%`,              icon: '🛡️', bg: compliantPct >= 80 ? '#e8f4ef' : '#faeae7', color: compliantPct >= 80 ? 'var(--brand)' : 'var(--danger)' },
  ];

  const todayDisplay = new Date().toLocaleDateString('en-NZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  // ─── RENDER ────────────────────────────────────────────────────────────────

  return (
    <div>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .main { padding: 0 !important; }
          .panel { box-shadow: none !important; border: 1px solid #ddd !important; break-inside: avoid; }
        }
      `}</style>

      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 26, marginBottom: 2 }}>Board Overview</h1>
          <div style={{ fontSize: 13, color: 'var(--text3)' }}>{d.maraeName} · {todayDisplay}</div>
        </div>
        <button
          className="no-print"
          onClick={() => window.print()}
          style={{ background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          🖨️ Print
        </button>
      </div>

      {/* ── PERIOD TOGGLE ──────────────────────────────────────────────── */}
      <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Period</span>
        <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          {PERIODS.map((p, i) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setPeriod(p.key)}
              style={{
                padding: '7px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: period === p.key ? 'var(--brand)' : 'var(--surface)',
                color: period === p.key ? '#fff' : 'var(--text2)',
                border: 'none',
                borderRight: i < PERIODS.length - 1 ? '1px solid var(--border)' : 'none',
                fontFamily: 'DM Sans, sans-serif',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── ALERTS STRIP ───────────────────────────────────────────────── */}
      {ALERTS.length > 0 ? (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
          {ALERTS.map((a, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onNavigate && onNavigate(a.tab)}
              className="no-print"
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                background: a.level === 'red' ? '#faeae7' : '#fdf0dc',
                color: a.level === 'red' ? 'var(--danger)' : '#7a4f00',
                border: `1px solid ${a.level === 'red' ? '#f0b8b0' : '#e8c880'}`,
                borderLeft: `4px solid ${a.level === 'red' ? 'var(--danger)' : 'var(--warning)'}`,
                borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600,
                cursor: onNavigate ? 'pointer' : 'default', fontFamily: 'DM Sans, sans-serif',
              }}
            >
              <span>{a.level === 'red' ? '🔴' : '🟡'}</span>
              {a.label}
              {onNavigate && <span style={{ opacity: 0.5, fontSize: 12 }}>→</span>}
            </button>
          ))}
        </div>
      ) : (
        <div style={{ background: '#e8f4ef', border: '1px solid #a8d8c0', borderLeft: '4px solid var(--brand)', borderRadius: 8, padding: '10px 16px', marginBottom: 20, fontSize: 13, fontWeight: 600, color: 'var(--brand)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>✅</span> All clear — no urgent items requiring attention
        </div>
      )}

      {/* ── KPI TILES ──────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, marginBottom: 28 }}>
        {KPI_TILES.map((t, i) => (
          <div key={i} className="panel" style={{ textAlign: 'center', padding: '14px 8px' }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: t.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, margin: '0 auto 8px' }}>{t.icon}</div>
            <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, fontWeight: 600, color: t.color, marginBottom: 3, lineHeight: 1.2 }}>{t.value}</div>
            <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 500, lineHeight: 1.3 }}>{t.label}</div>
          </div>
        ))}
      </div>

      {/* ── TWO-COLUMN: BOOKINGS + PROJECTS ────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>

        {/* ── UPCOMING BOOKINGS ──────────────────────────────────────── */}
        <div className="panel">
          <SectionTitle icon="📅" title="Upcoming Bookings" count={periodUpcoming.length} note={`(${pl})`} />
          {periodUpcoming.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text3)', fontStyle: 'italic' }}>No upcoming bookings for this period</div>
          ) : periodUpcoming.map(b => (
            <div key={b.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--cream2)' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{b.occasion}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>{fmt(b.start_date)}{b.end_date !== b.start_date ? ` → ${fmt(b.end_date)}` : ''} · {b.guests} guests</div>
              </div>
              <span style={{ fontSize: 10, background: '#e8f4ef', color: '#1a4a3a', borderRadius: 20, padding: '2px 8px', fontWeight: 600 }}>Approved</span>
            </div>
          ))}
        </div>

        {/* ── ACTIVE PROJECTS ────────────────────────────────────────── */}
        <div className="panel">
          <SectionTitle icon="📋" title="Active Projects" count={periodProjects.length} note={`(started ${pl.toLowerCase()})`} />
          {periodProjects.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text3)', fontStyle: 'italic' }}>No active projects started in this period</div>
          ) : periodProjects.map(p => {
            const overdue = p.due_date && p.status !== 'completed' && new Date(p.due_date) < today;
            return (
              <div key={p.id} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                    {p.name}
                    {overdue && <span style={{ fontSize: 9, background: '#faeae7', color: 'var(--danger)', borderRadius: 4, padding: '1px 5px', marginLeft: 6, fontWeight: 700 }}>OVERDUE</span>}
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--brand)' }}>{p.progress || 0}%</span>
                </div>
                {p.lead && <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>👤 {p.lead}{p.due_date && ` · Due ${fmt(p.due_date)}`}</div>}
                <div style={{ height: 6, background: 'var(--cream2)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${p.progress || 0}%`, background: 'var(--brand-light)', borderRadius: 3 }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── OPEN MEETING ACTIONS ───────────────────────────────────────── */}
      <div className="panel" style={{ marginBottom: 20 }}>
        <SectionTitle icon="✅" title="Open Meeting Actions" count={actionsSorted.length} />
        {actionsSorted.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text3)', fontStyle: 'italic' }}>No open actions</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0 24px' }}>
            {actionsSorted.map(a => {
              const overdue = a.due_date && new Date(a.due_date + 'T12:00:00') < today;
              return (
                <div key={a.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--cream2)' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: overdue ? 'var(--danger)' : 'var(--warning)', flexShrink: 0, marginTop: 4 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: overdue ? 'var(--danger)' : 'var(--text1)', fontWeight: overdue ? 600 : 400 }}>{a.description}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                      {a.assigned_to && `👤 ${a.assigned_to}`}{a.due_date && ` · Due ${fmt(a.due_date)}`}
                      {overdue && <strong style={{ color: 'var(--danger)' }}> — OVERDUE</strong>}
                    </div>
                  </div>
                  <span style={{ fontSize: 10, background: '#fdf0dc', color: '#7a4f00', borderRadius: 20, padding: '2px 8px', fontWeight: 600, flexShrink: 0 }}>{a.status}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── TWO-COLUMN: GRANTS + REMINDERS ─────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>

        {/* ── GRANTS PIPELINE ────────────────────────────────────────── */}
        <div className="panel">
          <SectionTitle icon="💰" title="Grants Pipeline" count={periodPipeline.length} note={`(${pl})`} />
          {periodPipeline.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text3)', fontStyle: 'italic' }}>No active grant applications in this period</div>
          ) : periodPipeline.map(g => {
            const ss = STATUS_STYLES[g.status] || STATUS_STYLES.researching;
            const daysLeft = g.deadline ? Math.ceil((new Date(g.deadline + 'T12:00:00') - today) / (1000 * 60 * 60 * 24)) : null;
            const urgent = daysLeft !== null && daysLeft >= 0 && daysLeft <= 14;
            return (
              <div key={g.id} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--cream2)', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</div>
                  <div style={{ fontSize: 11, color: urgent ? 'var(--warning)' : 'var(--text3)' }}>
                    {g.funder}{g.amount && ` · ${fmtMoney(g.amount)}`}
                    {g.deadline && ` · ${urgent ? `⚠️ ${daysLeft}d left` : `Due ${fmt(g.deadline)}`}`}
                  </div>
                </div>
                <span style={{ fontSize: 10, background: ss.bg, color: ss.color, borderRadius: 20, padding: '2px 8px', fontWeight: 600, flexShrink: 0 }}>{g.status}</span>
              </div>
            );
          })}
        </div>

        {/* ── SERVICE REMINDERS ──────────────────────────────────────── */}
        <div className="panel">
          <SectionTitle icon="🔧" title="Service Reminders (60 days)" count={upcomingReminders.length} />
          {upcomingReminders.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text3)', fontStyle: 'italic' }}>No reminders due in next 60 days</div>
          ) : upcomingReminders.map(r => {
            const overdue = new Date(r.due_date + 'T12:00:00') < today;
            const daysLeft = Math.ceil((new Date(r.due_date + 'T12:00:00') - today) / (1000 * 60 * 60 * 24));
            return (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--cream2)', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: overdue ? 600 : 400, color: overdue ? 'var(--danger)' : 'var(--text1)' }}>
                    {assetMap[r.asset_id] || 'Asset'} — {r.type}
                  </div>
                  <div style={{ fontSize: 11, color: overdue ? 'var(--danger)' : 'var(--text3)' }}>
                    {overdue ? `Overdue by ${Math.abs(daysLeft)}d` : daysLeft === 0 ? 'Due today' : `Due in ${daysLeft}d`} · {fmt(r.due_date)}
                  </div>
                </div>
                <span style={{ fontSize: 10, background: overdue ? '#faeae7' : '#fdf0dc', color: overdue ? 'var(--danger)' : '#7a4f00', borderRadius: 20, padding: '2px 8px', fontWeight: 600, flexShrink: 0 }}>
                  {overdue ? 'Overdue' : 'Due soon'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── COMMUNITY FEEDBACK ─────────────────────────────────────────── */}
      <div className="panel" style={{ marginBottom: 8 }}>
        <SectionTitle icon="⭐" title="Community Feedback" note={`(${pl})`} />
        <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 24 }}>
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            {avgRating ? (
              <>
                <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 48, fontWeight: 700, color: '#f4a400', lineHeight: 1 }}>{Number(avgRating).toFixed(1)}</div>
                <div style={{ fontSize: 22, color: '#f4a400', marginBottom: 6 }}><Stars rating={Number(avgRating)} /></div>
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>from {periodFeedbackScores.length} response{periodFeedbackScores.length !== 1 ? 's' : ''}</div>
              </>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--text3)', fontStyle: 'italic', paddingTop: 16 }}>No feedback in this period</div>
            )}
          </div>
          <div>
            {periodComments.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--text3)', fontStyle: 'italic' }}>No comments in this period</div>
            ) : periodComments.map((f, i) => (
              <div key={i} style={{ padding: '10px 12px', background: 'var(--surface2)', borderRadius: 8, border: '1px solid var(--border)', marginBottom: 10 }}>
                <div style={{ display: 'flex', gap: 3, marginBottom: 6 }}>
                  {[1,2,3,4,5].map(n => <span key={n} style={{ fontSize: 12, color: n <= (f.rating_overall || 0) ? '#f4a400' : '#ddd' }}>★</span>)}
                  <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 6 }}>
                    {new Date(f.created_at).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text2)', fontStyle: 'italic', lineHeight: 1.6 }}>
                  "{f.experience.length > 150 ? f.experience.slice(0, 150) + '…' : f.experience}"
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
