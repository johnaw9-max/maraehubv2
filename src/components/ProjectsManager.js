import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import useProfiles from '../lib/useProfiles';
import StatusPill from './StatusPill';

const STATUS_OPTIONS = ['planning', 'active', 'review', 'completed'];

const COLUMN_META = {
  planning:  { label: 'Planning',  icon: '🗂️' },
  active:    { label: 'Active',    icon: '⚡' },
  review:    { label: 'Review',    icon: '🔍' },
  completed: { label: 'Completed', icon: '✅' },
};

const SUBTASK_PRIORITIES = ['High', 'Medium', 'Low'];
const SUBTASK_STATUSES   = ['Open', 'In Progress', 'Done'];

const PRIORITY_STYLE = {
  High:   { bg: '#faeae7', color: '#a63020' },
  Medium: { bg: '#fdf0dc', color: '#c8902a' },
  Low:    { bg: '#e8f4ef', color: '#2d6e57' },
};

const EMPTY_FORM         = { name: '', status: 'planning', progress: 0, lead: '', due_date: '', notes: '' };
const EMPTY_SUBTASK_FORM = { title: '', assigned_to: '', due_date: '', priority: 'Medium', status: 'Open' };

function fmt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });
}

function isOverdue(p) {
  return p.due_date && p.status !== 'completed' && new Date(p.due_date) < new Date();
}

// ─── KANBAN CARD ─────────────────────────────────────────────────────────────

