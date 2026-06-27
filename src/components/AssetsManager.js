import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ensureTask, ensureUpcomingTask } from '../lib/taskSync';
import { matchWorkflowTemplate } from '../lib/workflowEngine';

const CATEGORIES = ['Building', 'Equipment', 'Vehicle', 'Technology', 'Grounds', 'Other'];
const CONDITIONS = ['excellent', 'good', 'fair', 'poor', 'critical'];
const CONDITION_STYLE = {
  excellent: { color: '#0F6E56', bg: '#E6F4F0' },
  good:      { color: '#1a6a3a', bg: '#e8f4ef' },
  fair:      { color: '#BA7517', bg: '#FDF3E3' },
  poor:      { color: '#A32D2D', bg: '#FAEAE7' },
  critical:  { color: '#fff',    bg: '#6B0000' },
};
const RECURRING_LABELS = { none: 'One-time', monthly: 'Monthly', quarterly: 'Quarterly', biannual: '6-monthly', annual: 'Annual', '2years': '2-yearly' };
const RECURRING_MONTHS = { monthly: 1, quarterly: 3, biannual: 6, annual: 12, '2years': 24 };
const ICONS = { Building: '🏛️', Equipment: '🔧', Vehicle: '🚐', Technology: '💻', Grounds: '🌿', Other: '📦' };
const EMPTY_FORM = { name: '', category: 'Building', location: '', condition: 'good', value: '', notes: '', purchase_date: '', purchase_cost: '', lifespan_years: '', replacement_cost: '' };
const EMPTY_REMINDER = { type: '', due_date: '', recurring: 'annual', notes: '' };

