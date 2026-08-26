import React, { useState, useEffect } from 'react';
import { getGettingStartedStatus } from '../lib/gettingStarted';

const GREEN  = '#0F6E56';
const CREAM  = '#F5F2EA';
const BORDER = '#E0DDD5';
const WHITE  = '#FFFFFF';
const TEXT1  = '#1A1A18';
const TEXT3  = '#888884';

export default function GettingStartedChecklist({ onNavigate }) {
  const [status, setStatus] = useState(null);

  useEffect(() => { getGettingStartedStatus().then(setStatus); }, []);

  if (!status) return null;

  const { items, completed, total } = status;

  if (completed === total) {
    return (
      <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '12px 18px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 15 }}>✅</span>
        <span style={{ fontSize: 14, fontWeight: 600, color: GREEN, fontFamily: 'DM Sans, sans-serif' }}>Setup complete</span>
      </div>
    );
  }

  return (
    <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '24px 28px', marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontFamily: 'Playfair Display, serif', fontSize: 16, fontWeight: 700, color: TEXT1 }}>
          Getting Started
        </span>
        <span style={{ fontSize: 13, fontWeight: 600, color: TEXT3, fontFamily: 'DM Sans, sans-serif' }}>
          {completed} of {total} complete
        </span>
      </div>

      <div style={{ background: CREAM, borderRadius: 8, height: 6, overflow: 'hidden', marginBottom: 18 }}>
        <div style={{ width: `${(completed / total) * 100}%`, height: '100%', background: GREEN, borderRadius: 8, transition: 'width 0.4s ease' }} />
      </div>

      <div>
        {items.map((item, i) => (
          <div
            key={item.key}
            onClick={() => onNavigate && onNavigate(item.navTo)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 4px',
              cursor: onNavigate ? 'pointer' : 'default',
              borderBottom: i < items.length - 1 ? `1px solid ${BORDER}` : 'none',
            }}
          >
            <span style={{
              width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700,
              background: item.done ? GREEN : WHITE,
              color: item.done ? WHITE : TEXT3,
              border: `1.5px solid ${item.done ? GREEN : BORDER}`,
            }}>
              {item.done ? '✓' : ''}
            </span>
            <span style={{
              fontSize: 14, fontFamily: 'DM Sans, sans-serif',
              color: item.done ? TEXT3 : TEXT1,
              textDecoration: item.done ? 'line-through' : 'none',
            }}>
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
