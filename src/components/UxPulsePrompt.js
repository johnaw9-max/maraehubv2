import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

// "Was this easy to use?" trustee feedback prompt (ClickUp 86d422twn).
// Reuses the existing feedback table (type='ux_pulse', rating='up'/'down')
// rather than a new table. Pacing: once per real session, not per module,
// not day-based -- sessionStorage clears itself when the tab/browser
// session ends, so no age math is needed, just a presence check. A
// dismiss (X, no answer) also sets the flag, same as answering -- being
// asked at all counts, not just answering. Mounted once at the
// TrusteeDashboard root, not per-tab, so it was never re-triggering per
// module in the first place.

const STORAGE_KEY = 'maraehub_ux_pulse_shown';
const SHOW_DELAY_MS = 3000;

export default function UxPulsePrompt({ profile }) {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState('ask'); // ask | confusing | done
  const [confusing, setConfusing] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(STORAGE_KEY)) return;
    const timer = setTimeout(() => setVisible(true), SHOW_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  function dismiss() {
    sessionStorage.setItem(STORAGE_KEY, '1');
    setVisible(false);
  }

  async function submit(rating, message) {
    setSaving(true);
    const { data: settings } = await supabase.from('marae_settings').select('marae_name').single();
    await supabase.from('feedback').insert({
      user_id: profile?.id,
      user_name: profile?.full_name,
      user_email: profile?.email,
      type: 'ux_pulse',
      rating,
      message: message || null,
      page: window.location.href,
      marae: settings?.marae_name || null,
    });
    setSaving(false);
    setStep('done');
    sessionStorage.setItem(STORAGE_KEY, '1');
    setTimeout(() => setVisible(false), 2000);
  }

  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 24, left: 24, zIndex: 500,
      background: '#fff', borderRadius: 14, padding: 18,
      width: 300, boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
      border: '1px solid var(--border)', fontFamily: 'DM Sans, sans-serif',
    }}>
      <button
        onClick={dismiss}
        style={{ position: 'absolute', top: 10, right: 12, background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--text3)' }}
      >
        ✕
      </button>

      {step === 'ask' && (
        <>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text1)', marginBottom: 12, paddingRight: 16 }}>
            Was this easy to use?
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => submit('up', null)}
              disabled={saving}
              style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', fontSize: 20, cursor: 'pointer' }}
            >
              👍
            </button>
            <button
              onClick={() => setStep('confusing')}
              disabled={saving}
              style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', fontSize: 20, cursor: 'pointer' }}
            >
              👎
            </button>
          </div>
        </>
      )}

      {step === 'confusing' && (
        <>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text1)', marginBottom: 8, paddingRight: 16 }}>
            What was confusing? <span style={{ fontWeight: 400, color: 'var(--text3)' }}>(optional)</span>
          </div>
          <textarea
            value={confusing}
            onChange={e => setConfusing(e.target.value)}
            placeholder="Tell us more..."
            style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, fontFamily: 'DM Sans, sans-serif', background: 'var(--surface2)', resize: 'vertical', height: 70, boxSizing: 'border-box', marginBottom: 10 }}
          />
          <button
            onClick={() => submit('down', confusing.trim())}
            disabled={saving}
            style={{ width: '100%', padding: '9px 0', borderRadius: 8, border: 'none', background: 'var(--brand)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            {saving ? 'Sending...' : 'Send'}
          </button>
        </>
      )}

      {step === 'done' && (
        <div style={{ textAlign: 'center', padding: '8px 0' }}>
          <div style={{ fontSize: 24, marginBottom: 6 }}>🙏</div>
          <div style={{ fontSize: 13, color: 'var(--text3)' }}>Ngā mihi — thanks for the feedback.</div>
        </div>
      )}
    </div>
  );
}
