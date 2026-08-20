export function getItemComplianceStatus(item) {
  const now  = new Date(); now.setHours(0, 0, 0, 0);
  const in30 = new Date(now); in30.setDate(in30.getDate() + 30);

  if (item.due_date) {
    const due = new Date(item.due_date + 'T12:00:00');
    if (due < now) return 'overdue';
    if (due <= in30) return 'due_soon';
    return 'compliant';
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

  return {
    total,
    overdue,
    dueSoon,
    neverAssessed,
    compliant,
    compliancePct: assessedTotal ? Math.round((compliant.length / assessedTotal) * 100) : 100,
    isFullyCompliant: overdue.length === 0 && neverAssessed.length === 0,
  };
}
