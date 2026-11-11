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

// Stage-weighted compliance percentage, used only for the Health Score's
// Compliance category. Start here (stage 1) counts 3x, Next 2x, Later and
// unstaged 1x, so an overdue life-safety item cannot be hidden behind many
// healthy good-practice items. With no staged items every weight is 1, so
// the result equals getComplianceStatus().compliancePct exactly.
export const STAGE_WEIGHT = { 1: 3, 2: 2, 3: 1 };

export function getWeightedCompliancePct(items) {
  let good = 0, total = 0;
  items.forEach(c => {
    const status = getItemComplianceStatus(c);
    if (status === 'not_set') return;
    const w = STAGE_WEIGHT[c.stage] || 1;
    total += w;
    if (status === 'compliant') good += w;
  });
  return total ? Math.round((good / total) * 100) : null;
}
