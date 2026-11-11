import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { sendNotification, getTrusteeEmails } from '../lib/notify';
import { occasionsFor } from '../lib/bookingOccasions';
import { endDateAfterStartChange } from '../lib/bookingDates';
import { editNeedsReapproval, validateBookingEdit } from '../lib/bookingRules';
import { loadUnavailable, firstClash } from '../lib/unavailableDates';
import { logAudit } from '../lib/audit';

const FACILITIES = ['Wharenui (main hall)', 'Wharekai (dining hall)', 'Kitchen / Kai preparation', 'Carpark access', 'Ūrupa access', 'AV / sound system'];

const fmt = d => (d ? new Date(d + 'T12:00:00').toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

/**
 * Lets a community member edit their own booking.
 * An approved booking goes back to "pending" so the trustees approve the change.
 * Only the fields the member controls are sent; status is set to 'pending' and
 * nothing else (reference, owner and entity cannot be changed from here, and
 * the database refuses it too).
 */
export default function BookingEditModal({ booking, onClose, onSaved, asTrustee = false }) {
  // A trustee edits in place: the status stays as it is and nobody is asked to re-approve.
  const reapproval = !asTrustee && editNeedsReapproval(booking);
  const [form, setForm] = useState({
    occasion: booking.occasion || '',
    startDate: booking.start_date || '',
    endDate: booking.end_date || booking.start_date || '',
    guests: booking.guests ?? 50,
    overnight: !!booking.overnight,
    facilities: booking.facilities || [],
    notes: booking.notes || '',
    organisation: booking.organisation || '',
    contactName: booking.contact_name || '',
    contactPhone: booking.contact_phone || '',
    contactEmail: booking.contact_email || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const toggleFacility = f => setForm(prev => ({
    ...prev,
    facilities: prev.facilities.includes(f) ? prev.facilities.filter(x => x !== f) : [...prev.facilities, f],
  }));

  async function handleSave() {
    const problem = validateBookingEdit(form);
    if (problem) { setError(problem); return; }
    if (reapproval && !window.confirm('This booking is already approved. Saving your changes sends it back to the committee for approval again. Continue?')) return;

    setSaving(true);
    setError('');

    // Date clash check against other approved bookings and blocked dates.
    const datesChanged = form.startDate !== booking.start_date || form.endDate !== (booking.end_date || booking.start_date);
    const checkClash = !asTrustee || (datesChanged && booking.status !== 'declined');
    const ranges = checkClash ? await loadUnavailable(supabase, booking.id) : [];
    const hit = firstClash(ranges, form.startDate, form.endDate);
    const blockedClash = hit && hit.kind === 'blocked';
    const clash = hit && hit.kind === 'booked';
    if (blockedClash) {
      setSaving(false);
      setError('The marae is unavailable on those dates. Please choose different dates.');
      return;
    }
    if (clash) {
      setSaving(false);
      setError('The marae is already booked on those dates. Please choose different dates.');
      return;
    }

    const changes = {
      occasion: form.occasion,
      start_date: form.startDate,
      end_date: form.endDate,
      guests: parseInt(form.guests, 10),
      overnight: form.overnight,
      facilities: form.facilities,
      notes: form.notes || null,
    };
    if (!asTrustee) changes.status = 'pending';
    if (form.contactName.trim() || booking.contact_name) changes.contact_name = form.contactName.trim() || null;
    if (form.contactPhone.trim() || booking.contact_phone) changes.contact_phone = form.contactPhone.trim() || null;
    if (form.contactEmail.trim() || booking.contact_email) changes.contact_email = form.contactEmail.trim() || null;
    // Only include organisation when there is something to save or clear, so
    // editing works on a marae whose database has no organisation column yet.
    if (form.organisation.trim() || booking.organisation) changes.organisation = form.organisation.trim() || null;

    const { error: updateError } = await supabase.from('bookings').update(changes).eq('id', booking.id);
    if (updateError) {
      setSaving(false);
      setError('Could not save your changes: ' + updateError.message);
      return;
    }

    if (asTrustee) {
      logAudit({
        entityId: booking.entity_id, action: 'update', resourceType: 'booking',
        resourceId: booking.id, resourceName: booking.reference || null,
        metadata: { edited_by: 'trustee' },
      });
      setSaving(false);
      onSaved();
      return;
    }

    // Tell the trustees — fire and forget.
    getTrusteeEmails().then(emails => {
      if (!emails.length) return;
      sendNotification(
        emails,
        `Booking ${reapproval ? 'changed — needs re-approval' : 'updated'} — ${form.occasion} (${booking.reference || ''})`,
        `Tēnā koutou,\n\nA booking has been ${reapproval ? 'changed by the person who made it and needs your approval again' : 'updated by the person who made it'}.\n\n` +
        `Occasion: ${form.occasion}\n` +
        (form.organisation.trim() ? `Organisation: ${form.organisation.trim()}\n` : '') +
        `Dates: ${fmt(form.startDate)} → ${fmt(form.endDate)}\n` +
        `Guests: ${form.guests}\n` +
        `Overnight: ${form.overnight ? 'Yes' : 'No'}\n` +
        `Reference: ${booking.reference || ''}\n` +
        (form.notes ? `Notes: ${form.notes}\n` : '') +
        `\nPlease log in to MaraeHub to approve or decline.`,
      );
    });

    setSaving(false);
    onSaved();
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-title">Edit booking {booking.reference ? `· ${booking.reference}` : ''}</div>
        {reapproval && (
          <div className="alert" style={{ marginBottom: 12, fontSize: 13 }}>
            This booking is approved. If you change it, it goes back to the committee for approval.
          </div>
        )}
        {error && <div className="alert alert-error">{error}</div>}

        <div className="form-group">
          <label className="form-label">Occasion *</label>
          <select className="form-input" value={form.occasion} onChange={e => setField('occasion', e.target.value)}>
            {occasionsFor(booking.occasion).map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Organisation / Group</label>
          <input className="form-input" maxLength={120} value={form.organisation} onChange={e => setField('organisation', e.target.value)} placeholder="Optional" />
        </div>

        <div className="form-group">
          <label className="form-label">Contact name</label>
          <input className="form-input" maxLength={120} value={form.contactName} onChange={e => setField('contactName', e.target.value)} />
        </div>
        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Contact phone</label>
            <input className="form-input" maxLength={40} value={form.contactPhone} onChange={e => setField('contactPhone', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Contact email</label>
            <input type="email" className="form-input" maxLength={160} value={form.contactEmail} onChange={e => setField('contactEmail', e.target.value)} />
          </div>
        </div>

        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Start Date *</label>
            <input type="date" className="form-input" value={form.startDate}
              onChange={e => { const v = e.target.value; setForm(f => ({ ...f, startDate: v, endDate: endDateAfterStartChange(v, f.endDate) })); }} />
          </div>
          <div className="form-group">
            <label className="form-label">End Date *</label>
            <input type="date" className="form-input" value={form.endDate} min={form.startDate || undefined} onChange={e => setField('endDate', e.target.value)} />
          </div>
        </div>

        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Guests</label>
            <input type="number" min="0" className="form-input" value={form.guests} onChange={e => setField('guests', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Overnight?</label>
            <select className="form-input" value={form.overnight ? 'yes' : 'no'} onChange={e => setField('overnight', e.target.value === 'yes')}>
              <option value="no">No – Day event</option>
              <option value="yes">Yes – Overnight</option>
            </select>
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
          <label className="form-label">Notes</label>
          <textarea className="form-input" rows={3} maxLength={500} value={form.notes} onChange={e => setField('notes', e.target.value)} style={{ resize: 'vertical' }} />
        </div>

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>Close</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : asTrustee ? 'Save changes' : reapproval ? 'Save and resubmit' : 'Save changes'}</button>
        </div>
      </div>
    </div>
  );
}
