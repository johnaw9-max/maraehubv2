// MaraeHub Committee Minutes & Resolutions
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import useProfiles from '../lib/useProfiles';
import { sendNotification, getEmailByName, meetingActionBody } from '../lib/notify';
import { ensureTask } from '../lib/taskSync';

const MEETING_TYPES = ['Trustee Meeting', 'AGM', 'Special Meeting', 'Committee Meeting', 'Working Group Meeting'];

const RESOLUTION_STATUSES = ['Open', 'In Progress', 'Completed', 'Cancelled', 'Active', 'Implemented', 'Superseded'];
const DECISION_REGISTER_STATUSES = ['Active', 'Implemented', 'Superseded'];
const ACTION_STATUSES = ['Open', 'In Progress', 'Completed'];

const MEETING_TYPE_COLORS = {
  'Trustee Meeting':      { bg: '#e8f4ef', color: '#1a4a3a' },
  'AGM':                  { bg: '#f0ecf8', color: '#6b42a8' },
  'Special Meeting':      { bg: '#fdf0dc', color: '#7a4f00' },
  'Committee Meeting':    { bg: '#e8eef8', color: '#1a4a8a' },
  'Working Group Meeting':{ bg: '#faeae7', color: '#a63020' },
};

const RESOLUTION_STATUS_COLORS = {
  'Open':        { bg: '#fdf0dc', color: '#7a4f00' },
  'In Progress': { bg: '#e8eef8', color: '#1a4a8a' },
  'Completed':   { bg: '#e8f4ef', color: '#1a4a3a' },
  'Cancelled':   { bg: '#f5f0e8', color: '#4a4438' },
  'Active':      { bg: '#e8eef8', color: '#1a4a8a' },
  'Implemented': { bg: '#e8f4ef', color: '#1a4a3a' },
  'Superseded':  { bg: '#f5f0e8', color: '#4a4438' },
};

const ACTION_STATUS_COLORS = {
  'Open':       { bg: '#fdf0dc', color: '#7a4f00' },
  'In Progress':{ bg: '#e8eef8', color: '#1a4a8a' },
  'Completed':  { bg: '#e8f4ef', color: '#1a4a3a' },
};

const EMPTY_MEETING = {
  title: '', meeting_type: 'Trustee Meeting', meeting_date: '',
  chairperson: '', secretary: '', attendees: '', apologies: '',
  minutes: '', created_by: '',
};

const EMPTY_RESOLUTION = {
  resolution_number: '', description: '', date_passed: '',
  status: 'Open', notes: '',
};

const EMPTY_ACTION = {
  description: '', assigned_to: '', due_date: '', status: 'Open',
};

function fmt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });
}

function daysUntil(d) {
  if (!d) return null;
  return Math.ceil((new Date(d) - new Date()) / (1000 * 60 * 60 * 24));
}

function StatusBadge({ status, colors }) {
  const s = colors[status] || { bg: '#f5f5f5', color: '#666' };
  return (
    <span style={{ fontSize: 10, borderRadius: 20, padding: '2px 10px', fontWeight: 600, background: s.bg, color: s.color, whiteSpace: 'nowrap' }}>
      {status}
    </span>
  );
}

function SummaryTile({ icon, iconBg, value, label, valueColor, sub }) {
  return (
    <div className="panel" style={{ textAlign: 'center' }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, margin: '0 auto 10px' }}>{icon}</div>
      <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 28, fontWeight: 600, color: valueColor || 'var(--text1)' }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ─── MEETING FORM ────────────────────────────────────────────────────────────

