import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import FormError from './FormError';
import { sortCompletions, formatDay, sourceLabel, buildEvidenceHtml } from '../lib/complianceEvidence';

// History of when a compliance item was actually done, with proof.
// Append-only for trustees: add a record, view, print. (Admins can remove a mistaken one.)
export default function ComplianceHistoryModal({ item, maraeName, isAdmin, currentUserName, onClose, onUpload, onOpenProof, onChanged }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [doneOn, setDoneOn] = useState('');
  const [doneBy, setDoneBy] = useState(currentUserName || '');
  const [note, setNote] = useState('');
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error: err } = await supabase
      .from('compliance_completions').select('*').eq('compliance_item_id', item.id)
      .order('done_on', { ascending: false });
    if (err) setError('Could not load the history. Please try again.');
    else setRows(sortCompletions(data || []));
    setLoading(false);
  }
  useEffect(() => { load(); }, [item.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const todayStr = new Date().toISOString().split('T')[0];

  async function handleAdd() {
    setError('');
    if (!doneOn) { setError('Please choose the date it was done.'); return; }
    if (doneOn > todayStr) { setError('The date cannot be in the future.'); return; }
    if (note.length > 500) { setError('Please keep the note to 500 characters or fewer.'); return; }
    setSaving(true);
    let document_url = null; let document_name = null;
    if (file) {
      const up = await onUpload(file, `completions/${item.id}`);
      if (!up.url) { setSaving(false); setError('The file could not be uploaded, so nothing was saved. Please try again.'); return; }
      document_url = up.url; document_name = up.name;
    }
    const { data: { user } } = await supabase.auth.getUser();
    const { error: err } = await supabase.from('compliance_completions').insert({
      compliance_item_id: item.id, entity_id: item.entity_id || null, done_on: doneOn,
      done_by: doneBy.trim() || null, done_by_user: user?.id || null,
      note: note.trim() || null, document_url, document_name, source: 'manual_backfill',
    });
    setSaving(false);
    if (err) { setError('Could not save this record. Please try again.'); return; }
    setShowAdd(false); setDoneOn(''); setNote(''); setFile(null);
    await load();
    if (onChanged) onChanged(item.id);
  }

  async function handleDelete(row) {
    if (!window.confirm('Remove this record? Use this only to fix a mistake.')) return;
    const { error: err } = await supabase.from('compliance_completions').delete().eq('id', row.id);
    if (err) { setError('Could not remove the record.'); return; }
    await load();
    if (onChanged) onChanged(item.id);
  }

  function handlePrint() {
    const html = buildEvidenceHtml({
      maraeName, itemName: item.name, legalBasis: item.legal_basis, rows, generatedOn: todayStr,
    });
    const w = window.open('', '_blank');
    if (!w) { setError('Your browser blocked the print window. Please allow pop-ups for this site.'); return; }
    w.document.open(); w.document.write(html); w.document.close();
    w.focus(); w.print();
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 20px', overflowY: 'auto' }}>
      <div style={{ background: 'var(--surface)', borderRadius: 14, width: '100%', maxWidth: 640, padding: 28, boxShadow: '0 8px 40px rgba(0,0,0,0.22)' }} role="dialog" aria-label={`History for ${item.name}`}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 18, margin: 0, color: 'var(--brand)' }}>History: {item.name}</h2>
          <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text3)', lineHeight: 1 }}>✕</button>
        </div>
        <p style={{ fontSize: 14, color: 'var(--text3)', margin: '0 0 16px' }}>
          Every time this was done, who did it, and the proof. This is what you show an insurer, council or funder.
        </p>

        <FormError message={error} />

        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          <button className="btn-primary" onClick={() => { setShowAdd(s => !s); setError(''); }} style={{ fontSize: 14 }}>
            {showAdd ? 'Cancel' : '+ Add a past record'}
          </button>
          <button className="btn-secondary" onClick={handlePrint} disabled={rows.length === 0} style={{ fontSize: 14 }}>Print evidence</button>
        </div>

        {showAdd && (
          <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 14, marginBottom: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Date it was done</label>
              <input className="form-input" type="date" max={todayStr} value={doneOn} onChange={e => setDoneOn(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Done by</label>
              <input className="form-input" value={doneBy} maxLength={120} onChange={e => setDoneBy(e.target.value)} placeholder="Name or company" />
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Note (optional)</label>
              <input className="form-input" value={note} maxLength={500} onChange={e => setNote(e.target.value)} placeholder="e.g. Evacuated in 3 min 40 s, all accounted for" />
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Proof (optional: certificate, photo, report)</label>
              <input type="file" onChange={e => setFile(e.target.files?.[0] || null)} />
            </div>
            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn-primary" onClick={handleAdd} disabled={saving}>{saving ? 'Saving…' : 'Save record'}</button>
            </div>
          </div>
        )}

        {loading ? (
          <p style={{ color: 'var(--text3)' }}>Loading…</p>
        ) : rows.length === 0 ? (
          <p style={{ color: 'var(--text3)' }}>Nothing recorded yet. Tap “✓ Done” on the item when it is next done, or add a past record above.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {rows.map(r => (
              <div key={r.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
                  <strong>{formatDay(r.done_on)}</strong>
                  <span style={{ fontSize: 12, color: 'var(--text3)' }}>{sourceLabel(r.source)}</span>
                </div>
                <div style={{ fontSize: 14, color: 'var(--text2)' }}>{r.done_by ? `Done by ${r.done_by}` : 'Done by: not recorded'}</div>
                {r.note && <div style={{ fontSize: 14, marginTop: 4 }}>{r.note}</div>}
                <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
                  {r.document_url && (
                    <button onClick={() => onOpenProof(r.document_url)} style={{ fontSize: 14, color: 'var(--brand)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: 0 }}>
                      📎 {r.document_name || 'View proof'}
                    </button>
                  )}
                  {isAdmin && (
                    <button onClick={() => handleDelete(r)} style={{ fontSize: 12, color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Remove (mistake)</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
