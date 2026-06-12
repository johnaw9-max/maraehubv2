import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ensureTask } from '../lib/taskSync';

const CATEGORIES = ['Building', 'Equipment', 'Vehicle', 'Technology', 'Grounds', 'Other'];
const CONDITIONS = ['good', 'fair', 'poor'];
const RECURRING_LABELS = { none: 'One-time', monthly: 'Monthly', quarterly: 'Quarterly', biannual: '6-monthly', annual: 'Annual', '2years': '2-yearly' };
const RECURRING_MONTHS = { monthly: 1, quarterly: 3, biannual: 6, annual: 12, '2years': 24 };
const ICONS = { Building: '🏛️', Equipment: '🔧', Vehicle: '🚐', Technology: '💻', Grounds: '🌿', Other: '📦' };
const EMPTY_FORM = { name: '', category: 'Building', location: '', condition: 'good', value: '', notes: '' };
const EMPTY_REMINDER = { type: '', due_date: '', recurring: 'annual', notes: '' };

export default function AssetsManager() {
  const [assets, setAssets] = useState([]);
  const [reminders, setReminders] = useState([]);
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
    const [assetRes, reminderRes] = await Promise.all([
      supabase.from('assets').select('*').order('created_at', { ascending: false }),
      supabase.from('service_reminders').select('*').order('due_date', { ascending: true }),
    ]);
    const assetData = assetRes.data || [];
    const reminderData = reminderRes.data || [];
    setAssets(assetData);
    setReminders(reminderData);
    setLoading(false);
    createOverdueTasks(assetData, reminderData);
  }

  async function createOverdueTasks(assetData, reminderData) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayStr = new Date().toISOString().split('T')[0];
    const assetMap = {};
    assetData.forEach(a => { assetMap[a.id] = a.name; });
    const overdue = reminderData.filter(r =>
      r.due_date && new Date(r.due_date + 'T12:00:00') < today
    );
    for (const r of overdue) {
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

  function openAdd() { setForm(EMPTY_FORM); setEditId(null); setError(''); setShowModal(true); }

  function openEdit(a) {
    setForm({ name: a.name, category: a.category, location: a.location || '', condition: a.condition, value: a.value || '', notes: a.notes || '' });
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
                    <span style={{ fontSize: 10, borderRadius: 20, padding: '2px 8px', fontWeight: 600 }} className={`badge badge-${a.condition}`}>{a.condition}</span>
                  </div>

                  {overdue > 0 && <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--danger)', background: '#faeae7', borderRadius: 6, padding: '4px 8px', marginBottom: 8, display: 'inline-block' }}>⚠ {overdue} overdue reminder{overdue > 1 ? 's' : ''}</div>}
                  {dueSoon > 0 && overdue === 0 && <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--warning)', background: '#fdf0dc', borderRadius: 6, padding: '4px 8px', marginBottom: 8, display: 'inline-block' }}>🔔 {dueSoon} due soon</div>}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12, color: 'var(--text2)', marginBottom: 12 }}>
                    <div><span style={{ color: 'var(--text3)' }}>Value: </span>{a.value ? `$${Number(a.value).toLocaleString()}` : '—'}</div>
                    <div><span style={{ color: 'var(--text3)' }}>Reminders: </span>{aReminders.length}</div>
                  </div>
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
