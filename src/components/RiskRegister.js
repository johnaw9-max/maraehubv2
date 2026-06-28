import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import useProfiles from '../lib/useProfiles';

const CATEGORIES  = ['Health & Safety', 'Financial', 'Governance', 'Environmental', 'Reputational'];
const LIKELIHOODS = ['Low', 'Medium', 'High'];
const CONSEQUENCES = ['Low', 'Medium', 'High'];
const STATUSES    = ['Open', 'Being Managed', 'Closed'];

function calcRating(likelihood, consequence) {
  if (!likelihood || !consequence) return '';
  if (likelihood === 'High' || consequence === 'High') return 'High';
  if (likelihood === 'Low'  && consequence === 'Low')  return 'Low';
  return 'Medium';
}

const RATING_PILL = {
  High:   { bg: '#faeae7', color: '#a63020', border: '1px solid #f0b8b0' },
  Medium: { bg: '#fdf0dc', color: '#7a4f00', border: '1px solid #e8c880' },
  Low:    { bg: '#e8f4ef', color: '#1a4a3a', border: '1px solid #a8d8c0' },
};

function fmt(d) {
  if (!d) return '—';
  return new Date(d + 'T12:00:00').toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });
}

const EMPTY = {
  risk_description: '',
  category: 'Health & Safety',
  likelihood: 'Low',
  consequence: 'Low',
  controls: '',
  owner: '',
  review_date: '',
  status: 'Open',
  notes: '',
};

