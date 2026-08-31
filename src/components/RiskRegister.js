import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import useProfiles from '../lib/useProfiles';

const CATEGORIES   = ['Health & Safety', 'Financial', 'Governance', 'Environmental', 'Reputational'];
const LIKELIHOODS  = ['Low', 'Medium', 'High'];
const CONSEQUENCES = ['Low', 'Medium', 'High'];
const STATUSES     = ['Open', 'Being Managed', 'Closed'];

function calcRating(likelihood, consequence) {
  if (!likelihood || !consequence) return 'Low';
  if (likelihood === 'High' || consequence === 'High') return 'High';
  if (likelihood === 'Low'  && consequence === 'Low')  return 'Low';
  return 'Medium';
}

const RATING_PILL = {
  High:   { bg: '#faeae7', color: '#a63020', border: '1px solid #f0b8b0' },
  Medium: { bg: '#fdf0dc', color: '#7a4f00', border: '1px solid #e8c880' },
  Low:    { bg: '#e8f4ef', color: '#1a4a3a', border: '1px solid #a8d8c0' },
};

const STATUS_PILL = {
  'Open':          { bg: '#faeae7', color: '#a63020' },
  'Being Managed': { bg: '#fdf0dc', color: '#7a4f00' },
  'Closed':        { bg: '#e8f4ef', color: '#1a4a3a' },
};

function fmt(d) {
  if (!d) return '—';
  return new Date(d + 'T12:00:00').toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });
}

const EMPTY = {
  risk_description: '',
  category:    'Health & Safety',
  likelihood:  'Low',
  consequence: 'Low',
  controls:    '',
  owner:       '',
  review_date: '',
  status:      'Open',
  notes:       '',
  entity_id:   '',
  asset_id:    '',
  compliance_item_id: '',
};

