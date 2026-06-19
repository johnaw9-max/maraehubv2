import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { sendNotification, getTrusteeEmails, bookingSubmittedBody } from '../lib/notify';

const OCCASIONS = [
  { val: 'Tangi', icon: '🕊️', sub: 'Tangihanga / Funeral' },
  { val: 'Wedding/Hakari', icon: '💍', sub: 'Celebration feast' },
  { val: 'Birthday', icon: '🎂', sub: 'Milestone celebration' },
  { val: 'Hui', icon: '🤝', sub: 'Community meeting' },
  { val: 'Fundraiser', icon: '🏆', sub: 'Charity / kaupapa event' },
  { val: 'Whanau Reunion', icon: '👨‍👩‍👧‍👦', sub: 'Family gathering' },
  { val: 'Facility Hire', icon: '🏛️', sub: 'Commercial facility rental' },
  { val: 'Other', icon: '✨', sub: 'Something else' },
];

const FACILITIES = ['Wharenui (main hall)', 'Wharekai (dining hall)', 'Kitchen / Kai preparation', 'Carpark access', 'Ūrupa access', 'AV / sound system'];

export default function BookingWizard({ profile, onBooked }) {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const [conflictMsg, setConflictMsg] = useState('');
  const [refNum, setRefNum] = useState('');

  const [form, setForm] = useState({
    occasion: '',
    startDate: '',
    endDate: '',
    guests: 50,
    overnight: false,
    facilities: [],
    notes: '',
  });

  function setField(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function toggleFacility(f) {
    setForm(prev => ({
      ...prev,
      facilities: prev.facilities.includes(f)
        ? prev.facilities.filter(x => x !== f)
        : [...prev.facilities, f]
    }));
  }

  async function checkAvailability() {
    if (!form.startDate) return true;
    setChecking(true);
    setConflictMsg('');
    const start = form.startDate;
    const end = form.endDate || form.startDate;

    // Check existing approved bookings for date overlap
    const { data: bookings } = await supabase
      .from('bookings')
      .select('start_date, end_date, occasion')
      .eq('status', 'approved');

    // Check blocked dates
    const { data: blocked } = await supabase
      .from('blocked_dates')
      .select('from_date, to_date, reason');

    setChecking(false);

    // Manual overlap check for bookings
    const conflictBooking = (bookings || []).find(b => {
      const bStart = b.start_date;
      const bEnd = b.end_date || b.start_date;
      return bStart && bEnd && start <= bEnd && end >= bStart;
    });

    // Manual overlap check for blocked dates
    const conflictBlock = (blocked || []).find(b => {
      return b.from_date && b.to_date && start <= b.to_date && end >= b.from_date;
    });

    if (conflictBlock) {
      setConflictMsg(`🚫 The marae is unavailable on these dates — ${conflictBlock.reason || 'blocked by the committee'}. Please select different dates.`);
      return false;
    }

    if (conflictBooking) {
      setConflictMsg(`🚫 The marae is already booked for a ${conflictBooking.occasion} on these dates. Please apply for another date.`);
      return false;
    }

    return true;
  }

  async function goToStep3() {
    const available = await checkAvailability();
    if (available) setStep(3);
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError('');

    // Final conflict check before submitting
    const available = await checkAvailability();
    if (!available) { setSubmitting(false); return; }

    const ref = 'MH-' + new Date().getFullYear() + '-' + Math.floor(Math.random() * 9000 + 1000);

    const { error } = await supabase.from('bookings').insert({
      user_id: profile.id,
      occasion: form.occasion,
      start_date: form.startDate || null,
      end_date: form.endDate || null,
      guests: parseInt(form.guests),
      overnight: form.overnight,
      facilities: form.facilities,
      notes: form.notes,
      status: 'pending',
      reference: ref,
    });

    if (error) {
      setError('Something went wrong: ' + error.message);
      setSubmitting(false);
      return;
    }

    // Notify trustees — fire and forget
    getTrusteeEmails().then(emails => {
      if (emails.length === 0) return;
      const booking = { occasion: form.occasion, start_date: form.startDate, end_date: form.endDate, guests: form.guests, overnight: form.overnight, notes: form.notes, reference: ref };
      sendNotification(emails, `New booking request — ${form.occasion} (${ref})`, bookingSubmittedBody(booking));
    });

    setRefNum(ref);
    setStep(4);
    setSubmitting(false);
  }

  function reset() {
    setStep(1);
    setForm({ occasion: '', startDate: '', endDate: '', guests: 50, overnight: false, facilities: [], notes: '' });
    setRefNum('');
    setError('');
    setConflictMsg('');
  }

  function formatDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  return (
    <div style={{ maxWidth: 700, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, marginBottom: 6 }}>Book the Marae</h1>
        <p style={{ color: 'var(--text3)', fontSize: 13 }}>Submit a booking request to the committee</p>
      </div>

      {/* PROGRESS */}
      {step < 4 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, marginBottom: 32 }}>
          {[1, 2, 3].map((s, i) => (
            <React.Fragment key={s}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: step > s ? 'var(--success)' : step === s ? 'var(--brand)' : 'var(--cream2)',
                  color: step >= s ? '#fff' : 'var(--text3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 600
                }}>
                  {step > s ? '✓' : s}
                </div>
                <span style={{ fontSize: 13, fontWeight: 500, color: step === s ? 'var(--brand)' : step > s ? 'var(--success)' : 'var(--text3)' }}>
                  {['Purpose', 'Dates & Guests', 'Review'][i]}
                </span>
              </div>
              {i < 2 && <div style={{ flex: 1, height: 2, background: step > s ? 'var(--success)' : 'var(--cream2)', margin: '0 12px', maxWidth: 80 }} />}
            </React.Fragment>
          ))}
        </div>
      )}

      {error && <div className="alert alert-error">{error}</div>}

      {/* STEP 1 — OCCASION */}
      {step === 1 && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 14, marginBottom: 28 }}>
            {OCCASIONS.map(o => (
              <div key={o.val} onClick={() => setField('occasion', o.val)}
                style={{
                  background: form.occasion === o.val ? '#eaf4f0' : 'var(--surface)',
                  border: `2px solid ${form.occasion === o.val ? 'var(--brand)' : 'var(--border)'}`,
                  borderRadius: 12, padding: '20px 16px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.15s'
                }}>
                <div style={{ fontSize: 28, marginBottom: 10 }}>{o.icon}</div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{o.val}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{o.sub}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn-primary" disabled={!form.occasion} onClick={() => setStep(2)} style={{ opacity: form.occasion ? 1 : 0.4 }}>
              Next: Dates & Guests →
            </button>
          </div>
        </>
      )}

      {/* STEP 2 — DATES & GUESTS */}
      {step === 2 && (
        <>
          <div className="panel" style={{ marginBottom: 16 }}>
            <div className="grid-2" style={{ marginBottom: 16 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Start Date</label>
                <input type="date" className="form-input" value={form.startDate}
                  onChange={e => { setField('startDate', e.target.value); setConflictMsg(''); }} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">End Date</label>
                <input type="date" className="form-input" value={form.endDate}
                  onChange={e => { setField('endDate', e.target.value); setConflictMsg(''); }} />
              </div>
            </div>

            {/* CONFLICT MESSAGE */}
            {conflictMsg && (
              <div style={{ background: '#faeae7', border: '1px solid #f0b8b0', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--danger)', marginBottom: 4 }}>Date Not Available</div>
                <div style={{ fontSize: 13, color: 'var(--text2)' }}>{conflictMsg}</div>
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              <label className="form-label">Expected Guests: <strong>{form.guests}</strong></label>
              <input type="range" min="10" max="400" step="10" value={form.guests}
                onChange={e => setField('guests', e.target.value)} style={{ width: '100%' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                <span>10</span><span>400</span>
              </div>
            </div>

            <div>
              <label className="form-label">Overnight Stay?</label>
              <div style={{ display: 'flex', gap: 10 }}>
                {[false, true].map(val => (
                  <div key={String(val)} onClick={() => setField('overnight', val)}
                    style={{
                      flex: 1, padding: 10, textAlign: 'center', cursor: 'pointer',
                      borderRadius: 8, fontWeight: 600, fontSize: 13,
                      border: `2px solid ${form.overnight === val ? 'var(--brand)' : 'var(--border)'}`,
                      color: form.overnight === val ? 'var(--brand)' : 'var(--text3)',
                      background: form.overnight === val ? 'var(--surface)' : 'var(--surface2)',
                    }}>
                    {val ? 'Yes – Overnight' : 'No – Day event'}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="panel" style={{ marginBottom: 20 }}>
            <label className="form-label">Facilities Needed</label>
            <div className="grid-2">
              {FACILITIES.map(f => (
                <label key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', background: 'var(--surface2)', fontSize: 13 }}>
                  <input type="checkbox" checked={form.facilities.includes(f)} onChange={() => toggleFacility(f)} />
                  {f}
                </label>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button className="btn-secondary" onClick={() => { setStep(1); setConflictMsg(''); }}>← Back</button>
            <button className="btn-primary" onClick={goToStep3} disabled={checking}>
              {checking ? 'Checking availability...' : 'Next: Review →'}
            </button>
          </div>
        </>
      )}

      {/* STEP 3 — REVIEW & SUBMIT */}
      {step === 3 && (
        <>
          <div className="panel" style={{ marginBottom: 16 }}>
            <label className="form-label">Additional Notes / Tikanga Considerations</label>
            <textarea className="form-input" rows={4} placeholder="Any special requirements or questions for the committee..."
              value={form.notes} onChange={e => setField('notes', e.target.value)} style={{ resize: 'vertical' }} />
          </div>

          <div style={{ background: 'var(--brand)', borderRadius: 12, padding: '20px 24px', marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>Booking Summary</div>
            <div className="grid-2" style={{ gap: 16 }}>
              {[
                ['Occasion', form.occasion],
                ['Guests', `${form.guests} guests`],
                ['Start Date', formatDate(form.startDate)],
                ['End Date', formatDate(form.endDate)],
                ['Overnight', form.overnight ? 'Yes' : 'No'],
                ['Facilities', form.facilities.length ? `${form.facilities.length} selected` : 'None selected'],
              ].map(([label, val]) => (
                <div key={label}>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{label}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{val}</div>
                </div>
              ))}
            </div>
          </div>

          {conflictMsg && (
            <div style={{ background: '#faeae7', border: '1px solid #f0b8b0', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--danger)', marginBottom: 4 }}>Date Not Available</div>
              <div style={{ fontSize: 13, color: 'var(--text2)' }}>{conflictMsg}</div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button className="btn-secondary" onClick={() => setStep(2)}>← Back</button>
            <button className="btn-accent" onClick={handleSubmit} disabled={submitting} style={{ padding: '13px 32px', fontSize: 15 }}>
              {submitting ? 'Submitting...' : 'Submit Booking Request ✓'}
            </button>
          </div>
        </>
      )}

      {/* STEP 4 — CONFIRMATION */}
      {step === 4 && (
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ width: 64, height: 64, background: '#e8f4ef', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 28 }}>✅</div>
          <h2 style={{ fontSize: 28, marginBottom: 10 }}>Ngā mihi nui!</h2>
          <p style={{ fontSize: 15, color: 'var(--text2)', marginBottom: 6 }}>Your booking request has been submitted.</p>
          <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 32 }}>The committee will review and confirm within 2–3 working days.</p>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, display: 'inline-block', textAlign: 'left', minWidth: 260, marginBottom: 28 }}>
            <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Reference Number</div>
            <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, fontWeight: 600, color: 'var(--brand)' }}>{refNum}</div>
          </div>
          <br />
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button className="btn-secondary" onClick={reset}>Make another booking</button>
            <button className="btn-primary" onClick={onBooked}>View my bookings →</button>
          </div>
        </div>
      )}
    </div>
  );
}
