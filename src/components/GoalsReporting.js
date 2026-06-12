import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import useProfiles from '../lib/useProfiles';
import StatusPill from './StatusPill';
import { ensureTask, ensureUpcomingTask } from '../lib/taskSync';

const GOAL_STATUSES = ['not_started', 'in_progress', 'at_risk', 'completed'];

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const CATEGORIES = {
  governance:  { label: 'Governance',  icon: '🏛️', color: '#1a4a8a', bg: '#e8eef8' },
  compliance:  { label: 'Compliance',  icon: '✅', color: '#1a4a3a', bg: '#e8f4ef' },
  projects:    { label: 'Projects',    icon: '📋', color: '#6b42a8', bg: '#f0ecf8' },
  funding:     { label: 'Funding',     icon: '💰', color: '#0a5a48', bg: '#e8f8f4' },
  community:   { label: 'Community',   icon: '🤝', color: '#7a4f00', bg: '#fdf0dc' },
  assets:      { label: 'Assets',      icon: '🏗️', color: '#a63020', bg: '#faeae7' },
  finance:     { label: 'Finance',     icon: '📊', color: '#4a4438', bg: '#f5f0e8' },
  whakapapa:   { label: 'Whakapapa',   icon: '🌿', color: '#2d5a3a', bg: '#e8f4ee' },
};

const STATUS_CFG = {
  not_started: { label: 'Not Started', bg: '#f5f0e8', color: '#6b6058', border: '#d9d2c8', dot: '#9a9088' },
  in_progress: { label: 'In Progress', bg: '#e8eef8', color: '#1a4a8a', border: '#b8cce8', dot: '#1a4a8a' },
  at_risk:     { label: 'At Risk',     bg: '#fdf0dc', color: '#7a4f00', border: '#e8c880', dot: '#c8902a' },
  completed:   { label: 'Completed',   bg: '#e8f4ef', color: '#1a4a3a', border: '#a8d8c0', dot: '#2e7d52' },
};

const TRAFFIC_LIGHT_CFG = {
  green:  { dot: '#2e7d52', bg: '#e8f4ef', label: 'On Track' },
  orange: { dot: '#c8902a', bg: '#fdf0dc', label: 'At Risk' },
  red:    { dot: '#d9534f', bg: '#faeae7', label: 'Behind' },
  grey:   { dot: '#9a9088', bg: '#f5f0e8', label: 'Not Started' },
};

const GRANT_PROGRESS = {
  approved: 100, reporting: 80, submitted: 60, 'in-progress': 40, researching: 10, declined: 0,
};

const EMPTY_FORM = {
  name: '', description: '', category: 'governance', responsible_name: '',
  start_date: '', target_date: '', status: 'not_started', progress: 0, notes: '',
};

const EMPTY_LINKS = { project_ids: [], compliance_ids: [], grant_ids: [] };

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function fmt(d) {
  if (!d) return '—';
  return new Date(d + 'T12:00:00').toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });
}

function complianceStatus(dueDate) {
  if (!dueDate) return 'not_set';
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate + 'T12:00:00');
  const in30 = new Date(today); in30.setDate(in30.getDate() + 30);
  if (due < today) return 'overdue';
  if (due <= in30) return 'due_soon';
  return 'compliant';
}

function computeAutoProgress(links, projects, complianceItems, grants) {
  if (!links.length) return null;
  const scores = links.map(link => {
    if (link.link_type === 'project') {
      const p = projects.find(x => x.id === link.link_id);
      return p != null ? (p.progress || 0) : null;
    }
    if (link.link_type === 'compliance_item') {
      const item = complianceItems.find(x => x.id === link.link_id);
      if (!item) return null;
      const s = complianceStatus(item.due_date);
      return s === 'compliant' ? 100 : s === 'due_soon' ? 50 : 0;
    }
    if (link.link_type === 'grant') {
      const g = grants.find(x => x.id === link.link_id);
      if (!g) return null;
      return GRANT_PROGRESS[g.status] ?? 0;
    }
    return null;
  }).filter(s => s !== null);
  if (!scores.length) return null;
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

function getTrafficLight(goal, effectiveProgress) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const target = goal.target_date ? new Date(goal.target_date + 'T12:00:00') : null;
  const in14 = new Date(today); in14.setDate(in14.getDate() + 14);
  if (goal.status === 'completed') return 'green';
  if (goal.status === 'at_risk') return 'orange';
  if (goal.status === 'not_started') {
    if (target && target < today) return 'red';
    return 'grey';
  }
  if (target && target < today) return 'red';
  if (target && target <= in14) return 'orange';
  return 'green';
}

