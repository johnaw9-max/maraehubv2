export function getRiskStatus(items) {
  const total = items.length;
  const highOpen = items.filter(r => r.risk_rating === 'High' && r.status !== 'Closed');
  // null (not 100) when the register is empty -- an unused risk register has
  // no real basis for a percentage, and 100 previously read as "fully
  // risk-mitigated" instead of "no data yet", same failure shape as the
  // compliancePct fix in complianceStatus.js (flagged 2026-08-23).
  const riskPct = total ? Math.round(((total - highOpen.length) / total) * 100) : null;
  return { total, highOpen, riskPct };
}