function MeetingForm({ initial, onSave, onCancel, saving, error }) {
  const profiles = useProfiles();
  const [form, setForm] = useState(initial || EMPTY_MEETING);
  function setField(k, v) { setForm(f => ({ ...f, [k]: v })); }

  return (
    <div className="panel" style={{ marginBottom: 20 }}>
      <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 18, fontWeight: 600, marginBottom: 20 }}>
        {initial?.id ? 'Edit Meeting' : 'Add New Meeting'}
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="grid-2">
        <div className="form-group">
          <label className="form-label">Meeting Title *</label>
          <input className="form-input" value={form.title} onChange={e => setField('title', e.target.value)} placeholder="e.g. July Trustee Meeting" />
        </div>
        <div className="form-group">
          <label className="form-label">Meeting Type</label>
          <select className="form-input" value={form.meeting_type} onChange={e => setField('meeting_type', e.target.value)}>
            {MEETING_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      <div className="grid-2">
        <div className="form-group">
          <label className="form-label">Meeting Date *</label>
          <input type="date" className="form-input" value={form.meeting_date} onChange={e => setField('meeting_date', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Created By</label>
          <input className="form-input" value={form.created_by} onChange={e => setField('created_by', e.target.value)} placeholder="e.g. Jane Tūhoe" />
        </div>
      </div>

      <div className="grid-2">
        <div className="form-group">
          <label className="form-label">Chairperson</label>
          <select className="form-input" value={form.chairperson} onChange={e => setField('chairperson', e.target.value)}>
            <option value="">— Select assignee —</option>
            {profiles.map(p => (
              <option key={p.full_name} value={p.full_name}>
                {p.full_name} ({p.role === 'trustee' ? 'Trustee' : 'Community'})
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Secretary</label>
          <select className="form-input" value={form.secretary} onChange={e => setField('secretary', e.target.value)}>
            <option value="">— Select assignee —</option>
            {profiles.map(p => (
              <option key={p.full_name} value={p.full_name}>
                {p.full_name} ({p.role === 'trustee' ? 'Trustee' : 'Community'})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Attendees</label>
        <textarea className="form-input" rows={2} value={form.attendees} onChange={e => setField('attendees', e.target.value)} placeholder="Names of those present, comma-separated" style={{ resize: 'vertical' }} />
      </div>

      <div className="form-group">
        <label className="form-label">Apologies</label>
        <textarea className="form-input" rows={2} value={form.apologies} onChange={e => setField('apologies', e.target.value)} placeholder="Names of those who sent apologies, comma-separated" style={{ resize: 'vertical' }} />
      </div>

      <div className="form-group">
        <label className="form-label">Minutes</label>
        <textarea className="form-input" rows={6} value={form.minutes} onChange={e => setField('minutes', e.target.value)} placeholder="Enter the meeting minutes here..." style={{ resize: 'vertical' }} />
      </div>

      <div className="modal-actions">
        <button className="btn-secondary" onClick={onCancel}>Cancel</button>
        <button className="btn-primary" onClick={() => onSave(form)} disabled={saving}>
          {saving ? 'Saving...' : initial?.id ? 'Save Changes' : 'Add Meeting'}
        </button>
      </div>
    </div>
  );
}

// ─── RESOLUTION INLINE FORM ───────────────────────────────────────────────────

function ResolutionForm({ initial, onSave, onCancel, saving, error }) {
  const [form, setForm] = useState(initial || EMPTY_RESOLUTION);
  function setField(k, v) { setForm(f => ({ ...f, [k]: v })); }

  return (
    <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: 16, marginBottom: 12 }}>
      {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>{error}</div>}
      <div className="grid-2">
        <div className="form-group">
          <label className="form-label">Resolution Number</label>
          <input className="form-input" value={form.resolution_number} onChange={e => setField('resolution_number', e.target.value)} placeholder="e.g. RES-2024-01" />
        </div>
        <div className="form-group">
          <label className="form-label">Date Passed</label>
          <input type="date" className="form-input" value={form.date_passed} onChange={e => setField('date_passed', e.target.value)} />
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Description *</label>
        <textarea className="form-input" rows={3} value={form.description} onChange={e => setField('description', e.target.value)} placeholder="Describe the resolution..." style={{ resize: 'vertical' }} />
      </div>
      <div className="grid-2">
        <div className="form-group">
          <label className="form-label">Status</label>
          <select className="form-input" value={form.status} onChange={e => setField('status', e.target.value)}>
            {RESOLUTION_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Notes</label>
          <input className="form-input" value={form.notes} onChange={e => setField('notes', e.target.value)} placeholder="Any additional notes" />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button className="btn-secondary" onClick={onCancel} style={{ fontSize: 12 }}>Cancel</button>
        <button className="btn-primary" onClick={() => onSave(form)} disabled={saving} style={{ fontSize: 12 }}>
          {saving ? 'Saving...' : initial?.id ? 'Save Changes' : 'Add Resolution'}
        </button>
      </div>
    </div>
  );
}

// ─── ACTION INLINE FORM ───────────────────────────────────────────────────────

function ActionForm({ initial, onSave, onCancel, saving, error }) {
  const profiles = useProfiles();
  const [form, setForm] = useState(initial || EMPTY_ACTION);
  function setField(k, v) { setForm(f => ({ ...f, [k]: v })); }

  return (
    <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: 16, marginBottom: 12 }}>
      {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>{error}</div>}
      <div className="form-group">
        <label className="form-label">Description *</label>
        <textarea className="form-input" rows={2} value={form.description} onChange={e => setField('description', e.target.value)} placeholder="Describe the action..." style={{ resize: 'vertical' }} />
      </div>
      <div className="grid-2">
        <div className="form-group">
          <label className="form-label">Assigned To</label>
          <select className="form-input" value={form.assigned_to} onChange={e => setField('assigned_to', e.target.value)}>
              <option value="">— Select assignee —</option>
              {profiles.map(p => (
                <option key={p.full_name} value={p.full_name}>
                  {p.full_name} ({p.role === 'trustee' ? 'Trustee' : 'Community'})
                </option>
              ))}
            </select>
        </div>
        <div className="form-group">
          <label className="form-label">Due Date</label>
          <input type="date" className="form-input" value={form.due_date} onChange={e => setField('due_date', e.target.value)} />
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Status</label>
        <select className="form-input" value={form.status} onChange={e => setField('status', e.target.value)}>
          {ACTION_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button className="btn-secondary" onClick={onCancel} style={{ fontSize: 12 }}>Cancel</button>
        <button className="btn-primary" onClick={() => onSave(form)} disabled={saving} style={{ fontSize: 12 }}>
          {saving ? 'Saving...' : initial?.id ? 'Save Changes' : 'Add Action'}
        </button>
      </div>
    </div>
  );
}

// ─── MEETING DETAIL VIEW ──────────────────────────────────────────────────────

function MeetingDetail({ meeting, onBack, onEdit, onDelete }) {
  const [detailTab, setDetailTab] = useState('info');
  const [resolutions, setResolutions] = useState([]);
  const [actions, setActions] = useState([]);
  const [loadingDetail, setLoadingDetail] = useState(true);
  const [showResForm, setShowResForm] = useState(false);
  const [showActForm, setShowActForm] = useState(false);
  const [editResId, setEditResId] = useState(null);
  const [editActId, setEditActId] = useState(null);
  const [resForm, setResForm] = useState(null);
  const [actForm, setActForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [resError, setResError] = useState('');
  const [actError, setActError] = useState('');

  const fetchDetail = useCallback(async () => {
    setLoadingDetail(true);
    const [resRes, actRes] = await Promise.all([
      supabase.from('resolutions').select('*').eq('meeting_id', meeting.id).order('created_at', { ascending: true }),
      supabase.from('meeting_actions').select('*').eq('meeting_id', meeting.id).order('created_at', { ascending: true }),
    ]);
    setResolutions(resRes.data || []);
    setActions(actRes.data || []);
    setLoadingDetail(false);
  }, [meeting.id]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);

  async function saveResolution(form) {
    if (!form.description.trim()) { setResError('Description is required'); return; }
    setSaving(true); setResError('');
    const payload = {
      meeting_id: meeting.id,
      resolution_number: form.resolution_number.trim() || null,
      description: form.description.trim(),
      date_passed: form.date_passed || null,
      status: form.status,
      notes: form.notes.trim() || null,
    };
    const { error } = editResId
      ? await supabase.from('resolutions').update(payload).eq('id', editResId)
      : await supabase.from('resolutions').insert(payload);
    if (error) { setResError(error.message); setSaving(false); return; }
    setShowResForm(false); setEditResId(null); setResForm(null); setSaving(false);
    fetchDetail();
  }

  async function deleteResolution(id) {
    if (!window.confirm('Remove this resolution?')) return;
    await supabase.from('resolutions').delete().eq('id', id);
    fetchDetail();
  }

  async function saveAction(form) {
    if (!form.description.trim()) { setActError('Description is required'); return; }
    setSaving(true); setActError('');
    const payload = {
      meeting_id: meeting.id,
      description: form.description.trim(),
      assigned_to: form.assigned_to.trim() || null,
      due_date: form.due_date || null,
      status: form.status,
    };
    const { error } = editActId
      ? await supabase.from('meeting_actions').update(payload).eq('id', editActId)
      : await supabase.from('meeting_actions').insert(payload);
    if (error) { setActError(error.message); setSaving(false); return; }

    // Notify the assignee — fire and forget (new actions only, not edits)
    if (!editActId && form.assigned_to.trim()) {
      const action  = { description: payload.description, assigned_to: payload.assigned_to, due_date: payload.due_date };
      getEmailByName(payload.assigned_to).then(email => {
        if (email) sendNotification(email, `Action assigned to you — ${meeting.title}`, meetingActionBody(action, meeting));
      });
    }

    // Sync new actions to the Task Board
    if (!editActId) {
      const taskPayload = {
        title: form.description.trim(),
        assigned_to: form.assigned_to ? form.assigned_to.trim() || null : null,
        due_date: form.due_date || null,
        status: 'open',
        priority: 'Medium',
      };
      console.log('[CommitteeMinutes] syncing action to tasks table:', taskPayload);
      const { data: taskData, error: taskError } = await supabase.from('tasks').insert(taskPayload).select();
      if (taskError) {
        console.error('[CommitteeMinutes] task insert failed:', taskError);
      } else {
        console.log('[CommitteeMinutes] task created successfully:', taskData);
      }
    }

    setShowActForm(false); setEditActId(null); setActForm(null); setSaving(false);
    fetchDetail();
  }

  async function deleteAction(id) {
    if (!window.confirm('Remove this action?')) return;
    await supabase.from('meeting_actions').delete().eq('id', id);
    fetchDetail();
  }

  function openEditRes(r) {
    setResForm({ ...r, date_passed: r.date_passed || '', notes: r.notes || '' });
    setEditResId(r.id);
    setResError('');
    setShowResForm(true);
  }

  function openEditAct(a) {
    setActForm({ ...a, due_date: a.due_date || '' });
    setEditActId(a.id);
    setActError('');
    setShowActForm(true);
  }

  const mtc = MEETING_TYPE_COLORS[meeting.meeting_type] || { bg: '#f5f5f5', color: '#333' };
  const openRes = resolutions.filter(r => r.status !== 'Completed' && r.status !== 'Cancelled').length;
  const openActs = actions.filter(a => a.status !== 'Completed').length;

  return (
    <div>
      {/* BACK + HEADER */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <button
            onClick={onBack}
            style={{ fontSize: 12, color: 'var(--brand)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 8px', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            ← Back to Meetings
          </button>
          <h2 style={{ fontSize: 22, marginBottom: 4 }}>{meeting.title}</h2>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, borderRadius: 20, padding: '2px 10px', fontWeight: 600, background: mtc.bg, color: mtc.color }}>
              {meeting.meeting_type}
            </span>
            <span style={{ fontSize: 12, color: 'var(--text3)' }}>{fmt(meeting.meeting_date)}</span>
            {meeting.chairperson && <span style={{ fontSize: 12, color: 'var(--text3)' }}>Chair: {meeting.chairperson}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onEdit} style={{ fontSize: 12, color: 'var(--brand)', background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 12px', cursor: 'pointer' }}>Edit</button>
          <button onClick={onDelete} style={{ fontSize: 12, color: 'var(--danger)', background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 12px', cursor: 'pointer' }}>Delete</button>
        </div>
      </div>

      {/* DETAIL TABS */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '2px solid var(--border)', marginBottom: 20 }}>
        {[
          { key: 'info', label: 'Meeting Info' },
          { key: 'resolutions', label: `Resolutions${resolutions.length ? ` (${resolutions.length})` : ''}` },
          { key: 'actions', label: `Actions${actions.length ? ` (${actions.length})` : ''}` },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setDetailTab(t.key)}
            style={{
              fontSize: 13, fontWeight: detailTab === t.key ? 600 : 400,
              padding: '8px 16px', background: 'none', border: 'none', cursor: 'pointer',
              borderBottom: detailTab === t.key ? '2px solid var(--brand)' : '2px solid transparent',
              color: detailTab === t.key ? 'var(--brand)' : 'var(--text2)',
              marginBottom: -2,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loadingDetail ? <div className="loading">Loading...</div> : (
        <>
          {/* INFO TAB */}
          {detailTab === 'info' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
                <SummaryTile icon="📋" iconBg="#e8eef8" value={resolutions.length} label="Resolutions" valueColor="var(--info)" sub={openRes > 0 ? `${openRes} open` : null} />
                <SummaryTile icon="✅" iconBg="#e8f4ef" value={actions.length} label="Actions" valueColor="var(--brand)" sub={openActs > 0 ? `${openActs} open` : null} />
                <SummaryTile icon="👥" iconBg="#f0ecf8" value={meeting.attendees ? meeting.attendees.split(',').filter(Boolean).length : '—'} label="Attendees" valueColor="#6b42a8" />
              </div>

              <div className="panel" style={{ marginBottom: 16 }}>
                <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Meeting Details</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px', fontSize: 13 }}>
                  {[
                    { label: 'Date', val: fmt(meeting.meeting_date) },
                    { label: 'Type', val: meeting.meeting_type },
                    { label: 'Chairperson', val: meeting.chairperson || '—' },
                    { label: 'Secretary', val: meeting.secretary || '—' },
                    { label: 'Recorded by', val: meeting.created_by || '—' },
                  ].map(({ label, val }) => (
                    <div key={label}>
                      <span style={{ color: 'var(--text3)', fontWeight: 500 }}>{label}: </span>
                      <span>{val}</span>
                    </div>
                  ))}
                </div>
                {meeting.attendees && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 500, marginBottom: 4 }}>Attendees</div>
                    <div style={{ fontSize: 13 }}>{meeting.attendees}</div>
                  </div>
                )}
                {meeting.apologies && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 500, marginBottom: 4 }}>Apologies</div>
                    <div style={{ fontSize: 13 }}>{meeting.apologies}</div>
                  </div>
                )}
              </div>

              {meeting.minutes && (
                <div className="panel">
                  <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Minutes</div>
                  <div style={{ fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap', color: 'var(--text2)' }}>{meeting.minutes}</div>
                </div>
              )}
            </div>
          )}

          {/* RESOLUTIONS TAB */}
          {detailTab === 'resolutions' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                <button className="btn-primary" onClick={() => { setResForm(null); setEditResId(null); setResError(''); setShowResForm(true); }}>+ Add Resolution</button>
              </div>

              {showResForm && (
                <ResolutionForm
                  initial={resForm}
                  onSave={saveResolution}
                  onCancel={() => { setShowResForm(false); setEditResId(null); setResForm(null); }}
                  saving={saving}
                  error={resError}
                />
              )}

              {resolutions.length === 0 ? (
                <div className="empty-state"><div className="emoji">📜</div><div>No resolutions yet</div></div>
              ) : (
                resolutions.map(r => (
                  <div key={r.id} className="panel" style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        {r.resolution_number && (
                          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {r.resolution_number}
                          </div>
                        )}
                        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>{r.description}</div>
                        <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                          {r.date_passed && <span>Passed {fmt(r.date_passed)}</span>}
                          {r.notes && <span>{r.date_passed ? ' · ' : ''}{r.notes}</span>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                        <StatusBadge status={r.status} colors={RESOLUTION_STATUS_COLORS} />
                        <button onClick={() => openEditRes(r)} style={{ fontSize: 11, color: 'var(--brand)', background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 8px', cursor: 'pointer' }}>Edit</button>
                        <button onClick={() => deleteResolution(r.id)} style={{ fontSize: 11, color: 'var(--danger)', background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 8px', cursor: 'pointer' }}>Remove</button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ACTIONS TAB */}
          {detailTab === 'actions' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                <button className="btn-primary" onClick={() => { setActForm(null); setEditActId(null); setActError(''); setShowActForm(true); }}>+ Add Action</button>
              </div>

              {showActForm && (
                <ActionForm
                  initial={actForm}
                  onSave={saveAction}
                  onCancel={() => { setShowActForm(false); setEditActId(null); setActForm(null); }}
                  saving={saving}
                  error={actError}
                />
              )}

              {actions.length === 0 ? (
                <div className="empty-state"><div className="emoji">✅</div><div>No actions yet</div></div>
              ) : (
                actions.map(a => {
                  const days = daysUntil(a.due_date);
                  const overdue = days !== null && days < 0 && a.status !== 'Completed';
                  return (
                    <div key={a.id} className="panel" style={{ marginBottom: 10, borderLeft: overdue ? '3px solid var(--danger)' : '3px solid transparent' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>{a.description}</div>
                          <div style={{ fontSize: 11, color: 'var(--success)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span>📋</span> Added to Task Board
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text3)', display: 'flex', gap: 12 }}>
                            {a.assigned_to && <span>👤 {a.assigned_to}</span>}
                            {a.due_date && (
                              <span style={{ color: overdue ? 'var(--danger)' : 'inherit' }}>
                                📅 Due {fmt(a.due_date)}{overdue && ` (${Math.abs(days)}d overdue)`}
                              </span>
                            )}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                          <StatusBadge status={a.status} colors={ACTION_STATUS_COLORS} />
                          <button onClick={() => openEditAct(a)} style={{ fontSize: 11, color: 'var(--brand)', background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 8px', cursor: 'pointer' }}>Edit</button>
                          <button onClick={() => deleteAction(a.id)} style={{ fontSize: 11, color: 'var(--danger)', background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 8px', cursor: 'pointer' }}>Remove</button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function CommitteeMinutes() {
  const [view, setView] = useState('list'); // 'list' | 'form' | 'detail'
  const [meetings, setMeetings] = useState([]);
  const [allResolutions, setAllResolutions] = useState([]);
  const [allActions, setAllActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [editMeeting, setEditMeeting] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [mainTab, setMainTab] = useState('meetings');
  const [decisionSearch, setDecisionSearch] = useState('');
  const [decisionStatusFilter, setDecisionStatusFilter] = useState('all');
  const [selectedResolution, setSelectedResolution] = useState(null);

  useEffect(() => { fetchAll(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchAll() {
    setLoading(true);
    const [meetRes, resRes, actRes] = await Promise.all([
      supabase.from('meetings').select('*').order('meeting_date', { ascending: false }),
      supabase.from('resolutions').select('*, meetings(id, title, meeting_date, meeting_type)').order('date_passed', { ascending: false }),
      supabase.from('meeting_actions').select('id, status'),
    ]);
    setMeetings(meetRes.data || []);
    setAllResolutions(resRes.data || []);
    setAllActions(actRes.data || []);
    setLoading(false);
    createOverdueTasks();
  }

  async function createOverdueTasks() {
    const todayStr = new Date().toISOString().split('T')[0];
    const { data: overdueActions } = await supabase
      .from('meeting_actions')
      .select('id, description, assigned_to, due_date')
      .in('status', ['Open', 'In Progress'])
      .lt('due_date', todayStr);
    if (!overdueActions || !overdueActions.length) return;
    for (const a of overdueActions) {
      const shortDesc = (a.description || '').slice(0, 80);
      await ensureTask({
        title: `ACTION: ${shortDesc}`,
        description: `Meeting action overdue. Due: ${a.due_date}. Follow up immediately. [source_id:${a.id}]`,
        assigned_to: a.assigned_to || null,
        due_date: todayStr,
        priority: 'High',
      });
    }
  }

  async function handleSaveMeeting(form) {
    if (!form.title.trim()) { setError('Meeting title is required'); return; }
    if (!form.meeting_date) { setError('Meeting date is required'); return; }
    setSaving(true); setError('');

    const payload = {
      title: form.title.trim(),
      meeting_type: form.meeting_type,
      meeting_date: form.meeting_date,
      chairperson: form.chairperson.trim() || null,
      secretary: form.secretary.trim() || null,
      attendees: form.attendees.trim() || null,
      apologies: form.apologies.trim() || null,
      minutes: form.minutes.trim() || null,
      created_by: form.created_by.trim() || null,
    };

    if (editMeeting?.id) {
      const { error } = await supabase.from('meetings').update(payload).eq('id', editMeeting.id);
      if (error) { setError(error.message); setSaving(false); return; }
      // refresh selectedMeeting if we're coming back to detail
      setSelectedMeeting({ ...editMeeting, ...payload });
    } else {
      const { error } = await supabase.from('meetings').insert(payload);
      if (error) { setError(error.message); setSaving(false); return; }
    }

    setSaving(false);
    setView('list');
    setEditMeeting(null);
    fetchAll();
  }

  async function handleDeleteMeeting(meeting) {
    if (!window.confirm(`Delete "${meeting.title}" and all its resolutions and actions?`)) return;
    await Promise.all([
      supabase.from('resolutions').delete().eq('meeting_id', meeting.id),
      supabase.from('meeting_actions').delete().eq('meeting_id', meeting.id),
    ]);
    await supabase.from('meetings').delete().eq('id', meeting.id);
    setView('list');
    setSelectedMeeting(null);
    fetchAll();
  }

  // Summary stats
  const CLOSED_STATUSES = ['Completed', 'Cancelled', 'Implemented', 'Superseded'];
  const openResolutions = allResolutions.filter(r => !CLOSED_STATUSES.includes(r.status)).length;

  // Decision Register filtered list
  const filteredDecisions = allResolutions.filter(r => {
    const matchStatus = decisionStatusFilter === 'all' || r.status === decisionStatusFilter;
    const term = decisionSearch.toLowerCase();
    const matchSearch = !decisionSearch ||
      (r.resolution_number || '').toLowerCase().includes(term) ||
      (r.description || '').toLowerCase().includes(term) ||
      (r.meetings?.title || '').toLowerCase().includes(term);
    return matchStatus && matchSearch;
  });
  const openActions = allActions.filter(a => a.status !== 'Completed').length;

  // Filtered list
  const filtered = meetings.filter(m => {
    const matchSearch = !search || m.title.toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === 'all' || m.meeting_type === filterType;
    return matchSearch && matchType;
  });

  if (view === 'form') {
    return (
      <div>
        <button
          onClick={() => { setView(selectedMeeting ? 'detail' : 'list'); setEditMeeting(null); setError(''); }}
          style={{ fontSize: 12, color: 'var(--brand)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 16px', display: 'flex', alignItems: 'center', gap: 4 }}
        >
          ← {selectedMeeting ? 'Back to Meeting' : 'Back to Meetings'}
        </button>
        <MeetingForm
          initial={editMeeting}
          onSave={handleSaveMeeting}
          onCancel={() => { setView(selectedMeeting ? 'detail' : 'list'); setEditMeeting(null); setError(''); }}
          saving={saving}
          error={error}
        />
      </div>
    );
  }

  if (view === 'detail' && selectedMeeting) {
    return (
      <MeetingDetail
        meeting={selectedMeeting}
        onBack={() => { setSelectedMeeting(null); setView('list'); }}
        onEdit={() => { setEditMeeting(selectedMeeting); setError(''); setView('form'); }}
        onDelete={() => handleDeleteMeeting(selectedMeeting)}
      />
    );
  }

  // LIST VIEW
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 22 }}>Committee Minutes</h2>
          <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>Meeting records, resolutions and actions</p>
        </div>
        {mainTab === 'meetings' && (
          <button className="btn-primary" onClick={() => { setEditMeeting(null); setError(''); setView('form'); }}>+ Add Meeting</button>
        )}
      </div>

      {/* SUMMARY TILES */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        <SummaryTile icon="📋" iconBg="#e8eef8" value={meetings.length} label="Total Meetings" valueColor="var(--info)" />
        <SummaryTile icon="📜" iconBg="#fdf0dc" value={openResolutions} label="Open Resolutions" valueColor={openResolutions > 0 ? 'var(--warning)' : 'var(--text3)'} />
        <SummaryTile icon="✅" iconBg="#e8f4ef" value={openActions} label="Open Actions" valueColor={openActions > 0 ? 'var(--brand)' : 'var(--text3)'} />
      </div>

      {/* MAIN TABS */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '2px solid var(--border)', marginBottom: 20 }}>
        {[
          { key: 'meetings', label: 'Meetings' },
          { key: 'decisions', label: `Decision Register${allResolutions.length ? ` (${allResolutions.length})` : ''}` },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setMainTab(t.key)}
            style={{
              fontSize: 13, fontWeight: mainTab === t.key ? 600 : 400,
              padding: '8px 16px', background: 'none', border: 'none', cursor: 'pointer',
              borderBottom: mainTab === t.key ? '2px solid var(--brand)' : '2px solid transparent',
              color: mainTab === t.key ? 'var(--brand)' : 'var(--text2)',
              marginBottom: -2,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* MEETINGS TAB */}
      {mainTab === 'meetings' && (
        <>
          {/* SEARCH + FILTER */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <input
              className="form-input"
              style={{ flex: 1, minWidth: 200, maxWidth: 320 }}
              placeholder="Search meetings..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {['all', ...MEETING_TYPES].map(t => (
                <button
                  key={t}
                  onClick={() => setFilterType(t)}
                  style={{
                    fontSize: 11, borderRadius: 20, padding: '5px 12px', cursor: 'pointer', fontWeight: 500,
                    background: filterType === t ? 'var(--brand)' : 'var(--surface2)',
                    color: filterType === t ? '#fff' : 'var(--text2)',
                    border: filterType === t ? '1px solid var(--brand)' : '1px solid var(--border)',
                  }}
                >
                  {t === 'all' ? 'All Types' : t}
                </button>
              ))}
            </div>
          </div>

          {/* MEETINGS LIST */}
          {loading ? (
            <div className="loading">Loading meetings...</div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <div className="emoji">📋</div>
              <div>{meetings.length === 0 ? 'No meetings yet — add your first one above' : 'No meetings match your search'}</div>
            </div>
          ) : (
            filtered.map(m => {
              const mtc = MEETING_TYPE_COLORS[m.meeting_type] || { bg: '#f5f5f5', color: '#333' };
              return (
                <div
                  key={m.id}
                  className="panel"
                  style={{ marginBottom: 10, cursor: 'pointer' }}
                  onClick={() => { setSelectedMeeting(m); setView('detail'); }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 10, background: mtc.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: mtc.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {m.meeting_date ? new Date(m.meeting_date).toLocaleDateString('en-NZ', { month: 'short' }) : '—'}
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: mtc.color, lineHeight: 1 }}>
                        {m.meeting_date ? new Date(m.meeting_date).getDate() : '—'}
                      </div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{m.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2, display: 'flex', gap: 10 }}>
                        {m.chairperson && <span>Chair: {m.chairperson}</span>}
                        {m.created_by && <span>Recorded by: {m.created_by}</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: 10, borderRadius: 20, padding: '2px 10px', fontWeight: 600, background: mtc.bg, color: mtc.color }}>
                        {m.meeting_type}
                      </span>
                      <span style={{ fontSize: 18, color: 'var(--text3)' }}>›</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </>
      )}

      {/* DECISION REGISTER TAB */}
      {mainTab === 'decisions' && (
        <>
          {/* SEARCH + STATUS FILTER */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <input
              className="form-input"
              style={{ flex: 1, minWidth: 200, maxWidth: 320 }}
              placeholder="Search resolutions..."
              value={decisionSearch}
              onChange={e => setDecisionSearch(e.target.value)}
            />
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {['all', ...DECISION_REGISTER_STATUSES].map(s => (
                <button
                  key={s}
                  onClick={() => setDecisionStatusFilter(s)}
                  style={{
                    fontSize: 11, borderRadius: 20, padding: '5px 12px', cursor: 'pointer', fontWeight: 500,
                    background: decisionStatusFilter === s ? 'var(--brand)' : 'var(--surface2)',
                    color: decisionStatusFilter === s ? '#fff' : 'var(--text2)',
                    border: decisionStatusFilter === s ? '1px solid var(--brand)' : '1px solid var(--border)',
                  }}
                >
                  {s === 'all' ? 'All Statuses' : s}
                </button>
              ))}
            </div>
          </div>

          {/* DECISION LIST */}
          {loading ? (
            <div className="loading">Loading decisions...</div>
          ) : filteredDecisions.length === 0 ? (
            <div className="empty-state">
              <div className="emoji">📜</div>
              <div>{allResolutions.length === 0 ? 'No resolutions recorded yet' : 'No resolutions match your search'}</div>
            </div>
          ) : (
            filteredDecisions.map(r => {
              const isSelected = selectedResolution?.id === r.id;
              const mtg = r.meetings;
              const mtc = mtg ? (MEETING_TYPE_COLORS[mtg.meeting_type] || { bg: '#f5f5f5', color: '#333' }) : { bg: '#f5f5f5', color: '#333' };
              const sc = RESOLUTION_STATUS_COLORS[r.status] || { bg: '#f5f5f5', color: '#666' };
              return (
                <div key={r.id} className="panel" style={{ marginBottom: 10 }}>
                  <div
                    style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer' }}
                    onClick={() => setSelectedResolution(isSelected ? null : r)}
                  >
                    <div style={{ width: 44, height: 44, borderRadius: 10, background: sc.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: sc.color, textTransform: 'uppercase', letterSpacing: '0.02em', textAlign: 'center', lineHeight: 1.2 }}>
                        {r.date_passed ? new Date(r.date_passed).toLocaleDateString('en-NZ', { month: 'short' }) : '—'}
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: sc.color, lineHeight: 1 }}>
                        {r.date_passed ? new Date(r.date_passed).getDate() : '—'}
                      </div>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {r.resolution_number && (
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {r.resolution_number}
                        </div>
                      )}
                      <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>{r.description}</div>
                      {mtg && (
                        <div style={{ fontSize: 12, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 10, borderRadius: 20, padding: '1px 8px', fontWeight: 600, background: mtc.bg, color: mtc.color }}>{mtg.meeting_type}</span>
                          <span>{mtg.title} · {fmt(mtg.meeting_date)}</span>
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                      <StatusBadge status={r.status} colors={RESOLUTION_STATUS_COLORS} />
                      <span style={{ fontSize: 18, color: 'var(--text3)', display: 'inline-block', transform: isSelected ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>›</span>
                    </div>
                  </div>

                  {isSelected && (
                    <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px', fontSize: 13, marginBottom: 14 }}>
                        {r.resolution_number && (
                          <div><span style={{ color: 'var(--text3)', fontWeight: 500 }}>Resolution No.: </span>{r.resolution_number}</div>
                        )}
                        <div><span style={{ color: 'var(--text3)', fontWeight: 500 }}>Date Passed: </span>{fmt(r.date_passed)}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ color: 'var(--text3)', fontWeight: 500 }}>Status: </span>
                          <StatusBadge status={r.status} colors={RESOLUTION_STATUS_COLORS} />
                        </div>
                        {mtg && (
                          <div><span style={{ color: 'var(--text3)', fontWeight: 500 }}>Meeting: </span>{mtg.title}</div>
                        )}
                      </div>
                      <div style={{ fontSize: 13, marginBottom: 12 }}>
                        <div style={{ color: 'var(--text3)', fontWeight: 500, marginBottom: 4 }}>Description</div>
                        <div style={{ lineHeight: 1.6 }}>{r.description}</div>
                      </div>
                      {r.notes && (
                        <div style={{ fontSize: 13, marginBottom: 12 }}>
                          <div style={{ color: 'var(--text3)', fontWeight: 500, marginBottom: 4 }}>Notes</div>
                          <div style={{ lineHeight: 1.6 }}>{r.notes}</div>
                        </div>
                      )}
                      {mtg && (
                        <button
                          onClick={() => {
                            const fullMeeting = meetings.find(m => m.id === mtg.id);
                            if (fullMeeting) { setSelectedMeeting(fullMeeting); setView('detail'); }
                          }}
                          style={{ fontSize: 12, color: 'var(--brand)', background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 12px', cursor: 'pointer' }}
                        >
                          View Full Meeting →
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </>
      )}
    </div>
  );
}
