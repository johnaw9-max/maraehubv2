import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { loadUnavailable } from '../lib/unavailableDates';
import { REPEAT_OPTIONS, MAX_REPEATS, clampCount, buildEventRows } from '../lib/repeatMeetings';

// Add Event is switched on per app with REACT_APP_CALENDAR_EVENTS=on (needs the calendar_events table).
const EVENTS_ON = process.env.REACT_APP_CALENDAR_EVENTS === 'on';
const EMPTY_EVENT = { title: '', event_date: '', end_date: '', note: '', repeat: 'none', repeat_count: 4 };

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const EMPTY_BLOCK = { from_date: '', to_date: '', reason: '' };

// ─── TRUSTEE EVENT TYPES ──────────────────────────────────────────────────────

const EVENT_TYPES = {
  project:  { label: 'Project Due',       icon: '📋', dot: '#1a4a8a', bg: '#e8eef8', text: '#1a4a8a', border: '#b8c8e8' },
  reminder: { label: 'Service Reminder',  icon: '🔧', dot: '#c8902a', bg: '#fdf0dc', text: '#7a4f00', border: '#e8c880' },
  task:     { label: 'Task Due',           icon: '✅', dot: '#6b42a8', bg: '#f0ecf8', text: '#6b42a8', border: '#c8b8e8' },
  grant:    { label: 'Grant Deadline',     icon: '💰', dot: '#2d6e57', bg: '#e8f4ef', text: '#2d6e57', border: '#a8d8c0' },
  meeting:  { label: 'Meeting',            icon: '🏛️', dot: '#1a6a5a', bg: '#e0f0ec', text: '#1a6a5a', border: '#90c8bc' },
  event:    { label: 'Event',              icon: '🗓️', dot: '#b5541c', bg: '#fdeee3', text: '#8a3d10', border: '#f0c3a3' },
};

const TAB_FOR_EVENT = {
  project:  'projects',
  reminder: 'assets',
  task:     'tasks',
  grant:    'grants',
  meeting:  'minutes',
};

