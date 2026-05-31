import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function BookingsManager({ isTrustee, userId }) {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => { fetchBookings(); }, [filter]);

  async function fetchBookings() {
    setLoading(true);
    let query = supabase.from('bookings').select('*').order('created_at', { ascending: false });
    if (!isTrustee && userId) query = query.eq('user_id', userId);
    if (filter !== 'all') query = query.eq('status', filter);
    const { data, error } = await query;
    if (!error) setBookings(data || []);
    setLoading(false);
  }

  async function updateStatus(id, status) {
    const { error } = await supabase.from('bookings').update({ status }).eq('id', id);
    if (!error) fetchBookings();
  }

  function formatDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  const filters = isTrustee
    ? ['all', 'pending', 'approved', 'declined']
    : ['all', 'pending', 'approved', 'declined'];

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
          {bookings.map(b => (
            <div key={b.id} className="panel" style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
              <div style={{ background: 'var(--brand)', borderRadius: 10, padding: '8px 12px', textAlign: 'center', minWidth: 52 }}>
                <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, color: '#fff', lineHeight: 1 }}>
                  {b.start_date ? new Date(b.start_date).getDate() : '—'}
                </div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase' }}>
                  {b.start_date ? new Date(b.start_date).toLocaleString('en-NZ', { month: 'short' }) : ''}
                </div>
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{b.occasion}</div>
                  <span className={`badge badge-${b.status}`}>{b.status}</span>
                  {b.reference && <span style={{ fontSize: 11, color: 'var(--text3)' }}>{b.reference}</span>}
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

              {isTrustee && b.status === 'pending' && (
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button className="btn-success" onClick={() => updateStatus(b.id, 'approved')}>✓ Approve</button>
                  <button className="btn-danger" onClick={() => updateStatus(b.id, 'declined')}>✗ Decline</button>
                </div>
              )}

              {isTrustee && b.status !== 'pending' && (
                <div style={{ flexShrink: 0 }}>
                  <button onClick={() => updateStatus(b.id, 'pending')}
                    style={{ fontSize: 11, color: 'var(--text3)', background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>
                    Reset
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
