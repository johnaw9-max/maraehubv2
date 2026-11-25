// The "Check" job: is the marae current on its compliance items?
//
// The status of every item is worked out by the database view
// public.compliance_item_status (plain SQL, no AI). This file only turns the
// rows of that view into a count block for the AI Compliance Report, so the
// AI explains numbers it was given and never works out a status itself.
//
// Statuses follow the Marae Governance and Compliance Framework:
//   not_applicable   the marae has recorded that it does not apply
//   not_yet_assessed no check date yet, or checked but no evidence attached
//   action_required  due date has passed
//   compliant        has a check date AND evidence, and is not overdue
// "Not yet assessed" is never counted as a failure.
//
// The view exists only on projects where the migration has been applied. When
// it is missing the caller gets rows = null and falls back to the old report.

export const CHECK_VIEW_COLUMNS =
  'id, category, name, framework_class, applies, due_date, last_checked_date, has_evidence, status, overdue, schedule_missing, applicability_open, framework_review_needed';

const CLASS_LABEL = {
  legal_requirement: 'legal requirement',
  conditional_legal: 'legal requirement if it applies',
  good_practice: 'good practice',
  marae_decision: 'marae decision',
};

export function summariseCheck(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const inScope = list.filter(r => r.status !== 'not_applicable');
  const count = fn => inScope.filter(fn).length;
  return {
    total: list.length,
    notApplicable: list.length - inScope.length,
    inScope: inScope.length,
    compliant: count(r => r.status === 'compliant'),
    actionRequired: count(r => r.status === 'action_required'),
    notYetAssessed: count(r => r.status === 'not_yet_assessed'),
    // Overdue is its own fact: a due date in the past, whatever the check date says.
    overdue: count(r => r.overdue === true),
    applicabilityOpen: count(r => r.applicability_open === true),
    scheduleMissing: count(r => r.schedule_missing === true),
    frameworkReviewNeeded: count(r => r.framework_review_needed === true),
  };
}

// Text block for the AI Compliance Report context.
export function buildCheckBlock(rows) {
  const s = summariseCheck(rows);
  const lines = [
    `CHECK RESULT (worked out by the app from the marae's own records, not by AI; do not recalculate or change these numbers):`,
    `- Items recorded: ${s.total}. Recorded as not applying to this marae: ${s.notApplicable}. Items that apply or are not yet answered: ${s.inScope}.`,
    `- Compliant (check date and evidence on record, not overdue): ${s.compliant}`,
    `- Action required (due date has passed): ${s.actionRequired}`,
    `- Not yet assessed (no check date, or no evidence attached yet; this is NOT a failure): ${s.notYetAssessed}`,
    `- Overdue (due date passed, whatever the check date): ${s.overdue}`,
    `- Applicability not yet answered for a legal-if-it-applies item: ${s.applicabilityOpen}`,
    `- No due date or schedule set: ${s.scheduleMissing}`,
    `- Not yet matched to the Framework: ${s.frameworkReviewNeeded}`,
  ];
  const overdueRows = (Array.isArray(rows) ? rows : [])
    .filter(r => r.overdue === true)
    .sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)));
  if (overdueRows.length) {
    lines.push(`OVERDUE ITEMS (${overdueRows.length}), oldest first:`);
    overdueRows.forEach(r => {
      const cls = CLASS_LABEL[r.framework_class] || 'not yet matched to the Framework';
      lines.push(`- ${r.name} (${(r.category || 'other').replace(/_/g, ' ')}; ${cls}; due ${r.due_date})`);
    });
  } else {
    lines.push(`OVERDUE ITEMS: none.`);
  }
  return lines.join('\n');
}