export default function RiskRegister() {
  const [risks, setRisks]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editRisk, setEditRisk]   = useState(null);
  const [form, setForm]           = useState(EMPTY);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentUserId, setCurrentUserId] = useState(null);

  const allProfiles = useProfiles();
  const trustees = allProfiles.filter(p => p.role === 'trustee');

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data }, { data: { user } }] = await Promise.all([
      supabase.from('risk_register').select('*').order('created_at', { ascending: false }),
      supabase.auth.getUser(),
    ]);
    setRisks(data || []);
    setCurrentUserId(user?.id || null);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openAdd() {
    setEditRisk(null);
    setForm(EMPTY);
    setError('');
    setShowModal(true);
  }

  function openEdit(r) {
    setEditRisk(r);
    setForm({
      risk_description: r.risk_description || '',
      category:         r.category         || 'Health & Safety',
      likelihood:       r.likelihood        || 'Low',
      consequence:      r.consequence       || 'Low',
      controls:         r.controls          || '',
      owner:            r.owner             || '',
      review_date:      r.review_date       || '',
      status:           r.status            || 'Open',
      notes:            r.notes             || '',
    });
    setError('');
    setShowModal(true);
  }

  async function save() {
    if (!form.risk_description.trim()) { setError('Risk description is required'); return; }
    setSaving(true); setError('');
    const payload = {
      ...form,
      risk_description: form.risk_description.trim(),
      controls:         form.controls.trim(),
      owner:            form.owner.trim(),
      notes:            form.notes.trim(),
      risk_rating:      calcRating(form.likelihood, form.consequence),
      review_date:      form.review_date || null,
    };
    const { error: err } = editRisk
      ? await supabase.from('risk_register').update(payload).eq('id', editRisk.id)
      : await supabase.from('risk_register').insert(payload);
    setSaving(false);
    if (err) { setError(err.message); return; }
    setShowModal(false);
    load();
  }

  async function deleteRisk(id) {
    if (!window.confirm('Delete this risk? This cannot be undone.')) return;
    await supabase.from('risk_register').delete().eq('id', id);
    load();
  }

  function field(key, val) { setForm(f => ({ ...f, [key]: val })); }

  const filtered = risks.filter(r =>
    (catFilter    === 'all' || r.category === catFilter) &&
    (statusFilter === 'all' || r.status   === statusFilter)
  );

  const highOpen = risks.filter(r => r.risk_rating === 'High' && r.status !== 'Closed').length;

  if (loading) return <div className="loading">Loading risk register…</div>;

  return (
    <div>
      {/* ── HEADER ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, fontWeight: 700, color: 'var(--brand)', margin: 0 }}>
            Risk Register
          </h2>
          {highOpen > 0 && (
            <div style={{ marginTop: 4, fontSize: 13, color: '#a63020', fontWeight: 600 }}>
              ⚠️ {highOpen} high-rated open risk{highOpen !== 1 ? 's' : ''} — review required
            </div>
          )}
        </div>
        <button className="btn-primary" onClick={openAdd}>+ Add Risk</button>
      </div>

      {/* ── FILTERS ── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
        <select
          className="form-input"
          style={{ width: 'auto', fontSize: 13 }}
          value={catFilter}
          onChange={e => setCatFilter(e.target.value)}
        >
          <option value="all">All Categories</option>
          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
        <select
          className="form-input"
          style={{ width: 'auto', fontSize: 13 }}
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="all">All Statuses</option>
          {STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
      </div>

      {/* ── TABLE ── */}
      {filtered.length === 0 ? (
        <div className="panel" style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text3)' }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>🛡️</div>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>No risks recorded</div>
          <div style={{ fontSize: 13 }}>Click "+ Add Risk" to start building your register</div>
        </div>
      ) : (
        <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface2)', borderBottom: '2px solid var(--border)' }}>
                {['Risk', 'Category', 'Likelihood', 'Consequence', 'Rating', 'Owner', 'Review Date', 'Status', ''].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text2)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => {
                const rp = RATING_PILL[r.risk_rating] || {};
                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'var(--surface)' : 'var(--surface2)' }}>
                    <td style={{ padding: '12px 14px', maxWidth: 280 }}>
                      <div style={{ fontWeight: 500, color: 'var(--text1)', lineHeight: 1.4 }}>
                        {r.risk_rating === 'High' && r.status !== 'Closed' && <span style={{ marginRight: 5 }}>⚠️</span>}
                        {r.risk_description}
                      </div>
                      {r.controls && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>Controls: {r.controls}</div>}
                    </td>
                    <td style={{ padding: '12px 14px', color: 'var(--text2)', whiteSpace: 'nowrap' }}>{r.category}</td>
                    <td style={{ padding: '12px 14px', color: 'var(--text2)' }}>{r.likelihood}</td>
                    <td style={{ padding: '12px 14px', color: 'var(--text2)' }}>{r.consequence}</td>
                    <td style={{ padding: '12px 14px' }}>
                      {r.risk_rating && (
                        <span style={{ ...rp, padding: '3px 10px', borderRadius: 20, fontWeight: 700, fontSize: 11, display: 'inline-block' }}>
                          {r.risk_rating}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '12px 14px', color: 'var(--text2)' }}>{r.owner || '—'}</td>
                    <td style={{ padding: '12px 14px', color: 'var(--text2)', whiteSpace: 'nowrap' }}>{fmt(r.review_date)}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{
                        padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                        background: r.status === 'Closed' ? '#e8f4ef' : r.status === 'Being Managed' ? '#fdf0dc' : '#faeae7',
                        color: r.status === 'Closed' ? '#1a4a3a' : r.status === 'Being Managed' ? '#7a4f00' : '#a63020',
                      }}>
                        {r.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                      <button className="btn-secondary" style={{ fontSize: 11, padding: '4px 10px', marginRight: 6 }} onClick={() => openEdit(r)}>Edit</button>
                      <button onClick={() => deleteRisk(r.id)} style={{ fontSize: 11, padding: '4px 10px', background: 'none', border: '1px solid var(--danger)', color: 'var(--danger)', borderRadius: 6, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', fontWeight: 600 }}>Delete</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── MODAL ── */}
      {showModal && (
        <div
          onClick={e => e.target === e.currentTarget && setShowModal(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 20px', overflowY: 'auto' }}
        >
          <div style={{ background: 'var(--surface)', borderRadius: 12, width: '100%', maxWidth: 620, padding: 32, position: 'relative', boxShadow: '0 8px 40px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
              <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: 18, fontWeight: 700, color: 'var(--brand)', margin: 0 }}>
                {editRisk ? 'Edit Risk' : 'Add Risk'}
              </h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text3)' }}>✕</button>
            </div>

            {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

            <div className="form-group">
              <label className="form-label">Risk Description *</label>
              <textarea
                className="form-input"
                rows={3}
                style={{ resize: 'vertical' }}
                value={form.risk_description}
                onChange={e => field('risk_description', e.target.value)}
                placeholder="Describe the risk clearly and concisely"
              />
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Category</label>
                <select className="form-input" value={form.category} onChange={e => field('category', e.target.value)}>
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-input" value={form.status} onChange={e => field('status', e.target.value)}>
                  {STATUSES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Likelihood</label>
                <select className="form-input" value={form.likelihood} onChange={e => field('likelihood', e.target.value)}>
                  {LIKELIHOODS.map(l => <option key={l}>{l}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Consequence</label>
                <select className="form-input" value={form.consequence} onChange={e => field('consequence', e.target.value)}>
                  {CONSEQUENCES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>

            {/* Auto-calculated rating preview */}
            {form.likelihood && form.consequence && (
              <div style={{ marginBottom: 16, padding: '10px 14px', background: 'var(--surface2)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 13, color: 'var(--text2)' }}>Auto-calculated risk rating:</span>
                {(() => {
                  const rating = calcRating(form.likelihood, form.consequence);
                  const rp = RATING_PILL[rating] || {};
                  return (
                    <span style={{ ...rp, padding: '3px 12px', borderRadius: 20, fontWeight: 700, fontSize: 12 }}>{rating}</span>
                  );
                })()}
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Controls in Place</label>
              <textarea
                className="form-input"
                rows={2}
                style={{ resize: 'vertical' }}
                value={form.controls}
                onChange={e => field('controls', e.target.value)}
                placeholder="What is currently in place to manage this risk?"
              />
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Owner (Responsible Trustee)</label>
                <select className="form-input" value={form.owner} onChange={e => field('owner', e.target.value)}>
                  <option value="">— Select trustee —</option>
                  {trustees.map(t => (
                    <option key={t.full_name} value={t.full_name}>{t.full_name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Review Date</label>
                <input type="date" className="form-input" value={form.review_date} onChange={e => field('review_date', e.target.value)} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea
                className="form-input"
                rows={2}
                style={{ resize: 'vertical' }}
                value={form.notes}
                onChange={e => field('notes', e.target.value)}
                placeholder="Any additional context or notes"
              />
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
              <button className="btn-primary" onClick={save} disabled={saving}>
                {saving ? 'Saving…' : editRisk ? 'Save Changes' : 'Add Risk'}
              </button>
              <button className="btn-secondary" onClick={() => setShowModal(false)} disabled={saving}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