// ─── MULTI-CHIP SELECT ────────────────────────────────────────────────────────

function MultiChipSelect({ label, icon, items, selected, onChange }) {
  const [open, setOpen] = useState(false);
  const selectedSet = new Set(selected);
  const toggle = (id) => {
    if (selectedSet.has(id)) onChange(selected.filter(x => x !== id));
    else onChange([...selected, id]);
  };
  return (
    <div className="form-group">
      <label className="form-label">{icon} {label}</label>
      {selected.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
          {selected.map(id => {
            const item = items.find(x => x.id === id);
            return item ? (
              <span key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 20, padding: '3px 10px', color: 'var(--text1)', fontWeight: 600 }}>
                {item.name}
                <button type="button" onClick={() => toggle(id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', lineHeight: 1, padding: 0, fontSize: 13, marginLeft: 2 }}>✕</button>
              </span>
            ) : null;
          })}
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{ fontSize: 12, color: 'var(--brand)', background: 'none', border: '1px dashed var(--brand)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', width: '100%', textAlign: 'left' }}
      >
        {open ? '▲' : '▼'} {selected.length ? `${selected.length} selected — change` : `+ Add ${label}`}
      </button>
      {open && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginTop: 4, maxHeight: 180, overflowY: 'auto' }}>
          {items.length === 0 ? (
            <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text3)' }}>No {label.toLowerCase()} available</div>
          ) : items.map((item, i) => (
            <div
              key={item.id}
              onClick={() => toggle(item.id)}
              style={{
                padding: '8px 12px', fontSize: 12, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 8,
                background: selectedSet.has(item.id) ? 'var(--surface2)' : 'var(--surface)',
                borderBottom: i < items.length - 1 ? '1px solid var(--border)' : 'none',
              }}
            >
              <span style={{
                width: 16, height: 16, borderRadius: 4, border: '2px solid var(--brand)',
                background: selectedSet.has(item.id) ? 'var(--brand)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                {selectedSet.has(item.id) && <span style={{ color: '#fff', fontSize: 10, lineHeight: 1 }}>✓</span>}
              </span>
              {item.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function GoalsReporting() {
  const allProfiles = useProfiles();
  const trustees = allProfiles.filter(p => p.role === 'trustee');

  const [goals, setGoals]             = useState([]);
  const [goalLinks, setGoalLinks]     = useState([]);
  const [projects, setProjects]       = useState([]);
  const [complianceItems, setComplianceItems] = useState([]);
  const [grants, setGrants]           = useState([]);
  const [loading, setLoading]         = useState(true);

  const [section, setSection]         = useState('board');
  const [catFilter, setCatFilter]     = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const [showModal, setShowModal]     = useState(false);
  const [editGoal, setEditGoal]       = useState(null);
  const [form, setForm]               = useState(EMPTY_FORM);
  const [linkForm, setLinkForm]       = useState(EMPTY_LINKS);
  const [saving, setSaving]           = useState(false);
  const [formError, setFormError]     = useState('');

  useEffect(() => { fetchAll(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchAll() {
    setLoading(true);
    const [goalsRes, linksRes, projRes, compRes, grantsRes] = await Promise.all([
      supabase.from('goals').select('*').order('target_date', { ascending: true, nullsFirst: false }),
      supabase.from('goal_links').select('*'),
      supabase.from('projects').select('id, name, status, progress'),
      supabase.from('compliance_items').select('id, name, due_date, category'),
      supabase.from('grants').select('id, name, status, funder'),
    ]);
    if (goalsRes.error) console.error('[GoalsReporting] goals fetch error:', goalsRes.error.message);
    if (linksRes.error) console.error('[GoalsReporting] goal_links fetch error:', linksRes.error.message);
    const goalsData = goalsRes.data || [];
    setGoals(goalsData);
    setGoalLinks(linksRes.data || []);
    setProjects(projRes.data || []);
    setComplianceItems(compRes.data || []);
    setGrants(grantsRes.data || []);
    setLoading(false);
    createOverdueTasks(goalsData);
    createUpcomingTasks(goalsData);
  }

  async function createOverdueTasks(goalsData) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayStr = new Date().toISOString().split('T')[0];
    const behind = goalsData.filter(g =>
      g.status !== 'completed' && g.target_date && new Date(g.target_date + 'T12:00:00') < today
    );
    for (const g of behind) {
      await ensureTask({
        title: `GOAL: ${g.name}`,
        description: `Strategic goal behind schedule. Target: ${g.target_date}. Review and update plan. [source_id:${g.id}]`,
        assigned_to: g.responsible_name || null,
        due_date: todayStr,
        priority: 'High',
      });
    }
  }

  async function createUpcomingTasks(goalsData) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const in14 = new Date(today); in14.setDate(in14.getDate() + 14);
    const approaching = goalsData.filter(g =>
      g.status !== 'completed' &&
      g.target_date &&
      new Date(g.target_date + 'T12:00:00') >= today &&
      new Date(g.target_date + 'T12:00:00') <= in14
    );
    for (const g of approaching) {
      await ensureUpcomingTask({
        sourceId: g.id,
        sourceType: 'goal',
        name: g.name,
        description: `Strategic goal target date approaching. Review progress and confirm on track.`,
        assigned_to: g.responsible_name || null,
        due_date: g.target_date,
        windowDays: 14,
      });
    }
  }

  function getLinksForGoal(goalId) {
    return goalLinks.filter(l => l.goal_id === goalId);
  }

  function getEffectiveProgress(goal) {
    const links = getLinksForGoal(goal.id);
    const auto = computeAutoProgress(links, projects, complianceItems, grants);
    return auto !== null ? auto : (goal.progress || 0);
  }

  function isAutoProgress(goal) {
    const links = getLinksForGoal(goal.id);
    return computeAutoProgress(links, projects, complianceItems, grants) !== null;
  }

  // ── CRUD ───────────────────────────────────────────────────────────────────

  function openAdd() {
    setEditGoal(null);
    setForm(EMPTY_FORM);
    setLinkForm(EMPTY_LINKS);
    setFormError('');
    setShowModal(true);
  }

  function openEdit(goal) {
    setEditGoal(goal);
    setForm({
      name: goal.name || '',
      description: goal.description || '',
      category: goal.category || 'governance',
      responsible_name: goal.responsible_name || '',
      start_date: goal.start_date || '',
      target_date: goal.target_date || '',
      status: goal.status || 'not_started',
      progress: goal.progress || 0,
      notes: goal.notes || '',
    });
    const links = getLinksForGoal(goal.id);
    setLinkForm({
      project_ids:    links.filter(l => l.link_type === 'project').map(l => l.link_id),
      compliance_ids: links.filter(l => l.link_type === 'compliance_item').map(l => l.link_id),
      grant_ids:      links.filter(l => l.link_type === 'grant').map(l => l.link_id),
    });
    setFormError('');
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.name.trim()) { setFormError('Goal name is required.'); return; }
    setSaving(true); setFormError('');

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      category: form.category,
      responsible_name: form.responsible_name || null,
      start_date: form.start_date || null,
      target_date: form.target_date || null,
      status: form.status,
      progress: Number(form.progress),
      notes: form.notes.trim() || null,
      updated_at: new Date().toISOString(),
    };

    let goalId;
    if (editGoal) {
      const { error } = await supabase.from('goals').update(payload).eq('id', editGoal.id);
      if (error) { setFormError(error.message); setSaving(false); return; }
      goalId = editGoal.id;
    } else {
      const { data, error } = await supabase.from('goals').insert(payload).select('id').single();
      if (error) { setFormError(error.message); setSaving(false); return; }
      goalId = data?.id;
    }

    if (goalId) {
      await supabase.from('goal_links').delete().eq('goal_id', goalId);
      const newLinks = [
        ...linkForm.project_ids.map(id    => ({ goal_id: goalId, link_type: 'project',         link_id: id })),
        ...linkForm.compliance_ids.map(id => ({ goal_id: goalId, link_type: 'compliance_item', link_id: id })),
        ...linkForm.grant_ids.map(id      => ({ goal_id: goalId, link_type: 'grant',            link_id: id })),
      ];
      if (newLinks.length) await supabase.from('goal_links').insert(newLinks);
    }

    await fetchAll();
    setShowModal(false);
    setSaving(false);
  }

  async function deleteGoal(id) {
    if (!window.confirm('Delete this goal?')) return;
    await supabase.from('goals').delete().eq('id', id);
    setGoals(prev => prev.filter(g => g.id !== id));
    setGoalLinks(prev => prev.filter(l => l.goal_id !== id));
  }

  async function handleGoalStatusChange(goalId, newStatus) {
    const { error } = await supabase.from('goals').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', goalId);
    if (!error) setGoals(prev => prev.map(g => g.id === goalId ? { ...g, status: newStatus } : g));
  }

  // ── COMPUTED ───────────────────────────────────────────────────────────────

  const summary = { total: goals.length, completed: 0, on_track: 0, at_risk: 0, behind: 0 };
  goals.forEach(g => {
    const eff = getEffectiveProgress(g);
    const tl = getTrafficLight(g, eff);
    if (tl === 'green') summary.on_track++;
    else if (tl === 'orange') summary.at_risk++;
    else if (tl === 'red') summary.behind++;
    if (g.status === 'completed') summary.completed++;
  });

  const filteredGoals = goals.filter(g => {
    if (catFilter !== 'all' && g.category !== catFilter) return false;
    if (statusFilter !== 'all' && g.status !== statusFilter) return false;
    return true;
  });

  if (loading) return <div className="loading">Loading goals...</div>;

  // ── RENDER ────────────────────────────────────────────────────────────────

  return (
    <div>

      {/* ── SUMMARY BAR ────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { key: 'total',     label: 'Total Goals',  val: summary.total,     dot: '#1a4a8a', bg: '#e8eef8' },
          { key: 'on_track',  label: 'On Track',     val: summary.on_track,  dot: '#2e7d52', bg: '#e8f4ef' },
          { key: 'at_risk',   label: 'At Risk',      val: summary.at_risk,   dot: '#c8902a', bg: '#fdf0dc' },
          { key: 'behind',    label: 'Behind',       val: summary.behind,    dot: '#d9534f', bg: '#faeae7' },
        ].map(s => (
          <div key={s.key} className="panel" style={{ textAlign: 'center', padding: '14px 10px', borderLeft: `4px solid ${s.dot}` }}>
            <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 28, fontWeight: 700, color: 'var(--text1)', lineHeight: 1, marginBottom: 4 }}>{s.val}</div>
            <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 500 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── SECTION TOGGLE ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          {[
            { key: 'board', label: '📊 Board Report' },
            { key: 'goals', label: '🎯 Manage Goals' },
          ].map((s, i) => (
            <button
              key={s.key}
              onClick={() => setSection(s.key)}
              style={{
                padding: '8px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                background: section === s.key ? 'var(--brand)' : 'var(--surface)',
                color: section === s.key ? '#fff' : 'var(--text2)',
                border: 'none', borderRight: i === 0 ? '1px solid var(--border)' : 'none',
                fontFamily: 'DM Sans, sans-serif',
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
        <button className="btn-primary" onClick={openAdd} style={{ fontSize: 13 }}>
          + Add Goal
        </button>
      </div>

      {/* ── BOARD REPORTING VIEW ───────────────────────────────────────────── */}
      {section === 'board' && (
        <>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 8 }}>
            {/* Table header */}
            <div style={{ display: 'grid', gridTemplateColumns: '40px 2fr 120px 160px 100px 140px 140px', gap: 0, background: 'var(--surface2)', borderBottom: '1px solid var(--border)', padding: '10px 16px' }}>
              {['', 'Goal', 'Category', 'Progress', 'Status', 'Target Date', 'Responsible'].map((h, i) => (
                <div key={i} style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</div>
              ))}
            </div>

            {/* Table rows */}
            {goals.length === 0 ? (
              <div className="empty-state" style={{ margin: 0, borderRadius: 0 }}>
                <div className="emoji">🎯</div>
                <div>No goals yet — add your first strategic goal above</div>
              </div>
            ) : (
              goals.map(goal => {
                const eff = getEffectiveProgress(goal);
                const tl = getTrafficLight(goal, eff);
                const tlCfg = TRAFFIC_LIGHT_CFG[tl];
                const cat = CATEGORIES[goal.category] || CATEGORIES.governance;
                const auto = isAutoProgress(goal);
                return (
                  <div
                    key={goal.id}
                    style={{ display: 'grid', gridTemplateColumns: '40px 2fr 120px 160px 100px 140px 140px', gap: 0, padding: '12px 16px', borderBottom: '1px solid var(--border)', alignItems: 'center', transition: 'background 0.1s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    {/* Traffic light */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div
                        title={tlCfg.label}
                        style={{ width: 16, height: 16, borderRadius: '50%', background: tlCfg.dot, flexShrink: 0, boxShadow: `0 0 0 3px ${tlCfg.bg}` }}
                      />
                    </div>
                    {/* Goal name + description */}
                    <div style={{ minWidth: 0, paddingRight: 12 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text1)', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{goal.name}</div>
                      {goal.description && (
                        <div style={{ fontSize: 11, color: 'var(--text3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{goal.description}</div>
                      )}
                    </div>
                    {/* Category */}
                    <div>
                      <span style={{ fontSize: 11, fontWeight: 600, background: cat.bg, color: cat.color, borderRadius: 20, padding: '3px 9px', whiteSpace: 'nowrap' }}>
                        {cat.icon} {cat.label}
                      </span>
                    </div>
                    {/* Progress */}
                    <div style={{ paddingRight: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <div style={{ flex: 1, height: 6, background: 'var(--cream2)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${eff}%`, background: tl === 'green' ? '#2e7d52' : tl === 'orange' ? '#c8902a' : tl === 'red' ? '#d9534f' : '#9a9088', borderRadius: 3, transition: 'width 0.3s' }} />
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', flexShrink: 0 }}>{eff}%</span>
                      </div>
                      {auto && <div style={{ fontSize: 10, color: 'var(--brand)', fontWeight: 500 }}>auto-tracked</div>}
                    </div>
                    {/* Status */}
                    <div>
                      <StatusPill
                        status={goal.status}
                        options={GOAL_STATUSES}
                        onStatusChange={s => handleGoalStatusChange(goal.id, s)}
                      />
                    </div>
                    {/* Target date */}
                    <div style={{ fontSize: 12, color: 'var(--text2)' }}>{fmt(goal.target_date)}</div>
                    {/* Responsible */}
                    <div style={{ fontSize: 12, color: 'var(--text2)', display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'space-between' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {goal.responsible_name ? `👤 ${goal.responsible_name}` : '—'}
                      </span>
                      <button
                        onClick={() => openEdit(goal)}
                        style={{ fontSize: 11, color: 'var(--brand)', background: 'none', border: '1px solid var(--border)', borderRadius: 5, padding: '2px 8px', cursor: 'pointer', flexShrink: 0 }}
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Traffic light legend */}
          <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
            {Object.entries(TRAFFIC_LIGHT_CFG).map(([k, v]) => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: v.dot }} />
                <span style={{ fontSize: 11, color: 'var(--text3)' }}>{v.label}</span>
              </div>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 4 }}>
              <span style={{ fontSize: 11, color: 'var(--brand)', fontWeight: 500 }}>auto-tracked</span>
              <span style={{ fontSize: 11, color: 'var(--text3)' }}> = progress calculated from linked modules</span>
            </div>
          </div>
        </>
      )}

      {/* ── MANAGE GOALS VIEW ──────────────────────────────────────────────── */}
      {section === 'goals' && (
        <>
          {/* Filters */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[{ key: 'all', label: 'All Categories', icon: '📌' }, ...Object.entries(CATEGORIES).map(([k, v]) => ({ key: k, label: v.label, icon: v.icon }))].map(c => (
                <button
                  key={c.key}
                  onClick={() => setCatFilter(c.key)}
                  style={{
                    padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    borderRadius: 20, border: '1px solid var(--border)',
                    background: catFilter === c.key ? 'var(--brand)' : 'var(--surface)',
                    color: catFilter === c.key ? '#fff' : 'var(--text2)',
                    fontFamily: 'DM Sans, sans-serif',
                  }}
                >
                  {c.icon} {c.label}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
            {[{ key: 'all', label: 'All Statuses' }, ...Object.entries(STATUS_CFG).map(([k, v]) => ({ key: k, label: v.label }))].map(s => (
              <button
                key={s.key}
                onClick={() => setStatusFilter(s.key)}
                style={{
                  padding: '4px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  borderRadius: 20, border: '1px solid var(--border)',
                  background: statusFilter === s.key ? '#1a4a3a' : 'var(--surface)',
                  color: statusFilter === s.key ? '#fff' : 'var(--text2)',
                  fontFamily: 'DM Sans, sans-serif',
                }}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Goals list */}
          {filteredGoals.length === 0 ? (
            <div className="empty-state"><div className="emoji">🎯</div><div>No goals match your filters</div></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filteredGoals.map(goal => {
                const eff = getEffectiveProgress(goal);
                const tl = getTrafficLight(goal, eff);
                const tlCfg = TRAFFIC_LIGHT_CFG[tl];
                const cat = CATEGORIES[goal.category] || CATEGORIES.governance;
                const links = getLinksForGoal(goal.id);
                const auto = isAutoProgress(goal);
                return (
                  <div
                    key={goal.id}
                    className="panel"
                    style={{ padding: '14px 16px', borderLeft: `4px solid ${tlCfg.dot}` }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {/* Tags row */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                          <StatusPill
                            status={goal.status}
                            options={GOAL_STATUSES}
                            onStatusChange={s => handleGoalStatusChange(goal.id, s)}
                          />
                          <span style={{ fontSize: 11, fontWeight: 600, background: cat.bg, color: cat.color, borderRadius: 20, padding: '2px 9px' }}>
                            {cat.icon} {cat.label}
                          </span>
                          <span style={{ fontSize: 11, background: tlCfg.bg, color: tlCfg.dot, borderRadius: 20, padding: '2px 9px', fontWeight: 600 }}>
                            ● {tlCfg.label}
                          </span>
                        </div>

                        {/* Name */}
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text1)', marginBottom: 3 }}>{goal.name}</div>
                        {goal.description && (
                          <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 6, lineHeight: 1.5 }}>{goal.description}</div>
                        )}

                        {/* Progress bar */}
                        <div style={{ marginBottom: 8 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                            <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 500 }}>
                              Progress{auto ? ' (auto-tracked)' : ''}
                            </span>
                            <span style={{ fontSize: 11, fontWeight: 700, color: tlCfg.dot }}>{eff}%</span>
                          </div>
                          <div style={{ height: 7, background: 'var(--cream2)', borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${eff}%`, background: tlCfg.dot, borderRadius: 4, transition: 'width 0.3s' }} />
                          </div>
                        </div>

                        {/* Meta */}
                        <div style={{ fontSize: 12, color: 'var(--text3)', display: 'flex', flexWrap: 'wrap', gap: '0 14px' }}>
                          {goal.start_date && <span>Start: {fmt(goal.start_date)}</span>}
                          {goal.target_date && <span>Target: <strong style={{ color: tl === 'red' ? 'var(--danger)' : 'var(--text2)' }}>{fmt(goal.target_date)}</strong></span>}
                          {goal.responsible_name && <span>👤 {goal.responsible_name}</span>}
                        </div>

                        {/* Links */}
                        {links.length > 0 && (
                          <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {links.map(link => {
                              let label = '';
                              if (link.link_type === 'project') {
                                const p = projects.find(x => x.id === link.link_id);
                                label = p ? `📋 ${p.name}` : '📋 Project';
                              } else if (link.link_type === 'compliance_item') {
                                const c = complianceItems.find(x => x.id === link.link_id);
                                label = c ? `✅ ${c.name}` : '✅ Compliance';
                              } else if (link.link_type === 'grant') {
                                const g = grants.find(x => x.id === link.link_id);
                                label = g ? `💰 ${g.name}` : '💰 Grant';
                              }
                              return label ? (
                                <span key={link.id} style={{ fontSize: 11, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 8px', color: 'var(--text2)' }}>
                                  {label}
                                </span>
                              ) : null;
                            })}
                          </div>
                        )}

                        {goal.notes && (
                          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6, fontStyle: 'italic' }}>{goal.notes}</div>
                        )}
                      </div>

                      {/* Actions */}
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        <button
                          onClick={() => openEdit(goal)}
                          style={{ fontSize: 12, color: 'var(--brand)', background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontWeight: 600 }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteGoal(goal.id)}
                          style={{ fontSize: 12, color: 'var(--danger)', background: 'none', border: '1px solid #f0b8b0', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── MODAL ──────────────────────────────────────────────────────────── */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 20px', overflowY: 'auto' }}>
          <div style={{ background: 'var(--surface)', borderRadius: 14, width: '100%', maxWidth: 620, padding: 28, boxShadow: '0 8px 40px rgba(0,0,0,0.22)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 18, margin: 0, color: 'var(--brand)' }}>
                {editGoal ? 'Edit Goal' : 'Add Strategic Goal'}
              </h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text3)', lineHeight: 1 }}>✕</button>
            </div>

            {formError && (
              <div style={{ background: '#faeae7', border: '1px solid #f0b8b0', borderRadius: 8, padding: '10px 14px', color: 'var(--danger)', fontSize: 13, marginBottom: 14 }}>
                {formError}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Goal Name *</label>
                <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Achieve 100% compliance by year end" autoFocus />
              </div>

              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Description</label>
                <textarea className="form-input" rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What does success look like?" style={{ resize: 'vertical' }} />
              </div>

              <div className="form-group">
                <label className="form-label">Category</label>
                <select className="form-input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  {Object.entries(CATEGORIES).map(([k, v]) => (
                    <option key={k} value={k}>{v.icon} {v.label}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                  {Object.entries(STATUS_CFG).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Start Date</label>
                <input type="date" className="form-input" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
              </div>

              <div className="form-group">
                <label className="form-label">Target Date</label>
                <input type="date" className="form-input" value={form.target_date} onChange={e => setForm(f => ({ ...f, target_date: e.target.value }))} />
              </div>

              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Responsible Trustee</label>
                <select className="form-input" value={form.responsible_name} onChange={e => setForm(f => ({ ...f, responsible_name: e.target.value }))}>
                  <option value="">— Select trustee —</option>
                  {trustees.map(t => <option key={t.full_name} value={t.full_name}>{t.full_name}</option>)}
                </select>
              </div>

              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">
                  Manual Progress (%) — overridden automatically when linked items are set
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <input type="range" min="0" max="100" step="5" value={form.progress}
                    onChange={e => setForm(f => ({ ...f, progress: Number(e.target.value) }))}
                    style={{ flex: 1, cursor: 'pointer' }} />
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--brand)', width: 36, textAlign: 'right' }}>{form.progress}%</span>
                </div>
              </div>

              {/* ── LINKED ITEMS ─────────────────────────────────────────── */}
              <div style={{ gridColumn: '1 / -1', marginTop: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text1)', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
                  🔗 Link to Existing Modules
                  <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text3)', marginLeft: 8 }}>Progress will auto-calculate from linked items</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                  <MultiChipSelect
                    label="Projects" icon="📋"
                    items={projects}
                    selected={linkForm.project_ids}
                    onChange={ids => setLinkForm(f => ({ ...f, project_ids: ids }))}
                  />
                  <MultiChipSelect
                    label="Compliance Items" icon="✅"
                    items={complianceItems}
                    selected={linkForm.compliance_ids}
                    onChange={ids => setLinkForm(f => ({ ...f, compliance_ids: ids }))}
                  />
                  <MultiChipSelect
                    label="Grants" icon="💰"
                    items={grants}
                    selected={linkForm.grant_ids}
                    onChange={ids => setLinkForm(f => ({ ...f, grant_ids: ids }))}
                  />
                </div>
              </div>

              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Notes</label>
                <textarea className="form-input" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Additional context or governance notes..." style={{ resize: 'vertical' }} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleSave} className="btn-primary" disabled={saving}>
                {saving ? 'Saving...' : editGoal ? 'Save Changes' : 'Add Goal'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
