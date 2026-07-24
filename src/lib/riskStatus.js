export function getRiskStatus(items) {
  const total = items.length;
  const highOpen = items.filter(r => r.risk_rating === 'High' && r.status !== 'Closed');
  const riskPct = total ? Math.round(((total - highOpen.length) / total) * 100) : 100;
  return { total, highOpen, riskPct };
}
