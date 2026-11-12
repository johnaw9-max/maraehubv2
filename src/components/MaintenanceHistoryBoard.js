import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { buildMonthColumns, buildBoardRows, formatDay } from '../lib/complianceEvidence';

// One-page board: every compliance item against the last 12 months, showing when it was
// actually done. Click a row to open its full history, proof and print page.
export default function MaintenanceHistoryBoard({ items, categories, refreshKey, onOpenHistory }) {
  const [completions, setCompletions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error: err } = await supabase
        .from('compliance_completions').select('compliance_item_id, done_on');
      if (cancelled) return;
      if (err) { setError('Could not load the history. Please try again.'); setCompletions([]); }
      else { setError(''); setCompletions(data || []); }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [refreshKey]);

  const todayStr = new Date().toISOString().split('T')[0];
  const months = buildMonthColumns(todayStr, 12);
  const rows = buildBoardRows(items, completions, months);

  const withRecord = rows.filter(r => r.lastDone && months.some(m => r.monthCounts[m.key])).length;

  // Group by category, keeping the category order the tracker already uses.
  const groups = Object.keys(categories)
    .map(key => ({ key, cat: categories[key], rows: rows.filter(r => r.item.category === key) }))
    .filter(g => g.rows.length > 0);

  const cell = { padding: '6px 4px', textAlign: 'center', borderBottom: '1px solid var(--border)', fontSize: 13 };

  if (loading) return <p style={{ color: 'var(--text3)' }}>Loading…</p>;

  return (
    <div>
      <p style={{ fontSize: 14, color: 'var(--text2)', margin: '0 0 12px' }}>
        When each item was actually done over the last 12 months. {withRecord} of {rows.length} items have a record in that time.
        Tap an item for its full history, proof and a printable evidence page.
      </p>
      {error && <div style={{ color: 'var(--danger)', fontSize: 14, marginBottom: 10 }}>{error}</div>}
      <div className="panel" style={{ padding: 0, overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 900 }}>
          <thead>
            <tr style={{ background: 'var(--surface2)' }}>
              <th style={{ ...cell, textAlign: 'left', padding: '8px 12px', minWidth: 240 }}>Item</th>
              <th style={{ ...cell, minWidth: 96 }}>Last done</th>
              {months.map(m => (
                <th key={m.key} style={{ ...cell, minWidth: 40 }} title={`${m.label} ${m.year}`}>{m.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map(g => (
              <React.Fragment key={g.key}>
                <tr>
                  <td colSpan={2 + months.length} style={{ padding: '8px 12px', fontWeight: 700, fontSize: 14, background: g.cat.bg, color: g.cat.color }}>
                    {g.cat.icon} {g.cat.label}
                  </td>
                </tr>
                {g.rows.map(r => (
                  <tr key={r.item.id} onClick={() => onOpenHistory(r.item)} style={{ cursor: 'pointer' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                    <td style={{ ...cell, textAlign: 'left', padding: '8px 12px' }}>{r.item.name}</td>
                    <td style={{ ...cell, color: r.lastDone ? 'var(--text2)' : 'var(--danger)', whiteSpace: 'nowrap' }}>
                      {r.lastDone ? formatDay(r.lastDone) : 'Nothing recorded'}
                    </td>
                    {months.map(m => {
                      const n = r.monthCounts[m.key] || 0;
                      return (
                        <td key={m.key} style={{ ...cell, background: n ? '#e8f4ef' : 'transparent', color: '#1a4a3a', fontWeight: 700 }}
                            title={n ? `${n} record${n > 1 ? 's' : ''} in ${m.label} ${m.year}` : `Nothing recorded in ${m.label} ${m.year}`}>
                          {n ? (n > 1 ? `✓${n}` : '✓') : ''}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
