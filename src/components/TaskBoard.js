import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import useProfiles from '../lib/useProfiles';
import StatusPill from './StatusPill';
import { onTaskCompleted, taskSource } from '../lib/taskSync';
import { compareByUrgency } from '../lib/urgencyStatus';
import { useSortPreference } from '../lib/useSortPreference';
import SortSelect from './SortSelect';
import CommentModal from './CommentModal';

const COLUMNS = [
  { key: 'open',        label: 'Open',        icon: '📋', headerBg: '#e8eef8', headerColor: '#1a4a8a' },
  { key: 'in-progress', label: 'In Progress',  icon: '🔄', headerBg: '#fdf0dc', headerColor: '#7a4f00' },
  { key: 'completed',   label: 'Completed',    icon: '✅', headerBg: '#e8f4ef', headerColor: '#1a4a3a' },
  { key: 'cancelled',   label: 'Cancelled',    icon: '🚫', headerBg: '#faeae7', headerColor: '#7a1a1a' },
];

const PRIORITIES = ['High', 'Medium', 'Low'];

const PRIORITY_BORDER = { High: '#a63020', Medium: '#c8902a', Low: '#2d6e57' };
const PRIORITY_BADGE  = {
  High:   { bg: '#faeae7', color: '#a63020' },
  Medium: { bg: '#fdf0dc', color: '#c8902a' },
  Low:    { bg: '#e8f4ef', color: '#2d6e57' },
};

// Step 4 (14yhc7kutvv): action-ness is a property of the source category,
// not the individual task, so it's a style variant on the existing pill
// rather than a new badge. 'actionable' keeps Step 3's original filled
// look; 'reference' is deliberately quieter (no fill, muted text); the
// dashed border on 'ambiguous' flags GRANT: as needing a real decision
// (see taskSync.js), not a settled reference-vs-actionable case.
const SOURCE_ACTION_STYLE = {
  actionable: { background: 'var(--surface2)', border: '1px solid var(--border)',  color: 'var(--text2)', fontWeight: 600 },
  reference:  { background: 'transparent',      border: 'none',                     color: 'var(--text3)', fontWeight: 500 },
  ambiguous:  { background: 'var(--surface2)', border: '1px dashed var(--border)', color: 'var(--text2)', fontWeight: 600 },
};

const EMPTY_FORM = { title: '', description: '', assigned_to: '', due_date: '', priority: 'Medium' };

const TASK_STATUSES = COLUMNS.map(c => c.key);

function fmtDate(d) {
  if (!d) return null;
  return new Date(d + 'T12:00:00').toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });
}

function isOverdue(task) {
  if (!task.due_date || ['completed', 'cancelled'].includes(task.status)) return false;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return new Date(task.due_date + 'T12:00:00') < today;
}

function compareTaskUrgency(a, b) {
  return compareByUrgency(a, b, { dueSoonDays: 7, doneStatuses: ['completed', 'cancelled'] });
}

// Consistent Sort (14yhc7kpea4) Step 4, Part 2 -- user-selectable sort on
// top of the urgency default. Tasks has a real priority field, so it gets
// the full 4-option set (Compliance/Goals/Grants/Projects don't and get a
// reduced set -- see each module's own SORT_OPTIONS).
const TASK_SORT_OPTIONS = [
  { value: 'urgency', label: 'Urgency' },
  { value: 'due_date', label: 'Due Date' },
  { value: 'priority', label: 'Priority' },
  { value: 'alpha', label: 'A–Z' },
];
const TASK_PRIORITY_RANK = { High: 0, Medium: 1, Low: 2 };

function compareTasksByMode(mode) {
  return (a, b) => {
    if (mode === 'due_date') {
      if (a.due_date && b.due_date) return new Date(a.due_date) - new Date(b.due_date);
      if (a.due_date) return -1;
      if (b.due_date) return 1;
      return compareTaskUrgency(a, b);
    }
    if (mode === 'priority') {
      const pa = TASK_PRIORITY_RANK[a.priority] ?? 3;
      const pb = TASK_PRIORITY_RANK[b.priority] ?? 3;
      if (pa !== pb) return pa - pb;
      return compareTaskUrgency(a, b);
    }
    if (mode === 'alpha') return (a.title || '').localeCompare(b.title || '');
    return compareTaskUrgency(a, b);
  };
}

function isCompletedToday(task) {
  if (task.status !== 'completed' || !task.completed_at) return false;
  return new Date(task.completed_at).toDateString() === new Date().toDateString();
}

