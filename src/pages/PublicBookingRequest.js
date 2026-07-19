import React, { useState } from 'react';
import { supabase, supabaseAnonKey } from '../lib/supabase';

const OCCASIONS = ['Tangi', 'Wedding/Hakari', 'Birthday', 'Hui', 'Fundraiser', 'Whanau Reunion', 'Other'];
const FACILITIES = ['Wharenui (main hall)', 'Wharekai (dining hall)', 'Kitchen / Kai preparation', 'Carpark access', 'Ūrupa access', 'AV / sound system'];

export default function PublicBookingRequest() {
  const [form, setForm] = useState({
    occasion: '', startDate: '', endDate: '', guests: 50, overnight: false,
    facilities: [], notes: '', contactName: '', contactPhone: '', contactEmail: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [refNum, setRefNum] = useState('');
  const [submitted, setSubmitted] = useState(false);

  function setField(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function toggleFacility(f) {
    setForm(prev => ({
      ...prev,
      facilities: prev.facilities.includes(f) ? prev.facilities.filter(x => x !== f) : [...prev.facilities, f],
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.occasion || !form.startDate || !form.endDate) { setError('Occasion, start date, and end date are required.'); return; }
    if (!form.contactName.trim()) { setError('Please enter a contact name.'); return; }
    setSubmitting(true);
    setError('');
    const { data, error: fnError } = await supabase.functions.invoke('public-booking-request', {
      body: { ...form },
      headers: { Authorization: `Bearer ${supabaseAnonKey}` },
    });
    setSubmitting(false);
    if (fnError || data?.error) { setError(data?.error || fnError.message); return; }
    setRefNum(data.reference);
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ background: 'var(--surface)', borderRadius: 20, padding: '40px 36px', width: '100%', maxWidth: 420, textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, background: '#e8f4ef', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 28 }}>✅</div>
          <h2 style={{ fontSize: 24, marginBottom: 10 }}>Ngā mihi nui!</h2>
          <p style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 6 }}>Your booking request has been submitted.</p>
          <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 24 }}>The committee will review and confirm within 2–3 working days.</p>
          <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, display: 'inline-block' }}>
            <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Reference Number</div>
            <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, fontWeight: 600, color: 'var(--brand)' }}>{refNum}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--brand)', padding: '40px 20px', display: 'flex', justifyContent: 'center' }}>
      <div style={{ background: 'var(--surface)', borderRadius: 20, padding: '36px 32px', width: '100%', maxWidth: 560, height: 'fit-content' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <h1 style={{ fontSize: 24, marginBottom: 4 }}>Book the Marae</h1>
          <p style={{ color: 'var(--text3)', fontSize: 13 }}>Submit a booking request to the committee</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Occasion *</label>
            <select className="form-input" value={form.occasion} onChange={e => setField('occasion', e.target.value)} required>
              <option value="" disabled>Select an occasion</option>
              {OCCASIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Start Date *</label>
              <input type="date" className="form-input" value={form.startDate} onChange={e => setField('startDate', e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">End Date *</label>
              <input type="date" className="form-input" value={form.endDate} onChange={e => setField('endDate', e.target.value)} required />
            </div>
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Contact Name *</label>
              <input className="form-input" value={form.contactName} onChange={e => setField('contactName', e.target.value)} placeholder="Your name" required />
            </div>
            <div className="form-group">
              <label className="form-label">Contact Phone</label>
              <input className="form-input" value={form.contactPhone} onChange={e => setField('contactPhone', e.target.value)} placeholder="Optional" />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Contact Email</label>
            <input type="email" className="form-input" value={form.contactEmail} onChange={e => setField('contactEmail', e.target.value)} placeholder="So we can send you an invoice" />
          </div>

          <div className="form-group">
            <label className="form-label">Expected Guests: <strong>{form.guests}</strong></label>
            <input type="range" min="10" max="400" step="10" value={form.guests} onChange={e => setField('guests', e.target.value)} style={{ width: '100%' }} />
          </div>

          <div className="form-group">
            <label className="form-label">Overnight Stay?</label>
            <div style={{ display: 'flex', gap: 10 }}>
              {[false, true].map(val => (
                <div key={String(val)} onClick={() => setField('overnight', val)}
                  style={{
                    flex: 1, padding: 10, textAlign: 'center', cursor: 'pointer', borderRadius: 8, fontWeight: 600, fontSize: 13,
                    border: `2px solid ${form.overnight === val ? 'var(--brand)' : 'var(--border)'}`,
                    color: form.overnight === val ? 'var(--brand)' : 'var(--text3)',
                    background: form.overnight === val ? 'var(--surface)' : 'var(--surface2)',
                  }}>
                  {val ? 'Yes – Overnight' : 'No – Day event'}
                </div>
              ))}
            </div>
          </div>

          <div className="form-group">
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

          <div className="form-group">
            <label className="form-label">Additional Notes / Tikanga Considerations</label>
            <textarea className="form-input" rows={3} maxLength={500} value={form.notes} onChange={e => setField('notes', e.target.value)} placeholder="Any special requirements or questions for the committee..." style={{ resize: 'vertical' }} />
          </div>

          <button type="submit" className="btn-accent" disabled={submitting} style={{ width: '100%', padding: '13px', fontSize: 15, marginTop: 8 }}>
            {submitting ? 'Submitting...' : 'Submit Booking Request ✓'}
          </button>
        </form>
      </div>
    </div>
  );
}
