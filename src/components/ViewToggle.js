import React from 'react';

// Shared Compact/Detailed button pair, extracted byte-for-byte from
// ComplianceTracker.js's inline markup (14yhc7kw7dt) so every module
// adopting it looks and behaves exactly like Compliance already does.
// `mode`/`onChange` pair with useSortPreference(moduleKey, default) the
// same way Compliance already uses it -- this component owns no state.
export default function ViewToggle({ mode, onChange }) {
  return (
    <div style={{ display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => onChange('compact')}
        style={{
          padding: '7px 14px', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
          background: mode === 'compact' ? 'var(--brand)' : 'var(--surface2)',
          color: mode === 'compact' ? '#fff' : 'var(--text2)',
        }}
      >
        Compact
      </button>
      <button
        type="button"
        onClick={() => onChange('detailed')}
        style={{
          padding: '7px 14px', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
          background: mode === 'detailed' ? 'var(--brand)' : 'var(--surface2)',
          color: mode === 'detailed' ? '#fff' : 'var(--text2)',
        }}
      >
        Detailed
      </button>
    </div>
  );
}
