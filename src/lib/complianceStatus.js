import { getUrgencyStatus } from './urgencyStatus';

export function getItemComplianceStatus(item) {
  if (item.due_date) {
    const status = getUrgencyStatus(item, { dueSoonDays: 30 });
    return status === 'upcoming' ? 'compliant' : status;
  }
  return item.last_checked_date ? 'compliant' : 'not_set';
}

export function getComplianceStatus(items) {
  const overdue = [], dueSoon = [], neverAssessed = [], compliant = [];
  items.forEach(c => {
    const status = getItemComplianceStatus(c);
    if (status === 'overdue') overdue.push(c);
    else if (status === 'due_soon') dueSoon.push(c);
    else if (status === 'not_set') neverAssessed.push(c);
    else compliant.push(c);
  });

  const total = items.length;

  // Never-assessed items are excluded from the percentage's denominator --
  // they mean "no data yet", not "failing", and were previously
  // indistinguishable from actively non-compliant items in the math (a
  // marae with 15 never-assessed items and 2 real overdue ones would show
  // 0% compliant, reading as catastrophic failure rather than "mostly
  // never set up").
  const assessedTotal = total - neverAssessed.length;

  // null (not 100) when nothing has ever been assessed -- a fully
  // never-assessed register has no real basis for a percentage at all,
  // and 100 previously read as "fully compliant" instead of "no data
  // yet" (flagged 2026-08-23, same failure shape as the fix above).
  return {
    total,
    overdue,
    dueSoon,
    neverAssessed,
    compliant,
    compliancePct: assessedTotal ? Math.round((compliant.length / assessedTotal) * 100) : null,
    isFullyCompliant: overdue.length === 0 && neverAssessed.length === 0,
  };
}
