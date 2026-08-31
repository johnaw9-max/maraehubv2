import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { fetchXeroFinancials, minsAgo } from '../lib/xero';
import { matchWorkflowTemplate } from '../lib/workflowEngine';
import { getComplianceStatus } from '../lib/complianceStatus';
import { getRiskStatus } from '../lib/riskStatus';
import { buildFocusItems } from '../lib/focusItems';

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

const URL_RE = /(https?:\/\/[^\s]+)/gi;

function stripUrls(text) {
  if (!text) return text;
  const stripped = text.replace(URL_RE, '').replace(/\s{2,}/g, ' ').trim();
  return stripped || '(link — view for details)';
}

function truncate(text, len = 70) {
  if (!text) return text;
  return text.length > len ? text.slice(0, len).trimEnd() + '…' : text;
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

// Mirrors emergency_plan_hazards' hazard_type check constraint (schema.sql)
// and EmergencyPlanManager.js's HAZARD_ORDER — used only to compute AI
// Compliance Report's (14yhc7knp9n, Report #2) hazard-guidance coverage
// count, so kept local rather than exported/shared across files.
const TOTAL_HAZARD_TYPES = 10;

const NAV_LABELS = {
  minutes:    'View Minutes →',
  compliance: 'View Compliance →',
  goals:      'View Goals →',
  tasks:      'View Tasks →',
  grants:     'View Grants →',
  assets:     'View Assets →',
  risks:      'View Risks →',
  bookings:   'View Bookings →',
  projects:   'View Projects →',
  finance:    'View Finance →',
};

function Stars({ rating }) {
  if (!rating) return <span style={{ color: 'var(--text3)' }}>—</span>;
  const r = Math.round(rating);
  return <span style={{ color: '#f4a400', letterSpacing: 1 }}>{'★'.repeat(r)}{'☆'.repeat(5 - r)}</span>;
}

function SectionTitle({ icon, title, count, note, rightContent }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 14, paddingBottom: 8, borderBottom: '2px solid var(--brand)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <span style={{ fontFamily: 'Playfair Display, serif', fontSize: 17, fontWeight: 600, color: 'var(--brand)' }}>{title}</span>
        {count !== undefined && (
          <span style={{ fontSize: 14, background: 'var(--brand)', color: '#fff', borderRadius: 20, padding: '1px 9px', fontWeight: 600, marginLeft: 4 }}>{count}</span>
        )}
        {note && <span style={{ fontSize: 14, color: 'var(--text3)', marginLeft: 4 }}>{note}</span>}
      </div>
      {rightContent}
    </div>
  );
}

function GroupHeading({ title }) {
  return (
    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '32px 0 14px', paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>
      {title}
    </div>
  );
}

// Stage 2 (86d41pc93) — unified status card. 4-state, not the task's literal
// 3-color spec: 'grey' represents genuine no-data (never assessed / not set
// up), kept distinct from red/amber so a real problem is never confused with
// an unfilled setup step. red > amber > grey > green.
const LEVEL_STYLES = {
  red:   { dot: '#d9534f', bg: '#faeae7', color: '#a63020' },
  amber: { dot: '#c8902a', bg: '#fdf0dc', color: '#7a4f00' },
  grey:  { dot: '#7a7268', bg: '#f5f0e8', color: 'var(--text3)' },
  green: { dot: '#2e7d52', bg: '#e8f4ef', color: '#1a4a3a' },
};
const LEVEL_EMOJI = { red: '🔴', amber: '🟡', grey: '⚪', green: '🟢' };

// Shared header shape for all 6 Board View status sections: ICON → NAME →
// traffic light → NUMBER → short message. Body content (stat grids, flagged
// item lists) stays per-section as children -- their shapes differ too much
// (due dates vs. deadlines vs. budget categories) to force into one generic
// row format.
function StatusCard({ icon, title, level, number, message, rightContent, trend, children }) {
  const s = LEVEL_STYLES[level];
  return (
    <div className="panel" style={{ marginBottom: 20, borderTop: `3px solid ${s.dot}` }}>
      <SectionTitle
        icon={icon}
        title={title}
        rightContent={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {rightContent}
            <span style={{ fontSize: 18 }} title={level}>{LEVEL_EMOJI[level]}</span>
          </div>
        }
      />
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: children ? 14 : 0 }}>
        <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 30, fontWeight: 700, color: s.color, lineHeight: 1 }}>{number}</div>
        <TrendArrow trend={trend} />
        <div style={{ fontSize: 14, color: 'var(--text3)' }}>{message}</div>
      </div>
      {children}
    </div>
  );
}

// Owner line, reusing FocusThisWeekCard's exact proven pattern (line ~134).
function OwnerLine({ owner, color, navTo, onNavigate }) {
  return (
    <div style={{ fontSize: 14, color, marginTop: 2 }}>
      {owner ? `👤 ${owner}` : (
        <>
          No owner assigned{navTo && onNavigate && (
            <>
              {' '}· <span onClick={() => onNavigate(navTo)} style={{ cursor: 'pointer', fontWeight: 700, textDecoration: 'underline' }}>Assign →</span>
            </>
          )}
        </>
      )}
    </div>
  );
}

// Stage 4 (86d41pc93) -- cap+view-all for single-tab flagged-item lists.
// Only for sections that map to exactly one real tab; cross-section
// aggregators (Focus This Week, Top Priorities) use plain "+N more" text
// instead, since there is no single destination to link to.
function ViewAllLink({ shown, total, navTo, onNavigate }) {
  if (total <= shown || !onNavigate) return null;
  return (
    <button
      onClick={() => onNavigate(navTo)}
      style={{ fontSize: 14, background: 'none', border: 'none', color: 'var(--brand)', cursor: 'pointer', fontWeight: 700, textDecoration: 'underline', padding: '4px 0', fontFamily: 'DM Sans, sans-serif', textAlign: 'center', width: '100%' }}
    >
      +{total - shown} more — {NAV_LABELS[navTo] || 'View All'} →
    </button>
  );
}

// Stage 5 (86d41pc93) -- single locked-month-over-month trend arrow. Purely
// historical (module_kpi_snapshots), independent of the live number shown
// on the card -- comparing a live count against a locked percentage would
// be comparing different units. Higher is always better for these 4
// metrics (% compliant/clear/serviced/on-track).
const TREND_CFG = {
  up:   { arrow: '↑', color: '#2e7d52' },
  down: { arrow: '↓', color: 'var(--danger)' },
  flat: { arrow: '→', color: 'var(--text3)' },
};

function getTrend(pair, key) {
  if (!pair) return null;
  const [prev, latest] = pair;
  // Either side can now be null (compliance_pct/risk_pct, since the
  // 2026-08-30 nullable-columns fix) -- no real basis for a direction
  // when one endpoint has no data, same reasoning as the null percentage
  // itself rather than treating it as 0 and showing a false trend.
  if (latest[key] == null || prev[key] == null) return null;
  const diff = latest[key] - prev[key];
  return { dir: diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat', diff };
}

function TrendArrow({ trend }) {
  if (!trend) return null;
  const cfg = TREND_CFG[trend.dir];
  return (
    <span
      style={{ fontSize: 14, color: cfg.color, fontWeight: 700, marginLeft: 8 }}
      title={`${trend.diff > 0 ? '+' : ''}${trend.diff}pt vs last month`}
    >
      {cfg.arrow}
    </span>
  );
}

// "Focus this week" card (ClickUp 86d3vc4yp, Step 3). Renders items from
// focusItems.js's buildFocusItems() — not yet wired into the page or given
// an empty-case design; both are Step 4.
const TIER_STYLES = {
  urgent:         { background: '#faeae7', border: '1px solid #f0b8b0', borderLeft: '4px solid var(--danger)', color: 'var(--danger)', badgeBg: 'var(--danger)', badgeLabel: 'Urgent' },
  'worth-a-look': { background: '#fdf0dc', border: '1px solid #e8c880', borderLeft: '4px solid var(--warning)', color: '#7a4f00',        badgeBg: '#c8902a',      badgeLabel: 'Worth a look' },
};

function InsightRow({ ins, onNavigate }) {
  const s = {
    red:   { background: '#faeae7', border: '1px solid #f0b8b0', borderLeft: '4px solid var(--danger)',  color: 'var(--danger)' },
    amber: { background: '#fdf0dc', border: '1px solid #e8c880', borderLeft: '4px solid var(--warning)', color: '#7a4f00' },
    green: { background: '#e8f4ef', border: '1px solid #a8d8c0', borderLeft: '4px solid var(--brand)',   color: '#1a4a3a' },
  }[ins.level];
  const icon = ins.level === 'red' ? '🔴' : ins.level === 'amber' ? '🟡' : '🟢';
  return (
    <div style={{ borderRadius: 7, padding: '9px 14px', fontSize: 14, fontWeight: 500, lineHeight: 1.5, display: 'flex', alignItems: 'center', gap: 8, ...s }}>
      <span style={{ flexShrink: 0 }}>{icon}</span>
      <span style={{ flex: 1 }}>{stripUrls(ins.text)}</span>
      {ins.navTo && onNavigate && (
        <button
          onClick={() => onNavigate(ins.navTo)}
          style={{ fontSize: 14, background: 'rgba(255,255,255,0.6)', color: '#7a4f00', border: '1px solid #c8a050', borderRadius: 6, padding: '3px 10px', fontWeight: 700, cursor: 'pointer', flexShrink: 0, fontFamily: 'DM Sans, sans-serif' }}
        >
          {NAV_LABELS[ins.navTo] || 'View →'}
        </button>
      )}
    </div>
  );
}

function FocusThisWeekRow({ item, onNavigate }) {
  const t = TIER_STYLES[item.tier];
  return (
    <div style={{ borderRadius: 8, padding: '12px 14px', ...t }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#fff', background: t.badgeBg, borderRadius: 20, padding: '2px 9px', marginRight: 8 }}>
            {t.badgeLabel}
          </span>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text1)', lineHeight: 1.5 }}>{item.text}</span>
          <div style={{ fontSize: 14, color: t.color, marginTop: 5 }}>
            {item.owner ? (
              `👤 ${item.owner}`
            ) : (
              <>
                No owner assigned ·{' '}
                {onNavigate && (
                  <span
                    onClick={() => onNavigate(item.navTo)}
                    style={{ cursor: 'pointer', fontWeight: 700, textDecoration: 'underline' }}
                  >
                    Assign →
                  </span>
                )}
              </>
            )}
          </div>
        </div>
        {onNavigate && (
          <button
            onClick={() => onNavigate(item.navTo)}
            style={{ fontSize: 14, background: 'rgba(255,255,255,0.6)', color: t.color, border: `1px solid ${t.badgeBg}`, borderRadius: 6, padding: '4px 10px', fontWeight: 700, cursor: 'pointer', flexShrink: 0, fontFamily: 'DM Sans, sans-serif', whiteSpace: 'nowrap' }}
          >
            {NAV_LABELS[item.navTo] || 'View →'}
          </button>
        )}
      </div>
    </div>
  );
}

function FocusThisWeekCard({ items, total, allItems, onNavigate }) {
  const [showMore, setShowMore] = useState(false);

  if (!items || items.length === 0) {
    return (
      <div className="panel" style={{ marginBottom: 20, borderTop: '3px solid #2e7d52', background: '#e8f4ef', textAlign: 'center', padding: '20px 16px' }}>
        <div style={{ fontSize: 22, marginBottom: 6 }}>✅</div>
        <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 16, fontWeight: 700, color: '#1a4a3a', marginBottom: 4 }}>
          All clear this week
        </div>
        <div style={{ fontSize: 14, color: '#1a4a3a', opacity: 0.85 }}>
          Nothing urgent needs your attention right now — great governance.
        </div>
      </div>
    );
  }

  const extra = (allItems || []).slice(items.length);

  return (
    <div className="panel" style={{ marginBottom: 20, borderTop: '3px solid var(--brand)' }}>
      <SectionTitle icon="🎯" title="Focus This Week" count={items.length} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map((item, i) => <FocusThisWeekRow key={i} item={item} onNavigate={onNavigate} />)}
        {total > items.length && (
          <div style={{ marginTop: 2 }}>
            <button
              type="button"
              onClick={() => setShowMore(s => !s)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                background: 'var(--surface2)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '10px 16px', cursor: 'pointer',
                fontSize: 14, fontWeight: 600, color: 'var(--text2)',
                fontFamily: 'DM Sans, sans-serif',
              }}
            >
              <span>{showMore ? '▲' : '▼'}</span>
              <span>+{total - items.length} more this week</span>
            </button>
            {showMore && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
                {extra.map((item, i) => <FocusThisWeekRow key={i} item={item} onNavigate={onNavigate} />)}
              </div>
            )}
          </div>
        )}
      </div>
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

