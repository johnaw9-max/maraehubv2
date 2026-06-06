import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';

const TRADES = [
  'Plumber', 'Electrician', 'Builder', 'Roofer', 'Painter',
  'Landscaper', 'Cleaning', 'IT', 'Legal', 'Accounting', 'Other',
];

const TRADE_STYLE = {
  Plumber:     { bg: '#e8eef8', color: '#1a4a8a' },
  Electrician: { bg: '#fdf8dc', color: '#7a5a00' },
  Builder:     { bg: '#f0e8dc', color: '#6a3a10' },
  Roofer:      { bg: '#eaeaea', color: '#444444' },
  Painter:     { bg: '#f0ecf8', color: '#6b42a8' },
  Landscaper:  { bg: '#e8f4ef', color: '#1a4a3a' },
  Cleaning:    { bg: '#e0f4f4', color: '#0a5a5a' },
  IT:          { bg: '#e8eef8', color: '#1a3a8a' },
  Legal:       { bg: '#fdecea', color: '#7a1a1a' },
  Accounting:  { bg: '#e8f4ef', color: '#2d6e57' },
  Other:       { bg: '#f5f0e8', color: '#7a7268' },
};

const EMPTY_FORM = {
  name: '', trade: 'Plumber', company: '', phone: '', email: '',
  address: '', notes: '', preferred: false,
};

