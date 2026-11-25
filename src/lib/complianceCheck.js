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
import { indexSources, safeUrl, isFullyChecked } from './itemSources';

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

// Source line for one item, built only from the source register rows the item points to.
// Nothing is added that the register row does not say. No source recorded is stated plainly.
function sourceText(itemId, sourceInfo) {
  if (!sourceInfo) return '';
  const keys = (sourceInfo.keysById || {})[itemId];
  const rowsFound = (Array.isArray(keys) ? keys : []).map(k => (sourceInfo.byKey || {})[k]).filter(Boolean);
  if (rowsFound.length === 0) return ' | SOURCE: no source found (MaraeHub suggestion only)';
  const parts = rowsFound.map(r => {
    const link = safeUrl(r.url);
    const checked = r.checked_on ? `, checked by MaraeHub ${r.checked_on}` : '';
    const state = isFullyChecked(r) ? '' : ', only partly checked';
    return `${r.name}${state}${checked}${link ? `, ${link}` : ''}`;
  });
  return ` | SOURCE: ${parts.join('; ')}`;
}

// Text block for the AI Compliance Report context.
// sourceInfo (optional) = { keysById: {itemId: [keys]}, byKey: {key: legal_sources row} }
export function buildCheckBlock(rows, sourceInfo) {
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
      lines.push(`- ${r.name} (${(r.category || 'other').replace(/_/g, ' ')}; ${cls}; due ${r.due_date})${sourceText(r.id, sourceInfo)}`);
    });
  } else {
    lines.push(`OVERDUE ITEMS: none.`);
  }
  if (sourceInfo) {
    // Every in-scope item with its class, status and source, so the report can name the
    // source for any item it mentions (not only overdue ones).
    const inScopeRows = (Array.isArray(rows) ? rows : []).filter(r => r.status !== 'not_applicable');
    if (inScopeRows.length) {
      lines.push(`ITEMS IN SCOPE AND THEIR SOURCES (${inScopeRows.length}):`);
      inScopeRows.forEach(r => {
        const cls = CLASS_LABEL[r.framework_class] || 'not yet matched to the Framework';
        lines.push(`- ${r.name} (${(r.category || 'other').replace(/_/g, ' ')}; ${cls}; ${String(r.status || '').replace(/_/g, ' ')})${sourceText(r.id, sourceInfo)}`);
      });
    }
    const all = (Array.isArray(rows) ? rows : []).filter(r => r.status !== 'not_applicable');
    const noSource = all.filter(r => !((sourceInfo.keysById || {})[r.id] || []).some(k => (sourceInfo.byKey || {})[k])).length;
    lines.push(`SOURCES: ${all.length - noSource} of ${all.length} items in scope have a recorded source; ${noSource} have no source found.`);
  }
  return lines.join('\n');
}

// Build sourceInfo from the compliance_items rows (id, source_keys) and legal_sources rows.
export function buildSourceInfo(itemRows, sourceRows) {
  const keysById = {};
  for (const r of itemRows || []) if (r && r.id) keysById[r.id] = Array.isArray(r.source_keys) ? r.source_keys : [];
  return { keysById, byKey: indexSources(sourceRows) };
}

// Source list shown under the report, built by the app (never by AI), so every item
// with a source always shows it, whatever the AI chose to write about.
// Returns { withSource: [...], noSource: [...] } for in-scope items.
export function buildSourceList(rows, sourceInfo) {
  const withSource = [];
  const noSource = [];
  (Array.isArray(rows) ? rows : [])
    .filter(r => r.status !== 'not_applicable')
    .forEach(r => {
      const keys = ((sourceInfo && sourceInfo.keysById) || {})[r.id] || [];
      const found = keys.map(k => ((sourceInfo && sourceInfo.byKey) || {})[k]).filter(Boolean);
      const entry = {
        name: r.name,
        category: (r.category || 'other').replace(/_/g, ' '),
        classLabel: CLASS_LABEL[r.framework_class] || 'not yet matched to the Framework',
        sources: found.map(f => ({
          name: f.name,
          url: safeUrl(f.url),
          checkedOn: f.checked_on || '',
          partly: !isFullyChecked(f),
        })),
      };
      (found.length ? withSource : noSource).push(entry);
    });
  const byName = (a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name);
  withSource.sort(byName);
  noSource.sort(byName);
  return { withSource, noSource };
}

// Plain-text version of the same list, for the Copy button.
export function sourceListText(list) {
  if (!list) return '';
  const out = ['', 'SOURCES BEHIND THIS REPORT (added by MaraeHub, not written by AI)'];
  list.withSource.forEach(e => {
    out.push(`- ${e.name} (${e.category}; ${e.classLabel}): ` + e.sources.map(s =>
      `${s.name}${s.partly ? ' (only partly checked)' : ''}${s.checkedOn ? `, checked by MaraeHub ${s.checkedOn}` : ''}${s.url ? `, ${s.url}` : ''}`).join('; '));
  });
  if (list.noSource.length) {
    out.push('No source found (MaraeHub suggestion only):');
    list.noSource.forEach(e => out.push(`- ${e.name} (${e.category}; ${e.classLabel})`));
  }
  return out.join('\n');
}
