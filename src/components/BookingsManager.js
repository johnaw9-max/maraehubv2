import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import BookingChecklist from './BookingChecklist';
import BookingFeedback from './BookingFeedback';
import { sendNotification, bookingStatusBody } from '../lib/notify';
import StatusPill from './StatusPill';

const BOOKING_STATUSES = ['pending', 'approved', 'declined'];

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

export default function BookingsManager({ isTrustee, userId }) {
  const [bookings, setBookings] = useState([]);
  const [feedback, setFeedback] = useState({});
  const [checklists, setChecklists] = useState({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [checklistBooking, setChecklistBooking] = useState(null);
  const [feedbackBooking, setFeedbackBooking] = useState(null);

  useEffect(() => { fetchBookings(); }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchBookings() {
    setLoading(true);
    let query = supabase.from('bookings').select('*').order('created_at', { ascending: false });
    if (!isTrustee && userId) query = query.eq('user_id', userId);
    if (filter !== 'all') query = query.eq('status', filter);
    const { data, error } = await query;
    if (error) { setLoading(false); return; }
    const rows = data || [];
    setBookings(rows);
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

  async function updateStatus(booking, status) {
    const { error } = await supabase.from('bookings').update({ status }).eq('id', booking.id);
    if (error) return;
    // Notify the booking submitter when approved or declined — fire and forget
    if ((status === 'approved' || status === 'declined') && booking.user_id) {
      supabase.from('profiles').select('email').eq('id', booking.user_id).maybeSingle()
        .then(({ data }) => {
          if (data?.email) {
            const label = status === 'approved' ? 'approved' : 'declined';
            sendNotification(data.email, `Your booking has been ${label} — ${booking.occasion}`, bookingStatusBody(booking, status));
          }
        });
    }
    fetchBookings();
  }

  function formatDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function handleFeedbackSubmitted(bookingId, rating) {
    setFeedback(prev => ({ ...prev, [bookingId]: { booking_id: bookingId, rating_overall: rating } }));
  }

  const filters = ['all', 'pending', 'approved', 'declined'];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2 style={{ fontSize: 22 }}>{isTrustee ? 'Booking Requests' : 'My Bookings'}</h2>
        <div style={{ display: 'flex', gap: 8 }}>
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
                      options={isTrustee ? BOOKING_STATUSES : undefined}
                      onStatusChange={isTrustee ? s => updateStatus(b, s) : undefined}
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
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0, alignItems: 'flex-end' }}>
                  {isTrustee && b.status === 'pending' && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn-success" onClick={() => updateStatus(b, 'approved')}>✓ Approve</button>
                      <button className="btn-danger" onClick={() => updateStatus(b, 'declined')}>✗ Decline</button>
                    </div>
                  )}
                  {isTrustee && b.status !== 'pending' && (
                    <button onClick={() => updateStatus(b, 'pending')}
                      style={{ fontSize: 11, color: 'var(--text3)', background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>
                      Reset
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
    </div>
  );
}