// ─── TASK CARD ────────────────────────────────────────────────────────────────

function TaskCard({ task, colIndex, onMove, onEdit, onDelete, onChangeStatus, commentCount, onOpenComments }) {
  const overdue = isOverdue(task);
  const dateStr = fmtDate(task.due_date);
  const badge = PRIORITY_BADGE[task.priority] || PRIORITY_BADGE.Medium;
  const isFirst = colIndex === 0;
  const isLast = colIndex === COLUMNS.length - 1;

  // Task View Cleanup (14yhc7kutvv) Step 3 -- light-touch category badge
  // for auto-generated tasks, reusing the existing TASK_SOURCES mapping
  // (previously unused anywhere). Manually-created tasks have no matching
  // prefix, so source is null and no badge shows -- itself informative,
  // not a gap to fill. Display-only: the raw title (prefix included) is
  // still what the edit form and delete/comment modals show.
  const source = taskSource(task.title);
  const displayTitle = source ? task.title.slice(source.prefix.length) : task.title;

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderLeft: `4px solid ${PRIORITY_BORDER[task.priority] || PRIORITY_BORDER.Medium}`,
      borderRadius: '0 8px 8px 0',
      padding: '12px 12px 10px',
    }}>
      {source && (
        <div style={{ marginBottom: 5 }}>
          <span style={{
            fontSize: 12, borderRadius: 20, padding: '2px 9px', display: 'inline-flex',
            alignItems: 'center', gap: 4,
            ...SOURCE_ACTION_STYLE[source.action],
          }}>
            {source.icon} {source.label}
          </span>
        </div>
      )}

      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text1)', marginBottom: 6, lineHeight: 1.4 }}>
        {displayTitle}
      </div>

      {task.assigned_to && (
        <div style={{ fontSize: 14, color: 'var(--text3)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
          <span>👤</span> {task.assigned_to}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        {dateStr && (
          <span style={{ fontSize: 14, color: overdue ? 'var(--danger)' : 'var(--text3)', display: 'flex', alignItems: 'center', gap: 3 }}>
            <span>📅</span> {dateStr}
          </span>
        )}
        {overdue && (
          <span style={{
            fontSize: 14, background: '#faeae7', color: 'var(--danger)',
            border: '1px solid #f0b8b0', borderRadius: 20, padding: '2px 9px',
            fontWeight: 700, letterSpacing: '0.03em',
          }}>
            OVERDUE
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <StatusPill
          status={task.status}
          options={TASK_STATUSES}
          onStatusChange={s => onChangeStatus(task, s)}
        />
        <span style={{
          fontSize: 14, background: badge.bg, color: badge.color,
          borderRadius: 20, padding: '3px 10px', fontWeight: 600, letterSpacing: '0.04em',
        }}>
          {task.priority || 'Medium'}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button
          onClick={() => onMove(task, -1)}
          disabled={isFirst}
          title="Move left"
          style={{
            background: isFirst ? 'var(--surface2)' : 'var(--brand)',
            color: isFirst ? 'var(--text3)' : '#fff',
            border: 'none', borderRadius: 6, padding: '4px 9px', fontSize: 14,
            cursor: isFirst ? 'not-allowed' : 'pointer', opacity: isFirst ? 0.35 : 1,
            lineHeight: 1, fontWeight: 700,
          }}
        >←</button>

        <button
          onClick={() => onEdit(task)}
          style={{
            flex: 1, background: 'var(--surface2)', color: 'var(--text2)',
            border: '1px solid var(--border)', borderRadius: 6,
            padding: '5px 0', fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}
        >Edit</button>

        {/* Comment / Updates button */}
        <button
          onClick={() => onOpenComments(task)}
          title="View updates"
          style={{
            background: commentCount > 0 ? '#e8eef8' : 'var(--surface2)',
            color: commentCount > 0 ? '#1a4a8a' : 'var(--text3)',
            border: `1px solid ${commentCount > 0 ? '#b8ccee' : 'var(--border)'}`,
            borderRadius: 6, padding: '4px 8px', fontSize: 13,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
            flexShrink: 0,
          }}
        >
          💬
          {commentCount > 0 && (
            <span style={{
              fontSize: 10, fontWeight: 700,
              background: 'var(--brand)', color: '#fff',
              borderRadius: 10, padding: '0 5px', lineHeight: '16px',
              minWidth: 16, textAlign: 'center', display: 'inline-block',
            }}>
              {commentCount}
            </span>
          )}
        </button>

        <button
          onClick={() => onDelete(task.id)}
          style={{
            flex: 1, background: '#faeae7', color: 'var(--danger)',
            border: '1px solid #f0b8b0', borderRadius: 6,
            padding: '5px 0', fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}
        >Delete</button>

        <button
          onClick={() => onMove(task, 1)}
          disabled={isLast}
          title="Move right"
          style={{
            background: isLast ? 'var(--surface2)' : 'var(--brand)',
            color: isLast ? 'var(--text3)' : '#fff',
            border: 'none', borderRadius: 6, padding: '4px 9px', fontSize: 14,
            cursor: isLast ? 'not-allowed' : 'pointer', opacity: isLast ? 0.35 : 1,
            lineHeight: 1, fontWeight: 700,
          }}
        >→</button>
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function TaskBoard() {
  const profiles = useProfiles();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [search, setSearch] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [showArchive, setShowArchive] = useState(false);
  const [commentCounts, setCommentCounts] = useState({});
  const [commentTask, setCommentTask] = useState(null);
  const [sortMode, setSortMode] = useSortPreference('tasks', 'urgency');

  useEffect(() => { fetchTasks(); fetchCommentCounts(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setTasks(prev => [...prev].sort(compareTasksByMode(sortMode))); }, [sortMode]); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchTasks() {
    setLoading(true);
    const { data } = await supabase.from('tasks').select('*');
    data?.sort(compareTasksByMode(sortMode));
    setTasks(data || []);
    setLoading(false);
  }

  async function fetchCommentCounts() {
    const { data } = await supabase.from('task_comments').select('task_id');
    if (!data) return;
    const counts = {};
    data.forEach(r => { counts[r.task_id] = (counts[r.task_id] || 0) + 1; });
    setCommentCounts(counts);
  }

  function handleCommentPosted(taskId) {
    setCommentCounts(prev => ({ ...prev, [taskId]: (prev[taskId] || 0) + 1 }));
  }

  // Task View Cleanup (14yhc7kutvv) Step 2 -- workflow parent/subtask rows
  // excluded entirely, not just given a special card. Workflow progress,
  // step-completion, delete, and comments now live on the Workflows tab
  // (WorkflowEngine.js) instead. Non-subtask, non-workflow tasks only --
  // used for KPIs and the kanban board.
  const visibleTasks = useMemo(() => tasks.filter(t => !t.parent_task_id && !t.workflow_instance_id), [tasks]);

  const kpis = useMemo(() => ({
    total: visibleTasks.length,
    open: visibleTasks.filter(t => t.status === 'open').length,
    overdue: visibleTasks.filter(t => isOverdue(t)).length,
    completedToday: visibleTasks.filter(t => isCompletedToday(t)).length,
  }), [visibleTasks]);

  const filtered = useMemo(() => {
    if (!search.trim()) return visibleTasks;
    const q = search.toLowerCase();
    return visibleTasks.filter(t => t.title?.toLowerCase().includes(q));
  }, [visibleTasks, search]);

  const ARCHIVE_THRESHOLD = 50;
  const archivedTasks = useMemo(() => {
    if (search.trim()) return [];
    return filtered.filter(t => t.status === 'completed' && !t.workflow_instance_id).slice(ARCHIVE_THRESHOLD);
  }, [filtered, search]);

  function openAdd() {
    setForm(EMPTY_FORM);
    setEditId(null);
    setFormError('');
    setShowForm(true);
  }

  function openEdit(task) {
    setForm({
      title: task.title || '',
      description: task.description || '',
      assigned_to: task.assigned_to || '',
      due_date: task.due_date || '',
      priority: task.priority || 'Medium',
    });
    setEditId(task.id);
    setFormError('');
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditId(null);
    setFormError('');
  }

  async function handleSave() {
    if (!form.title.trim()) { setFormError('Title is required.'); return; }
    setSaving(true);
    setFormError('');
    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      assigned_to: form.assigned_to.trim(),
      due_date: form.due_date || null,
      priority: form.priority,
    };
    if (editId) {
      const { error: err } = await supabase.from('tasks').update(payload).eq('id', editId);
      if (err) { setFormError(err.message); setSaving(false); return; }
    } else {
      const { error: err } = await supabase.from('tasks').insert({ ...payload, status: 'open' });
      if (err) { setFormError(err.message); setSaving(false); return; }
    }
    setSaving(false);
    closeForm();
    fetchTasks();
  }

  async function handleDelete() {
    if (!confirmDeleteId) return;
    // Task View Cleanup (14yhc7kutvv) Step 2 -- workflow parent tasks are
    // excluded from visibleTasks entirely, so confirmDeleteId can now only
    // ever be a plain task. Workflow deletion (and cancelling the linked
    // workflow_instance) now lives on the Workflows tab instead.
    await supabase.from('tasks').delete().eq('id', confirmDeleteId);
    setConfirmDeleteId(null);
    fetchTasks();
  }

  async function moveTask(task, direction) {
    const idx = COLUMNS.findIndex(c => c.key === task.status);
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= COLUMNS.length) return;
    await changeTaskStatus(task, COLUMNS[newIdx].key);
  }

  async function changeTaskStatus(task, newStatus) {
    const updates = { status: newStatus };
    if (newStatus === 'completed' && task.status !== 'completed') {
      updates.completed_at = new Date().toISOString();
    } else if (newStatus !== 'completed' && task.status === 'completed') {
      updates.completed_at = null;
    }
    await supabase.from('tasks').update(updates).eq('id', task.id);

    // Task View Cleanup (14yhc7kutvv) Step 2 -- the subtask-uncompleted
    // branch this used to have is now dead: subtask rows are excluded from
    // visibleTasks entirely, so task.parent_task_id can never be true here.
    // That workflow-progress bookkeeping now lives on the Workflows tab.
    if (newStatus === 'completed' && task.status !== 'completed') {
      await onTaskCompleted(task);
    }

    fetchTasks();
  }

  const KPI_TILES = [
    { label: 'Total Tasks',      value: kpis.total,          icon: '📋', bg: '#e8eef8',
      valueColor: 'var(--text1)' },
    { label: 'Open',             value: kpis.open,           icon: '📂', bg: '#fdf0dc',
      valueColor: kpis.open > 0 ? 'var(--warning)' : 'var(--text3)' },
    { label: 'Overdue',          value: kpis.overdue,        icon: '⚠️', bg: kpis.overdue > 0 ? '#faeae7' : '#f5f5f5',
      valueColor: kpis.overdue > 0 ? 'var(--danger)' : 'var(--text3)' },
    { label: 'Completed Today',  value: kpis.completedToday, icon: '✅', bg: '#e8f4ef',
      valueColor: kpis.completedToday > 0 ? 'var(--success)' : 'var(--text3)' },
  ];

  // For the delete confirm modal. Workflow parent tasks are excluded from
  // visibleTasks entirely (Step 2 above), so confirmDeleteId can now only
  // ever be a plain task -- no workflow-vs-task branch needed here anymore.

  return (
    <div>
      {/* ── KPI TILES ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {KPI_TILES.map((t, i) => (
          <div key={i} className="panel" style={{ textAlign: 'center', padding: '14px 10px' }}>
            <div style={{
              width: 36, height: 36, borderRadius: 9, background: t.bg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 17, margin: '0 auto 8px',
            }}>
              {t.icon}
            </div>
            <div style={{
              fontFamily: 'Playfair Display, serif', fontSize: 22, fontWeight: 600,
              color: t.valueColor, marginBottom: 4,
            }}>
              {t.value}
            </div>
            <div style={{ fontSize: 14, color: 'var(--text3)', fontWeight: 500 }}>{t.label}</div>
          </div>
        ))}
      </div>

      {/* ── TOOLBAR ────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '0 0 auto' }}>
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 14, pointerEvents: 'none' }}>🔍</span>
          <input
            type="text"
            className="form-input"
            placeholder="Search tasks by title..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 32, width: 300 }}
          />
        </div>
        {search.trim() && (
          <span style={{ fontSize: 14, color: 'var(--text3)' }}>
            {filtered.length} result{filtered.length !== 1 ? 's' : ''}
          </span>
        )}
        <SortSelect value={sortMode} onChange={setSortMode} options={TASK_SORT_OPTIONS} />
        <div style={{ marginLeft: 'auto' }}>
          <button className="btn-primary" onClick={openAdd} style={{ padding: '10px 20px' }}>
            + Add Task
          </button>
        </div>
      </div>

      {/* ── KANBAN BOARD ───────────────────────────────────────────────────── */}
      {loading ? (
        <div className="loading">Loading tasks...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {COLUMNS.map((col, colIndex) => {
            const allColTasks = filtered.filter(t => t.status === col.key);
            const colTasks = col.key === 'completed' && !search.trim()
              ? allColTasks.filter(t => t.workflow_instance_id || allColTasks.indexOf(t) < ARCHIVE_THRESHOLD)
              : allColTasks;
            return (
              <div key={col.key} className="panel" style={{ padding: 0, overflow: 'hidden', minHeight: 300 }}>
                <div style={{
                  background: col.headerBg, padding: '12px 16px',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <span style={{ fontSize: 16 }}>{col.icon}</span>
                  <span style={{ fontFamily: 'Playfair Display, serif', fontSize: 14, fontWeight: 600, color: col.headerColor }}>
                    {col.label}
                  </span>
                  <span style={{
                    marginLeft: 'auto', background: 'rgba(0,0,0,0.09)',
                    borderRadius: 12, padding: '2px 9px', fontSize: 12,
                    fontWeight: 700, color: col.headerColor,
                  }}>
                    {allColTasks.length}
                  </span>
                </div>

                <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {colTasks.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '28px 8px', color: 'var(--text3)', fontSize: 14 }}>
                      No tasks
                    </div>
                  ) : colTasks.map(task => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      colIndex={colIndex}
                      onMove={moveTask}
                      onEdit={openEdit}
                      onDelete={setConfirmDeleteId}
                      onChangeStatus={changeTaskStatus}
                      commentCount={commentCounts[task.id] || 0}
                      onOpenComments={setCommentTask}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── ARCHIVE SECTION ───────────────────────────────────────────────── */}
      {archivedTasks.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <button
            type="button"
            onClick={() => setShowArchive(a => !a)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%',
              background: 'var(--surface2)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '10px 16px', cursor: 'pointer',
              fontSize: 14, fontWeight: 600, color: 'var(--text2)',
              fontFamily: 'DM Sans, sans-serif',
            }}
          >
            <span>{showArchive ? '▲' : '▼'}</span>
            <span>📦 Completed Task Archive — {archivedTasks.length} older task{archivedTasks.length !== 1 ? 's' : ''}</span>
          </button>
          {showArchive && (
            <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
              {archivedTasks.map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  colIndex={COLUMNS.findIndex(c => c.key === 'completed')}
                  onMove={moveTask}
                  onEdit={openEdit}
                  onDelete={setConfirmDeleteId}
                  onChangeStatus={changeTaskStatus}
                  commentCount={commentCounts[task.id] || 0}
                  onOpenComments={setCommentTask}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── ADD / EDIT MODAL ───────────────────────────────────────────────── */}
      {showForm && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) closeForm(); }}>
          <div className="modal">
            <div className="modal-title">{editId ? 'Edit Task' : 'Add New Task'}</div>

            {formError && <div className="alert alert-error">{formError}</div>}

            <div className="form-group">
              <label className="form-label">Title *</label>
              <input
                className="form-input"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Task title"
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea
                className="form-input"
                rows={3}
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Optional details"
                style={{ resize: 'vertical' }}
              />
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Assigned To</label>
                <select
                  className="form-input"
                  value={form.assigned_to}
                  onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))}
                >
                  <option value="">— Select assignee —</option>
                  {profiles.map(p => {
                    const roleLabel = p.role === 'trustee' ? 'Trustee' : 'Community';
                    return (
                      <option key={p.full_name} value={p.full_name}>
                        {p.full_name} ({roleLabel})
                      </option>
                    );
                  })}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Due Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={form.due_date}
                  onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Priority</label>
              <select
                className="form-input"
                value={form.priority}
                onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
              >
                {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            <div style={{ display: 'flex', gap: 16, marginBottom: 4 }}>
              {PRIORITIES.map(p => (
                <span key={p} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 14, color: 'var(--text3)' }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: PRIORITY_BORDER[p], flexShrink: 0 }} />
                  {p}
                </span>
              ))}
            </div>

            <div className="modal-actions">
              <button className="btn-secondary" onClick={closeForm}>Cancel</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : editId ? 'Save Changes' : 'Add Task'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRM MODAL ───────────────────────────────────────────── */}
      {confirmDeleteId && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setConfirmDeleteId(null); }}>
          <div className="modal" style={{ maxWidth: 380 }}>
            <div className="modal-title" style={{ fontSize: 18 }}>
              Delete Task?
            </div>
            <p style={{ color: 'var(--text2)', fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
              This task will be permanently deleted and cannot be recovered.
            </p>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setConfirmDeleteId(null)}>Cancel</button>
              <button className="btn-danger" onClick={handleDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ── COMMENT / UPDATES MODAL ────────────────────────────────────────── */}
      {commentTask && (
        <CommentModal
          task={commentTask}
          onClose={() => setCommentTask(null)}
          onCommentPosted={handleCommentPosted}
        />
      )}
    </div>
  );
}