export default function CalendarView({ isTrustee }) {
  const now = new Date();
  const [year, setYear]     = useState(now.getFullYear());
  const [month, setMonth]   = useState(now.getMonth());
  const [bookings, setBookings]   = useState([]);
  const [blocked, setBlocked]     = useState([]);
  const [projects, setProjects]           = useState([]);
  const [serviceReminders, setServiceReminders] = useState([]);
  const [tasks, setTasks]                 = useState([]);
  const [grants, setGrants]               = useState([]);
  const [meetings, setMeetings]           = useState([]);
  const [calEvents, setCalEvents]         = useState([]);
  const [showEventForm, setShowEventForm] = useState(false);
  const [eventForm, setEventForm]         = useState(EMPTY_EVENT);
  const [editEventId, setEditEventId]    = useState(null);
  const [showBlockForm, setShowBlockForm] = useState(false);
  const [form, setForm]   = useState(EMPTY_BLOCK);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');
  const [selected, setSelected] = useState(null);
  const [maraeName, setMaraeName]   = useState('');
  const [maraeEmail, setMaraeEmail] = useState('');
  const [maraePhone, setMaraePhone] = useState('');
  const [copiedId, setCopiedId]     = useState(null);

  useEffect(() => { fetchData(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchData() {
    if (isTrustee) {
      const [bookRes, blockRes, projRes, remRes, taskRes, grantRes, meetRes, settingsRes] = await Promise.all([
        supabase.from('bookings').select('start_date, end_date, occasion, status').eq('status', 'approved'),
        supabase.from('blocked_dates').select('*').order('from_date'),
        supabase.from('projects').select('name, due_date'),
        supabase.from('service_reminders').select('type, due_date'),
        supabase.from('tasks').select('title, due_date').neq('status', 'cancelled').neq('status', 'completed'),
        supabase.from('grants').select('name, deadline'),
        supabase.from('meetings').select('title, meeting_date'),
        supabase.from('marae_settings').select('marae_name, email, phone').maybeSingle(),
      ]);
      if (projRes.error)  console.error('[CalendarView] projects:', projRes.error);
      if (taskRes.error) {
        if (taskRes.status === 404 || taskRes.error.code === 'PGRST200') {
          // PostgREST schema cache stale — run in Supabase SQL editor:
          //   NOTIFY pgrst, 'reload schema';
          console.warn('[CalendarView] tasks table not visible to PostgREST. Run in Supabase SQL editor: NOTIFY pgrst, \'reload schema\';');
        } else {
          console.error('[CalendarView] tasks:', taskRes.error);
        }
      }
      if (grantRes.error) console.error('[CalendarView] grants:', grantRes.error);
      if (meetRes.error)  console.error('[CalendarView] meetings:', meetRes.error);
      setBookings(bookRes.data || []);
      setBlocked(blockRes.data || []);
      setProjects(projRes.data || []);
      setServiceReminders(remRes.data || []);
      setTasks(taskRes.data || []);
      setGrants(grantRes.data || []);
      setMeetings(meetRes.data || []);
      if (EVENTS_ON) {
        const evRes = await supabase.from('calendar_events').select('*').order('event_date');
        if (evRes.error) console.error('[CalendarView] calendar_events:', evRes.error);
        setCalEvents(evRes.data || []);
      }
      setMaraeName(settingsRes.data?.marae_name || '');
      setMaraeEmail(settingsRes.data?.email || '');
      setMaraePhone(settingsRes.data?.phone || '');
    } else {
      // Community members cannot read the bookings or blocked_dates tables directly (that is
      // what left this calendar empty). The same dates-only function the booking form uses
      // returns the taken dates with no names, occasions or reasons.
      const ranges = await loadUnavailable(supabase);
      setBookings(ranges.filter(r => r.kind === 'booked')
        .map(r => ({ start_date: r.from, end_date: r.to, occasion: 'Booked', status: 'approved' })));
      setBlocked(ranges.filter(r => r.kind === 'blocked')
        .map(r => ({ from_date: r.from, to_date: r.to, reason: 'Not available for booking' })));
    }
  }

  // ─── DATE HELPERS ────────────────────────────────────────────────────────────

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

  function formatDate(d) {
    if (!d) return '';
    return new Date(d + 'T12:00:00').toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function normaliseDate(val) {
    if (!val) return null;
    return val.includes('T') ? val.split('T')[0] : val;
  }

  function isBlocked(ds) { return blocked.some(b => ds >= b.from_date && ds <= b.to_date); }
  function isBooked(ds)  { return bookings.some(b => b.start_date <= ds && b.end_date >= ds); }
  function getBlockedInfo(ds) { return blocked.find(b => ds >= b.from_date && ds <= b.to_date); }
  function getBookingInfo(ds) { return bookings.find(b => b.start_date <= ds && b.end_date >= ds); }

  function getTrusteeEvents(ds) {
    if (!isTrustee) return [];
    const evs = [];
    projects.forEach(p => {
      if (normaliseDate(p.due_date) === ds)
        evs.push({ type: 'project', name: p.name });
    });
    serviceReminders.forEach(r => {
      if (normaliseDate(r.due_date) === ds)
        evs.push({ type: 'reminder', name: r.type || 'Service Reminder' });
    });
    tasks.forEach(t => {
      if (normaliseDate(t.due_date) === ds)
        evs.push({ type: 'task', name: t.title });
    });
    grants.forEach(g => {
      if (normaliseDate(g.deadline) === ds)
        evs.push({ type: 'grant', name: g.name });
    });
    meetings.forEach(m => {
      if (normaliseDate(m.meeting_date) === ds)
        evs.push({ type: 'meeting', name: m.title });
    });
    calEvents.forEach(e => {
      if (ds >= e.event_date && ds <= (e.end_date || e.event_date))
        evs.push({ type: 'event', name: e.note ? `${e.title} — ${e.note}` : e.title, id: e.id, raw: e });
    });
    return evs;
  }

  // ─── BLOCK DATE ACTIONS ───────────────────────────────────────────────────────

  async function handleBlock() {
    if (!form.from_date) { setError('Please select a start date'); return; }
    setSaving(true); setError('');
    const { error: err } = await supabase.from('blocked_dates').insert({
      from_date: form.from_date,
      to_date: form.to_date || form.from_date,
      reason: form.reason.trim() || 'Blocked',
    });
    if (err) { setError(err.message); setSaving(false); return; }
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

  function setField(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function setEventField(k, v) { setEventForm(f => ({ ...f, [k]: v })); }

  async function handleSaveEvent() {
    if (!eventForm.title.trim()) { setError('Please give the event a title'); return; }
    if (!eventForm.event_date) { setError('Please choose a date'); return; }
    if (eventForm.end_date && eventForm.end_date < eventForm.event_date) { setError('The end date cannot be before the start date'); return; }
    setSaving(true); setError('');
    if (editEventId) {
      // Edit changes this one date only. Other dates of a repeating event are separate and stay as they are.
      const { error: upErr } = await supabase.from('calendar_events').update({
        title: eventForm.title.trim(),
        event_date: eventForm.event_date,
        end_date: eventForm.end_date || null,
        note: eventForm.note.trim() || null,
      }).eq('id', editEventId);
      if (upErr) { setError(upErr.message); setSaving(false); return; }
      setEditEventId(null); setEventForm(EMPTY_EVENT); setShowEventForm(false); setSaving(false);
      fetchData();
      return;
    }
    const rows = buildEventRows({
      title: eventForm.title, note: eventForm.note, date: eventForm.event_date, endDate: eventForm.end_date,
      repeat: eventForm.repeat, count: clampCount(eventForm.repeat_count),
    }).filter((r, i) => i === 0 || !calEvents.some(e => e.title === r.title && e.event_date === r.event_date));
    const { error: err } = await supabase.from('calendar_events').insert(rows);
    if (err) { setError(err.message); setSaving(false); return; }
    setEventForm(EMPTY_EVENT);
    setShowEventForm(false);
    setSaving(false);
    fetchData();
  }

  function handleEditEvent(e) {
    setEditEventId(e.id);
    setEventForm({ title: e.title || '', event_date: e.event_date || '', end_date: e.end_date || '', note: e.note || '', repeat: 'none', repeat_count: 4 });
    setShowEventForm(true); setShowBlockForm(false); setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleRemoveEvent(id) {
    if (!window.confirm('Remove this event? Other dates of a repeating event stay.')) return;
    await supabase.from('calendar_events').delete().eq('id', id);
    fetchData();
  }

  function copyToFacebook(id, text) {
    const finish = () => { setCopiedId(id); setTimeout(() => setCopiedId(null), 2000); };
    if (navigator.clipboard) { navigator.clipboard.writeText(text).then(finish); }
    else {
      const el = document.createElement('textarea');
      el.value = text; document.body.appendChild(el); el.select();
      document.execCommand('copy'); document.body.removeChild(el); finish();
    }
  }

  function buildEventFbText(name, ds) {
    const contact = [maraeEmail, maraePhone].filter(Boolean).join(' or ');
    const parts = [`📅 ${name}`, `🕐 ${formatDate(ds)}`];
    if (contact) parts.push(`For bookings or enquiries contact us at ${contact}`);
    parts.push(`— ${maraeName || 'Our Marae'}`);
    return parts.join('\n');
  }

  // ─── SELECTED DAY DATA ────────────────────────────────────────────────────────
  // Computed here (not inside JSX IIFE) so React tracks them normally.

  const dayBookingInfo = selected ? getBookingInfo(selected) : null;
  const dayBlockedInfo = selected ? getBlockedInfo(selected) : null;
  const dayTevents     = selected ? getTrusteeEvents(selected) : [];
  const dayHasAny      = !!(dayBookingInfo || dayBlockedInfo || dayTevents.length > 0);

  // ─── CALENDAR GRID ────────────────────────────────────────────────────────────

  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today       = new Date().toISOString().split('T')[0];

  const DAY_STYLES = {
    blocked: { background: '#faeae7', border: '1px solid #f0b8b0' },
    booked:  { background: '#e8f4ef', border: '1px solid #a8d8c0' },
    free:    { background: '#fff',    border: '1px solid transparent' },
  };

  return (
    <div>
      {/* ── PAGE HEADER ────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 22 }}>Calendar</h2>
          <p style={{ fontSize: 14, color: 'var(--text3)', marginTop: 4 }}>
            {isTrustee ? 'All events — bookings, projects, tasks, grants, meetings & services' : 'Bookings and blocked dates'}
          </p>
        </div>
        {isTrustee && (
          <div style={{ display: 'flex', gap: 8 }}>
            {EVENTS_ON && (
              <button
                data-testid="add-event"
                style={{ background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
                onClick={() => { setEditEventId(null); setShowEventForm(true); setShowBlockForm(false); setError(''); setEventForm(EMPTY_EVENT); }}
              >
                + Add Event
              </button>
            )}
            <button
              style={{ background: 'var(--danger)', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
              onClick={() => { setShowBlockForm(true); setShowEventForm(false); setError(''); setForm(EMPTY_BLOCK); }}
            >
              Block Dates
            </button>
          </div>
        )}
      </div>

      {/* ── ADD EVENT FORM ─────────────────────────────────────────────────── */}
      {EVENTS_ON && isTrustee && showEventForm && (
        <div className="panel" style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontFamily: 'Playfair Display, serif', fontWeight: 600, marginBottom: 16 }}>{editEventId ? 'Edit Event' : 'Add Event'}</div>
          {error && <div className="alert alert-error">{error}</div>}
          <div className="form-group">
            <label className="form-label">Title *</label>
            <input className="form-input" value={eventForm.title} onChange={e => setEventField('title', e.target.value)} placeholder="e.g. Working bee, Kapa haka practice" />
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Date *</label>
              <input type="date" className="form-input" value={eventForm.event_date} onChange={e => setEventField('event_date', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Last day (if more than one day)</label>
              <input type="date" className="form-input" value={eventForm.end_date} onChange={e => setEventField('end_date', e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Note</label>
            <input className="form-input" value={eventForm.note} onChange={e => setEventField('note', e.target.value)} placeholder="e.g. Bring gloves. Kai provided." />
          </div>
          {!editEventId && (
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Repeat</label>
              <select className="form-input" value={eventForm.repeat} onChange={e => setEventField('repeat', e.target.value)}>
                {REPEAT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            {eventForm.repeat !== 'none' && (
              <div className="form-group">
                <label className="form-label">How many in total (up to {MAX_REPEATS})</label>
                <input type="number" min={2} max={MAX_REPEATS} className="form-input" value={eventForm.repeat_count} onChange={e => setEventField('repeat_count', e.target.value)} />
              </div>
            )}
          </div>
          )}
          {editEventId && (
            <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 10 }}>This changes this one date only. Other dates of a repeating event stay as they are.</div>
          )}
          <div className="modal-actions">
            <button className="btn-secondary" onClick={() => { setShowEventForm(false); setEditEventId(null); }}>Cancel</button>
            <button className="btn-primary" onClick={handleSaveEvent} disabled={saving}>{saving ? 'Saving...' : editEventId ? 'Save Changes' : 'Add Event'}</button>
          </div>
        </div>
      )}

      {/* ── BLOCK DATES FORM ───────────────────────────────────────────────── */}
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
            <button
              style={{ background: 'var(--danger)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
              onClick={handleBlock} disabled={saving}
            >{saving ? 'Saving...' : 'Block Dates'}</button>
          </div>
        </div>
      )}

      {/* ── MONTH NAV ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <button onClick={prevMonth} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 18, color: 'var(--brand)' }}>‹</button>
        <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, fontWeight: 600 }}>{MONTHS[month]} {year}</div>
        <button onClick={nextMonth} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 18, color: 'var(--brand)' }}>›</button>
      </div>

      {/* ── CALENDAR GRID ──────────────────────────────────────────────────── */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden', marginBottom: 16 }}>
        {/* Day headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: 'var(--brand)' }}>
          {DAYS.map(d => (
            <div key={d} style={{ padding: '8px 4px', textAlign: 'center', fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.06em' }}>{d}</div>
          ))}
        </div>

        {/* Day cells */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`e-${i}`} style={{ minHeight: 72, borderRight: '0.5px solid var(--border)', borderBottom: '0.5px solid var(--border)', background: '#fafaf8' }} />
          ))}

          {Array.from({ length: daysInMonth }).map((_, i) => {
            const d  = i + 1;
            const ds = dateStr(year, month, d);
            const blocked_ = isBlocked(ds);
            const booked_  = isBooked(ds);
            const type     = blocked_ ? 'blocked' : booked_ ? 'booked' : 'free';
            const isToday  = ds === today;
            const isSel    = selected === ds;
            const tevents  = getTrusteeEvents(ds);

            // Unique event types for dots
            const dotTypes = [...new Set(tevents.map(e => e.type))];

            return (
              <div
                key={d}
                onClick={() => setSelected(isSel ? null : ds)}
                style={{
                  minHeight: 72, padding: '6px 6px 4px', cursor: 'pointer',
                  borderRight: '0.5px solid var(--border)', borderBottom: '0.5px solid var(--border)',
                  display: 'flex', flexDirection: 'column',
                  ...DAY_STYLES[type],
                  outline: isSel ? '2px solid var(--brand)' : isToday ? '2px solid var(--accent)' : 'none',
                  outlineOffset: -2,
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 600, color: isToday ? 'var(--brand)' : 'var(--text2)', marginBottom: 3 }}>{d}</div>

                {booked_ && (
                  <div style={{ fontSize: 14, fontWeight: 600, background: '#e8f4ef', color: '#1a4a3a', borderRadius: 3, padding: '2px 6px', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {getBookingInfo(ds)?.occasion?.split('/')[0]}
                  </div>
                )}
                {blocked_ && (
                  <div style={{ fontSize: 14, fontWeight: 600, background: '#faeae7', color: '#a63020', borderRadius: 3, padding: '2px 6px', marginBottom: 2 }}>
                    Blocked
                  </div>
                )}

                {/* Trustee event dots */}
                {isTrustee && dotTypes.length > 0 && (
                  <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 'auto', paddingTop: 3 }}>
                    {dotTypes.map(type => {
                      const et = EVENT_TYPES[type];
                      const count = tevents.filter(e => e.type === type).length;
                      return (
                        <div
                          key={type}
                          title={`${count} ${et.label}${count > 1 ? 's' : ''}`}
                          style={{
                            width: 7, height: 7, borderRadius: '50%',
                            background: et.dot, flexShrink: 0,
                          }}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── SELECTED DAY PANEL ─────────────────────────────────────────────── */}
      {selected && (
        <div
          className="panel"
          style={{ marginBottom: 16, pointerEvents: 'auto' }}
        >
          <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 15, fontWeight: 600, marginBottom: 12, color: 'var(--text1)' }}>
            {formatDate(selected)}
          </div>

          {!dayHasAny && (
            <div style={{ fontSize: 14, color: 'var(--text3)', padding: '4px 0' }}>Available for booking</div>
          )}

          {dayBlockedInfo && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: '#faeae7', borderRadius: 8, border: '1px solid #f0b8b0', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 16 }}>🚫</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--danger)', marginBottom: 2 }}>Blocked</div>
                  <div style={{ fontSize: 14, color: 'var(--text2)' }}>{dayBlockedInfo.reason}</div>
                </div>
              </div>
              {isTrustee && (
                <button onClick={() => handleRemoveBlock(dayBlockedInfo.id)} style={{ fontSize: 14, color: 'var(--danger)', background: 'none', border: '1px solid #f0b8b0', borderRadius: 6, padding: '4px 11px', cursor: 'pointer' }}>
                  Remove
                </button>
              )}
            </div>
          )}

          {dayBookingInfo && (
            <div style={{ padding: '10px 12px', background: '#e8f4ef', borderRadius: 8, border: '1px solid #a8d8c0', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 16 }}>📅</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#1a4a3a', marginBottom: 2 }}>Approved Booking</div>
                <div style={{ fontSize: 14, color: 'var(--text2)' }}>{dayBookingInfo.occasion}</div>
              </div>
              {isTrustee && (
                <>
                  <button
                    type="button"
                    onClick={() => copyToFacebook('bk', buildEventFbText(dayBookingInfo.occasion, selected))}
                    style={{ fontSize: 14, fontWeight: 700, color: '#1a4a3a', background: copiedId === 'bk' ? '#d4edda' : 'none', border: '1px solid #a8d8c0', borderRadius: 6, padding: '4px 11px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >
                    {copiedId === 'bk' ? 'Copied ✅' : '📋 Copy to Facebook'}
                  </button>
                  <button
                    type="button"
                    onClick={() => window.dispatchEvent(new CustomEvent('marae:navigate', { detail: 'bookings' }))}
                    style={{ fontSize: 14, fontWeight: 700, color: '#1a4a3a', background: 'none', border: '1px solid #a8d8c0', borderRadius: 6, padding: '4px 11px', cursor: 'pointer' }}
                  >
                    View →
                  </button>
                </>
              )}
            </div>
          )}

          {dayTevents.map((ev, idx) => {
            const et    = EVENT_TYPES[ev.type];
            const tab   = TAB_FOR_EVENT[ev.type];
            const cpId  = `ev-${idx}`;
            return (
              <div
                key={idx}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                  padding: '10px 12px', background: et.bg, borderRadius: 8,
                  border: `1px solid ${et.border}`, marginBottom: 8,
                }}
              >
                <span style={{ fontSize: 15 }}>{et.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: et.text, marginBottom: 2 }}>{et.label}</div>
                  <div style={{ fontSize: 14, color: 'var(--text2)' }}>{ev.name}</div>
                </div>
                {ev.type === 'event' && (
                  <button
                    type="button"
                    data-testid="edit-event"
                    onClick={() => handleEditEvent(ev.raw)}
                    style={{ fontSize: 14, fontWeight: 700, color: et.text, background: 'none', border: `1px solid ${et.border}`, borderRadius: 6, padding: '4px 11px', cursor: 'pointer' }}
                  >
                    Edit
                  </button>
                )}
                {ev.type === 'event' && (
                  <button
                    type="button"
                    onClick={() => handleRemoveEvent(ev.id)}
                    style={{ fontSize: 14, color: 'var(--danger)', background: 'none', border: '1px solid #f0b8b0', borderRadius: 6, padding: '4px 11px', cursor: 'pointer' }}
                  >
                    Remove
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => copyToFacebook(cpId, buildEventFbText(ev.name, selected))}
                  style={{ fontSize: 14, fontWeight: 700, color: et.text, background: copiedId === cpId ? '#d4edda' : 'none', border: `1px solid ${et.border}`, borderRadius: 6, padding: '4px 11px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  {copiedId === cpId ? 'Copied ✅' : '📋 Copy to Facebook'}
                </button>
                {tab && (
                  <button
                    type="button"
                    onClick={() => window.dispatchEvent(new CustomEvent('marae:navigate', { detail: tab }))}
                    style={{
                      fontSize: 14, fontWeight: 700, color: et.text,
                      background: 'none', border: `1px solid ${et.border}`,
                      borderRadius: 6, padding: '3px 10px', cursor: 'pointer',
                    }}
                  >
                    View →
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── LEGEND ─────────────────────────────────────────────────────────── */}
      <div className="panel" style={{ marginBottom: 16, padding: '14px 18px' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>Legend</div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {/* Base legend — all users */}
          {[
            { bg: '#e8f4ef', border: '#a8d8c0', label: 'Approved Booking' },
            { bg: '#faeae7', border: '#f0b8b0', label: 'Blocked Date' },
            { bg: '#fff',    border: 'var(--border)', label: 'Available' },
          ].map(({ bg, border, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, color: 'var(--text2)' }}>
              <div style={{ width: 13, height: 13, borderRadius: 3, background: bg, border: `1px solid ${border}`, flexShrink: 0 }} />
              {label}
            </div>
          ))}

          {/* Trustee-only dot legend */}
          {isTrustee && (
            <>
              <div style={{ width: 1, background: 'var(--border)', height: 18, alignSelf: 'center' }} />
              {Object.entries(EVENT_TYPES).map(([key, et]) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, color: 'var(--text2)' }}>
                  <div style={{ width: 9, height: 9, borderRadius: '50%', background: et.dot, flexShrink: 0 }} />
                  {et.label}
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* ── BLOCKED DATES LIST ─────────────────────────────────────────────── */}
      {isTrustee && blocked.length > 0 && (
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text2)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Blocked Dates</div>
          {blocked.map(b => (
            <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#fff', border: '1px solid var(--border)', borderLeft: '3px solid var(--danger)', borderRadius: 8, padding: '10px 14px', marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{b.reason}</div>
                <div style={{ fontSize: 14, color: 'var(--text3)' }}>
                  {formatDate(b.from_date)}{b.to_date !== b.from_date ? ` → ${formatDate(b.to_date)}` : ''}
                </div>
              </div>
              <button onClick={() => handleRemoveBlock(b.id)} style={{ fontSize: 14, color: 'var(--danger)', background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 12px', cursor: 'pointer' }}>Remove</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
