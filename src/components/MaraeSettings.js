import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import PrivacyPolicy from './PrivacyPolicy';

const EMPTY_FORM = {
  marae_name: '', location: '', iwi: '', hapu: '', phone: '', email: '', website: '',
  use_xero: false,
};

const NOTIF_LABELS = [
  { key: 'bookings',   icon: '📅', label: 'Booking Reminders',    desc: '48 hours before a confirmed booking' },
  { key: 'compliance', icon: '✅', label: 'Compliance Alerts',     desc: 'Items due within 30 days' },
  { key: 'grants',     icon: '💰', label: 'Grant Deadlines',       desc: 'Deadlines within 14 days' },
  { key: 'actions',    icon: '📝', label: 'Overdue Actions',       desc: 'Meeting actions overdue by 7+ days' },
  { key: 'goals',      icon: '🎯', label: 'Goal Status Changes',   desc: 'Goals marked At Risk or Completed' },
];

const SETTINGS_TABS = [
  { key: 'settings', label: 'Settings' },
  { key: 'privacy',  label: 'Privacy & Data' },
];

export default function MaraeSettings({ profile, isAdmin }) {
  const [activeSubTab, setActiveSubTab] = useState('settings');
  const [form, setForm] = useState(EMPTY_FORM);
  const [settingsId, setSettingsId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // Notification preferences
  const [notifPrefs, setNotifPrefs] = useState({ bookings: true, compliance: true, grants: true, actions: true, goals: true });
  const [notifSaving, setNotifSaving] = useState(false);
  const [notifSuccess, setNotifSuccess] = useState(false);

  // Trustee permissions state
  const [trustees, setTrustees] = useState([]);
  const [trusteePermsLoading, setTrusteePermsLoading] = useState(false);
  const [trusteePermsError, setTrusteePermsError] = useState('');

  // Invite trustee state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState('');
  const [inviteError, setInviteError] = useState('');

  // Change password state
  const [pwNew, setPwNew]         = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwSaving, setPwSaving]   = useState(false);
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwError, setPwError]     = useState('');

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
    if (profile?.id) fetchNotifPrefs(profile.id);
    if (isAdmin) fetchTrustees();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchNotifPrefs(userId) {
    const { data } = await supabase.from('profiles').select('notification_prefs').eq('id', userId).single();
    if (data?.notification_prefs) setNotifPrefs({ ...notifPrefs, ...data.notification_prefs });
  }

  async function saveNotifPrefs() {
    if (!profile?.id) return;
    setNotifSaving(true);
    await supabase.from('profiles').update({ notification_prefs: notifPrefs }).eq('id', profile.id);
    setNotifSaving(false);
    setNotifSuccess(true);
    setTimeout(() => setNotifSuccess(false), 3000);
  }

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
        use_xero: data.use_xero || false,
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

  async function fetchTrustees() {
    setTrusteePermsLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email, trustee_role')
      .eq('role', 'trustee')
      .order('full_name');
    setTrustees(data || []);
    setTrusteePermsLoading(false);
  }

  async function sendInvite() {
    const email = inviteEmail.trim().toLowerCase();
    if (!email || !email.includes('@')) { setInviteError('Enter a valid email address'); return; }
    setInviting(true);
    setInviteError('');
    setInviteSuccess('');
    const { data, error } = await supabase.functions.invoke('invite-trustee', {
      body: { email, redirectTo: window.location.origin },
    });
    setInviting(false);
    if (error) { setInviteError(error.message || 'Failed to send invite'); return; }
    if (data?.error) { setInviteError(data.error); return; }
    if (data?.alreadyRegistered) {
      setInviteSuccess(`${email} already has an account — they can log in now. Check their role in the list below.`);
    } else {
      setInviteSuccess(`Invite sent to ${email}. They will appear below once they accept.`);
    }
    setInviteEmail('');
    fetchTrustees();
  }

  async function setTrusteeRole(trusteeId, newRole) {
    setTrusteePermsError('');
    if (newRole === 'standard' && trusteeId === profile?.id) {
      const adminCount = trustees.filter(t => t.trustee_role === 'admin').length;
      if (adminCount <= 1) {
        setTrusteePermsError('Cannot demote yourself — you are the only Admin Trustee. Promote another trustee first.');
        return;
      }
    }
    const { error } = await supabase.from('profiles').update({ trustee_role: newRole }).eq('id', trusteeId);
    if (error) { setTrusteePermsError(error.message); return; }
    fetchTrustees();
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    setPwError('');
    setPwSuccess(false);
    if (pwNew.length < 6)       { setPwError('Password must be at least 6 characters.'); return; }
    if (pwNew !== pwConfirm)    { setPwError('Passwords do not match.'); return; }
    setPwSaving(true);
    const { error } = await supabase.auth.updateUser({ password: pwNew });
    setPwSaving(false);
    if (error) { setPwError(error.message); return; }
    setPwNew('');
    setPwConfirm('');
    setPwSuccess(true);
    setTimeout(() => setPwSuccess(false), 4000);
  }

  function setField(k, v) { setForm(f => ({ ...f, [k]: v })); }

  if (loading) return <div className="loading">Loading settings...</div>;

  return (
    <div style={{ maxWidth: 640 }}>
      {/* Sub-tab navigation */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '2px solid var(--border)', paddingBottom: 0 }}>
        {SETTINGS_TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveSubTab(t.key)}
            style={{
              background: 'none', border: 'none', padding: '8px 18px',
              fontSize: 14, fontWeight: activeSubTab === t.key ? 600 : 400,
              color: activeSubTab === t.key ? 'var(--accent)' : 'var(--text3)',
              borderBottom: activeSubTab === t.key ? '2px solid var(--accent)' : '2px solid transparent',
              marginBottom: -2, cursor: 'pointer', transition: 'color 0.15s',
              fontFamily: activeSubTab === t.key ? 'Playfair Display, serif' : 'DM Sans, sans-serif',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeSubTab === 'privacy' && <PrivacyPolicy />}

      {activeSubTab === 'settings' && <>
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
      {/* ── EMAIL NOTIFICATIONS ── */}
      <div className="panel" style={{ marginTop: 20 }}>
        <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 16, fontWeight: 600, marginBottom: 4, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
          Email Notifications
        </div>
        <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 20 }}>
          Choose which automated email reminders you receive. Emails are sent daily at 8:00am.
        </p>

        {notifSuccess && <div className="alert alert-success" style={{ marginBottom: 16 }}>✓ Notification preferences saved</div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          {NOTIF_LABELS.map(n => (
            <div
              key={n.key}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'var(--surface2)', borderRadius: 8, border: '1px solid var(--border)' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 18 }}>{n.icon}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text1)' }}>{n.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 1 }}>{n.desc}</div>
                </div>
              </div>
              <label style={{ position: 'relative', display: 'inline-block', width: 44, height: 24, flexShrink: 0, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={notifPrefs[n.key] !== false}
                  onChange={e => setNotifPrefs(p => ({ ...p, [n.key]: e.target.checked }))}
                  style={{ opacity: 0, width: 0, height: 0 }}
                />
                <span style={{
                  position: 'absolute', inset: 0, borderRadius: 24, transition: 'background 0.2s',
                  background: notifPrefs[n.key] !== false ? 'var(--brand)' : '#d0cbc4',
                }} />
                <span style={{
                  position: 'absolute', top: 3, left: notifPrefs[n.key] !== false ? 23 : 3,
                  width: 18, height: 18, background: '#fff', borderRadius: '50%',
                  transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                }} />
              </label>
            </div>
          ))}
        </div>

        <button className="btn-primary" onClick={saveNotifPrefs} disabled={notifSaving} style={{ fontSize: 14 }}>
          {notifSaving ? 'Saving...' : 'Save Notification Preferences'}
        </button>
      </div>

      {/* ── CHANGE PASSWORD ── */}
      <div className="panel" style={{ marginTop: 20 }}>
        <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 16, fontWeight: 600, marginBottom: 4, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
          Change Password
        </div>
        <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 20 }}>
          Set a new password for your account. Must be at least 6 characters.
        </p>
        <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {pwError   && <div className="alert alert-error">{pwError}</div>}
          {pwSuccess && <div className="alert alert-success">✓ Password updated successfully.</div>}
          <div className="form-group">
            <label className="form-label">New Password</label>
            <input
              className="form-input"
              type="password"
              value={pwNew}
              onChange={e => setPwNew(e.target.value)}
              placeholder="At least 6 characters"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Confirm New Password</label>
            <input
              className="form-input"
              type="password"
              value={pwConfirm}
              onChange={e => setPwConfirm(e.target.value)}
              placeholder="Repeat your new password"
            />
          </div>
          <button type="submit" className="btn-primary" disabled={pwSaving} style={{ alignSelf: 'flex-start', fontSize: 14 }}>
            {pwSaving ? 'Saving...' : 'Update Password'}
          </button>
        </form>
      </div>

      {/* ── TRUSTEE PERMISSIONS (admin only) ── */}
      {isAdmin && (
        <div className="panel" style={{ marginTop: 20 }}>
          <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 16, fontWeight: 600, marginBottom: 4, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
            Trustee Permissions
          </div>
          <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 16 }}>
            Manage permission levels for all trustees. <strong>Admin Trustees</strong> have full access including Finance and booking approvals. <strong>Standard Trustees</strong> can view and edit modules but cannot approve bookings, access Finance, or change permissions.
          </p>

          {/* ── INVITE FORM ── */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <input
              className="form-input"
              style={{ flex: 1 }}
              type="email"
              placeholder="Email address to invite..."
              value={inviteEmail}
              onChange={e => { setInviteEmail(e.target.value); setInviteError(''); setInviteSuccess(''); }}
              onKeyDown={e => { if (e.key === 'Enter') sendInvite(); }}
              disabled={inviting}
            />
            <button
              className="btn-primary"
              onClick={sendInvite}
              disabled={inviting || !inviteEmail.trim()}
              style={{ flexShrink: 0, fontSize: 13 }}
            >
              {inviting ? 'Sending…' : '✉ Invite Trustee'}
            </button>
          </div>
          {inviteSuccess && (
            <div className="alert alert-success" style={{ marginBottom: 12 }}>{inviteSuccess}</div>
          )}
          {inviteError && (
            <div className="alert alert-error" style={{ marginBottom: 12 }}>{inviteError}</div>
          )}

          {trusteePermsError && <div className="alert alert-error" style={{ marginBottom: 12 }}>{trusteePermsError}</div>}

          {trusteePermsLoading ? (
            <div className="loading">Loading trustees...</div>
          ) : trustees.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text3)' }}>No trustees found.</div>
          ) : (
            trustees.map(t => {
              const isYou = t.id === profile?.id;
              const isCurrentAdmin = t.trustee_role === 'admin';
              return (
                <div key={t.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                  background: 'var(--surface2)', border: '1px solid var(--border)',
                  borderRadius: 8, marginBottom: 8,
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%', background: 'var(--brand)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 600, color: '#fff', flexShrink: 0,
                  }}>
                    {t.full_name ? t.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '?'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>
                      {t.full_name || '—'}
                      {isYou && <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 6 }}>(You)</span>}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>{t.email}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button
                      onClick={() => isCurrentAdmin ? setTrusteeRole(t.id, 'standard') : undefined}
                      style={{
                        fontSize: 12, padding: '5px 12px', borderRadius: 6,
                        cursor: isCurrentAdmin ? 'pointer' : 'default',
                        border: '1px solid var(--border)',
                        background: !isCurrentAdmin ? 'var(--brand)' : 'var(--surface)',
                        color: !isCurrentAdmin ? '#fff' : 'var(--text2)',
                        fontWeight: !isCurrentAdmin ? 600 : 400,
                      }}
                    >
                      Standard
                    </button>
                    <button
                      onClick={() => !isCurrentAdmin ? setTrusteeRole(t.id, 'admin') : undefined}
                      style={{
                        fontSize: 12, padding: '5px 12px', borderRadius: 6,
                        cursor: !isCurrentAdmin ? 'pointer' : 'default',
                        border: '1px solid var(--border)',
                        background: isCurrentAdmin ? 'var(--brand)' : 'var(--surface)',
                        color: isCurrentAdmin ? '#fff' : 'var(--text2)',
                        fontWeight: isCurrentAdmin ? 600 : 400,
                      }}
                    >
                      Admin
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── ACCOUNTING INTEGRATION ── */}
      <div className="panel">
        <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 16, fontWeight: 600, marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
          Accounting Integration
        </div>
        <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 16, lineHeight: 1.6 }}>
          If your marae uses Xero for accounting, enable this toggle. When enabled, the Finance module will display a placeholder until the Xero integration is activated. If disabled, use the built-in MaraeHub Finance module.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', background: 'var(--surface2)', borderRadius: 10, border: '1px solid var(--border)' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text1)' }}>Does your marae use Xero?</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3 }}>Xero integration is coming soon — enabling this prepares the settings architecture.</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 13, color: form.use_xero ? 'var(--text3)' : 'var(--brand)', fontWeight: 600 }}>No</span>
            <div
              onClick={() => setField('use_xero', !form.use_xero)}
              style={{
                width: 44, height: 24, borderRadius: 12, cursor: 'pointer', position: 'relative', flexShrink: 0,
                background: form.use_xero ? 'var(--brand)' : 'var(--cream2)',
                transition: 'background 0.2s',
              }}
            >
              <div style={{
                position: 'absolute', top: 3, left: form.use_xero ? 23 : 3,
                width: 18, height: 18, borderRadius: '50%', background: '#fff',
                boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                transition: 'left 0.2s',
              }} />
            </div>
            <span style={{ fontSize: 13, color: form.use_xero ? 'var(--brand)' : 'var(--text3)', fontWeight: 600 }}>Yes</span>
          </div>
        </div>
        {form.use_xero && (
          <div style={{ marginTop: 12, padding: '12px 16px', background: '#e8eef8', border: '1px solid #b8cce8', borderRadius: 8, fontSize: 13, color: '#1a4a8a', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18 }}>🔗</span>
            <span><strong>Xero integration coming soon.</strong> Your settings have been saved. We will notify you when the Xero connection is ready to activate.</span>
          </div>
        )}
        <div style={{ marginTop: 16 }}>
          <button className="btn-primary" onClick={handleSave} disabled={saving} style={{ fontSize: 14 }}>
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
        </div>
      </div>
      </>}
    </div>
  );
}
