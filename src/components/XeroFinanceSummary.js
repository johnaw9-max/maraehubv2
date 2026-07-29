import React, { useState } from 'react';
import { minsAgo } from '../lib/xero';

export default function XeroFinanceSummary({ xero, onRefresh }) {
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  }

  if (xero?.status === 'error') {
    return (
      <div className="panel" style={{ padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>⚠️</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--danger)', marginBottom: 4 }}>
          Unable to sync with Xero right now
        </div>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12 }}>
          Try refreshing the page. If this keeps happening, check the Xero connection in Settings.
        </div>
        <button className="btn-secondary" onClick={handleRefresh} disabled={refreshing} style={{ fontSize: 12, padding: '7px 14px' }}>
          {refreshing ? 'Checking…' : 'Try again'}
        </button>
      </div>
    );
  }

  const { tenantName, profitAndLoss, lastSyncedAt } = xero;
  const { totalIncome, totalExpenses, netProfit } = profitAndLoss;

  return (
    <div>
      {/* ── CONNECTION STATUS BADGE ──────────────────────────────────────── */}
      <div className="panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, padding: '14px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>✅</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text1)' }}>Connected to Xero</div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
              {tenantName} · Synced {minsAgo(lastSyncedAt)}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            title="Check Xero for the latest numbers now"
            className="btn-secondary"
            style={{ fontSize: 12, padding: '7px 12px' }}
          >
            {refreshing ? '⏳ Refreshing…' : '🔄 Refresh'}
          </button>
          <a
            href="https://go.xero.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary"
            style={{ fontSize: 12, padding: '7px 14px', textDecoration: 'none' }}
          >
            Open full detail in Xero →
          </a>
        </div>
      </div>

      {/* ── 3 SUMMARY CARDS ──────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {[
          { label: 'Total Income', value: `$${(totalIncome/1000).toFixed(1)}k`, icon: '💵', bg: '#e8f4ef', color: 'var(--brand)' },
          { label: 'Total Expenses', value: `$${(totalExpenses/1000).toFixed(1)}k`, icon: '📤', bg: '#faeae7', color: totalExpenses > totalIncome ? 'var(--danger)' : 'var(--text1)' },
          {
            label: netProfit >= 0 ? 'Net Surplus' : 'Net Deficit',
            value: `$${(Math.abs(netProfit)/1000).toFixed(1)}k`,
            icon: netProfit >= 0 ? '✅' : '⚠️',
            bg: netProfit >= 0 ? '#e8f4ef' : '#faeae7',
            color: netProfit >= 0 ? 'var(--brand)' : 'var(--danger)',
          },
        ].map((t, i) => (
          <div key={i} className="panel" style={{ textAlign: 'center', padding: '16px 10px' }}>
            <div style={{ fontSize: 18, marginBottom: 6 }}>{t.icon}</div>
            <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 24, fontWeight: 700, color: t.color }}>{t.value}</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>{t.label}</div>
          </div>
        ))}
      </div>

      {/* ── SCOPE NOTE ────────────────────────────────────────────────────── */}
      <div style={{ fontSize: 11, color: 'var(--text3)', fontStyle: 'italic', marginTop: 16, textAlign: 'center' }}>
        Detailed transaction history isn't available here yet — use the link above to view full detail in Xero.
      </div>
    </div>
  );
}
