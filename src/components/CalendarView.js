import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const EMPTY_BLOCK = { from_date: '', to_date: '', reason: '' };

export default function CalendarView({ isTrustee }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [bookings, setBookings] = useState([]);
  const [blocked, setBlocked] = useState([]);
  const [showBlockForm, setShowBlockForm] = useState(false);
  const [form, setForm] = useState(EMPTY_BLOCK);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);

  useEffect(() => { fetchData(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchData() {
    const [bookRes, blockRes] = await Promise.all([
      supabase.from('bookings').select('start_date, end_date, occasion, status').eq('status', 'approved'),
      supabase.from('blocked_dates').select('*').order('from_date'),
    ]);
    setBookings(bookRes.data || []);
    setBlocked(blockRes.data || []);
  }

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
    setSelected(null);
  }

  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
    setSelected(null);
  }

  function dateStr(y, m, d) {
    return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  function isBlocked(ds) { return blocked.some(b => ds >= b.from_date && ds <= b.to_date); }
  function isBooked(ds) { return bookings.some(b => b.start_date <= ds && b.end_date >= ds); }
  function getBlockedInfo(ds) { return blocked.find(b => ds >= b.from_date && ds <= b.to_date); }
  function getBookingInfo(ds) { return bookings.find(b => b.start_date <= ds && b.end_date >= ds); }

  function getDayInfo(ds) {
    if (isBlocked(ds)) return { type: 'blocked', info: getBlockedInfo(ds) };
    if (isBooked(ds)) return { type: 'booked', info: getBookingInfo(ds) };
    return { type: 'free', info: null };
  }

  async function handleBlock() {
    if (!form.from_date) { setError('Please select a start date'); return; }
    setSaving(true); setError('');
    const { error } = await supabase.from('blocked_dates').insert({
      from_date: form.from_date,
      to_date: form.to_date || form.from_date,
      reason: form.reason.trim() || 'Blocked',
    });
    if (error) { setError(error.message); setSaving(false); return; }
    setForm(EMPTY_BLOCK);
    setShowBlockForm(false);
    setSaving(false);
    fetchData();
  }

  async function handleRemoveBlock(id) {
    if (!window.confirm('Remove this blocked date?')) return;
    await supabase.from('blocked_dates').delete().eq('id', id);
    fetchData();
  }

  function formatDate(d) {
    if (!d) return '';
    return new Date(d + 'T12:00:00').toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function setField(k, v) { setForm(f => ({ ...f, [k]: v })); }

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date().toISOString().split('T')[0];

  const DAY_STYLES = {
    blocked: { background: '#faeae7', border: '1px solid #f0b8b0' },
    booked: { background: '#e8f4ef', border: '1px solid #a8d8c0' },
    free: { background: '#fff', border: '1px solid transparent' },
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 22 }}>Calendar</h2>
          <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>Bookings and blocked dates</p>
        </div>
        {isTrustee && (
          <button style={{ background: 'var(--danger)', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
            onClick={() => { setShowBlockForm(true); setError(''); setForm(EMPTY_BLOCK); }}>
            Block Dates
          </button>
        )}
      </div>

      {isTrustee && showBlockForm && (
        <div className="panel" style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontFamily: 'Playfair Display, serif', fontWeight: 600, marginBottom: 16 }}>Block Dates</div>
          {error && <div className="alert alert-error">{error}</div>}
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">From Date *</label>
              <input type="date" className="form-input" value={form.from_date} onChange={e => setField('from_date', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">To Date</label>
              <input type="date" className="form-input" value={form.to_date} onChange={e => setField('to_date', e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Reason</label>
            <input className="form-input" value={form.reason} onChange={e => setField('reason', e.target.value)} placeholder="e.g. Maintenance, Private event" />
          </div>
          <div className="modal-actions">
            <button className="btn-secondary" onClick={() => setShowBlockForm(false)}>Cancel</button>
            <button style={{ background: 'var(--danger)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
              onClick={handleBlock} disabled={saving}>{saving ? 'Saving...' : 'Block Dates'}</button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <button onClick={prevMonth} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 18, color: 'var(--brand)' }}>‹</button>
        <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, fontWeight: 600 }}>{MONTHS[month]} {year}</div>
        <button onClick={nextMonth} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 18, color: 'var(--brand)' }}>›</button>
      </div>

      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: 'var(--brand)' }}>
          {DAYS.map(d => (
            <div key={d} style={{ padding: '8px 4px', textAlign: 'center', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.06em' }}>{d}</div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`empty-${i}`} style={{ minHeight: 64, borderRight: '0.5px solid var(--border)', borderBottom: '0.5px solid var(--border)', background: '#fafaf8' }} />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const d = i + 1;
            const ds = dateStr(year, month, d);
            const { type, info } = getDayInfo(ds);
            const isToday = ds === today;
            const isSelected = selected === ds;
            return (
              <div key={d}
                onClick={() => setSelected(isSelected ? null : ds)}
                style={{
                  minHeight: 64, padding: 6, cursor: 'pointer',
                  borderRight: '0.5px solid var(--border)', borderBottom: '0.5px solid var(--border)',
                  ...DAY_STYLES[type],
                  outline: isSelected ? '2px solid var(--brand)' : isToday ? '2px solid var(--accent)' : 'none',
                  outlineOffset: -2,
                }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: isToday ? 'var(--brand)' : 'var(--text2)', marginBottom: 4 }}>{d}</div>
                {type === 'booked' && <div style={{ fontSize: 9, fontWeight: 600, background: '#e8f4ef', color: '#1a4a3a', borderRadius: 3, padding: '1px 4px' }}>{info?.occasion?.split('/')[0]}</div>}
                {type === 'blocked' && <div style={{ fontSize: 9, fontWeight: 600, background: '#faeae7', color: '#a63020', borderRadius: 3, padding: '1px 4px' }}>Blocked</div>}
              </div>
            );
          })}
        </div>
      </div>

      {selected && (() => {
        const { type, info } = getDayInfo(selected);
        return (
          <div className="panel" style={{ marginBottom: 16, borderLeft: `4px solid ${type === 'blocked' ? 'var(--danger)' : type === 'booked' ? 'var(--success)' : 'var(--border)'}` }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{formatDate(selected)}</div>
            {type === 'booked' && <div style={{ fontSize: 13, color: 'var(--text2)' }}>📅 Booked — {info.occasion}</div>}
            {type === 'blocked' && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 13, color: 'var(--text2)' }}>🚫 Blocked — {info.reason}</div>
                {isTrustee && <button onClick={() => handleRemoveBlock(info.id)} style={{ fontSize: 12, color: 'var(--danger)', background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 10px', cursor: 'pointer' }}>Remove</button>}
              </div>
            )}
            {type === 'free' && <div style={{ fontSize: 13, color: 'var(--text3)' }}>Available for booking</div>}
          </div>
        );
      })()}

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
        {[['#e8f4ef', '#a8d8c0', 'Approved booking'], ['#faeae7', '#f0b8b0', 'Blocked date'], ['#fff', 'var(--border)', 'Available']].map(([bg, border, label]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text2)' }}>
            <div style={{ width: 14, height: 14, borderRadius: 3, background: bg, border: `1px solid ${border}` }} />
            {label}
          </div>
        ))}
      </div>

      {isTrustee && blocked.length > 0 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Blocked Dates</div>
          {blocked.map(b => (
            <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#fff', border: '1px solid var(--border)', borderLeft: '3px solid var(--danger)', borderRadius: 8, padding: '10px 14px', marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{b.reason}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>{formatDate(b.from_date)}{b.to_date !== b.from_date ? ` → ${formatDate(b.to_date)}` : ''}</div>
              </div>
              <button onClick={() => handleRemoveBlock(b.id)} style={{ fontSize: 12, color: 'var(--danger)', background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>Remove</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
