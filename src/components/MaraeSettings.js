import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const EMPTY_FORM = {
  marae_name: '',
  location: '',
  iwi: '',
  hapu: '',
  phone: '',
  email: '',
  website: '',
};

export default function MaraeSettings() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [settingsId, setSettingsId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { fetchSettings(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  function setField(k, v) { setForm(f => ({ ...f, [k]: v })); }

  if (loading) return <div className="loading">Loading settings...</div>;

  return (
    <div style={{ maxWidth: 600 }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 22 }}>Marae Settings</h2>
        <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>Update your marae name and details — these appear throughout the platform</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">✓ Settings saved successfully!</div>}

      <div className="panel">
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
    </div>
  );
}
