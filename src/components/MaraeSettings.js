import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const EMPTY_FORM = {
  marae_name: '', location: '', iwi: '', hapu: '', phone: '', email: '', website: '',
};

export default function MaraeSettings() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [settingsId, setSettingsId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // Checklist template state
  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [newItem, setNewItem] = useState('');
  const [addingItem, setAddingItem] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editLabel, setEditLabel] = useState('');
  const [templateError, setTemplateError] = useState('');

  useEffect(() => {
    fetchSettings();
    fetchTemplates();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchSettings() {
    setLoading(true);
    const { data } = await supabase.from('marae_settings').select('*').limit(1).single();
    if (data) {
      setSettingsId(data.id);
      setForm({
        marae_name: data.marae_name || '',
        location: data.location || '',
        iwi: data.iwi || '',
        hapu: data.hapu || '',
        phone: data.phone || '',
        email: data.email || '',
        website: data.website || '',
      });
    }
    setLoading(false);
  }

  async function fetchTemplates() {
    setTemplatesLoading(true);
    const { data } = await supabase
      .from('checklist_templates')
      .select('*')
      .order('sort_order', { ascending: true });
    setTemplates(data || []);
    setTemplatesLoading(false);
  }

  async function handleSave() {
    if (!form.marae_name.trim()) { setError('Marae name is required'); return; }
    setSaving(true); setError(''); setSuccess(false);
    const payload = { ...form, updated_at: new Date().toISOString() };
    const { error } = settingsId
      ? await supabase.from('marae_settings').update(payload).eq('id', settingsId)
      : await supabase.from('marae_settings').insert(payload);
    if (error) { setError(error.message); setSaving(false); return; }
    setSuccess(true);
    setSaving(false);
    setTimeout(() => setSuccess(false), 3000);
  }

  async function handleAddItem() {
    if (!newItem.trim()) return;
    setAddingItem(true); setTemplateError('');
    const maxOrder = templates.length ? Math.max(...templates.map(t => t.sort_order || 0)) : 0;
    const { error } = await supabase.from('checklist_templates').insert({
      label: newItem.trim(),
      sort_order: maxOrder + 1,
      active: true,
    });
    if (error) { setTemplateError(error.message); setAddingItem(false); return; }
    setNewItem('');
    setAddingItem(false);
    fetchTemplates();
  }

  async function handleSaveEdit(id) {
    if (!editLabel.trim()) return;
    await supabase.from('checklist_templates').update({ label: editLabel.trim() }).eq('id', id);
    setEditingId(null);
    setEditLabel('');
    fetchTemplates();
  }

  async function handleToggleActive(t) {
    await supabase.from('checklist_templates').update({ active: !t.active }).eq('id', t.id);
    fetchTemplates();
  }

  async function handleDeleteItem(id) {
    if (!window.confirm('Remove this checklist item?')) return;
    await supabase.from('checklist_templates').delete().eq('id', id);
    fetchTemplates();
  }

  async function handleMoveItem(idx, direction) {
    const next = [...templates];
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= next.length) return;
    const aOrder = next[idx].sort_order;
    const bOrder = next[swapIdx].sort_order;
    await Promise.all([
      supabase.from('checklist_templates').update({ sort_order: bOrder }).eq('id', next[idx].id),
      supabase.from('checklist_templates').update({ sort_order: aOrder }).eq('id', next[swapIdx].id),
    ]);
    fetchTemplates();
  }

  function setField(k, v) { setForm(f => ({ ...f, [k]: v })); }

  if (loading) return <div className="loading">Loading settings...</div>;

  return (
    <div style={{ maxWidth: 640 }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 22 }}>Settings</h2>
        <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>Manage your marae details and system configuration</p>
      </div>

      {/* ── MARAE IDENTITY ── */}
      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">✓ Settings saved successfully!</div>}

      <div className="panel" style={{ marginBottom: 20 }}>
        <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 16, fontWeight: 600, marginBottom: 20, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
          Marae Identity
        </div>

        <div className="form-group">
          <label className="form-label">Marae Name *</label>
          <input className="form-input" value={form.marae_name} onChange={e => setField('marae_name', e.target.value)} placeholder="e.g. Te Marae o Tainui" />
        </div>

        <div className="form-group">
          <label className="form-label">Location</label>
          <input className="form-input" value={form.location} onChange={e => setField('location', e.target.value)} placeholder="e.g. Manurewa, Auckland" />
        </div>

        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Iwi</label>
            <input className="form-input" value={form.iwi} onChange={e => setField('iwi', e.target.value)} placeholder="e.g. Tainui" />
          </div>
          <div className="form-group">
            <label className="form-label">Hapū</label>
            <input className="form-input" value={form.hapu} onChange={e => setField('hapu', e.target.value)} placeholder="e.g. Ngāti Whātua" />
          </div>
        </div>

        <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 16, fontWeight: 600, margin: '20px 0 16px', paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
          Contact Details
        </div>

        <div className="form-group">
          <label className="form-label">Phone</label>
          <input className="form-input" value={form.phone} onChange={e => setField('phone', e.target.value)} placeholder="e.g. 09 123 4567" />
        </div>

        <div className="form-group">
          <label className="form-label">Email</label>
          <input type="email" className="form-input" value={form.email} onChange={e => setField('email', e.target.value)} placeholder="e.g. kaitiaki@marae.co.nz" />
        </div>

        <div className="form-group">
          <label className="form-label">Website (optional)</label>
          <input className="form-input" value={form.website} onChange={e => setField('website', e.target.value)} placeholder="e.g. www.marae.co.nz" />
        </div>

        <div style={{ marginTop: 8 }}>
          <button className="btn-primary" onClick={handleSave} disabled={saving} style={{ padding: '11px 28px', fontSize: 14 }}>
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>

      {/* ── CHECKLIST TEMPLATE ── */}
      <div className="panel">
        <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 16, fontWeight: 600, marginBottom: 4, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
          Exit Checklist Template
        </div>
        <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 16 }}>
          These items appear on the exit checklist for all completed bookings. Toggle items off to hide them without deleting.
        </p>

        {templateError && <div className="alert alert-error">{templateError}</div>}

        {templatesLoading ? <div className="loading">Loading...</div> : (
          <>
            {templates.length === 0 && (
              <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 16 }}>No checklist items yet. Add your first item below.</div>
            )}

            {templates.map((t, idx) => (
              <div
                key={t.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
                  background: t.active ? 'var(--surface2)' : '#f9f9f9',
                  border: `1px solid ${t.active ? 'var(--border)' : '#e8e8e8'}`,
                  borderRadius: 8, marginBottom: 6, opacity: t.active ? 1 : 0.6,
                }}
              >
                {/* REORDER */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <button onClick={() => handleMoveItem(idx, -1)} disabled={idx === 0}
                    style={{ background: 'none', border: 'none', cursor: idx === 0 ? 'default' : 'pointer', fontSize: 10, color: 'var(--text3)', padding: '1px 4px', lineHeight: 1 }}>
                    ▲
                  </button>
                  <button onClick={() => handleMoveItem(idx, 1)} disabled={idx === templates.length - 1}
                    style={{ background: 'none', border: 'none', cursor: idx === templates.length - 1 ? 'default' : 'pointer', fontSize: 10, color: 'var(--text3)', padding: '1px 4px', lineHeight: 1 }}>
                    ▼
                  </button>
                </div>

                {/* LABEL / EDIT */}
                {editingId === t.id ? (
                  <input
                    className="form-input"
                    style={{ flex: 1, fontSize: 13 }}
                    value={editLabel}
                    onChange={e => setEditLabel(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(t.id); if (e.key === 'Escape') { setEditingId(null); setEditLabel(''); } }}
                    autoFocus
                  />
                ) : (
                  <span style={{ flex: 1, fontSize: 13, textDecoration: t.active ? 'none' : 'line-through', color: t.active ? 'var(--text1)' : 'var(--text3)' }}>
                    {t.label}
                  </span>
                )}

                {/* ACTIONS */}
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  {editingId === t.id ? (
                    <>
                      <button onClick={() => handleSaveEdit(t.id)} style={{ fontSize: 11, color: 'var(--brand)', background: 'none', border: '1px solid var(--border)', borderRadius: 5, padding: '3px 8px', cursor: 'pointer' }}>Save</button>
                      <button onClick={() => { setEditingId(null); setEditLabel(''); }} style={{ fontSize: 11, color: 'var(--text3)', background: 'none', border: '1px solid var(--border)', borderRadius: 5, padding: '3px 8px', cursor: 'pointer' }}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => { setEditingId(t.id); setEditLabel(t.label); }} style={{ fontSize: 11, color: 'var(--brand)', background: 'none', border: '1px solid var(--border)', borderRadius: 5, padding: '3px 8px', cursor: 'pointer' }}>Edit</button>
                      <button onClick={() => handleToggleActive(t)} style={{ fontSize: 11, color: 'var(--text2)', background: 'none', border: '1px solid var(--border)', borderRadius: 5, padding: '3px 8px', cursor: 'pointer' }}>
                        {t.active ? 'Hide' : 'Show'}
                      </button>
                      <button onClick={() => handleDeleteItem(t.id)} style={{ fontSize: 11, color: 'var(--danger)', background: 'none', border: '1px solid var(--border)', borderRadius: 5, padding: '3px 8px', cursor: 'pointer' }}>Remove</button>
                    </>
                  )}
                </div>
              </div>
            ))}

            {/* ADD NEW ITEM */}
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <input
                className="form-input"
                style={{ flex: 1 }}
                placeholder="Add a new checklist item..."
                value={newItem}
                onChange={e => setNewItem(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddItem(); }}
              />
              <button
                className="btn-primary"
                onClick={handleAddItem}
                disabled={addingItem || !newItem.trim()}
                style={{ flexShrink: 0 }}
              >
                {addingItem ? 'Adding...' : '+ Add'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
