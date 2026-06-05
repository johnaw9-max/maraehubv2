import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';

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

const EMPTY_FORM = { title: '', description: '', assigned_to: '', due_date: '', priority: 'Medium' };

function fmtDate(d) {
  if (!d) return null;
  return new Date(d + 'T12:00:00').toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });
}

function isOverdue(task) {
  if (!task.due_date || ['completed', 'cancelled'].includes(task.status)) return false;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return new Date(task.due_date + 'T12:00:00') < today;
}

function isCompletedToday(task) {
  if (task.status !== 'completed' || !task.completed_at) return false;
  return new Date(task.completed_at).toDateString() === new Date().toDateString();
}

// ─── TASK CARD ────────────────────────────────────────────────────────────────

function TaskCard({ task, colIndex, onMove, onEdit, onDelete }) {
  const overdue = isOverdue(task);
  const dateStr = fmtDate(task.due_date);
  const badge = PRIORITY_BADGE[task.priority] || PRIORITY_BADGE.Medium;
  const isFirst = colIndex === 0;
  const isLast = colIndex === COLUMNS.length - 1;

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderLeft: `4px solid ${PRIORITY_BORDER[task.priority] || PRIORITY_BORDER.Medium}`,
      borderRadius: '0 8px 8px 0',
      padding: '12px 12px 10px',
    }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text1)', marginBottom: 6, lineHeight: 1.4 }}>
        {task.title}
      </div>

      {task.assigned_to && (
        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
          <span>👤</span> {task.assigned_to}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        {dateStr && (
          <span style={{ fontSize: 11, color: overdue ? 'var(--danger)' : 'var(--text3)', display: 'flex', alignItems: 'center', gap: 3 }}>
            <span>📅</span> {dateStr}
          </span>
        )}
        {overdue && (
          <span style={{
            fontSize: 10, background: '#faeae7', color: 'var(--danger)',
            border: '1px solid #f0b8b0', borderRadius: 20, padding: '1px 7px',
            fontWeight: 700, letterSpacing: '0.03em',
          }}>
            OVERDUE
          </span>
        )}
      </div>

      <div style={{ marginBottom: 10 }}>
        <span style={{
          fontSize: 10, background: badge.bg, color: badge.color,
          borderRadius: 20, padding: '2px 8px', fontWeight: 600, letterSpacing: '0.04em',
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
            padding: '4px 0', fontSize: 11, fontWeight: 600,
          }}
        >Edit</button>

        <button
          onClick={() => onDelete(task.id)}
          style={{
            flex: 1, background: '#faeae7', color: 'var(--danger)',
            border: '1px solid #f0b8b0', borderRadius: 6,
            padding: '4px 0', fontSize: 11, fontWeight: 600,
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
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [search, setSearch] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  useEffect(() => { fetchTasks(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchTasks() {
    setLoading(true);
    const { data } = await supabase.from('tasks').select('*').order('created_at', { ascending: false });
    setTasks(data || []);
    setLoading(false);
  }

  const kpis = useMemo(() => ({
    total: tasks.length,
    open: tasks.filter(t => t.status === 'open').length,
    overdue: tasks.filter(t => isOverdue(t)).length,
    completedToday: tasks.filter(t => isCompletedToday(t)).length,
  }), [tasks]);

  const filtered = useMemo(() => {
    if (!search.trim()) return tasks;
    const q = search.toLowerCase();
    return tasks.filter(t => t.title?.toLowerCase().includes(q));
  }, [tasks, search]);

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
    await supabase.from('tasks').delete().eq('id', confirmDeleteId);
    setConfirmDeleteId(null);
    fetchTasks();
  }

  async function moveTask(task, direction) {
    const idx = COLUMNS.findIndex(c => c.key === task.status);
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= COLUMNS.length) return;
    const newStatus = COLUMNS[newIdx].key;
    const updates = { status: newStatus };
    if (newStatus === 'completed') updates.completed_at = new Date().toISOString();
    else if (task.status === 'completed') updates.completed_at = null;
    await supabase.from('tasks').update(updates).eq('id', task.id);
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
            <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 500 }}>{t.label}</div>
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
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>
            {filtered.length} result{filtered.length !== 1 ? 's' : ''}
          </span>
        )}
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
            const colTasks = filtered.filter(t => t.status === col.key);
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
                    {colTasks.length}
                  </span>
                </div>

                <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {colTasks.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '28px 8px', color: 'var(--text3)', fontSize: 12 }}>
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
                    />
                  ))}
                </div>
              </div>
            );
          })}
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
                <input
                  className="form-input"
                  value={form.assigned_to}
                  onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))}
                  placeholder="Person's name"
                />
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
                <span key={p} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text3)' }}>
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
            <div className="modal-title" style={{ fontSize: 18 }}>Delete Task?</div>
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
    </div>
  );
}
