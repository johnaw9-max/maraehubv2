export function getComplianceStatus(items) {
  const now  = new Date(); now.setHours(0, 0, 0, 0);
  const in30 = new Date(now); in30.setDate(in30.getDate() + 30);

  const overdue = items.filter(c =>
    c.due_date && new Date(c.due_date + 'T12:00:00') < now
  );
  const dueSoon = items.filter(c =>
    c.due_date && new Date(c.due_date + 'T12:00:00') >= now && new Date(c.due_date + 'T12:00:00') <= in30
  );
  const neverAssessed = items.filter(c => !c.due_date && !c.last_checked_date);
  const compliant = items.filter(c =>
    (c.due_date && new Date(c.due_date + 'T12:00:00') > in30) || (!c.due_date && c.last_checked_date)
  );

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
