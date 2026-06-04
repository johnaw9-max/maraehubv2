// MaraeHub Booking Exit Checklist
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

function fmt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function BookingChecklist({ booking, onClose }) {
  const [items, setItems] = useState([]);
  const [checklistId, setChecklistId] = useState(null);
  const [completed, setCompleted] = useState(false);
  const [completedAt, setCompletedAt] = useState(null);
  const [completedBy, setCompletedBy] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => { loadChecklist(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadChecklist() {
    setLoading(true);
    const [existingRes, templatesRes] = await Promise.all([
      supabase.from('booking_checklists').select('*').eq('booking_id', booking.id).maybeSingle(),
      supabase.from('checklist_templates').select('*').eq('active', true).order('sort_order', { ascending: true }),
    ]);

    if (existingRes.data) {
      const cl = existingRes.data;
      setChecklistId(cl.id);
      setItems(cl.items || []);
      setCompleted(cl.completed || false);
      setCompletedAt(cl.completed_at || null);
      setCompletedBy(cl.completed_by || '');
      setNotes(cl.notes || '');
    } else {
      const templates = templatesRes.data || [];
      setItems(templates.map(t => ({ id: t.id, label: t.label, checked: false, notes: '' })));
    }
    setLoading(false);
  }

  function toggleItem(idx) {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, checked: !item.checked } : item));
  }

  function setItemNote(idx, val) {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, notes: val } : item));
  }

  async function handleSave(markComplete) {
    setSaving(true); setError(''); setSuccess('');
    const now = new Date().toISOString();
    const payload = {
      booking_id: booking.id,
      items,
      notes,
      completed: markComplete,
      completed_at: markComplete ? now : null,
      completed_by: completedBy || null,
    };

    let err;
    if (checklistId) {
      ({ error: err } = await supabase.from('booking_checklists').update(payload).eq('id', checklistId));
    } else {
      const { data, error: insertErr } = await supabase.from('booking_checklists').insert(payload).select().single();
      err = insertErr;
      if (data) setChecklistId(data.id);
    }

    if (err) { setError(err.message); setSaving(false); return; }
    if (markComplete) { setCompleted(true); setCompletedAt(now); }
    setSuccess(markComplete ? 'Checklist marked as completed.' : 'Progress saved.');
    setSaving(false);
    setTimeout(() => setSuccess(''), 3000);
  }

  const checkedCount = items.filter(i => i.checked).length;

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 18, fontWeight: 600 }}>Exit Checklist</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{booking.occasion} · {fmt(booking.end_date || booking.start_date)}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text3)', lineHeight: 1 }}>×</button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        {completed && (
          <div style={{ background: '#e8f4ef', border: '1px solid #b2d8c4', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#1a4a3a' }}>
            ✓ Completed {completedAt ? fmt(completedAt) : ''}
            {completedBy ? ` by ${completedBy}` : ''}
          </div>
        )}

        {loading ? <div className="loading">Loading checklist...</div> : (
          <>
            {items.length === 0 ? (
              <div className="empty-state" style={{ padding: '20px 0' }}>
                <div className="emoji">📋</div>
                <div>No checklist items. Add items in Settings → Checklist Template.</div>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12 }}>
                  {checkedCount} of {items.length} items completed
                </div>
                <div style={{ height: 4, background: 'var(--cream2)', borderRadius: 2, overflow: 'hidden', marginBottom: 20 }}>
                  <div style={{ height: '100%', width: `${items.length ? (checkedCount / items.length) * 100 : 0}%`, background: 'var(--brand)', borderRadius: 2, transition: 'width 0.3s' }} />
                </div>

                {items.map((item, idx) => (
                  <div
                    key={idx}
                    style={{ padding: '12px 14px', background: item.checked ? '#e8f4ef' : 'var(--surface2)', border: `1px solid ${item.checked ? '#b2d8c4' : 'var(--border)'}`, borderRadius: 8, marginBottom: 8 }}
                  >
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={() => toggleItem(idx)}
                        style={{ marginTop: 2, accentColor: 'var(--brand)', width: 16, height: 16, flexShrink: 0 }}
                        disabled={completed}
                      />
                      <span style={{ fontSize: 13, fontWeight: item.checked ? 400 : 500, textDecoration: item.checked ? 'line-through' : 'none', color: item.checked ? 'var(--text3)' : 'var(--text1)' }}>
                        {item.label}
                      </span>
                    </label>
                    {item.checked && !completed && (
                      <input
                        className="form-input"
                        style={{ marginTop: 8, marginLeft: 26, fontSize: 12 }}
                        placeholder="Add a note (optional)..."
                        value={item.notes}
                        onChange={e => setItemNote(idx, e.target.value)}
                      />
                    )}
                    {item.checked && item.notes && completed && (
                      <div style={{ marginTop: 4, marginLeft: 26, fontSize: 12, color: 'var(--text3)', fontStyle: 'italic' }}>{item.notes}</div>
                    )}
                  </div>
                ))}
              </>
            )}

            <div style={{ marginTop: 16 }}>
              <div className="form-group">
                <label className="form-label">Completed by</label>
                <input
                  className="form-input"
                  value={completedBy}
                  onChange={e => setCompletedBy(e.target.value)}
                  placeholder="Your name"
                  disabled={completed}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Overall notes</label>
                <textarea
                  className="form-input"
                  rows={3}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Any overall notes about the booking exit..."
                  style={{ resize: 'vertical' }}
                  disabled={completed}
                />
              </div>
            </div>

            {!completed && (
              <div className="modal-actions">
                <button className="btn-secondary" onClick={onClose}>Close</button>
                <button className="btn-secondary" onClick={() => handleSave(false)} disabled={saving}>{saving ? 'Saving...' : 'Save Progress'}</button>
                <button className="btn-primary" onClick={() => handleSave(true)} disabled={saving || checkedCount === 0}>
                  {saving ? 'Saving...' : '✓ Mark Completed'}
                </button>
              </div>
            )}
            {completed && (
              <div style={{ textAlign: 'right', marginTop: 16 }}>
                <button className="btn-secondary" onClick={onClose}>Close</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