export default function BoardDashboard({ onNavigate, onStartWorkflow, isAdmin }) {
  const [d, setD]             = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod]   = useState('month');
  // eslint-disable-next-line no-unused-vars
  const [aiLoading, setAiLoading] = useState(false);
  const [aiReport, setAiReport]   = useState('');
  const [aiError, setAiError]     = useState('');
  const [showReport, setShowReport] = useState(false);
  const [finAiLoading, setFinAiLoading] = useState(false);
  const [finAiReport, setFinAiReport]   = useState('');
  const [finAiError, setFinAiError]     = useState('');
  const [showFinReport, setShowFinReport] = useState(false);
  const [compAiLoading, setCompAiLoading] = useState(false);
  const [compAiReport, setCompAiReport]   = useState('');
  const [compAiError, setCompAiError]     = useState('');
  const [showCompReport, setShowCompReport] = useState(false);
  const [showKpiHistory, setShowKpiHistory] = useState(false);
  const [financeEntityFilter, setFinanceEntityFilter] = useState('all');
  const [complianceEntityFilter, setComplianceEntityFilter] = useState('all');
  const [riskEntityFilter, setRiskEntityFilter] = useState('all');
  const [reportEntityFilter, setReportEntityFilter] = useState('all');
  const [showNeverAssessedDetail, setShowNeverAssessedDetail] = useState(false);
  const [showMorePriorities, setShowMorePriorities] = useState(false);
  const [showMoreWorkflows, setShowMoreWorkflows] = useState(false);
  const [copied, setCopied]       = useState(false);
  const [expandedComments, setExpandedComments] = useState(new Set());
  const [showAllFull, setShowAllFull] = useState(false);
  const [showFullActions, setShowFullActions] = useState(false);
  const [showFullRisks, setShowFullRisks] = useState(false);

  useEffect(() => { fetchAll(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchAll() {
    setLoading(true);
    const now = new Date();
    const fyYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    const fyFrom = `${fyYear}-04-01`;
    const fyTo   = `${fyYear + 1}-03-31`;

    const [bookRes, projRes, actRes, resRes, grantRes, remRes, assetRes, taskRes, feedRes, settingsRes, compRes, goalsRes, finIncRes, finExpRes, finBudRes, finBalRes, finHealthRes, tplRes, wfInstRes, wfTaskRes, pendIncRes, irRes, riskRes, kpiRes, entitiesRes, xeroRes, hazRes] = await Promise.all([
      supabase.from('bookings').select('id, occasion, start_date, end_date, guests, status').order('start_date'),
      supabase.from('projects').select('id, name, status, progress, lead, due_date, created_at'),
      supabase.from('meeting_actions').select('id, description, assigned_to, due_date, status').neq('status', 'Completed'),
      supabase.from('resolutions').select('id, resolution_number, description, date_passed, status').order('date_passed'),
      supabase.from('grants').select('id, name, funder, amount, status, deadline, owner').order('deadline'),
      supabase.from('service_reminders').select('id, type, due_date, asset_id, owner').order('due_date'),
      supabase.from('assets').select('*'),
      supabase.from('tasks').select('id, title, due_date, status, priority, assigned_to').neq('status', 'cancelled').neq('status', 'completed'),
      supabase.from('booking_feedback').select('rating_overall, experience, created_at').order('created_at', { ascending: false }),
      supabase.from('marae_settings').select('marae_name').single(),
      supabase.from('compliance_items').select('id, name, category, due_date, last_checked_date, entity_id, responsible_name').order('due_date'),
      supabase.from('goals').select('id, name, status, target_date, responsible_name').order('target_date'),
      // Finance queries are admin-only (86d3uy01x) -- a standard trustee's
      // browser never even requests these tables, not just doesn't render
      // them; get_finance_health_score() below is the admin-independent
      // substitute that keeps the overall Health Score consistent across
      // roles without shipping any raw transaction data.
      isAdmin ? supabase.from('finance_income').select('date, description, amount, category, status, source_type, entity_id').gte('date', fyFrom).lte('date', fyTo) : Promise.resolve({ data: [] }),
      isAdmin ? supabase.from('finance_expenses').select('date, description, amount, category, status, payee, entity_id').gte('date', fyFrom).lte('date', fyTo) : Promise.resolve({ data: [] }),
      isAdmin ? supabase.from('finance_budgets').select('category, amount').eq('financial_year', fyYear) : Promise.resolve({ data: [] }),
      isAdmin ? supabase.from('finance_balance_sheet').select('cash_balance, loans, other_assets, outstanding_payments').maybeSingle() : Promise.resolve({ data: null }),
      isAdmin ? Promise.resolve({ data: null }) : supabase.rpc('get_finance_health_score').maybeSingle(),
      supabase.from('workflow_templates').select('id, name').order('name'),
      supabase.from('workflow_instances').select('id, name, status, started_at, completed_at, entity_name, trigger_type').order('started_at', { ascending: false }),
      supabase.from('tasks').select('id, workflow_instance_id, status').not('workflow_instance_id', 'is', null),
      supabase.from('finance_income').select('id').eq('source_type', 'booking').eq('amount', 0).eq('status', 'Pending'),
      supabase.from('interest_register').select('id').eq('status', 'Active'),
      supabase.from('risk_register').select('id, risk_description, risk_rating, category, status, controls, entity_id, owner, review_date').order('created_at', { ascending: false }),
      supabase.from('module_kpi_snapshots').select('snapshot_month, compliance_pct, risk_pct, assets_pct, goals_pct, net_assets, total_assets, total_liabilities').gte('snapshot_month', `${now.getFullYear()}-01-01`).lte('snapshot_month', `${now.getFullYear()}-12-31`).order('snapshot_month'),
      supabase.from('entities').select('id, name').order('name'),
      fetchXeroFinancials(),
      // Not fetched anywhere in Board View before Report #2 (14yhc7knp9n) --
      // only EmergencyPlanManager.js queried this table previously.
      supabase.from('emergency_plan_hazards').select('id, hazard_type, likely_impact, what_to_do, entity_id'),
    ]);
    setD({
      bookings:          bookRes.data   || [],
      projects:          projRes.data   || [],
      actions:           actRes.data    || [],
      resolutions:       resRes.data    || [],
      grants:            grantRes.data  || [],
      reminders:         remRes.data    || [],
      assets:            assetRes.data  || [],
      tasks:             taskRes.data   || [],
      feedback:          feedRes.data   || [],
      maraeName:         settingsRes.data?.marae_name || 'Our Marae',
      compliance:        compRes.data   || [],
      goals:             goalsRes.data  || [],
      kpiSnapshots:      kpiRes.data    || [],
      entities:          entitiesRes.data || [],
      finIncome:         finIncRes.data  || [],
      finExpenses:       finExpRes.data  || [],
      finBudgets:        finBudRes.data  || [],
      finBalanceSheet:   finBalRes.data  || null,
      finHealthScore:    finHealthRes.data || null,
      xero:              xeroRes, // { status: 'connected'|'not_connected'|'error', totalIncome?, totalExpenses?, netProfit?, lastSyncedAt? }
      templates:         tplRes.data    || [],
      workflowInstances: wfInstRes.data  || [],
      workflowTasks:        wfTaskRes.data  || [],
      pendingIncome:        pendIncRes.data  || [],
      activeInterestCount:  (irRes.data || []).length,
      risks:                riskRes.data || [],
      emergencyHazards:     hazRes.data || [],
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
  const periodProjects      = d.projects.filter(p => p.status === 'active');
  const periodUpcoming      = periodBookings.filter(b => b.start_date >= todayStr).slice(0, 5);
  const periodPipeline      = d.grants.filter(g => !['approved','declined'].includes(g.status) && inPeriod(g.deadline));

  // Stage 2 (86d41pc93) StatusCard. New section-level logic -- Grants Pipeline
  // previously had no aggregate red/amber/green status at all, only per-item
  // deadline badges. Reuses the same urgent (<=14d) threshold already used
  // per-item below; 30d is a new amber threshold, not previously present.
  const grantsDaysLeftArr  = periodPipeline.map(g => g.deadline ? Math.ceil((new Date(g.deadline + 'T12:00:00') - today) / 86400000) : null);
  const grantsUrgentCount  = grantsDaysLeftArr.filter(dl => dl !== null && dl >= 0 && dl <= 14).length;
  const grantsWatchCount   = grantsDaysLeftArr.filter(dl => dl !== null && dl > 14 && dl <= 30).length;
  const grantsLevel =
    periodPipeline.length === 0 ? 'grey' :
    grantsUrgentCount > 0 ? 'red' :
    grantsWatchCount > 0 ? 'amber' :
    'green';
  const grantsNumber =
    grantsLevel === 'grey' ? '—' :
    grantsLevel === 'red' ? grantsUrgentCount :
    grantsLevel === 'amber' ? grantsWatchCount :
    periodPipeline.length;
  const grantsMessage =
    grantsLevel === 'grey' ? 'No active grant applications' :
    grantsLevel === 'red' ? `deadline${grantsUrgentCount !== 1 ? 's' : ''} within 14 days` :
    grantsLevel === 'amber' ? `deadline${grantsWatchCount !== 1 ? 's' : ''} within 30 days` :
    `application${periodPipeline.length !== 1 ? 's' : ''} in pipeline, nothing urgent`;
  const periodComments      = periodFeedback.filter(f => f.experience).slice(0, 3);

  // ─── PERIOD-INDEPENDENT (always current-state) ─────────────────────────────

  const assetMap = {};
  d.assets.forEach(a => { assetMap[a.id] = a.name; });

  // ─── FINANCIAL HEALTH ──────────────────────────────────────────────────────
  const xeroConnected    = d.xero?.status === 'connected';
  const finTotalIncome   = xeroConnected ? d.xero.profitAndLoss.totalIncome   : (d.finIncome   || []).reduce((s, r) => s + parseFloat(r.amount || 0), 0);
  const finTotalExpenses = xeroConnected ? d.xero.profitAndLoss.totalExpenses : (d.finExpenses || []).reduce((s, r) => s + parseFloat(r.amount || 0), 0);
  const finNet           = xeroConnected ? d.xero.profitAndLoss.netProfit     : finTotalIncome - finTotalExpenses;
  const finBudgetMap     = {};
  (d.finBudgets || []).forEach(b => { finBudgetMap[b.category] = parseFloat(b.amount || 0); });
  const finSpentMap = {};
  (d.finExpenses || []).forEach(e => { finSpentMap[e.category] = (finSpentMap[e.category] || 0) + parseFloat(e.amount || 0); });
  const finOverBudgetCats = Object.entries(finBudgetMap)
    .filter(([cat, bud]) => bud > 0 && (finSpentMap[cat] || 0) > bud)
    .map(([cat]) => cat);

  // Panel-scoped: only the Financial Health panel's income/expense/net tiles respect
  // financeEntityFilter. When Xero is connected, totals come from Xero's P&L and can't be
  // decomposed by entity_id - the filter dropdown is hidden entirely in that case (see
  // rightContent below), so this branch is unreachable but kept honest rather than assumed.
  // finOverBudgetCats stays unfiltered either way - budgets aren't entity-specific in the schema.
  const financeForPanel = xeroConnected
    ? null
    : (financeEntityFilter === 'all'
        ? { income: d.finIncome || [], expenses: d.finExpenses || [] }
        : {
            income:   (d.finIncome   || []).filter(r => r.entity_id === financeEntityFilter || r.entity_id === null),
            expenses: (d.finExpenses || []).filter(r => r.entity_id === financeEntityFilter || r.entity_id === null),
          });
  const panelFinTotalIncome   = xeroConnected ? finTotalIncome   : financeForPanel.income.reduce((s, r) => s + parseFloat(r.amount || 0), 0);
  const panelFinTotalExpenses = xeroConnected ? finTotalExpenses : financeForPanel.expenses.reduce((s, r) => s + parseFloat(r.amount || 0), 0);
  const panelFinNet           = xeroConnected ? finNet : panelFinTotalIncome - panelFinTotalExpenses;

  // Stage 2 (86d41pc93) StatusCard. No amber -- budget status is binary
  // (within/over) in the current data, no medium-risk threshold exists.
  const financeLevel =
    (panelFinTotalIncome === 0 && panelFinTotalExpenses === 0) ? 'grey' :
    (finOverBudgetCats.length > 0 || panelFinNet < 0) ? 'red' :
    'green';
  const financeNumber =
    financeLevel === 'grey' ? '—' :
    `${panelFinNet >= 0 ? '+' : '-'}$${(Math.abs(panelFinNet) / 1000).toFixed(1)}k`;
  const financeMessage =
    financeLevel === 'grey' ? 'No finance data recorded' :
    financeLevel === 'red' ? (finOverBudgetCats.length > 0 ? `${finOverBudgetCats.length} categor${finOverBudgetCats.length !== 1 ? 'ies' : 'y'} over budget` : 'net deficit') :
    'net surplus, within budget';
  const fyLabelStr = `${d.fyYear}/${String(d.fyYear + 1).slice(2)}`;

  const zeroStockItems     = d.assets.filter(a => a.category === 'Inventory' && a.quantity != null && a.quantity === 0);
  const { overdue: overdueCompliance, dueSoon: dueSoonCompliance, neverAssessed: neverAssessedCompliance, compliancePct } = getComplianceStatus(d.compliance);

  // Panel-scoped: only the Compliance Tracker panel itself respects complianceEntityFilter.
  // Health Score and insight banners deliberately keep reading the unfiltered variables
  // above - a panel-local dropdown shouldn't silently change numbers the user isn't looking at.
  const complianceForPanel = complianceEntityFilter === 'all'
    ? d.compliance
    : d.compliance.filter(c => c.entity_id === complianceEntityFilter || c.entity_id === null);
  const {
    overdue: panelOverdueCompliance,
    dueSoon: panelDueSoonCompliance,
    neverAssessed: panelNeverAssessedCompliance,
    compliant: panelCompliantComplianceArr,
    compliancePct: panelCompliancePct,
  } = getComplianceStatus(complianceForPanel);

  // Stage 2 (86d41pc93) unified StatusCard — red > amber > grey > green, first match wins.
  // Amber-on-due-soon-only is a deliberate behavior change from the old collapsed view,
  // which silently folded due-soon-only into the all-clear state.
  const complianceLevel =
    complianceForPanel.length === 0 ? 'grey' :
    panelOverdueCompliance.length > 0 ? 'red' :
    panelDueSoonCompliance.length > 0 ? 'amber' :
    panelNeverAssessedCompliance.length > 0 ? 'grey' :
    'green';
  const complianceNumber =
    complianceForPanel.length === 0 ? '—' :
    complianceLevel === 'red' ? panelOverdueCompliance.length :
    complianceLevel === 'amber' ? panelDueSoonCompliance.length :
    complianceLevel === 'grey' ? panelNeverAssessedCompliance.length :
    `${panelCompliancePct}%`;
  const complianceMessage =
    complianceForPanel.length === 0 ? 'No compliance items set up' :
    complianceLevel === 'red' ? `item${panelOverdueCompliance.length !== 1 ? 's' : ''} overdue` :
    complianceLevel === 'amber' ? `item${panelDueSoonCompliance.length !== 1 ? 's' : ''} due within 30 days` :
    complianceLevel === 'grey' ? `item${panelNeverAssessedCompliance.length !== 1 ? 's' : ''} never assessed` :
    `${complianceForPanel.length} item${complianceForPanel.length !== 1 ? 's' : ''} tracked, all clear`;

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
    if (g.status === 'not_started') return (t && t < today) ? 'red' : 'green';
    if (t && t < today) return 'red';
    if (t && t <= in14) return 'orange';
    return 'green';
  }
  const goalsBehind   = d.goals.filter(g => goalLight(g) === 'red');
  const goalsAtRisk   = d.goals.filter(g => goalLight(g) === 'orange');
  const goalsOnTrack  = d.goals.filter(g => goalLight(g) === 'green');
  const goalsComplete = d.goals.filter(g => g.status === 'completed');
  const activeGoals             = d.goals.filter(g => g.status !== 'not_started');
  const goalsOnTrackOrComplete   = activeGoals.filter(g => goalLight(g) === 'green' || g.status === 'completed');
  const goalsPct                 = activeGoals.length ? Math.round((goalsOnTrackOrComplete.length / activeGoals.length) * 100) : 100;

  // Stage 2 (86d41pc93) StatusCard.
  const goalsLevel =
    d.goals.length === 0 ? 'grey' :
    goalsBehind.length > 0 ? 'red' :
    goalsAtRisk.length > 0 ? 'amber' :
    'green';
  const goalsNumber =
    d.goals.length === 0 ? '—' :
    goalsLevel === 'red' ? goalsBehind.length :
    goalsLevel === 'amber' ? goalsAtRisk.length :
    `${goalsPct}%`;
  const goalsMessage =
    d.goals.length === 0 ? 'No strategic goals set' :
    goalsLevel === 'red' ? `goal${goalsBehind.length !== 1 ? 's' : ''} behind` :
    goalsLevel === 'amber' ? `goal${goalsAtRisk.length !== 1 ? 's' : ''} at risk` :
    'on track or completed';
  const overdueReminders  = d.reminders.filter(r => r.due_date && new Date(r.due_date + 'T12:00:00') < today);
  const assetsWithOverdue = new Set(overdueReminders.map(r => r.asset_id));
  const compliantPct      = d.assets.length ? Math.round(((d.assets.length - assetsWithOverdue.size) / d.assets.length) * 100) : 100;
  const upcomingReminders = d.reminders.filter(r => r.due_date && new Date(r.due_date + 'T12:00:00') <= in60).sort((a, b) => new Date(a.due_date) - new Date(b.due_date));

  // Stage 2 (86d41pc93) StatusCard. New section-level logic -- Service
  // Reminders previously had no aggregate red/amber/green status, only
  // per-item Overdue/Due Soon badges.
  const srOverdueCount = upcomingReminders.filter(r => new Date(r.due_date + 'T12:00:00') < today).length;
  const srDueSoonCount = upcomingReminders.length - srOverdueCount;
  const serviceLevel =
    d.assets.length === 0 ? 'grey' :
    srOverdueCount > 0 ? 'red' :
    srDueSoonCount > 0 ? 'amber' :
    'green';
  const serviceNumber =
    serviceLevel === 'grey' ? '—' :
    serviceLevel === 'red' ? srOverdueCount :
    serviceLevel === 'amber' ? srDueSoonCount :
    `${compliantPct}%`;
  const serviceMessage =
    serviceLevel === 'grey' ? 'No assets tracked' :
    serviceLevel === 'red' ? `reminder${srOverdueCount !== 1 ? 's' : ''} overdue` :
    serviceLevel === 'amber' ? `reminder${srDueSoonCount !== 1 ? 's' : ''} due within 60 days` :
    'assets compliant, no overdue reminders';
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

  const highOpenRisks = (d.risks || []).filter(r => r.risk_rating === 'High' && r.status !== 'Closed');
  const { riskPct } = getRiskStatus(d.risks || []);

  // Panel-scoped: only the Risk Register panel itself respects riskEntityFilter.
  // The outer d.risks.length > 0 gate that decides whether the panel (and its
  // dropdown) renders at all stays unfiltered - filtering to zero shouldn't hide
  // the only control that lets the trustee switch back to "All Entities".
  const risksForPanel = riskEntityFilter === 'all'
    ? (d.risks || [])
    : (d.risks || []).filter(r => r.entity_id === riskEntityFilter || r.entity_id === null);
  const panelHighOpenRisks = risksForPanel.filter(r => r.risk_rating === 'High' && r.status !== 'Closed');
  const panelOpenRisks = risksForPanel.filter(r => r.status !== 'Closed');
  const panelOpenRisksWithControls = panelOpenRisks.filter(r => r.controls);
  const panelRiskControlsPct = panelOpenRisks.length ? Math.round((panelOpenRisksWithControls.length / panelOpenRisks.length) * 100) : 100;
  const { riskPct: panelRiskPct } = getRiskStatus(risksForPanel);

  // Stage 2 (86d41pc93) StatusCard. Behavior change: an empty risk register
  // now renders a grey card instead of not rendering at all, for consistency
  // with Compliance's empty-state handling. No amber -- risk_rating has no
  // medium-severity concept in the current data, only High/not-High.
  const riskLevel =
    risksForPanel.length === 0 ? 'grey' :
    panelHighOpenRisks.length > 0 ? 'red' :
    'green';
  const riskNumber =
    risksForPanel.length === 0 ? '—' :
    riskLevel === 'red' ? panelHighOpenRisks.length :
    `${panelRiskPct}%`;
  const riskMessage =
    risksForPanel.length === 0 ? 'No risks set up' :
    riskLevel === 'red' ? `high-rated risk${panelHighOpenRisks.length !== 1 ? 's' : ''} open` :
    'clear of high-rated risks';

  // ─── ENTITY REPORT (deliberately independent of the 3 panel filters above —
  // those are separate per-panel view state and can genuinely disagree; the
  // report needs one unambiguous answer, so it gets its own selector and its
  // own full-register data, not the panels' curated-exceptions subsets) ──────
  const reportCompliance = reportEntityFilter === 'all'
    ? d.compliance
    : d.compliance.filter(c => c.entity_id === reportEntityFilter || c.entity_id === null);
  const reportRisks = reportEntityFilter === 'all'
    ? (d.risks || [])
    : (d.risks || []).filter(r => r.entity_id === reportEntityFilter || r.entity_id === null);
  const reportHazards = reportEntityFilter === 'all'
    ? (d.emergencyHazards || [])
    : (d.emergencyHazards || []).filter(h => h.entity_id === reportEntityFilter || h.entity_id === null);
  const reportFinance = xeroConnected
    ? null
    : (reportEntityFilter === 'all'
        ? { income: d.finIncome || [], expenses: d.finExpenses || [] }
        : {
            income:   (d.finIncome   || []).filter(r => r.entity_id === reportEntityFilter || r.entity_id === null),
            expenses: (d.finExpenses || []).filter(r => r.entity_id === reportEntityFilter || r.entity_id === null),
          });
  // Physical assets only - Inventory already has its own dedicated, entity-aware
  // print feature (Stocktake), kept separate rather than duplicated here.
  const reportPhysicalAssets = d.assets.filter(a => a.category !== 'Inventory');
  const reportAssets = reportEntityFilter === 'all'
    ? reportPhysicalAssets
    : reportPhysicalAssets.filter(a => a.entity_id === reportEntityFilter || a.entity_id === null);

  // ─── HEALTH SCORE ──────────────────────────────────────────────────────────
  const scorableTasks  = d.tasks.filter(t => !t.title?.startsWith('UPCOMING: '));
  // Only rows with a genuine nonzero amount count as real financial
  // activity -- a raw row count let zero-amount rows silently pass the
  // gate and score a perfect 20/20 off no real data (flagged 2026-08-23).
  const hsRealFinRecords = [...(d.finIncome || []), ...(d.finExpenses || [])].filter(r => parseFloat(r.amount || 0) !== 0);

  const hsCategories = [];

  // Gate on assessed items, not raw row count -- a register that's 100%
  // never-assessed has no real basis for a Compliance score, same
  // discipline as the Finance/Goals fix above (flagged 2026-08-23).
  const hsAssessedCompliance = d.compliance.length - neverAssessedCompliance.length;

  if (hsAssessedCompliance >= 3) {
    hsCategories.push({
      name: 'Compliance',
      score: Math.round(25 * compliancePct / 100),
      max: 25,
      detail: [
        overdueCompliance.length > 0 && `${overdueCompliance.length} overdue`,
        neverAssessedCompliance.length > 0 && `${neverAssessedCompliance.length} never assessed`,
      ].filter(Boolean).join(', ') || 'All compliance items up to date',
    });
  }

  if ((d.risks || []).length >= 1) {
    hsCategories.push({
      name: 'Risk',
      score: Math.round(20 * riskPct / 100),
      max: 20,
      detail: highOpenRisks.length > 0 ? `${highOpenRisks.length} high-rated risk${highOpenRisks.length !== 1 ? 's' : ''} still open` : 'No open high-rated risks',
    });
  }

  // Tasks and Finance: unchanged from TrusteeDashboard.js's current logic -
  // not yet reconciled with Board View (Parts 3-4, pending), moved as-is.
  if (scorableTasks.length >= 3) {
    hsCategories.push({
      name: 'Tasks',
      score: Math.round(20 * ((scorableTasks.length - overdueTasks.length) / scorableTasks.length)),
      max: 20,
      detail: overdueTasks.length > 0 ? `${overdueTasks.length} task${overdueTasks.length !== 1 ? 's' : ''} overdue` : 'No overdue tasks',
    });
  }

  // Admin trustees compute this from real fetched rows (exact dollar detail).
  // Standard trustees never fetch those rows at all (86d3uy01x) -- their
  // score comes from get_finance_health_score() instead, same 0/10/20 scale
  // so the overall Health Score stays consistent across roles, but the
  // detail text stays dollar-free -- exposing the real deficit amount here
  // would just reopen the same leak the RLS restriction closes.
  if (isAdmin) {
    if (hsRealFinRecords.length >= 3) {
      let finScore = 0;
      if (finNet >= 0) finScore = 20;
      else if (finTotalIncome > 0 && Math.abs(finNet) < finTotalIncome * 0.1) finScore = 10;
      hsCategories.push({
        name: 'Finance',
        score: finScore,
        max: 20,
        detail: finNet >= 0 ? 'Finances in surplus' : `Running a deficit of $${Math.abs(Math.round(finNet)).toLocaleString()}`,
      });
    }
  } else if (d.finHealthScore?.has_enough_data) {
    const finDetail = {
      surplus: 'Finances in surplus',
      near_breakeven_deficit: 'Running a small deficit',
      deficit: 'Running a deficit',
    }[d.finHealthScore.status] || 'Finances in surplus';
    hsCategories.push({
      name: 'Finance',
      score: d.finHealthScore.score,
      max: 20,
      detail: finDetail,
    });
  }

  // Health-Score-scoped: a goal with no target_date and no real status
  // (not 'completed'/'at_risk') falls through goalLight()'s default and
  // silently scores as "on track" with zero real tracking behind it --
  // excluded here the same way never-assessed compliance items are
  // excluded from compliancePct's denominator (flagged 2026-08-23).
  const hsTrackedGoals   = activeGoals.filter(g => g.target_date || ['completed', 'at_risk'].includes(g.status));
  const hsGoalsOnTrack   = hsTrackedGoals.filter(g => goalLight(g) === 'green' || g.status === 'completed');
  const hsUntrackedGoals = activeGoals.length - hsTrackedGoals.length;

  if (hsTrackedGoals.length >= 1) {
    const goalsBehindCount = hsTrackedGoals.length - hsGoalsOnTrack.length;
    hsCategories.push({
      name: 'Goals',
      score: Math.round(15 * (hsGoalsOnTrack.length / hsTrackedGoals.length)),
      max: 15,
      detail: [
        goalsBehindCount > 0 && `${goalsBehindCount} goal${goalsBehindCount !== 1 ? 's' : ''} not on track`,
        hsUntrackedGoals > 0 && `${hsUntrackedGoals} without a target date`,
      ].filter(Boolean).join(', ') || 'All goals on track',
    });
  }

  const hsInsufficient = hsCategories.length < 2;
  const hsRawTotal    = hsCategories.reduce((s, c) => s + c.score, 0);
  const hsMaxTotal     = hsCategories.reduce((s, c) => s + c.max, 0);
  const hsFinalScore   = hsMaxTotal ? Math.round((hsRawTotal / hsMaxTotal) * 100) : 0;

  // Health Score breakdown dots -- reuses the same 4 levels as the summary
  // strip for Compliance/Risk/Finance/Goals. Tasks has no level anywhere
  // else in this file; this new 2-state threshold mirrors hsCategories'
  // own Tasks scoring above (overdueTasks.length), just expressed as a dot.
  const tasksLevel = overdueTasks.length > 0 ? 'red' : 'green';
  const HS_ICON  = { Compliance: '📋', Risk: '🛡️', Tasks: '📝', Finance: '📊', Goals: '🎯' };
  const HS_LEVEL = { Compliance: complianceLevel, Risk: riskLevel, Tasks: tasksLevel, Finance: financeLevel, Goals: goalsLevel };

  const ALERTS = [
    epUrgentCount              && { label: `🆘 Emergency Preparedness — ${epUrgentCount} item${epUrgentCount !== 1 ? 's' : ''} overdue or not scheduled`, level: 'red', tab: 'compliance' },
    overdueCompliance.length   && { label: `${overdueCompliance.length} compliance item${overdueCompliance.length !== 1 ? 's' : ''} overdue`, level: 'red', tab: 'compliance' },
    highOpenRisks.length       && { label: `⚠️ ${highOpenRisks.length} high-rated risk${highOpenRisks.length !== 1 ? 's' : ''} open — review Risk Register`, level: 'red', tab: 'risks' },
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
    zeroStockItems.length      && { label: `📦 ${zeroStockItems.length} inventory item${zeroStockItems.length !== 1 ? 's' : ''} out of stock — restock before next booking`, level: 'amber', tab: 'assets' },
  ].filter(Boolean);


  // ─── KPI TILES (period-filtered) ───────────────────────────────────────────

  const avgRating        = periodFeedbackScores.length ? (periodFeedbackScores.reduce((s, f) => s + f.rating_overall, 0) / periodFeedbackScores.length) : null;
  const approvedGrantsAmt = periodApprovedGrants.reduce((s, g) => s + (g.amount || 0), 0);
  const pl               = PERIOD_LABEL[period];

  const todayDisplay = new Date().toLocaleDateString('en-NZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  // ─── WORKFLOW INSIGHT CALCULATIONS ────────────────────────────────────────

  const monthStart       = new Date(today.getFullYear(), today.getMonth(), 1);
  const fourteenDaysAgo  = new Date(today); fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const activeWorkflows             = (d.workflowInstances || []).filter(w => w.status === 'active');
  const completedWorkflowsThisMonth = (d.workflowInstances || []).filter(w =>
    w.status === 'complete' && w.completed_at && new Date(w.completed_at) >= monthStart
  );

  const completedTasksByInstance = {};
  (d.workflowTasks || []).forEach(t => {
    if (t.status === 'completed' && t.workflow_instance_id) {
      if (!completedTasksByInstance[t.workflow_instance_id]) completedTasksByInstance[t.workflow_instance_id] = [];
      completedTasksByInstance[t.workflow_instance_id].push(t);
    }
  });

  const stalledWorkflows = activeWorkflows.filter(w => {
    if (!w.started_at || new Date(w.started_at) > fourteenDaysAgo) return false;
    return (completedTasksByInstance[w.id] || []).length === 0;
  });

  const activeWorkflowsWithSource  = activeWorkflows.filter(w => w.entity_name);
  const pendingBookingIncomeCount   = (d.pendingIncome || []).length;

  // ─── SMART INSIGHTS ────────────────────────────────────────────────────────

  const redInsights   = [];
  const amberInsights = [];
  const greenInsights = [];

  // RED — Emergency Preparedness first (highest priority)
  if (epUrgentCount > 0)
    redInsights.unshift({ text: `🆘 Emergency Preparedness: ${epUrgentCount} item${epUrgentCount !== 1 ? 's' : ''} are overdue or not yet scheduled — marae may not be ready for a civil defence event`, navTo: 'compliance' });

  if (overdueCompliance.length > 0) {
    if (overdueCompliance.length <= 3) {
      const names = overdueCompliance.map(c => c.name);
      const text = overdueCompliance.length === 1
        ? `${names[0]} overdue ${Math.floor((today - new Date(overdueCompliance[0].due_date + 'T12:00:00')) / 86400000)} days`
        : `${overdueCompliance.length} overdue: ${names.join(', ')}`;
      redInsights.push({ text, navTo: 'compliance' });
    } else {
      redInsights.push({ text: `${overdueCompliance.length} compliance obligations are overdue — arrange renewals immediately`, navTo: 'compliance' });
    }
  }

  if (goalsBehind.length > 0) {
    if (goalsBehind.length <= 3) {
      const names = goalsBehind.map(g => g.name);
      const text = goalsBehind.length === 1
        ? `${names[0]} is behind schedule`
        : `${goalsBehind.length} behind schedule: ${names.join(', ')}`;
      redInsights.push({ text, navTo: 'goals' });
    } else {
      redInsights.push({ text: `${goalsBehind.length} strategic goals are behind schedule — review and update plans`, navTo: 'goals' });
    }
  }

  if (overdueTasks.length > 0) {
    if (overdueTasks.length <= 3) {
      const text = overdueTasks.length === 1
        ? `'${overdueTasks[0].title}' overdue${overdueTasks[0].assigned_to ? ` — ${overdueTasks[0].assigned_to}` : ''}`
        : `${overdueTasks.length} overdue: ${overdueTasks.map(t => `'${t.title}'`).join(', ')}`;
      redInsights.push({ text, navTo: 'tasks' });
    } else {
      redInsights.push({ text: `${overdueTasks.length} overdue tasks — follow up with assignees immediately`, navTo: 'tasks' });
    }
  }
const overdueActions = d.actions.filter(a => a.due_date && new Date(a.due_date + 'T12:00:00') < today);
  // overdueActions is surfaced in Decisions Required — not duplicated into Top Priorities
  const grantsUrgent = d.grants.filter(g => g.deadline && !['approved','declined'].includes(g.status) && new Date(g.deadline + 'T12:00:00') >= today && new Date(g.deadline + 'T12:00:00') <= in7);
  // grantsUrgent is surfaced in Decisions Required — not duplicated into Top Priorities
  const openResolutions = d.resolutions.filter(r => !['Completed', 'Cancelled'].includes(r.status));
  // openResolutions is surfaced in Decisions Required — not duplicated into Top Priorities

  if (overdueReminders.length > 0) {
    const assetById = Object.fromEntries(d.assets.map(a => [a.id, a]));
    if (overdueReminders.length <= 3) {
      const names = overdueReminders.map(r => assetById[r.asset_id]?.name || 'an asset');
      const text = overdueReminders.length === 1
        ? `${names[0]} — service overdue ${Math.floor((today - new Date(overdueReminders[0].due_date + 'T12:00:00')) / 86400000)} days`
        : `${overdueReminders.length} services overdue: ${names.join(', ')}`;
      redInsights.push({ text, navTo: 'assets' });
    } else {
      redInsights.push({ text: `${overdueReminders.length} asset services are overdue — arrange maintenance now`, navTo: 'assets' });
    }
  }

  const criticalAssets = d.assets.filter(a => a.condition === 'critical');
  criticalAssets.forEach(a => {
    redInsights.unshift({ text: `🔴 ${a.name} is in Critical condition — arrange replacement or repair immediately${a.replacement_cost ? ` (Est. replacement cost: $${Number(a.replacement_cost).toLocaleString()})` : ''}`, navTo: 'assets' });
  });

  const in2yr = new Date(today); in2yr.setFullYear(in2yr.getFullYear() + 2);
  const assetsNearReplacement = d.assets.filter(a =>
    a.replacement_date &&
    new Date(a.replacement_date + 'T12:00:00') >= today &&
    new Date(a.replacement_date + 'T12:00:00') <= in2yr
  );
  assetsNearReplacement.forEach(a => {
    const yrs = ((new Date(a.replacement_date + 'T12:00:00') - today) / (1000 * 60 * 60 * 24 * 365)).toFixed(1);
    amberInsights.push({ text: `${a.name} due for replacement in ${yrs} year${yrs === '1.0' ? '' : 's'}${a.replacement_cost ? ` — est. $${Number(a.replacement_cost).toLocaleString()}` : ''}`, navTo: 'assets' });
  });

  if (stalledWorkflows.length === 1)
    redInsights.push({ text: `Workflow "${stalledWorkflows[0].name}" has had no progress in 14+ days — check if it needs attention`, navTo: 'workflows' });
  else if (stalledWorkflows.length > 1)
    redInsights.push({ text: `${stalledWorkflows.length} workflows have had no progress in 14+ days: ${stalledWorkflows.map(w => w.name).join(', ')}`, navTo: 'workflows' });

 // AMBER
  if (zeroStockItems.length > 0)
    amberInsights.push({ text: `📦 ${zeroStockItems.length} out of stock: ${zeroStockItems.map(a => a.name).join(', ')}`, navTo: 'assets' });

  // pendingBookings is surfaced in Decisions Required — not duplicated into Top Priorities
  if (pendingBookingIncomeCount > 0)
    amberInsights.push({ text: `${pendingBookingIncomeCount} booking income record${pendingBookingIncomeCount !== 1 ? 's need' : ' needs'} the hire fee entered — update in Finance`, navTo: 'finance' });

  if (activeWorkflowsWithSource.length === 1)
    amberInsights.push({ text: `Active: ${activeWorkflowsWithSource[0].name} (from ${activeWorkflowsWithSource[0].entity_name})`, navTo: 'workflows' });
  else if (activeWorkflowsWithSource.length > 1)
    amberInsights.push({ text: `${activeWorkflowsWithSource.length} active workflows running — ${activeWorkflowsWithSource.slice(0, 2).map(w => `${w.name} (from ${w.entity_name})`).join(', ')}${activeWorkflowsWithSource.length > 2 ? ` +${activeWorkflowsWithSource.length - 2} more` : ''}`, navTo: 'workflows' });


  const grantsSoon = d.grants.filter(g => g.deadline && !['approved','declined'].includes(g.status) && new Date(g.deadline + 'T12:00:00') > in7 && new Date(g.deadline + 'T12:00:00') <= in14);
  if (grantsSoon.length > 0) {
    const minDays = Math.min(...grantsSoon.map(g => Math.ceil((new Date(g.deadline + 'T12:00:00') - today) / (1000 * 60 * 60 * 24))));
    amberInsights.push({ text: `${grantsSoon.length} grant deadline${grantsSoon.length !== 1 ? 's' : ''} within ${minDays}–14 days — begin preparation`, navTo: 'grants' });
  }

  const soonReminders = d.reminders.filter(r => r.due_date && new Date(r.due_date + 'T12:00:00') >= today && new Date(r.due_date + 'T12:00:00') <= in14);
  if (soonReminders.length > 0)
    amberInsights.push({ text: `${soonReminders.length} service reminder${soonReminders.length !== 1 ? 's' : ''} due within 14 days — schedule maintenance soon`, navTo: 'assets' });

  if (dueSoonCompliance.length > 0)
    amberInsights.push({ text: `${dueSoonCompliance.length} compliance item${dueSoonCompliance.length !== 1 ? 's' : ''} due within 30 days — schedule renewals soon`, navTo: 'compliance' });

  if (goalsAtRisk.length > 0)
    amberInsights.push({ text: `${goalsAtRisk.length} strategic goal${goalsAtRisk.length !== 1 ? 's are' : ' is'} at risk — review progress and remove blockers`, navTo: 'goals' });

  if (d.actions.length > 3)
    amberInsights.push({ text: `${d.actions.length} open meeting actions outstanding — consider scheduling a follow-up session`, navTo: 'minutes' });

  if (avgRating !== null && avgRating < 4)
    amberInsights.push({ text: `Community rating is ${Number(avgRating).toFixed(1)}/5 — review recent feedback and identify areas for improvement`, navTo: 'bookings' });

  if (periodProjects.length === 0)
    amberInsights.push({ text: `No active projects — consider initiating planned work`, navTo: 'projects' });

  const nextHui = d.bookings.filter(b => b.occasion?.toLowerCase().includes('hui') && b.start_date >= todayStr).sort((a, b) => new Date(a.start_date) - new Date(b.start_date))[0];
  if (nextHui) {
    const daysToHui = Math.ceil((new Date(nextHui.start_date + 'T12:00:00') - today) / (1000 * 60 * 60 * 24));
    if (daysToHui <= 7)
      amberInsights.push({ text: `Your next hui is in ${daysToHui} day${daysToHui !== 1 ? 's' : ''} — ${d.actions.length} open action${d.actions.length !== 1 ? 's' : ''} to resolve beforehand`, navTo: 'minutes' });
  }
  // GREEN (max 2)
  if (d.goals.length > 0 && goalsBehind.length === 0 && goalsAtRisk.length === 0)
    greenInsights.push({ text: `All ${d.goals.length} strategic goal${d.goals.length !== 1 ? 's are' : ' is'} on track — excellent governance progress`, navTo: 'goals' });

  if (goalsComplete.length > 0 && d.goals.length > 0 && goalsComplete.length === d.goals.length)
    greenInsights.push({ text: `All strategic goals completed — outstanding achievement for the committee`, navTo: 'goals' });

  if (avgRating !== null && avgRating >= 4.5)
    greenInsights.push({ text: `Community satisfaction is strong at ${Number(avgRating).toFixed(1)}/5 — great work`, navTo: 'bookings' });

  if (compliantPct === 100)
    greenInsights.push({ text: `All assets are fully service-compliant`, navTo: 'assets' });

  if (d.compliance.length > 0 && overdueCompliance.length === 0 && dueSoonCompliance.length === 0)
    greenInsights.push({ text: `All compliance obligations are up to date`, navTo: 'compliance' });

  if (approvedGrantsAmt > 0)
    greenInsights.push({ text: `${fmtMoney(approvedGrantsAmt)} in grants secured ${pl.toLowerCase()} — excellent funding progress`, navTo: 'grants' });

  const totalPeriodBookings = d.bookings.filter(b => inPeriod(b.start_date)).length;
  if (totalPeriodBookings > 0 && Math.round((periodBookings.length / totalPeriodBookings) * 100) >= 90)
    greenInsights.push({ text: `${Math.round((periodBookings.length / totalPeriodBookings) * 100)}% of bookings this period have been approved`, navTo: 'bookings' });

  const normalizeInsight = (item, level) =>
    typeof item === 'string' ? { text: item, level } : { ...item, level };

  const INSIGHTS_ALL = [
    ...redInsights.map(item => normalizeInsight(item, 'red')),
    ...(d.activeInterestCount > 0 ? [{
      text: `${d.activeInterestCount} active conflict of interest declaration${d.activeInterestCount !== 1 ? 's' : ''} — review before next meeting`,
      level: 'amber',
      navTo: 'minutes',
    }] : []),
    ...amberInsights.map(item => normalizeInsight(item, 'amber')),
    ...greenInsights.slice(0, 1).map(item => normalizeInsight(item, 'green')),
  ];
  // Stage 4 (86d41pc93): real total preserved alongside the cap, dropped
  // from 5 to 3 for consistency with Focus This Week and Workflow Activity.
  const INSIGHTS_TOTAL = INSIGHTS_ALL.length;
  const INSIGHTS = INSIGHTS_ALL.slice(0, 3);

  // ─── AI REPORT ─────────────────────────────────────────────────────────────

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

    const { data, error } = await supabase.functions.invoke('generate-report', {
      body: { maraeName: d.maraeName, context },
    });

    setAiLoading(false);

    if (error) { setAiError(error.message || 'Could not reach AI service'); return; }
    if (data?.error) { setAiError(data.error); return; }

    setAiReport(data?.report || '');
    setShowReport(true);
  }

  function copyReport() {
    navigator.clipboard.writeText(aiReport).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // ─── AI FINANCIAL REPORT (14yhc7knp9n, Report #3) ───────────────────────────
  // Same shape as generateReport() above. Scoped totals mirror
  // printFinancialReport's own financeSection reduce exactly, not the
  // page-wide finTotalIncome/finTotalExpenses -- the report has to be
  // gated on, and describe, the same numbers (respecting reportEntityFilter
  // and the xeroConnected override), or a trustee viewing one specific
  // empty entity could see a report built from a different entity's data
  // while being told "no data."

  async function generateFinancialReport() {
    setFinAiLoading(true);
    setFinAiError('');
    setFinAiReport('');

    const scopedIncome   = xeroConnected ? finTotalIncome   : reportFinance.income.reduce((s, r) => s + parseFloat(r.amount || 0), 0);
    const scopedExpenses = xeroConnected ? finTotalExpenses : reportFinance.expenses.reduce((s, r) => s + parseFloat(r.amount || 0), 0);

    if (scopedIncome === 0 && scopedExpenses === 0) {
      setFinAiLoading(false);
      setFinAiReport(`Tēnā koutou\n\nNo financial data has been recorded yet — once income, expenses, or a budget are entered in the Finance module, this report will show a real analysis of ${d.maraeName}'s financial health.`);
      setShowFinReport(true);
      return;
    }

    const entityName = reportEntityName(reportEntityFilter);

    // $0.00 auto-generated booking stubs are real rows but not real income
    // yet -- same distinction Board View's own pendingBookingIncomeCount
    // insight already draws elsewhere in this file. Listed separately so
    // the report doesn't read them as zero-value transactions.
    const realIncomeRows = xeroConnected ? [] : reportFinance.income.filter(r => !(r.source_type === 'booking' && parseFloat(r.amount || 0) === 0 && r.status === 'Pending'));
    const pendingIncomeRows = xeroConnected ? [] : reportFinance.income.filter(r => r.source_type === 'booking' && parseFloat(r.amount || 0) === 0 && r.status === 'Pending');

    const incomeByCategory = {};
    realIncomeRows.forEach(r => { incomeByCategory[r.category] = (incomeByCategory[r.category] || 0) + parseFloat(r.amount || 0); });
    const expensesByCategory = {};
    (xeroConnected ? [] : reportFinance.expenses).forEach(r => { expensesByCategory[r.category] = (expensesByCategory[r.category] || 0) + parseFloat(r.amount || 0); });

    const bs = d.finBalanceSheet;

    const context = [
      `MARAE: ${d.maraeName}`,
      `DATE: ${new Date().toLocaleDateString('en-NZ')}`,
      `PERIOD: FY${d.fyYear} (1 Apr ${d.fyYear} – 31 Mar ${d.fyYear + 1})`,
      `ENTITY SCOPE: ${entityName}`,
      ``,
      `DATA SOURCE: ${xeroConnected ? `Xero (connected, last synced ${d.xero.lastSyncedAt || 'unknown'})` : 'Manual entry (Finance module)'}`,
      ``,
      `INCOME (Total: ${fmtMoney(scopedIncome)}):`,
      xeroConnected
        ? '- Category-level breakdown not available — Xero sync provides only the total.'
        : (Object.keys(incomeByCategory).length
            ? Object.entries(incomeByCategory).map(([c, amt]) => `- ${c}: ${fmtMoney(amt)}`).join('\n')
            : '- No categorised income recorded'),
      ...(xeroConnected ? [] : [
        `Individual entries (${realIncomeRows.length}):`,
        realIncomeRows.length
          ? realIncomeRows.map(r => `- ${fmt(r.date)} — ${r.description} (${fmtMoney(r.amount)}, ${r.category}, status: ${r.status})`).join('\n')
          : '- None',
      ]),
      ``,
      `PENDING BOOKING INCOME NOT YET ENTERED (${pendingIncomeRows.length}):`,
      pendingIncomeRows.length
        ? pendingIncomeRows.map(r => `- ${r.description} — hire fee not yet entered`).join('\n')
        : '- None',
      ``,
      `EXPENSES (Total: ${fmtMoney(scopedExpenses)}):`,
      xeroConnected
        ? '- Category-level breakdown not available — Xero sync provides only the total.'
        : (Object.keys(expensesByCategory).length
            ? Object.entries(expensesByCategory).map(([c, amt]) => `- ${c}: ${fmtMoney(amt)}`).join('\n')
            : '- No categorised expenses recorded'),
      ...(xeroConnected ? [] : [
        `Individual entries (${reportFinance.expenses.length}):`,
        reportFinance.expenses.length
          ? reportFinance.expenses.map(r => `- ${fmt(r.date)} — ${r.description} (${fmtMoney(r.amount)}, ${r.category}, payee: ${r.payee || 'unspecified'}, status: ${r.status})`).join('\n')
          : '- None',
      ]),
      ``,
      `NET POSITION: ${scopedIncome - scopedExpenses >= 0 ? 'Surplus' : 'Deficit'} of ${fmtMoney(Math.abs(scopedIncome - scopedExpenses))}`,
      ``,
      `BUDGET VARIANCE (FY${d.fyYear}):`,
      Object.keys(finBudgetMap).length
        ? Object.entries(finBudgetMap).map(([cat, budget]) => {
            const spent = finSpentMap[cat] || 0;
            const pct = budget > 0 ? Math.round((spent / budget) * 100) : 0;
            return `- ${cat}: budget ${fmtMoney(budget)}, spent ${fmtMoney(spent)} (${pct}%)${budget > 0 && spent > budget ? ' [OVER BUDGET]' : ''}`;
          }).join('\n')
        : '- No budget has been set for this financial year',
      ``,
      `BALANCE SHEET:`,
      bs
        ? [
            `- Cash Balance: ${fmtMoney(bs.cash_balance)}`,
            `- Loans: ${fmtMoney(bs.loans)}`,
            `- Other Assets: ${fmtMoney(bs.other_assets)}`,
            `- Outstanding Payments: ${fmtMoney(bs.outstanding_payments)}`,
          ].join('\n')
        : '- No balance sheet has been recorded yet',
      ``,
      `FINANCIAL TREND (monthly net assets, ${new Date().getFullYear()}):`,
      (d.kpiSnapshots || []).some(s => s.net_assets !== null)
        ? d.kpiSnapshots.filter(s => s.net_assets !== null).map(s => `- ${s.snapshot_month}: Net Assets ${fmtMoney(s.net_assets)}, Total Assets ${fmtMoney(s.total_assets)}, Total Liabilities ${fmtMoney(s.total_liabilities)}`).join('\n')
        : '- Not enough monthly history recorded yet to show a trend',
      ...(reportEntityFilter !== 'all' ? ['', `Note: Budget and Balance Sheet figures above are whole-marae totals and cannot be broken down by entity — only Income/Expenses are scoped to ${entityName}.`] : []),
    ].join('\n');

    const { data, error } = await supabase.functions.invoke('generate-financial-report', {
      body: { maraeName: d.maraeName, context },
    });

    setFinAiLoading(false);

    if (error) { setFinAiError(error.message || 'Could not reach AI service'); return; }
    if (data?.error) { setFinAiError(data.error); return; }

    setFinAiReport(data?.report || '');
    setShowFinReport(true);
  }

  function copyFinReport() {
    navigator.clipboard.writeText(finAiReport).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // ─── AI COMPLIANCE & SAFETY REPORT (14yhc7knp9n, Report #2) ─────────────────
  // Same shape as generateReport()/generateFinancialReport() above. Unlike
  // Report #3, deliberately NO zero-data gate -- "0 items outside the
  // onboarding checklist, 0 risks registered" is itself the safety-relevant
  // fact this report exists to surface, not a null case to hide behind a
  // static message (design decision, 86d3u7790 investigation 2026-08-30).
  //
  // Hazard-guidance coverage is sent to Claude as a count + type names only
  // -- never the actual likely_impact/what_to_do text. This is enforced
  // here, not just via the system prompt's instruction not to quote it: if
  // the boilerplate text is never in the context at all, there's nothing
  // for the model to paraphrase as a marae-specific assessment by mistake.

  async function generateComplianceReport() {
    setCompAiLoading(true);
    setCompAiError('');
    setCompAiReport('');

    const entityName = reportEntityName(reportEntityFilter);

    const COMPLIANCE_CATEGORIES = ['emergency_preparedness', 'water', 'building', 'insurance', 'trustee', 'health_safety', 'civil_defence', 'other'];
    const categoryLabel = c => c.replace(/_/g, ' ');

    const overallCompliance = getComplianceStatus(reportCompliance);
    const categoryBreakdown = COMPLIANCE_CATEGORIES.map(cat => {
      const items = reportCompliance.filter(c => c.category === cat);
      if (items.length === 0) return `- ${categoryLabel(cat)}: 0 items recorded`;
      const status = getComplianceStatus(items);
      return `- ${categoryLabel(cat)}: ${items.length} item${items.length !== 1 ? 's' : ''} — ${status.overdue.length} overdue, ${status.dueSoon.length} due soon, ${status.neverAssessed.length} never assessed, ${status.compliant.length} compliant`;
    }).join('\n');

    const { highOpen: reportHighOpenRisks, riskPct } = getRiskStatus(reportRisks);

    const documentedHazardTypes = [...new Set(
      reportHazards
        .filter(h => (h.likely_impact || '').trim() || (h.what_to_do || '').trim())
        .map(h => h.hazard_type)
    )];
    const allSeenHazardTypes = [...new Set(reportHazards.map(h => h.hazard_type))];
    const undocumentedHazardTypes = allSeenHazardTypes.filter(t => !documentedHazardTypes.includes(t));

    const context = [
      `MARAE: ${d.maraeName}`,
      `DATE: ${new Date().toLocaleDateString('en-NZ')}`,
      `ENTITY SCOPE: ${entityName}`,
      ``,
      `COMPLIANCE ITEMS (${reportCompliance.length} total, ${overallCompliance.compliancePct === null ? 'no items ever assessed' : `${overallCompliance.compliancePct}% of assessed items compliant`}):`,
      categoryBreakdown,
      ``,
      `RISK REGISTER (${reportRisks.length} total${reportRisks.length ? `, ${riskPct}% clear of high-rated risk` : ''}):`,
      reportRisks.length
        ? [`High-rated and open: ${reportHighOpenRisks.length}`, `Individual entries:`, ...reportRisks.map(r => `- ${r.risk_description} (category: ${r.category}, rating: ${r.risk_rating}, status: ${r.status}${r.review_date ? `, review due: ${r.review_date}` : ''})`)].join('\n')
        : '- No risks have ever been recorded in the risk register.',
      ``,
      `EMERGENCY HAZARD GUIDANCE COVERAGE (${documentedHazardTypes.length} of ${TOTAL_HAZARD_TYPES} defined hazard types have any guidance recorded):`,
      `- Documented: ${documentedHazardTypes.length ? documentedHazardTypes.join(', ') : 'None'}`,
      `- Not yet documented: ${(TOTAL_HAZARD_TYPES - documentedHazardTypes.length)} type${(TOTAL_HAZARD_TYPES - documentedHazardTypes.length) !== 1 ? 's' : ''}${undocumentedHazardTypes.length ? ` (of those with no row yet or empty guidance, seen: ${undocumentedHazardTypes.join(', ')})` : ''}`,
      `Note: where guidance exists, its content is a shared regional civil-defence template, not written specifically for this marae — this report deliberately does not include that text, only whether it exists.`,
    ].join('\n');

    const { data, error } = await supabase.functions.invoke('generate-compliance-report', {
      body: { maraeName: d.maraeName, context },
    });

    setCompAiLoading(false);

    if (error) { setCompAiError(error.message || 'Could not reach AI service'); return; }
    if (data?.error) { setCompAiError(data.error); return; }

    setCompAiReport(data?.report || '');
    setShowCompReport(true);
  }

  function copyComplianceReport() {
    navigator.clipboard.writeText(compAiReport).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function reportEntityName(entityId) {
    if (entityId === 'all') return 'All Entities';
    return (d.entities || []).find(e => e.id === entityId)?.name || 'Unknown Entity';
  }

  function printFinancialReport(entityId) {
    const entityName = reportEntityName(entityId);

    const financeSection = xeroConnected
      ? `<p style="font-size:12px;color:#a63020;font-style:italic">Finance is connected to Xero, whose totals cannot be broken down by entity — no per-entity Finance figures are available for this report.</p>`
      : (() => {
          const totalIncome   = reportFinance.income.reduce((s, r) => s + parseFloat(r.amount || 0), 0);
          const totalExpenses = reportFinance.expenses.reduce((s, r) => s + parseFloat(r.amount || 0), 0);
          const net = totalIncome - totalExpenses;
          return `<table>
            <tr><th>Category</th><th style="text-align:right">Amount</th></tr>
            <tr><td>Total Income</td><td style="text-align:right">${fmtMoney(totalIncome)}</td></tr>
            <tr><td>Total Expenses</td><td style="text-align:right">${fmtMoney(totalExpenses)}</td></tr>
            <tr style="font-weight:bold;border-top:2px solid #ccc"><td>${net >= 0 ? 'Net Surplus' : 'Net Deficit'}</td><td style="text-align:right">${fmtMoney(Math.abs(net))}</td></tr>
          </table>`;
        })();

    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html><head><title>Financial Report — ${entityName}</title>
<style>body{font-family:Georgia,serif;max-width:840px;margin:40px auto;color:#222;line-height:1.6}h1{font-size:24px;border-bottom:2px solid #1a4a3a;padding-bottom:8px}h2{font-size:16px;margin-top:28px;color:#1a4a3a}table{width:100%;border-collapse:collapse;margin:12px 0}th{text-align:left;padding:6px 8px;background:#f0f0f0;font-size:13px}td{padding:6px 8px;border-bottom:1px solid #eee;font-size:13px}</style>
</head><body>
<h1>Financial Report — ${entityName}</h1>
<p style="color:#666;font-size:13px">${d.maraeName} · Generated ${new Date().toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric' })}</p>

<h2>Finance</h2>
${financeSection}

<p style="font-size:11px;color:#999;margin-top:32px">Generated by MaraeHub · maraehub.com</p>
</body></html>`);
    win.document.close();
    win.print();
  }

  function printGovernanceReport(entityId) {
    const entityName = reportEntityName(entityId);
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const in30 = new Date(now); in30.setDate(in30.getDate() + 30);

    function complianceRowStatus(c) {
      if (c.due_date && new Date(c.due_date + 'T12:00:00') < now) return 'Overdue';
      if (c.due_date && new Date(c.due_date + 'T12:00:00') <= in30) return 'Due Soon';
      if (!c.due_date && !c.last_checked_date) return 'Never Assessed';
      return 'Compliant';
    }

    const complianceStatus = getComplianceStatus(reportCompliance);
    const complianceRows = reportCompliance.map(c => `
      <tr>
        <td>${c.name}</td>
        <td>${c.category}</td>
        <td>${fmt(c.due_date)}</td>
        <td>${complianceRowStatus(c)}</td>
      </tr>`).join('');

    const { highOpen: reportHighOpenRisks } = getRiskStatus(reportRisks);
    const riskRows = reportRisks.map(r => `
      <tr>
        <td>${stripUrls(r.risk_description)}</td>
        <td>${r.category}</td>
        <td>${r.risk_rating || '—'}</td>
        <td>${r.status}</td>
      </tr>`).join('');

    const assetRows = reportAssets.map(a => `
      <tr>
        <td>${a.name}</td>
        <td>${a.category}</td>
        <td>${a.location || 'No location'}</td>
        <td style="text-transform:capitalize">${a.condition || '—'}</td>
        <td style="text-align:right">${a.value ? '$' + Number(a.value).toLocaleString() : '—'}</td>
      </tr>`).join('');

    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html><head><title>Governance Report — ${entityName}</title>
<style>body{font-family:Georgia,serif;max-width:840px;margin:40px auto;color:#222;line-height:1.6}h1{font-size:24px;border-bottom:2px solid #1a4a3a;padding-bottom:8px}h2{font-size:16px;margin-top:28px;color:#1a4a3a}table{width:100%;border-collapse:collapse;margin:12px 0}th{text-align:left;padding:6px 8px;background:#f0f0f0;font-size:13px}td{padding:6px 8px;border-bottom:1px solid #eee;font-size:13px}.tiles{display:flex;gap:14px;margin:12px 0}.tile{flex:1;padding:10px 14px;border:1px solid #ddd;border-radius:6px;text-align:center}.tile .n{font-size:20px;font-weight:700}.tile .l{font-size:11px;color:#666}</style>
</head><body>
<h1>Governance Report — ${entityName}</h1>
<p style="color:#666;font-size:13px">${d.maraeName} · Generated ${new Date().toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric' })}</p>

<h2>Compliance</h2>
<div class="tiles">
  <div class="tile"><div class="n">${complianceStatus.overdue.length}</div><div class="l">Overdue</div></div>
  <div class="tile"><div class="n">${complianceStatus.dueSoon.length}</div><div class="l">Due Soon</div></div>
  <div class="tile"><div class="n">${complianceStatus.neverAssessed.length}</div><div class="l">Never Assessed</div></div>
  <div class="tile"><div class="n">${complianceStatus.compliant.length}</div><div class="l">Compliant</div></div>
  <div class="tile"><div class="n">${complianceStatus.compliancePct === null ? '—' : complianceStatus.compliancePct + '%'}</div><div class="l">% Compliant</div></div>
</div>
${reportCompliance.length === 0 ? '<p style="font-size:13px;color:#666">No compliance items for this entity.</p>' : `<table><tr><th>Item</th><th>Category</th><th>Due Date</th><th>Status</th></tr>${complianceRows}</table>`}

<h2>Risk Register</h2>
<p style="font-size:12px;color:#666">${reportRisks.length} risk${reportRisks.length !== 1 ? 's' : ''} · ${reportHighOpenRisks.length} High-rated and open</p>
${reportRisks.length === 0 ? '<p style="font-size:13px;color:#666">No risks recorded for this entity.</p>' : `<table><tr><th>Risk</th><th>Category</th><th>Rating</th><th>Status</th></tr>${riskRows}</table>`}

<h2>Assets</h2>
${reportAssets.length === 0 ? '<p style="font-size:13px;color:#666">No physical assets for this entity.</p>' : `<table><tr><th>Asset</th><th>Category</th><th>Location</th><th>Condition</th><th style="text-align:right">Value</th></tr>${assetRows}</table>`}

<p style="font-size:11px;color:#999;margin-top:32px">Generated by MaraeHub · maraehub.com</p>
</body></html>`);
    win.document.close();
    win.print();
  }

  function toggleComment(i) {
    setExpandedComments(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  // ─── RENDER ────────────────────────────────────────────────────────────────

  const { items: focusItems, total: focusItemsTotal, all: focusItemsAll } = buildFocusItems({
    overdueActions, overdueReminders, finNet, highOpenRisks,
    assets: d.assets, today, truncate, fmtMoney,
  });

  // Stage 5 (86d41pc93) -- locked-month-over-month trend, null until 2+
  // months exist. d.kpiSnapshots is already sorted ascending by snapshot_month.
  const kpiTrendPair = d.kpiSnapshots.length >= 2
    ? [d.kpiSnapshots[d.kpiSnapshots.length - 2], d.kpiSnapshots[d.kpiSnapshots.length - 1]]
    : null;
  const complianceTrend = getTrend(kpiTrendPair, 'compliance_pct');
  const riskTrend       = getTrend(kpiTrendPair, 'risk_pct');
  const goalsTrend      = getTrend(kpiTrendPair, 'goals_pct');
  const serviceTrend    = getTrend(kpiTrendPair, 'assets_pct');

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
          <div style={{ fontSize: 14, color: 'var(--text3)' }}>{d.maraeName} · {todayDisplay}</div>
        </div>
        <div className="no-print" style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={generateReport}
            disabled={aiLoading}
            style={{ background: aiLoading ? '#a0a0a0' : '#5a3e8a', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 14, fontWeight: 600, cursor: aiLoading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            {aiLoading ? '⏳ Generating…' : '✨ AI Governance Report'}
          </button>
          {isAdmin && (
          <button
            onClick={generateFinancialReport}
            disabled={finAiLoading}
            style={{ background: finAiLoading ? '#a0a0a0' : '#5a3e8a', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 14, fontWeight: 600, cursor: finAiLoading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            {finAiLoading ? '⏳ Generating…' : '✨ AI Financial Report'}
          </button>
          )}
          <button
            onClick={generateComplianceReport}
            disabled={compAiLoading}
            style={{ background: compAiLoading ? '#a0a0a0' : '#5a3e8a', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 14, fontWeight: 600, cursor: compAiLoading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            {compAiLoading ? '⏳ Generating…' : '✨ AI Compliance Report'}
          </button>
          {(d.entities || []).length > 0 && (
            <select
              className="no-print"
              value={reportEntityFilter}
              onChange={e => setReportEntityFilter(e.target.value)}
              style={{ fontSize: 14, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text2)', fontFamily: 'DM Sans, sans-serif', cursor: 'pointer' }}
            >
              <option value="all">All Entities</option>
              {d.entities.map(ent => <option key={ent.id} value={ent.id}>{ent.name}</option>)}
            </select>
          )}
          <button
            onClick={() => printFinancialReport(reportEntityFilter)}
            style={{ background: 'var(--surface2)', color: 'var(--text2)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            💰 Financial Report
          </button>
          <button
            onClick={() => printGovernanceReport(reportEntityFilter)}
            style={{ background: 'var(--surface2)', color: 'var(--text2)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            📋 Governance Report
          </button>
          <button
            onClick={() => window.print()}
            style={{ background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            🖨️ Print
          </button>
        </div>
      </div>

      {/* ── SUMMARY STRIP — reuses the 6 StatusCard levels/numbers/messages, computes nothing new ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px 16px', padding: '10px 14px', marginBottom: 18, background: 'var(--surface2)', borderRadius: 8 }}>
        {[
          {
            icon: '📋', label: 'Compliance', level: complianceLevel, navTo: 'compliance',
            // Fraction, not complianceNumber/Message -- compliant/assessed, consistent
            // with the compliancePct fix (never-assessed excluded from the denominator).
            detail: `${panelCompliantComplianceArr.length}/${complianceForPanel.length - panelNeverAssessedCompliance.length}`,
          },
          { icon: '🛡️', label: 'Risk', level: riskLevel, navTo: 'risks', detail: `${riskNumber} ${riskMessage}` },
          { icon: '🎯', label: 'Goals', level: goalsLevel, navTo: 'goals', detail: `${goalsNumber} ${goalsMessage}` },
          ...(isAdmin ? [{ icon: '📊', label: 'Finance', level: financeLevel, navTo: 'finance', detail: `${financeNumber} ${financeMessage}` }] : []),
          { icon: '💰', label: 'Grants', level: grantsLevel, navTo: 'grants', detail: `${grantsNumber} ${grantsMessage}` },
          { icon: '🔧', label: 'Assets', level: serviceLevel, navTo: 'assets', detail: `${serviceNumber} ${serviceMessage}` },
        ].map(m => (
          <span
            key={m.label}
            onClick={() => onNavigate && onNavigate(m.navTo)}
            style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 14, fontWeight: 600, color: 'var(--text2)', cursor: onNavigate ? 'pointer' : 'default' }}
          >
            {m.icon} {m.label} {LEVEL_EMOJI[m.level]}
            <span style={{ fontWeight: 400, color: 'var(--text3)' }}>{m.detail}</span>
          </span>
        ))}
      </div>

      {/* ── FOCUS THIS WEEK (ClickUp 86d3vc4yp) ──────────────────────────── */}
      <FocusThisWeekCard items={focusItems} total={focusItemsTotal} allItems={focusItemsAll} onNavigate={onNavigate} />

      {/* ── AI GOVERNANCE REPORT MODAL ─────────────────────────────────── */}
      {(showReport || aiError) && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 20px', overflowY: 'auto' }}>
          <div style={{ background: 'var(--surface)', borderRadius: 12, width: '100%', maxWidth: 720, padding: 32, position: 'relative', boxShadow: '0 8px 40px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, margin: 0, color: 'var(--brand)' }}>✨ AI Governance Report</h2>
              <div style={{ display: 'flex', gap: 8 }}>
                {aiReport && (
                  <button
                    onClick={copyReport}
                    style={{ background: copied ? '#e8f4ef' : 'var(--surface2)', color: copied ? 'var(--brand)' : 'var(--text2)', border: '1px solid var(--border)', borderRadius: 7, padding: '6px 14px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
                  >
                    {copied ? '✅ Copied' : '📋 Copy'}
                  </button>
                )}
                <button
                  onClick={() => { setShowReport(false); setAiError(''); setAiReport(''); }}
                  style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 7, padding: '6px 12px', fontSize: 14, cursor: 'pointer', color: 'var(--text2)', fontWeight: 600 }}
                >
                  ✕
                </button>
              </div>
            </div>
            {aiError ? (
              <div style={{ background: '#faeae7', border: '1px solid #f0b8b0', borderRadius: 8, padding: '14px 16px', color: 'var(--danger)', fontSize: 14 }}>{aiError}</div>
            ) : (
              <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--text1)', whiteSpace: 'pre-wrap' }}>{aiReport}</div>
            )}
          </div>
        </div>
      )}

      {/* ── AI FINANCIAL REPORT MODAL ──────────────────────────────────── */}
      {(showFinReport || finAiError) && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 20px', overflowY: 'auto' }}>
          <div style={{ background: 'var(--surface)', borderRadius: 12, width: '100%', maxWidth: 720, padding: 32, position: 'relative', boxShadow: '0 8px 40px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, margin: 0, color: 'var(--brand)' }}>✨ AI Financial Report</h2>
              <div style={{ display: 'flex', gap: 8 }}>
                {finAiReport && (
                  <button
                    onClick={copyFinReport}
                    style={{ background: copied ? '#e8f4ef' : 'var(--surface2)', color: copied ? 'var(--brand)' : 'var(--text2)', border: '1px solid var(--border)', borderRadius: 7, padding: '6px 14px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
                  >
                    {copied ? '✅ Copied' : '📋 Copy'}
                  </button>
                )}
                <button
                  onClick={() => { setShowFinReport(false); setFinAiError(''); setFinAiReport(''); }}
                  style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 7, padding: '6px 12px', fontSize: 14, cursor: 'pointer', color: 'var(--text2)', fontWeight: 600 }}
                >
                  ✕
                </button>
              </div>
            </div>
            {finAiError ? (
              <div style={{ background: '#faeae7', border: '1px solid #f0b8b0', borderRadius: 8, padding: '14px 16px', color: 'var(--danger)', fontSize: 14 }}>{finAiError}</div>
            ) : (
              <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--text1)', whiteSpace: 'pre-wrap' }}>{finAiReport}</div>
            )}
          </div>
        </div>
      )}

      {/* ── AI COMPLIANCE REPORT MODAL ─────────────────────────────────── */}
      {(showCompReport || compAiError) && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 20px', overflowY: 'auto' }}>
          <div style={{ background: 'var(--surface)', borderRadius: 12, width: '100%', maxWidth: 720, padding: 32, position: 'relative', boxShadow: '0 8px 40px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, margin: 0, color: 'var(--brand)' }}>✨ AI Compliance Report</h2>
              <div style={{ display: 'flex', gap: 8 }}>
                {compAiReport && (
                  <button
                    onClick={copyComplianceReport}
                    style={{ background: copied ? '#e8f4ef' : 'var(--surface2)', color: copied ? 'var(--brand)' : 'var(--text2)', border: '1px solid var(--border)', borderRadius: 7, padding: '6px 14px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
                  >
                    {copied ? '✅ Copied' : '📋 Copy'}
                  </button>
                )}
                <button
                  onClick={() => { setShowCompReport(false); setCompAiError(''); setCompAiReport(''); }}
                  style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 7, padding: '6px 12px', fontSize: 14, cursor: 'pointer', color: 'var(--text2)', fontWeight: 600 }}
                >
                  ✕
                </button>
              </div>
            </div>
            {compAiError ? (
              <div style={{ background: '#faeae7', border: '1px solid #f0b8b0', borderRadius: 8, padding: '14px 16px', color: 'var(--danger)', fontSize: 14 }}>{compAiError}</div>
            ) : (
              <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--text1)', whiteSpace: 'pre-wrap' }}>{compAiReport}</div>
            )}
          </div>
        </div>
      )}


      {/* ── PERIOD TOGGLE ──────────────────────────────────────────────── */}
      <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Period</span>
        <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          {PERIODS.map((p, i) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setPeriod(p.key)}
              style={{
                padding: '7px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
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

      {/* ══════════════════════════ TOP PRIORITIES ══════════════════════════ */}
      <GroupHeading title="Top Priorities" />

      {/* ── SMART INSIGHTS ─────────────────────────────────────────────── */}
      {(INSIGHTS.length > 0 || d.workflowInstances.length > 0) && (
        <div className="panel" style={{ marginBottom: 20 }}>
          <SectionTitle icon="💡" title="Top Priorities" count={INSIGHTS.length || undefined} />
          {INSIGHTS.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {INSIGHTS.map((ins, i) => <InsightRow key={i} ins={ins} onNavigate={onNavigate} />)}
              {INSIGHTS_TOTAL > INSIGHTS.length && (
                <div style={{ marginTop: 2 }}>
                  <button
                    type="button"
                    onClick={() => setShowMorePriorities(s => !s)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                      background: 'var(--surface2)', border: '1px solid var(--border)',
                      borderRadius: 8, padding: '10px 16px', cursor: 'pointer',
                      fontSize: 14, fontWeight: 600, color: 'var(--text2)',
                      fontFamily: 'DM Sans, sans-serif',
                    }}
                  >
                    <span>{showMorePriorities ? '▲' : '▼'}</span>
                    <span>+{INSIGHTS_TOTAL - INSIGHTS.length} more priorities</span>
                  </button>
                  {showMorePriorities && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                      {INSIGHTS_ALL.slice(INSIGHTS.length).map((ins, i) => <InsightRow key={i} ins={ins} onNavigate={onNavigate} />)}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          {d.workflowInstances.length > 0 && (
            <div style={{ marginTop: INSIGHTS.length > 0 ? 14 : 0, paddingTop: INSIGHTS.length > 0 ? 12 : 0, borderTop: INSIGHTS.length > 0 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Workflow Activity</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ textAlign: 'center', padding: '7px 14px', background: '#e8eef8', borderRadius: 8, borderTop: '3px solid #1a4a8a', minWidth: 72 }}>
                  <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 18, fontWeight: 700, color: '#1a4a8a', lineHeight: 1 }}>{activeWorkflows.length}</div>
                  <div style={{ fontSize: 14, color: '#1a4a8a', fontWeight: 600, marginTop: 2 }}>Active</div>
                </div>
                <div style={{ textAlign: 'center', padding: '7px 14px', background: '#e8f4ef', borderRadius: 8, borderTop: '3px solid #2e7d52', minWidth: 72 }}>
                  <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 18, fontWeight: 700, color: '#1a4a3a', lineHeight: 1 }}>{completedWorkflowsThisMonth.length}</div>
                  <div style={{ fontSize: 14, color: '#1a4a3a', fontWeight: 600, marginTop: 2 }}>Done this month</div>
                </div>
                {activeWorkflows.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginLeft: 4 }}>
                    {(showMoreWorkflows ? activeWorkflows : activeWorkflows.slice(0, 3)).map(w => (
                      <div key={w.id} style={{ fontSize: 14, color: 'var(--text2)', display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#1a4a8a', flexShrink: 0, display: 'inline-block' }} />
                        {w.name}{w.entity_name && <span style={{ color: 'var(--text3)' }}> · {w.entity_name}</span>}
                      </div>
                    ))}
                    {activeWorkflows.length > 3 && (
                      <button
                        type="button"
                        onClick={() => setShowMoreWorkflows(s => !s)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6, width: 'fit-content',
                          background: 'var(--surface2)', border: '1px solid var(--border)',
                          borderRadius: 6, padding: '4px 10px', cursor: 'pointer',
                          fontSize: 14, fontWeight: 600, color: 'var(--text2)',
                          fontFamily: 'DM Sans, sans-serif', marginTop: 2,
                        }}
                      >
                        <span>{showMoreWorkflows ? '▲' : '▼'}</span>
                        <span>{showMoreWorkflows ? 'Show less' : `+${activeWorkflows.length - 3} more active`}</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════ COMPLIANCE ══════════════════════════ */}
      <GroupHeading title="Compliance" />

      {/* ── COMPLIANCE TRACKER ─────────────────────────────────────────── */}
      <StatusCard
        icon="📋"
        title="Compliance Tracker"
        level={complianceLevel}
        number={complianceNumber}
        message={complianceMessage}
        trend={complianceTrend}
        rightContent={(d.entities || []).length > 0 && (
          <select
            className="no-print"
            value={complianceEntityFilter}
            onChange={e => setComplianceEntityFilter(e.target.value)}
            style={{ fontSize: 14, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text2)', fontFamily: 'DM Sans, sans-serif', cursor: 'pointer' }}
          >
            <option value="all">All Entities</option>
            {d.entities.map(ent => <option key={ent.id} value={ent.id}>{ent.name}</option>)}
          </select>
        )}
      >
        {complianceForPanel.length === 0 ? (
          <div style={{ fontSize: 14, color: 'var(--text3)', fontStyle: 'italic' }}>Add items in the Compliance tab</div>
        ) : (
          <>
            {/* Secondary detail — existing 5-stat grid, kept as-is, always shown when items exist */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 14 }}>
              {[
                { label: 'Overdue',   count: panelOverdueCompliance.length,  dot: '#d9534f', bg: '#faeae7', color: '#a63020' },
                { label: 'Due Soon',  count: panelDueSoonCompliance.length,  dot: '#c8902a', bg: '#fdf0dc', color: '#7a4f00' },
                { label: 'Never Assessed', count: panelNeverAssessedCompliance.length, dot: '#7a7268', bg: '#f5f0e8', color: 'var(--text3)' },
                { label: 'Compliant', count: panelCompliantComplianceArr.length, dot: '#2e7d52', bg: '#e8f4ef', color: '#1a4a3a' },
                { label: '% Compliant', count: panelCompliancePct === null ? '—' : `${panelCompliancePct}%`, dot: '#4a6fa5', bg: '#eaf0fa', color: '#1a4a8a' },
              ].map(s => (
                <div key={s.label} style={{ textAlign: 'center', padding: '8px 4px', background: s.bg, borderRadius: 8, borderTop: `3px solid ${s.dot}` }}>
                  <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.count}</div>
                  <div style={{ fontSize: 14, color: s.color, fontWeight: 600, marginTop: 3 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Flagged items — overdue + due soon, shown whenever either exists */}
            {(panelOverdueCompliance.length > 0 || panelDueSoonCompliance.length > 0) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: panelNeverAssessedCompliance.length > 0 ? 14 : 0 }}>
                {[...panelOverdueCompliance, ...panelDueSoonCompliance].slice(0, 3).map(c => {
                  const overdue = new Date(c.due_date + 'T12:00:00') < today;
                  const dot   = overdue ? '#d9534f' : '#c8902a';
                  const bg    = overdue ? '#faeae7' : '#fdf0dc';
                  const daysLeft = Math.ceil((new Date(c.due_date + 'T12:00:00') - today) / 86400000);
                  return (
                    <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: overdue ? '9px 12px' : '7px 10px', background: bg, borderRadius: 7, borderLeft: `${overdue ? 4 : 3}px solid ${dot}`, gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                        <div style={{ fontSize: 14, color: overdue ? dot : 'var(--text3)', marginTop: 1 }}>
                          {overdue ? `${Math.abs(daysLeft)}d overdue` : daysLeft === 0 ? 'Due today' : `Due in ${daysLeft}d`} · {fmt(c.due_date)}
                        </div>
                        <OwnerLine owner={c.responsible_name} color={overdue ? dot : 'var(--text3)'} navTo="compliance" onNavigate={onNavigate} />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        <span style={{ fontSize: 14, background: 'rgba(255,255,255,0.7)', color: dot, borderRadius: 20, padding: '2px 8px', fontWeight: 700 }}>
                          {overdue ? 'Overdue' : 'Due Soon'}
                        </span>
                        {onNavigate && (
                          <button
                            onClick={() => onNavigate('compliance')}
                            style={{ fontSize: 14, background: 'rgba(255,255,255,0.6)', color: dot, border: `1px solid ${dot}`, borderRadius: 6, padding: '3px 10px', fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
                          >
                            {NAV_LABELS.compliance}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                <ViewAllLink shown={3} total={panelOverdueCompliance.length + panelDueSoonCompliance.length} navTo="compliance" onNavigate={onNavigate} />
              </div>
            )}

            {/* Never-assessed — collapsible sub-section, unchanged behavior, shown whenever any exist */}
            {panelNeverAssessedCompliance.length > 0 && (
              !showNeverAssessedDetail ? (
                <div
                  onClick={() => setShowNeverAssessedDetail(true)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', background: '#f5f0e8', borderRadius: 7, cursor: 'pointer' }}
                >
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text3)' }}>
                    📋 {panelNeverAssessedCompliance.length} item{panelNeverAssessedCompliance.length !== 1 ? 's' : ''} never assessed — click to see
                  </span>
                  <span style={{ fontSize: 14, color: 'var(--text3)' }}>▼</span>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text3)' }}>
                      📋 {panelNeverAssessedCompliance.length} item{panelNeverAssessedCompliance.length !== 1 ? 's' : ''} never assessed — no due date, never checked:
                    </span>
                    <span onClick={() => setShowNeverAssessedDetail(false)} style={{ fontSize: 14, color: 'var(--text3)', cursor: 'pointer' }}>▲ Hide</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {panelNeverAssessedCompliance.map(c => (
                      <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', background: '#f5f0e8', borderRadius: 7, borderLeft: '3px solid #7a7268', gap: 8 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                          <div style={{ fontSize: 14, color: 'var(--text3)', marginTop: 1 }}>No due date set · never checked</div>
                          <OwnerLine owner={c.responsible_name} color="var(--text3)" navTo="compliance" onNavigate={onNavigate} />
                        </div>
                        {onNavigate && (
                          <button
                            onClick={() => onNavigate('compliance')}
                            style={{ fontSize: 14, background: 'rgba(255,255,255,0.6)', color: '#7a7268', border: '1px solid #7a7268', borderRadius: 6, padding: '3px 10px', fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
                          >
                            {NAV_LABELS.compliance}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )
            )}

            {complianceLevel === 'green' && (
              <div style={{ fontSize: 14, color: '#1a4a3a', fontWeight: 500 }}>
                ✅ {panelCompliantComplianceArr.length} item{panelCompliantComplianceArr.length !== 1 ? 's' : ''} compliant, none overdue
              </div>
            )}
          </>
        )}
      </StatusCard>

      {/* ── RISK REGISTER (folded into Compliance) ─────────────────────── */}
      <StatusCard
        icon="🛡️"
        title="Risk Register"
        level={riskLevel}
        number={riskNumber}
        message={riskMessage}
        trend={riskTrend}
        rightContent={
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {panelHighOpenRisks.length > 0 && (
              <span
                onClick={() => setShowFullRisks(v => !v)}
                style={{ fontSize: 14, color: 'var(--text3)', cursor: 'pointer', fontWeight: 600 }}
              >
                {showFullRisks ? 'Show shorter risks' : 'Show full risks'}
              </span>
            )}
            {(d.entities || []).length > 0 && (
              <select
                className="no-print"
                value={riskEntityFilter}
                onChange={e => setRiskEntityFilter(e.target.value)}
                style={{ fontSize: 14, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text2)', fontFamily: 'DM Sans, sans-serif', cursor: 'pointer' }}
              >
                <option value="all">All Entities</option>
                {d.entities.map(ent => <option key={ent.id} value={ent.id}>{ent.name}</option>)}
              </select>
            )}
          </div>
        }
      >
        {risksForPanel.length === 0 ? (
          <div style={{ fontSize: 14, color: 'var(--text3)', fontStyle: 'italic' }}>Add risks in the Risk Register tab</div>
        ) : panelHighOpenRisks.length === 0 ? (
          <div style={{ fontSize: 14, color: '#1a4a3a', background: '#e8f4ef', borderRadius: 7, padding: '8px 12px', fontWeight: 500 }}>
            ✅ No high-rated open risks
            {panelOpenRisks.length > 0 ? ` · ${panelRiskControlsPct}% of open risks have controls listed` : ''}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 14, color: 'var(--text3)', marginBottom: 2 }}>
              {panelRiskControlsPct}% of open risks have controls listed
            </div>
            {panelHighOpenRisks.slice(0, 3).map(r => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', background: '#faeae7', borderRadius: 7, borderLeft: '3px solid #d9534f', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    ⚠️ {showFullRisks ? stripUrls(r.risk_description) : truncate(stripUrls(r.risk_description))}
                  </div>
                  <div style={{ fontSize: 14, color: 'var(--text3)', marginTop: 1 }}>
                    {r.category} · {r.status}{r.review_date && ` · Review by ${fmt(r.review_date)}`}
                  </div>
                  <OwnerLine owner={r.owner} color="#a63020" navTo="risks" onNavigate={onNavigate} />
                </div>
                <span style={{ fontSize: 14, background: 'rgba(255,255,255,0.7)', color: '#a63020', borderRadius: 20, padding: '2px 8px', fontWeight: 700, flexShrink: 0 }}>High</span>
                {onNavigate && (
                  <button
                    onClick={() => onNavigate('risks')}
                    style={{ fontSize: 14, background: 'rgba(255,255,255,0.6)', color: '#a63020', border: '1px solid #f0b8b0', borderRadius: 6, padding: '3px 10px', fontWeight: 700, cursor: 'pointer', flexShrink: 0, fontFamily: 'DM Sans, sans-serif' }}
                  >
                    {NAV_LABELS.risks}
                  </button>
                )}
              </div>
            ))}
            <ViewAllLink shown={3} total={panelHighOpenRisks.length} navTo="risks" onNavigate={onNavigate} />
          </div>
        )}
        {onNavigate && risksForPanel.length > 0 && (
          <button
            onClick={() => onNavigate('risks')}
            style={{ marginTop: 10, fontSize: 14, background: 'none', border: '1px solid var(--border)', color: 'var(--brand)', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', fontWeight: 600 }}
          >
            View Risk Register →
          </button>
        )}
      </StatusCard>

      {/* ══════════════════════════ DECISIONS REQUIRED ══════════════════════════ */}
      <GroupHeading title="Decisions Required" />

      {(pendingBookings.length > 0 || overdueActions.length > 0 || grantsUrgent.length > 0 || openResolutions.length > 0) && (
        <div className="panel" style={{ marginBottom: 20, borderTop: '3px solid var(--danger)' }}>
          <SectionTitle
            icon="🔔"
            title="Decisions Required"
            count={pendingBookings.length + overdueActions.length + grantsUrgent.length + openResolutions.length}
            rightContent={overdueActions.length > 0 && (
              <span
                onClick={() => setShowFullActions(v => !v)}
                style={{ fontSize: 14, color: 'var(--text3)', cursor: 'pointer', fontWeight: 600 }}
              >
                {showFullActions ? 'Show shorter actions' : 'Show full actions'}
              </span>
            )}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pendingBookings.map(b => (
              <div key={b.id} style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                background: '#fdf0dc',
                border: '1px solid #e8c880',
                borderLeft: '4px solid var(--warning)',
                borderRadius: 7,
                gap: 12,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: 'var(--text1)',
                  }}>
                    Booking awaiting approval — {b.occasion}
                  </div>
                  <div style={{ fontSize: 14, color: 'var(--text3)', marginTop: 2 }}>
                    {fmt(b.start_date)} · {b.guests} guests
                  </div>
                </div>
                {onNavigate && (
                  <button
                    onClick={() => onNavigate('bookings')}
                    style={{
                      fontSize: 14,
                      background: '#fff',
                      color: '#7a4f00',
                      border: '1px solid #e8c880',
                      borderRadius: 6,
                      padding: '5px 12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      flexShrink: 0,
                      fontFamily: 'DM Sans, sans-serif',
                    }}
                  >Review →</button>
                )}
              </div>
            ))}
            {overdueActions.map(a => (
              <div key={a.id} style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                background: '#faeae7',
                border: '1px solid #f0b8b0',
                borderLeft: '4px solid var(--danger)',
                borderRadius: 7,
                gap: 12,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: 'var(--text1)',
                  }}>
                    Meeting action overdue — {showFullActions ? stripUrls(a.description) : truncate(stripUrls(a.description))}
                  </div>
                  <div style={{ fontSize: 14, color: 'var(--danger)', marginTop: 2 }}>
                    Assigned to {a.assigned_to || 'unassigned'} · Due {fmt(a.due_date)}
                  </div>
                </div>
                {onNavigate && (
                  <button
                    onClick={() => onNavigate('minutes')}
                    style={{
                      fontSize: 14,
                      background: '#fff',
                      color: '#a63020',
                      border: '1px solid #f0b8b0',
                      borderRadius: 6,
                      padding: '5px 12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      flexShrink: 0,
                      fontFamily: 'DM Sans, sans-serif',
                    }}
                  >View Minutes →</button>
                )}
              </div>
            ))}
            {grantsUrgent.map(g => {
              const daysLeft = Math.ceil(
                (new Date(g.deadline + 'T12:00:00') - today) / (1000 * 60 * 60 * 24)
              );
              return (
                <div key={g.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  background: '#faeae7',
                  border: '1px solid #f0b8b0',
                  borderLeft: '4px solid var(--danger)',
                  borderRadius: 7,
                  gap: 12,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: 'var(--text1)',
                    }}>
                      Grant deadline in {daysLeft} day{daysLeft !== 1 ? 's' : ''} — {g.name}
                    </div>
                    <div style={{ fontSize: 14, color: 'var(--danger)', marginTop: 2 }}>
                      {g.funder} · {fmtMoney(g.amount)} · Due {fmt(g.deadline)}
                    </div>
                  </div>
                  {onNavigate && (
                    <button
                      onClick={() => onNavigate('grants')}
                      style={{
                        fontSize: 14,
                        background: '#fff',
                        color: '#a63020',
                        border: '1px solid #f0b8b0',
                        borderRadius: 6,
                        padding: '5px 12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        flexShrink: 0,
                        fontFamily: 'DM Sans, sans-serif',
                      }}
                    >View Grants →</button>
                  )}
                </div>
              );
            })}
            {openResolutions.map(r => (
              <div key={r.id} style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                background: '#fdf0dc',
                border: '1px solid #e8c880',
                borderLeft: '4px solid var(--warning)',
                borderRadius: 7,
                gap: 12,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: 'var(--text1)',
                  }}>
                    Resolution awaiting action — {r.description}
                  </div>
                  <div style={{ fontSize: 14, color: 'var(--text3)', marginTop: 2 }}>
                    {r.resolution_number ? `${r.resolution_number} · ` : ''}Passed {fmt(r.date_passed)} · {r.status}
                  </div>
                </div>
                {onNavigate && (
                  <button
                    onClick={() => onNavigate('minutes')}
                    style={{
                      fontSize: 14,
                      background: '#fff',
                      color: '#7a4f00',
                      border: '1px solid #e8c880',
                      borderRadius: 6,
                      padding: '5px 12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      flexShrink: 0,
                      fontFamily: 'DM Sans, sans-serif',
                    }}
                  >Review →</button>
                )}
              </div>
            ))}
            {d.actions.length > overdueActions.length && onNavigate && (
              <div
                onClick={() => onNavigate('minutes')}
                style={{
                  fontSize: 14,
                  color: 'var(--brand)',
                  fontWeight: 600,
                  padding: '4px 14px',
                  cursor: 'pointer',
                }}
              >
                +{d.actions.length - overdueActions.length} more open action{d.actions.length - overdueActions.length !== 1 ? 's' : ''}, not yet due →
              </div>
            )}
          </div>
        </div>
      )}
      {/* ══════════════════════════ OPERATIONS ══════════════════════════ */}
      <GroupHeading title="Operations" />

      {/* ── TWO-COLUMN: BOOKINGS + PROJECTS ────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>

        {/* ── UPCOMING BOOKINGS ──────────────────────────────────────── */}
        <div className="panel">
          <SectionTitle icon="📅" title="Upcoming Bookings" count={periodUpcoming.length} note={`(${pl})`} />
          {periodUpcoming.length === 0 ? (
            <div style={{ fontSize: 14, color: 'var(--text3)', fontStyle: 'italic' }}>No upcoming bookings for this period</div>
          ) : periodUpcoming.map(b => (
            <div key={b.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--cream2)' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{b.occasion}</div>
                <div style={{ fontSize: 14, color: 'var(--text3)' }}>{fmt(b.start_date)}{b.end_date !== b.start_date ? ` → ${fmt(b.end_date)}` : ''} · {b.guests} guests</div>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: 14, background: '#e8f4ef', color: '#1a4a3a', borderRadius: 20, padding: '2px 8px', fontWeight: 600 }}>Approved</span>
                {onNavigate && (
                  <button
                    onClick={() => onNavigate('bookings')}
                    style={{ fontSize: 14, background: 'none', border: '1px solid var(--border)', color: 'var(--brand)', borderRadius: 6, padding: '3px 10px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', fontWeight: 600 }}
                  >
                    {NAV_LABELS.bookings}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* ── ACTIVE PROJECTS ────────────────────────────────────────── */}
        <div className="panel">
          <SectionTitle icon="📋" title="Active Projects" count={periodProjects.length} />
          {periodProjects.length === 0 ? (
            <div style={{ fontSize: 14, color: 'var(--text3)', fontStyle: 'italic' }}>No active projects started in this period</div>
          ) : periodProjects.map(p => {
            const overdue = p.due_date && p.status !== 'completed' && new Date(p.due_date) < today;
            return (
              <div key={p.id} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>
                    {p.name}
                    {overdue && <span style={{ fontSize: 14, background: '#faeae7', color: 'var(--danger)', borderRadius: 4, padding: '1px 5px', marginLeft: 6, fontWeight: 700 }}>OVERDUE</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--brand)' }}>{p.progress || 0}%</span>
                    {onNavigate && (
                      <button
                        onClick={() => onNavigate('projects')}
                        style={{ fontSize: 14, background: 'none', border: '1px solid var(--border)', color: 'var(--brand)', borderRadius: 6, padding: '2px 8px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', fontWeight: 600 }}
                      >
                        {NAV_LABELS.projects}
                      </button>
                    )}
                  </div>
                </div>
                {p.lead && <div style={{ fontSize: 14, color: 'var(--text3)', marginBottom: 4 }}>👤 {p.lead}{p.due_date && ` · Due ${fmt(p.due_date)}`}</div>}
                <div style={{ height: 6, background: 'var(--cream2)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${p.progress || 0}%`, background: 'var(--brand-light)', borderRadius: 3 }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ══════════════════════════ GOVERNANCE ══════════════════════════ */}
      <GroupHeading title="Governance" />

      {/* ── STRATEGIC GOALS SUMMARY ──────────────────────────────────── */}
      <StatusCard icon="🎯" title="Strategic Goals" level={goalsLevel} number={goalsNumber} message={goalsMessage} trend={goalsTrend}>
        {d.goals.length === 0 ? (
          <div style={{ fontSize: 14, color: 'var(--text3)', fontStyle: 'italic' }}>Add goals in the Goals tab</div>
        ) : goalsBehind.length === 0 && goalsAtRisk.length === 0 ? (
          <div style={{ fontSize: 14, color: '#1a4a3a', background: '#e8f4ef', borderRadius: 7, padding: '8px 12px', fontWeight: 500 }}>
            ✅ All goals are on track or completed
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 14 }}>
              {[
                { label: 'On Track',    count: goalsOnTrack.length,  dot: '#2e7d52', bg: '#e8f4ef', color: '#1a4a3a' },
                { label: 'At Risk',     count: goalsAtRisk.length,   dot: '#c8902a', bg: '#fdf0dc', color: '#7a4f00' },
                { label: 'Behind',      count: goalsBehind.length,   dot: '#d9534f', bg: '#faeae7', color: '#a63020' },
                { label: 'Completed',   count: goalsComplete.length, dot: '#6b42a8', bg: '#f0ecf8', color: '#6b42a8' },
                { label: '% On Track',  count: `${goalsPct}%`,       dot: '#4a6fa5', bg: '#eaf0fa', color: '#1a4a8a' },
              ].map(s => (
                <div key={s.label} style={{ textAlign: 'center', padding: '8px 4px', background: s.bg, borderRadius: 8, borderTop: `3px solid ${s.dot}` }}>
                  <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.count}</div>
                  <div style={{ fontSize: 14, color: s.color, fontWeight: 600, marginTop: 3 }}>{s.label}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[...goalsBehind, ...goalsAtRisk].slice(0, 3).map(g => {
                const light = goalLight(g);
                const dot   = light === 'red' ? '#d9534f' : '#c8902a';
                const bg    = light === 'red' ? '#faeae7' : '#fdf0dc';
                const label = light === 'red' ? 'Behind' : 'At Risk';
                return (
                  <div key={g.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 10px', background: bg, borderRadius: 7, borderLeft: `3px solid ${dot}` }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: dot, flexShrink: 0, marginTop: 4 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</div>
                      {g.target_date && <div style={{ fontSize: 14, color: 'var(--text3)', marginTop: 2 }}>Target: {fmt(g.target_date)}</div>}
                      <OwnerLine owner={g.responsible_name} color={dot} navTo="goals" onNavigate={onNavigate} />
                    </div>
                    <span style={{ fontSize: 14, background: 'rgba(255,255,255,0.7)', color: dot, borderRadius: 20, padding: '2px 8px', fontWeight: 700, flexShrink: 0 }}>{label}</span>
                    {onNavigate && (
                      <button
                        onClick={() => onNavigate('goals')}
                        style={{ fontSize: 14, background: 'rgba(255,255,255,0.6)', color: dot, border: `1px solid ${dot}`, borderRadius: 6, padding: '3px 10px', fontWeight: 700, cursor: 'pointer', flexShrink: 0, fontFamily: 'DM Sans, sans-serif' }}
                      >
                        {NAV_LABELS.goals}
                      </button>
                    )}
                  </div>
                );
              })}
              <ViewAllLink shown={3} total={goalsBehind.length + goalsAtRisk.length} navTo="goals" onNavigate={onNavigate} />
            </div>
          </>
        )}
      </StatusCard>


      {/* ══════════════════════════ RESOURCES ══════════════════════════ */}
      <GroupHeading title="Resources" />

      {/* ── FINANCIAL HEALTH ───────────────────────────────────────────── */}
      {isAdmin && (
      <StatusCard
        icon="📊"
        title="Financial Health"
        level={financeLevel}
        number={financeNumber}
        message={financeMessage}
        rightContent={(d.entities || []).length > 0 && !xeroConnected && (
          <select
            className="no-print"
            value={financeEntityFilter}
            onChange={e => setFinanceEntityFilter(e.target.value)}
            style={{ fontSize: 14, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text2)', fontFamily: 'DM Sans, sans-serif', cursor: 'pointer' }}
          >
            <option value="all">All Entities</option>
            {d.entities.map(ent => <option key={ent.id} value={ent.id}>{ent.name}</option>)}
          </select>
        )}
      >
        <div style={{ fontSize: 14, color: 'var(--text3)', marginBottom: 10 }}>FY {fyLabelStr}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: finOverBudgetCats.length > 0 ? 14 : 0 }}>
          {[
            { label: 'Total Income', value: `$${(panelFinTotalIncome/1000).toFixed(1)}k`, icon: '💵', bg: '#e8f4ef', color: 'var(--brand)' },
            { label: 'Total Expenses', value: `$${(panelFinTotalExpenses/1000).toFixed(1)}k`, icon: '📤', bg: '#faeae7', color: panelFinTotalExpenses > panelFinTotalIncome ? 'var(--danger)' : 'var(--text1)' },
            {
              label: (panelFinTotalIncome === 0 && panelFinTotalExpenses === 0) ? 'No Data Yet' : panelFinNet >= 0 ? 'Net Surplus' : 'Net Deficit',
              value: `$${(Math.abs(panelFinNet)/1000).toFixed(1)}k`,
              icon: (panelFinTotalIncome === 0 && panelFinTotalExpenses === 0) ? '📊' : panelFinNet >= 0 ? '✅' : '⚠️',
              bg: (panelFinTotalIncome === 0 && panelFinTotalExpenses === 0) ? '#f5f0e8' : panelFinNet >= 0 ? '#e8f4ef' : '#faeae7',
              color: (panelFinTotalIncome === 0 && panelFinTotalExpenses === 0) ? 'var(--text3)' : panelFinNet >= 0 ? 'var(--brand)' : 'var(--danger)',
            },
          ].map((t, i) => (
            <div key={i} style={{ textAlign: 'center', padding: '12px 8px', background: t.bg, borderRadius: 8 }}>
              <div style={{ fontSize: 16, marginBottom: 4 }}>{t.icon}</div>
              <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, fontWeight: 700, color: t.color }}>{t.value}</div>
              <div style={{ fontSize: 14, color: 'var(--text3)', marginTop: 2 }}>{t.label}</div>
            </div>
          ))}
        </div>
        {xeroConnected ? (
          <div style={{ fontSize: 14, color: 'var(--text3)' }}>
            🔄 Synced from Xero, {minsAgo(d.xero.lastSyncedAt)}
          </div>
        ) : d.xero?.status === 'error' ? (
          <div style={{ fontSize: 14, color: 'var(--danger)' }}>
            ⚠️ Unable to sync with Xero right now
          </div>
        ) : finOverBudgetCats.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {finOverBudgetCats.map(cat => (
              <span key={cat} onClick={() => onNavigate && onNavigate('finance')} style={{ fontSize: 14, fontWeight: 600, background: '#faeae7', color: 'var(--danger)', border: '1px solid #f0b8b0', borderRadius: 20, padding: '3px 10px', cursor: onNavigate ? 'pointer' : 'default' }}>
                🔴 Over budget — {cat}
              </span>
            ))}
          </div>
        ) : (
          panelFinTotalIncome > 0 || panelFinTotalExpenses > 0 ? (
            <div style={{ fontSize: 14, color: '#1a4a3a', background: '#e8f4ef', borderRadius: 7, padding: '7px 12px', fontWeight: 500 }}>
              ✅ All budget categories within limits
            </div>
          ) : (
            <div style={{ fontSize: 14, color: 'var(--text3)', fontStyle: 'italic' }}>Add income and expenses in the Finance tab</div>
          )
        )}
      </StatusCard>
      )}

      {/* ── TWO-COLUMN: GRANTS + SERVICE REMINDERS (ASSETS) ────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>

        {/* ── GRANTS PIPELINE ────────────────────────────────────────── */}
        <StatusCard icon="💰" title="Grants Pipeline" level={grantsLevel} number={grantsNumber} message={grantsMessage}>
          <div style={{ fontSize: 14, color: 'var(--text3)', marginBottom: periodPipeline.length > 0 ? 8 : 0 }}>{pl}</div>
          {periodPipeline.length === 0 ? (
            <div style={{ fontSize: 14, color: 'var(--text3)', fontStyle: 'italic' }}>No active grant applications in this period</div>
          ) : <>{periodPipeline.slice(0, 3).map(g => {
            const ss = STATUS_STYLES[g.status] || STATUS_STYLES.researching;
            const daysLeft = g.deadline ? Math.ceil((new Date(g.deadline + 'T12:00:00') - today) / (1000 * 60 * 60 * 24)) : null;
            const urgent = daysLeft !== null && daysLeft >= 0 && daysLeft <= 14;
            return (
              <div key={g.id} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--cream2)', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</div>
                  <div style={{ fontSize: 14, color: urgent ? 'var(--warning)' : 'var(--text3)' }}>
                    {g.funder}{g.amount && ` · ${fmtMoney(g.amount)}`}
                    {g.deadline && ` · ${urgent ? `⚠️ ${daysLeft}d left` : `Due ${fmt(g.deadline)}`}`}
                  </div>
                  <OwnerLine owner={g.owner} color="var(--text3)" navTo="grants" onNavigate={onNavigate} />
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 14, background: ss.bg, color: ss.color, borderRadius: 20, padding: '2px 8px', fontWeight: 600 }}>{g.status}</span>
                  {onNavigate && (
                    <button
                      onClick={() => onNavigate('grants')}
                      style={{ fontSize: 14, background: 'none', border: '1px solid var(--border)', color: 'var(--brand)', borderRadius: 6, padding: '2px 8px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', fontWeight: 600 }}
                    >
                      {NAV_LABELS.grants}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          <ViewAllLink shown={3} total={periodPipeline.length} navTo="grants" onNavigate={onNavigate} /></>}
        </StatusCard>

        {/* ── SERVICE REMINDERS ──────────────────────────────────────── */}
        <StatusCard icon="🔧" title="Service Reminders (60 days)" level={serviceLevel} number={serviceNumber} message={serviceMessage} trend={serviceTrend}>
          {upcomingReminders.length === 0 ? (
            <div style={{ fontSize: 14, color: 'var(--text3)', fontStyle: 'italic' }}>
              No reminders due in next 60 days
            </div>
          ) : (
            <>
              {upcomingReminders.slice(0, 3).map(r => {
            const overdue = new Date(r.due_date + 'T12:00:00') < today;
            const daysLeft = Math.ceil((new Date(r.due_date + 'T12:00:00') - today) / (1000 * 60 * 60 * 24));
            const matchedTpl = matchWorkflowTemplate(r.type, d.templates || []);
            const assetName = assetMap[r.asset_id] || 'Asset';
            return (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--cream2)', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: overdue ? 600 : 400, color: overdue ? 'var(--danger)' : 'var(--text1)' }}>
                    {assetName} — {r.type}
                  </div>
                  <div style={{ fontSize: 14, color: overdue ? 'var(--danger)' : 'var(--text3)' }}>
                    {overdue ? `Overdue by ${Math.abs(daysLeft)}d` : daysLeft === 0 ? 'Due today' : `Due in ${daysLeft}d`} · {fmt(r.due_date)}
                  </div>
                  <OwnerLine owner={r.owner} color={overdue ? 'var(--danger)' : 'var(--text3)'} navTo="assets" onNavigate={onNavigate} />
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                  {matchedTpl && onStartWorkflow && (
                    <button
                      onClick={() => onStartWorkflow({
                        templateId: matchedTpl.id,
                        workflowName: `${matchedTpl.name} — ${assetName}`,
                        sourceName: `${assetName} — ${r.type} due ${r.due_date}`,
                        triggerType: 'service_reminder',
                      })}
                      style={{ fontSize: 14, background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
                      ⚙️ Start Workflow →
                    </button>
                  )}
                  {onNavigate && (
                    <button
                      onClick={() => onNavigate('assets')}
                      style={{ fontSize: 14, background: 'none', border: '1px solid var(--border)', color: 'var(--brand)', borderRadius: 6, padding: '3px 10px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', fontWeight: 600 }}
                    >
                      {NAV_LABELS.assets}
                    </button>
                  )}
                  <span style={{ fontSize: 14, background: overdue ? '#faeae7' : '#fdf0dc', color: overdue ? 'var(--danger)' : '#7a4f00', borderRadius: 20, padding: '2px 8px', fontWeight: 600 }}>
                    {overdue ? 'Overdue' : 'Due soon'}
                  </span>
                </div>
              </div>
            );
              })}
              <ViewAllLink shown={3} total={upcomingReminders.length} navTo="assets" onNavigate={onNavigate} />
            </>
          )}
        </StatusCard>
      </div>

      {/* ══════════════════════════ COMMUNITY ══════════════════════════ */}
      <GroupHeading title="Community" />

      {/* ── COMMUNITY FEEDBACK ─────────────────────────────────────────── */}
      <div className="panel" style={{ marginBottom: 8 }}>
        <SectionTitle
          icon="⭐"
          title="Community Feedback"
          note={`(${pl})`}
          rightContent={periodComments.length > 0 && (
            <span
              onClick={() => setShowAllFull(v => !v)}
              style={{ fontSize: 14, color: 'var(--text3)', cursor: 'pointer', fontWeight: 600 }}
            >
              {showAllFull ? 'Show shorter comments' : 'Show full comments'}
            </span>
          )}
        />
        <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 24 }}>
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            {avgRating ? (
              <>
                <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 48, fontWeight: 700, color: '#f4a400', lineHeight: 1 }}>{Number(avgRating).toFixed(1)}</div>
                <div style={{ fontSize: 22, color: '#f4a400', marginBottom: 6 }}><Stars rating={Number(avgRating)} /></div>
                <div style={{ fontSize: 14, color: 'var(--text3)' }}>from {periodFeedbackScores.length} response{periodFeedbackScores.length !== 1 ? 's' : ''}</div>
              </>
            ) : (
              <div style={{ fontSize: 14, color: 'var(--text3)', fontStyle: 'italic', paddingTop: 16 }}>No feedback in this period</div>
            )}
          </div>
          <div>
            {periodComments.length === 0 ? (
              <div style={{ fontSize: 14, color: 'var(--text3)', fontStyle: 'italic' }}>No comments in this period</div>
            ) : periodComments.map((f, i) => (
              <div key={i} style={{ padding: '10px 12px', background: 'var(--surface2)', borderRadius: 8, border: '1px solid var(--border)', marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div style={{ display: 'flex', gap: 3 }}>
                    {[1,2,3,4,5].map(n => <span key={n} style={{ fontSize: 14, color: n <= (f.rating_overall || 0) ? '#f4a400' : '#ddd' }}>★</span>)}
                    <span style={{ fontSize: 14, color: 'var(--text3)', marginLeft: 6 }}>
                      {new Date(f.created_at).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                  {onNavigate && (
                    <button
                      onClick={() => onNavigate('bookings')}
                      style={{ fontSize: 14, background: 'none', border: '1px solid var(--border)', color: 'var(--brand)', borderRadius: 6, padding: '2px 8px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', fontWeight: 600 }}
                    >
                      {NAV_LABELS.bookings}
                    </button>
                  )}
                </div>
                {showAllFull ? (
                  <div style={{ fontSize: 14, color: 'var(--text2)', fontStyle: 'italic', lineHeight: 1.6 }}>
                    "{stripUrls(f.experience)}"
                  </div>
                ) : (
                  <div style={{ fontSize: 14, color: 'var(--text2)', fontStyle: 'italic', lineHeight: 1.6 }}>
                    "{stripUrls(expandedComments.has(i) || f.experience.length <= 150 ? f.experience : f.experience.slice(0, 150) + '…')}"
                    {f.experience.length > 150 && (
                      <span
                        onClick={() => toggleComment(i)}
                        style={{ marginLeft: 6, fontSize: 14, color: 'var(--brand)', cursor: 'pointer', fontWeight: 600, fontStyle: 'normal' }}
                      >
                        {expandedComments.has(i) ? 'Show less' : 'Read more'}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══════════════════════════ TRENDS & SCORE ══════════════════════════ */}
      <GroupHeading title="Trends & Score" />

      {/* ── PERFORMANCE HISTORY ──────────────────────────────────────────── */}
      <div className="panel" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
             onClick={() => setShowKpiHistory(v => !v)}>
          <SectionTitle icon="📈" title="Performance History" count={d.kpiSnapshots.length} />
          <span style={{ fontSize: 14, color: 'var(--text3)' }}>{showKpiHistory ? '▲ Hide' : '▼ Show'}</span>
        </div>

        {d.kpiSnapshots.length === 0 ? (
          <div style={{ fontSize: 14, color: 'var(--text3)', fontStyle: 'italic' }}>No locked months yet — history builds up once each month ends</div>
        ) : !showKpiHistory ? (
          <div style={{ fontSize: 14, color: 'var(--text3)' }}>{d.kpiSnapshots.length} month{d.kpiSnapshots.length !== 1 ? 's' : ''} locked this year — click to view</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                {['Month','Compliance','Risk','Assets','Goals','Total Assets','Total Liabilities','Net Assets'].map(h => (
                  <th key={h} style={{ textAlign: h === 'Month' ? 'left' : 'center', padding: '6px 8px', color: 'var(--text3)', fontWeight: 600, fontSize: 14, textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...d.kpiSnapshots].reverse().map(s => (
                <tr key={s.snapshot_month} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px', fontWeight: 600 }}>
                    {new Date(s.snapshot_month + 'T12:00:00').toLocaleDateString('en-NZ', { month: 'short', year: 'numeric' })}
                  </td>
                  <td style={{ textAlign: 'center', padding: '8px' }}>
                    {s.compliance_pct == null ? <span style={{ color: 'var(--text3)' }}>—</span> : `${s.compliance_pct}%`}
                  </td>
                  <td style={{ textAlign: 'center', padding: '8px' }}>
                    {s.risk_pct == null ? <span style={{ color: 'var(--text3)' }}>—</span> : `${s.risk_pct}%`}
                  </td>
                  <td style={{ textAlign: 'center', padding: '8px' }}>{s.assets_pct}%</td>
                  <td style={{ textAlign: 'center', padding: '8px' }}>{s.goals_pct}%</td>
                  <td style={{ textAlign: 'center', padding: '8px' }}>
                    {s.total_assets == null ? <span style={{ color: 'var(--text3)' }}>—</span> : fmtMoney(s.total_assets)}
                  </td>
                  <td style={{ textAlign: 'center', padding: '8px' }}>
                    {s.total_liabilities == null ? <span style={{ color: 'var(--text3)' }}>—</span> : fmtMoney(s.total_liabilities)}
                  </td>
                  <td style={{ textAlign: 'center', padding: '8px' }}>
                    {s.net_assets == null ? (
                      <span style={{ color: 'var(--text3)' }}>—</span>
                    ) : (
                      <span style={{ fontWeight: 600, color: s.net_assets >= 0 ? 'var(--brand)' : 'var(--danger)' }}>
                        {s.net_assets >= 0 ? fmtMoney(s.net_assets) : '-' + fmtMoney(Math.abs(s.net_assets))}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── HEALTH SCORE ──────────────────────────────────────────────── */}
      <div className="panel" style={{ marginBottom: 20 }}>
        <SectionTitle icon="📊" title="Marae Health Score" />
        {hsInsufficient ? (
          <div style={{ fontSize: 14, color: 'var(--text3)', fontStyle: 'italic' }}>Not enough data yet across enough categories to calculate a score</div>
        ) : (
          <>
            <div style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 10 }}>
              <strong style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, color: 'var(--brand)' }}>{hsFinalScore}</strong>
              <span style={{ color: 'var(--text3)' }}> / 100 · based on {hsCategories.map(c => c.name).join(' · ')}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {hsCategories.map(c => (
                <div key={c.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 14, color: 'var(--text3)' }}>
                  <span>{HS_ICON[c.name]} {c.name} {LEVEL_EMOJI[HS_LEVEL[c.name]]}</span>
                  <span>{c.detail}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
