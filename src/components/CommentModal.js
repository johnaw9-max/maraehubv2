import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

// Extracted from TaskBoard.js (Task View Cleanup, 14yhc7kutvv, Step 2) so
// WorkflowEngine.js can reuse the same task_comments thread for workflow
// parent tasks, instead of duplicating this component.
export default function CommentModal({ task, onClose, onCommentPosted }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [currentUserEmail, setCurrentUserEmail] = useState('');

  useEffect(() => {
    fetchComments();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUserEmail(user?.email || '');
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchComments() {
    setLoading(true);
    const { data } = await supabase
      .from('task_comments')
      .select('*')
      .eq('task_id', task.id)
      .order('created_at', { ascending: false });
    setComments(data || []);
    setLoading(false);
  }

  async function handleSend() {
    const msg = text.trim();
    if (!msg) return;
    setSending(true);
    const { data: { user } } = await supabase.auth.getUser();
    const email = user?.email || '';
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user?.id)
      .single();
    const authorName = profile?.full_name || email || 'Unknown';
    const { error } = await supabase.from('task_comments').insert({
      task_id: task.id,
      author_name: authorName,
      author_email: email,
      message: msg,
    });
    setSending(false);
    if (!error) {
      setText('');
      fetchComments();
      onCommentPosted(task.id);
    }
  }

  async function handleDelete(commentId) {
    if (!window.confirm('Delete this comment?')) return;
    await supabase.from('task_comments').delete().eq('id', commentId);
    setComments(prev => prev.filter(c => c.id !== commentId));
    onCommentPosted(task.id);
  }

  function fmtCommentTime(ts) {
    return new Date(ts).toLocaleString('en-NZ', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: 'numeric', minute: '2-digit',
    });
  }

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth: 500, display: 'flex', flexDirection: 'column', maxHeight: '80vh' }}>
        <div className="modal-title" style={{ fontSize: 16, marginBottom: 4 }}>
          Updates
        </div>
        <div style={{ fontSize: 14, color: 'var(--text3)', marginBottom: 16 }}>{task.title}</div>

        {/* Thread */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, marginBottom: 16 }}>
          {loading ? (
            <div style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 14, padding: 24 }}>Loading...</div>
          ) : comments.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 14, padding: 24 }}>
              No updates yet. Be the first to post.
            </div>
          ) : comments.map(c => (
            <div key={c.id} style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
              <div style={{
                flexShrink: 0, width: 32, height: 32, borderRadius: '50%',
                background: 'var(--brand)', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 700,
              }}>
                {(c.author_name || '?').charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text1)' }}>{c.author_name}</span>
                  <span style={{ fontSize: 11, color: 'var(--text3)' }}>{fmtCommentTime(c.created_at)}</span>
                  {c.author_email === currentUserEmail && (
                    <button
                      onClick={() => handleDelete(c.id)}
                      style={{
                        marginLeft: 'auto', background: 'none', border: 'none',
                        cursor: 'pointer', color: 'var(--text3)', fontSize: 14,
                        padding: '0 2px', lineHeight: 1,
                      }}
                      title="Delete comment"
                    >
                      Delete
                    </button>
                  )}
                </div>
                <div style={{
                  fontSize: 14, color: 'var(--text2)', lineHeight: 1.55,
                  background: 'var(--surface2)', borderRadius: 8, padding: '8px 12px',
                  wordBreak: 'break-word',
                }}>
                  {c.message}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Input */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
          <textarea
            className="form-input"
            rows={3}
            placeholder="Write an update..."
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSend(); }}
            style={{ resize: 'none', marginBottom: 10 }}
            autoFocus
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button className="btn-secondary" onClick={onClose}>Close</button>
            <button className="btn-primary" onClick={handleSend} disabled={sending || !text.trim()}>
              {sending ? 'Sending...' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
