import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import BookingChecklist from './BookingChecklist';
import BookingFeedback from './BookingFeedback';
import BookingInvoice from './BookingInvoice';
import { sendNotification, bookingStatusBody, bookingConfirmedBody } from '../lib/notify';
import StatusPill from './StatusPill';

const BOOKING_STATUSES = ['pending', 'approved', 'declined'];

const ADD_OCCASIONS = ['Tangi', 'Wedding/Hakari', 'Birthday', 'Hui', 'Fundraiser', 'Whanau Reunion', 'Other'];
const ADD_FACILITIES = ['Wharenui (main hall)', 'Wharekai (dining hall)', 'Kitchen / Kai preparation', 'Carpark access', 'Ūrupa access', 'AV / sound system'];

function isPast(booking) {
  const d = booking.end_date || booking.start_date;
  return d && new Date(d) < new Date();
}

function StarDisplay({ rating }) {
  if (!rating) return null;
  return (
    <span style={{ fontSize: 12, color: '#f4a400', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
      {'★'.repeat(Math.round(rating))}{'☆'.repeat(5 - Math.round(rating))}
      <span style={{ color: 'var(--text3)', marginLeft: 2 }}>{Number(rating).toFixed(1)}</span>
    </span>
  );
}

export default function BookingsManager({ isTrustee, canApprove, userId, onStartWorkflow }) {
  const [bookings, setBookings] = useState([]);
  const [feedback, setFeedback] = useState({});
  const [checklists, setChecklists] = useState({});
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [checklistBooking, setChecklistBooking] = useState(null);
  const [feedbackBooking, setFeedbackBooking] = useState(null);
  const [invoiceBooking, setInvoiceBooking] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ occasion:'', startDate:'', endDate:'', guests:50, overnight:false, facilities:[], notes:'', contactName:'', contactPhone:'', contactEmail:'' });
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState('');

  useEffect(() => { fetchBookings(); }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchBookings() {
    setLoading(true);
    const [bookingRes, tplRes] = await Promise.all([
      (() => {
        let q = supabase.from('bookings').select('*').order('created_at', { ascending: false });
        if (!isTrustee && userId) q = q.eq('user_id', userId);
        if (filter !== 'all') q = q.eq('status', filter);
        return q;
      })(),
      supabase.from('workflow_templates').select('id, name').order('name'),
    ]);
    if (bookingRes.error) { setLoading(false); return; }
    const rows = bookingRes.data || [];
    setBookings(rows);
    setTemplates(tplRes.data || []);
    if (rows.length > 0) await fetchMeta(rows.map(b => b.id));
    setLoading(false);
  }

  async function fetchMeta(ids) {
    const [fbRes, clRes] = await Promise.all([
      supabase.from('booking_feedback').select('booking_id, rating_overall').in('booking_id', ids),
      supabase.from('booking_checklists').select('booking_id, completed').in('booking_id', ids),
    ]);
    const fbMap = {};
    (fbRes.data || []).forEach(f => { fbMap[f.booking_id] = f; });
    setFeedback(fbMap);
    const clMap = {};
    (clRes.data || []).forEach(c => { clMap[c.booking_id] = c; });
    setChecklists(clMap);
  }

  async function ensureFinanceIncomeForBooking(booking) {
    const { data: existing } = await supabase
      .from('finance_income')
      .select('id')
      .eq('source_type', 'booking')
      .eq('source_id', booking.id)
      .maybeSingle();
    if (existing) return;
    await supabase.from('finance_income').insert({
      date: booking.start_date || new Date().toISOString().split('T')[0],
      description: `Booking income — ${booking.occasion}`,
      amount: 0,
      category: 'Booking Income',
      status: 'Pending',
      source_type: 'booking',
      source_id: booking.id,
      notes: 'Auto-created on approval — update amount to record hire fee',
    });
  }

  async function updateStatus(booking, status) {
    const { error } = await supabase.from('bookings').update({ status }).eq('id', booking.id);
    if (error) return;
    // Notify the booking submitter when approved or declined — fire and forget
    if ((status === 'approved' || status === 'declined') && booking.user_id) {
      supabase.from('profiles').select('email').eq('id', booking.user_id).maybeSingle()
        .then(({ data }) => {
          if (data?.email) {
            if (status === 'approved') {
              sendNotification(
                data.email,
                `Booking Confirmed — ${booking.reference || booking.occasion}`,
                bookingConfirmedBody(booking),
              );
            } else {
              sendNotification(data.email, `Your booking has been declined — ${booking.occasion}`, bookingStatusBody(booking, status));
            }
          }
        });
    }
    if (status === 'approved') {
      await ensureFinanceIncomeForBooking(booking);
    } else if (status === 'declined' || status === 'cancelled') {
      await supabase
        .from('finance_income')
        .delete()
        .eq('source_type', 'booking')
        .eq('source_id', booking.id)
        .eq('amount', 0);
    }
    fetchBookings();
  }

  function formatDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  async function deleteBooking(booking) {
    if (!window.confirm(`Permanently delete the booking for "${booking.occasion}"? This cannot be undone.`)) return;
    await supabase.from('bookings').delete().eq('id', booking.id);
    fetchBookings();
  }

  function handleFeedbackSubmitted(bookingId, rating) {
    setFeedback(prev => ({ ...prev, [bookingId]: { booking_id: bookingId, rating_overall: rating } }));
  }

  function openAddModal() {
    setAddForm({ occasion:'', startDate:'', endDate:'', guests:50, overnight:false, facilities:[], notes:'', contactName:'', contactPhone:'', contactEmail:'' });
    setAddError('');
    setShowAddModal(true);
  }

  function setAddField(k, v) { setAddForm(f => ({ ...f, [k]: v })); }

  function toggleAddFacility(f) {
    setAddForm(prev => ({
      ...prev,
      facilities: prev.facilities.includes(f) ? prev.facilities.filter(x => x !== f) : [...prev.facilities, f],
    }));
  }

  async function handleAddBooking() {
    if (!addForm.occasion || !addForm.startDate || !addForm.endDate) {
      setAddError('Occasion, start date, and end date are required.');
      return;
    }
    setAddSaving(true);
    setAddError('');
    const ref = 'MH-' + new Date().getFullYear() + '-' + Math.floor(Math.random() * 9000 + 1000);
    const { data: newBooking, error } = await supabase.from('bookings').insert({
      user_id: null,
      occasion: addForm.occasion,
      start_date: addForm.startDate,
      end_date: addForm.endDate,
      guests: parseInt(addForm.guests) || 0,
      overnight: addForm.overnight,
      facilities: addForm.facilities,
      notes: addForm.notes || null,
      contact_name: addForm.contactName || null,
      contact_phone: addForm.contactPhone || null,
      contact_email: addForm.contactEmail || null,
      status: canApprove ? 'approved' : 'pending',
      reference: ref,
    }).select().single();
    setAddSaving(false);
    if (error) { setAddError('Something went wrong: ' + error.message); return; }
    if (newBooking?.status === 'approved') {
      await ensureFinanceIncomeForBooking(newBooking);
    }
    setShowAddModal(false);
    fetchBookings();
  }

  const filters = ['all', 'pending', 'approved', 'declined'];

  const facilityHireTpl = isTrustee && onStartWorkflow
    ? templates.find(t => /facility hire/i.test(t.name))
    : null;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2 style={{ fontSize: 22 }}>{isTrustee ? 'Booking Requests' : 'My Bookings'}</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {filters.map(f => (
            <button key={f} onClick={() => setFilter(f)}
              style={{
                padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                border: '1px solid var(--border)', cursor: 'pointer', textTransform: 'capitalize',
                background: filter === f ? 'var(--brand)' : 'var(--surface)',
                color: filter === f ? '#fff' : 'var(--text2)',
              }}>
              {f}
            </button>
          ))}
          {isTrustee && (
            <button className="btn-primary" onClick={openAddModal} style={{ marginLeft: 8 }}>+ Add Booking</button>
          )}
        </div>
      </div>


      {loading ? (
        <div className="loading">Loading bookings...</div>
      ) : bookings.length === 0 ? (
        <div className="empty-state">
          <div className="emoji">📅</div>
          <div>No bookings found</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {bookings.map(b => {
            const past = isPast(b);
            const fb = feedback[b.id];
            const cl = checklists[b.id];
            const showChecklist = isTrustee && b.status === 'approved' && past;
            const showFeedback = !isTrustee && b.status === 'approved' && past && !fb;
            const checklistDone = cl?.completed;

            return (
              <div key={b.id} className="panel" style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                <div style={{ background: past ? 'var(--text3)' : 'var(--brand)', borderRadius: 10, padding: '8px 12px', textAlign: 'center', minWidth: 52, flexShrink: 0 }}>
                  <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, color: '#fff', lineHeight: 1 }}>
                    {b.start_date ? new Date(b.start_date).getDate() : '—'}
                  </div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase' }}>
                    {b.start_date ? new Date(b.start_date).toLocaleString('en-NZ', { month: 'short' }) : ''}
                  </div>
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                    <div style={{ fontSize: 15, fontWeight: 600 }}>{b.occasion}</div>
                    <StatusPill
                      status={b.status}
                      options={canApprove ? BOOKING_STATUSES : undefined}
                      onStatusChange={canApprove ? s => updateStatus(b, s) : undefined}
                    />
                    {b.reference && <span style={{ fontSize: 11, color: 'var(--text3)' }}>{b.reference}</span>}
                    {fb && <StarDisplay rating={fb.rating_overall} />}
                  </div>
                  <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text3)', flexWrap: 'wrap' }}>
                    <span>📅 {formatDate(b.start_date)} → {formatDate(b.end_date)}</span>
                    <span>👥 {b.guests} guests</span>
                    <span>🌙 {b.overnight ? 'Overnight' : 'Day event'}</span>
                  </div>
                  {b.notes && <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 6, fontStyle: 'italic' }}>"{b.notes}"</div>}
                  {b.facilities && b.facilities.length > 0 && (
                    <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {b.facilities.map(f => (
                        <span key={f} style={{ fontSize: 10, background: 'var(--cream)', border: '1px solid var(--border)', borderRadius: 20, padding: '2px 8px', color: 'var(--text2)' }}>{f}</span>
                      ))}
                    </div>
                  )}
                  {facilityHireTpl && b.status === 'approved' && (
                    <button
                      onClick={() => onStartWorkflow({
                        templateId: facilityHireTpl.id,
                        workflowName: `${facilityHireTpl.name} — ${b.occasion}${b.reference ? ` (${b.reference})` : ''}`,
                        sourceName: `Booking: ${b.occasion}${b.start_date ? ` on ${b.start_date}` : ''}`,
                        triggerType: 'booking',
                      })}
                      style={{ marginTop: 8, background: 'none', color: 'var(--brand)', border: '1px solid var(--brand)', borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
                      🏛️ Commercial or external hire? Start Facility Hire Agreement Workflow →
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0, alignItems: 'flex-end' }}>
                  {canApprove && b.status === 'pending' && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn-success" onClick={() => updateStatus(b, 'approved')}>✓ Approve</button>
                      <button className="btn-danger" onClick={() => updateStatus(b, 'declined')}>✗ Decline</button>
                    </div>
                  )}
                  {canApprove && b.status !== 'pending' && (
                    <button onClick={() => updateStatus(b, 'pending')}
                      style={{ fontSize: 11, color: 'var(--text3)', background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>
                      Reset
                    </button>
                  )}
                  {canApprove && (
                    <button onClick={() => deleteBooking(b)}
                      style={{ fontSize: 11, color: '#c0392b', background: 'none', border: '1px solid #e8b4b0', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>
                      🗑 Delete
                    </button>
                  )}
                  {isTrustee && b.status === 'approved' && (
                    <button
                      onClick={() => setInvoiceBooking(b)}
                      style={{ fontSize: 11, color: 'var(--brand)', background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}
                    >
                      🧾 Invoice
                    </button>
                  )}
                  {showChecklist && (
                    <button
                      onClick={() => setChecklistBooking(b)}
                      style={{
                        fontSize: 11, borderRadius: 6, padding: '4px 10px', cursor: 'pointer',
                        background: checklistDone ? '#e8f4ef' : 'none',
                        color: checklistDone ? '#1a4a3a' : 'var(--brand)',
                        border: `1px solid ${checklistDone ? '#b2d8c4' : 'var(--border)'}`,
                        fontWeight: checklistDone ? 600 : 400,
                      }}
                    >
                      {checklistDone ? '✓ Checklist' : '☐ Checklist'}
                    </button>
                  )}
                  {showFeedback && (
                    <button
                      onClick={() => setFeedbackBooking(b)}
                      style={{ fontSize: 11, color: 'var(--brand)', background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}
                    >
                      ★ Leave Feedback
                    </button>
                  )}
                  {!isTrustee && fb && (
                    <button
                      onClick={() => setFeedbackBooking(b)}
                      style={{ fontSize: 11, color: 'var(--text3)', background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}
                    >
                      View Feedback
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {checklistBooking && (
        <BookingChecklist
          booking={checklistBooking}
          onClose={() => { setChecklistBooking(null); fetchBookings(); }}
        />
      )}

      {feedbackBooking && (
        <BookingFeedback
          booking={feedbackBooking}
          userId={userId}
          onClose={() => setFeedbackBooking(null)}
          onSubmitted={handleFeedbackSubmitted}
        />
      )}

      {invoiceBooking && (
        <BookingInvoice
          booking={invoiceBooking}
          onClose={() => setInvoiceBooking(null)}
        />
      )}

      {showAddModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowAddModal(false)}>
          <div className="modal">
            <div className="modal-title">Add Booking</div>
            {addError && <div className="alert alert-error">{addError}</div>}

            <div className="form-group">
              <label className="form-label">Occasion *</label>
              <select className="form-input" value={addForm.occasion} onChange={e => setAddField('occasion', e.target.value)}>
                <option value="" disabled>Select an occasion</option>
                {ADD_OCCASIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Start Date *</label>
                <input type="date" className="form-input" value={addForm.startDate} onChange={e => setAddField('startDate', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">End Date *</label>
                <input type="date" className="form-input" value={addForm.endDate} onChange={e => setAddField('endDate', e.target.value)} />
              </div>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Contact Name</label>
                <input className="form-input" value={addForm.contactName} onChange={e => setAddField('contactName', e.target.value)} placeholder="Who is this booking for?" />
              </div>
              <div className="form-group">
                <label className="form-label">Contact Phone</label>
                <input className="form-input" value={addForm.contactPhone} onChange={e => setAddField('contactPhone', e.target.value)} placeholder="Optional" />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Contact Email</label>
              <input type="email" className="form-input" value={addForm.contactEmail} onChange={e => setAddField('contactEmail', e.target.value)} placeholder="For sending an invoice" />
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Guests</label>
                <input type="number" min="0" className="form-input" value={addForm.guests} onChange={e => setAddField('guests', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Overnight?</label>
                <select className="form-input" value={addForm.overnight ? 'yes' : 'no'} onChange={e => setAddField('overnight', e.target.value === 'yes')}>
                  <option value="no">No – Day event</option>
                  <option value="yes">Yes – Overnight</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Facilities Needed</label>
              <div className="grid-2">
                {ADD_FACILITIES.map(f => (
                  <label key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', background: 'var(--surface2)', fontSize: 13 }}>
                    <input type="checkbox" checked={addForm.facilities.includes(f)} onChange={() => toggleAddFacility(f)} />
                    {f}
                  </label>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea className="form-input" rows={3} value={addForm.notes} onChange={e => setAddField('notes', e.target.value)} style={{ resize: 'vertical' }} />
            </div>

            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleAddBooking} disabled={addSaving}>{addSaving ? 'Saving...' : 'Add Booking'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
