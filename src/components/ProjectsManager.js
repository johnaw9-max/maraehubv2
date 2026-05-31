import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const STATUS_OPTIONS = ['planning', 'active', 'review', 'completed'];

const EMPTY_FORM = { name: '', status: 'planning', progress: 0, lead: '', due_date: '', notes: '' };

export default function ProjectsManager() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => { fetchProjects(); }, []);

  async function fetchProjects() {
    setLoading(true);
    const { data } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
    setProjects(data || []);
    setLoading(false);
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

  function formatDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function setField(k, v) { setForm(f => ({ ...f, [k]: v })); }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2 style={{ fontSize: 22 }}>Projects</h2>
        <button className="btn-primary" onClick={openAdd}>+ Add Project</button>
      </div>

      {loading ? <div className="loading">Loading projects...</div>
        : projects.length === 0 ? (
          <div className="empty-state">
            <div className="emoji">📋</div>
            <div>No projects yet. Add your first one!</div>
            <button className="btn-primary" style={{ marginTop: 16 }} onClick={openAdd}>+ Add Project</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {projects.map(p => (
              <div key={p.id} className="panel">
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{p.name}</div>
                    <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--text3)' }}>
                      {p.lead && <span>👤 {p.lead}</span>}
                      <span>📅 Due {formatDate(p.due_date)}</span>
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
            ))}
          </div>
        )}

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
