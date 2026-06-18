import React, { useState, useEffect } from 'react';

const VERSION = '1.3';
const STORAGE_KEY = 'maraehub_seen_version';

export default function WhatsNew() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY) !== VERSION) {
      setVisible(true);
    }
  }, []);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, VERSION);
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      onClick={e => e.target === e.currentTarget && dismiss()}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 2000, padding: 24,
      }}
    >
      <div style={{
        background: '#fff', borderRadius: 16, width: '100%', maxWidth: 520,
        overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
      }}>
        {/* HEADER */}
        <div style={{
          background: 'linear-gradient(135deg, #1a4a3a 0%, #2e7d52 100%)',
          padding: '28px 28px 22px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
            <div style={{
              background: '#c8902a', borderRadius: 8, padding: '4px 12px',
              fontSize: 12, fontWeight: 700, color: '#fff', letterSpacing: '0.06em',
            }}>
              V1.3
            </div>
          </div>
          <div style={{
            fontFamily: 'Playfair Display, serif', fontSize: 24, fontWeight: 700,
            color: '#c8902a', lineHeight: 1.2,
          }}>
            New in MaraeHub V1.3
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 6 }}>
            Here's what's new for your committee this release.
          </div>
        </div>

        {/* CONTENT */}
        <div style={{ padding: '24px 28px' }}>

          {/* WORKFLOWS FEATURE */}
          <div style={{
            background: '#f0f7f4', border: '1px solid #a8d8c0',
            borderRadius: 12, padding: '18px 20px', marginBottom: 16,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{
                width: 38, height: 38, borderRadius: 10,
                background: '#1a4a3a', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 18, flexShrink: 0,
              }}>⚙️</div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--brand)' }}>Workflow Engine</div>
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>Operations → Workflows</div>
              </div>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7, margin: 0 }}>
              Trustees can now start managed workflows from <strong>15 built-in templates</strong> covering
              Governance, Compliance, Maintenance, Operations, and Funding.
              One click creates all tasks automatically and progress is tracked in the
              Active Workflows panel and Board View. No more manually building the same
              checklists from scratch — every step is pre-loaded and ready.
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
              {['Tangihanga Prep', 'Insurance Renewal', 'Fire Safety', 'Trustee Meeting', 'Contractor Vetting'].map(label => (
                <span key={label} style={{
                  fontSize: 11, fontWeight: 500, color: '#1a4a3a',
                  background: '#d4ede3', borderRadius: 20, padding: '3px 10px',
                }}>
                  {label}
                </span>
              ))}
              <span style={{
                fontSize: 11, fontWeight: 500, color: 'var(--text3)',
                background: 'var(--cream2)', borderRadius: 20, padding: '3px 10px',
              }}>
                + 10 more
              </span>
            </div>
          </div>

          {/* WHERE TO FIND IT */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: '#fdf4e8', border: '1px solid #e8c880',
            borderRadius: 10, padding: '12px 16px', marginBottom: 20,
          }}>
            <span style={{ fontSize: 18 }}>🗺️</span>
            <div style={{ fontSize: 13, color: '#7a4f00' }}>
              Find it under <strong>Operations → Workflows</strong> in the main navigation.
            </div>
          </div>

          {/* DISMISS */}
          <button
            onClick={dismiss}
            style={{
              width: '100%', padding: '13px',
              background: 'var(--brand)', color: '#fff',
              border: 'none', borderRadius: 10,
              fontSize: 15, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'DM Sans, sans-serif',
            }}
          >
            Got it — let's go
          </button>
          <div style={{ textAlign: 'center', marginTop: 10, fontSize: 12, color: 'var(--text3)' }}>
            This won't show again. Find help anytime using the ❓ Help button.
          </div>
        </div>
      </div>
    </div>
  );
}
