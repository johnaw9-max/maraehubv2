// MaraeHub Booking Feedback
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

function fmt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });
}

function StarRating({ value, onChange, disabled }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <span
          key={n}
          onClick={() => !disabled && onChange(n)}
          onMouseEnter={() => !disabled && setHovered(n)}
          onMouseLeave={() => !disabled && setHovered(0)}
          style={{
            fontSize: 28, cursor: disabled ? 'default' : 'pointer', lineHeight: 1,
            color: n <= (hovered || value) ? '#f4a400' : '#ddd',
            transition: 'color 0.1s',
          }}
        >
          ★
        </span>
      ))}
      {value > 0 && (
        <span style={{ fontSize: 13, color: 'var(--text3)', alignSelf: 'center', marginLeft: 4 }}>
          {value}/5
        </span>
      )}
    </div>
  );
}

export default function BookingFeedback({ booking, userId, onClose, onSubmitted }) {
  const [existing, setExisting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const [ratingOverall, setRatingOverall] = useState(0);
  const [ratingCleanliness, setRatingCleanliness] = useState(0);
  const [ratingFacilities, setRatingFacilities] = useState(0);
  const [experience, setExperience] = useState('');
  const [wouldReturn, setWouldReturn] = useState(null);
  const [suggestions, setSuggestions] = useState('');

  useEffect(() => { loadExisting(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadExisting() {
    setLoading(true);
    const { data } = await supabase
      .from('booking_feedback')
      .select('*')
      .eq('booking_id', booking.id)
      .maybeSingle();

    if (data) {
      setExisting(data);
      setRatingOverall(data.rating_overall || 0);
      setRatingCleanliness(data.rating_cleanliness || 0);
      setRatingFacilities(data.rating_facilities || 0);
      setExperience(data.experience || '');
      setWouldReturn(data.would_return);
      setSuggestions(data.suggestions || '');
      setSubmitted(true);
    }
    setLoading(false);
  }

  async function handleSubmit() {
    if (ratingOverall === 0) { setError('Please select an overall rating'); return; }
    setSaving(true); setError('');

    const payload = {
      booking_id: booking.id,
      user_id: userId,
      rating_overall: ratingOverall,
      rating_cleanliness: ratingCleanliness || null,
      rating_facilities: ratingFacilities || null,
      experience: experience.trim() || null,
      would_return: wouldReturn,
      suggestions: suggestions.trim() || null,
    };

    const { error } = await supabase.from('booking_feedback').insert(payload);
    if (error) { setError(error.message); setSaving(false); return; }
    setSubmitted(true);
    setSaving(false);
    if (onSubmitted) onSubmitted(booking.id, ratingOverall);
  }

  const disabled = submitted;

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 500, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 18, fontWeight: 600 }}>
              {submitted && existing ? 'Your Feedback' : 'Leave Feedback'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
              {booking.occasion} · {fmt(booking.end_date || booking.start_date)}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text3)', lineHeight: 1 }}>×</button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {loading ? <div className="loading">Loading...</div> : (
          <>
            {submitted && (
              <div style={{ background: '#e8f4ef', border: '1px solid #b2d8c4', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#1a4a3a' }}>
                ✓ Feedback submitted — ngā mihi!
              </div>
            )}

            {/* OVERALL RATING */}
            <div className="form-group">
              <label className="form-label" style={{ marginBottom: 8 }}>Overall Rating *</label>
              <StarRating value={ratingOverall} onChange={setRatingOverall} disabled={disabled} />
            </div>

            {/* CLEANLINESS */}
            <div className="form-group">
              <label className="form-label" style={{ marginBottom: 8 }}>Cleanliness</label>
              <StarRating value={ratingCleanliness} onChange={setRatingCleanliness} disabled={disabled} />
            </div>

            {/* FACILITIES */}
            <div className="form-group">
              <label className="form-label" style={{ marginBottom: 8 }}>Facilities</label>
              <StarRating value={ratingFacilities} onChange={setRatingFacilities} disabled={disabled} />
            </div>

            {/* WOULD YOU RETURN */}
            <div className="form-group">
              <label className="form-label">Would you use the marae again?</label>
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                {[{ val: true, label: 'Yes' }, { val: false, label: 'No' }].map(opt => (
                  <button
                    key={String(opt.val)}
                    onClick={() => !disabled && setWouldReturn(opt.val)}
                    disabled={disabled}
                    style={{
                      padding: '8px 24px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                      cursor: disabled ? 'default' : 'pointer',
                      background: wouldReturn === opt.val ? (opt.val ? 'var(--brand)' : 'var(--danger)') : 'var(--surface2)',
                      color: wouldReturn === opt.val ? '#fff' : 'var(--text2)',
                      border: `1px solid ${wouldReturn === opt.val ? (opt.val ? 'var(--brand)' : 'var(--danger)') : 'var(--border)'}`,
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* EXPERIENCE */}
            <div className="form-group">
              <label className="form-label">Overall experience</label>
              <textarea
                className="form-input"
                rows={3}
                value={experience}
                onChange={e => setExperience(e.target.value)}
                placeholder="Tell us about your experience..."
                style={{ resize: 'vertical' }}
                disabled={disabled}
              />
            </div>

            {/* SUGGESTIONS */}
            <div className="form-group">
              <label className="form-label">Suggestions for improvement</label>
              <textarea
                className="form-input"
                rows={2}
                value={suggestions}
                onChange={e => setSuggestions(e.target.value)}
                placeholder="Any suggestions? (optional)"
                style={{ resize: 'vertical' }}
                disabled={disabled}
              />
            </div>

            <div className="modal-actions">
              <button className="btn-secondary" onClick={onClose}>
                {submitted ? 'Close' : 'Cancel'}
              </button>
              {!submitted && (
                <button className="btn-primary" onClick={handleSubmit} disabled={saving || ratingOverall === 0}>
                  {saving ? 'Submitting...' : 'Submit Feedback'}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
