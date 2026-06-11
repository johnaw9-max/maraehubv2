import React, { useState, useRef, useEffect } from 'react';

// ─── SEMANTIC COLOUR PALETTE ──────────────────────────────────────────────────
// Green  = Compliant / On Track / Approved / Completed / Confirmed
// Orange = Due Soon / At Risk / In Progress / Pending
// Red    = Overdue / Behind Schedule / Declined / Urgent / Critical
// Grey   = Not Started / Draft / Cancelled / Not Set

export const PILL_COLORS = {
  green:  { bg: '#e8f4ef', color: '#1a4a3a', hoverBg: '#c8e8d8' },
  orange: { bg: '#fdf0dc', color: '#7a4f00', hoverBg: '#f5d9a0' },
  red:    { bg: '#faeae7', color: '#a63020', hoverBg: '#f5c0b8' },
  grey:   { bg: '#f5f0e8', color: '#6b6058', hoverBg: '#e0d8cc' },
};

// Maps every status value used across all modules to a semantic colour
export const STATUS_TO_COLOR = {
  // Grants
  approved:      'green',
  declined:      'red',
  'in-progress': 'orange',
  submitted:     'orange',
  reporting:     'orange',
  researching:   'grey',
  // Projects
  completed:     'green',
  active:        'orange',
  review:        'orange',
  planning:      'grey',
  // Tasks
  open:          'orange',
  cancelled:     'grey',
  // Bookings
  pending:       'orange',
  confirmed:     'green',
  // Compliance (computed)
  compliant:     'green',
  due_soon:      'orange',
  overdue:       'red',
  not_set:       'grey',
  // Goals
  not_started:   'grey',
  in_progress:   'orange',
  at_risk:       'orange',
  // Incident severity
  minor:         'grey',
  moderate:      'orange',
  serious:       'red',
  critical:      'red',
  // Traffic-light pass-through keys
  green:         'green',
  orange:        'orange',
  red:           'red',
  grey:          'grey',
};

const STATUS_LABELS = {
  researching:   'Researching',
  'in-progress': 'In Progress',
  submitted:     'Submitted',
  approved:      'Approved',
  declined:      'Declined',
  reporting:     'Reporting',
  planning:      'Planning',
  active:        'Active',
  review:        'In Review',
  completed:     'Completed',
  open:          'Open',
  cancelled:     'Cancelled',
  pending:       'Pending',
  confirmed:     'Confirmed',
  compliant:     'Compliant',
  due_soon:      'Due Soon',
  overdue:       'Overdue',
  not_set:       'Not Set',
  not_started:   'Not Started',
  in_progress:   'In Progress',
  at_risk:       'At Risk',
  minor:         'Minor',
  moderate:      'Moderate',
  serious:       'Serious',
  critical:      'Critical',
  resolved:      'Resolved',
};

export function getColorKey(status) {
  return STATUS_TO_COLOR[status] || 'grey';
}

export function getStatusLabel(status) {
  if (!status) return '—';
  return STATUS_LABELS[status] || status.charAt(0).toUpperCase() + status.slice(1).replace(/-|_/g, ' ');
}

/**
 * StatusPill — Monday.com style inline status badge.
 *
 * Props:
 *   status         — current status string
 *   options        — array of valid status strings for the dropdown (omit for read-only)
 *   onStatusChange — (newStatus) => void  (omit for read-only)
 *   size           — 'sm' (default, 11px) | 'md' (12px)
 */
export default function StatusPill({ status, options, onStatusChange, size = 'sm' }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  const colorKey = getColorKey(status);
  const colors   = PILL_COLORS[colorKey];
  const label    = getStatusLabel(status);
  const interactive = Boolean(options && onStatusChange);

  useEffect(() => {
    if (!open) return;
    function onOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [open]);

  const pillStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 3,
    fontSize: size === 'sm' ? 11 : 12,
    fontWeight: 600,
    borderRadius: 20,
    padding: size === 'sm' ? '3px 10px' : '4px 13px',
    background: colors.bg,
    color: colors.color,
    whiteSpace: 'nowrap',
    letterSpacing: '0.02em',
    fontFamily: 'DM Sans, sans-serif',
    border: 'none',
    cursor: interactive ? 'pointer' : 'default',
    userSelect: 'none',
    transition: 'background 0.15s',
  };

  if (!interactive) {
    return <span style={pillStyle}>{label}</span>;
  }

  return (
    <span ref={wrapRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        style={pillStyle}
        onMouseEnter={e => { e.currentTarget.style.background = colors.hoverBg; }}
        onMouseLeave={e => { e.currentTarget.style.background = colors.bg; }}
        onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        aria-label={`Status: ${label}. Click to change.`}
      >
        {label}
        <span style={{ fontSize: 8, opacity: 0.6, marginLeft: 2, lineHeight: 1 }}>▼</span>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 5px)',
            left: 0,
            zIndex: 950,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            boxShadow: '0 6px 24px rgba(0,0,0,0.16)',
            minWidth: 160,
            overflow: 'hidden',
            padding: '4px 0',
          }}
          onClick={e => e.stopPropagation()}
        >
          {options.map(opt => {
            const ck     = getColorKey(opt);
            const oc     = PILL_COLORS[ck];
            const ol     = getStatusLabel(opt);
            const active = opt === status;
            return (
              <button
                key={opt}
                type="button"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 9,
                  width: '100%',
                  padding: '7px 14px',
                  background: active ? oc.bg : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: active ? 700 : 500,
                  color: active ? oc.color : 'var(--text1)',
                  textAlign: 'left',
                  fontFamily: 'DM Sans, sans-serif',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--surface2)'; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = active ? oc.bg : 'transparent'; }}
                onClick={() => { onStatusChange(opt); setOpen(false); }}
              >
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: oc.color, flexShrink: 0, opacity: 0.9 }} />
                <span>{ol}</span>
                {active && <span style={{ marginLeft: 'auto', fontSize: 11, color: oc.color }}>✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </span>
  );
}
