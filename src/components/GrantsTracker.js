// MaraeHub Grants Tracker
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import StatusPill from './StatusPill';
import { ensureTask } from '../lib/taskSync';

const STATUSES = ['researching', 'in-progress', 'submitted', 'approved', 'declined', 'reporting'];
const CATEGORIES = ['Community', 'Cultural', 'Education', 'Environment', 'Health', 'Infrastructure', 'Sport & Recreation', 'Other'];

const EMPTY_FORM = {
  name: '', funder: '', amount: '', category: 'Community', status: 'researching',
  deadline: '', submitted_date: '', decision_date: '', reporting_date: '',
  contact_name: '', contact_email: '', notes: '',
};

function fmt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtMoney(n) {
  if (!n) return '$0';
  return '$' + Number(n).toLocaleString('en-NZ');
}

function daysUntil(d) {
  if (!d) return null;
  const diff = new Date(d) - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export default function GrantsTracker() {
  const [grants, setGrants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => { fetchGrants(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchGrants() {
    setLoading(true);
    const { data } = await supabase.from('grants').select('*').order('created_at', { ascending: false });
    const rows = data || [];
    setGrants(rows);
    setLoading(false);
    createUrgentTasks(rows);
  }

  async function createUrgentTasks(rows) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const in14 = new Date(today); in14.setDate(in14.getDate() + 14);
    const urgent = rows.filter(g => {
      if (!g.deadline || ['approved', 'declined'].includes(g.status)) return false;
      const d = new Date(g.deadline);
      return d >= today && d <= in14;
    });
    for (const g of urgent) {
      const daysLeft = Math.ceil((new Date(g.deadline) - today) / 86400000);
      await ensureTask({
        title: `GRANT: ${g.name}`,
        description: `Grant deadline in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}. Funder: ${g.funder || 'unknown'}. Status: ${g.status}. Action required. [source_id:${g.id}]`,
        assigned_to: null,
        due_date: g.deadline,
        priority: 'High',
      });
    }
  }

  function openAdd() {
    setForm(EMPTY_FORM);
    setEditId(null);
    setError('');
    setSuccess('');
    setShowForm(true);
    setExpandedId(null);
  }

  function openEdit(g) {
    setForm({
      name: g.name || '',
      funder: g.funder || '',
      amount: g.amount || '',
      category: g.category || 'Community',
      status: g.status || 'researching',
      deadline: g.deadline || '',
      submitted_date: g.submitted_date || '',
      decision_date: g.decision_date || '',
      reporting_date: g.reporting_date || '',
      contact_name: g.contact_name || '',
      contact_email: g.contact_email || '',
      notes: g.notes || '',
    });
    setEditId(g.id);
    setError('');
    setSuccess('');
    setShowForm(true);
    setExpandedId(null);
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('Grant name is required'); return; }
    if (!form.funder.trim()) { setError('Funder is required'); return; }
    setSaving(true);
    setError('');

    const payload = {
      name: form.name.trim(),
      funder: form.funder.trim(),
      amount: form.amount ? parseFloat(form.amount) : null,
      category: form.category,
      status: form.status,
      deadline: form.deadline || null,
      submitted_date: form.submitted_date || null,
      decision_date: form.decision_date || null,
      reporting_date: form.reporting_date || null,
      contact_name: form.contact_name.trim() || null,
      contact_email: form.contact_email.trim() || null,
      notes: form.notes.trim() || null,
    };

    if (editId) {
      const { error } = await supabase.from('grants').update(payload).eq('id', editId);
      if (error) { setError(error.message); setSaving(false); return; }
      setSuccess('Grant updated.');
    } else {
      const { error } = await supabase.from('grants').insert(payload);
      if (error) { setError(error.message); setSaving(false); return; }
      setSuccess(form.name + ' added.');
    }

    setShowForm(false);
    setEditId(null);
    setSaving(false);
    fetchGrants();
  }

  async function handleDelete(id, name) {
    if (!window.confirm('Remove grant "' + name + '"?')) return;
    await supabase.from('grants').delete().eq('id', id);
    fetchGrants();
  }

  async function handleStatusChange(id, newStatus) {
    await supabase.from('grants').update({ status: newStatus }).eq('id', id);
    setGrants(prev => prev.map(g => g.id === id ? { ...g, status: newStatus } : g));
  }

  function setField(k, v) {
    setForm(f => ({ ...f, [k]: v }));
  }

  // Summary calculations
  const approvedTotal = grants.filter(g => g.status === 'approved').reduce((sum, g) => sum + (g.amount || 0), 0);
  const pendingTotal = grants.filter(g => ['submitted', 'in-progress', 'researching'].includes(g.status)).reduce((sum, g) => sum + (g.amount || 0), 0);
  const urgentDeadlines = grants.filter(g => {
    const days = daysUntil(g.deadline);
    return days !== null && days >= 0 && days <= 14 && !['approved', 'declined'].includes(g.status);
  });

  const filtered = filterStatus === 'all' ? grants : grants.filter(g => g.status === filterStatus);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 22 }}>Grants Tracker</h2>
          <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>Track funding applications and outcomes</p>
        </div>
        <button className="btn-primary" onClick={openAdd}>+ Add Grant</button>
      </div>

      {/* SUMMARY TILES */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        <div className="panel" style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: '#e8f4ef', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, margin: '0 auto 10px' }}>✅</div>
          <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 24, fontWeight: 600, color: 'var(--brand)' }}>{fmtMoney(approvedTotal)}</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>Approved Funding</div>
        </div>
        <div className="panel" style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: '#e8eef8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, margin: '0 auto 10px' }}>⏳</div>
          <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 24, fontWeight: 600, color: 'var(--info)' }}>{fmtMoney(pendingTotal)}</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>Pending / In Progress</div>
        </div>
        <div className="panel" style={{ textAlign: 'center', cursor: urgentDeadlines.length ? 'pointer' : 'default' }} onClick={() => urgentDeadlines.length && setFilterStatus('all')}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: urgentDeadlines.length ? '#fdf0dc' : '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, margin: '0 auto 10px' }}>🔔</div>
          <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 24, fontWeight: 600, color: urgentDeadlines.length ? 'var(--warning)' : 'var(--text3)' }}>{urgentDeadlines.length}</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>Deadlines in 14 Days</div>
          {urgentDeadlines.length > 0 && (
            <div style={{ marginTop: 8 }}>
              {urgentDeadlines.map(g => {
                const days = daysUntil(g.deadline);
                return (
                  <div key={g.id} style={{ fontSize: 11, color: days <= 7 ? 'var(--danger)' : 'var(--warning)', marginTop: 2 }}>
                    {g.name} — {days === 0 ? 'today' : days + 'd'}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {success && <div className="alert alert-success">{success}</div>}

      {/* ADD / EDIT MODAL */}
      {showForm && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) { setShowForm(false); setEditId(null); } }}>
          <div className="modal" style={{ maxWidth: 560 }}>
            <div className="modal-title">{editId ? 'Edit Grant' : 'Add New Grant'}</div>

            {error && <div className="alert alert-error">{error}</div>}

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Grant Name *</label>
                <input className="form-input" value={form.name} onChange={e => setField('name', e.target.value)} placeholder="e.g. Marae Development Fund" autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label">Funder *</label>
                <input className="form-input" value={form.funder} onChange={e => setField('funder', e.target.value)} placeholder="e.g. Te Puni Kōkiri" />
              </div>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Amount ($)</label>
                <input type="number" className="form-input" value={form.amount} onChange={e => setField('amount', e.target.value)} placeholder="e.g. 50000" />
              </div>
              <div className="form-group">
                <label className="form-label">Category</label>
                <select className="form-input" value={form.category} onChange={e => setField('category', e.target.value)}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-input" value={form.status} onChange={e => setField('status', e.target.value)}>
                  {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Deadline</label>
                <input type="date" className="form-input" value={form.deadline} onChange={e => setField('deadline', e.target.value)} />
              </div>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Submitted Date</label>
                <input type="date" className="form-input" value={form.submitted_date} onChange={e => setField('submitted_date', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Decision Date</label>
                <input type="date" className="form-input" value={form.decision_date} onChange={e => setField('decision_date', e.target.value)} />
              </div>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Reporting Due Date</label>
                <input type="date" className="form-input" value={form.reporting_date} onChange={e => setField('reporting_date', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Contact Name</label>
                <input className="form-input" value={form.contact_name} onChange={e => setField('contact_name', e.target.value)} placeholder="e.g. Jane Smith" />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Contact Email</label>
              <input type="email" className="form-input" value={form.contact_email} onChange={e => setField('contact_email', e.target.value)} placeholder="e.g. jane@funder.org.nz" />
            </div>

            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea className="form-input" rows={3} value={form.notes} onChange={e => setField('notes', e.target.value)} placeholder="Any additional notes..." style={{ resize: 'vertical' }} />
            </div>

            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => { setShowForm(false); setEditId(null); }}>Cancel</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : editId ? 'Save Changes' : 'Add Grant'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FILTER BAR */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {['all', ...STATUSES].map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            style={{
              fontSize: 11, borderRadius: 20, padding: '4px 12px', cursor: 'pointer', fontWeight: 500,
              background: filterStatus === s ? 'var(--brand)' : 'var(--surface2)',
              color: filterStatus === s ? '#fff' : 'var(--text2)',
              border: filterStatus === s ? '1px solid var(--brand)' : '1px solid var(--border)',
            }}
          >
            {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            {s !== 'all' && (
              <span style={{ marginLeft: 5, opacity: 0.7 }}>
                {grants.filter(g => g.status === s).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* GRANTS LIST */}
      {loading ? (
        <div className="loading">Loading grants...</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="emoji">💰</div>
          <div>{filterStatus === 'all' ? 'No grants yet — add your first one above' : `No grants with status "${filterStatus}"`}</div>
        </div>
      ) : (
        filtered.map(g => {
          const days = daysUntil(g.deadline);
          const isUrgent = days !== null && days >= 0 && days <= 14 && !['approved', 'declined'].includes(g.status);
          const isExpanded = expandedId === g.id;

          return (
            <div
              key={g.id}
              className="panel"
              style={{ marginBottom: 10, borderLeft: isUrgent ? '3px solid var(--warning)' : '3px solid transparent' }}
            >
              <div
                style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
                onClick={() => setExpandedId(isExpanded ? null : g.id)}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{g.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                    {g.funder}
                    {g.category && <span> · {g.category}</span>}
                    {g.deadline && (
                      <span style={{ color: isUrgent ? 'var(--warning)' : 'inherit' }}>
                        {' · '}Deadline: {fmt(g.deadline)}
                        {isUrgent && <strong> ({days === 0 ? 'today!' : days + 'd'})</strong>}
                      </span>
                    )}
                  </div>
                </div>
                {g.amount && (
                  <div style={{ fontSize: 15, fontWeight: 600, color: g.status === 'approved' ? 'var(--brand)' : 'var(--text2)' }}>
                    {fmtMoney(g.amount)}
                  </div>
                )}
                <StatusPill
                  status={g.status}
                  options={STATUSES}
                  onStatusChange={s => handleStatusChange(g.id, s)}
                />
                <span style={{ fontSize: 12, color: 'var(--text3)' }}>{isExpanded ? '▲' : '▼'}</span>
              </div>

              {isExpanded && (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px 24px', fontSize: 12, marginBottom: 12 }}>
                    {[
                      { label: 'Submitted', val: fmt(g.submitted_date) },
                      { label: 'Decision', val: fmt(g.decision_date) },
                      { label: 'Reporting Due', val: fmt(g.reporting_date) },
                      { label: 'Contact', val: g.contact_name || '—' },
                      { label: 'Email', val: g.contact_email ? <a href={`mailto:${g.contact_email}`} style={{ color: 'var(--brand)' }}>{g.contact_email}</a> : '—' },
                    ].map(({ label, val }) => (
                      <div key={label}>
                        <span style={{ color: 'var(--text3)', fontWeight: 500 }}>{label}: </span>
                        <span>{val}</span>
                      </div>
                    ))}
                  </div>
                  {g.notes && (
                    <div style={{ fontSize: 12, color: 'var(--text2)', background: 'var(--surface2)', borderRadius: 6, padding: '8px 10px', marginBottom: 12 }}>
                      {g.notes}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => openEdit(g)}
                      style={{ fontSize: 11, color: 'var(--brand)', background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(g.id, g.name)}
                      style={{ fontSize: 11, color: 'var(--danger)', background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
