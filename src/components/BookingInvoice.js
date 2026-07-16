// MaraeHub Booking Invoice
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { sendNotification, invoiceBody } from '../lib/notify';

function fmt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtMoney(n) {
  const abs = Math.abs(n || 0);
  return `$${abs.toLocaleString('en-NZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function BookingInvoice({ booking, onClose }) {
  const [marae, setMarae] = useState(null);
  const [income, setIncome] = useState(null);
  const [amount, setAmount] = useState('');
  const [customerEmail, setCustomerEmail] = useState(booking.contact_email || '');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true);
    const [maraeRes, incomeRes] = await Promise.all([
      supabase.from('marae_settings').select('*').limit(1).single(),
      supabase.from('finance_income').select('*').eq('source_type', 'booking').eq('source_id', booking.id).maybeSingle(),
    ]);
    setMarae(maraeRes.data || null);
    setIncome(incomeRes.data || null);
    setAmount(incomeRes.data ? String(incomeRes.data.amount) : '');
    if (!booking.contact_email && booking.user_id) {
      const { data } = await supabase.from('profiles').select('email').eq('id', booking.user_id).maybeSingle();
      if (data?.email) setCustomerEmail(data.email);
    }
    setLoading(false);
  }

  async function handleSaveAmount() {
    if (!income) return;
    setSaving(true); setError(''); setSuccess('');
    const { error: err } = await supabase.from('finance_income').update({ amount: parseFloat(amount) || 0 }).eq('id', income.id);
    setSaving(false);
    if (err) { setError(err.message); return; }
    setIncome(prev => ({ ...prev, amount: parseFloat(amount) || 0 }));
    setSuccess('Hire fee saved.');
    setTimeout(() => setSuccess(''), 3000);
  }

  async function handleMarkSent() {
    if (!income) return;
    setSaving(true); setError('');
    const now = new Date().toISOString();
    const { error: err } = await supabase.from('finance_income').update({ invoice_sent_at: now }).eq('id', income.id);
    setSaving(false);
    if (err) { setError(err.message); return; }
    setIncome(prev => ({ ...prev, invoice_sent_at: now }));
  }

  async function handleMarkPaid() {
    if (!income) return;
    setSaving(true); setError('');
    const now = new Date().toISOString();
    const { error: err } = await supabase.from('finance_income').update({ invoice_paid_at: now, status: 'Confirmed' }).eq('id', income.id);
    setSaving(false);
    if (err) { setError(err.message); return; }
    setIncome(prev => ({ ...prev, invoice_paid_at: now, status: 'Confirmed' }));
  }

  async function handleEmailInvoice() {
    if (!income || !customerEmail) return;
    setSending(true); setError('');
    await sendNotification(customerEmail, `Invoice — ${booking.occasion} (${booking.reference || ''})`, invoiceBody(booking, income, marae));
    const now = new Date().toISOString();
    const { error: err } = await supabase.from('finance_income').update({ invoice_sent_at: now }).eq('id', income.id);
    setSending(false);
    if (err) { setError(err.message); return; }
    setIncome(prev => ({ ...prev, invoice_sent_at: now }));
    setSuccess('Invoice emailed to ' + customerEmail);
    setTimeout(() => setSuccess(''), 3000);
  }

  const facilities = Array.isArray(booking.facilities) && booking.facilities.length > 0 ? booking.facilities.join(', ') : 'Not specified';

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #invoice-print-area, #invoice-print-area * { visibility: visible; }
          #invoice-print-area { position: absolute; top: 0; left: 0; width: 100%; padding: 40px; }
          .no-print { display: none !important; }
        }
      `}</style>
      <div className="modal" style={{ maxWidth: 640, maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 18, fontWeight: 600 }}>Invoice</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text3)', lineHeight: 1 }}>×</button>
        </div>

        {error && <div className="alert alert-error no-print">{error}</div>}
        {success && <div className="alert alert-success no-print">{success}</div>}

        {loading ? (
          <div className="loading">Loading invoice...</div>
        ) : !income ? (
          <div className="empty-state" style={{ padding: '20px 0' }}>
            <div className="emoji">🧾</div>
            <div>No income record found for this booking yet. Approve the booking, or use Finance → Re-sync to create one.</div>
          </div>
        ) : (
          <>
            <div id="invoice-print-area">
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, fontWeight: 600, color: 'var(--brand)' }}>{marae?.marae_name || 'Marae'}</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4, lineHeight: 1.6 }}>
                  {marae?.location && <div>{marae.location}</div>}
                  {marae?.phone && <div>{marae.phone}</div>}
                  {marae?.email && <div>{marae.email}</div>}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Bill To</div>
                  <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>{booking.contact_name || '—'}</div>
                  {booking.contact_phone && <div style={{ fontSize: 12, color: 'var(--text2)' }}>{booking.contact_phone}</div>}
                  {customerEmail && <div style={{ fontSize: 12, color: 'var(--text2)' }}>{customerEmail}</div>}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Reference</div>
                  <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>{booking.reference || '—'}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6 }}>Date: {fmt(new Date())}</div>
                </div>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)' }}>
                    <th style={{ textAlign: 'left', padding: '6px 0', fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase' }}>Description</th>
                    <th style={{ textAlign: 'right', padding: '6px 0', fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ padding: '10px 0', fontSize: 13 }}>
                      <div style={{ fontWeight: 600 }}>{booking.occasion} — Hire Fee</div>
                      <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                        {fmt(booking.start_date)} → {fmt(booking.end_date)} · {booking.guests} guests · {booking.overnight ? 'Overnight' : 'Day event'}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text3)' }}>Facilities: {facilities}</div>
                    </td>
                    <td style={{ padding: '10px 0', fontSize: 13, textAlign: 'right', verticalAlign: 'top' }}>{fmtMoney(income.amount)}</td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: '2px solid var(--border)' }}>
                    <td style={{ padding: '10px 0', fontSize: 14, fontWeight: 700 }}>Total Due</td>
                    <td style={{ padding: '10px 0', fontSize: 14, fontWeight: 700, textAlign: 'right', color: 'var(--brand)' }}>{fmtMoney(income.amount)}</td>
                  </tr>
                </tfoot>
              </table>

              {marae?.payment_details && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Payment Details</div>
                  <div style={{ fontSize: 12, color: 'var(--text2)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{marae.payment_details}</div>
                </div>
              )}

              <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                {income.invoice_paid_at ? `Paid ${fmt(income.invoice_paid_at)}` : income.invoice_sent_at ? `Sent ${fmt(income.invoice_sent_at)} — payment pending` : 'Not yet sent'}
              </div>
            </div>

            <div className="no-print" style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
              <div className="form-group">
                <label className="form-label">Hire Fee</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input type="number" min="0" step="0.01" className="form-input" value={amount} onChange={e => setAmount(e.target.value)} disabled={!!income.invoice_paid_at} />
                  <button className="btn-secondary" onClick={handleSaveAmount} disabled={saving || !!income.invoice_paid_at} style={{ flexShrink: 0 }}>Save</button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Customer Email</label>
                <input type="email" className="form-input" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} placeholder="For emailing the invoice" />
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
                <button className="btn-secondary" onClick={() => window.print()}>🖨️ Print / Save as PDF</button>
                <div>
                  <button className="btn-secondary" onClick={handleEmailInvoice} disabled={sending || !customerEmail || !parseFloat(income.amount)}>
                    {sending ? 'Sending...' : '✉️ Email Invoice'}
                  </button>
                  <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4, maxWidth: 180 }}>Email delivery is being finalised — Print or Save as PDF works reliably right now.</div>
                </div>
                {!income.invoice_sent_at && (
                  <button className="btn-secondary" onClick={handleMarkSent} disabled={saving}>✓ Mark as Sent</button>
                )}
                {!income.invoice_paid_at && (
                  <button className="btn-primary" onClick={handleMarkPaid} disabled={saving || !parseFloat(income.amount)}>💰 Mark as Paid</button>
                )}
              </div>
            </div>

            <div className="modal-actions no-print">
              <button className="btn-secondary" onClick={onClose}>Close</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
