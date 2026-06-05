import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const STATUS_OPTIONS = ['planning', 'active', 'review', 'completed'];

const COLUMN_META = {
  planning:  { label: 'Planning',  icon: '🗂️' },
  active:    { label: 'Active',    icon: '⚡' },
  review:    { label: 'Review',    icon: '🔍' },
  completed: { label: 'Completed', icon: '✅' },
};

const EMPTY_FORM = { name: '', status: 'planning', progress: 0, lead: '', due_date: '', notes: '' };

function fmt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });
}

function isOverdue(p) {
  return p.due_date && p.status !== 'completed' && new Date(p.due_date) < new Date();
}

// ─── KANBAN CARD ─────────────────────────────────────────────────────────────

function KanbanCard({ p, subtaskCount, onEdit, onDelete, onMove }) {
  const statusIdx = STATUS_OPTIONS.indexOf(p.status);
  const overdue = isOverdue(p);

  return (
    <div
      className="panel"
      style={{
        marginBottom: 10,
        padding: '12px 14px',
        cursor: 'pointer',
        borderLeft: overdue ? '3px solid var(--danger)' : '3px solid transparent',
        transition: 'box-shadow 0.15s',
      }}
      onClick={() => onEdit(p)}
    >
      {/* NAME + OVERDUE */}
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, lineHeight: 1.3 }}>
        {p.name}
        {overdue && <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--danger)', background: '#faeae7', borderRadius: 4, padding: '1px 5px', marginLeft: 6, verticalAlign: 'middle' }}>OVERDUE</span>}
      </div>

      {/* LEAD + DUE DATE */}
      <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {p.lead && <span>👤 {p.lead}</span>}
        <span style={{ color: overdue ? 'var(--danger)' : 'var(--text3)' }}>📅 {fmt(p.due_date)}</span>
      </div>

      {/* PROGRESS BAR */}
      <div style={{ marginBottom: 4 }}>
        <div style={{ height: 5, background: 'var(--cream2)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${p.progress || 0}%`,
            background: p.status === 'completed' ? '#6b42a8' : 'var(--brand-light)',
            borderRadius: 3,
            transition: 'width 0.3s',
          }} />
        </div>
        <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 3 }}>{p.progress || 0}% complete</div>
      </div>

      {/* SUBTASK COUNT */}
      {subtaskCount > 0 && (
        <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 8 }}>
          ☑ {subtaskCount} task{subtaskCount !== 1 ? 's' : ''}
        </div>
      )}

      {/* ACTIONS — stop propagation so card click doesn't fire */}
      <div
        style={{ display: 'flex', gap: 4, marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)', alignItems: 'center' }}
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={() => onMove(p.id, STATUS_OPTIONS[statusIdx - 1])}
          disabled={statusIdx === 0}
          title="Move left"
          style={{
            fontSize: 12, padding: '3px 7px', borderRadius: 5, border: '1px solid var(--border)',
            background: 'none', cursor: statusIdx === 0 ? 'default' : 'pointer',
            color: statusIdx === 0 ? 'var(--cream2)' : 'var(--text2)',
          }}
        >
          ←
        </button>
        <button
          onClick={() => onMove(p.id, STATUS_OPTIONS[statusIdx + 1])}
          disabled={statusIdx === STATUS_OPTIONS.length - 1}
          title="Move right"
          style={{
            fontSize: 12, padding: '3px 7px', borderRadius: 5, border: '1px solid var(--border)',
            background: 'none', cursor: statusIdx === STATUS_OPTIONS.length - 1 ? 'default' : 'pointer',
            color: statusIdx === STATUS_OPTIONS.length - 1 ? 'var(--cream2)' : 'var(--text2)',
          }}
        >
          →
        </button>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => onEdit(p)}
          style={{ fontSize: 10, color: 'var(--brand)', background: 'none', border: '1px solid var(--border)', borderRadius: 5, padding: '3px 8px', cursor: 'pointer' }}
        >
          Edit
        </button>
        <button
          onClick={() => onDelete(p.id)}
          style={{ fontSize: 10, color: 'var(--danger)', background: 'none', border: '1px solid var(--border)', borderRadius: 5, padding: '3px 8px', cursor: 'pointer' }}
        >
          Delete
        </button>
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function ProjectsManager() {
  const [projects, setProjects] = useState([]);
  const [subtaskCounts, setSubtaskCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('kanban');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => { fetchProjects(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchProjects() {
    setLoading(true);
    const { data } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
    const rows = data || [];
    setProjects(rows);
    if (rows.length > 0) await fetchSubtaskCounts(rows.map(p => p.id));
    setLoading(false);
  }

  async function fetchSubtaskCounts(ids) {
    try {
      const { data, error } = await supabase
        .from('project_tasks')
        .select('project_id')
        .in('project_id', ids);
      if (error) return;
      const counts = {};
      (data || []).forEach(t => { counts[t.project_id] = (counts[t.project_id] || 0) + 1; });
      setSubtaskCounts(counts);
    } catch (_) {
      // project_tasks table not present — subtask counts stay hidden
    }
  }

  function openAdd() { setForm(EMPTY_FORM); setEditId(null); setError(''); setShowModal(true); }

  function openEdit(p) {
    setForm({ name: p.name, status: p.status, progress: p.progress, lead: p.lead || '', due_date: p.due_date || '', notes: p.notes || '' });
    setEditId(p.id); setError(''); setShowModal(true);
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('Project name is required'); return; }
    setSaving(true); setError('');
    const payload = { ...form, progress: parseInt(form.progress) };
    const { error } = editId
      ? await supabase.from('projects').update(payload).eq('id', editId)
      : await supabase.from('projects').insert(payload);
    if (error) { setError(error.message); setSaving(false); return; }
    setShowModal(false); fetchProjects(); setSaving(false);
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this project?')) return;
    await supabase.from('projects').delete().eq('id', id);
    fetchProjects();
  }

  async function moveProject(id, newStatus) {
    await supabase.from('projects').update({ status: newStatus }).eq('id', id);
    setProjects(prev => prev.map(p => p.id === id ? { ...p, status: newStatus } : p));
  }

  function setField(k, v) { setForm(f => ({ ...f, [k]: v })); }

  // ── KANBAN VIEW ────────────────────────────────────────────────────────────

  const kanbanView = (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, alignItems: 'start' }}>
      {STATUS_OPTIONS.map(status => {
        const col = projects.filter(p => p.status === status);
        const meta = COLUMN_META[status];
        return (
          <div key={status}>
            {/* COLUMN HEADER */}
            <div style={{
              background: '#1a4a3a',
              color: '#fff',
              padding: '10px 14px',
              borderRadius: '10px 10px 0 0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ fontSize: 14 }}>{meta.icon}</span>
                <span style={{ fontFamily: 'Playfair Display, serif', fontSize: 13, fontWeight: 600 }}>{meta.label}</span>
              </div>
              <span style={{
                background: 'rgba(255,255,255,0.2)',
                borderRadius: 20,
                padding: '2px 8px',
                fontSize: 11,
                fontWeight: 700,
                minWidth: 20,
                textAlign: 'center',
              }}>
                {col.length}
              </span>
            </div>

            {/* COLUMN BODY */}
            <div style={{
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              borderTop: 'none',
              borderRadius: '0 0 10px 10px',
              padding: 10,
              minHeight: 120,
            }}>
              {col.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center', padding: '20px 8px', fontStyle: 'italic' }}>
                  No projects
                </div>
              ) : col.map(p => (
                <KanbanCard
                  key={p.id}
                  p={p}
                  subtaskCount={subtaskCounts[p.id] || 0}
                  onEdit={openEdit}
                  onDelete={handleDelete}
                  onMove={moveProject}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );

  // ── LIST VIEW ──────────────────────────────────────────────────────────────

  const listView = projects.length === 0 ? (
    <div className="empty-state">
      <div className="emoji">📋</div>
      <div>No projects yet. Add your first one!</div>
      <button className="btn-primary" style={{ marginTop: 16 }} onClick={openAdd}>+ Add Project</button>
    </div>
  ) : (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {projects.map(p => {
        const overdue = isOverdue(p);
        return (
          <div key={p.id} className="panel" style={{ borderLeft: overdue ? '3px solid var(--danger)' : undefined }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
                  {p.name}
                  {overdue && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--danger)', background: '#faeae7', borderRadius: 4, padding: '1px 6px', marginLeft: 8 }}>OVERDUE</span>}
                </div>
                <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--text3)' }}>
                  {p.lead && <span>👤 {p.lead}</span>}
                  <span style={{ color: overdue ? 'var(--danger)' : 'var(--text3)' }}>📅 Due {fmt(p.due_date)}</span>
                  {subtaskCounts[p.id] > 0 && <span>☑ {subtaskCounts[p.id]} tasks</span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span className={`badge badge-${p.status}`}>{p.status}</span>
                <button onClick={() => openEdit(p)} style={{ fontSize: 12, color: 'var(--brand-light)', background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>Edit</button>
                <button onClick={() => handleDelete(p.id)} style={{ fontSize: 12, color: 'var(--danger)', background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>Delete</button>
              </div>
            </div>
            <div style={{ height: 6, background: 'var(--cream2)', borderRadius: 3, overflow: 'hidden', marginBottom: 6 }}>
              <div style={{ height: '100%', width: `${p.progress}%`, background: 'var(--brand-light)', borderRadius: 3 }} />
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>{p.progress}% complete</div>
            {p.notes && <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 8, fontStyle: 'italic' }}>{p.notes}</div>}
          </div>
        );
      })}
    </div>
  );

  // ── RENDER ─────────────────────────────────────────────────────────────────

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2 style={{ fontSize: 22 }}>Projects</h2>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {/* VIEW TOGGLE */}
          <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            <button
              onClick={() => setView('list')}
              style={{
                padding: '6px 14px', fontSize: 12, fontWeight: 600,
                background: view === 'list' ? 'var(--brand)' : 'var(--surface)',
                color: view === 'list' ? '#fff' : 'var(--text2)',
                border: 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
              }}
            >
              ☰ List
            </button>
            <button
              onClick={() => setView('kanban')}
              style={{
                padding: '6px 14px', fontSize: 12, fontWeight: 600,
                background: view === 'kanban' ? 'var(--brand)' : 'var(--surface)',
                color: view === 'kanban' ? '#fff' : 'var(--text2)',
                border: 'none', borderLeft: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
              }}
            >
              ▦ Board
            </button>
          </div>
          <button className="btn-primary" onClick={openAdd}>+ Add Project</button>
        </div>
      </div>

      {loading ? (
        <div className="loading">Loading projects...</div>
      ) : view === 'kanban' ? kanbanView : listView}

      {/* ADD / EDIT MODAL */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-title">{editId ? 'Edit Project' : 'Add New Project'}</div>
            {error && <div className="alert alert-error">{error}</div>}
            <div className="form-group">
              <label className="form-label">Project Name *</label>
              <input className="form-input" value={form.name} onChange={e => setField('name', e.target.value)} placeholder="e.g. Roof Restoration" />
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-input" value={form.status} onChange={e => setField('status', e.target.value)}>
                  {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Due Date</label>
                <input type="date" className="form-input" value={form.due_date} onChange={e => setField('due_date', e.target.value)} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Progress: {form.progress}%</label>
              <input type="range" min={0} max={100} step={5} value={form.progress} onChange={e => setField('progress', e.target.value)} style={{ width: '100%' }} />
            </div>
            <div className="form-group">
              <label className="form-label">Project Lead</label>
              <input className="form-input" value={form.lead} onChange={e => setField('lead', e.target.value)} placeholder="e.g. Hemi Tūhoe" />
            </div>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea className="form-input" rows={3} value={form.notes} onChange={e => setField('notes', e.target.value)} placeholder="Any additional notes..." style={{ resize: 'vertical' }} />
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : editId ? 'Save Changes' : 'Add Project'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
