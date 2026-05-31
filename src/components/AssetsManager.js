import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const CATEGORIES = ['Building', 'Equipment', 'Vehicle', 'Technology', 'Grounds', 'Other'];
const CONDITIONS = ['good', 'fair', 'poor'];
const EMPTY_FORM = { name: '', category: 'Building', location: '', condition: 'good', value: '', last_service: '', next_service: '', notes: '' };

export default function AssetsManager() {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => { fetchAssets(); }, []);

  async function fetchAssets() {
    setLoading(true);
    const { data } = await supabase.from('assets').select('*').order('created_at', { ascending: false });
    setAssets(data || []);
    setLoading(false);
  }

  function openAdd() { setForm(EMPTY_FORM); setEditId(null); setError(''); setShowModal(true); }

  function openEdit(a) {
    setForm({ name: a.name, category: a.category, location: a.location || '', condition: a.condition, value: a.value || '', last_service: a.last_service || '', next_service: a.next_service || '', notes: a.notes || '' });
    setEditId(a.id); setError(''); setShowModal(true);
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('Asset name is required'); return; }
    setSaving(true); setError('');
    const payload = { ...form, value: form.value ? parseFloat(form.value) : null };
    const { error } = editId
      ? await supabase.from('assets').update(payload).eq('id', editId)
      : await supabase.from('assets').insert(payload);
    if (error) { setError(error.message); setSaving(false); return; }
    setShowModal(false); fetchAssets(); setSaving(false);
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this asset?')) return;
    await supabase.from('assets').delete().eq('id', id);
    fetchAssets();
  }

  function formatDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function setField(k, v) { setForm(f => ({ ...f, [k]: v })); }

  const ICONS = { Building: '🏛️', Equipment: '🔧', Vehicle: '🚐', Technology: '💻', Grounds: '🌿', Other: '📦' };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2 style={{ fontSize: 22 }}>Assets Register</h2>
        <button className="btn-primary" onClick={openAdd}>+ Add Asset</button>
      </div>

      {loading ? <div className="loading">Loading assets...</div>
        : assets.length === 0 ? (
          <div className="empty-state">
            <div className="emoji">🏗️</div>
            <div>No assets yet. Add your first one!</div>
            <button className="btn-primary" style={{ marginTop: 16 }} onClick={openAdd}>+ Add Asset</button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
            {assets.map(a => (
              <div key={a.id} className="panel">
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div style={{ fontSize: 28 }}>{ICONS[a.category] || '📦'}</div>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 600 }}>{a.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text3)' }}>{a.category} · {a.location || 'No location'}</div>
                    </div>
                  </div>
                  <span className={`badge badge-${a.condition}`}>{a.condition}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12, color: 'var(--text2)', marginBottom: 12 }}>
                  <div><span style={{ color: 'var(--text3)' }}>Value: </span>{a.value ? `$${Number(a.value).toLocaleString()}` : '—'}</div>
                  <div><span style={{ color: 'var(--text3)' }}>Last service: </span>{formatDate(a.last_service)}</div>
                  <div><span style={{ color: 'var(--text3)' }}>Next service: </span>{formatDate(a.next_service)}</div>
                </div>
                {a.notes && <div style={{ fontSize: 12, color: 'var(--text2)', fontStyle: 'italic', marginBottom: 12 }}>{a.notes}</div>}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => openEdit(a)} style={{ fontSize: 12, color: 'var(--brand-light)', background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>Edit</button>
                  <button onClick={() => handleDelete(a.id)} style={{ fontSize: 12, color: 'var(--danger)', background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-title">{editId ? 'Edit Asset' : 'Add New Asset'}</div>
            {error && <div className="alert alert-error">{error}</div>}
            <div className="form-group">
              <label className="form-label">Asset Name *</label>
              <input className="form-input" value={form.name} onChange={e => setField('name', e.target.value)} placeholder="e.g. Wharenui Main Hall" />
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Category</label>
                <select className="form-input" value={form.category} onChange={e => setField('category', e.target.value)}>
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Condition</label>
                <select className="form-input" value={form.condition} onChange={e => setField('condition', e.target.value)}>
                  {CONDITIONS.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                </select>
              </div>
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Location</label>
                <input className="form-input" value={form.location} onChange={e => setField('location', e.target.value)} placeholder="e.g. Main grounds" />
              </div>
              <div className="form-group">
                <label className="form-label">Estimated Value ($)</label>
                <input type="number" className="form-input" value={form.value} onChange={e => setField('value', e.target.value)} placeholder="e.g. 50000" />
              </div>
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Last Service Date</label>
                <input type="date" className="form-input" value={form.last_service} onChange={e => setField('last_service', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Next Service Date</label>
                <input type="date" className="form-input" value={form.next_service} onChange={e => setField('next_service', e.target.value)} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea className="form-input" rows={3} value={form.notes} onChange={e => setField('notes', e.target.value)} placeholder="Condition details, maintenance notes..." style={{ resize: 'vertical' }} />
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : editId ? 'Save Changes' : 'Add Asset'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