function KanbanCard({ p, subtaskCount, onOpen, onEdit, onDelete, onMove }) {
  const statusIdx = STATUS_OPTIONS.indexOf(p.status);
  const overdue = isOverdue(p);

  return (
    <div
      className="panel"
      style={{
        marginBottom: 10, padding: '12px 14px', cursor: 'pointer',
        borderLeft: overdue ? '3px solid var(--danger)' : '3px solid transparent',
        transition: 'box-shadow 0.15s',
      }}
      onClick={() => onOpen(p)}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.3, flex: 1, minWidth: 0, paddingRight: 8 }}>
          {p.name}
          {overdue && <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--danger)', background: '#faeae7', borderRadius: 4, padding: '1px 5px', marginLeft: 6, verticalAlign: 'middle' }}>OVERDUE</span>}
        </div>
        <span onClick={e => e.stopPropagation()}>
          <StatusPill
            status={p.status}
            options={STATUS_OPTIONS}
            onStatusChange={s => onMove(p.id, s)}
          />
        </span>
      </div>

      <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {p.lead && <span>👤 {p.lead}</span>}
        <span style={{ color: overdue ? 'var(--danger)' : 'var(--text3)' }}>📅 {fmt(p.due_date)}</span>
      </div>

      <div style={{ marginBottom: 4 }}>
        <div style={{ height: 5, background: 'var(--cream2)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${p.progress || 0}%`, background: p.status === 'completed' ? '#6b42a8' : 'var(--brand-light)', borderRadius: 3, transition: 'width 0.3s' }} />
        </div>
        <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 3 }}>{p.progress || 0}%{subtaskCount > 0 ? ` · ${subtaskCount} subtask${subtaskCount !== 1 ? 's' : ''}` : ''}</div>
      </div>

      <div
        style={{ display: 'flex', gap: 4, marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)', alignItems: 'center' }}
        onClick={e => e.stopPropagation()}
      >
        <button onClick={() => onMove(p.id, STATUS_OPTIONS[statusIdx - 1])} disabled={statusIdx === 0} title="Move left"
          style={{ fontSize: 12, padding: '3px 7px', borderRadius: 5, border: '1px solid var(--border)', background: 'none', cursor: statusIdx === 0 ? 'default' : 'pointer', color: statusIdx === 0 ? 'var(--cream2)' : 'var(--text2)' }}>←</button>
        <button onClick={() => onMove(p.id, STATUS_OPTIONS[statusIdx + 1])} disabled={statusIdx === STATUS_OPTIONS.length - 1} title="Move right"
          style={{ fontSize: 12, padding: '3px 7px', borderRadius: 5, border: '1px solid var(--border)', background: 'none', cursor: statusIdx === STATUS_OPTIONS.length - 1 ? 'default' : 'pointer', color: statusIdx === STATUS_OPTIONS.length - 1 ? 'var(--cream2)' : 'var(--text2)' }}>→</button>
        <div style={{ flex: 1 }} />
        <button onClick={() => onEdit(p)} style={{ fontSize: 10, color: 'var(--brand)', background: 'none', border: '1px solid var(--border)', borderRadius: 5, padding: '3px 8px', cursor: 'pointer' }}>Edit</button>
        <button onClick={() => onDelete(p.id)} style={{ fontSize: 10, color: 'var(--danger)', background: 'none', border: '1px solid var(--border)', borderRadius: 5, padding: '3px 8px', cursor: 'pointer' }}>Delete</button>
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function ProjectsManager() {
  const profiles = useProfiles();

  // Project state
  const [projects, setProjects]         = useState([]);
  const [subtaskCounts, setSubtaskCounts] = useState({});
  const [loading, setLoading]           = useState(true);
  const [view, setView]                 = useState('kanban');
  const [showModal, setShowModal]       = useState(false);
  const [form, setForm]                 = useState(EMPTY_FORM);
  const [saving, setSaving]             = useState(false);
  const [editId, setEditId]             = useState(null);
  const [error, setError]               = useState('');

  // Detail / subtask state
  const [selectedProject, setSelectedProject]   = useState(null);
  const [subtasks, setSubtasks]                 = useState([]);
  const [subtaskForm, setSubtaskForm]           = useState(EMPTY_SUBTASK_FORM);
  const [savingSubtask, setSavingSubtask]       = useState(false);
  const [subtaskError, setSubtaskError]         = useState('');

  useEffect(() => { fetchProjects(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchProjects() {
    setLoading(true);
    const { data } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
    const rows = data || [];
    setProjects(rows);
    // Counts come straight from the JSONB field — no separate table query
    const counts = {};
    rows.forEach(p => { counts[p.id] = (p.subtasks || []).length; });
    setSubtaskCounts(counts);
    setLoading(false);
  }

  // ── PROJECT CRUD ───────────────────────────────────────────────────────────

  function openAdd() { setForm(EMPTY_FORM); setEditId(null); setError(''); setShowModal(true); }

  function openEdit(p) {
    setForm({ name: p.name, status: p.status, progress: p.progress, lead: p.lead || '', due_date: p.due_date || '', notes: p.notes || '' });
    setEditId(p.id); setError(''); setShowModal(true);
  }

  function openProject(p) {
    setSelectedProject(p);
    setSubtasks(p.subtasks || []);
    setSubtaskForm(EMPTY_SUBTASK_FORM);
    setSubtaskError('');
  }

  function closeProject() {
    setSelectedProject(null);
    setSubtasks([]);
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('Project name is required'); return; }
    setSaving(true); setError('');
    const payload = { ...form, progress: parseInt(form.progress) };
    const { error } = editId
      ? await supabase.from('projects').update(payload).eq('id', editId)
      : await supabase.from('projects').insert({ ...payload, subtasks: [] });
    if (error) { setError(error.message); setSaving(false); return; }
    setShowModal(false); fetchProjects(); setSaving(false);
    // Refresh selected project if we just edited it
    if (editId && selectedProject?.id === editId) {
      setSelectedProject(prev => ({ ...prev, ...payload }));
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this project?')) return;
    await supabase.from('projects').delete().eq('id', id);
    if (selectedProject?.id === id) closeProject();
    fetchProjects();
  }

  async function moveProject(id, newStatus) {
    await supabase.from('projects').update({ status: newStatus }).eq('id', id);
    setProjects(prev => prev.map(p => p.id === id ? { ...p, status: newStatus } : p));
  }

  function setField(k, v) { setForm(f => ({ ...f, [k]: v })); }

  // ── SUBTASK CRUD (stored as JSONB on the project row) ─────────────────────

  async function saveSubtasksToProject(newSubtasks) {
    const { error } = await supabase
      .from('projects')
      .update({ subtasks: newSubtasks })
      .eq('id', selectedProject.id);
    if (error) return error;
    setSubtasks(newSubtasks);
    setSelectedProject(prev => ({ ...prev, subtasks: newSubtasks }));
    setProjects(prev => prev.map(p =>
      p.id === selectedProject.id ? { ...p, subtasks: newSubtasks } : p
    ));
    setSubtaskCounts(prev => ({ ...prev, [selectedProject.id]: newSubtasks.length }));
    return null;
  }

  async function handleSaveSubtask() {
    if (!subtaskForm.title.trim()) { setSubtaskError('Title is required.'); return; }
    setSavingSubtask(true); setSubtaskError('');
    const newSubtask = {
      id:          crypto.randomUUID(),
      title:       subtaskForm.title.trim(),
      assigned_to: subtaskForm.assigned_to || null,
      due_date:    subtaskForm.due_date || null,
      priority:    subtaskForm.priority,
      status:      subtaskForm.status,
      created_at:  new Date().toISOString(),
    };
    const err = await saveSubtasksToProject([...subtasks, newSubtask]);
    if (err) { setSubtaskError(err.message); setSavingSubtask(false); return; }
    setSubtaskForm(EMPTY_SUBTASK_FORM);
    setSavingSubtask(false);
  }

  async function toggleSubtask(st) {
    const newStatus = st.status === 'Done' ? 'Open' : 'Done';
    await saveSubtasksToProject(subtasks.map(s => s.id === st.id ? { ...s, status: newStatus } : s));
  }

  async function deleteSubtask(id) {
    await saveSubtasksToProject(subtasks.filter(s => s.id !== id));
  }

  // ── DERIVED ────────────────────────────────────────────────────────────────

  const doneCount     = subtasks.filter(s => s.status === 'Done').length;
  const subtaskProgress = subtasks.length > 0 ? Math.round((doneCount / subtasks.length) * 100) : null;

  // ── KANBAN VIEW ────────────────────────────────────────────────────────────

  const kanbanView = (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, alignItems: 'start' }}>
      {STATUS_OPTIONS.map(status => {
        const col = projects.filter(p => p.status === status);
        const meta = COLUMN_META[status];
        return (
          <div key={status}>
            <div style={{ background: '#1a4a3a', color: '#fff', padding: '10px 14px', borderRadius: '10px 10px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ fontSize: 14 }}>{meta.icon}</span>
                <span style={{ fontFamily: 'Playfair Display, serif', fontSize: 13, fontWeight: 600 }}>{meta.label}</span>
              </div>
              <span style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>{col.length}</span>
            </div>
            <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 10px 10px', padding: 10, minHeight: 120 }}>
              {col.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center', padding: '20px 8px', fontStyle: 'italic' }}>No projects</div>
              ) : col.map(p => (
                <KanbanCard key={p.id} p={p} subtaskCount={subtaskCounts[p.id] || 0}
                  onOpen={openProject} onEdit={openEdit} onDelete={handleDelete} onMove={moveProject} />
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
          <div key={p.id} className="panel" style={{ borderLeft: overdue ? '3px solid var(--danger)' : undefined, cursor: 'pointer' }} onClick={() => openProject(p)}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
                  {p.name}
                  {overdue && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--danger)', background: '#faeae7', borderRadius: 4, padding: '1px 6px', marginLeft: 8 }}>OVERDUE</span>}
                </div>
                <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--text3)' }}>
                  {p.lead && <span>👤 {p.lead}</span>}
                  <span style={{ color: overdue ? 'var(--danger)' : 'var(--text3)' }}>📅 Due {fmt(p.due_date)}</span>
                  {subtaskCounts[p.id] > 0 && <span>☑ {subtaskCounts[p.id]} subtasks</span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                <StatusPill
                  status={p.status}
                  options={STATUS_OPTIONS}
                  onStatusChange={s => moveProject(p.id, s)}
                />
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

  // ── DETAIL VIEW ────────────────────────────────────────────────────────────

  const detailView = selectedProject && (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <button
          onClick={closeProject}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontSize: 13, color: 'var(--text2)', fontFamily: 'DM Sans, sans-serif' }}
        >
          ← Back to Projects
        </button>
        <button className="btn-primary" style={{ fontSize: 13 }} onClick={() => openEdit(selectedProject)}>Edit Project</button>
      </div>

      {/* Project info panel */}
      <div className="panel" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <h2 style={{ fontSize: 20, marginBottom: 6 }}>{selectedProject.name}</h2>
            <div style={{ display: 'flex', gap: 16, fontSize: 13, color: 'var(--text3)', flexWrap: 'wrap' }}>
              {selectedProject.lead    && <span>👤 {selectedProject.lead}</span>}
              {selectedProject.due_date && <span style={{ color: isOverdue(selectedProject) ? 'var(--danger)' : 'var(--text3)' }}>📅 Due {fmt(selectedProject.due_date)}</span>}
            </div>
          </div>
          <StatusPill
            status={selectedProject.status}
            options={STATUS_OPTIONS}
            onStatusChange={s => moveProject(selectedProject.id, s)}
            size="md"
          />
        </div>

        {selectedProject.notes && (
          <div style={{ fontSize: 13, color: 'var(--text2)', fontStyle: 'italic', marginBottom: 12, padding: '10px 12px', background: 'var(--surface2)', borderRadius: 8 }}>
            {selectedProject.notes}
          </div>
        )}

        {/* Progress bar — driven by subtasks if present, otherwise manual */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>
            <span>{subtasks.length > 0 ? `${doneCount} of ${subtasks.length} subtasks complete` : `${selectedProject.progress}% complete`}</span>
            <span style={{ fontWeight: 600, color: 'var(--brand)' }}>{subtasks.length > 0 ? subtaskProgress : selectedProject.progress}%</span>
          </div>
          <div style={{ height: 8, background: 'var(--cream2)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${subtasks.length > 0 ? subtaskProgress : selectedProject.progress}%`,
              background: subtaskProgress === 100 ? '#6b42a8' : 'var(--brand-light)',
              borderRadius: 4, transition: 'width 0.3s',
            }} />
          </div>
        </div>
      </div>

      {/* Subtasks section */}
      <div className="panel">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 16, fontWeight: 600 }}>
            Subtasks
            {subtasks.length > 0 && (
              <span style={{ fontSize: 12, fontFamily: 'DM Sans, sans-serif', fontWeight: 400, color: 'var(--text3)', marginLeft: 8 }}>
                {doneCount}/{subtasks.length} done
              </span>
            )}
          </div>
        </div>

        {subtasks.length === 0 ? (
          <div style={{ color: 'var(--text3)', fontSize: 13, padding: '8px 0 16px', fontStyle: 'italic' }}>No subtasks yet — add one below.</div>
        ) : (
          <div style={{ marginBottom: 16 }}>
            {/* Column headers */}
            <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 140px 110px 80px 32px', gap: 8, padding: '0 0 6px', borderBottom: '1px solid var(--border)', marginBottom: 6 }}>
              {['', 'Task', 'Assignee', 'Due Date', 'Priority', ''].map((h, i) => (
                <div key={i} style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</div>
              ))}
            </div>

            {subtasks.map(st => {
              const done = st.status === 'Done';
              const ps   = PRIORITY_STYLE[st.priority] || PRIORITY_STYLE.Medium;
              return (
                <div key={st.id} style={{ display: 'grid', gridTemplateColumns: '28px 1fr 140px 110px 80px 32px', gap: 8, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--cream2)' }}>
                  {/* Checkbox */}
                  <button
                    type="button"
                    onClick={() => toggleSubtask(st)}
                    style={{
                      width: 20, height: 20, borderRadius: 5, border: `2px solid ${done ? 'var(--brand)' : 'var(--border)'}`,
                      background: done ? 'var(--brand)' : '#fff', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}
                  >
                    {done && <span style={{ color: '#fff', fontSize: 11, lineHeight: 1, fontWeight: 700 }}>✓</span>}
                  </button>

                  {/* Title */}
                  <div style={{ fontSize: 13, color: done ? 'var(--text3)' : 'var(--text1)', textDecoration: done ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {st.title}
                  </div>

                  {/* Assignee */}
                  <div style={{ fontSize: 12, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {st.assigned_to || '—'}
                  </div>

                  {/* Due date */}
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>{fmt(st.due_date)}</div>

                  {/* Priority badge */}
                  <span style={{ fontSize: 10, background: ps.bg, color: ps.color, borderRadius: 20, padding: '2px 8px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {st.priority}
                  </span>

                  {/* Delete */}
                  <button
                    type="button"
                    onClick={() => deleteSubtask(st.id)}
                    title="Remove subtask"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 14, padding: 0, lineHeight: 1 }}
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Add subtask form */}
        <div style={{ borderTop: subtasks.length > 0 ? '1px solid var(--border)' : 'none', paddingTop: subtasks.length > 0 ? 16 : 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Add Subtask</div>
          {subtaskError && <div className="alert alert-error" style={{ marginBottom: 10 }}>{subtaskError}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px 130px 110px', gap: 8, marginBottom: 8 }}>
            <input
              type="text"
              className="form-input"
              placeholder="Subtask title *"
              value={subtaskForm.title}
              onChange={e => { const v = e.target.value; setSubtaskForm(f => ({ ...f, title: v })); }}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSaveSubtask(); } }}
              style={{ fontSize: 13 }}
            />
            <select className="form-input" value={subtaskForm.assigned_to} onChange={e => setSubtaskForm(f => ({ ...f, assigned_to: e.target.value }))} style={{ fontSize: 13 }}>
              <option value="">— Assignee —</option>
              {profiles.map(p => (
                <option key={p.full_name} value={p.full_name}>
                  {p.full_name} ({p.role === 'trustee' ? 'T' : 'C'})
                </option>
              ))}
            </select>
            <input type="date" className="form-input" value={subtaskForm.due_date} onChange={e => setSubtaskForm(f => ({ ...f, due_date: e.target.value }))} style={{ fontSize: 13 }} />
            <select className="form-input" value={subtaskForm.priority} onChange={e => setSubtaskForm(f => ({ ...f, priority: e.target.value }))} style={{ fontSize: 13 }}>
              {SUBTASK_PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select className="form-input" value={subtaskForm.status} onChange={e => setSubtaskForm(f => ({ ...f, status: e.target.value }))} style={{ fontSize: 13, width: 140 }}>
              {SUBTASK_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <button className="btn-primary" onClick={handleSaveSubtask} disabled={savingSubtask} style={{ fontSize: 13, padding: '9px 20px' }}>
              {savingSubtask ? 'Adding...' : '+ Add Subtask'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // ── RENDER ─────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Header — hidden in detail view */}
      {!selectedProject && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontSize: 22 }}>Projects</h2>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
              <button onClick={() => setView('list')} style={{ padding: '6px 14px', fontSize: 12, fontWeight: 600, background: view === 'list' ? 'var(--brand)' : 'var(--surface)', color: view === 'list' ? '#fff' : 'var(--text2)', border: 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>☰ List</button>
              <button onClick={() => setView('kanban')} style={{ padding: '6px 14px', fontSize: 12, fontWeight: 600, background: view === 'kanban' ? 'var(--brand)' : 'var(--surface)', color: view === 'kanban' ? '#fff' : 'var(--text2)', border: 'none', borderLeft: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>▦ Board</button>
            </div>
            <button className="btn-primary" onClick={openAdd}>+ Add Project</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading">Loading projects...</div>
      ) : selectedProject ? detailView : view === 'kanban' ? kanbanView : listView}

      {/* ADD / EDIT MODAL */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-title">{editId ? 'Edit Project' : 'Add New Project'}</div>
            {error && <div className="alert alert-error">{error}</div>}
            <div className="form-group">
              <label className="form-label">Project Name *</label>
              <input className="form-input" value={form.name} onChange={e => setField('name', e.target.value)} placeholder="e.g. Roof Restoration" autoFocus />
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
              <select className="form-input" value={form.lead} onChange={e => setField('lead', e.target.value)}>
                <option value="">— Select assignee —</option>
                {profiles.map(p => (
                  <option key={p.full_name} value={p.full_name}>
                    {p.full_name} ({p.role === 'trustee' ? 'Trustee' : 'Community'})
                  </option>
                ))}
              </select>
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