export default function AssetsManager({ onStartWorkflow }) {
  const [assets, setAssets] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [editReminderId, setEditReminderId] = useState(null);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [reminderForm, setReminderForm] = useState(EMPTY_REMINDER);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => { fetchAll(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchAll() {
    setLoading(true);
    const [assetRes, reminderRes, tplRes] = await Promise.all([
      supabase.from('assets').select('*').order('created_at', { ascending: false }),
      supabase.from('service_reminders').select('*').order('due_date', { ascending: true }),
      supabase.from('workflow_templates').select('id, name').order('name'),
    ]);
    const assetData = assetRes.data || [];
    const reminderData = reminderRes.data || [];
    const tplData = tplRes.data || [];
    setAssets(assetData);
    setReminders(reminderData);
    setTemplates(tplData);
    setLoading(false);
    createOverdueTasks(assetData, reminderData, tplData);
    createUpcomingTasks(assetData, reminderData, tplData);
  }

  async function createOverdueTasks(assetData, reminderData, tplData) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayStr = new Date().toISOString().split('T')[0];
    const assetMap = {};
    assetData.forEach(a => { assetMap[a.id] = a.name; });
    const overdue = reminderData.filter(r =>
      r.due_date && new Date(r.due_date + 'T12:00:00') < today
    );
    for (const r of overdue) {
      if (matchWorkflowTemplate(r.type, tplData)) continue;
      const assetName = assetMap[r.asset_id] || 'Asset';
      await ensureTask({
        title: `SERVICE: ${assetName} — ${r.type}`,
        description: `Asset service reminder overdue. Due: ${r.due_date}. Schedule maintenance immediately. [source_id:${r.id}]`,
        assigned_to: null,
        due_date: todayStr,
        priority: 'High',
      });
    }
  }

  async function createUpcomingTasks(assetData, reminderData, tplData) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const in30 = new Date(today); in30.setDate(in30.getDate() + 30);
    const assetMap = {};
    assetData.forEach(a => { assetMap[a.id] = a.name; });
    const upcoming = reminderData.filter(r =>
      r.due_date &&
      new Date(r.due_date + 'T12:00:00') >= today &&
      new Date(r.due_date + 'T12:00:00') <= in30
    );
    for (const r of upcoming) {
      if (matchWorkflowTemplate(r.type, tplData)) continue;
      const assetName = assetMap[r.asset_id] || 'Asset';
      await ensureUpcomingTask({
        sourceId: r.id,
        sourceType: 'service',
        name: `${assetName} — ${r.type}`,
        description: `Asset service reminder due soon. Schedule maintenance before the due date.`,
        assigned_to: null,
        due_date: r.due_date,
        windowDays: 30,
      });
    }
  }

  function getAssetReminders(assetId) {
    return reminders.filter(r => r.asset_id === assetId);
  }

  function getDaysUntil(dateStr) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const d = new Date(dateStr + 'T12:00:00');
    return Math.round((d - today) / (1000 * 60 * 60 * 24));
  }

  function getReminderStatus(r) {
    const days = getDaysUntil(r.due_date);
    if (days < 0) return 'overdue';
    if (days <= 30) return 'due-soon';
    return 'ok';
  }

  function formatDate(d) {
    if (!d) return '—';
    return new Date(d + 'T12:00:00').toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function lifecycleDays(a) {
    if (!a.replacement_date) return null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return Math.round((new Date(a.replacement_date + 'T12:00:00') - today) / (1000 * 60 * 60 * 24));
  }

  function lifecycleColor(days) {
    if (days === null) return 'var(--text3)';
    if (days < 730)  return 'var(--danger)';
    if (days < 1825) return 'var(--warning)';
    return 'var(--success)';
  }

  function lifecycleLabel(days) {
    if (days === null) return null;
    if (days < 0) return `${Math.abs(days)}d overdue`;
    if (days < 730) return `${Math.round(days / 30)}mo`;
    return `${(days / 365).toFixed(1)}yr`;
  }

  function openAdd() { setForm(EMPTY_FORM); setEditId(null); setError(''); setShowModal(true); }

  function openEdit(a) {
    setForm({
      name: a.name, category: a.category, location: a.location || '',
      condition: a.condition || 'good', value: a.value || '', notes: a.notes || '',
      purchase_date: a.purchase_date || '', purchase_cost: a.purchase_cost || '',
      lifespan_years: a.lifespan_years || '', replacement_cost: a.replacement_cost || '',
    });
    setEditId(a.id); setError(''); setShowModal(true);
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('Asset name is required'); return; }
    setSaving(true); setError('');
    const payload = {
      name: form.name, category: form.category, location: form.location,
      condition: form.condition, notes: form.notes,
      value:            form.value            ? parseFloat(form.value)            : null,
      purchase_cost:    form.purchase_cost    ? parseFloat(form.purchase_cost)    : null,
      lifespan_years:   form.lifespan_years   ? parseInt(form.lifespan_years)     : null,
      replacement_cost: form.replacement_cost ? parseFloat(form.replacement_cost) : null,
      purchase_date:    form.purchase_date    || null,
    };
    const { error } = editId
      ? await supabase.from('assets').update(payload).eq('id', editId)
      : await supabase.from('assets').insert(payload);
    if (error) { setError(error.message); setSaving(false); return; }
    setShowModal(false); fetchAll(); setSaving(false);
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this asset and all its reminders?')) return;
    await supabase.from('service_reminders').delete().eq('asset_id', id);
    await supabase.from('assets').delete().eq('id', id);
    if (selectedAsset?.id === id) setSelectedAsset(null);
    fetchAll();
  }

  function openReminders(asset) { setSelectedAsset(asset); }
  function closeReminders() { setSelectedAsset(null); }

  function openAddReminder() { setReminderForm(EMPTY_REMINDER); setEditReminderId(null); setError(''); setShowReminderModal(true); }

  function openEditReminder(r) {
    setReminderForm({ type: r.type, due_date: r.due_date, recurring: r.recurring, notes: r.notes || '' });
    setEditReminderId(r.id); setError(''); setShowReminderModal(true);
  }

  async function handleSaveReminder() {
    if (!reminderForm.type.trim() || !reminderForm.due_date) { setError('Service type and date are required'); return; }
    setSaving(true); setError('');
    const payload = {
      type: reminderForm.type.trim(),
      due_date: reminderForm.due_date,
      recurring: reminderForm.recurring,
      notes: reminderForm.notes.trim(),
    };
    const { error } = editReminderId
      ? await supabase.from('service_reminders').update(payload).eq('id', editReminderId)
      : await supabase.from('service_reminders').insert({ ...payload, asset_id: selectedAsset.id });
    if (error) { setError(error.message); setSaving(false); return; }
    setShowReminderModal(false); setSaving(false); fetchAll();
  }

  async function handleMarkServiced(r) {
    if (r.recurring === 'none') {
      await supabase.from('service_reminders').delete().eq('id', r.id);
    } else {
      const months = RECURRING_MONTHS[r.recurring] || 12;
      const next = new Date(r.due_date + 'T12:00:00');
      next.setMonth(next.getMonth() + months);
      const nextDate = next.toISOString().split('T')[0];
      await supabase.from('service_reminders').update({ due_date: nextDate }).eq('id', r.id);
    }
    fetchAll();
  }

  async function handleDeleteReminder(id) {
    if (!window.confirm('Delete this reminder?')) return;
    await supabase.from('service_reminders').delete().eq('id', id);
    fetchAll();
  }

  function setField(k, v) { setForm(f => ({ ...f, [k]: v })); }
  function setRField(k, v) { setReminderForm(f => ({ ...f, [k]: v })); }

  // Alerts — all overdue/due-soon across all assets
  const alerts = reminders.filter(r => getReminderStatus(r) !== 'ok');

  // Workflow suggestions — overdue/due-soon reminders that match a workflow template
  const assetNameMap = {};
  assets.forEach(a => { assetNameMap[a.id] = a.name; });
  const workflowSuggestions = reminders
    .filter(r => getReminderStatus(r) !== 'ok')
    .map(r => {
      const tpl = matchWorkflowTemplate(r.type, templates);
      if (!tpl) return null;
      return { reminder: r, template: tpl, assetName: assetNameMap[r.asset_id] || 'Asset', isOverdue: getReminderStatus(r) === 'overdue' };
    })
    .filter(Boolean);

  if (selectedAsset) {
    const assetReminders = getAssetReminders(selectedAsset.id);
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <button className="btn-secondary" onClick={closeReminders} style={{ padding: '7px 14px', fontSize: 13 }}>← Back</button>
          <div>
            <h2 style={{ fontSize: 20 }}>{ICONS[selectedAsset.category]} {selectedAsset.name}</h2>
            <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{selectedAsset.category} · {selectedAsset.location}</p>
          </div>
        </div>

        <div className="panel" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 16, fontWeight: 600 }}>Service Reminders</div>
            <button className="btn-accent" onClick={openAddReminder} style={{ padding: '7px 14px', fontSize: 13 }}>+ Add Reminder</button>
          </div>

          {assetReminders.length === 0 ? (
            <div className="empty-state">
              <div className="emoji">🔔</div>
              <div>No reminders set yet.</div>
              <button className="btn-primary" style={{ marginTop: 12 }} onClick={openAddReminder}>+ Add First Reminder</button>
            </div>
          ) : (
            assetReminders.map(r => {
              const status = getReminderStatus(r);
              const days = getDaysUntil(r.due_date);
              const daysText = days < 0 ? `${Math.abs(days)} days overdue` : days === 0 ? 'Due today' : `${days} days away`;
              const matchedTpl = matchWorkflowTemplate(r.type, templates);
              return (
                <div key={r.id} style={{
                  borderRadius: 8, padding: '12px 14px', marginBottom: 10, border: '1px solid',
                  background: status === 'overdue' ? '#faeae7' : status === 'due-soon' ? '#fdf0dc' : 'var(--surface2)',
                  borderColor: status === 'overdue' ? '#f0b8b0' : status === 'due-soon' ? '#f5d08a' : 'var(--border)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{r.type}</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => openEditReminder(r)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--brand)', fontSize: 13 }}>✏️</button>
                      <button onClick={() => handleDeleteReminder(r.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 14 }}>✕</button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 12, fontSize: 12, flexWrap: 'wrap', marginBottom: r.notes ? 6 : 0 }}>
                    <span style={{ fontWeight: 600, color: status === 'overdue' ? 'var(--danger)' : status === 'due-soon' ? 'var(--warning)' : 'var(--success)' }}>
                      📅 {formatDate(r.due_date)} ({daysText})
                    </span>
                    <span style={{ color: 'var(--text3)' }}>🔄 {RECURRING_LABELS[r.recurring] || 'Annual'}</span>
                  </div>
                  {r.notes && <div style={{ fontSize: 12, color: 'var(--text2)', fontStyle: 'italic', marginBottom: 8 }}>{r.notes}</div>}
                  {(status === 'overdue' || status === 'due-soon') && matchedTpl && onStartWorkflow && (
                    <button
                      onClick={() => onStartWorkflow({
                        templateId: matchedTpl.id,
                        workflowName: `${matchedTpl.name} — ${selectedAsset.name}`,
                        sourceName: `${selectedAsset.name} — ${r.type} due ${r.due_date}`,
                        triggerType: 'service_reminder',
                      })}
                      style={{ background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', marginTop: 4, marginRight: 8 }}>
                      ⚙️ Start {matchedTpl.name} Workflow →
                    </button>
                  )}
                  {status === 'overdue' && (
                    <button onClick={() => handleMarkServiced(r)}
                      style={{ background: 'var(--success)', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', marginTop: 4 }}>
                      ✓ Mark as Serviced
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>

        {showReminderModal && (
          <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowReminderModal(false)}>
            <div className="modal">
              <div className="modal-title">{editReminderId ? 'Edit Service Reminder' : 'Add Service Reminder'}</div>
              {error && <div className="alert alert-error">{error}</div>}
              <div className="form-group">
                <label className="form-label">Service Type *</label>
                <input className="form-input" value={reminderForm.type} onChange={e => setRField('type', e.target.value)} placeholder="e.g. Annual WOF, Oil change, Filter replacement" />
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Next Due Date *</label>
                  <input type="date" className="form-input" value={reminderForm.due_date} onChange={e => setRField('due_date', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Recurring</label>
                  <select className="form-input" value={reminderForm.recurring} onChange={e => setRField('recurring', e.target.value)}>
                    <option value="none">One-time only</option>
                    <option value="monthly">Every month</option>
                    <option value="quarterly">Every 3 months</option>
                    <option value="biannual">Every 6 months</option>
                    <option value="annual">Every year</option>
                    <option value="2years">Every 2 years</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Notes (optional)</label>
                <input className="form-input" value={reminderForm.notes} onChange={e => setRField('notes', e.target.value)} placeholder="e.g. Contact Hemi's Plumbing, check all filters" />
              </div>
              <div className="modal-actions">
                <button className="btn-secondary" onClick={() => setShowReminderModal(false)}>Cancel</button>
                <button className="btn-primary" onClick={handleSaveReminder} disabled={saving}>{saving ? 'Saving...' : editReminderId ? 'Save Changes' : 'Save Reminder'}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 22 }}>Assets Register</h2>
          <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>Click an asset to manage service reminders</p>
        </div>
        <button className="btn-primary" onClick={openAdd}>+ Add Asset</button>
      </div>

      {/* ALERTS */}
      {alerts.length > 0 && (
        <div style={{ background: '#faeae7', border: '1px solid #f0b8b0', borderRadius: 10, padding: '14px 16px', marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--danger)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            🔔 Service Alerts ({alerts.length})
          </div>
          {alerts.map(r => {
            const asset = assets.find(a => a.id === r.asset_id);
            const status = getReminderStatus(r);
            return (
              <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', borderBottom: '1px solid rgba(166,48,32,0.1)' }}>
                <span><strong>{asset?.name}</strong> — {r.type}</span>
                <span style={{ fontWeight: 600, color: status === 'overdue' ? 'var(--danger)' : 'var(--warning)' }}>
                  {status === 'overdue' ? 'Overdue' : 'Due soon'}: {formatDate(r.due_date)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* WORKFLOW SUGGESTIONS */}
      {workflowSuggestions.length > 0 && onStartWorkflow && (
        <div style={{ background: '#fdf4e8', border: '1px solid #e8c880', borderRadius: 10, padding: '14px 16px', marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#7a5500', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            ⚙️ Workflows Available ({workflowSuggestions.length})
          </div>
          {workflowSuggestions.map(({ reminder: r, template, assetName, isOverdue }) => (
            <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, padding: '6px 0', borderBottom: '1px solid rgba(200,144,42,0.15)', gap: 12 }}>
              <div>
                <strong>{assetName}</strong> — {r.type}
                <span style={{ marginLeft: 8, fontSize: 11, color: isOverdue ? 'var(--danger)' : '#c8902a', fontWeight: 600 }}>
                  ({isOverdue ? 'Overdue' : 'Due soon'}: {formatDate(r.due_date)})
                </span>
              </div>
              <button
                onClick={() => onStartWorkflow({
                  templateId: template.id,
                  workflowName: `${template.name} — ${assetName}`,
                  sourceName: `${assetName} — ${r.type} due ${r.due_date}`,
                  triggerType: 'service_reminder',
                })}
                style={{ background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', flexShrink: 0 }}>
                Start {template.name} Workflow →
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ASSET HEALTH SUMMARY */}
      {!loading && assets.length > 0 && (() => {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const in2yr  = new Date(today); in2yr.setFullYear(in2yr.getFullYear() + 2);
        const in5yr  = new Date(today); in5yr.setFullYear(in5yr.getFullYear() + 5);
        const criticalOrPoor = assets.filter(a => ['critical', 'poor'].includes(a.condition));
        const dueIn5yr = assets.filter(a => a.replacement_date && new Date(a.replacement_date + 'T12:00:00') >= today && new Date(a.replacement_date + 'T12:00:00') <= in5yr);
        const replacementTotal = dueIn5yr.reduce((s, a) => s + (parseFloat(a.replacement_cost) || 0), 0);
        const nextUp = assets.filter(a => a.replacement_date && new Date(a.replacement_date + 'T12:00:00') >= today).sort((a, b) => new Date(a.replacement_date) - new Date(b.replacement_date))[0];
        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Total Assets', value: assets.length, color: 'var(--text1)' },
              { label: 'Critical / Poor Condition', value: criticalOrPoor.length, color: criticalOrPoor.length ? 'var(--danger)' : 'var(--success)' },
              { label: 'Replacement Cost (5yr)', value: replacementTotal ? `$${Math.round(replacementTotal).toLocaleString()}` : '—', color: replacementTotal ? 'var(--warning)' : 'var(--text1)' },
              { label: 'Next Replacement', value: nextUp ? nextUp.name : '—', sub: nextUp ? formatDate(nextUp.replacement_date) : null, color: nextUp && new Date(nextUp.replacement_date + 'T12:00:00') <= in2yr ? 'var(--danger)' : 'var(--text1)' },
            ].map(({ label, value, sub, color }) => (
              <div key={label} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
                {sub && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{sub}</div>}
              </div>
            ))}
          </div>
        );
      })()}

      {loading ? <div className="loading">Loading assets...</div>
        : assets.length === 0 ? (
          <div className="empty-state">
            <div className="emoji">🏗️</div>
            <div>No assets yet. Add your first one!</div>
            <button className="btn-primary" style={{ marginTop: 16 }} onClick={openAdd}>+ Add Asset</button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
            {assets.map(a => {
              const aReminders = getAssetReminders(a.id);
              const overdue = aReminders.filter(r => getReminderStatus(r) === 'overdue').length;
              const dueSoon = aReminders.filter(r => getReminderStatus(r) === 'due-soon').length;
              return (
                <div key={a.id} className="panel">
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <div style={{ fontSize: 28 }}>{ICONS[a.category] || '📦'}</div>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 600 }}>{a.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text3)' }}>{a.category} · {a.location || 'No location'}</div>
                      </div>
                    </div>
                    {(() => { const s = CONDITION_STYLE[a.condition] || CONDITION_STYLE.good; return (
                      <span style={{ fontSize: 10, borderRadius: 20, padding: '2px 8px', fontWeight: 700, color: s.color, background: s.bg }}>
                        {a.condition ? a.condition.charAt(0).toUpperCase() + a.condition.slice(1) : 'Good'}
                      </span>
                    ); })()}
                  </div>

                  {overdue > 0 && <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--danger)', background: '#faeae7', borderRadius: 6, padding: '4px 8px', marginBottom: 8, display: 'inline-block' }}>⚠ {overdue} overdue reminder{overdue > 1 ? 's' : ''}</div>}
                  {dueSoon > 0 && overdue === 0 && <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--warning)', background: '#fdf0dc', borderRadius: 6, padding: '4px 8px', marginBottom: 8, display: 'inline-block' }}>🔔 {dueSoon} due soon</div>}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12, color: 'var(--text2)', marginBottom: 8 }}>
                    <div><span style={{ color: 'var(--text3)' }}>Value: </span>{a.value ? `$${Number(a.value).toLocaleString()}` : '—'}</div>
                    <div><span style={{ color: 'var(--text3)' }}>Reminders: </span>{aReminders.length}</div>
                  </div>
                  {a.replacement_date && (() => {
                    const days = lifecycleDays(a);
                    const col  = lifecycleColor(days);
                    const lbl  = lifecycleLabel(days);
                    return (
                      <div style={{ fontSize: 12, marginBottom: 8 }}>
                        <span style={{ color: 'var(--text3)' }}>Replace by: </span>
                        <span style={{ fontWeight: 600, color: col }}>{formatDate(a.replacement_date)} ({lbl})</span>
                        {a.replacement_cost && <span style={{ color: 'var(--text3)', marginLeft: 6 }}>· Est. ${Number(a.replacement_cost).toLocaleString()}</span>}
                      </div>
                    );
                  })()}
                  {a.notes && <div style={{ fontSize: 12, color: 'var(--text2)', fontStyle: 'italic', marginBottom: 12 }}>{a.notes}</div>}

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => openReminders(a)} style={{ fontSize: 12, color: '#fff', background: 'var(--brand)', border: 'none', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>🔔 Reminders</button>
                    <button onClick={() => openEdit(a)} style={{ fontSize: 12, color: 'var(--brand-light)', background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>Edit</button>
                    <button onClick={() => handleDelete(a.id)} style={{ fontSize: 12, color: 'var(--danger)', background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>Delete</button>
                  </div>
                </div>
              );
            })}
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
                <label className="form-label">Purchase Date</label>
                <input type="date" className="form-input" value={form.purchase_date} onChange={e => setField('purchase_date', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Purchase Cost ($)</label>
                <input type="number" className="form-input" value={form.purchase_cost} onChange={e => setField('purchase_cost', e.target.value)} placeholder="e.g. 25000" />
              </div>
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Expected Lifespan (years)</label>
                <input type="number" className="form-input" value={form.lifespan_years} onChange={e => setField('lifespan_years', e.target.value)} placeholder="e.g. 20" min="1" />
              </div>
              <div className="form-group">
                <label className="form-label">Replacement Cost Estimate ($)</label>
                <input type="number" className="form-input" value={form.replacement_cost} onChange={e => setField('replacement_cost', e.target.value)} placeholder="e.g. 30000" />
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
