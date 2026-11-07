import { useState, useCallback } from 'react';
import { supabase } from './supabase';

/**
 * D-09 AI Consent Gate
 *
 * Returns { enabled, checking, ConsentModal, requestConsent }
 *
 * Usage:
 *   const { enabled, ConsentModal, requestConsent } = useAiDrafting(entityId, aiDraftingEnabled);
 *
 *   // Before calling AI:
 *   const ok = await requestConsent();
 *   if (!ok) return;  // user declined
 *   // ... call AI function
 *
 *   // Render somewhere in the component:
 *   <ConsentModal />
 */
export function useAiDrafting(entityId, initialEnabled) {
  const [enabled, setEnabled]   = useState(!!initialEnabled);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [saveError, setSaveError] = useState('');
  // resolveRef holds the Promise resolve from requestConsent()
  const [resolveRef, setResolveRef] = useState(null);

  // Called before any AI action. Returns a Promise<boolean>.
  // If already enabled → resolves true immediately.
  // If not enabled → shows the consent modal; resolves true/false on user action.
  const requestConsent = useCallback(() => {
    if (enabled) return Promise.resolve(true);
    return new Promise((resolve) => {
      setResolveRef(() => resolve);
      setShowModal(true);
    });
  }, [enabled]);

  async function handleAccept() {
    if (!entityId) { resolveRef?.(false); setShowModal(false); return; }
    setSaving(true);
    setSaveError('');
    const { data, error } = await supabase
      .from('marae_settings')
      .update({ ai_drafting_enabled: true })
      .eq('id', entityId)
      .select('id');
    setSaving(false);
    // Only an administrator can change this setting. If nothing was saved, do not
    // pretend it was: the server would refuse the request anyway.
    if (error || !data || data.length === 0) {
      setSaveError('Only an administrator can turn on AI features for this marae. Please ask one to turn them on in Marae Settings.');
      return;
    }
    setEnabled(true);
    setShowModal(false);
    resolveRef?.(true);
  }

  function handleDecline() {
    setShowModal(false);
    resolveRef?.(false);
  }

  function ConsentModal() {
    if (!showModal) return null;
    return (
      <div style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
        zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}>
        <div style={{
          background: '#fff', borderRadius: 14, maxWidth: 480, width: '100%',
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)', overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{ background: '#1a4a3a', padding: '20px 24px' }}>
            <div style={{ color: '#c8902a', fontWeight: 800, fontSize: 16, marginBottom: 4 }}>
              AI features — Enable for this Marae?
            </div>
            <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>
              This feature is opt-in. Please read before enabling.
            </div>
          </div>

          {/* Body */}
          <div style={{ padding: '24px', fontSize: 14, lineHeight: 1.75, color: '#2a2520' }}>
            <p style={{ marginTop: 0 }}>
              AI features use <strong>Anthropic's Claude service</strong>, which may process information outside New Zealand, to write draft text. They only run when a trustee clicks a button, and nothing is saved to your records until a trustee reviews it.
            </p>

            <div style={{ background: '#fdf8ee', border: '1px solid #c8902a40', borderLeft: '4px solid #c8902a', borderRadius: 8, padding: '14px 16px', marginBottom: 16 }}>
              <strong style={{ color: '#a06010' }}>What gets sent to Anthropic:</strong>
              <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>
                <li>Your marae's name (and location, iwi and hapū for grant drafts)</li>
                <li>Minutes drafting: the rough notes you type</li>
                <li>Grant drafts: the grant's funder, amount and notes, and the goal it is for</li>
                <li>AI reports: a summary of your records, such as task and goal titles, the names of people responsible, grant funders and amounts, finance figures (administrators only), and compliance and risk titles</li>
              </ul>
            </div>

            <p style={{ marginBottom: 0 }}>
              Please do not include sensitive personal, whānau, tangi or dispute details in notes you send. MaraeHub uses Anthropic's business API, where Anthropic's published terms say customer content is not used to train its models. Anthropic may keep content for a limited period, and longer if it is flagged for misuse or the law requires it. An administrator can switch AI features off at any time in Marae Settings. See our{' '}
              <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: '#1a4a3a' }}>Privacy Policy</a> for details.
            </p>
          </div>

          {saveError && (
            <div role="alert" style={{ margin: '0 24px 12px', padding: '10px 12px', background: '#fdecea', border: '1px solid #f5c6c0', borderRadius: 8, fontSize: 13, color: '#8a2a1f' }}>{saveError}</div>
          )}

          {/* Footer */}
          <div style={{ padding: '0 24px 24px', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button
              onClick={handleDecline}
              style={{ padding: '10px 20px', background: 'none', border: '1px solid #e0dbd4', borderRadius: 8, fontSize: 14, cursor: 'pointer', color: '#7a7268' }}
            >
              Cancel — don't enable
            </button>
            <button
              onClick={handleAccept}
              disabled={saving}
              style={{ padding: '10px 22px', background: '#1a4a3a', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
            >
              {saving ? 'Enabling…' : 'Enable AI features'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return { enabled, ConsentModal, requestConsent };
}
