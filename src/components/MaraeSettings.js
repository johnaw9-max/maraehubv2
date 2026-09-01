import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { fetchXeroFinancials } from '../lib/xero';
import PrivacyPolicy from './PrivacyPolicy';
import { fetchAssignableItems, fetchTrusteeDecisions, reassignItems } from '../lib/trusteeWorkload';

const EMPTY_FORM = {
  marae_name: '', location: '', iwi: '', hapu: '', phone: '', email: '', website: '',
  payment_details: '',
  automation_level: 'assisted',
  reminders_paused: false,

};

const XERO_ERROR_MESSAGES = {
  denied: 'You declined the Xero connection request.',
  missing_params: 'The connection attempt was incomplete — please try again.',
  invalid_state: 'The connection link expired or was invalid — please try connecting again.',
  token_exchange: 'Xero could not verify the connection — please try again.',
  tenant_lookup: 'Could not retrieve your Xero organisation details — please try again.',
  select_one_org: 'MaraeHub currently only supports connecting one Xero organisation at a time.',
  save_failed: 'The connection succeeded with Xero, but saving it failed — please try again.',
  needs_confirmation: 'A Xero connection already exists — reconnecting requires confirmation.',
  unexpected: 'Something unexpected went wrong — please try again.',
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

  // Xero connection state
  const [xeroStatus, setXeroStatus] = useState(null); // null = loading
  const [xeroBanner, setXeroBanner] = useState(null); // null | 'connected' | 'error'
  const [xeroBannerReason, setXeroBannerReason] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [xeroActionError, setXeroActionError] = useState('');

  // Notification preferences
  const [notifPrefs, setNotifPrefs] = useState({ bookings: true, compliance: true, grants: true, actions: true, goals: true });
  const [notifSaving, setNotifSaving] = useState(false);
  const [notifSuccess, setNotifSuccess] = useState(false);

  // Trustee permissions state
  const [trustees, setTrustees] = useState([]);
  const [trusteePermsLoading, setTrusteePermsLoading] = useState(false);
  const [trusteePermsError, setTrusteePermsError] = useState('');
  const [trusteePermsSuccess, setTrusteePermsSuccess] = useState('');

  // Entity assignments state
  const [assignments, setAssignments] = useState([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [assignmentsError, setAssignmentsError] = useState('');
  const [togglingKey, setTogglingKey] = useState(null);

  // Entities
  const [entities, setEntities] = useState([]);
  const [entitiesLoading, setEntitiesLoading] = useState(false);
  const [entitiesError, setEntitiesError] = useState('');
  const [newEntityName, setNewEntityName] = useState('');
  const [addingEntity, setAddingEntity] = useState(false);
  const [editingEntityId, setEditingEntityId] = useState(null);
  const [editingEntityName, setEditingEntityName] = useState('');
  const [renamingEntity, setRenamingEntity] = useState(false);
  const [banningId, setBanningId] = useState(null);

  // Offboarding / handover (86d44q123, Steps 2-4)
  const [offboardTarget, setOffboardTarget] = useState(null);
  const [offboardItems, setOffboardItems] = useState([]);
  const [offboardLoading, setOffboardLoading] = useState(false);
  const [offboardReassignTo, setOffboardReassignTo] = useState('');
  const [offboardReassigning, setOffboardReassigning] = useState(false);
  const [offboardError, setOffboardError] = useState('');

  const [handoverTarget, setHandoverTarget] = useState(null);
  const [handoverItems, setHandoverItems] = useState([]);
  const [handoverDecisions, setHandoverDecisions] = useState([]);
  const [handoverLoading, setHandoverLoading] = useState(false);
  const [handoverNotes, setHandoverNotes] = useState('');
  const entityLimitReached = entities.length >= 3;

  // Invite trustee state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState('');
  const [inviteError, setInviteError] = useState('');

  // Add trustee directly state
  const EMPTY_ADD = { fullName: '', email: '', committeeRole: 'Trustee', permissionLevel: 'standard' };
  const [addForm, setAddForm]       = useState(EMPTY_ADD);
  const [addSaving, setAddSaving]   = useState(false);
  const [addError, setAddError]     = useState('');
  const [addSuccess, setAddSuccess] = useState(null);

  // Change password state
  const [pwNew, setPwNew]         = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwSaving, setPwSaving]   = useState(false);
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwError, setPwError]     = useState('');
  const [expandedInfo, setExpandedInfo] = useState(null);

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
    if (isAdmin) { fetchTrustees(); fetchAssignments(); }
    fetchEntities();
    fetchXeroStatus();

    const params = new URLSearchParams(window.location.search);
    const xeroParam = params.get('xero');
    if (xeroParam === 'connected' || xeroParam === 'error') {
      setXeroBanner(xeroParam);
      setXeroBannerReason(params.get('reason') || '');
      window.history.replaceState(null, '', window.location.pathname);
    }

    // Deep-link scroll target, e.g. #email-notifications from the "Manage
    // your email preferences" link in notify-trustees emails. Deferred a
    // tick so the section has actually rendered before scrolling to it.
    if (window.location.hash) {
      setTimeout(() => {
        document.querySelector(window.location.hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 0);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchXeroStatus() {
    const result = await fetchXeroFinancials();
    setXeroStatus(result);
  }

  async function handleConnectXero() {
    setConnecting(true);
    setXeroActionError('');
    const { data, error } = await supabase.functions.invoke('xero-callback?action=authorize', { method: 'GET' });
    if (error || !data?.authorizeUrl) {
      setXeroActionError('Could not start the Xero connection — please try again.');
      setConnecting(false);
      return;
    }
    window.location.href = data.authorizeUrl;
  }

  async function handleDisconnectXero() {
    if (!window.confirm('Disconnect from Xero? Board View and the Finance tab will switch back to MaraeHub\'s built-in finance module immediately. Your data in Xero itself is not affected, and you can reconnect at any time.')) return;
    setDisconnecting(true);
    setXeroActionError('');
    const { error } = await supabase.functions.invoke('xero-callback?action=disconnect', { method: 'POST' });
    setDisconnecting(false);
    if (error) {
      setXeroActionError('Could not disconnect — please try again.');
      return;
    }
    setXeroStatus({ status: 'not_connected' });
  }

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
        payment_details: data.payment_details || '',
        automation_level: data.automation_level || 'assisted',
        reminders_paused: data.reminders_paused === true,
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

  async function handleBulkAddItems(lines) {
    const clean = lines.map(l => l.trim()).filter(Boolean);
    if (!clean.length) return;
    setAddingItem(true); setTemplateError('');
    const maxOrder = templates.length ? Math.max(...templates.map(t => t.sort_order || 0)) : 0;
    const rows = clean.map((label, i) => ({ label, sort_order: maxOrder + i + 1, active: true }));
    const { error } = await supabase.from('checklist_templates').insert(rows);
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

  async function fetchAssignments() {
    setAssignmentsLoading(true);
    const { data } = await supabase.from('trustee_entities').select('profile_id, entity_id');
    setAssignments(data || []);
    setAssignmentsLoading(false);
  }

  async function toggleAssignment(trusteeId, entityId, isAssigned) {
    setAssignmentsError('');
    setTogglingKey(`${trusteeId}:${entityId}`);
    const { error } = isAssigned
      ? await supabase.from('trustee_entities').delete().eq('profile_id', trusteeId).eq('entity_id', entityId)
      : await supabase.from('trustee_entities').insert({ profile_id: trusteeId, entity_id: entityId });
    setTogglingKey(null);
    if (error) { setAssignmentsError(error.message); return; }
    fetchAssignments();
  }

  async function fetchEntities() {
    setEntitiesLoading(true);
    const { data } = await supabase
      .from('entities')
      .select('id, name')
      .order('name');
    setEntities(data || []);
    setEntitiesLoading(false);
  }

  async function createEntity() {
    const name = newEntityName.trim();
    if (!name) { setEntitiesError('Enter a name for the entity'); return; }
    setAddingEntity(true);
    setEntitiesError('');
    const { error } = await supabase.from('entities').insert({ name });
    if (error) { setEntitiesError(error.message); setAddingEntity(false); return; }
    setNewEntityName('');
    await fetchEntities();
    setAddingEntity(false);
  }

  function startRenameEntity(ent) {
    setEditingEntityId(ent.id);
    setEditingEntityName(ent.name);
    setEntitiesError('');
  }

  function cancelRenameEntity() {
    setEditingEntityId(null);
    setEditingEntityName('');
  }

  async function saveRenameEntity() {
    const name = editingEntityName.trim();
    if (!name) { setEntitiesError('Enter a name for the entity'); return; }
    setRenamingEntity(true);
    setEntitiesError('');
    const { error } = await supabase.from('entities').update({ name }).eq('id', editingEntityId);
    if (error) { setEntitiesError(error.message); setRenamingEntity(false); return; }
    setEditingEntityId(null);
    setEditingEntityName('');
    await fetchEntities();
    setRenamingEntity(false);
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

  async function createTrustee() {
    const { fullName, email, committeeRole, permissionLevel } = addForm;
    if (!fullName.trim())            { setAddError('Full name is required'); return; }
    if (!email.trim() || !email.includes('@')) { setAddError('Enter a valid email address'); return; }
    setAddSaving(true); setAddError(''); setAddSuccess(null);
    const { data, error } = await supabase.functions.invoke('create-trustee', {
      body: { fullName: fullName.trim(), email: email.trim().toLowerCase(), committeeRole, permissionLevel },
    });
    setAddSaving(false);
    if (error) { setAddError(error.message || 'Failed to create account'); return; }
    if (data?.error) { setAddError(data.error); return; }
    setAddSuccess({ name: fullName.trim(), email: email.trim().toLowerCase(), tempPassword: data.tempPassword });
    setAddForm(EMPTY_ADD);
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

  async function openOffboard(trustee) {
    setOffboardError('');
    setOffboardReassignTo('');
    setOffboardTarget(trustee);
    setOffboardLoading(true);
    const items = await fetchAssignableItems(trustee.full_name || '');
    setOffboardItems(items);
    setOffboardLoading(false);
  }

  async function confirmReassign() {
    if (!offboardReassignTo || offboardItems.length === 0) return;
    setOffboardReassigning(true);
    await reassignItems(offboardItems, offboardReassignTo);
    setOffboardReassigning(false);
    setOffboardItems([]);
  }

  async function confirmBan() {
    const trustee = offboardTarget;
    if (!trustee) return;
    setOffboardError('');
    setBanningId(trustee.id);
    const { data, error } = await supabase.functions.invoke('ban-trustee', {
      body: { trusteeId: trustee.id },
    });
    setBanningId(null);
    if (error) { setOffboardError(error.message || 'Failed to ban trustee'); return; }
    if (data?.error) { setOffboardError(data.error); return; }
    setTrusteePermsSuccess(`${trustee.full_name || trustee.email} has been banned and can no longer log in.`);
    setOffboardTarget(null);
    fetchTrustees();
  }

  async function openHandover(trustee) {
    setHandoverNotes('');
    setHandoverTarget(trustee);
    setHandoverLoading(true);
    const [items, decisions] = await Promise.all([
      fetchAssignableItems(trustee.full_name || ''),
      fetchTrusteeDecisions(trustee.full_name || ''),
    ]);
    setHandoverItems(items);
    setHandoverDecisions(decisions);
    setHandoverLoading(false);
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
                placeholder="Add an item, or paste multiple lines at once"
                value={newItem}
                onChange={e => setNewItem(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddItem(); }}
                onPaste={e => {
                  const text = e.clipboardData.getData('text');
                  if (text.includes('\n')) {
                    e.preventDefault();
                    handleBulkAddItems(text.split('\n'));
                  }
                }}
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

        <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 16, fontWeight: 600, margin: '20px 0 16px', paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
          Payment Details
        </div>

        <div className="form-group">
          <label className="form-label">Payment Instructions</label>
          <textarea
            className="form-input"
            rows={3}
            value={form.payment_details}
            onChange={e => setField('payment_details', e.target.value)}
            placeholder="e.g. Bank account: 12-3456-7890123-00 (Te Marae o Tainui Trust)"
            style={{ resize: 'vertical' }}
          />
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>Shown on invoices so customers know how to pay the hire fee.</div>
        </div>

        <div style={{ marginTop: 8 }}>
          <button className="btn-primary" onClick={handleSave} disabled={saving} style={{ padding: '11px 28px', fontSize: 14 }}>
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>

      {/* ── EMAIL NOTIFICATIONS ── */}
      <div id="email-notifications" className="panel" style={{ marginTop: 20 }}>
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

      {/* ── MARAE-WIDE REMINDER CONTROL (admin only) ── */}
      {isAdmin && (
        <div className="panel" style={{ marginTop: 20 }}>
          <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 16, fontWeight: 600, marginBottom: 4, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
            Compliance & Overdue-Action Emails
          </div>
          <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 16 }}>
            Controls whether compliance and overdue-action reminder emails go out to trustees at all, marae-wide. This is separate from the personal preferences above — those only apply once this is switched on.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'var(--surface2)', borderRadius: 8, border: '1px solid var(--border)' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text1)' }}>Send these emails</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 1 }}>
                {form.reminders_paused ? 'Currently off — no compliance or overdue-action emails are being sent.' : 'Currently on — compliance and overdue-action emails send daily as normal.'}
              </div>
            </div>
            <label style={{ position: 'relative', display: 'inline-block', width: 44, height: 24, flexShrink: 0, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={!form.reminders_paused}
                onChange={async e => {
                  const enabled = e.target.checked;
                  setField('reminders_paused', !enabled);
                  if (!settingsId) return;
                  await supabase.from('marae_settings').update({ reminders_paused: !enabled }).eq('id', settingsId);
                }}
                style={{ opacity: 0, width: 0, height: 0 }}
              />
              <span style={{
                position: 'absolute', inset: 0, borderRadius: 24, transition: 'background 0.2s',
                background: !form.reminders_paused ? 'var(--brand)' : '#d0cbc4',
              }} />
              <span style={{
                position: 'absolute', top: 3, left: !form.reminders_paused ? 23 : 3,
                width: 18, height: 18, background: '#fff', borderRadius: '50%',
                transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }} />
            </label>
          </div>
        </div>
      )}

      {/* ── AUTOMATION LEVEL ── */}
      {isAdmin && (
        <div className="panel" style={{ marginTop: 20 }}>
          <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 16, fontWeight: 600, marginBottom: 4, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
            Automation Level
          </div>
          <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>
            Choose how much MaraeHub does automatically. You can change this at any time.
          </p>
          <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 20, fontStyle: 'italic' }}>
            Honest note: this preference does not change any behaviour yet. Every marae currently gets the same real automation (see "Live" below) no matter which option is selected — this is a preview of what each level will mean once that work is built.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
            {[
              {
                value: 'manual',
                icon: '🔴',
                title: "I'll do it myself",
                desc: 'Show me what needs doing — I will take it from there. Nothing happens without me.',
                info: {
                  summary: 'Nothing happens automatically. The platform shows you what needs doing — you decide when to act.',
                  examples: [
                    'Service reminder appears on Board View → you start the workflow manually',
                    'Compliance item due → you record the renewal manually',
                    'Booking approved → you enter the income in Finance manually',
                  ],
                  live: [
                    'Service reminders — appear on Board View, you start workflows manually',
                    'Compliance due dates — appear on Board View, you act manually',
                    'Booking approvals — you approve manually, finance record created automatically (this always happens)',
                    'Meeting actions — you create tasks manually from minutes',
                  ],
                  coming: [],
                },
              },
              {
                value: 'assisted',
                icon: '🟡',
                title: 'Ask me first',
                desc: 'Suggest what to do and I will approve before anything happens. Recommended for most marae.',
                info: {
                  summary: 'Before anything happens MaraeHub will ask your approval first. Recommended for most marae.',
                  examples: [
                    "Service reminder due → MaraeHub asks 'Shall I start the maintenance workflow?' → you click Approve",
                    'Compliance renewal due → MaraeHub suggests creating a task → you approve or dismiss',
                    'This is the safest option if you want to stay in control but reduce manual work',
                  ],
                  live: [],
                  coming: [
                    'Service reminder due → MaraeHub will ask "Shall I start the workflow?" → you approve',
                    'Compliance renewal due → MaraeHub suggests a task → you approve',
                    'Grant deadline approaching → MaraeHub suggests action → you approve',
                  ],
                  comingSoonPill: true,
                },
              },
              {
                value: 'automatic',
                icon: '🟢',
                title: 'Handle it for me',
                desc: 'Run reminders and notifications in the background. Best for experienced trustees who trust the platform.',
                info: {
                  summary: 'MaraeHub runs reminder emails and notifications in the background automatically. Workflow suggestions still show a one-click "Start Workflow" button rather than starting on their own — no automation level changes that today. Best for experienced trustees who trust the platform\'s suggestions.',
                  examples: [
                    'Service reminder due → "Start Workflow" suggestion appears → one click creates the workflow and its tasks',
                    'Booking approved → finance record created automatically',
                    'Compliance due → reminder email sent automatically to all trustees',
                  ],
                  live: [
                    'Booking confirmation email → sent to hirer automatically on approval',
                    'Compliance daily check → emails fire at 8am automatically',
                    'Grant escalating reminders → fire automatically at 30/14/7 days',
                    'Service reminder matches a workflow template → suggestion button appears, one click starts it',
                    'Finance income → auto-created on booking approval',
                    'Board View insights → update automatically on every page load',
                  ],
                  coming: [
                    'Service reminder due → workflow starts with no click needed at all — not yet built',
                  ],
                  morePill: true,
                },
              },
            ].map(opt => (
              <div
                key={opt.value}
                onClick={async () => {
                  if (!settingsId) return;
                  await supabase.from('marae_settings').update({ automation_level: opt.value }).eq('id', settingsId);
                  setForm(f => ({ ...f, automation_level: opt.value }));
                }}
                style={{
                  padding: '14px 16px',
                  borderRadius: 10, border: `2px solid ${form.automation_level === opt.value ? 'var(--brand)' : 'var(--border)'}`,
                  background: form.automation_level === opt.value ? 'var(--surface2)' : 'var(--surface)',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <span style={{ fontSize: 22, flexShrink: 0 }}>{opt.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: form.automation_level === opt.value ? 'var(--brand)' : 'var(--text1)' }}>{opt.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3, lineHeight: 1.5 }}>{opt.desc}</div>
                    <button
                      onClick={e => { e.stopPropagation(); setExpandedInfo(expandedInfo === opt.value ? null : opt.value); }}
                      style={{ background: 'none', border: 'none', padding: '4px 0 0', fontSize: 11, color: 'var(--brand)', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', fontWeight: 600 }}
                    >
                      What does this mean? {expandedInfo === opt.value ? '▴' : '▾'}
                    </button>
                  </div>
                  {form.automation_level === opt.value && (
                    <span style={{ fontSize: 18, color: 'var(--brand)', flexShrink: 0 }}>✓</span>
                  )}
                </div>
                {expandedInfo === opt.value && (
                  <div onClick={e => e.stopPropagation()} style={{ marginTop: 8, fontSize: 12, color: 'var(--text1)', lineHeight: 1.6 }}>
                    {/* Summary + examples */}
                    <div style={{ padding: 10, background: '#E1F5EE', borderRadius: 6, marginBottom: 8 }}>
                      <div style={{ marginBottom: 8 }}>{opt.info.summary}</div>
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>Examples:</div>
                      <ul style={{ margin: 0, paddingLeft: 18 }}>
                        {opt.info.examples.map((ex, i) => <li key={i} style={{ marginBottom: 3 }}>{ex}</li>)}
                      </ul>
                    </div>
                    {/* What this controls right now */}
                    <div style={{ padding: 10, background: '#C8EBD8', borderRadius: 6 }}>
                      <div style={{ fontWeight: 700, marginBottom: 8, color: 'var(--text1)' }}>What this controls in MaraeHub right now:</div>
                      {opt.info.live.length > 0 && (
                        <>
                          <div style={{ fontWeight: 700, color: '#0F6E56', marginBottom: 4 }}>Currently live</div>
                          <ul style={{ margin: '0 0 8px', paddingLeft: 18 }}>
                            {opt.info.live.map((item, i) => <li key={i} style={{ marginBottom: 3 }}>✅ {item}</li>)}
                          </ul>
                        </>
                      )}
                      {opt.info.coming.length > 0 && (
                        <>
                          <div style={{ fontWeight: 700, color: '#BA7517', marginBottom: 4 }}>Coming soon</div>
                          <ul style={{ margin: 0, paddingLeft: 18 }}>
                            {opt.info.coming.map((item, i) => <li key={i} style={{ marginBottom: 3 }}>🔜 {item}</li>)}
                          </ul>
                        </>
                      )}
                      {opt.info.live.length === 0 && opt.info.coming.length === 0 && (
                        <div style={{ color: 'var(--text3)' }}>Nothing runs automatically at this level — you are in full control.</div>
                      )}
                      {opt.info.comingSoonPill && (
                        <div style={{ marginTop: 10, display: 'inline-block', background: '#FDF3E3', border: '1px solid #E8C880', borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700, color: '#BA7517' }}>
                          🔜 Coming soon — Automation Engine in development
                        </div>
                      )}
                      {opt.info.morePill && (
                        <div style={{ marginTop: 10, display: 'inline-block', background: '#FDF3E3', border: '1px solid #E8C880', borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700, color: '#BA7517' }}>
                          🔜 More automations coming — Automation Engine in development
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

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

      {/* ── ENTITIES ── */}
      <div className="panel" style={{ marginTop: 20 }}>
        <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 16, fontWeight: 600, marginBottom: 4, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
          Entities
        </div>
        <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 16 }}>
          Entities let you keep separate parts of your organisation (e.g. a kōhanga reo alongside the main trust) private from each other. Create them here, then select an entity when adding records in Compliance, Risk Register, or Finance to tag them.
        </p>

        {entityLimitReached && (
          <div className="alert alert-error" style={{ marginBottom: 12 }}>
            You've reached the maximum of 3 entities per marae. Rename an existing entity below if you need a different one.
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input
            className="form-input"
            style={{ flex: 1 }}
            placeholder="Entity name..."
            value={newEntityName}
            onChange={e => { setNewEntityName(e.target.value); setEntitiesError(''); }}
            onKeyDown={e => { if (e.key === 'Enter') createEntity(); }}
            disabled={addingEntity || entityLimitReached}
          />
          <button
            className="btn-primary"
            onClick={createEntity}
            disabled={addingEntity || !newEntityName.trim() || entityLimitReached}
            style={{ flexShrink: 0, fontSize: 13 }}
          >
            {addingEntity ? 'Creating…' : '+ Add Entity'}
          </button>
        </div>
        {entitiesError && (
          <div className="alert alert-error" style={{ marginBottom: 12 }}>{entitiesError}</div>
        )}

        {entitiesLoading ? (
          <div className="loading">Loading entities...</div>
        ) : entities.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text3)' }}>No entities yet.</div>
        ) : (
          entities.map(ent => (
            <div key={ent.id} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
              background: 'var(--surface2)', border: '1px solid var(--border)',
              borderRadius: 8, marginBottom: 8,
            }}>
              {editingEntityId === ent.id ? (
                <>
                  <input
                    className="form-input"
                    style={{ flex: 1 }}
                    value={editingEntityName}
                    onChange={e => { setEditingEntityName(e.target.value); setEntitiesError(''); }}
                    onKeyDown={e => { if (e.key === 'Enter') saveRenameEntity(); if (e.key === 'Escape') cancelRenameEntity(); }}
                    disabled={renamingEntity}
                    autoFocus
                  />
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button className="btn-secondary" style={{ fontSize: 12, padding: '5px 12px' }} onClick={cancelRenameEntity} disabled={renamingEntity}>
                      Cancel
                    </button>
                    <button className="btn-primary" style={{ fontSize: 12, padding: '5px 12px' }} onClick={saveRenameEntity} disabled={renamingEntity || !editingEntityName.trim()}>
                      {renamingEntity ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ flex: 1, fontSize: 14, fontWeight: 600, color: 'var(--text1)' }}>{ent.name}</div>
                  <button className="btn-secondary" style={{ fontSize: 12, padding: '5px 12px', flexShrink: 0 }} onClick={() => startRenameEntity(ent)}>
                    Edit
                  </button>
                </>
              )}
            </div>
          ))
        )}
      </div>

      {/* ── ENTITY ASSIGNMENTS (admin only) ── */}
      {isAdmin && entities.length > 0 && (
        <div className="panel" style={{ marginTop: 20 }}>
          <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 16, fontWeight: 600, marginBottom: 4, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
            Entity Assignments
          </div>
          <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>
            Choose which entities each Standard Trustee can access. Admin Trustees see every entity automatically and don't need assignment. A trustee with no entities selected still sees shared, untagged records.
          </p>

          {assignmentsError && (
            <div className="alert alert-error" style={{ marginTop: 12, marginBottom: 12 }}>{assignmentsError}</div>
          )}

          <div style={{ marginTop: 16 }}>
            {(trusteePermsLoading || assignmentsLoading) ? (
              <div className="loading">Loading assignments...</div>
            ) : trustees.filter(t => t.trustee_role !== 'admin').length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--text3)' }}>No Standard Trustees yet — all trustees are Admin and already see everything.</div>
            ) : (
              trustees.filter(t => t.trustee_role !== 'admin').map(t => (
                <div key={t.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                  background: 'var(--surface2)', border: '1px solid var(--border)',
                  borderRadius: 8, marginBottom: 8, flexWrap: 'wrap',
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%', background: 'var(--brand)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 600, color: '#fff', flexShrink: 0,
                  }}>
                    {t.full_name ? t.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '?'}
                  </div>
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{t.full_name || '—'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>{t.email}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap' }}>
                    {entities.map(ent => {
                      const isAssigned = assignments.some(a => a.profile_id === t.id && a.entity_id === ent.id);
                      const key = `${t.id}:${ent.id}`;
                      return (
                        <button
                          key={ent.id}
                          onClick={() => toggleAssignment(t.id, ent.id, isAssigned)}
                          disabled={togglingKey === key}
                          style={{
                            fontSize: 12, padding: '5px 12px', borderRadius: 6,
                            cursor: togglingKey === key ? 'default' : 'pointer',
                            border: '1px solid var(--border)',
                            background: isAssigned ? 'var(--brand)' : 'var(--surface)',
                            color: isAssigned ? '#fff' : 'var(--text2)',
                            fontWeight: isAssigned ? 600 : 400,
                            opacity: togglingKey === key ? 0.6 : 1,
                          }}
                        >
                          {isAssigned ? '✓ ' : ''}{ent.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

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

          {/* ── ADD TRUSTEE DIRECTLY ── */}
          <div style={{ marginBottom: 20, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
            <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Add Trustee Directly</div>
            <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 14 }}>
              Create a trustee account instantly. A temporary password is generated — share it with the trustee so they can log in and change it from Settings.
            </p>

            {addError && <div className="alert alert-error" style={{ marginBottom: 12 }}>{addError}</div>}

            {addSuccess && (
              <div style={{ background: '#e8f4ef', border: '1px solid #a8d8c0', borderLeft: '4px solid #2e7d52', borderRadius: 8, padding: '14px 16px', marginBottom: 14 }}>
                <div style={{ fontWeight: 700, color: '#1a4a3a', marginBottom: 8, fontSize: 13 }}>✓ Account created for {addSuccess.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 10 }}>Share these login details with the trustee:</div>
                <div style={{ fontFamily: 'monospace', fontSize: 13, background: '#fff', border: '1px solid #a8d8c0', borderRadius: 6, padding: '10px 14px', marginBottom: 8, lineHeight: 1.8 }}>
                  <div><strong>Email:</strong> {addSuccess.email}</div>
                  <div><strong>Temporary Password:</strong> {addSuccess.tempPassword}</div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>They can update their password any time from Settings → Change Password.</div>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <input
                className="form-input"
                value={addForm.fullName}
                onChange={e => setAddForm(f => ({ ...f, fullName: e.target.value }))}
                placeholder="e.g. Hēni Smith"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Email Address *</label>
              <input
                type="email"
                className="form-input"
                value={addForm.email}
                onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))}
                placeholder="e.g. heni@example.co.nz"
              />
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Committee Role</label>
                <select className="form-input" value={addForm.committeeRole} onChange={e => setAddForm(f => ({ ...f, committeeRole: e.target.value }))}>
                  <option>Chairperson</option>
                  <option>Secretary</option>
                  <option>Treasurer</option>
                  <option>Trustee</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Permission Level</label>
                <select className="form-input" value={addForm.permissionLevel} onChange={e => setAddForm(f => ({ ...f, permissionLevel: e.target.value }))}>
                  <option value="standard">Standard</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            <button
              className="btn-primary"
              onClick={createTrustee}
              disabled={addSaving}
              style={{ fontSize: 13 }}
            >
              {addSaving ? 'Creating account…' : '+ Create Trustee Account'}
            </button>
          </div>

          {trusteePermsError && <div className="alert alert-error" style={{ marginBottom: 12 }}>{trusteePermsError}</div>}
          {trusteePermsSuccess && <div className="alert alert-success" style={{ marginBottom: 12 }}>{trusteePermsSuccess}</div>}

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
                    <button
                      onClick={() => openHandover(t)}
                      style={{
                        fontSize: 12, padding: '5px 12px', borderRadius: 6,
                        cursor: 'pointer', border: '1px solid var(--border)',
                        background: 'var(--surface)', color: 'var(--text2)', fontWeight: 400,
                      }}
                    >
                      Handover pack
                    </button>
                    {!isYou && (
                      <button
                        onClick={() => openOffboard(t)}
                        disabled={banningId === t.id}
                        style={{
                          fontSize: 12, padding: '5px 12px', borderRadius: 6,
                          cursor: banningId === t.id ? 'default' : 'pointer',
                          border: '1px solid var(--danger, #c0392b)',
                          background: 'var(--surface)',
                          color: 'var(--danger, #c0392b)',
                          fontWeight: 600,
                          opacity: banningId === t.id ? 0.6 : 1,
                        }}
                      >
                        {banningId === t.id ? 'Banning…' : 'Ban'}
                      </button>
                    )}
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
        {xeroBanner === 'connected' && (
          <div style={{ marginBottom: 16, padding: '12px 16px', background: '#e8f4ef', border: '1px solid #b8ddc8', borderRadius: 8, fontSize: 13, color: '#1a4a3a', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18 }}>✅</span>
            <span>Successfully connected to Xero.</span>
          </div>
        )}
        {xeroBanner === 'error' && (
          <div style={{ marginBottom: 16, padding: '12px 16px', background: '#faeae7', border: '1px solid #f0b8b0', borderRadius: 8, fontSize: 13, color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18 }}>⚠️</span>
            <span>{XERO_ERROR_MESSAGES[xeroBannerReason] || 'Could not connect to Xero — please try again.'}</span>
          </div>
        )}
        {xeroActionError && (
          <div style={{ marginBottom: 16, padding: '12px 16px', background: '#faeae7', border: '1px solid #f0b8b0', borderRadius: 8, fontSize: 13, color: 'var(--danger)' }}>
            {xeroActionError}
          </div>
        )}

        {xeroStatus === null ? (
          <p style={{ fontSize: 13, color: 'var(--text3)' }}>Checking Xero connection status…</p>

        ) : xeroStatus.status === 'connected' ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'var(--surface2)', borderRadius: 10, border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 22 }}>✅</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text1)' }}>Connected to Xero</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{xeroStatus.tenantName}</div>
              </div>
            </div>
            {isAdmin ? (
              <button onClick={handleDisconnectXero} disabled={disconnecting} className="btn-secondary" style={{ fontSize: 13, padding: '9px 18px' }}>
                {disconnecting ? 'Disconnecting…' : 'Disconnect'}
              </button>
            ) : (
              <span style={{ fontSize: 12, color: 'var(--text3)', fontStyle: 'italic' }}>Only admin trustees can disconnect</span>
            )}
          </div>

        ) : xeroStatus.status === 'error' ? (
          <div style={{ padding: '14px 16px', background: 'var(--surface2)', borderRadius: 10, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, color: 'var(--text3)' }}>⚠️ Unable to check Xero connection status.</span>
            <button onClick={() => fetchXeroFinancials(true).then(setXeroStatus)} className="btn-secondary" style={{ fontSize: 12, padding: '7px 14px' }}>
              Retry
            </button>
          </div>

        ) : isAdmin ? (
          <div style={{ padding: '16px 18px', background: '#e8eef8', border: '1px solid #b8cce8', borderRadius: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text1)', marginBottom: 4 }}>🔗 Connect to Xero (recommended)</div>
            <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 12, lineHeight: 1.6 }}>
              Connect your marae's Xero account to sync real income, expenses, and bank data directly into Board View and the Finance tab. Switching to Xero later doesn't delete your existing MaraeHub finance records — you can keep using the built-in finance module instead if you prefer.
            </p>
            <button onClick={handleConnectXero} disabled={connecting} className="btn-primary" style={{ fontSize: 14, padding: '10px 22px' }}>
              {connecting ? 'Connecting…' : 'Connect to Xero'}
            </button>
          </div>

        ) : (
          <div style={{ padding: '14px 16px', background: 'var(--surface2)', borderRadius: 10, border: '1px solid var(--border)' }}>
            <p style={{ fontSize: 13, color: 'var(--text3)', lineHeight: 1.6 }}>
              This marae isn't connected to Xero yet. Ask an admin trustee to set this up in Settings, or continue using MaraeHub's built-in finance module.
            </p>
          </div>
        )}
        <div style={{ marginTop: 16 }}>
          <button className="btn-primary" onClick={handleSave} disabled={saving} style={{ fontSize: 14 }}>
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
        </div>
      </div>
      </>}

      {offboardTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 20px', overflowY: 'auto' }}>
          <div style={{ background: 'var(--surface)', borderRadius: 14, width: '100%', maxWidth: 560, padding: 28, boxShadow: '0 8px 40px rgba(0,0,0,0.22)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 18, margin: 0, color: 'var(--brand)' }}>
                Offboard {offboardTarget.full_name || offboardTarget.email}
              </h2>
              <button onClick={() => setOffboardTarget(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text3)', lineHeight: 1 }}>✕</button>
            </div>

            {offboardError && <div className="alert alert-error" style={{ marginBottom: 14 }}>{offboardError}</div>}

            {offboardLoading ? (
              <div className="loading">Checking assigned items…</div>
            ) : offboardItems.length === 0 ? (
              <p style={{ fontSize: 14, color: 'var(--text3)', marginBottom: 18 }}>
                No open items are currently assigned to {offboardTarget.full_name || offboardTarget.email}.
              </p>
            ) : (
              <>
                <p style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 10 }}>
                  {offboardItems.length} open item{offboardItems.length !== 1 ? 's' : ''} currently assigned to {offboardTarget.full_name || offboardTarget.email}:
                </p>
                <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 16 }}>
                  {offboardItems.map(item => (
                    <div key={`${item.module}-${item.id}`} style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', fontSize: 14 }}>
                      <span style={{ color: 'var(--text3)', fontSize: 13 }}>{item.module}</span> — {item.label}
                      {item.overdue && <span style={{ color: 'var(--danger, #c0392b)', fontWeight: 600, marginLeft: 6 }}>overdue</span>}
                    </div>
                  ))}
                </div>

                <div className="form-group">
                  <label className="form-label">Reassign these items to</label>
                  <select className="form-input" value={offboardReassignTo} onChange={e => setOffboardReassignTo(e.target.value)}>
                    <option value="">— Leave unassigned / skip reassignment —</option>
                    {trustees.filter(t => t.id !== offboardTarget.id).map(t => (
                      <option key={t.id} value={t.full_name}>{t.full_name}</option>
                    ))}
                  </select>
                </div>
                <button
                  className="btn-secondary"
                  onClick={confirmReassign}
                  disabled={!offboardReassignTo || offboardReassigning}
                  style={{ fontSize: 14, marginBottom: 18 }}
                >
                  {offboardReassigning ? 'Reassigning…' : `Reassign ${offboardItems.length} item${offboardItems.length !== 1 ? 's' : ''}`}
                </button>
              </>
            )}

            <div style={{ display: 'flex', gap: 10, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
              <button className="btn-secondary" onClick={() => openHandover(offboardTarget)} style={{ fontSize: 14 }}>
                🖨️ Generate handover pack
              </button>
              <button
                onClick={confirmBan}
                disabled={banningId === offboardTarget.id}
                style={{ marginLeft: 'auto', background: 'var(--danger, #c0392b)', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 14, fontWeight: 600, cursor: banningId === offboardTarget.id ? 'default' : 'pointer' }}
              >
                {banningId === offboardTarget.id ? 'Banning…' : 'Confirm Ban'}
              </button>
            </div>
          </div>
        </div>
      )}

      {handoverTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1001, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 20px', overflowY: 'auto' }}>
          <style>{`
            @media print {
              body * { visibility: hidden; }
              #handover-print-area, #handover-print-area * { visibility: visible; }
              #handover-print-area { position: absolute; top: 0; left: 0; width: 100%; padding: 40px; }
              .no-print { display: none !important; }
            }
          `}</style>
          <div style={{ background: 'var(--surface)', borderRadius: 14, width: '100%', maxWidth: 640, maxHeight: '90vh', overflowY: 'auto', padding: 28, boxShadow: '0 8px 40px rgba(0,0,0,0.22)' }}>
            <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 18, margin: 0, color: 'var(--brand)' }}>Handover Pack</h2>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => window.print()} className="btn-primary" style={{ fontSize: 14 }}>🖨️ Print / Save as PDF</button>
                <button onClick={() => setHandoverTarget(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text3)', lineHeight: 1 }}>✕</button>
              </div>
            </div>

            {handoverLoading ? (
              <div className="loading">Gathering handover context…</div>
            ) : (
              <div id="handover-print-area">
                <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, marginBottom: 4 }}>
                  Handover Pack — {handoverTarget.full_name || handoverTarget.email}
                </h1>
                <p style={{ fontSize: 14, color: 'var(--text3)', marginBottom: 20 }}>
                  Prepared {new Date().toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>

                <h3 style={{ fontSize: 16, marginBottom: 8 }}>Open items ({handoverItems.length})</h3>
                {handoverItems.length === 0 ? (
                  <p style={{ fontSize: 14, color: 'var(--text3)', marginBottom: 20 }}>No open items currently assigned.</p>
                ) : (
                  <div style={{ marginBottom: 20 }}>
                    {handoverItems.map(item => (
                      <div key={`${item.module}-${item.id}`} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 14 }}>
                        <span style={{ color: 'var(--text3)', fontSize: 13 }}>{item.module}</span> — {item.label}
                        {item.dueDate && <span style={{ color: 'var(--text3)' }}> · due {new Date(item.dueDate + 'T12:00:00').toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
                        {item.overdue && <span style={{ color: 'var(--danger, #c0392b)', fontWeight: 600, marginLeft: 6 }}>overdue</span>}
                      </div>
                    ))}
                  </div>
                )}

                <h3 style={{ fontSize: 16, marginBottom: 8 }}>Decisions involved in ({handoverDecisions.length})</h3>
                {handoverDecisions.length === 0 ? (
                  <p style={{ fontSize: 14, color: 'var(--text3)', marginBottom: 20 }}>No resolutions linked to this trustee.</p>
                ) : (
                  <div style={{ marginBottom: 20 }}>
                    {handoverDecisions.map(r => (
                      <div key={r.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 14 }}>
                        {r.resolution_number ? `${r.resolution_number} · ` : ''}{r.description} — passed {new Date(r.date_passed + 'T12:00:00').toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })} ({r.status})
                      </div>
                    ))}
                  </div>
                )}

                <h3 style={{ fontSize: 16, marginBottom: 8 }}>Notes for the incoming trustee</h3>
                <textarea
                  className="form-input"
                  value={handoverNotes}
                  onChange={e => setHandoverNotes(e.target.value)}
                  placeholder="Context, contacts, anything the next person should know that isn't captured above…"
                  style={{ width: '100%', minHeight: 100, fontSize: 14 }}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
