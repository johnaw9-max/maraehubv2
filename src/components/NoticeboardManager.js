import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const CATEGORIES = ['General', 'Urgent', 'Event', 'Maintenance'];
const CAT_COLORS = {
  Urgent: { bg: '#faeae7', color: '#a63020', border: '#a63020' },
  Event: { bg: '#fdf0dc', color: '#c8902a', border: '#c8902a' },
  Maintenance: { bg: '#fdf0dc', color: '#c8902a', border: '#c8902a' },
  General: { bg: '#e8f4ef', color: '#2d6e57', border: '#2d6e57' },
};
const EMPTY_FORM = { title: '', body: '', category: 'General' };

export default function NoticeboardManager({ isTrustee, profile }) {
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { fetchNotices(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchNotices() {
    setLoading(true);
    const { data } = await supabase
      .from('notices')
      .select('*')
      .order('created_at', { ascending: false });
    setNotices(data || []);
    setLoading(false);
  }

  async function handlePost() {
    if (!form.title.trim() || !form.body.trim()) { setError('Please fill in title and message'); return; }
    setSaving(true); setError('');
    const { error } = await supabase.from('notices').insert({
      title: form.title.trim(),
      body: form.body.trim(),
      category: form.category,
      author: profile?.full_name || 'Trustee',
    });
    if (error) { setError(error.message); setSaving(false); return; }
    setForm(EMPTY_FORM);
    setShowForm(false);
    setSaving(false);
    fetchNotices();
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this notice?')) return;
    await supabase.from('notices').delete().eq('id', id);
    fetchNotices();
  }

  function formatDate(d) {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function setField(k, v) { setForm(f => ({ ...f, [k]: v })); }

  const filtered = filter === 'all' ? notices : notices.filter(n => n.category === filter);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 22 }}>Noticeboard</h2>
          <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>Announcements for the whānau</p>
        </div>
        {isTrustee && (
          <button className="btn-primary" onClick={() => { setShowForm(true); setError(''); setForm(EMPTY_FORM); }}>
            + Post Notice
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {['all', ...CATEGORIES].map(cat => (
          <button key={cat} onClick={() => setFilter(cat)}
            style={{
              padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
              border: '1px solid var(--border)', cursor: 'pointer',
              background: filter === cat ? 'var(--brand)' : 'var(--surface)',
              color: filter === cat ? '#fff' : 'var(--text2)',
              fontFamily: 'DM Sans, sans-serif',
            }}>
            {cat === 'all' ? 'All Notices' : cat}
          </button>
        ))}
      </div>

      {isTrustee && showForm && (
        <div className="panel" style={{ marginBottom: 20 }}>
          <div className="modal-title" style={{ fontSize: 16, marginBottom: 16 }}>Post a Notice</div>
          {error && <div className="alert alert-error">{error}</div>}
          <div className="form-group">
            <label className="form-label">Title *</label>
            <input className="form-input" value={form.title} onChange={e => setField('title', e.target.value)} placeholder="e.g. Marae closed this weekend" />
          </div>
          <div className="form-group">
            <label className="form-label">Message *</label>
            <textarea className="form-input" rows={4} value={form.body} onChange={e => setField('body', e.target.value)} placeholder="Write your notice here..." style={{ resize: 'vertical' }} />
          </div>
          <div className="form-group">
            <label className="form-label">Category</label>
            <select className="form-input" value={form.category} onChange={e => setField('category', e.target.value)}>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="modal-actions">
            <button className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
            <button className="btn-primary" onClick={handlePost} disabled={saving}>{saving ? 'Posting...' : 'Post Notice'}</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading">Loading notices...</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="emoji">📢</div>
          <div>No notices yet{filter !== 'all' ? ` in ${filter}` : ''}.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(n => {
            const style = CAT_COLORS[n.category] || CAT_COLORS.General;
            return (
              <div key={n.id} className="panel" style={{ borderLeft: `4px solid ${style.border}` }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 15, fontWeight: 600 }}>{n.title}</span>
                    <span style={{ fontSize: 10, borderRadius: 20, padding: '2px 8px', fontWeight: 600, background: style.bg, color: style.color }}>{n.category}</span>
                  </div>
                  {isTrustee && (
                    <button onClick={() => handleDelete(n.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: 15, flexShrink: 0 }}>✕</button>
                  )}
                </div>
                <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 10 }}>{n.body}</p>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>{n.author} · {formatDate(n.created_at)}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
