import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { fetchXeroFinancials } from '../lib/xero';
import Header from '../components/Header';
import BookingsManager from '../components/BookingsManager';
import ProjectsManager from '../components/ProjectsManager';
import AssetsManager from '../components/AssetsManager';
import DocumentsManager from '../components/DocumentsManager';
import NoticeboardManager from '../components/NoticeboardManager';
import CommitteeMinutes from '../components/CommitteeMinutes';
import CalendarView from '../components/CalendarView';
import MaraeSettings from '../components/MaraeSettings';
import GrantsTracker from '../components/GrantsTracker';
import FinanceManager from '../components/FinanceManager';
import ContactsManager from '../components/ContactsManager';
import ComplianceTracker from '../components/ComplianceTracker';
import EmergencyPlanManager from '../components/EmergencyPlanManager';
import RiskRegister from '../components/RiskRegister';
import GoalsReporting from '../components/GoalsReporting';
import BoardDashboard from '../components/BoardDashboard';
import TaskBoard from '../components/TaskBoard';
import FeedbackButton from '../components/FeedbackButton';
import UxPulsePrompt from '../components/UxPulsePrompt';
import HelpMenu from '../components/HelpMenu';
import WorkflowEngine from '../components/WorkflowEngine';
import WhatsNew from '../components/WhatsNew';
import OnboardingFlow from '../components/OnboardingFlow';
import GettingStartedChecklist from '../components/GettingStartedChecklist';

const NAV_GROUPS = [
  {
    label: 'Governance', icon: '🛡️',
    tabs: [
      { key: 'board',   label: 'Board View' },
      { key: 'minutes', label: 'Minutes' },
      { key: 'goals',   label: 'Goals' },
    ],
  },
  {
    label: 'Operations', icon: '⚙️',
    tabs: [
      { key: 'bookings',    label: 'Bookings' },
      { key: 'calendar',    label: 'Calendar' },
      { key: 'noticeboard', label: 'Notices' },
      { key: 'contacts',    label: 'Contacts' },
      { key: 'workflows',   label: 'Workflows' },
    ],
  },
  {
    label: 'Assets & Compliance', icon: '🏛️',
    tabs: [
      { key: 'assets',         label: 'Assets' },
      { key: 'compliance',     label: 'Compliance' },
      { key: 'risks',          label: 'Risk Register' },
      { key: 'emergency_plan', label: 'Emergency Plan' },
    ],
  },
  {
    label: 'Funding & Projects', icon: '💰',
    tabs: [
      { key: 'grants',   label: 'Grants' },
      { key: 'projects', label: 'Projects' },
      { key: 'tasks',    label: 'Tasks' },
      { key: 'finance',  label: 'Finance' },
    ],
  },
  {
    label: 'Admin', icon: '📁',
    tabs: [
      { key: 'documents', label: 'Documents' },
      { key: 'settings',  label: 'Settings' },
    ],
  },
];