export default function ContractorsDirectory() {
  const [contractors, setContractors] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [showForm, setShowForm]       = useState(false);
  const [editId, setEditId]           = useState(null);
  const [form, setForm]               = useState(EMPTY_FORM);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');
  const [search, setSearch]           = useState('');
  const [filterTrade, setFilterTrade] = useState('all');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  useEffect(() => { fetchContractors(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchContractors() {
    setLoading(true);
    const { data } = await supabase.from('contractors').select('*').order('name');
    setContractors(data || []);
    setLoading(false);
  }

  // ─── KPI CALCULATIONS ────────────────────────────────────────────────────────

  const kpis = useMemo(() => {
    const total     = contractors.length;
    const preferred = contractors.filter(c => c.preferred).length;
    const trades    = [...new Set(contractors.map(c => c.trade))].length;
    const tradeCounts = TRADES.reduce((acc, t) => {
      acc[t] = contractors.filter(c => c.trade === t).length;
      return acc;
    }, {});
    const topTrade = Object.entries(tradeCounts).sort((a, b) => b[1] - a[1]).find(([, v]) => v > 0);
    return { total, preferred, trades, topTrade };
  }, [contractors]);

  // ─── FILTERED LIST ────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    return contractors.filter(c => {
      const matchesTrade  = filterTrade === 'all' || c.trade === filterTrade;
      const q             = search.toLowerCase();
      const matchesSearch = !q || c.name?.toLowerCase().includes(q) || c.trade?.toLowerCase().includes(q) || c.company?.toLowerCase().includes(q);
      return matchesTrade && matchesSearch;
    });
  }, [contractors, search, filterTrade]);

  // ─── FORM HANDLERS ───────────────────────────────────────────────────────────

  function openAdd() {
    setForm(EMPTY_FORM);
    setEditId(null);
    setError('');
    setShowForm(true);
  }

  function openEdit(c) {
    setForm({
      name: c.name || '', trade: c.trade || 'Plumber', company: c.company || '',
      phone: c.phone || '', email: c.email || '', address: c.address || '',
      notes: c.notes || '', preferred: c.preferred || false,
    });
    setEditId(c.id);
    setError('');
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditId(null);
    setError('');
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('Name is required.'); return; }
    if (!form.trade)       { setError('Trade is required.'); return; }
    setSaving(true);
    setError('');
    const payload = {
      name:      form.name.trim(),
      trade:     form.trade,
      company:   form.company.trim() || null,
      phone:     form.phone.trim()   || null,
      email:     form.email.trim()   || null,
      address:   form.address.trim() || null,
      notes:     form.notes.trim()   || null,
      preferred: form.preferred,
    };
    const { error: err } = editId
      ? await supabase.from('contractors').update(payload).eq('id', editId)
      : await supabase.from('contractors').insert(payload);
    if (err) { setError(err.message); setSaving(false); return; }
    setSaving(false);
    closeForm();
    fetchContractors();
  }

  async function handleDelete() {
    if (!confirmDeleteId) return;
    await supabase.from('contractors').delete().eq('id', confirmDeleteId);
    setConfirmDeleteId(null);
    fetchContractors();
  }

  async function togglePreferred(c) {
    await supabase.from('contractors').update({ preferred: !c.preferred }).eq('id', c.id);
    fetchContractors();
  }

  const KPI_TILES = [
    { label: 'Total Contractors', value: kpis.total,     icon: '🔨', bg: '#e8eef8', valueColor: 'var(--text1)' },
    { label: 'Preferred',         value: kpis.preferred, icon: '⭐', bg: '#fdf8dc',
      valueColor: kpis.preferred > 0 ? '#7a5a00' : 'var(--text3)' },
    { label: 'Trades Covered',    value: kpis.trades,    icon: '🛠️', bg: '#e8f4ef',
      valueColor: kpis.trades > 0 ? 'var(--success)' : 'var(--text3)' },
    { label: kpis.topTrade ? `Most: ${kpis.topTrade[0]}` : 'Top Trade',
      value: kpis.topTrade ? kpis.topTrade[1] : '—', icon: '📊', bg: '#f0ecf8',
      valueColor: '#6b42a8' },
  ];

  const activeTrades = TRADES.filter(t => contractors.some(c => c.trade === t));

  return (
    <div>
      {/* ── KPI TILES ────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {KPI_TILES.map((t, i) => (
          <div key={i} className="panel" style={{ textAlign: 'center', padding: '14px 10px' }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: t.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, margin: '0 auto 8px' }}>
              {t.icon}
            </div>
            <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, fontWeight: 600, color: t.valueColor, marginBottom: 4 }}>
              {t.value}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 500 }}>{t.label}</div>
          </div>
        ))}
      </div>

      {/* ── TOOLBAR ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 14, pointerEvents: 'none' }}>🔍</span>
          <input
            type="text"
            className="form-input"
            placeholder="Search by name, trade or company..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 32, width: 280 }}
          />
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <button className="btn-primary" onClick={openAdd}>+ Add Contractor</button>
        </div>
      </div>

      {/* ── TRADE FILTER PILLS ───────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        <button
          onClick={() => setFilterTrade('all')}
          style={{
            padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
            background: filterTrade === 'all' ? 'var(--brand)' : 'var(--surface2)',
            color: filterTrade === 'all' ? '#fff' : 'var(--text2)',
            border: filterTrade === 'all' ? 'none' : '1px solid var(--border)',
          }}
        >
          All ({contractors.length})
        </button>
        {activeTrades.map(t => {
          const count = contractors.filter(c => c.trade === t).length;
          const active = filterTrade === t;
          return (
            <button
              key={t}
              onClick={() => setFilterTrade(t)}
              style={{
                padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: active ? 'var(--brand)' : TRADE_STYLE[t]?.bg || '#f5f5f5',
                color: active ? '#fff' : TRADE_STYLE[t]?.color || 'var(--text2)',
                border: active ? 'none' : `1px solid ${TRADE_STYLE[t]?.color || 'var(--border)'}30`,
              }}
            >
              {t} ({count})
            </button>
          );
        })}
      </div>

      {/* ── CONTRACTOR CARDS ─────────────────────────────────────────────── */}
      {loading ? (
        <div className="loading">Loading contractors...</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="emoji">🔨</div>
          <div>{search || filterTrade !== 'all' ? 'No contractors match your filter.' : 'No contractors added yet.'}</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {filtered.map(c => {
            const ts = TRADE_STYLE[c.trade] || TRADE_STYLE.Other;
            return (
              <div
                key={c.id}
                className="panel"
                style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
              >
                {/* Card header */}
                <div style={{ background: ts.bg, padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <div>
                    <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 15, fontWeight: 600, color: 'var(--text1)', marginBottom: 4 }}>
                      {c.name}
                    </div>
                    <span style={{ fontSize: 11, background: ts.color + '20', color: ts.color, border: `1px solid ${ts.color}40`, borderRadius: 20, padding: '2px 10px', fontWeight: 600, letterSpacing: '0.04em' }}>
                      {c.trade}
                    </span>
                  </div>
                  <button
                    onClick={() => togglePreferred(c)}
                    title={c.preferred ? 'Remove preferred' : 'Mark as preferred'}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 0, flexShrink: 0 }}
                  >
                    {c.preferred ? '⭐' : '☆'}
                  </button>
                </div>

                {/* Card body */}
                <div style={{ padding: '14px 16px', flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {c.preferred && (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#fdf8dc', color: '#7a5a00', border: '1px solid #e8d880', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600, alignSelf: 'flex-start', marginBottom: 4 }}>
                      ⭐ Preferred
                    </div>
                  )}
                  {c.company && (
                    <div style={{ fontSize: 13, color: 'var(--text2)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>🏢</span> {c.company}
                    </div>
                  )}
                  {c.phone && (
                    <div style={{ fontSize: 13, color: 'var(--text2)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>📞</span>
                      <a href={`tel:${c.phone}`} style={{ color: 'var(--brand-light)', textDecoration: 'none' }}>{c.phone}</a>
                    </div>
                  )}
                  {c.email && (
                    <div style={{ fontSize: 13, color: 'var(--text2)', display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                      <span style={{ flexShrink: 0 }}>✉️</span>
                      <a href={`mailto:${c.email}`} style={{ color: 'var(--brand-light)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.email}</a>
                    </div>
                  )}
                  {c.address && (
                    <div style={{ fontSize: 12, color: 'var(--text3)', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                      <span style={{ flexShrink: 0 }}>📍</span> {c.address}
                    </div>
                  )}
                  {c.notes && (
                    <div style={{ fontSize: 12, color: 'var(--text3)', fontStyle: 'italic', marginTop: 2, lineHeight: 1.5 }}>
                      {c.notes.length > 100 ? c.notes.slice(0, 100) + '…' : c.notes}
                    </div>
                  )}
                </div>

                {/* Card actions */}
                <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => openEdit(c)}
                    style={{ flex: 1, background: 'var(--surface2)', color: 'var(--text2)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 0', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(c.id)}
                    style={{ flex: 1, background: '#faeae7', color: 'var(--danger)', border: '1px solid #f0b8b0', borderRadius: 6, padding: '6px 0', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── ADD / EDIT MODAL ─────────────────────────────────────────────── */}
      {showForm && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) closeForm(); }}>
          <div className="modal" style={{ maxWidth: 560 }}>
            <div className="modal-title">{editId ? 'Edit Contractor' : 'Add Contractor'}</div>
            {error && <div className="alert alert-error">{error}</div>}

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Name *</label>
                <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Full name" autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label">Trade *</label>
                <select className="form-input" value={form.trade} onChange={e => setForm(f => ({ ...f, trade: e.target.value }))}>
                  {TRADES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Company</label>
              <input className="form-input" value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} placeholder="Business name (optional)" />
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input className="form-input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="e.g. 021 123 4567" />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input type="email" className="form-input" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@example.com" />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Address</label>
              <input className="form-input" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Street address or suburb" />
            </div>

            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea className="form-input" rows={3} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Rates, availability, past work notes..." style={{ resize: 'vertical' }} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, padding: '12px 14px', background: 'var(--surface2)', borderRadius: 8, border: '1px solid var(--border)' }}>
              <span style={{ fontSize: 20 }}>⭐</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text1)' }}>Preferred Contractor</div>
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>Mark as the go-to contractor for this trade</div>
              </div>
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, preferred: !f.preferred }))}
                style={{
                  width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                  background: form.preferred ? 'var(--brand)' : '#ccc',
                  position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                }}
              >
                <span style={{
                  position: 'absolute', top: 3, width: 18, height: 18, borderRadius: '50%',
                  background: '#fff', transition: 'left 0.2s',
                  left: form.preferred ? 23 : 3,
                }} />
              </button>
            </div>

            <div className="modal-actions">
              <button className="btn-secondary" onClick={closeForm}>Cancel</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : editId ? 'Save Changes' : 'Add Contractor'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRM ───────────────────────────────────────────────── */}
      {confirmDeleteId && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setConfirmDeleteId(null); }}>
          <div className="modal" style={{ maxWidth: 380 }}>
            <div className="modal-title" style={{ fontSize: 18 }}>Delete Contractor?</div>
            <p style={{ color: 'var(--text2)', fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
              This contractor will be permanently removed from the directory.
            </p>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setConfirmDeleteId(null)}>Cancel</button>
              <button className="btn-danger" onClick={handleDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
