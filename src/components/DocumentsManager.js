import React, { useState, useEffect, useRef } from 'react'; // updated
import { supabase } from '../lib/supabase';
 
const CATEGORIES = ['Governance', 'Finance', 'Legal', 'Health & Safety', 'Policies', 'Other'];
 
const EXT_ICONS = { pdf: '📄', doc: '📝', docx: '📝', xls: '📊', xlsx: '📊', png: '🖼️', jpg: '🖼️', jpeg: '🖼️' };
 
 
const CAT_COLORS = {
  'Governance': { bg: '#e8f4ef', color: '#1a4a3a' },
  'Finance': { bg: '#fdf0dc', color: '#c8902a' },
  'Legal': { bg: '#e8eef8', color: '#1a4a8a' },
  'Health & Safety': { bg: '#faeae7', color: '#a63020' },
  'Policies': { bg: '#f0ecf8', color: '#6b42a8' },
  'Other': { bg: '#f5f0e8', color: '#4a4438' },
};
 
const EMPTY_FORM = { title: '', category: 'Governance', notes: '' };
 
export default function DocumentsManager() {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef();
 
  useEffect(() => { fetchDocs(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
 
  async function fetchDocs() {
    setLoading(true);
    const { data } = await supabase
      .from('documents')
      .select('*')
      .order('created_at', { ascending: false });
    setDocs(data || []);
    setLoading(false);
  }
 
  function getExt(filename) {
    return filename ? filename.split('.').pop().toLowerCase() : '';
  }
 
  function formatSize(bytes) {
    if (!bytes) return '—';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }
 
  function formatDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });
  }
 
  function handleFileSelect(f) {
    if (!f) return;
    setFile(f);
    if (!form.title) setForm(prev => ({ ...prev, title: f.name.replace(/\.[^.]+$/, '') }));
  }
 
  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFileSelect(f);
  }
 
  async function handleUpload() {
    if (!form.title.trim()) { setError('Please enter a document title'); return; }
    setUploading(true);
    setError('');
 
    let file_url = null;
    let file_name = null;
    let file_size = null;
    let file_type = null;
 
    if (file) {
      const ext = getExt(file.name);
      const path = `documents/${Date.now()}-${file.name.replace(/\s+/g, '_')}`;
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(path, file);
 
      if (uploadError) {
        // If storage bucket doesn't exist yet, save record without file
        console.warn('Storage upload failed:', uploadError.message);
      } else {
        const { data: urlData } = supabase.storage
          .from('documents')
          .getPublicUrl(path);
        file_url = urlData?.publicUrl || null;
      }
 
      file_name = file.name;
      file_size = file.size;
      file_type = ext;
    }
 
    const { error: dbError } = await supabase.from('documents').insert({
      title: form.title.trim(),
      category: form.category,
      notes: form.notes.trim(),
      file_name,
      file_size,
      file_type,
      file_url,
    });
 
    if (dbError) {
      setError(dbError.message);
      setUploading(false);
      return;
    }
 
    setShowModal(false);
    setForm(EMPTY_FORM);
    setFile(null);
    setUploading(false);
    fetchDocs();
  }
 
  async function handleDelete(doc) {
    if (!window.confirm(`Delete "${doc.title}"?`)) return;
    if (doc.file_url) {
      const path = doc.file_url.split('/maraehub/')[1];
      if (path) await supabase.storage.from('documents').remove([path]);
    }
    await supabase.from('documents').delete().eq('id', doc.id);
    fetchDocs();
  }
 
  function setField(k, v) { setForm(f => ({ ...f, [k]: v })); }
 
  const filtered = filter === 'all' ? docs : docs.filter(d => d.category === filter);
 
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 22 }}>Document Library</h2>
          <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>Marae charters, policies, and important files</p>
        </div>
        <button className="btn-primary" onClick={() => { setShowModal(true); setError(''); setForm(EMPTY_FORM); setFile(null); }}>
          + Upload Document
        </button>
      </div>
 
      {/* CATEGORY FILTERS */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {['all', ...CATEGORIES].map(cat => (
          <button key={cat} onClick={() => setFilter(cat)}
            style={{
              padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
              border: '1px solid var(--border)', cursor: 'pointer',
              background: filter === cat ? 'var(--brand)' : 'var(--surface)',
              color: filter === cat ? '#fff' : 'var(--text2)',
              textTransform: cat === 'all' ? 'capitalize' : 'none',
              fontFamily: 'DM Sans, sans-serif',
            }}>
            {cat === 'all' ? 'All Documents' : cat}
          </button>
        ))}
      </div>
 
      {/* DOCUMENT LIST */}
      {loading ? (
        <div className="loading">Loading documents...</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="emoji">📁</div>
          <div>No documents yet{filter !== 'all' ? ` in ${filter}` : ''}.</div>
          <button className="btn-primary" style={{ marginTop: 16 }} onClick={() => setShowModal(true)}>
            + Upload First Document
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(doc => {
            const ext = doc.file_type || getExt(doc.file_name || '');
            const catStyle = CAT_COLORS[doc.category] || CAT_COLORS['Other'];
            return (
              <div key={doc.id} className="panel" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: 8, background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                  {EXT_ICONS[ext] || '📄'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{doc.title}</span>
                    <span style={{ fontSize: 10, borderRadius: 20, padding: '2px 8px', fontWeight: 600, background: catStyle.bg, color: catStyle.color }}>
                      {doc.category}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text3)', flexWrap: 'wrap' }}>
                    {doc.notes && <span>{doc.notes}</span>}
                    {doc.file_name && <span>📎 {doc.file_name}</span>}
                    {doc.file_size && <span>{formatSize(doc.file_size)}</span>}
                    <span>{formatDate(doc.created_at)}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  {doc.file_url && (
                    <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                      style={{ width: 32, height: 32, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', fontSize: 15, color: 'var(--brand)' }}
                      title="Download">⬇</a>
                  )}
                  <button onClick={() => handleDelete(doc)}
                    style={{ width: 32, height: 32, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', fontSize: 15, color: 'var(--danger)' }}
                    title="Delete">✕</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
 
      {/* UPLOAD MODAL */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-title">Upload Document</div>
            {error && <div className="alert alert-error">{error}</div>}
 
            {/* DROP ZONE */}
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current.click()}
              style={{
                border: `2px dashed ${dragOver ? 'var(--brand)' : 'var(--border)'}`,
                borderRadius: 10, padding: 24, textAlign: 'center',
                marginBottom: 16, cursor: 'pointer',
                background: dragOver ? '#eaf4f0' : 'var(--surface2)',
                transition: 'all 0.2s'
              }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>☁️</div>
              {file ? (
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text1)' }}>{file.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{formatSize(file.size)}</div>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)' }}>Click to browse or drag & drop</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>PDF, Word, Excel, Images</div>
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={e => handleFileSelect(e.target.files[0])} />
 
            <div className="form-group">
              <label className="form-label">Document Title *</label>
              <input className="form-input" value={form.title} onChange={e => setField('title', e.target.value)} placeholder="e.g. Marae Charter 2024" />
            </div>
 
            <div className="form-group">
              <label className="form-label">Category</label>
              <select className="form-input" value={form.category} onChange={e => setField('category', e.target.value)}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
 
            <div className="form-group">
              <label className="form-label">Notes (optional)</label>
              <textarea className="form-input" rows={3} value={form.notes} onChange={e => setField('notes', e.target.value)} placeholder="Any notes about this document..." style={{ resize: 'vertical' }} />
            </div>
 
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleUpload} disabled={uploading}>
                {uploading ? 'Uploading...' : '+ Save Document'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
 