function fmtMoney(n) {
  if (!n) return '$0';
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}k`;
  return `$${n}`;
}

// ─── KPI BAR ──────────────────────────────────────────────────────────────────

function KpiBar({ tiles, loading, count }) {
  const n = loading ? (count || 5) : tiles.length;

  if (loading) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${n}, 1fr)`, gap: 12, marginBottom: 20 }}>
        {Array.from({ length: n }).map((_, i) => (
          <div key={i} className="panel" style={{ height: 92, background: 'var(--surface2)', opacity: 0.5 }} />
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${tiles.length}, 1fr)`, gap: 12, marginBottom: 20 }}>
      {tiles.map((t, i) => {
        const isText = typeof t.value === 'string' && isNaN(parseFloat(t.value.replace('%', '')));
        const valLen = String(t.value).length;
        const fontSize = isText
          ? (valLen > 12 ? 10 : valLen > 8 ? 12 : valLen > 5 ? 14 : 18)
          : 22;
        return (
          <div key={i} className="panel" style={{ textAlign: 'center', padding: '14px 10px' }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: t.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, margin: '0 auto 8px' }}>
              {t.icon}
            </div>
            <div style={{
              fontFamily: isText ? 'DM Sans, sans-serif' : 'Playfair Display, serif',
              fontSize,
              fontWeight: 600,
              color: t.valueColor || 'var(--text1)',
              lineHeight: 1.2,
              marginBottom: 4,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {t.value}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 500, lineHeight: 1.3 }}>
              {t.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function TrusteeDashboard({ profile, onLogout }) {
  const isAdmin = profile?.trustee_role === 'admin';
  // Finance hidden from standard trustees (86d3uy01x) -- matches the
  // RLS/fetchAll restriction in BoardDashboard.js. The render guard below is
  // the real defense-in-depth boundary (a non-admin's activeTab could still
  // technically reach 'finance', e.g. via the ?tab= deep-link, which this
  // filter alone doesn't block); this filter just keeps the nav itself honest.
  const visibleNavGroups = isAdmin
    ? NAV_GROUPS
    : NAV_GROUPS.map(g => ({ ...g, tabs: g.tabs.filter(t => t.key !== 'finance') })).filter(g => g.tabs.length > 0);
  const [activeTab, setActiveTab] = useState('board');
  const [pendingWorkflow, setPendingWorkflow] = useState(null);
  const [pendingRisk, setPendingRisk] = useState(null);
  const [boardKey, setBoardKey] = useState(0);

  function handleStartWorkflow(suggestion) {
    setPendingWorkflow(suggestion);
    setActiveTab('workflows');
  }

  function handleCreateRisk(suggestion) {
    setPendingRisk(suggestion);
    setActiveTab('risks');
  }

  // Per-tab KPI state
  const [kpis, setKpis] = useState({});
  const [kpiLoading, setKpiLoading] = useState({});
  const [xeroConnected, setXeroConnected] = useState(false);

  useEffect(() => {
    // Deep-link support (?tab=settings) for links sent from outside the app,
    // e.g. "Manage your email preferences" in notify-trustees emails.
    // General-purpose, not hardcoded to settings -- validated against the
    // real, current tab keys so a stale/garbage param can't set activeTab
    // to something nothing renders for.
    const validKeys = NAV_GROUPS.flatMap(g => g.tabs.map(t => t.key));
    const requestedTab = new URLSearchParams(window.location.search).get('tab');
    if (requestedTab && validKeys.includes(requestedTab)) setActiveTab(requestedTab);
  }, []);

  useEffect(() => {
    const handler = (e) => setActiveTab(e.detail);
    window.addEventListener('marae:navigate', handler);
    return () => window.removeEventListener('marae:navigate', handler);
  }, []);

  useEffect(() => {
    fetchTabKpis(activeTab);
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── TAB KPI FETCHES ────────────────────────────────────────────────────────

  async function fetchTabKpis(tab) {
    setKpiLoading(prev => ({ ...prev, [tab]: true }));
    let tiles = [];

    if (tab === 'bookings') {
      const { data } = await supabase.from('bookings').select('status, guests, occasion');
      const rows = data || [];
      const total = rows.length;
      const approved = rows.filter(b => b.status === 'approved').length;
      const pending = rows.filter(b => b.status === 'pending').length;
      const decided = rows.filter(b => b.status !== 'pending').length;
      const approvalRate = decided > 0 ? Math.round((approved / decided) * 100) : 0;
      const avgGuests = total > 0 ? Math.round(rows.reduce((s, b) => s + (b.guests || 0), 0) / total) : 0;
      const occMap = {};
      rows.forEach(b => { if (b.occasion) occMap[b.occasion] = (occMap[b.occasion] || 0) + 1; });
      const busiest = Object.entries(occMap).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
      const busiestLabel = busiest.length > 13 ? busiest.slice(0, 13) + '…' : busiest;

      tiles = [
        { label: 'Total Bookings', value: total, icon: '📅', bg: '#e8eef8' },
        {
          label: 'Approval Rate', value: decided > 0 ? `${approvalRate}%` : '—', icon: '✅', bg: '#e8f4ef',
          valueColor: approvalRate >= 70 ? 'var(--brand)' : approvalRate >= 40 ? 'var(--warning)' : 'var(--danger)',
        },
        {
          label: 'Pending', value: pending, icon: '⏳',
          bg: pending > 0 ? '#fdf0dc' : '#f5f5f5',
          valueColor: pending > 0 ? 'var(--warning)' : 'var(--text3)',
        },
        { label: 'Avg Guests', value: avgGuests || '—', icon: '👥', bg: '#f0ecf8' },
        { label: 'Top Occasion', value: busiestLabel, icon: '🎉', bg: '#fdf4e8' },
      ];
    }

    if (tab === 'projects') {
      const { data } = await supabase.from('projects').select('status, progress, due_date');
      const rows = data || [];
      const total = rows.length;
      const completed = rows.filter(p => p.status === 'completed').length;
      const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
      const now = new Date(); now.setHours(0, 0, 0, 0);
      const overdue = rows.filter(p => p.due_date && new Date(p.due_date) < now && p.status !== 'completed').length;
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const dueThisMonth = rows.filter(p => {
        if (!p.due_date || p.status === 'completed') return false;
        const d = new Date(p.due_date);
        return d >= firstOfMonth && d <= lastOfMonth;
      }).length;
      const avgProgressVal = total > 0 ? Math.round(rows.reduce((s, p) => s + (p.progress || 0), 0) / total) : 0;

      tiles = [
        { label: 'Total Projects', value: total, icon: '📋', bg: '#e8eef8' },
        {
          label: 'Completion Rate', value: total > 0 ? `${completionRate}%` : '—', icon: '🏁', bg: '#e8f4ef',
          valueColor: completionRate >= 50 ? 'var(--brand)' : 'var(--text2)',
        },
        {
          label: 'Overdue', value: overdue, icon: '⚠️',
          bg: overdue > 0 ? '#faeae7' : '#f5f5f5',
          valueColor: overdue > 0 ? 'var(--danger)' : 'var(--text3)',
        },
        {
          label: 'Due This Month', value: dueThisMonth, icon: '📆',
          bg: dueThisMonth > 0 ? '#fdf0dc' : '#f5f5f5',
          valueColor: dueThisMonth > 0 ? 'var(--warning)' : 'var(--text3)',
        },
        { label: 'Avg Progress', value: total > 0 ? `${avgProgressVal}%` : '—', icon: '📊', bg: '#f0ecf8' },
      ];
    }

    if (tab === 'assets') {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const in30 = new Date(today); in30.setDate(in30.getDate() + 30);
      const [assetRes, reminderRes] = await Promise.all([
        supabase.from('assets').select('id, condition'),
        supabase.from('service_reminders').select('asset_id, due_date'),
      ]);
      const assets = assetRes.data || [];
      const reminders = reminderRes.data || [];
      const total = assets.length;
      const poor = assets.filter(a => a.condition === 'poor').length;
      const overdueReminders = reminders.filter(r => new Date(r.due_date + 'T12:00:00') < today).length;
      const dueSoon = reminders.filter(r => {
        const d = new Date(r.due_date + 'T12:00:00');
        return d >= today && d <= in30;
      }).length;
      const assetsWithOverdue = new Set(
        reminders.filter(r => new Date(r.due_date + 'T12:00:00') < today).map(r => r.asset_id)
      );
      const complianceRate = total > 0 ? Math.round(((total - assetsWithOverdue.size) / total) * 100) : 100;

      tiles = [
        { label: 'Total Assets', value: total, icon: '🏗️', bg: '#e8eef8' },
        {
          label: 'Poor Condition', value: poor, icon: '⚠️',
          bg: poor > 0 ? '#faeae7' : '#f5f5f5',
          valueColor: poor > 0 ? 'var(--danger)' : 'var(--text3)',
        },
        {
          label: 'Overdue Services', value: overdueReminders, icon: '🔴',
          bg: overdueReminders > 0 ? '#faeae7' : '#f5f5f5',
          valueColor: overdueReminders > 0 ? 'var(--danger)' : 'var(--text3)',
        },
        {
          label: 'Due in 30 Days', value: dueSoon, icon: '🔔',
          bg: dueSoon > 0 ? '#fdf0dc' : '#f5f5f5',
          valueColor: dueSoon > 0 ? 'var(--warning)' : 'var(--text3)',
        },
        {
          label: 'Compliance', value: `${complianceRate}%`, icon: '🛡️', bg: '#e8f4ef',
          valueColor: complianceRate >= 80 ? 'var(--brand)' : complianceRate >= 60 ? 'var(--warning)' : 'var(--danger)',
        },
      ];
    }

    if (tab === 'grants') {
      const { data } = await supabase.from('grants').select('status, amount, deadline');
      const rows = data || [];
      const total = rows.length;
      const approvedRows = rows.filter(g => g.status === 'approved');
      const approvedTotal = approvedRows.reduce((s, g) => s + (g.amount || 0), 0);
      const decided = rows.filter(g => ['approved', 'declined'].includes(g.status)).length;
      const successRate = decided > 0 ? Math.round((approvedRows.length / decided) * 100) : 0;
      const active = rows.filter(g => ['researching', 'in-progress', 'submitted'].includes(g.status)).length;
      const today = new Date();
      const in14 = new Date(today); in14.setDate(in14.getDate() + 14);
      const urgentDeadlines = rows.filter(g => {
        if (!g.deadline || ['approved', 'declined'].includes(g.status)) return false;
        const d = new Date(g.deadline);
        return d >= today && d <= in14;
      }).length;

      tiles = [
        { label: 'Total Grants', value: total, icon: '💰', bg: '#e8eef8' },
        { label: 'Approved Funding', value: fmtMoney(approvedTotal), icon: '✅', bg: '#e8f4ef', valueColor: 'var(--brand)' },
        {
          label: 'Success Rate', value: decided > 0 ? `${successRate}%` : '—', icon: '🏆',
          bg: successRate >= 50 ? '#e8f4ef' : '#f5f5f5',
          valueColor: successRate >= 50 ? 'var(--brand)' : 'var(--text3)',
        },
        {
          label: 'Active Applications', value: active, icon: '📝', bg: '#f0ecf8',
          valueColor: active > 0 ? '#6b42a8' : 'var(--text3)',
        },
        {
          label: 'Urgent Deadlines', value: urgentDeadlines, icon: '🔔',
          bg: urgentDeadlines > 0 ? '#fdf0dc' : '#f5f5f5',
          valueColor: urgentDeadlines > 0 ? 'var(--warning)' : 'var(--text3)',
        },
      ];
    }

    if (tab === 'tasks') {
      const { data } = await supabase.from('tasks').select('status, due_date, completed_at');
      const rows = data || [];
      const total = rows.length;
      const open = rows.filter(t => t.status === 'open').length;
      const now = new Date(); now.setHours(0, 0, 0, 0);
      const overdue = rows.filter(t => {
        if (!t.due_date || ['completed', 'cancelled'].includes(t.status)) return false;
        return new Date(t.due_date + 'T12:00:00') < now;
      }).length;
      const todayStr = new Date().toDateString();
      const completedToday = rows.filter(t =>
        t.status === 'completed' && t.completed_at &&
        new Date(t.completed_at).toDateString() === todayStr
      ).length;

      tiles = [
        { label: 'Total Tasks', value: total, icon: '📋', bg: '#e8eef8' },
        {
          label: 'Open', value: open, icon: '📂',
          bg: open > 0 ? '#fdf0dc' : '#f5f5f5',
          valueColor: open > 0 ? 'var(--warning)' : 'var(--text3)',
        },
        {
          label: 'Overdue', value: overdue, icon: '⚠️',
          bg: overdue > 0 ? '#faeae7' : '#f5f5f5',
          valueColor: overdue > 0 ? 'var(--danger)' : 'var(--text3)',
        },
        {
          label: 'Completed Today', value: completedToday, icon: '✅',
          bg: '#e8f4ef',
          valueColor: completedToday > 0 ? 'var(--success)' : 'var(--text3)',
        },
      ];
    }

    if (tab === 'finance') {
      const xero = await fetchXeroFinancials();
      setXeroConnected(xero.status === 'connected');

      if (xero.status !== 'connected') {
        const now = new Date();
        const fyYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
        const fyFrom = `${fyYear}-04-01`;
        const fyTo   = `${fyYear + 1}-03-31`;
        const [incRes, expRes, budRes] = await Promise.all([
          supabase.from('finance_income').select('amount').gte('date', fyFrom).lte('date', fyTo),
          supabase.from('finance_expenses').select('amount, category').gte('date', fyFrom).lte('date', fyTo),
          supabase.from('finance_budgets').select('category, amount').eq('financial_year', fyYear),
        ]);
        const totalIncome   = (incRes.data || []).reduce((s, r) => s + parseFloat(r.amount || 0), 0);
        const totalExpenses = (expRes.data || []).reduce((s, r) => s + parseFloat(r.amount || 0), 0);
        const net = totalIncome - totalExpenses;
        const budgetMap = {};
        (budRes.data || []).forEach(b => { budgetMap[b.category] = parseFloat(b.amount || 0); });
        const spentMap = {};
        (expRes.data || []).forEach(e => { spentMap[e.category] = (spentMap[e.category] || 0) + parseFloat(e.amount || 0); });
        const overBudget = Object.entries(budgetMap).filter(([cat, bud]) => bud > 0 && (spentMap[cat] || 0) > bud).length;
        const fyLabel = `${fyYear}/${String(fyYear + 1).slice(2)}`;
        tiles = [
          { label: `Income — FY ${fyLabel}`, value: `$${(totalIncome/1000).toFixed(1)}k`, icon: '💵', bg: '#e8f4ef', valueColor: 'var(--brand)' },
          { label: `Expenses — FY ${fyLabel}`, value: `$${(totalExpenses/1000).toFixed(1)}k`, icon: '📤', bg: '#faeae7', valueColor: totalExpenses > totalIncome ? 'var(--danger)' : 'var(--text1)' },
          { label: net >= 0 ? 'Net Surplus' : 'Net Deficit', value: `$${(Math.abs(net)/1000).toFixed(1)}k`, icon: net >= 0 ? '✅' : '⚠️', bg: net >= 0 ? '#e8f4ef' : '#faeae7', valueColor: net >= 0 ? 'var(--brand)' : 'var(--danger)' },
          { label: 'Over Budget', value: overBudget, icon: '📊', bg: overBudget > 0 ? '#faeae7' : '#f5f5f5', valueColor: overBudget > 0 ? 'var(--danger)' : 'var(--text3)' },
        ];
      }
    }

    if (tab === 'minutes') {
      const [meetRes, resRes, actRes] = await Promise.all([
        supabase.from('meetings').select('id'),
        supabase.from('resolutions').select('status'),
        supabase.from('meeting_actions').select('status, due_date'),
      ]);
      const meetings = meetRes.data || [];
      const resolutions = resRes.data || [];
      const actions = actRes.data || [];
      const totalMeetings = meetings.length;
      const openRes = resolutions.filter(r => !['Completed', 'Cancelled'].includes(r.status)).length;
      const openActs = actions.filter(a => a.status !== 'Completed').length;
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const overdueActs = actions.filter(a => a.due_date && new Date(a.due_date) < today && a.status !== 'Completed').length;

      tiles = [
        { label: 'Total Meetings', value: totalMeetings, icon: '📋', bg: '#e8eef8' },
        {
          label: 'Open Resolutions', value: openRes, icon: '📜',
          bg: openRes > 0 ? '#fdf0dc' : '#f5f5f5',
          valueColor: openRes > 0 ? 'var(--warning)' : 'var(--text3)',
        },
        {
          label: 'Open Actions', value: openActs, icon: '✅',
          bg: openActs > 0 ? '#fdf0dc' : '#e8f4ef',
          valueColor: openActs > 0 ? 'var(--warning)' : 'var(--brand)',
        },
        {
          label: 'Overdue Actions', value: overdueActs, icon: '⚠️',
          bg: overdueActs > 0 ? '#faeae7' : '#f5f5f5',
          valueColor: overdueActs > 0 ? 'var(--danger)' : 'var(--text3)',
        },
      ];
    }

    if (tab === 'compliance') {
      const { data } = await supabase.from('compliance_items').select('due_date');
      const rows = data || [];
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const in30 = new Date(today); in30.setDate(in30.getDate() + 30);
      const overdue  = rows.filter(r => r.due_date && new Date(r.due_date + 'T12:00:00') < today).length;
      const dueSoon  = rows.filter(r => r.due_date && new Date(r.due_date + 'T12:00:00') >= today && new Date(r.due_date + 'T12:00:00') <= in30).length;
      const compliant = rows.filter(r => r.due_date && new Date(r.due_date + 'T12:00:00') > in30).length;
      tiles = [
        { label: 'Overdue',   value: overdue,   icon: '🔴', bg: overdue  > 0 ? '#faeae7' : '#f5f5f5', valueColor: overdue  > 0 ? 'var(--danger)'  : 'var(--text3)' },
        { label: 'Due Soon',  value: dueSoon,   icon: '🟡', bg: dueSoon  > 0 ? '#fdf0dc' : '#f5f5f5', valueColor: dueSoon  > 0 ? 'var(--warning)' : 'var(--text3)' },
        { label: 'Compliant', value: compliant, icon: '🟢', bg: '#e8f4ef', valueColor: 'var(--brand)' },
        { label: 'Total Items', value: rows.length, icon: '📋', bg: '#f5f0e8' },
      ];
    }

    if (tab === 'risks') {
      const { data } = await supabase.from('risk_register').select('risk_rating, status');
      const rows = data || [];
      const total       = rows.length;
      const highRated   = rows.filter(r => r.risk_rating === 'High').length;
      const open        = rows.filter(r => r.status === 'Open').length;
      const beingManaged = rows.filter(r => r.status === 'Being Managed').length;
      tiles = [
        { label: 'Total Risks',    value: total,        icon: '🛡️', bg: '#e8eef8' },
        { label: 'High Rated',     value: highRated,    icon: '⚠️', bg: highRated > 0 ? '#faeae7' : '#f5f5f5', valueColor: highRated > 0 ? 'var(--danger)' : 'var(--text3)' },
        { label: 'Open',           value: open,         icon: '🔴', bg: open > 0 ? '#fdf0dc' : '#f5f5f5',     valueColor: open > 0 ? 'var(--warning)' : 'var(--text3)' },
        { label: 'Being Managed',  value: beingManaged, icon: '🟡', bg: '#fdf4e8', valueColor: '#7a4f00' },
      ];
    }

    if (tab === 'goals') {
      const { data } = await supabase.from('goals').select('status, target_date');
      const rows = data || [];
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const in14 = new Date(today); in14.setDate(in14.getDate() + 14);
      const total = rows.length;
      const completed = rows.filter(r => r.status === 'completed').length;
      const atRisk = rows.filter(r => r.status === 'at_risk').length;
      const behind = rows.filter(r => {
        if (['completed'].includes(r.status)) return false;
        if (!r.target_date) return false;
        return new Date(r.target_date + 'T12:00:00') < today;
      }).length;
      const onTrack = rows.filter(r => {
        if (r.status === 'completed') return true;
        if (r.status === 'at_risk') return false;
        const t = r.target_date ? new Date(r.target_date + 'T12:00:00') : null;
        if (t && t < today) return false;
        if (t && t <= in14) return false;
        return true;
      }).length;
      tiles = [
        { label: 'Total Goals',  value: total,     icon: '🎯', bg: '#e8eef8' },
        { label: 'On Track',     value: onTrack,   icon: '🟢', bg: '#e8f4ef',  valueColor: 'var(--brand)' },
        { label: 'At Risk',      value: atRisk,    icon: '🟡', bg: atRisk > 0 ? '#fdf0dc' : '#f5f5f5', valueColor: atRisk > 0 ? 'var(--warning)' : 'var(--text3)' },
        { label: 'Behind',       value: behind,    icon: '🔴', bg: behind > 0 ? '#faeae7' : '#f5f5f5', valueColor: behind > 0 ? 'var(--danger)' : 'var(--text3)' },
        { label: 'Completed',    value: completed, icon: '✅', bg: '#f0ecf8',  valueColor: completed > 0 ? '#6b42a8' : 'var(--text3)' },
      ];
    }

    setKpis(prev => ({ ...prev, [tab]: tiles }));
    setKpiLoading(prev => ({ ...prev, [tab]: false }));
  }

  // ── RENDER ─────────────────────────────────────────────────────────────────

  return (
    <div>
      <Header profile={profile} onLogout={onLogout} activeTab={activeTab} setActiveTab={setActiveTab} groups={visibleNavGroups} />

      <div className="main">

        {/* ── BOARD VIEW ─────────────────────────────────────────────────── */}
        {activeTab === 'board' && (
          <>
            {isAdmin && <OnboardingFlow onComplete={() => setBoardKey(k => k + 1)} />}
            {isAdmin && <GettingStartedChecklist onNavigate={setActiveTab} />}
            <BoardDashboard key={boardKey} onNavigate={setActiveTab} onStartWorkflow={handleStartWorkflow} isAdmin={isAdmin} />
          </>
        )}

        {/* ── BOOKINGS ───────────────────────────────────────────────────── */}
        {activeTab === 'bookings' && (
          <>
            <KpiBar tiles={kpis.bookings || []} loading={kpiLoading.bookings} count={5} />
            <BookingsManager isTrustee={true} canApprove={isAdmin} onStartWorkflow={handleStartWorkflow} />
          </>
        )}

        {activeTab === 'calendar' && <CalendarView isTrustee={true} />}
        {activeTab === 'noticeboard' && <NoticeboardManager isTrustee={true} profile={profile} />}

        {/* ── MINUTES ────────────────────────────────────────────────────── */}
        {activeTab === 'minutes' && (
          <>
            <KpiBar tiles={kpis.minutes || []} loading={kpiLoading.minutes} count={4} />
            <CommitteeMinutes />
          </>
        )}

        {/* ── PROJECTS ───────────────────────────────────────────────────── */}
        {activeTab === 'projects' && (
          <>
            <KpiBar tiles={kpis.projects || []} loading={kpiLoading.projects} count={5} />
            <ProjectsManager />
          </>
        )}

        {/* ── ASSETS ─────────────────────────────────────────────────────── */}
        {activeTab === 'assets' && (
          <>
            <KpiBar tiles={kpis.assets || []} loading={kpiLoading.assets} count={5} />
            <AssetsManager onStartWorkflow={handleStartWorkflow} />
          </>
        )}

        {activeTab === 'documents' && <DocumentsManager />}

        {/* ── TASKS ──────────────────────────────────────────────────────── */}
        {activeTab === 'tasks' && <TaskBoard />}

        {/* ── FINANCE ────────────────────────────────────────────────────── */}
        {activeTab === 'finance' && (
          isAdmin ? (
            <>
              {!xeroConnected && <KpiBar tiles={kpis.finance || []} loading={kpiLoading.finance} count={4} />}
              <FinanceManager />
            </>
          ) : (
            <div className="panel" style={{ textAlign: 'center', padding: '60px 24px', maxWidth: 480, margin: '0 auto' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
              <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Finance Access Restricted</div>
              <div style={{ fontSize: 14, color: 'var(--text3)', lineHeight: 1.6 }}>
                The Finance module is only available to Admin Trustees. Contact your Admin Trustee to update your permission level in Marae Settings.
              </div>
            </div>
          )
        )}

        {/* ── GRANTS ─────────────────────────────────────────────────────── */}
        {activeTab === 'grants' && (
          <>
            <KpiBar tiles={kpis.grants || []} loading={kpiLoading.grants} count={5} />
            <GrantsTracker />
          </>
        )}

        {/* ── CONTACTS ───────────────────────────────────────────────────── */}
        {activeTab === 'contacts' && <ContactsManager />}

        {/* ── COMPLIANCE ─────────────────────────────────────────────────── */}
        {activeTab === 'compliance' && (
          <>
            <KpiBar tiles={kpis.compliance || []} loading={kpiLoading.compliance} count={4} />
            <ComplianceTracker onStartWorkflow={handleStartWorkflow} onCreateRisk={handleCreateRisk} />
          </>
        )}

        {/* ── RISK REGISTER ──────────────────────────────────────────────── */}
        {activeTab === 'risks' && (
          <>
            <KpiBar tiles={kpis.risks || []} loading={kpiLoading.risks} count={4} />
            <RiskRegister pendingRisk={pendingRisk} onPendingConsumed={() => setPendingRisk(null)} onStartWorkflow={handleStartWorkflow} />
          </>
        )}

        {/* ── EMERGENCY PLAN ────────────────────────────────────────────── */}
        {activeTab === 'emergency_plan' && <EmergencyPlanManager />}

        {/* ── GOALS & REPORTING ──────────────────────────────────────────── */}
        {activeTab === 'goals' && (
          <>
            <KpiBar tiles={kpis.goals || []} loading={kpiLoading.goals} count={5} />
            <GoalsReporting />
          </>
        )}

        {/* ── WORKFLOWS ──────────────────────────────────────────────────── */}
        {activeTab === 'workflows' && <WorkflowEngine pendingWorkflow={pendingWorkflow} onPendingConsumed={() => setPendingWorkflow(null)} />}

        {activeTab === 'settings' && <MaraeSettings profile={profile} isAdmin={isAdmin} />}
      </div>

      <div className="footer">MaraeHub NZ Ltd · maraehub.com · Serving urban Māori communities across Aotearoa</div>
      <FeedbackButton profile={profile} />
      <UxPulsePrompt profile={profile} />
      <HelpMenu role="trustee" />
      <WhatsNew />
    </div>
  );
}
