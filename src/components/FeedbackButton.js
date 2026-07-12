import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function FeedbackButton({ profile }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState('bug');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit() {
    if (!message.trim()) { setError('Please describe the issue or feedback'); return; }
    setSaving(true); setError('');
    const { data: settings } = await supabase.from('marae_settings').select('marae_name').single();
    const { error } = await supabase.from('feedback').insert({
      user_id: profile?.id,
      user_name: profile?.full_name,
      user_email: profile?.email,
      type,
      message: message.trim(),
      page: window.location.href,
      marae: settings?.marae_name || null,
    });
    if (error) { setError(error.message); setSaving(false); return; }
    setSuccess(true);
    setMessage('');
    setSaving(false);
    setTimeout(() => { setSuccess(false); setOpen(false); }, 2500);
  }

  const TYPE_OPTIONS = [
    { val: 'bug', label: '🐛 Report a Bug', desc: 'Something is broken or not working' },
    { val: 'suggestion', label: '💡 Suggestion', desc: 'An idea to improve MaraeHub' },
    { val: 'question', label: '❓ Question', desc: 'Something I need help with' },
    { val: 'compliment', label: '🌟 Compliment', desc: 'Something that is working well' },
  ];

  return (
    <>
      {/* FLOATING BUTTON */}
      <button
        onClick={() => { setOpen(true); setSuccess(false); setError(''); }}
        style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 500,
          background: 'var(--brand)', color: '#fff',
          border: 'none', borderRadius: 50, padding: '12px 20px',
          fontSize: 13, fontWeight: 600, cursor: 'pointer',
          boxShadow: '0 4px 16px rgba(26,74,58,0.3)',
          fontFamily: 'DM Sans, sans-serif',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
        💬 Feedback
      </button>

      {/* MODAL */}
      {open && (
        <div
          onClick={e => e.target === e.currentTarget && setOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end',
            zIndex: 1000, padding: 24,
          }}>
          <div style={{
            background: '#fff', borderRadius: 16, padding: 24,
            width: '100%', maxWidth: 420,
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 18, fontWeight: 600 }}>Share Feedback</div>
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--text3)' }}>✕</button>
            </div>

            {success ? (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🙏</div>
                <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>Ngā mihi!</div>
                <div style={{ fontSize: 13, color: 'var(--text3)' }}>Your feedback has been received.</div>
              </div>
            ) : (
              <>
                {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>{error}</div>}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                  {TYPE_OPTIONS.map(t => (
                    <div key={t.val} onClick={() => setType(t.val)}
                      style={{
                        padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                        border: `2px solid ${type === t.val ? 'var(--brand)' : 'var(--border)'}`,
                        background: type === t.val ? '#eaf4f0' : 'var(--surface2)',
                        transition: 'all 0.15s',
                      }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text1)', marginBottom: 2 }}>{t.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{t.desc}</div>
                    </div>
                  ))}
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text2)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>
                    {type === 'bug' ? 'Describe the issue' : type === 'suggestion' ? 'Your suggestion' : type === 'question' ? 'Your question' : 'What is working well?'}
                  </label>
                  <textarea
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    placeholder={type === 'bug' ? 'What happened? What were you trying to do?' : 'Tell us more...'}
                    style={{
                      width: '100%', padding: '10px 12px',
                      border: '1px solid var(--border)', borderRadius: 8,
                      fontSize: 13, fontFamily: 'DM Sans, sans-serif',
                      background: 'var(--surface2)', resize: 'vertical', height: 100,
                    }}
                  />
                </div>

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button onClick={() => setOpen(false)}
                    style={{ background: '#fff', color: 'var(--text2)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 16px', fontSize: 13, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
                    Cancel
                  </button>
                  <button onClick={handleSubmit} disabled={saving}
                    style={{ background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
                    {saving ? 'Sending...' : 'Send Feedback'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