export default function RiskRegister({ pendingRisk, onPendingConsumed }) {
  const [risks, setRisks]         = useState([]);
  const [entities, setEntities]   = useState([]);
  const [assets, setAssets]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editRisk, setEditRisk]   = useState(null);
  const [form, setForm]           = useState(EMPTY);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [entityFilter, setEntityFilter] = useState('all');
  const [linkedItemName, setLinkedItemName] = useState('');

  const allProfiles = useProfiles();
  const trustees = allProfiles.filter(p => p.role === 'trustee');

  const load = useCallback(async () => {
    setLoading(true);
    const [risksRes, entRes, assetsRes] = await Promise.all([
      supabase.from('risk_register').select('*').order('created_at', { ascending: false }),
      supabase.from('entities').select('id, name').order('name'),
      supabase.from('assets').select('id, name').order('name'),
    ]);
    setRisks(risksRes.data || []);
    setEntities(entRes.data || []);
    setAssets(assetsRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Compliance -> Risk suggestion prompt (86d44k66b). Same shape as
  // WorkflowEngine's pendingWorkflow effect (TrusteeDashboard.js) --
  // prefill from a sibling-tab handoff, then tell the parent it's been
  // consumed so it doesn't re-fire on the next render. Category is
  // deliberately left at EMPTY's own default, not mapped from the
  // compliance item's category -- no clean mapping exists between the
  // two taxonomies (confirmed during design), so the trustee chooses it.
  useEffect(() => {
    if (!pendingRisk) return;
    setEditRisk(null);
    setForm({
      ...EMPTY,
      risk_description: pendingRisk.riskDescription || '',
      entity_id: pendingRisk.entityId || '',
      compliance_item_id: pendingRisk.complianceItemId || '',
    });
    setLinkedItemName(pendingRisk.complianceItemName || '');
    setError('');
    setShowModal(true);
    if (onPendingConsumed) onPendingConsumed();
  }, [pendingRisk]); // eslint-disable-line react-hooks/exhaustive-deps

  function openAdd() {
    setEditRisk(null);
    setForm(EMPTY);
    setLinkedItemName('');
    setError('');
    setShowModal(true);
  }

  function openEdit(r) {
    setEditRisk(r);
    setForm({
      risk_description: r.risk_description || '',
      category:    r.category    || 'Health & Safety',
      likelihood:  r.likelihood  || 'Low',
      consequence: r.consequence || 'Low',
      controls:    r.controls    || '',
      owner:       r.owner       || '',
      review_date: r.review_date || '',
      status:      r.status      || 'Open',
      notes:       r.notes       || '',
      entity_id:   r.entity_id   || '',
      asset_id:    r.asset_id    || '',
      compliance_item_id: r.compliance_item_id || '',
    });
    setLinkedItemName('');
    setError('');
    setShowModal(true);
  }

  async function save() {
    if (!form.risk_description.trim()) { setError('Risk description is required'); return; }
    setSaving(true); setError('');

    const payload = {
      risk_description: form.risk_description.trim(),
      category:    form.category,
      likelihood:  form.likelihood,
      consequence: form.consequence,
      risk_rating: calcRating(form.likelihood, form.consequence),
      controls:    form.controls.trim() || null,
      owner:       form.owner || null,
      review_date: form.review_date || null,
      status:      form.status,
      notes:       form.notes.trim() || null,
      entity_id:   form.entity_id || null,
      asset_id:    form.asset_id || null,
      compliance_item_id: form.compliance_item_id || null,
    };

    if (editRisk) {
      const { error: err } = await supabase.from('risk_register').update(payload).eq('id', editRisk.id);
      if (err) { setError(err.message); setSaving(false); return; }
    } else {
      const { error: err } = await supabase.from('risk_register').insert(payload);
      if (err) { setError(err.message); setSaving(false); return; }
    }

    await load();
    setShowModal(false);
    setSaving(false);
  }

  async function deleteRisk(id) {
    if (!window.confirm('Delete this risk? This cannot be undone.')) return;
    await supabase.from('risk_register').delete().eq('id', id);
    setRisks(prev => prev.filter(r => r.id !== id));
  }

  function field(key, val) { setForm(f => ({ ...f, [key]: val })); }

  const filtered = risks.filter(r =>
    (catFilter    === 'all' || r.category === catFilter) &&
    (statusFilter === 'all' || r.status   === statusFilter) &&
    (entityFilter === 'all' || r.entity_id === entityFilter || r.entity_id === null)
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
            <div style={{ marginTop: 4, fontSize: 14, color: '#a63020', fontWeight: 600 }}>
              ⚠️ {highOpen} high-rated open risk{highOpen !== 1 ? 's' : ''} — review required
            </div>
          )}
        </div>
        <button className="btn-primary" onClick={openAdd}>+ Add Risk</button>
      </div>

      {/* ── FILTERS ── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
        <select className="form-input" style={{ width: 'auto', fontSize: 14 }} value={catFilter} onChange={e => setCatFilter(e.target.value)}>
          <option value="all">All Categories</option>
          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
        <select className="form-input" style={{ width: 'auto', fontSize: 14 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="all">All Statuses</option>
          {STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
        {entities.length > 0 && (
          <select className="form-input" style={{ width: 'auto', fontSize: 14 }} value={entityFilter} onChange={e => setEntityFilter(e.target.value)}>
            <option value="all">All Entities</option>
            {entities.map(ent => <option key={ent.id} value={ent.id}>{ent.name}</option>)}
          </select>
        )}
      </div>

      {/* ── TABLE ── */}
      {filtered.length === 0 ? (
        <div className="panel" style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text3)' }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>🛡️</div>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>No risks recorded</div>
          <div style={{ fontSize: 14 }}>Click "+ Add Risk" to start building your register</div>
        </div>
      ) : (
        <div className="panel" style={{ padding: 0, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: 'var(--surface2)', borderBottom: '2px solid var(--border)' }}>
                {['Risk', 'Category', 'Likelihood', 'Consequence', 'Rating', 'Owner', 'Review Date', 'Status', ''].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text2)', fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => {
                const rp = RATING_PILL[r.risk_rating] || RATING_PILL.Low;
                const sp = STATUS_PILL[r.status]      || STATUS_PILL['Open'];
                const entityName = r.entity_id ? entities.find(e => e.id === r.entity_id)?.name : null;
                const assetName = r.asset_id ? assets.find(a => a.id === r.asset_id)?.name : null;
                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'var(--surface)' : 'var(--surface2)' }}>
                    <td style={{ padding: '12px 14px', maxWidth: 260 }}>
                      <div style={{ fontWeight: 500, color: 'var(--text1)', lineHeight: 1.4 }}>
                        {r.risk_rating === 'High' && r.status !== 'Closed' && <span style={{ marginRight: 5 }}>⚠️</span>}
                        {r.risk_description}
                      </div>
                      {r.controls && <div style={{ fontSize: 14, color: 'var(--text3)', marginTop: 3 }}>Controls: {r.controls}</div>}
                      {entityName && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3 }}><span style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 20, padding: '2px 8px', fontWeight: 600 }}>{entityName}</span></div>}
                      {assetName && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3 }}><span style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 20, padding: '2px 8px', fontWeight: 600 }}>🔧 {assetName}</span></div>}
                    </td>
                    <td style={{ padding: '12px 14px', color: 'var(--text2)', whiteSpace: 'nowrap' }}>{r.category}</td>
                    <td style={{ padding: '12px 14px', color: 'var(--text2)' }}>{r.likelihood}</td>
                    <td style={{ padding: '12px 14px', color: 'var(--text2)' }}>{r.consequence}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ ...rp, padding: '4px 11px', borderRadius: 20, fontWeight: 700, fontSize: 14, display: 'inline-block' }}>
                        {r.risk_rating || '—'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px', color: 'var(--text2)' }}>{r.owner || '—'}</td>
                    <td style={{ padding: '12px 14px', color: 'var(--text2)', whiteSpace: 'nowrap' }}>{fmt(r.review_date)}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ ...sp, padding: '4px 11px', borderRadius: 20, fontSize: 14, fontWeight: 600 }}>
                        {r.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                      <button className="btn-secondary" style={{ fontSize: 14, padding: '5px 12px', marginRight: 6 }} onClick={() => openEdit(r)}>Edit</button>
                      <button onClick={() => deleteRisk(r.id)} style={{ fontSize: 14, padding: '5px 12px', background: 'none', border: '1px solid var(--danger)', color: 'var(--danger)', borderRadius: 6, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', fontWeight: 600 }}>Delete</button>
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

            {linkedItemName && (
              <div style={{ marginBottom: 16, padding: '8px 12px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, color: 'var(--text2)' }}>
                🔗 Created from compliance item: <strong>{linkedItemName}</strong>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Risk Description *</label>
              <textarea className="form-input" rows={3} style={{ resize: 'vertical' }}
                value={form.risk_description} onChange={e => field('risk_description', e.target.value)}
                placeholder="Describe the risk clearly and concisely" />
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

            {entities.length > 0 && (
              <div className="form-group">
                <label className="form-label">Entity</label>
                <select className="form-input" value={form.entity_id} onChange={e => field('entity_id', e.target.value)}>
                  <option value="">— Shared (all entities) —</option>
                  {entities.map(ent => <option key={ent.id} value={ent.id}>{ent.name}</option>)}
                </select>
              </div>
            )}

            {assets.length > 0 && (
              <div className="form-group">
                <label className="form-label">Link to Asset (optional)</label>
                <select className="form-input" value={form.asset_id} onChange={e => field('asset_id', e.target.value)}>
                  <option value="">— No linked asset —</option>
                  {assets.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            )}

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
            <div style={{ marginBottom: 16, padding: '10px 14px', background: 'var(--surface2)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 14, color: 'var(--text2)' }}>Auto-calculated risk rating:</span>
              {(() => {
                const rating = calcRating(form.likelihood, form.consequence);
                const rp = RATING_PILL[rating];
                return <span style={{ ...rp, padding: '4px 13px', borderRadius: 20, fontWeight: 700, fontSize: 14 }}>{rating}</span>;
              })()}
            </div>

            <div className="form-group">
              <label className="form-label">Controls in Place</label>
              <textarea className="form-input" rows={2} style={{ resize: 'vertical' }}
                value={form.controls} onChange={e => field('controls', e.target.value)}
                placeholder="What is currently in place to manage this risk?" />
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
              <textarea className="form-input" rows={2} style={{ resize: 'vertical' }}
                value={form.notes} onChange={e => field('notes', e.target.value)}
                placeholder="Any additional context or notes" />
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
