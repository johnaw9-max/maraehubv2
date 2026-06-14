import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { TASK_SOURCES, taskSource } from '../lib/taskSync';

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
  const [d, setD]             = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod]   = useState('month');
  // eslint-disable-next-line no-unused-vars
  const [aiLoading, setAiLoading] = useState(false);
  const [aiReport, setAiReport]   = useState('');
  const [aiError, setAiError]     = useState('');
  const [showReport, setShowReport] = useState(false);
  const [copied, setCopied]       = useState(false);

  useEffect(() => { fetchAll(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchAll() {
    setLoading(true);
    const now = new Date();
    const fyYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    const fyFrom = `${fyYear}-04-01`;
    const fyTo   = `${fyYear + 1}-03-31`;

    const [bookRes, projRes, actRes, grantRes, remRes, assetRes, taskRes, feedRes, settingsRes, compRes, goalsRes, finIncRes, finExpRes, finBudRes] = await Promise.all([
      supabase.from('bookings').select('id, occasion, start_date, end_date, guests, status').order('start_date'),
      supabase.from('projects').select('id, name, status, progress, lead, due_date, created_at'),
      supabase.from('meeting_actions').select('id, description, assigned_to, due_date, status').neq('status', 'Completed'),
      supabase.from('grants').select('id, name, funder, amount, status, deadline').order('deadline'),
      supabase.from('service_reminders').select('id, type, due_date, asset_id').order('due_date'),
      supabase.from('assets').select('id, name'),
      supabase.from('tasks').select('id, title, due_date, status, priority').neq('status', 'cancelled').neq('status', 'completed'),
      supabase.from('booking_feedback').select('rating_overall, experience, created_at').order('created_at', { ascending: false }),
      supabase.from('marae_settings').select('marae_name').single(),
      supabase.from('compliance_items').select('id, name, category, due_date').order('due_date'),
      supabase.from('goals').select('id, name, status, target_date, responsible_name').order('target_date'),
      supabase.from('finance_income').select('amount').gte('date', fyFrom).lte('date', fyTo),
      supabase.from('finance_expenses').select('amount, category').gte('date', fyFrom).lte('date', fyTo),
      supabase.from('finance_budgets').select('category, amount').eq('financial_year', fyYear),
    ]);
    setD({
      bookings:     bookRes.data   || [],
      projects:     projRes.data   || [],
      actions:      actRes.data    || [],
      grants:       grantRes.data  || [],
      reminders:    remRes.data    || [],
      assets:       assetRes.data  || [],
      tasks:        taskRes.data   || [],
      feedback:     feedRes.data   || [],
      maraeName:    settingsRes.data?.marae_name || 'Our Marae',
      compliance:   compRes.data   || [],
      goals:        goalsRes.data  || [],
      finIncome:    finIncRes.data  || [],
      finExpenses:  finExpRes.data  || [],
      finBudgets:   finBudRes.data  || [],
      fyYear,
    });
    setLoading(false);
  }

  if (loading) return <div className="loading">Loading board overview...</div>;
  if (!d) return null;

  // ─── BASE DATES ────────────────────────────────────────────────────────────

  const today    = new Date(); today.setHours(0, 0, 0, 0);
  const todayStr = new Date().toISOString().split('T')[0];
  const in7      = new Date(today); in7.setDate(in7.getDate() + 7);
  const in14     = new Date(today); in14.setDate(in14.getDate() + 14);
  const in30     = new Date(today); in30.setDate(in30.getDate() + 30);
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

  // ─── FINANCIAL HEALTH ──────────────────────────────────────────────────────
  const finTotalIncome   = (d.finIncome   || []).reduce((s, r) => s + parseFloat(r.amount || 0), 0);
  const finTotalExpenses = (d.finExpenses || []).reduce((s, r) => s + parseFloat(r.amount || 0), 0);
  const finNet           = finTotalIncome - finTotalExpenses;
  const finBudgetMap     = {};
  (d.finBudgets || []).forEach(b => { finBudgetMap[b.category] = parseFloat(b.amount || 0); });
  const finSpentMap = {};
  (d.finExpenses || []).forEach(e => { finSpentMap[e.category] = (finSpentMap[e.category] || 0) + parseFloat(e.amount || 0); });
  const finOverBudgetCats = Object.entries(finBudgetMap)
    .filter(([cat, bud]) => bud > 0 && (finSpentMap[cat] || 0) > bud)
    .map(([cat]) => cat);
  const fyLabelStr = `${d.fyYear}/${String(d.fyYear + 1).slice(2)}`;

  const overdueCompliance  = d.compliance.filter(c => c.due_date && new Date(c.due_date + 'T12:00:00') < today);
  const dueSoonCompliance  = d.compliance.filter(c => c.due_date && new Date(c.due_date + 'T12:00:00') >= today && new Date(c.due_date + 'T12:00:00') <= in30);

  // Emergency Preparedness — high-priority check (overdue OR no due_date set)
  const epCompliance      = d.compliance.filter(c => c.category === 'emergency_preparedness');
  const epOverdue         = epCompliance.filter(c => c.due_date && new Date(c.due_date + 'T12:00:00') < today);
  const epNotScheduled    = epCompliance.filter(c => !c.due_date);
  const epUrgentCount     = epOverdue.length + epNotScheduled.length;

  // Goals traffic light (matches GoalsReporting.js logic)
  function goalLight(g) {
    const t = g.target_date ? new Date(g.target_date + 'T12:00:00') : null;
    if (g.status === 'completed') return 'green';
    if (g.status === 'at_risk') return 'orange';
    if (g.status === 'not_started') return (t && t < today) ? 'red' : 'grey';
    if (t && t < today) return 'red';
    if (t && t <= in14) return 'orange';
    return 'green';
  }
  const goalsBehind   = d.goals.filter(g => goalLight(g) === 'red');
  const goalsAtRisk   = d.goals.filter(g => goalLight(g) === 'orange');
  const goalsOnTrack  = d.goals.filter(g => goalLight(g) === 'green');
  const goalsComplete = d.goals.filter(g => g.status === 'completed');
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

  // Separate UPCOMING tasks (Medium / amber) from true OVERDUE tasks (High / red)
  const upcomingAutoTasks = d.tasks.filter(t => t.title.startsWith('UPCOMING: '));
  const overdueTasks      = d.tasks.filter(t => !t.title.startsWith('UPCOMING: ') && t.due_date && new Date(t.due_date + 'T12:00:00') < today);
  const overdueProjects   = d.projects.filter(p => p.status !== 'completed' && p.due_date && new Date(p.due_date + 'T12:00:00') < today);
  const urgentGrants      = d.grants.filter(g => g.deadline && !['approved','declined'].includes(g.status) && new Date(g.deadline + 'T12:00:00') >= today && new Date(g.deadline + 'T12:00:00') <= in14);
  const pendingBookings   = d.bookings.filter(b => b.status === 'pending');

  const ALERTS = [
    epUrgentCount              && { label: `🆘 Emergency Preparedness — ${epUrgentCount} item${epUrgentCount !== 1 ? 's' : ''} overdue or not scheduled`, level: 'red', tab: 'compliance' },
    overdueCompliance.length   && { label: `${overdueCompliance.length} compliance item${overdueCompliance.length !== 1 ? 's' : ''} overdue`, level: 'red', tab: 'compliance' },
    goalsBehind.length         && { label: `${goalsBehind.length} strategic goal${goalsBehind.length !== 1 ? 's' : ''} behind schedule`, level: 'red', tab: 'goals' },
    overdueTasks.length        && { label: `${overdueTasks.length} overdue task${overdueTasks.length !== 1 ? 's' : ''}`, level: 'red', tab: 'tasks' },
    overdueProjects.length     && { label: `${overdueProjects.length} overdue project${overdueProjects.length !== 1 ? 's' : ''}`, level: 'red', tab: 'projects' },
    overdueReminders.length    && { label: `${overdueReminders.length} overdue service reminder${overdueReminders.length !== 1 ? 's' : ''}`, level: 'red', tab: 'assets' },
    dueSoonCompliance.length   && { label: `${dueSoonCompliance.length} compliance item${dueSoonCompliance.length !== 1 ? 's' : ''} due within 30 days`, level: 'amber', tab: 'compliance' },
    goalsAtRisk.length         && { label: `${goalsAtRisk.length} strategic goal${goalsAtRisk.length !== 1 ? 's' : ''} at risk`, level: 'amber', tab: 'goals' },
    urgentGrants.length        && { label: `${urgentGrants.length} grant deadline${urgentGrants.length !== 1 ? 's' : ''} within 14 days`, level: 'amber', tab: 'grants' },
    upcomingAutoTasks.length   && { label: `${upcomingAutoTasks.length} upcoming deadline${upcomingAutoTasks.length !== 1 ? 's' : ''} flagged — review before they become overdue`, level: 'amber', tab: 'tasks' },
    finOverBudgetCats.length   && { label: `${finOverBudgetCats.length} budget categor${finOverBudgetCats.length !== 1 ? 'ies' : 'y'} over limit — review finance`, level: 'amber', tab: 'finance' },
    pendingBookings.length     && { label: `${pendingBookings.length} booking${pendingBookings.length !== 1 ? 's' : ''} awaiting approval`, level: 'amber', tab: 'bookings' },
  ].filter(Boolean);

  const redAlerts   = ALERTS.filter(a => a.level === 'red');
  const amberAlerts = ALERTS.filter(a => a.level === 'amber');

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

  // ─── SMART INSIGHTS ────────────────────────────────────────────────────────

  const redInsights   = [];
  const amberInsights = [];
  const greenInsights = [];

  // RED — Emergency Preparedness first (highest priority)
  if (epUrgentCount > 0)
    redInsights.unshift(`🆘 Emergency Preparedness: ${epUrgentCount} item${epUrgentCount !== 1 ? 's' : ''} are overdue or not yet scheduled — marae may not be ready for a civil defence event`);

  if (overdueCompliance.length > 0)
    redInsights.push(`${overdueCompliance.length} compliance obligation${overdueCompliance.length !== 1 ? 's are' : ' is'} overdue — arrange renewals immediately (see Compliance panel)`);

  if (goalsBehind.length > 0)
    redInsights.push(`${goalsBehind.length} strategic goal${goalsBehind.length !== 1 ? 's are' : ' is'} behind schedule — review and update plans (see Strategic Goals panel)`);

  if (overdueTasks.length > 0)
    redInsights.push(`${overdueTasks.length} overdue task${overdueTasks.length !== 1 ? 's' : ''} — follow up with assignees immediately (see Tasks panel)`);

  const grantsUrgent = d.grants.filter(g => g.deadline && !['approved','declined'].includes(g.status) && new Date(g.deadline + 'T12:00:00') >= today && new Date(g.deadline + 'T12:00:00') <= in7);
  if (grantsUrgent.length > 0) {
    const minDays = Math.min(...grantsUrgent.map(g => Math.ceil((new Date(g.deadline + 'T12:00:00') - today) / (1000 * 60 * 60 * 24))));
    redInsights.push(`${grantsUrgent.length} grant deadline${grantsUrgent.length !== 1 ? 's' : ''} within ${minDays} day${minDays !== 1 ? 's' : ''} — action required today (see Grants panel)`);
  }

  if (overdueReminders.length > 0)
    redInsights.push(`${overdueReminders.length} asset service${overdueReminders.length !== 1 ? 's' : ''} are overdue — arrange maintenance now`);

  // AMBER
  if (upcomingAutoTasks.length > 0)
    amberInsights.push(`${upcomingAutoTasks.length} upcoming deadline${upcomingAutoTasks.length !== 1 ? 's' : ''} flagged across your modules — review and prepare before they become overdue`);

  const grantsSoon = d.grants.filter(g => g.deadline && !['approved','declined'].includes(g.status) && new Date(g.deadline + 'T12:00:00') > in7 && new Date(g.deadline + 'T12:00:00') <= in14);
  if (grantsSoon.length > 0) {
    const minDays = Math.min(...grantsSoon.map(g => Math.ceil((new Date(g.deadline + 'T12:00:00') - today) / (1000 * 60 * 60 * 24))));
    amberInsights.push(`${grantsSoon.length} grant deadline${grantsSoon.length !== 1 ? 's' : ''} within ${minDays}–14 days — begin preparation (see Grants panel)`);
  }

  const soonReminders = d.reminders.filter(r => r.due_date && new Date(r.due_date + 'T12:00:00') >= today && new Date(r.due_date + 'T12:00:00') <= in14);
  if (soonReminders.length > 0)
    amberInsights.push(`${soonReminders.length} service reminder${soonReminders.length !== 1 ? 's' : ''} due within 14 days — schedule maintenance soon`);

  if (dueSoonCompliance.length > 0)
    amberInsights.push(`${dueSoonCompliance.length} compliance item${dueSoonCompliance.length !== 1 ? 's' : ''} due within 30 days — schedule renewals soon`);

  if (goalsAtRisk.length > 0)
    amberInsights.push(`${goalsAtRisk.length} strategic goal${goalsAtRisk.length !== 1 ? 's are' : ' is'} at risk — review progress and remove blockers (see Strategic Goals panel)`);

  if (d.actions.length > 3)
    amberInsights.push(`${d.actions.length} open meeting actions outstanding — consider scheduling a follow-up session`);

  if (avgRating !== null && avgRating < 4)
    amberInsights.push(`Community rating is ${Number(avgRating).toFixed(1)}/5 — review recent feedback and identify areas for improvement`);

  if (periodProjects.length === 0)
    amberInsights.push(`No active projects this period — consider initiating planned work`);

  // GREEN (max 2)
  if (d.goals.length > 0 && goalsBehind.length === 0 && goalsAtRisk.length === 0)
    greenInsights.push(`All ${d.goals.length} strategic goal${d.goals.length !== 1 ? 's are' : ' is'} on track — excellent governance progress`);

  if (goalsComplete.length > 0 && d.goals.length > 0 && goalsComplete.length === d.goals.length)
    greenInsights.push(`All strategic goals completed — outstanding achievement for the committee`);

  if (avgRating !== null && avgRating >= 4.5)
    greenInsights.push(`Community satisfaction is strong at ${Number(avgRating).toFixed(1)}/5 — great work`);

  if (compliantPct === 100)
    greenInsights.push(`All assets are fully service-compliant`);

  if (d.compliance.length > 0 && overdueCompliance.length === 0 && dueSoonCompliance.length === 0)
    greenInsights.push(`All compliance obligations are up to date`);

  if (approvedGrantsAmt > 0)
    greenInsights.push(`${fmtMoney(approvedGrantsAmt)} in grants secured ${pl.toLowerCase()} — excellent funding progress`);

  const totalPeriodBookings = d.bookings.filter(b => inPeriod(b.start_date)).length;
  if (totalPeriodBookings > 0 && Math.round((periodBookings.length / totalPeriodBookings) * 100) >= 90)
    greenInsights.push(`${Math.round((periodBookings.length / totalPeriodBookings) * 100)}% of bookings this period have been approved`);

  const INSIGHTS = [
    ...redInsights.map(text => ({ text, level: 'red' })),
    ...amberInsights.map(text => ({ text, level: 'amber' })),
    ...greenInsights.slice(0, 1).map(text => ({ text, level: 'green' })),
  ].slice(0, 4);

  // ─── AI REPORT ─────────────────────────────────────────────────────────────

  // eslint-disable-next-line no-unused-vars
  async function generateReport() {
    setAiLoading(true);
    setAiError('');
    setAiReport('');

    const context = [
      `MARAE: ${d.maraeName}`,
      `DATE: ${new Date().toLocaleDateString('en-NZ')}`,
      `PERIOD: ${pl}`,
      ``,
      `ALERTS (${ALERTS.length}):`,
      ALERTS.length ? ALERTS.map(a => `- ${a.label}`).join('\n') : '- None',
      ``,
      `KPI SUMMARY:`,
      `- Bookings (${pl}): ${periodBookings.length}`,
      `- Avg Star Rating: ${avgRating ? Number(avgRating).toFixed(1) + '/5' : 'N/A'} from ${periodFeedbackScores.length} responses`,
      `- Active Projects: ${periodProjects.length}`,
      `- Open Meeting Actions: ${d.actions.length}`,
      `- Grants Secured: ${fmtMoney(approvedGrantsAmt)}`,
      `- Assets Compliant: ${compliantPct}%`,
      ``,
      `UPCOMING BOOKINGS (${periodUpcoming.length}):`,
      periodUpcoming.length
        ? periodUpcoming.map(b => `- ${b.occasion} on ${fmt(b.start_date)} (${b.guests} guests)`).join('\n')
        : '- None',
      ``,
      `ACTIVE PROJECTS (${periodProjects.length}):`,
      periodProjects.length
        ? periodProjects.map(p => `- ${p.name}: ${p.progress || 0}% complete, lead: ${p.lead || 'unassigned'}, due: ${fmt(p.due_date)}${p.due_date && new Date(p.due_date) < today ? ' [OVERDUE]' : ''}`).join('\n')
        : '- None',
      ``,
      `OPEN MEETING ACTIONS (${d.actions.length}):`,
      d.actions.length
        ? actionsSorted.map(a => `- ${a.description} (assigned: ${a.assigned_to || 'unassigned'}, due: ${fmt(a.due_date)}, status: ${a.status}${a.due_date && new Date(a.due_date + 'T12:00:00') < today ? ' [OVERDUE]' : ''})`).join('\n')
        : '- None',
      ``,
      `GRANTS PIPELINE (${periodPipeline.length}):`,
      periodPipeline.length
        ? periodPipeline.map(g => `- ${g.name} (${g.funder}, ${fmtMoney(g.amount)}, status: ${g.status}, deadline: ${fmt(g.deadline)})`).join('\n')
        : '- None',
      ``,
      `STRATEGIC GOALS (${d.goals.length}):`,
      `- On Track: ${goalsOnTrack.length} | At Risk: ${goalsAtRisk.length} | Behind: ${goalsBehind.length} | Completed: ${goalsComplete.length}`,
      d.goals.length
        ? d.goals.map(g => `- ${g.name} [${g.status.replace('_',' ')}] target: ${fmt(g.target_date)} ${g.responsible_name ? `responsible: ${g.responsible_name}` : ''}`).join('\n')
        : '- No goals set',
      ``,
      `SERVICE REMINDERS DUE (${upcomingReminders.length}):`,
      upcomingReminders.length
        ? upcomingReminders.map(r => `- ${assetMap[r.asset_id] || 'Asset'} — ${r.type}, due: ${fmt(r.due_date)}${new Date(r.due_date + 'T12:00:00') < today ? ' [OVERDUE]' : ''}`).join('\n')
        : '- None',
      ``,
      `COMMUNITY FEEDBACK:`,
      `- ${periodFeedbackScores.length} responses, avg ${avgRating ? Number(avgRating).toFixed(1) + '/5' : 'N/A'}`,
      periodComments.length
        ? periodComments.map(f => `- "${f.experience?.slice(0, 120)}"`).join('\n')
        : '- No comments this period',
    ].join('\n');

    try {
      const res = await fetch('/api/ai-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1500,
          system: `You are a governance advisor for a Māori community marae in Aotearoa New Zealand. Write clear, warm, and professional governance reports for marae trustees. Begin every report with "Tēnā koutou" on its own line. Use inclusive, community-focused language. Keep your tone respectful and solution-oriented. Structure the report with clear sections: an opening summary, what is performing well, what needs attention, and 3-5 specific recommendations in priority order. Use plain English — no jargon.`,
          messages: [{
            role: 'user',
            content: `Write a governance report for ${d.maraeName} based on the following board data. Cover what is performing well, what needs attention, and provide 3-5 specific recommendations in priority order.\n\n${context}`,
          }],
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setAiError(err.error || `Request failed (${res.status}). Check your API key in Vercel environment variables.`);
        setAiLoading(false);
        return;
      }

      const data = await res.json();
      const text = data.content?.[0]?.text || '';
      setAiReport(text);
      setShowReport(true);
    } catch (err) {
      setAiError('Could not reach AI service: ' + err.message);
    }
    setAiLoading(false);
  }

  function copyReport() {
    navigator.clipboard.writeText(aiReport).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

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
        <div className="no-print" style={{ display: 'flex', gap: 10 }}>
          {/* AI Report button — hidden for now, re-enable when ready
          <button
            onClick={generateReport}
            disabled={aiLoading}
            style={{ background: aiLoading ? '#a0a0a0' : '#5a3e8a', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: aiLoading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            {aiLoading ? '⏳ Generating…' : '✨ AI Report'}
          </button>
          */}
          <button
            onClick={() => window.print()}
            style={{ background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            🖨️ Print
          </button>
        </div>
      </div>

      {/* ── AI REPORT MODAL ────────────────────────────────────────────── */}
      {(showReport || aiError) && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 20px', overflowY: 'auto' }}>
          <div style={{ background: 'var(--surface)', borderRadius: 12, width: '100%', maxWidth: 720, padding: 32, position: 'relative', boxShadow: '0 8px 40px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, margin: 0, color: 'var(--brand)' }}>✨ AI Governance Report</h2>
              <div style={{ display: 'flex', gap: 8 }}>
                {aiReport && (
                  <button
                    onClick={copyReport}
                    style={{ background: copied ? '#e8f4ef' : 'var(--surface2)', color: copied ? 'var(--brand)' : 'var(--text2)', border: '1px solid var(--border)', borderRadius: 7, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                  >
                    {copied ? '✅ Copied' : '📋 Copy'}
                  </button>
                )}
                <button
                  onClick={() => { setShowReport(false); setAiError(''); setAiReport(''); }}
                  style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 7, padding: '6px 12px', fontSize: 13, cursor: 'pointer', color: 'var(--text2)', fontWeight: 600 }}
                >
                  ✕
                </button>
              </div>
            </div>
            {aiError ? (
              <div style={{ background: '#faeae7', border: '1px solid #f0b8b0', borderRadius: 8, padding: '14px 16px', color: 'var(--danger)', fontSize: 13 }}>{aiError}</div>
            ) : (
              <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--text1)', whiteSpace: 'pre-wrap' }}>{aiReport}</div>
            )}
          </div>
        </div>
      )}

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

      {/* ── SMART INSIGHTS ─────────────────────────────────────────────── */}
      {INSIGHTS.length > 0 && (
        <div className="panel" style={{ marginBottom: 20 }}>
          <SectionTitle icon="💡" title="Insights and Recommendations" count={INSIGHTS.length} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {INSIGHTS.map((ins, i) => {
              const s = {
                red:   { background: '#faeae7', border: '1px solid #f0b8b0', borderLeft: '4px solid var(--danger)',  color: 'var(--danger)' },
                amber: { background: '#fdf0dc', border: '1px solid #e8c880', borderLeft: '4px solid var(--warning)', color: '#7a4f00' },
                green: { background: '#e8f4ef', border: '1px solid #a8d8c0', borderLeft: '4px solid var(--brand)',   color: '#1a4a3a' },
              }[ins.level];
              const icon = ins.level === 'red' ? '🔴' : ins.level === 'amber' ? '🟡' : '🟢';
              return (
                <div key={i} style={{ borderRadius: 7, padding: '9px 14px', fontSize: 13, fontWeight: 500, lineHeight: 1.5, display: 'flex', alignItems: 'flex-start', gap: 8, ...s }}>
                  <span style={{ flexShrink: 0, marginTop: 1 }}>{icon}</span>
                  {ins.text}
                </div>
              );
            })}
          </div>
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

      {/* ── GOALS & COMPLIANCE ROW ─────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>

        {/* ── STRATEGIC GOALS SUMMARY ────────────────────────────────── */}
        <div className="panel">
          <SectionTitle icon="🎯" title="Strategic Goals" count={d.goals.length} />
          {d.goals.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text3)', fontStyle: 'italic' }}>No strategic goals set — add goals in the Goals tab</div>
          ) : (
            <>
              {/* Status summary pills */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 14 }}>
                {[
                  { label: 'On Track',    count: goalsOnTrack.length,  dot: '#2e7d52', bg: '#e8f4ef', color: '#1a4a3a' },
                  { label: 'At Risk',     count: goalsAtRisk.length,   dot: '#c8902a', bg: '#fdf0dc', color: '#7a4f00' },
                  { label: 'Behind',      count: goalsBehind.length,   dot: '#d9534f', bg: '#faeae7', color: '#a63020' },
                  { label: 'Completed',   count: goalsComplete.length, dot: '#6b42a8', bg: '#f0ecf8', color: '#6b42a8' },
                ].map(s => (
                  <div key={s.label} style={{ textAlign: 'center', padding: '8px 4px', background: s.bg, borderRadius: 8, borderTop: `3px solid ${s.dot}` }}>
                    <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.count}</div>
                    <div style={{ fontSize: 10, color: s.color, fontWeight: 600, marginTop: 3 }}>{s.label}</div>
                  </div>
                ))}
              </div>
              {/* At-risk and behind goals list */}
              {[...goalsBehind, ...goalsAtRisk].length === 0 ? (
                <div style={{ fontSize: 12, color: '#1a4a3a', background: '#e8f4ef', borderRadius: 7, padding: '8px 12px', fontWeight: 500 }}>
                  ✅ All goals are on track or completed
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[...goalsBehind, ...goalsAtRisk].map(g => {
                    const light = goalLight(g);
                    const dot   = light === 'red' ? '#d9534f' : '#c8902a';
                    const bg    = light === 'red' ? '#faeae7' : '#fdf0dc';
                    const label = light === 'red' ? 'Behind' : 'At Risk';
                    return (
                      <div key={g.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 10px', background: bg, borderRadius: 7, borderLeft: `3px solid ${dot}` }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: dot, flexShrink: 0, marginTop: 4 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                            {g.responsible_name && `👤 ${g.responsible_name}`}
                            {g.responsible_name && g.target_date && ' · '}
                            {g.target_date && `Target: ${fmt(g.target_date)}`}
                          </div>
                        </div>
                        <span style={{ fontSize: 10, background: 'rgba(255,255,255,0.7)', color: dot, borderRadius: 20, padding: '2px 8px', fontWeight: 700, flexShrink: 0 }}>{label}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* ── COMPLIANCE TRACKER ─────────────────────────────────────── */}
        <div className="panel">
          <SectionTitle icon="✅" title="Compliance Tracker" count={d.compliance.length} />
          {d.compliance.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text3)', fontStyle: 'italic' }}>No compliance items set up — add items in the Compliance tab</div>
          ) : (
            <>
              {/* Status summary */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
                {[
                  { label: 'Overdue',   count: overdueCompliance.length,  dot: '#d9534f', bg: '#faeae7', color: '#a63020' },
                  { label: 'Due Soon',  count: dueSoonCompliance.length,  dot: '#c8902a', bg: '#fdf0dc', color: '#7a4f00' },
                  { label: 'Compliant', count: d.compliance.length - overdueCompliance.length - dueSoonCompliance.length, dot: '#2e7d52', bg: '#e8f4ef', color: '#1a4a3a' },
                ].map(s => (
                  <div key={s.label} style={{ textAlign: 'center', padding: '8px 4px', background: s.bg, borderRadius: 8, borderTop: `3px solid ${s.dot}` }}>
                    <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.count}</div>
                    <div style={{ fontSize: 10, color: s.color, fontWeight: 600, marginTop: 3 }}>{s.label}</div>
                  </div>
                ))}
              </div>
              {/* Overdue and due-soon items */}
              {[...overdueCompliance, ...dueSoonCompliance].length === 0 ? (
                <div style={{ fontSize: 12, color: '#1a4a3a', background: '#e8f4ef', borderRadius: 7, padding: '8px 12px', fontWeight: 500 }}>
                  ✅ All compliance obligations are up to date
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[...overdueCompliance, ...dueSoonCompliance].map(c => {
                    const overdue = new Date(c.due_date + 'T12:00:00') < today;
                    const dot   = overdue ? '#d9534f' : '#c8902a';
                    const bg    = overdue ? '#faeae7' : '#fdf0dc';
                    const daysLeft = Math.ceil((new Date(c.due_date + 'T12:00:00') - today) / 86400000);
                    return (
                      <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', background: bg, borderRadius: 7, borderLeft: `3px solid ${dot}`, gap: 8 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                          <div style={{ fontSize: 11, color: overdue ? dot : 'var(--text3)', marginTop: 1 }}>
                            {overdue ? `${Math.abs(daysLeft)}d overdue` : daysLeft === 0 ? 'Due today' : `Due in ${daysLeft}d`} · {fmt(c.due_date)}
                          </div>
                        </div>
                        <span style={{ fontSize: 10, background: 'rgba(255,255,255,0.7)', color: dot, borderRadius: 20, padding: '2px 8px', fontWeight: 700, flexShrink: 0 }}>
                          {overdue ? 'Overdue' : 'Due Soon'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
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

      {/* ── OPEN TASKS BY SOURCE ───────────────────────────────────────── */}
      {d.tasks.length > 0 && (() => {
        const todayTs = new Date(); todayTs.setHours(0, 0, 0, 0);
        const groups = {};
        TASK_SOURCES.forEach(s => { groups[s.prefix] = []; });
        const manual = [];
        d.tasks.forEach(t => {
          const src = taskSource(t.title);
          if (src) groups[src.prefix].push(t);
          else manual.push(t);
        });
        const activeSources = TASK_SOURCES.filter(s => groups[s.prefix].length > 0);
        if (activeSources.length === 0 && manual.length === 0) return null;
        const allGroups = [
          ...activeSources.map(s => ({ ...s, tasks: groups[s.prefix] })),
          ...(manual.length > 0 ? [{ prefix: '__manual', label: 'Manual', icon: '✏️', tab: 'tasks', tasks: manual }] : []),
        ];
        return (
          <div className="panel" style={{ marginBottom: 20 }}>
            <SectionTitle icon="📋" title="Open Tasks — by Source" count={d.tasks.length} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {allGroups.map(grp => (
                <div key={grp.prefix} style={{ background: 'var(--surface2)', borderRadius: 8, padding: '10px 12px', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontSize: 14 }}>{grp.icon}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)' }}>{grp.label}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, background: 'var(--brand)', color: '#fff', borderRadius: 10, padding: '1px 7px' }}>{grp.tasks.length}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {grp.tasks.slice(0, 5).map(t => {
                      const overdue = t.due_date && new Date(t.due_date + 'T12:00:00') < todayTs;
                      const displayTitle = grp.prefix !== '__manual' ? t.title.slice(grp.prefix.length) : t.title;
                      return (
                        <div key={t.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                          <span style={{ fontSize: 10, marginTop: 3, color: overdue ? 'var(--danger)' : 'var(--warning)', flexShrink: 0 }}>●</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 11, color: overdue ? 'var(--danger)' : 'var(--text1)', fontWeight: overdue ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={displayTitle}>{displayTitle}</div>
                            {t.due_date && <div style={{ fontSize: 10, color: overdue ? 'var(--danger)' : 'var(--text3)' }}>{overdue ? 'Overdue · ' : 'Due · '}{fmt(t.due_date)}</div>}
                          </div>
                        </div>
                      );
                    })}
                    {grp.tasks.length > 5 && <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>+{grp.tasks.length - 5} more</div>}
                  </div>
                  {onNavigate && (
                    <button onClick={() => onNavigate('tasks')} style={{ marginTop: 8, fontSize: 10, color: 'var(--brand)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: 0 }}>
                      View in Tasks →
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })()}

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

      {/* ── FINANCIAL HEALTH ───────────────────────────────────────────── */}
      <div className="panel" style={{ marginBottom: 20 }}>
        <SectionTitle icon="📊" title="Financial Health" note={`(FY ${fyLabelStr})`} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: finOverBudgetCats.length > 0 ? 14 : 0 }}>
          {[
            { label: 'Total Income', value: `$${(finTotalIncome/1000).toFixed(1)}k`, icon: '💵', bg: '#e8f4ef', color: 'var(--brand)' },
            { label: 'Total Expenses', value: `$${(finTotalExpenses/1000).toFixed(1)}k`, icon: '📤', bg: '#faeae7', color: finTotalExpenses > finTotalIncome ? 'var(--danger)' : 'var(--text1)' },
            { label: finNet >= 0 ? 'Net Surplus' : 'Net Deficit', value: `$${(Math.abs(finNet)/1000).toFixed(1)}k`, icon: finNet >= 0 ? '✅' : '⚠️', bg: finNet >= 0 ? '#e8f4ef' : '#faeae7', color: finNet >= 0 ? 'var(--brand)' : 'var(--danger)' },
          ].map((t, i) => (
            <div key={i} style={{ textAlign: 'center', padding: '12px 8px', background: t.bg, borderRadius: 8 }}>
              <div style={{ fontSize: 16, marginBottom: 4 }}>{t.icon}</div>
              <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, fontWeight: 700, color: t.color }}>{t.value}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{t.label}</div>
            </div>
          ))}
        </div>
        {finOverBudgetCats.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {finOverBudgetCats.map(cat => (
              <span key={cat} onClick={() => onNavigate && onNavigate('finance')} style={{ fontSize: 11, fontWeight: 600, background: '#faeae7', color: 'var(--danger)', border: '1px solid #f0b8b0', borderRadius: 20, padding: '3px 10px', cursor: onNavigate ? 'pointer' : 'default' }}>
                🔴 Over budget — {cat}
              </span>
            ))}
          </div>
        ) : (
          finTotalIncome > 0 || finTotalExpenses > 0 ? (
            <div style={{ fontSize: 12, color: '#1a4a3a', background: '#e8f4ef', borderRadius: 7, padding: '7px 12px', fontWeight: 500 }}>
              ✅ All budget categories within limits
            </div>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--text3)', fontStyle: 'italic' }}>No finance data recorded for this financial year — add income and expenses in the Finance tab</div>
          )
        )}
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
